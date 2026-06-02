import { execa } from 'execa';

export const PACKAGE_NAME = '@mantisware/commit-ai';

export const getCommitAILatestVersion = async (): Promise<
  string | undefined
> => {
  try {
    const { stdout } = await execa('npm', ['view', PACKAGE_NAME, 'version']);
    return stdout.trim();
  } catch {
    return undefined;
  }
};
