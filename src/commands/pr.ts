import { intro, outro, spinner, text, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { execa } from 'execa';
import { writeFileSync } from 'fs';
import { OpenAI } from 'openai';
import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import { getConfig } from './config';
import { COMMANDS } from './ENUMS';
import { getDiffBetweenBranches } from '../utils/git';
import { startElapsedHeartbeat } from '../utils/heartbeat';
import { getEngine } from '../utils/engine';
import { getMainCommitPrompt } from '../prompts';

const config = getConfig();

const PR_DESCRIPTION_PROMPT = (baseBranch: string) => `You are an expert at writing clear, comprehensive pull request descriptions.

Your task is to analyze the diff between the current branch and the base branch (${baseBranch}) and generate a professional PR description.

**Requirements:**
1. **Title**: A concise, descriptive title (max 72 characters)
2. **Summary**: A brief 2-3 sentence overview of what changed and why
3. **Changes**: A bulleted list of key changes organized by category:
   - ✨ Features: New functionality added
   - 🐛 Bug Fixes: Issues resolved
   - ♻️  Refactoring: Code improvements without behavior changes
   - 📝 Documentation: Docs updates
   - 🎨 Styling: UI/UX changes
   - ⚡️ Performance: Performance improvements
   - 🧪 Tests: Test additions or updates
4. **Technical Details**: Any important technical decisions or implementation notes
5. **Testing**: How the changes were tested or should be tested
6. **Breaking Changes**: Any breaking changes (if applicable)

Use markdown formatting. Be specific but concise. Focus on WHAT changed and WHY it matters.

The output should be ready to paste into a GitHub PR description.`;

const CHANGELOG_PROMPT = (version: string, fromRef: string, toRef: string) => `You are an expert at writing changelogs following the Keep a Changelog format.

Your task is to analyze the commits and diff between ${fromRef} and ${toRef} and generate a changelog entry for version ${version}.

**Format (Keep a Changelog):**
## [${version}] - YYYY-MM-DD

### Added
- New features and capabilities

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in upcoming releases

### Removed
- Features that were removed

### Fixed
- Bug fixes

### Security
- Security improvements or fixes

**Requirements:**
1. Use present tense, imperative mood ("Add feature" not "Added feature")
2. Group changes by type (Added, Changed, Fixed, etc.)
3. Be specific but concise
4. Include relevant context for breaking changes
5. Order entries within each category by importance
6. Omit empty categories

Generate only the changelog entry. Do not include the full diff or commit messages verbatim.`;

async function getCurrentBranch(): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.trim();
}

async function getDefaultBaseBranch(): Promise<string> {
  try {
    // Try to get the default branch from remote
    const { stdout } = await execa('git', ['symbolic-ref', 'refs/remotes/origin/HEAD']);
    return stdout.replace('refs/remotes/origin/', '').trim();
  } catch {
    // Fallback to common default branches
    const branches = ['main', 'master', 'develop'];
    for (const branch of branches) {
      try {
        await execa('git', ['rev-parse', '--verify', branch]);
        return branch;
      } catch {
        continue;
      }
    }
    return 'main'; // final fallback
  }
}

async function generatePRDescription(baseBranch: string): Promise<string> {
  const { stop: stopHeartbeat } = startElapsedHeartbeat({
    label: 'Generating PR description'
  });

  try {
    // Get diff between current branch and base branch
    const { stdout: diff } = await execa('git', ['diff', baseBranch]);

    if (!diff || diff.trim() === '') {
      throw new Error(`No diff found between current branch and ${baseBranch}`);
    }

    // Get commit messages for context
    const { stdout: commits } = await execa('git', [
      'log',
      `${baseBranch}..HEAD`,
      '--pretty=format:%s'
    ]);

    const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: PR_DESCRIPTION_PROMPT(baseBranch)
      },
      {
        role: 'user',
        content: `Commit messages for context:\n${commits}\n\nDiff:\n${diff}`
      }
    ];

    const engine = getEngine();
    const description = await engine.generateCommitMessage(prompt);

    return description || 'Failed to generate PR description';
  } finally {
    stopHeartbeat();
  }
}

async function generateChangelog(
  version: string,
  fromRef: string,
  toRef: string
): Promise<string> {
  const { stop: stopHeartbeat } = startElapsedHeartbeat({
    label: 'Generating changelog'
  });

  try {
    // Get diff between refs
    const { stdout: diff } = await execa('git', ['diff', fromRef, toRef]);

    if (!diff || diff.trim() === '') {
      throw new Error(`No diff found between ${fromRef} and ${toRef}`);
    }

    // Get commit messages
    const { stdout: commits } = await execa('git', [
      'log',
      `${fromRef}..${toRef}`,
      '--pretty=format:- %s (%an)'
    ]);

    const today = new Date().toISOString().split('T')[0];

    const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: CHANGELOG_PROMPT(version, fromRef, toRef)
      },
      {
        role: 'user',
        content: `Commits:\n${commits}\n\nDiff (for context):\n${diff.slice(0, 10000)}` // Limit diff size
      }
    ];

    const engine = getEngine();
    let changelog = await engine.generateCommitMessage(prompt);

    // Ensure date is included
    if (changelog && !changelog.includes(today)) {
      changelog = changelog.replace(
        `## [${version}]`,
        `## [${version}] - ${today}`
      );
    }

    return changelog || 'Failed to generate changelog';
  } finally {
    stopHeartbeat();
  }
}

export const prCommand = command(
  {
    name: COMMANDS.pr,
    parameters: ['[base-branch]'],
    flags: {
      output: {
        type: String,
        alias: 'o',
        description: 'Output file path (default: prints to console)'
      }
    },
    help: {
      description: 'Generate comprehensive pull request descriptions from branch diffs with categorized changes'
    }
  },
  async (argv) => {
    intro(chalk.bold.cyan('CommitAI PR Description Generator'));

    try {
      const { baseBranch: baseBranchArg } = argv._;
      const { output } = argv.flags;

      const currentBranch = await getCurrentBranch();
      const defaultBase = await getDefaultBaseBranch();
      const baseBranch = (baseBranchArg as string) || defaultBase;

      if (currentBranch === baseBranch) {
        outro(
          chalk.red(
            `✖ Current branch (${currentBranch}) is the same as base branch (${baseBranch})`
          )
        );
        process.exit(1);
      }

      outro(
        `Generating PR description for ${chalk.cyan(currentBranch)} → ${chalk.cyan(baseBranch)}`
      );

      const description = await generatePRDescription(baseBranch);

      if (output) {
        writeFileSync(output, description, 'utf-8');
        outro(chalk.green(`✓ PR description saved to ${output}`));
      } else {
        console.log('\n' + chalk.bold('═'.repeat(80)));
        console.log(description);
        console.log(chalk.bold('═'.repeat(80)) + '\n');
        outro(chalk.green('✓ PR description generated successfully'));
      }
    } catch (error) {
      outro(chalk.red(`✖ ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  }
);

export const changelogCommand = command(
  {
    name: COMMANDS.changelog,
    parameters: ['<version>', '[from-ref]', '[to-ref]'],
    flags: {
      output: {
        type: String,
        alias: 'o',
        description: 'Output file path (default: CHANGELOG.md)',
        default: 'CHANGELOG.md'
      },
      append: {
        type: Boolean,
        alias: 'a',
        description: 'Append to existing changelog (default: prepend)',
        default: false
      }
    },
    help: {
      description: 'Generate changelog entries following Keep a Changelog format from git history'
    }
  },
  async (argv) => {
    intro(chalk.bold.cyan('CommitAI Changelog Generator'));

    try {
      const { version, fromRef: fromRefArg, toRef: toRefArg } = argv._;
      const { output, append } = argv.flags;

      if (!version) {
        outro(chalk.red('✖ Version is required (e.g., cmt changelog v1.0.0)'));
        process.exit(1);
      }

      const fromRef = (fromRefArg as string) || (await getDefaultBaseBranch());
      const toRef = (toRefArg as string) || 'HEAD';

      outro(
        `Generating changelog for ${chalk.cyan(version as string)}: ${chalk.cyan(fromRef)} → ${chalk.cyan(toRef)}`
      );

      const changelog = await generateChangelog(
        version as string,
        fromRef,
        toRef
      );

      // Handle file output
      if (output) {
        // TODO: Implement prepend vs append logic
        writeFileSync(output, changelog + '\n', 'utf-8');
        outro(chalk.green(`✓ Changelog saved to ${output}`));
      } else {
        console.log('\n' + chalk.bold('═'.repeat(80)));
        console.log(changelog);
        console.log(chalk.bold('═'.repeat(80)) + '\n');
        outro(chalk.green('✓ Changelog generated successfully'));
      }
    } catch (error) {
      outro(chalk.red(`✖ ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  }
);
