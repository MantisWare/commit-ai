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

  return results;
};

export const checkCommand = command(
  {
    name: COMMANDS.check
  },
  async () => {
    printCommitAiBanner({ version: packageJSON.version });

    try {
      const results = await runCheck();

      const fails = results.filter((r) => r.status === 'fail').length;
      const passes = results.filter((r) => r.status === 'pass').length;

      // Calculate max width for the box
      const maxLabelWidth = Math.max(...results.map(r => r.label.length));
      const boxWidth = 80;
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

      process.exit(fails === 0 ? 0 : 1);
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);


