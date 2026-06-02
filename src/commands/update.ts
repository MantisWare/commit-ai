import { confirm, intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';

import packageJSON from '../../package.json';
import { printCommitAiBanner } from '../utils/banner';
import {
  checkForUpdates,
  getUpdateCommand,
  runUpdate
} from '../utils/versionUpdate';
import { COMMANDS } from './ENUMS';

export const updateCommand = command(
  {
    name: COMMANDS.update,
    flags: {
      check: {
        type: Boolean,
        description: 'Check for updates without installing',
        default: false
      },
      yes: {
        type: Boolean,
        alias: 'y',
        description: 'Install update without confirmation',
        default: false
      }
    },
    help: {
      description: 'Check for and install CommitAI updates'
    }
  },
  async ({ flags }) => {
    printCommitAiBanner({ version: packageJSON.version });
    intro(chalk.cyan('Checking for updates...'));

    const result = await checkForUpdates();

    if (result.latestVersion === undefined) {
      outro(chalk.red('Could not reach npm registry to check for updates.'));
      process.exit(1);
    }

    if (!result.updateAvailable) {
      outro(chalk.green(`CommitAI ${result.currentVersion} is up to date.`));
      process.exit(0);
    }

    if (flags.check) {
      outro(
        chalk.yellow(
          `Update available: ${result.currentVersion} → ${result.latestVersion}\nRun: cmt update`
        )
      );
      process.exit(1);
    }

    if (flags.yes !== true) {
      const shouldUpdate = await confirm({
        message: `Update CommitAI ${result.currentVersion} → ${result.latestVersion}?`,
        initialValue: true
      });

      if (shouldUpdate !== true) {
        outro(chalk.gray('Update cancelled.'));
        process.exit(0);
      }
    }

    try {
      await runUpdate();
      outro(chalk.green(`CommitAI updated to ${result.latestVersion}.`));
      process.exit(0);
    } catch {
      outro(
        chalk.red(`Update failed. Try manually: ${getUpdateCommand()}`)
      );
      process.exit(1);
    }
  }
);
