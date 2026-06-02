import {
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  spinner
} from '@clack/prompts';
import chalk from 'chalk';
import { execa } from 'execa';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  generateCommitMessageByDiff,
  type OnGenerateCommitProgress
} from '../generateCommitMessageFromGitDiff';
import {
  assertCommitSizeGuardrails,
  exceedsMaxStagedFiles,
  getCommitSizeLimits
} from '../utils/commitGuardrails';
import { chunkStagedFiles } from '../utils/chunkStagedFiles';
import { formatCommitProgressLabel } from '../utils/commitProgressLabel';
import { startElapsedHeartbeat } from '../utils/heartbeat';
import {
  assertGitRepo,
  getChangedFiles,
  getDiff,
  getDiffBetweenBranches,
  getStagedFiles,
  gitAdd,
  gitResetStaged,
  filterDiffForReview
} from '../utils/git';
import { trytm } from '../utils/trytm';
import { getConfig } from './config';
import { performCodeReview, printReviewResult } from './review';
import { standardsFileExists } from './standards';

const config = getConfig();

const getGitRemotes = async () => {
  const { stdout } = await execa('git', ['remote']);
  return stdout.split('\n').filter((remote) => Boolean(remote.trim()));
};

const runWithHeartbeat = async <T>(
  label: string,
  action: (onProgress?: OnGenerateCommitProgress) => Promise<T>
): Promise<T> => {
  const { stop, updateLabel } = startElapsedHeartbeat({ label });
  const onProgress: OnGenerateCommitProgress = (progress) => {
    updateLabel(formatCommitProgressLabel(label, progress));
  };

  try {
    return await action(onProgress);
  } finally {
    stop();
  }
};

// Check for the presence of message templates
const checkMessageTemplate = (extraArgs: string[]): string | false => {
  for (const key in extraArgs) {
    if (extraArgs[key].includes(config.CMT_MESSAGE_TEMPLATE_PLACEHOLDER))
      return extraArgs[key];
  }
  return false;
};

// Open commit message in editor for user to edit
const openInEditor = async (message: string): Promise<string> => {
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  const tmpFile = join(tmpdir(), `COMMIT_EDITMSG_${Date.now()}`);

  try {
    writeFileSync(tmpFile, message, 'utf-8');

    await execa(editor, [tmpFile], {
      stdio: 'inherit',
      shell: true
    });

    const { stdout } = await execa('cat', [tmpFile]);
    return stdout.trim();
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
};

interface GenerateCommitMessageFromGitDiffParams {
  diff: string;
  extraArgs: string[];
  context?: string;
  fullGitMojiSpec?: boolean;
  skipCommitConfirmation?: boolean;
  dryRun?: boolean;
  edit?: boolean;
  noPush?: boolean;
}

export interface CommitOptions {
  context?: string;
  stageAll?: boolean;
  fullGitMojiSpec?: boolean;
  skipCommitConfirmation?: boolean;
  dryRun?: boolean;
  edit?: boolean;
  noPush?: boolean;
  runReview?: boolean;
}

const runCommitReviewIfNeeded = async (
  diff: string,
  runReview: boolean
): Promise<boolean> => {
  if (!runReview) {
    return true;
  }

  if (!standardsFileExists()) {
    outro(
      chalk.yellow(
        '⚠️  No code standards configured.\n\n' +
          'For better review results, configure code standards first:\n' +
          chalk.cyan('  cmt standards import') +
          ' - Import from popular style guides\n' +
          chalk.cyan('  cmt standards set') +
          '    - Create custom standards\n'
      )
    );

    const continueWithoutStandards = await confirm({
      message: 'Continue commit with review (without standards)?',
      initialValue: true
    });

    if (isCancel(continueWithoutStandards) || !continueWithoutStandards) {
      outro(
        chalk.yellow('Commit cancelled. Configure standards and try again.')
      );
      return false;
    }
  }

  const reviewDiff = filterDiffForReview(diff);

  if (!reviewDiff || reviewDiff.trim() === '') {
    outro(
      chalk.yellow(
        'All staged files are excluded from code review (check .commit-ai-review-ignore). Skipping review step.'
      )
    );
    return true;
  }

  const reviewResult = await performCodeReview(reviewDiff);
  printReviewResult(reviewResult);

  const minScore = config.CMT_REVIEW_MIN_SCORE;
  if (minScore !== undefined && reviewResult.overallScore < minScore) {
    outro(
      chalk.red(
        `✖ Code quality score (${reviewResult.overallScore}) is below the minimum threshold (${minScore}).\n` +
          `Please improve the code or adjust the threshold: cmt config set CMT_REVIEW_MIN_SCORE <number>`
      )
    );
    return false;
  }

  if (reviewResult.recommendation === 'block') {
    const continueAnyway = await confirm({
      message: chalk.yellow(
        'Critical issues found. Do you want to continue committing anyway?'
      ),
      initialValue: false
    });

    if (isCancel(continueAnyway) || !continueAnyway) {
      outro(chalk.red('Commit aborted due to code review issues.'));
      return false;
    }
  } else if (reviewResult.recommendation === 'review') {
    const shouldContinue = await confirm({
      message: chalk.yellow(
        'Review suggested. Do you want to continue with the commit?'
      ),
      initialValue: true
    });

    if (isCancel(shouldContinue) || !shouldContinue) {
      outro(
        chalk.yellow('Commit aborted. Please address the review findings.')
      );
      return false;
    }
  } else {
    console.log(
      chalk.green('\n✓ Code review passed! Proceeding with commit...\n')
    );
  }

  return true;
};

const formatBatchFileList = (files: string[], previewLimit = 10): string => {
  const preview = files.slice(0, previewLimit).map((file) => `  ${file}`);
  if (files.length > previewLimit) {
    preview.push(`  … and ${files.length - previewLimit} more`);
  }
  return preview.join('\n');
};

const commitStagedFilesInBatches = async (
  stagedFiles: string[],
  maxFilesPerCommit: number,
  extraArgs: string[],
  options: CommitOptions
): Promise<void> => {
  const chunks = chunkStagedFiles(stagedFiles, maxFilesPerCommit);
  const totalBatches = chunks.length;

  console.log(
    chalk.cyan(
      `\nSplitting ${stagedFiles.length} staged files into ${totalBatches} commits (max ${maxFilesPerCommit} files each).\n`
    )
  );

  await gitResetStaged();

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchFiles = chunks[batchIndex];
    const batchNumber = batchIndex + 1;
    const isLastBatch = batchIndex === totalBatches - 1;

    console.log(
      chalk.cyan(
        `\n── Batch ${batchNumber}/${totalBatches} (${batchFiles.length} files) ──\n${formatBatchFileList(batchFiles)}\n`
      )
    );

    await gitAdd({ files: batchFiles });

    const [diff, diffError] = await trytm(getDiff({ files: batchFiles }));
    if (diffError) {
      outro(`${chalk.red('✖')} ${diffError}`);
      process.exit(1);
    }

    if (diff !== undefined && diff.trim() === '') {
      outro(
        chalk.yellow(
          `Batch ${batchNumber}/${totalBatches}: all files are excluded from AI processing. Unstaging and skipping.`
        )
      );
      await execa('git', ['reset', 'HEAD', '--', ...batchFiles]);
      continue;
    }

    try {
      assertCommitSizeGuardrails(
        batchFiles.length,
        Buffer.byteLength(diff ?? '', 'utf8')
      );
    } catch (guardrailError) {
      outro(`${chalk.red('✖')} ${(guardrailError as Error).message}`);
      process.exit(1);
    }

    if (options.runReview && diff) {
      try {
        const shouldContinue = await runCommitReviewIfNeeded(
          diff,
          options.runReview
        );
        if (!shouldContinue) {
          process.exit(1);
        }
      } catch (reviewError) {
        outro(
          chalk.red(
            `Code review failed: ${reviewError instanceof Error ? reviewError.message : reviewError}`
          )
        );
        process.exit(1);
      }
    }

    const [, generateCommitError] = await trytm(
      generateCommitMessageFromGitDiff({
        diff: diff ?? '',
        extraArgs,
        context: options.context,
        fullGitMojiSpec: options.fullGitMojiSpec,
        skipCommitConfirmation: options.skipCommitConfirmation,
        dryRun: options.dryRun,
        edit: options.edit,
        noPush: options.noPush === true || !isLastBatch
      })
    );

    if (generateCommitError) {
      outro(`${chalk.red('✖')} ${generateCommitError}`);
      process.exit(1);
    }
  }

  if (options.dryRun !== true) {
    outro(
      chalk.green(
        `✔ Completed ${totalBatches} commit${totalBatches === 1 ? '' : 's'} from ${stagedFiles.length} staged files.`
      )
    );
  }
};

const getLogMessagesFromGitDiff = async (diff: string, fullGitMojiSpec: boolean = false, context: string = '') => {
  try {
    console.log(); // Add spacing before "cooking up" message
    
    const commitMessage = await runWithHeartbeat(
      'Cooking up the log 🍳🎶',
      async (onProgress) =>
        generateCommitMessageByDiff(diff, fullGitMojiSpec, context, onProgress)
    );

    outro(
      `Generated log:
${chalk.grey('——————————————————')}
${commitMessage}
${chalk.grey('——————————————————')}`
    );
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

export const generateCommitMessageFromGitDiff = async ({
  diff,
  extraArgs,
  context = '',
  fullGitMojiSpec = false,
  skipCommitConfirmation = false,
  dryRun = false,
  edit = false,
  noPush = false
}: GenerateCommitMessageFromGitDiffParams): Promise<void> => {
  await assertGitRepo();
  try {
    let commitMessage = await runWithHeartbeat(
      'Cooking up the commit message 🍳🎶',
      async (onProgress) =>
        generateCommitMessageByDiff(diff, fullGitMojiSpec, context, onProgress)
    );

    const messageTemplate = checkMessageTemplate(extraArgs);
    if (
      config.CMT_MESSAGE_TEMPLATE_PLACEHOLDER &&
      typeof messageTemplate === 'string'
    ) {
      const messageTemplateIndex = extraArgs.indexOf(messageTemplate);
      extraArgs.splice(messageTemplateIndex, 1);

      commitMessage = messageTemplate.replace(
        config.CMT_MESSAGE_TEMPLATE_PLACEHOLDER,
        commitMessage
      );
    }

    outro(
      `Generated commit message:
${chalk.grey('——————————————————')}
${commitMessage}
${chalk.grey('——————————————————')}`
    );

    // If dry-run, just display the message and exit
    if (dryRun) {
      outro(chalk.cyan('Dry run mode - no commit was made'));
      return;
    }

    // If edit flag is set, open in editor
    if (edit) {
      const editedMessage = await openInEditor(commitMessage);
      if (editedMessage.trim() === '') {
        outro(chalk.red('Empty commit message, aborting'));
        process.exit(1);
      }
      commitMessage = editedMessage;

      outro(
        `Edited commit message:
${chalk.grey('——————————————————')}
${commitMessage}
${chalk.grey('——————————————————')}`
      );
    }

    const isCommitConfirmedByUser =
      skipCommitConfirmation ||
      (await confirm({
        message: 'Confirm the commit message?'
      }));

    if (isCancel(isCommitConfirmedByUser)) process.exit(1);

    if (isCommitConfirmedByUser) {
      const committingChangesSpinner = spinner();
      committingChangesSpinner.start('Committing the changes');
      const { stdout } = await execa('git', [
        'commit',
        '-m',
        commitMessage,
        ...extraArgs
      ]);
      committingChangesSpinner.stop(
        `${chalk.green('✔')} Successfully committed`
      );

      outro(stdout);

      const remotes = await getGitRemotes();

      // user isn't pushing, return early
      if (config.CMT_GITPUSH === false || noPush) return;

      if (!remotes.length) {
        const { stdout } = await execa('git', ['push']);
        if (stdout) outro(stdout);
        process.exit(0);
      }

      if (remotes.length === 1) {
        const isPushConfirmedByUser = await confirm({
          message: 'Do you want to run `git push`?'
        });

        if (isCancel(isPushConfirmedByUser)) process.exit(1);

        if (isPushConfirmedByUser) {
          const pushSpinner = spinner();

          pushSpinner.start(`Running 'git push ${remotes[0]}'`);

          const { stdout } = await execa('git', [
            'push',
            '--verbose',
            remotes[0]
          ]);

          pushSpinner.stop(
            `${chalk.green('✔')} Successfully pushed all commits to ${remotes[0]
            }`
          );

          if (stdout) outro(stdout);
        } else {
          outro('`git push` aborted');
          process.exit(0);
        }
      } else {
        const skipOption = `don't push`
        const selectedRemote = (await select({
          message: 'Choose a remote to push to',
          options: [...remotes, skipOption].map((remote) => ({ value: remote, label: remote })),
        })) as string;

        if (isCancel(selectedRemote)) process.exit(1);

        if (selectedRemote !== skipOption) {
          const pushSpinner = spinner();
  
          pushSpinner.start(`Running 'git push ${selectedRemote}'`);
  
          const { stdout } = await execa('git', ['push', selectedRemote]);
  
          if (stdout) outro(stdout);
  
          pushSpinner.stop(
            `${chalk.green(
              '✔'
            )} successfully pushed all commits to ${selectedRemote}`
          );
        }
      }
    } else {
      const regenerateMessage = await confirm({
        message: 'Do you want to regenerate the message?'
      });

      if (isCancel(regenerateMessage)) process.exit(1);

      if (regenerateMessage) {
        await generateCommitMessageFromGitDiff({
          diff,
          extraArgs,
          context,
          fullGitMojiSpec,
          skipCommitConfirmation,
          dryRun,
          edit,
          noPush
        });
      }
    }
  } catch (error) {
    console.log(error);

    const err = error as Error;
    outro(`${chalk.red('✖')} ${err?.message || err}`);
    process.exit(1);
  }
};

export const commit = async (
  extraArgs: string[] = [],
  options: CommitOptions = {}
) => {
  const {
    context = '',
    stageAll = false,
    fullGitMojiSpec = false,
    skipCommitConfirmation = false,
    dryRun = false,
    edit = false,
    noPush = false,
    runReview = false
  } = options;

  if (stageAll) {
    const changedFiles = await getChangedFiles();

    if (changedFiles) await gitAdd({ files: changedFiles });
    else {
      outro('No changes detected, write some code and run `cmt` again');
      process.exit(1);
    }
  }

  const [stagedFiles, errorStagedFiles] = await trytm(getStagedFiles());
  const [changedFiles, errorChangedFiles] = await trytm(getChangedFiles());

  if (!changedFiles?.length && !stagedFiles?.length) {
    outro(chalk.red('No changes detected'));
    process.exit(1);
  }

  intro('commit-ai');
  if (errorChangedFiles ?? errorStagedFiles) {
    outro(`${chalk.red('✖')} ${errorChangedFiles ?? errorStagedFiles}`);
    process.exit(1);
  }

  const stagedFilesSpinner = spinner();

  stagedFilesSpinner.start('Counting staged files');

  if (!stagedFiles.length) {
    stagedFilesSpinner.stop('No files are staged');
    const isStageAllAndCommitConfirmedByUser = await confirm({
      message: 'Do you want to stage all files and generate commit message?'
    });

    if (isCancel(isStageAllAndCommitConfirmedByUser)) process.exit(1);

    if (isStageAllAndCommitConfirmedByUser) {
      await commit(extraArgs, { context, stageAll: true, fullGitMojiSpec, skipCommitConfirmation, dryRun, edit, noPush, runReview });
      process.exit(1);
    }

    if (stagedFiles.length === 0 && changedFiles.length > 0) {
      const files = (await multiselect({
        message: chalk.cyan('Select the files you want to add to the commit:'),
        options: changedFiles.map((file) => ({
          value: file,
          label: file
        }))
      })) as string[];

      if (isCancel(files)) process.exit(1);

      await gitAdd({ files });
    }

    await commit(extraArgs, { context, stageAll: false, fullGitMojiSpec, skipCommitConfirmation, dryRun, edit, noPush, runReview });
    process.exit(1);
  }

  stagedFilesSpinner.stop(
    `${stagedFiles.length} staged files:\n${stagedFiles
      .map((file) => `  ${file}`)
      .join('\n')}`
  );

  const commitSizeLimits = getCommitSizeLimits();
  if (exceedsMaxStagedFiles(stagedFiles.length, commitSizeLimits)) {
    await commitStagedFilesInBatches(
      stagedFiles,
      commitSizeLimits.maxFiles as number,
      extraArgs,
      {
        context,
        stageAll,
        fullGitMojiSpec,
        skipCommitConfirmation,
        dryRun,
        edit,
        noPush,
        runReview
      }
    );
    process.exit(0);
  }

  console.log(); // Add spacing before "cooking up" message

  const [diff, diffError] = await trytm(getDiff({ files: stagedFiles }));
  if (diffError) {
    outro(`${chalk.red('✖')} ${diffError}`);
    process.exit(1);
  }

  if (diff !== undefined && diff.trim() === '') {
    outro(
      chalk.yellow(
        'All staged files are excluded from AI processing (e.g., lock files / images). Stage at least one non-excluded file and try again.'
      )
    );
    process.exit(1);
  }

  try {
    assertCommitSizeGuardrails(
      stagedFiles.length,
      Buffer.byteLength(diff ?? '', 'utf8')
    );
  } catch (guardrailError) {
    outro(`${chalk.red('✖')} ${(guardrailError as Error).message}`);
    process.exit(1);
  }

  if (runReview && diff) {
    try {
      const shouldContinue = await runCommitReviewIfNeeded(diff, runReview);
      if (!shouldContinue) {
        process.exit(1);
      }
    } catch (reviewError) {
      outro(
        chalk.red(
          `Code review failed: ${reviewError instanceof Error ? reviewError.message : reviewError}`
        )
      );
      process.exit(1);
    }
  }

  const [, generateCommitError] = await trytm(
    generateCommitMessageFromGitDiff({
      diff: diff ?? '',
      extraArgs,
      context,
      fullGitMojiSpec,
      skipCommitConfirmation,
      dryRun,
      edit,
      noPush
    })
  );

  if (generateCommitError) {
    outro(`${chalk.red('✖')} ${generateCommitError}`);
    process.exit(1);
  }

  process.exit(0);
}

export const commitLog = async (
  branch: string = 'master',
  fullGitMojiSpec: boolean = false,
) => {
  const diff = await getDiffBetweenBranches(branch);
  const context = 'It should be a summary of each file changed with the file name, and the commit messages for each file with no extra empty lines. This should allow a software tester to understand all of the changes in the branch.';
  const [, generateCommitError] = await trytm(
    getLogMessagesFromGitDiff(
      diff,
      fullGitMojiSpec,
      context
    )
  );

  if (generateCommitError) {
    outro(`${chalk.red('✖')} ${generateCommitError}`);
    process.exit(1);
  }

  process.exit(0);
}
