import { execa } from 'execa';
import { readFileSync } from 'fs';
import ignore, { Ignore } from 'ignore';

import { outro, spinner } from '@clack/prompts';
import chalk from 'chalk';

const isDefaultExcludedFromAIDiff = (file: string): boolean => {
  const excludedExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const isLockFile = file.includes('.lock') || file.includes('-lock.');

  const hasExcludedExtension = excludedExtensions.some((ext) =>
    file.endsWith(ext)
  );

  return isLockFile || hasExcludedExtension;
};

/**
 * Assert that the current directory is a git repository
 * @throws {Error} If the current directory is not a git repository
 */
export const assertGitRepo = async () => {
  try {
    await execa('git', ['rev-parse']);
  } catch (error) {
    throw new Error(error as string);
  }
};

/**
 * Get the commit AI ignore
 * @returns {Ignore} The commit AI ignore
 */
export const getCommitAIIgnore = (): Ignore => {
  const ig = ignore();

  try {
    ig.add(readFileSync('.commit-aiignore').toString().split('\n'));
  } catch (e) {}

  return ig;
};

/**
 * Get the commit AI review ignore
 * @returns {Ignore} The commit AI review ignore
 */
export const getCommitAIReviewIgnore = (): Ignore => {
  const ig = ignore();

  try {
    ig.add(readFileSync('.commit-ai-review-ignore').toString().split('\n'));
  } catch (e) {}

  return ig;
};

/**
 * Get the core hooks path
 * @returns {Promise<string>} The core hooks path
 */
export const getCoreHooksPath = async (): Promise<string> => {
  const { stdout } = await execa('git', ['config', 'core.hooksPath']);

  return stdout;
};

/**
 * Get the staged files
 * @returns {Promise<string[]>} An array of staged files
 */
export const getStagedFiles = async (): Promise<string[]> => {
  const { stdout: gitDir } = await execa('git', [
    'rev-parse',
    '--show-toplevel'
  ]);

  const { stdout: files } = await execa('git', [
    'diff',
    '--name-only',
    '--cached',
    '--relative',
    gitDir
  ]);

  if (!files) return [];

  const filesList = files.split('\n');

  const ig = getCommitAIIgnore();
  const allowedFiles = filesList.filter((file) => !ig.ignores(file));

  if (!allowedFiles) return [];

  return allowedFiles.sort();
};

/**
 * Get the changed files
 * @returns {Promise<string[]>} An array of changed files
 */
export const getChangedFiles = async (): Promise<string[]> => {
  const { stdout: modified } = await execa('git', ['ls-files', '--modified']);
  const { stdout: others } = await execa('git', [
    'ls-files',
    '--others',
    '--exclude-standard'
  ]);

  const files = [...modified.split('\n'), ...others.split('\n')].filter(
    (file) => !!file
  );

  return files.sort();
};

/**
 * Add files to the commit
 * @param {string[]} files - The files to add to the commit
 */
export const gitAdd = async ({ files }: { files: string[] }) => {
  const gitAddSpinner = spinner();

  gitAddSpinner.start('Adding files to commit');

  await execa('git', ['add', ...files]);

  gitAddSpinner.stop('Done');
};

/**
 * Get the diff of the staged files
 * @param {string[]} files - The files to get the diff for
 * @returns {Promise<string>} The diff of the staged files
 */
export const getDiff = async ({ files }: { files: string[] }) => {
  const excludedFiles = files.filter((file) => isDefaultExcludedFromAIDiff(file));

  if (excludedFiles.length > 0) {
    outro(
      `Some files are excluded by default from 'git diff'. No commit messages are generated for these files:\n${excludedFiles.join(
        '\n'
      )}`
    );
  }

  const filesToDiff = files.filter((file) => isDefaultExcludedFromAIDiff(file) === false);

  if (filesToDiff.length === 0) {
    return '';
  }

  const { stdout: diff } = await execa('git', [
    'diff',
    '--staged',
    '--',
    ...filesToDiff
  ]);

  return diff;
};

/**
 * Filter diff for code review based on .commit-ai-review-ignore patterns
 * @param {string} diff - The full git diff to filter
 * @returns {string} The filtered diff excluding ignored files
 */
export const filterDiffForReview = (diff: string): string => {
  if (!diff || diff.trim() === '') {
    return diff;
  }

  const ig = getCommitAIReviewIgnore();

  // Check if there are any ignore patterns
  if (ig._rules.length === 0) {
    return diff; // No ignore file, return full diff
  }

  // Split diff into file sections (each section starts with "diff --git")
  const diffSections = diff.split(/(?=diff --git)/);

  const filteredSections = diffSections.filter(section => {
    if (!section.trim()) return false;

    // Extract filename from diff header (e.g., "diff --git a/path/to/file.ts b/path/to/file.ts")
    const fileMatch = section.match(/diff --git a\/(.*?) b\//);
    if (!fileMatch) return true; // Keep sections we can't parse

    const filePath = fileMatch[1];
    return !ig.ignores(filePath); // Keep if NOT ignored
  });

  return filteredSections.join('');
};

const printErrorAndExit = (msg: string) => {
  outro(
      `💥 Oops!
${chalk.grey('——————————————————')}
${msg}
${chalk.grey('——————————————————')}`
    );
  process.exit(1);
};

/**
 * Get the diff between 2 branches
 * @param {string} branch - The branch to get the diff for
 * @returns {Promise<string>} The diff between the 2 branches
 */
export const getDiffBetweenBranches = async (branch: string = 'master'): Promise<string> => {
  try {
    const { stdout: diff } = await execa('git', ['-P', 'diff', '--staged', branch]); // '--name-only',
    return diff;
  } catch (error) {
    if (error.message.includes('unknown revision or path')) {
      return printErrorAndExit(`The branch does not exist, please check the branch name and try again. Maybe try origin/${branch}?`);
    }
    return printErrorAndExit(error);
  }
};

// /**
//  * Get all the commit messages in the current branch
//  * @returns {Promise<string[]>} An array of commit messages
//  */
// export const getCommitMessages = async (branch: string = 'master'): Promise<string> => {
//   // const { stdout: commitMessages } = await execa('git', ['-P', 'log', '--pretty=fuller', '-100']); // git -P log --pretty=fuller -100
//   const { stdout: commitMessages } = await execa('git', ['cherry', '-v', branch]); // git cherry -v branch
//   const removeHashes = (input: string) => {
//     return input.replace(/\+\s[a-f0-9]{40}/g, '');
//   };
//   const formatEmojisToNewLine = (input: string) => {
//     return input.replace(/([\p{Emoji}])/gu, '\n$1\n')
//       .replace(/\n+/g, '\n')
//       .trim();
//   };
//   // const messages = commitMessages.split('commit ').map(removeHashes);
//   return formatEmojisToNewLine(removeHashes(commitMessages));
// };


//git -P log --graph --abbrev-commit --no-merges --first-parent code-improvements