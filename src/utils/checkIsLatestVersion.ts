import chalk from 'chalk';

import { outro } from '@clack/prompts';

import currentPackage from '../../package.json';
import { getCommitAILatestVersion } from '../version';

export const checkIsLatestVersion = async () => {
  // Skip version check during postinstall or if explicitly disabled
  if (process.env.CMT_SKIP_VERSION_CHECK === 'true') {
    return;
  }

  const latestVersion = await getCommitAILatestVersion();

  if (latestVersion) {
    const currentVersion = currentPackage.version;

    if (currentVersion !== latestVersion) {
      outro(
        chalk.yellow(
          `
You are not using the latest stable version of CommitAI with new features and bug fixes.
Current version: ${currentVersion}. Latest version: ${latestVersion}.
🚀 To update run: npm i -g @mantisware/commit-ai@latest.
        `
        )
      );
    }
  }
};
