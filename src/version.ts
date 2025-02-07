import { outro } from '@clack/prompts';
import { execa } from 'execa';

export const getCommitAILatestVersion = async (): Promise<
  string | undefined
> => {
  try {
    const { stdout } = await execa('npm', ['view', '@mantisware/commit-ai', 'version']);
    return stdout;
  } catch (_) {
    outro('Error while getting the latest version of commit-ai');
    return undefined;
  }
};
