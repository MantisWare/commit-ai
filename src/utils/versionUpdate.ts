import { execa } from 'execa';

import currentPackage from '../../package.json';
import { getCommitAILatestVersion, PACKAGE_NAME } from '../version';

export type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string | undefined;
  updateAvailable: boolean;
};

export const parseSemver = (version: string): [number, number, number] => {
  const normalized = version.replace(/^v/, '');
  const [major = 0, minor = 0, patch = 0] = normalized.split('.').map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });
  return [major, minor, patch];
};

export const isVersionOlder = (current: string, latest: string): boolean => {
  const [cMaj, cMin, cPatch] = parseSemver(current);
  const [lMaj, lMin, lPatch] = parseSemver(latest);
  if (cMaj !== lMaj) {
    return cMaj < lMaj;
  }
  if (cMin !== lMin) {
    return cMin < lMin;
  }
  return cPatch < lPatch;
};

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  const currentVersion = currentPackage.version;
  const latestVersion = await getCommitAILatestVersion();

  const updateAvailable =
    latestVersion !== undefined &&
    latestVersion !== '' &&
    isVersionOlder(currentVersion, latestVersion);

  return { currentVersion, latestVersion, updateAvailable };
};

export type GlobalPackageManager = 'npm' | 'pnpm' | 'yarn';

export const detectGlobalPackageManager = (): GlobalPackageManager => {
  const scriptPath = process.argv[1] ?? '';
  if (scriptPath.includes('pnpm') || scriptPath.includes('.pnpm')) {
    return 'pnpm';
  }
  if (scriptPath.includes('yarn')) {
    return 'yarn';
  }
  return 'npm';
};

export const getUpdateCommand = (
  packageManager: GlobalPackageManager = detectGlobalPackageManager()
): string => {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm add -g ${PACKAGE_NAME}@latest`;
    case 'yarn':
      return `yarn global add ${PACKAGE_NAME}@latest`;
    default:
      return `npm i -g ${PACKAGE_NAME}@latest`;
  }
};

export type RunUpdateOptions = {
  packageManager?: GlobalPackageManager;
};

export const runUpdate = async (options: RunUpdateOptions = {}): Promise<void> => {
  const packageManager = options.packageManager ?? detectGlobalPackageManager();
  const args =
    packageManager === 'pnpm'
      ? ['add', '-g', `${PACKAGE_NAME}@latest`]
      : packageManager === 'yarn'
        ? ['global', 'add', `${PACKAGE_NAME}@latest`]
        : ['i', '-g', `${PACKAGE_NAME}@latest`];

  await execa(packageManager, args, { stdio: 'inherit' });
};
