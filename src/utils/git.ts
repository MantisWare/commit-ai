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
    '-z',
    gitDir
  ]);

  if (!files) return [];

  // `-z` yields NUL-separated, unquoted paths, so filenames containing
  // spaces or non-ASCII characters are preserved verbatim.
  const filesList = files.split('\0').filter((file) => file !== '');

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
  const { stdout: modified } = await execa('git', [
    'ls-files',
    '--modified',
    '-z'
  ]);
  const { stdout: others } = await execa('git', [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z'
  ]);

  // `-z` yields NUL-separated, unquoted paths, so filenames containing
  // spaces or non-ASCII characters are preserved verbatim.
  const files = [...modified.split('\0'), ...others.split('\0')].filter(
    (file) => file !== ''
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
 * Unstage all currently staged files while keeping working tree changes.
 */
export const gitResetStaged = async (): Promise<void> => {
  await execa('git', ['reset']);
};

/**
 * Unstage specific files while keeping their working tree changes.
 */
export const gitResetFiles = async (files: string[]): Promise<void> => {
  await execa('git', ['reset', '--', ...files]);
};

export const getFilesIncludedInAIDiff = (files: string[]): string[] =>
  files.filter((file) => isDefaultExcludedFromAIDiff(file) === false);

/**
 * Get the diff for the given files (staged or unstaged working-tree changes).
 */
export const getDiffContent = async ({
  files,
  staged = true
}: {
  files: string[];
  staged?: boolean;
}): Promise<string> => {
  const filesToDiff = getFilesIncludedInAIDiff(files);

  if (filesToDiff.length === 0) {
    return '';
  }

  const diffArgs = staged
    ? ['diff', '--staged', '--', ...filesToDiff]
    : ['diff', '--', ...filesToDiff];

  const { stdout: diff } = await execa('git', diffArgs);

  return diff;
};

export const getDiffByteLength = async ({
  files,
  staged = true
}: {
  files: string[];
  staged?: boolean;
}): Promise<number> => {
  const diff = await getDiffContent({ files, staged });
  return Buffer.byteLength(diff, 'utf8');
};

/**
 * Get the diff of the staged files
 * @param {string[]} files - The files to get the diff for
 * @returns {Promise<string>} The diff of the staged files
 */
export const getDiff = async ({
  files,
  quiet = false
}: {
  files: string[];
  quiet?: boolean;
}) => {
  const excludedFiles = files.filter((file) => isDefaultExcludedFromAIDiff(file));

  if (!quiet && excludedFiles.length > 0) {
    outro(
      `Some files are excluded by default from 'git diff'. No commit messages are generated for these files:\n${excludedFiles.join(
        '\n'
      )}`
    );
  }

  return getDiffContent({ files, staged: true });
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