import chalk from 'chalk';

import { outro } from '@clack/prompts';

import currentPackage from '../../package.json';
import { getCommitAILatestVersion } from '../version';

export const checkIsLatestVersion = async () => {
  const latestVersion = await getCommitAILatestVersion();

  if (latestVersion) {
    const currentVersion = currentPackage.version;

    if (currentVersion !== latestVersion) {
      outro(
        chalk.yellow(
          `
You are not using the latest stable version of CommitAI with new features and bug fixes.
Current version: ${currentVersion}. Latest version: ${latestVersion}.
🚀 To update run: npm i -g commit-ai@latest.
        `
        )
      );
    }
  }
};
