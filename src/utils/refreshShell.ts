import chalk from 'chalk';
import { execa } from 'execa';
import { basename } from 'path';

export type ShellKind = 'zsh' | 'bash' | 'fish' | 'tcsh' | 'sh' | 'unknown';

/**
 * Detects the interactive shell the user is running from, based on $SHELL.
 * Used to give the correct command for refreshing the shell's command lookup
 * cache after a global reinstall.
 */
export const detectShell = (
  shellPath: string | undefined = process.env.SHELL
): ShellKind => {
  if (shellPath === undefined || shellPath === '') {
    return 'unknown';
  }

  const name = basename(shellPath).toLowerCase();

  if (name.includes('zsh')) return 'zsh';
  if (name.includes('bash')) return 'bash';
  if (name.includes('fish')) return 'fish';
  if (name.includes('tcsh') || name.includes('csh')) return 'tcsh';
  if (name === 'sh' || name === 'dash') return 'sh';

  return 'unknown';
};

/**
 * Returns the command that clears the shell's hashed command locations so a
 * freshly (re)installed binary is picked up in the current session.
 * Returns undefined for shells that rehash automatically (e.g. fish).
 */
export const getRehashCommand = (
  shell: ShellKind = detectShell()
): string | undefined => {
  switch (shell) {
    case 'zsh':
    case 'tcsh':
      return 'rehash';
    case 'bash':
    case 'sh':
      return 'hash -r';
    case 'fish':
      return undefined;
    default:
      return 'hash -r';
  }
};

/**
 * Prints a shell-aware hint telling the user how to pick up the updated binary
 * without opening a new terminal. Safe to call in any (including non-TTY)
 * context.
 */
export const printShellRefreshHint = (
  shell: ShellKind = detectShell()
): void => {
  const rehashCommand = getRehashCommand(shell);

  if (rehashCommand === undefined) {
    return;
  }

  console.log(
    chalk.gray(
      `Tip: run ${chalk.cyan(rehashCommand)} (or open a new terminal) so this shell uses the updated version.`
    )
  );
};

export type ReloadShellResult = 'reloaded' | 'skipped';

const isInteractiveSession = (): boolean =>
  process.stdout.isTTY === true && process.stdin.isTTY === true;

/**
 * Reloads the user's shell in place by launching a fresh interactive login
 * shell. The new shell has a clean command cache, so the just-installed binary
 * resolves immediately with no manual "refresh" step.
 *
 * Returns 'skipped' (without throwing) when reloading is not possible, e.g. in
 * a non-interactive/CI context or when the shell cannot be determined, so the
 * caller can fall back to printing a hint.
 */
export const reloadShell = async (
  shellPath: string | undefined = process.env.SHELL
): Promise<ReloadShellResult> => {
  if (shellPath === undefined || shellPath === '') {
    return 'skipped';
  }

  if (!isInteractiveSession()) {
    return 'skipped';
  }

  console.log(
    chalk.gray(
      `Reloading your shell so the update takes effect (type ${chalk.cyan('exit')} to return)...`
    )
  );

  try {
    await execa(shellPath, ['-l', '-i'], { stdio: 'inherit' });
    return 'reloaded';
  } catch {
    return 'skipped';
  }
};

export type RefreshShellAfterUpdateOptions = {
  reload?: boolean;
};

/**
 * Ensures the current terminal uses the newly installed binary. When reloading
 * is enabled and the session is interactive, the shell is reloaded in place;
 * otherwise a shell-aware refresh hint is printed as a fallback.
 */
export const refreshShellAfterUpdate = async (
  options: RefreshShellAfterUpdateOptions = {}
): Promise<void> => {
  const shouldReload = options.reload ?? true;

  if (shouldReload) {
    const result = await reloadShell();
    if (result === 'reloaded') {
      return;
    }
  }

  printShellRefreshHint();
};
