import { resolve } from 'path';
import { render } from 'cli-testing-library';
import 'cli-testing-library/extend-expect';
import { prepareEnvironment, wait } from '../utils';
import path from 'path';

function getAbsolutePath(relativePath: string) {
  const scriptDir = path.dirname(__filename);
  return path.resolve(scriptDir, relativePath);
}
async function setupCommitlint(dir: string, ver: 9 | 18 | 19) {
  let packagePath, packageJsonPath, configPath;
  switch (ver) {
    case 9:
      packagePath = getAbsolutePath('./data/commitlint_9/node_modules');
      packageJsonPath = getAbsolutePath('./data/commitlint_9/package.json');
      configPath = getAbsolutePath('./data/commitlint_9/commitlint.config.js');
      break;
    case 18:
      packagePath = getAbsolutePath('./data/commitlint_18/node_modules');
      packageJsonPath = getAbsolutePath('./data/commitlint_18/package.json');
      configPath = getAbsolutePath('./data/commitlint_18/commitlint.config.js');
      break;
    case 19:
      packagePath = getAbsolutePath('./data/commitlint_19/node_modules');
      packageJsonPath = getAbsolutePath('./data/commitlint_19/package.json');
      configPath = getAbsolutePath('./data/commitlint_19/commitlint.config.js');
      break;
  }
  await render('cp', ['-r', packagePath, '.'], { cwd: dir });
  await render('cp', [packageJsonPath, '.'], { cwd: dir });
  await render('cp', [configPath, '.'], { cwd: dir });
  await wait(3000); // Avoid flakiness by waiting
}

describe('cli flow to run "cmt commitlint force"', () => {
  it('on commitlint@9 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlint(gitDir, 9);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@9')).toBeInTheConsole();

    const { findByText } = await render(
      `
      CMT_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      CMT_PROMPT_MODULE='@commitlint'  \
      CMT_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await findByText('commit-ai — configure @commitlint')
    ).toBeInTheConsole();
    expect(
      await findByText('Read @commitlint configuration')
    ).toBeInTheConsole();

    expect(
      await findByText('Generating consistency with given @commitlint rules')
    ).toBeInTheConsole();
    expect(
      await findByText('Done - please review contents of')
    ).toBeInTheConsole();

    await cleanup();
  });
  it('on commitlint@18 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlint(gitDir, 18);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@18')).toBeInTheConsole();

    const { findByText } = await render(
      `
      CMT_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      CMT_PROMPT_MODULE='@commitlint'  \
      CMT_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await findByText('commit-ai — configure @commitlint')
    ).toBeInTheConsole();
    expect(
      await findByText('Read @commitlint configuration')
    ).toBeInTheConsole();

    expect(
      await findByText('Generating consistency with given @commitlint rules')
    ).toBeInTheConsole();
    expect(
      await findByText('Done - please review contents of')
    ).toBeInTheConsole();

    await cleanup();
  });
  it('on commitlint@19 using ESM', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlint(gitDir, 19);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@19')).toBeInTheConsole();

    const { findByText } = await render(
      `
      CMT_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      CMT_PROMPT_MODULE='@commitlint'  \
      CMT_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await findByText('commit-ai — configure @commitlint')
    ).toBeInTheConsole();
    expect(
      await findByText('Read @commitlint configuration')
    ).toBeInTheConsole();

    expect(
      await findByText('Generating consistency with given @commitlint rules')
    ).toBeInTheConsole();
    expect(
      await findByText('Done - please review contents of')
    ).toBeInTheConsole();

    await cleanup();
  });
});

describe('cli flow to generate commit message using @commitlint prompt-module', () => {
  it('on commitlint@19 using ESM', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    // Setup commitlint@19
    await setupCommitlint(gitDir, 19);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@19')).toBeInTheConsole();

    // Run `cmt commitlint force`
    const commitlintForce = await render(
      `
      CMT_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      CMT_PROMPT_MODULE='@commitlint'  \
      CMT_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );
    expect(
      await commitlintForce.findByText('Done - please review contents of')
    ).toBeInTheConsole();

    // Run `cmt commitlint get`
    const commitlintGet = await render(
      `
      CMT_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      CMT_PROMPT_MODULE='@commitlint'  \
      CMT_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint get \
    `,
      [],
      { cwd: gitDir }
    );
    expect(await commitlintGet.findByText('consistency')).toBeInTheConsole();

    // Run 'cmt' using .commit-ai-commitlint
    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

    const cmt = await render(
      `
      CMT_TEST_MOCK_TYPE='commit-message' \
      CMT_PROMPT_MODULE='@commitlint'  \
      CMT_AI_PROVIDER='test' \
      node ${resolve('./out/cli.cjs')} \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await cmt.findByText('Generating the commit message')
    ).toBeInTheConsole();
    expect(
      await cmt.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    cmt.userEvent.keyboard('[Enter]');

    expect(
      await cmt.findByText('Do you want to run `git push`?')
    ).toBeInTheConsole();
    cmt.userEvent.keyboard('[Enter]');

    expect(
      await cmt.findByText('Successfully pushed all commits to origin')
    ).toBeInTheConsole();

    await cleanup();
  });
});
