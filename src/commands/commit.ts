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
  getCommitSizeLimits,
  needsCommitBatching,
  type CommitSizeLimits
} from '../utils/commitGuardrails';
import { planCommitBatches } from '../utils/planCommitBatches';
import { formatCommitProgressLabel } from '../utils/commitProgressLabel';
import { startElapsedHeartbeat } from '../utils/heartbeat';
import {
  assertGitRepo,
  getChangedFiles,
  getDiff,
  getDiffContent,
  getDiffByteLength,
  getDiffBetweenBranches,
  getStagedFiles,
  gitAdd,
  gitResetStaged,
  filterDiffForReview
} from '../utils/git';
import { runWithConcurrency } from '../utils/runWithConcurrency';
import { withTimeout } from '../utils/timeout';
import { trytm } from '../utils/trytm';
import { getConfig } from './config';
import { performCodeReview, printReviewResult } from './review';
import { standardsFileExists } from './standards';

const config = getConfig();
const DEFAULT_BATCH_GENERATION_CONCURRENCY = 4;
const BATCH_GENERATION_TIMEOUT_MS = 300_000;
const BATCH_STATUS_INTERVAL_MS = 10_000;

interface PreparedCommitBatch {
  files: string[];
  diff: string;
}

interface PlannedCommitWithMessage extends PreparedCommitBatch {
  message: string;
  commitArgs: string[];
}

const getBatchGenerationConcurrency = (): number => {
  const configured = config.CMT_CHUNK_CONCURRENCY;
  if (configured === undefined || typeof configured !== 'number') {
    return DEFAULT_BATCH_GENERATION_CONCURRENCY;
  }
  return Math.max(1, Math.min(10, configured));
};

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

const resolveCommitMessageAndArgs = (
  commitMessage: string,
  extraArgs: string[]
): { message: string; commitArgs: string[] } => {
  const commitArgs = [...extraArgs];
  const messageTemplate = checkMessageTemplate(commitArgs);

  if (
    config.CMT_MESSAGE_TEMPLATE_PLACEHOLDER &&
    typeof messageTemplate === 'string'
  ) {
    const messageTemplateIndex = commitArgs.indexOf(messageTemplate);
    commitArgs.splice(messageTemplateIndex, 1);

    return {
      message: messageTemplate.replace(
        config.CMT_MESSAGE_TEMPLATE_PLACEHOLDER,
        commitMessage
      ),
      commitArgs
    };
  }

  return { message: commitMessage, commitArgs };
};

const createCommitMessageFromDiff = async (
  diff: string,
  fullGitMojiSpec: boolean,
  context: string
): Promise<string> =>
  runWithHeartbeat('Cooking up the commit message 🍳🎶', async (onProgress) =>
    generateCommitMessageByDiff(diff, fullGitMojiSpec, context, onProgress)
  );

const performGitCommit = async (
  message: string,
  commitArgs: string[]
): Promise<string> => {
  const committingChangesSpinner = spinner();
  committingChangesSpinner.start('Committing the changes');

  const { stdout } = await execa('git', ['commit', '-m', message, ...commitArgs]);

  committingChangesSpinner.stop(`${chalk.green('✔')} Successfully committed`);

  return stdout;
};

const offerGitPush = async (noPush: boolean): Promise<void> => {
  if (config.CMT_GITPUSH === false || noPush) {
    return;
  }

  const remotes = await getGitRemotes();

  if (!remotes.length) {
    const { stdout } = await execa('git', ['push']);
    if (stdout) outro(stdout);
    return;
  }

  if (remotes.length === 1) {
    const isPushConfirmedByUser = await confirm({
      message: 'Do you want to run `git push`?'
    });

    if (isCancel(isPushConfirmedByUser)) process.exit(1);

    if (isPushConfirmedByUser) {
      const pushSpinner = spinner();

      pushSpinner.start(`Running 'git push ${remotes[0]}'`);

      const { stdout } = await execa('git', ['push', '--verbose', remotes[0]]);

      pushSpinner.stop(
        `${chalk.green('✔')} Successfully pushed all commits to ${remotes[0]}`
      );

      if (stdout) outro(stdout);
    } else {
      outro('`git push` aborted');
      process.exit(0);
    }
    return;
  }

  const skipOption = `don't push`;
  const selectedRemote = (await select({
    message: 'Choose a remote to push to',
    options: [...remotes, skipOption].map((remote) => ({
      value: remote,
      label: remote
    }))
  })) as string;

  if (isCancel(selectedRemote)) process.exit(1);

  if (selectedRemote !== skipOption) {
    const pushSpinner = spinner();

    pushSpinner.start(`Running 'git push ${selectedRemote}'`);

    const { stdout } = await execa('git', ['push', selectedRemote]);

    if (stdout) outro(stdout);

    pushSpinner.stop(
      `${chalk.green('✔')} successfully pushed all commits to ${selectedRemote}`
    );
  }
};

const formatBatchCommitMessagesSummary = (
  planned: PlannedCommitWithMessage[]
): string =>
  planned
    .map(
      (batch, index) =>
        `${chalk.cyan(`Batch ${index + 1}/${planned.length}`)} (${batch.files.length} files)\n${chalk.grey('——————————————————')}\n${batch.message}\n${chalk.grey('——————————————————')}`
    )
    .join('\n\n');

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

const formatBatchLimits = (limits: CommitSizeLimits): string => {
  const parts: string[] = [];
  if (limits.maxFiles !== undefined) {
    parts.push(`max ${limits.maxFiles} files`);
  }
  if (limits.maxDiffBytes !== undefined) {
    parts.push(`max ${limits.maxDiffBytes} bytes diff`);
  }
  return parts.length > 0 ? parts.join(', ') : 'configured limits';
};

const commitStagedFilesInBatches = async (
  stagedFiles: string[],
  limits: CommitSizeLimits,
  extraArgs: string[],
  options: CommitOptions
): Promise<void> => {
  const measureDiffBytes = (files: string[]) =>
    getDiffByteLength({ files, staged: true });

  const batchFileGroups = await planCommitBatches(
    stagedFiles,
    limits,
    measureDiffBytes
  );

  const preparedBatches: PreparedCommitBatch[] = [];
  for (const batchFiles of batchFileGroups) {
    const diff = await getDiffContent({ files: batchFiles, staged: true });
    if (diff.trim() === '') {
      continue;
    }
    preparedBatches.push({ files: batchFiles, diff });
  }

  if (preparedBatches.length === 0) {
    outro(
      chalk.yellow(
        'All staged files are excluded from AI processing (e.g., lock files / images).'
      )
    );
    process.exit(1);
  }

  const totalBatches = preparedBatches.length;

  console.log(
    chalk.cyan(
      `\nSplitting ${stagedFiles.length} staged files into ${totalBatches} commits (${formatBatchLimits(limits)}).\n`
    )
  );

  if (options.edit === true && totalBatches > 1) {
    outro(
      chalk.yellow(
        'The --edit flag is not supported when splitting into multiple commits. Proceeding without opening the editor.'
      )
    );
  }

  await gitResetStaged();

  const batchConcurrency = getBatchGenerationConcurrency();

  console.log(
    chalk.dim(
      `Generating up to ${batchConcurrency} commit messages at a time (timeout ${BATCH_GENERATION_TIMEOUT_MS / 1000}s each)…\n`
    )
  );

  const context = options.context ?? '';
  const fullGitMojiSpec = options.fullGitMojiSpec ?? false;

  const formatMessagePreview = (message: string): string => {
    const firstLine = message.split('\n').find((line) => line.trim() !== '') ?? '';
    if (firstLine.length <= 72) {
      return firstLine;
    }
    return `${firstLine.slice(0, 69)}…`;
  };

  type BatchFlightStatus = {
    startedAt: number;
    detail: string;
  };

  const inFlight = new Map<number, BatchFlightStatus>();

  const logInFlightStatus = (): void => {
    if (inFlight.size === 0) {
      return;
    }

    console.log(chalk.dim('\nStill working on:'));
    for (const [index, status] of inFlight) {
      const elapsedSec = Math.floor((Date.now() - status.startedAt) / 1000);
      console.log(
        chalk.dim(
          `  • Batch ${index + 1}/${totalBatches}: ${status.detail} (${elapsedSec}s)`
        )
      );
    }
  };

  const statusTimer = setInterval(logInFlightStatus, BATCH_STATUS_INTERVAL_MS);

  let generatedMessages: string[];
  try {
    generatedMessages = await runWithConcurrency({
      tasks: preparedBatches.map((batch, batchIndex) => async () => {
        const startedAt = Date.now();
        inFlight.set(batchIndex, { startedAt, detail: 'starting…' });

        try {
          return await withTimeout(
            generateCommitMessageByDiff(
              batch.diff,
              fullGitMojiSpec,
              context,
              (progress) => {
                inFlight.set(batchIndex, {
                  startedAt,
                  detail: formatCommitProgressLabel('generating message', progress)
                });
              }
            ),
            BATCH_GENERATION_TIMEOUT_MS,
            `Batch ${batchIndex + 1}/${totalBatches} timed out after ${BATCH_GENERATION_TIMEOUT_MS / 1000}s. Check your AI provider or try lowering CMT_MAX_DIFF_BYTES.`
          );
        } finally {
          inFlight.delete(batchIndex);
        }
      }),
      concurrency: batchConcurrency,
      onRetry: (taskIndex, attempt, waitMs) => {
        console.log(
          chalk.yellow(
            `⏳ Batch ${taskIndex + 1}/${totalBatches}: rate limited, retry ${attempt} in ${Math.round(waitMs / 1000)}s…`
          )
        );
      },
      onTaskComplete: (completed, total, taskIndex, message) => {
        const batch = preparedBatches[taskIndex];
        const preview = formatMessagePreview(message);

        console.log(
          `${chalk.green('✔')} ${completed}/${total} — ${preview} ${chalk.dim(
            `(${batch.files.length} files)`
          )}`
        );
      }
    });
  } catch (error) {
    outro(`${chalk.red('✖')} Failed to generate commit messages`);
    outro(`${chalk.red('✖')} ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  } finally {
    clearInterval(statusTimer);
  }

  console.log(
    chalk.green(`\n✔ Generated ${totalBatches} commit messages\n`)
  );

  const plannedCommits: PlannedCommitWithMessage[] = preparedBatches.map(
    (batch, index) => {
      const { message, commitArgs } = resolveCommitMessageAndArgs(
        generatedMessages[index],
        extraArgs
      );
      return { ...batch, message, commitArgs };
    }
  );

  console.log(
    `\n${formatBatchCommitMessagesSummary(plannedCommits)}\n`
  );

  if (options.dryRun === true) {
    outro(chalk.cyan('Dry run mode - no commits were made'));
    return;
  }

  const isAllCommitsConfirmed =
    options.skipCommitConfirmation === true ||
    (await confirm({
      message: `Confirm all ${totalBatches} commit messages?`
    }));

  if (isCancel(isAllCommitsConfirmed)) {
    process.exit(1);
  }

  if (!isAllCommitsConfirmed) {
    outro(chalk.yellow('Commits aborted.'));
    process.exit(0);
  }

  for (let batchIndex = 0; batchIndex < plannedCommits.length; batchIndex++) {
    const batch = plannedCommits[batchIndex];
    const batchNumber = batchIndex + 1;

    console.log(
      chalk.cyan(
        `\n── Committing batch ${batchNumber}/${totalBatches} (${batch.files.length} files) ──\n${formatBatchFileList(batch.files)}\n`
      )
    );

    await gitAdd({ files: batch.files });
    await performGitCommit(batch.message, batch.commitArgs);
  }

  outro(
    chalk.green(
      `✔ Completed ${totalBatches} commit${totalBatches === 1 ? '' : 's'} from ${stagedFiles.length} staged files.`
    )
  );

  await offerGitPush(options.noPush === true);
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
    let { message: commitMessage, commitArgs } = resolveCommitMessageAndArgs(
      await createCommitMessageFromDiff(diff, fullGitMojiSpec, context),
      extraArgs
    );

    outro(
      `Generated commit message:
${chalk.grey('——————————————————')}
${commitMessage}
${chalk.grey('——————————————————')}`
    );

    if (dryRun) {
      outro(chalk.cyan('Dry run mode - no commit was made'));
      return;
    }

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
      const stdout = await performGitCommit(commitMessage, commitArgs);
      outro(stdout);
      await offerGitPush(noPush);
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
  const batchOptions: CommitOptions = {
    context,
    stageAll,
    fullGitMojiSpec,
    skipCommitConfirmation,
    dryRun,
    edit,
    noPush,
    runReview
  };

  if (exceedsMaxStagedFiles(stagedFiles.length, commitSizeLimits)) {
    await commitStagedFilesInBatches(
      stagedFiles,
      commitSizeLimits,
      extraArgs,
      batchOptions
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

  const diffByteLength = Buffer.byteLength(diff ?? '', 'utf8');

  if (needsCommitBatching(stagedFiles.length, diffByteLength, commitSizeLimits)) {
    await commitStagedFilesInBatches(
      stagedFiles,
      commitSizeLimits,
      extraArgs,
      batchOptions
    );
    process.exit(0);
  }

  try {
    assertCommitSizeGuardrails(stagedFiles.length, diffByteLength);
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
