#!/usr/bin/env node

import { cli } from 'cleye';

import packageJSON from '../package.json';
import { commit, commitLog } from './commands/commit';
import { checkCommand } from './commands/check';
import { commitlintConfigCommand } from './commands/commitlint';
import { configCommand } from './commands/config';
import { hookCommand, isHookCalled } from './commands/githook';
import { prepareCommitMessageHook } from './commands/prepare-commit-msg-hook';
import { prCommand, changelogCommand } from './commands/pr';
import { reviewCommand } from './commands/review';
import { standardsCommand } from './commands/standards';
import { updateCommand } from './commands/update';
import { localCommand } from './commands/local';
import { checkIsLatestVersion } from './utils/checkIsLatestVersion';
import { runMigrations } from './migrations/_run';

const extraArgs = process.argv.slice(2);

cli(
  {
    version: packageJSON.version,
    name: 'commit-ai',
    alias: 'cmt',
    commands: [checkCommand, configCommand, hookCommand, commitlintConfigCommand, prCommand, changelogCommand, reviewCommand, standardsCommand, updateCommand, localCommand],
    flags: {
      fgm: Boolean,
      context: {
        type: String,
        alias: 'c',
        description: 'Additional user input context for the commit message',
        default: ''
      },
      yes: {
        type: Boolean,
        alias: 'y',
        description: 'Skip commit confirmation prompt',
        default: false
      },
      log: {
        type: String,
        alias: 'l',
        description: 'Get all the commit messages in the current branch, diff from provided branch',
      },
      dryRun: {
        type: Boolean,
        description: 'Generate commit message without actually committing',
        default: false
      },
      edit: {
        type: Boolean,
        alias: 'e',
        description: 'Open generated message in $EDITOR before committing',
        default: false
      },
      noPush: {
        type: Boolean,
        description: 'Skip push prompts and behavior',
        default: false
      },
      stageAll: {
        type: Boolean,
        alias: 'a',
        description: 'Non-interactively stage all files and commit',
        default: false
      },
      review: {
        type: Boolean,
        alias: 'r',
        description: 'Run code review before committing',
        default: false
      }
    },
    ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
    help: { description: packageJSON.description }
  },
  async ({ flags }) => {
    await runMigrations();
    await checkIsLatestVersion();

    // console.log(flags);

    if (flags.log !== undefined) {
      const branch = flags.log !== '' ? flags.log : 'master';
      commitLog(branch, flags.fgm);
    } else if (await isHookCalled()) {
      prepareCommitMessageHook();
    } else {
      commit(extraArgs, {
        context: flags.context,
        stageAll: flags.stageAll,
        fullGitMojiSpec: flags.fgm,
        skipCommitConfirmation: flags.yes,
        dryRun: flags.dryRun,
        edit: flags.edit,
        noPush: flags.noPush,
        runReview: flags.review
      });
    }
    
  },
  extraArgs
);
