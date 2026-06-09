import chalk from 'chalk';
import fs from 'fs/promises';

import { intro, outro } from '@clack/prompts';

import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import { assertCommitSizeGuardrails } from '../utils/commitGuardrails';
import { formatCommitProgressLabel } from '../utils/commitProgressLabel';
import { createEngineStatusUi } from '../utils/engineStatusUi';
import { getChangedFiles, getDiff, getStagedFiles, gitAdd } from '../utils/git';
import { startElapsedHeartbeat } from '../utils/heartbeat';
import { CMT_AI_PROVIDER_ENUM, getConfig } from './config';

const [messageFilePath, commitSource] = process.argv.slice(2);

export const prepareCommitMessageHook = async (
  isStageAllFlag: boolean = false
) => {
  try {
    if (!messageFilePath) {
      throw new Error(
        'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook'
      );
    }

    if (commitSource) return;

    if (isStageAllFlag) {
      const changedFiles = await getChangedFiles();

      if (changedFiles) await gitAdd({ files: changedFiles });
      else {
        outro('No changes detected, write some code and run `cmt` again');
        process.exit(1);
      }
    }

    const staged = await getStagedFiles();

    if (!staged) return;

    intro('commit-ai');

    const config = getConfig();

    const isLocalProvider =
      config.CMT_AI_PROVIDER === CMT_AI_PROVIDER_ENUM.LOCAL;
    if (
      (config.CMT_API_KEY === undefined || config.CMT_API_KEY === '') &&
      isLocalProvider !== true
    ) {
      outro(
        'No CMT_API_KEY is set. Set your key via `cmt config set CMT_API_KEY=<value>. For more info see https://github.com/MantisWare/commit-ai'
      );
      return;
    }

    const diff = await getDiff({ files: staged });
    if (diff.trim() === '') {
      outro(
        'All staged files are excluded from AI processing (e.g., lock files / images).'
      );
      return;
    }

    assertCommitSizeGuardrails(
      staged.length,
      Buffer.byteLength(diff, 'utf8')
    );

    const baseLabel = 'Generating commit message';
    const { stop, updateLabel } = startElapsedHeartbeat({ label: baseLabel });
    const statusUi = createEngineStatusUi(updateLabel);
    let commitMessage: string;
    try {
      commitMessage = await generateCommitMessageByDiff(
        diff,
        false,
        '',
        (progress) => {
          updateLabel(formatCommitProgressLabel(baseLabel, progress));
        },
        statusUi.onEngineStatus
      );
    } finally {
      statusUi.stop();
      stop();
    }

    const fileContent = await fs.readFile(messageFilePath);

    await fs.writeFile(
      messageFilePath,
      commitMessage + '\n' + fileContent.toString()
    );
  } catch (error) {
    outro(`${chalk.red('✖')} ${error}`);
    process.exit(1);
  }
};
