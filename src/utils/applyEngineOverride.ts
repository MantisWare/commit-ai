import { outro } from '@clack/prompts';
import chalk from 'chalk';

import { CMT_AI_PROVIDER_ENUM, getConfig } from '../commands/config';
import {
  hasCloudModelConfigured,
  resolveEngineOverrideFromFlags,
  setEngineOverride,
  type EngineOverride
} from './engine';

export interface EngineOverrideFlags {
  local?: boolean;
  cloud?: boolean;
}

/**
 * Resolves the --local/--cloud flags into a process-wide engine override and
 * validates it against the current configuration. Exits with a helpful message
 * when the requested engine cannot be used (conflicting flags, or --cloud with
 * no cloud model configured).
 */
export const applyEngineOverrideFromFlags = (
  flags: EngineOverrideFlags
): EngineOverride | undefined => {
  let override: EngineOverride | undefined;

  try {
    override = resolveEngineOverrideFromFlags(flags);
  } catch (error) {
    outro(`${chalk.red('✖')} ${(error as Error).message}`);
    process.exit(1);
  }

  if (override === undefined) {
    return undefined;
  }

  const config = getConfig();

  if (override === 'cloud' && hasCloudModelConfigured(config) !== true) {
    outro(
      `${chalk.red('✖')} No cloud model is configured. Set an API key first, e.g.\n` +
        `  ${chalk.cyan('cmt config set CMT_API_KEY=<your_key> CMT_LOCAL_FALLBACK_PROVIDER=openai CMT_LOCAL_FALLBACK_MODEL=gpt-4o-mini')}`
    );
    process.exit(1);
  }

  setEngineOverride(override);

  const usingLabel =
    override === 'local'
      ? 'local model'
      : config.CMT_AI_PROVIDER === CMT_AI_PROVIDER_ENUM.LOCAL
        ? `cloud model (${config.CMT_LOCAL_FALLBACK_PROVIDER ?? CMT_AI_PROVIDER_ENUM.OPENAI})`
        : `cloud model (${config.CMT_AI_PROVIDER ?? CMT_AI_PROVIDER_ENUM.OPENAI})`;

  console.log(chalk.dim(`Using ${usingLabel} for this run.`));

  return override;
};
