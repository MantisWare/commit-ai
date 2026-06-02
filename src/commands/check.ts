import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { existsSync } from 'fs';
import { execa } from 'execa';
import { homedir } from 'os';
import { join as pathJoin } from 'path';
import packageJSON from '../../package.json';
import { COMMANDS } from './ENUMS';
import { getConfig } from './config';
import { printCommitAiBanner } from '../utils/banner';
import { COMMITLINT_LLM_CONFIG_PATH } from '../modules/commitlint/constants';
import { checkForUpdates } from '../utils/versionUpdate';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckResult {
  label: string;
  status: CheckStatus;
  details?: string;
}

const formatStatus = (status: CheckStatus): string => {
  switch (status) {
    case 'pass':
      return chalk.green('✔');
    case 'warn':
      return chalk.yellow('!');
    case 'fail':
      return chalk.red('✖');
  }
};

const runCheck = async (): Promise<CheckResult[]> => {
  const results: CheckResult[] = [];

  // Git availability
  try {
    const { stdout } = await execa('git', ['--version']);
    results.push({ label: 'Git', status: 'pass', details: stdout.trim() });
  } catch (error) {
    results.push({
      label: 'Git',
      status: 'fail',
      details: 'Not found on PATH (install Git and retry)'
    });
  }

  // Git repo status (optional)
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree']);
    results.push({ label: 'Git repo', status: 'pass', details: 'inside work tree' });
  } catch (error) {
    results.push({
      label: 'Git repo',
      status: 'warn',
      details: 'not inside a Git work tree (run inside a repo for full functionality)'
    });
  }

  // Global config file
  const globalConfigPath = pathJoin(homedir(), '.commit-ai');
  results.push({
    label: 'Global config',
    status: existsSync(globalConfigPath) ? 'pass' : 'warn',
    details: existsSync(globalConfigPath) ? '~/.commit-ai' : 'not found'
  });

  // Repo .env
  const envPath = pathJoin(process.cwd(), '.env');
  results.push({
    label: 'Repo .env',
    status: existsSync(envPath) ? 'pass' : 'warn',
    details: existsSync(envPath) ? 'found' : 'not found (optional)'
  });

  // Basic config sanity
  const config = getConfig();
  const provider = config.CMT_AI_PROVIDER;
  const model = config.CMT_MODEL;

  results.push({
    label: 'Provider',
    status: provider !== undefined ? 'pass' : 'warn',
    details: String(provider ?? 'openai (default)')
  });

  results.push({
    label: 'Model',
    status: model !== undefined && model !== '' ? 'pass' : 'warn',
    details: String(model ?? '(default)')
  });

  const apiKey = config.CMT_API_KEY;
  results.push({
    label: 'API key',
    status: apiKey !== undefined && apiKey !== '' ? 'pass' : 'warn',
    details:
      apiKey !== undefined && apiKey !== ''
        ? 'set'
        : 'not set (required for hosted providers)'
  });

  // Commitlint integration (optional feature)
  const commitlintConfigExists = existsSync(COMMITLINT_LLM_CONFIG_PATH);
  results.push({
    label: 'Commitlint prompts',
    status: commitlintConfigExists ? 'pass' : 'warn',
    details: commitlintConfigExists
      ? '.commit-ai-commitlint found'
      : 'not configured (optional, for CMT_PROMPT_MODULE=@commitlint)'
  });

  const updateResult = await checkForUpdates();
  if (updateResult.latestVersion === undefined) {
    results.push({
      label: 'Version',
      status: 'warn',
      details: `v${updateResult.currentVersion} (could not check npm registry)`
    });
  } else if (updateResult.updateAvailable) {
    results.push({
      label: 'Version',
      status: 'warn',
      details: `v${updateResult.currentVersion} (latest: v${updateResult.latestVersion}) — run cmt update`
    });
  } else {
    results.push({
      label: 'Version',
      status: 'pass',
      details: `v${updateResult.currentVersion} (latest)`
    });
  }

  return results;
};

export const checkCommand = command(
  {
    name: COMMANDS.check,
    help: {
      description: 'Validate your CommitAI environment, configuration, and dependencies'
    }
  },
  async () => {
    printCommitAiBanner({ version: packageJSON.version });

    try {
      const results = await runCheck();

      const fails = results.filter((r) => r.status === 'fail').length;
      const passes = results.filter((r) => r.status === 'pass').length;

      // Calculate max width for the box
      const maxLabelWidth = Math.max(...results.map(r => r.label.length));
      const boxWidth = 100;
      const border = chalk.hex('#9333ea')('─'.repeat(boxWidth));
      const borderTop = chalk.hex('#9333ea')('┌') + border + chalk.hex('#9333ea')('┐');
      const borderBottom = chalk.hex('#2563eb')('└') + border + chalk.hex('#2563eb')('┘');

      console.log(borderTop);
      console.log(chalk.hex('#9333ea')('│') + chalk.bold.white(' Environment Check'.padEnd(boxWidth)) + chalk.hex('#9333ea')('│'));
      console.log(chalk.hex('#7f42d6')('├') + border + chalk.hex('#7f42d6')('┤'));

      for (const r of results) {
        const statusIcon = formatStatus(r.status);
        const label = chalk.cyan(r.label.padEnd(maxLabelWidth + 2));
        const details = r.details !== undefined ? chalk.gray(r.details) : '';
        const line = ` ${statusIcon} ${label} ${details}`;
        const padding = ' '.repeat(Math.max(0, boxWidth - line.replace(/\x1b\[[0-9;]*m/g, '').length));
        console.log(chalk.hex('#5e52c2')('│') + line + padding + chalk.hex('#5e52c2')('│'));
      }

      console.log(chalk.hex('#3b62ae')('├') + border + chalk.hex('#3b62ae')('┤'));

      const summary = fails === 0
        ? chalk.green(`✓ ${passes}/${results.length} checks passed`)
        : chalk.red(`✖ ${fails} blocking issue(s) found`);

      const summaryPadding = ' '.repeat(Math.max(0, boxWidth - summary.replace(/\x1b\[[0-9;]*m/g, '').length - 1));
      console.log(chalk.hex('#2563eb')('│') + ` ${summary}${summaryPadding}` + chalk.hex('#2563eb')('│'));
      console.log(borderBottom);
      console.log('');

      // Print usage box
      const usageBoxTop = chalk.hex('#2563eb')('┌') + chalk.hex('#2563eb')('─'.repeat(boxWidth)) + chalk.hex('#2563eb')('┐');
      const usageBoxBottom = chalk.hex('#4f46e5')('└') + chalk.hex('#4f46e5')('─'.repeat(boxWidth)) + chalk.hex('#4f46e5')('┘');
      const usageBoxBorder = chalk.hex('#5b21b6')('─'.repeat(boxWidth));

      const usageCommands = [
        { cmd: 'cmt', desc: 'Generate commit message from staged files' },
        { cmd: 'cmt review', desc: 'AI-powered code review with quality analysis' },
        { cmd: 'cmt standards import', desc: 'Import code standards from popular guides' },
        { cmd: 'cmt --dry-run', desc: 'Preview commit message without committing' },
        { cmd: 'cmt --edit', desc: 'Edit generated message before committing' },
        { cmd: 'cmt pr [branch]', desc: 'Generate PR description from branch diff' },
        { cmd: 'cmt changelog <version>', desc: 'Generate changelog entry for version' },
        { cmd: 'cmt config set CMT_SML=true', desc: 'Enable condensed per-file messages' },
        { cmd: 'cmt config set CMT_EMOJI=true', desc: 'Enable GitMoji in commit messages' },
        { cmd: 'cmt config help', desc: 'View all configuration options' },
        { cmd: 'cmt hook set', desc: 'Install Git hook for auto-generation' },
        { cmd: 'cmt update', desc: 'Check for and install CommitAI updates' },
        { cmd: 'cmt --help', desc: 'Show all available commands and flags' }
      ];

      console.log(usageBoxTop);
      console.log(chalk.hex('#2563eb')('│') + chalk.bold.white(' Quick Start Guide'.padEnd(boxWidth)) + chalk.hex('#2563eb')('│'));
      console.log(chalk.hex('#5b21b6')('├') + usageBoxBorder + chalk.hex('#5b21b6')('┤'));

      for (const { cmd, desc } of usageCommands) {
        const cmdFormatted = chalk.yellow(cmd.padEnd(30));
        const descFormatted = chalk.gray(desc);
        const line = ` ${cmdFormatted} ${descFormatted}`;
        const strippedLength = line.replace(/\x1b\[[0-9;]*m/g, '').length;
        const padding = ' '.repeat(Math.max(0, boxWidth - strippedLength));
        console.log(chalk.hex('#6366f1')('│') + line + padding + chalk.hex('#6366f1')('│'));
      }

      console.log(chalk.hex('#4f46e5')('├') + chalk.hex('#4f46e5')('─'.repeat(boxWidth)) + chalk.hex('#4f46e5')('┤'));

      const docsLine = ` ${chalk.cyan('Documentation:')} ${chalk.gray('https://github.com/MantisWare/commit-ai')}`;
      const docsStrippedLength = docsLine.replace(/\x1b\[[0-9;]*m/g, '').length;
      const docsPadding = ' '.repeat(Math.max(0, boxWidth - docsStrippedLength));
      console.log(chalk.hex('#4f46e5')('│') + docsLine + docsPadding + chalk.hex('#4f46e5')('│'));

      console.log(usageBoxBottom);
      console.log('');

      process.exit(fails === 0 ? 0 : 1);
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);


