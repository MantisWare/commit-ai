import { getConfig } from '../commands/config';

/**
 * Logs debug messages to stderr only when CMT_DEBUG is enabled
 */
export function debug(...args: any[]): void {
  const config = getConfig();
  if (config.CMT_DEBUG) {
    console.error('[DEBUG]', ...args);
  }
}
