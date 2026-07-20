import chalk from 'chalk';

import { outro } from '@clack/prompts';

import { getConfig } from '../commands/config';
import { printShellRefreshHint } from './refreshShell';
import {
  checkForUpdates,
  getUpdateCommand,
  runUpdate
} from './versionUpdate';

export type CheckLatestVersionOptions = {
  autoUpdate?: boolean;
  skipCheck?: boolean;
};

export const checkIsLatestVersion = async (
  options: CheckLatestVersionOptions = {}
) => {
  if (options.skipCheck ?? process.env.CMT_SKIP_VERSION_CHECK === 'true') {
    return;
  }

  const config = getConfig();
  const shouldAutoUpdate = options.autoUpdate ?? config.CMT_AUTO_UPDATE === true;

  const result = await checkForUpdates();

  if (result.latestVersion === undefined) {
    return;
  }

  if (!result.updateAvailable) {
    return;
  }

  if (shouldAutoUpdate) {
    try {
      outro(
        chalk.cyan(
          `Updating CommitAI ${result.currentVersion} → ${result.latestVersion}...`
        )
      );
      await runUpdate();
      outro(chalk.green(`CommitAI updated to ${result.latestVersion}.`));
      printShellRefreshHint();
    } catch {
      outro(
        chalk.yellow(
          `Auto-update failed. Run manually: ${getUpdateCommand()}`
        )
      );
    }
    return;
  }

  outro(
    chalk.yellow(
      `
You are not using the latest stable version of CommitAI with new features and bug fixes.
Current version: ${result.currentVersion}. Latest version: ${result.latestVersion}.
🚀 To update run: cmt update
   Or enable auto-update: cmt config set CMT_AUTO_UPDATE=true
      `
    )
  );
};
