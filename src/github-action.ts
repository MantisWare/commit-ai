import core from '@actions/core';
import exec from '@actions/exec';
import github from '@actions/github';
import { intro, outro } from '@clack/prompts';
import { PushEvent } from '@octokit/webhooks-types';
import { unlinkSync, writeFileSync } from 'fs';
import { generateCommitMessageByDiff } from './generateCommitMessageFromGitDiff';
import { randomIntFromInterval } from './utils/randomIntFromInterval';
import { sleep } from './utils/sleep';

// This should be a token with access to your repository scoped in as a secret.
// The YML workflow will need to set GITHUB_TOKEN with the GitHub Secret Token
// GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
// https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');

// Safety Rails Configuration
const ENABLE_FORCE_PUSH = core.getInput('enable_force_push') === 'true';
const ALLOWED_BRANCHES = core.getInput('allowed_branches') || '';
const REQUIRE_CONFIRMATION = core.getInput('require_confirmation') !== 'false'; // default true
const PROTECTED_BRANCHES = ['main', 'master', 'production', 'prod'];

const octokit = github.getOctokit(GITHUB_TOKEN);
const context = github.context;
const owner = context.repo.owner;
const repo = context.repo.repo;

function isBranchAllowed(branchName: string): boolean {
  // If no allowed branches specified, allow all
  if (!ALLOWED_BRANCHES) return true;

  const allowedList = ALLOWED_BRANCHES.split(',').map(b => b.trim());
  return allowedList.includes(branchName);
}

function isProtectedBranch(branchName: string): boolean {
  return PROTECTED_BRANCHES.some(protectedBranch =>
    branchName === protectedBranch || branchName.endsWith(`/${protectedBranch}`)
  );
}

function getBranchName(): string {
  const ref = context.ref; // e.g., 'refs/heads/main'
  return ref.replace('refs/heads/', '');
}

function performSafetyChecks(): { proceed: boolean; message: string } {
  const branchName = getBranchName();

  // Check if branch is in allowlist
  if (!isBranchAllowed(branchName)) {
    return {
      proceed: false,
      message: `Branch '${branchName}' is not in the allowed branches list: ${ALLOWED_BRANCHES}`
    };
  }

  // Check if force push is disabled but branch is protected
  if (!ENABLE_FORCE_PUSH && isProtectedBranch(branchName)) {
    return {
      proceed: false,
      message: `Force push to protected branch '${branchName}' is not allowed. Set enable_force_push: true to override.`
    };
  }

  // Check if confirmation is required but force push is enabled on protected branch
  if (REQUIRE_CONFIRMATION && ENABLE_FORCE_PUSH && isProtectedBranch(branchName)) {
    core.warning(
      `⚠️  Force pushing to protected branch '${branchName}'. Ensure this is intentional.`
    );
  }

  return { proceed: true, message: 'Safety checks passed' };
}

async function getCommitDiff(commitSha: string) {
  const diffResponse = await octokit.request<string>(
    'GET /repos/{owner}/{repo}/commits/{ref}',
    {
      owner,
      repo,
      ref: commitSha,
      headers: {
        Accept: 'application/vnd.github.v3.diff'
      }
    }
  );
  return { sha: commitSha, diff: diffResponse.data };
}

interface DiffAndSHA {
  sha: string;
  diff: string;
}

interface MsgAndSHA {
  sha: string;
  msg: string;
}

// send only 3-4 size chunks of diffs in steps,
// because openAI restricts "too many requests" at once with 429 error
async function improveMessagesInChunks(diffsAndSHAs: DiffAndSHA[]) {
  const chunkSize = diffsAndSHAs!.length % 2 === 0 ? 4 : 3;
  outro(`Improving commit messages in chunks of ${chunkSize}.`);
  const improvePromises = diffsAndSHAs!.map((commit) =>
    generateCommitMessageByDiff(commit.diff, false)
  );

  let improvedMessagesAndSHAs: MsgAndSHA[] = [];
  for (let step = 0; step < improvePromises.length; step += chunkSize) {
    const chunkOfPromises = improvePromises.slice(step, step + chunkSize);

    try {
      const chunkOfImprovedMessages = await Promise.all(chunkOfPromises);

      const chunkOfImprovedMessagesBySha = chunkOfImprovedMessages.map(
        (improvedMsg, i) => {
          const index = improvedMessagesAndSHAs.length;
          const sha = diffsAndSHAs![index + i].sha;

          return { sha, msg: improvedMsg };
        }
      );

      improvedMessagesAndSHAs.push(...chunkOfImprovedMessagesBySha);

      // sometimes openAI errors with 429 code (too many requests),
      // so lets sleep a bit
      const sleepFor =
        1000 * randomIntFromInterval(1, 5) + 100 * randomIntFromInterval(1, 5);

      outro(
        `Improved ${chunkOfPromises.length} messages. Sleeping for ${sleepFor}`
      );

      await sleep(sleepFor);
    } catch (error) {
      outro(error as string);

      // if sleeping in try block still fails with 429,
      // openAI wants at least 1 minute before next request
      const sleepFor = 60000 + 1000 * randomIntFromInterval(1, 5);
      outro(`Retrying after sleeping for ${sleepFor}`);
      await sleep(sleepFor);

      // go to previous step
      step -= chunkSize;
    }
  }

  return improvedMessagesAndSHAs;
}

const getDiffsBySHAs = async (SHAs: string[]) => {
  const diffPromises = SHAs.map((sha) => getCommitDiff(sha));

  const diffs = await Promise.all(diffPromises).catch((error) => {
    outro(`Error in Promise.all(getCommitDiffs(SHAs)): ${error}.`);
    throw error;
  });

  return diffs;
};

async function improveCommitMessages(
  commitsToImprove: { id: string; message: string }[]
): Promise<void> {
  if (commitsToImprove.length) {
    outro(`Found ${commitsToImprove.length} commits to improve.`);
  } else {
    outro('No new commits found.');
    return;
  }

  outro('Fetching commit diffs by SHAs.');
  const commitSHAsToImprove = commitsToImprove.map((commit) => commit.id);
  const diffsWithSHAs = await getDiffsBySHAs(commitSHAsToImprove);
  outro('Done.');

  const improvedMessagesWithSHAs = await improveMessagesInChunks(diffsWithSHAs);

  console.log(
    `Improved ${improvedMessagesWithSHAs.length} commits: `,
    improvedMessagesWithSHAs
  );

  // Check if there are actually any changes in the commit messages
  const messagesChanged = improvedMessagesWithSHAs.some(
    ({ sha, msg }, index) => msg !== commitsToImprove[index].message
  );

  if (!messagesChanged) {
    console.log('No changes in commit messages detected, skipping rebase');
    return;
  }

  const createCommitMessageFile = (message: string, index: number) =>
    writeFileSync(`./commit-${index}.txt`, message);
  improvedMessagesWithSHAs.forEach(({ msg }, i) =>
    createCommitMessageFile(msg, i)
  );

  writeFileSync(`./count.txt`, '0');

  writeFileSync(
    './rebase-exec.sh',
    `#!/bin/bash
    count=$(cat count.txt)
    git commit --amend -F commit-$count.txt
    echo $(( count + 1 )) > count.txt`
  );

  await exec.exec(`chmod +x ./rebase-exec.sh`);

  await exec.exec(
    'git',
    ['rebase', `${commitsToImprove[0].id}^`, '--exec', './rebase-exec.sh'],
    {
      env: {
        GIT_SEQUENCE_EDITOR: 'sed -i -e "s/^pick/reword/g"',
        GIT_COMMITTER_NAME: process.env.GITHUB_ACTOR!,
        GIT_COMMITTER_EMAIL: `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
      }
    }
  );

  const deleteCommitMessageFile = (index: number) =>
    unlinkSync(`./commit-${index}.txt`);
  commitsToImprove.forEach((_commit, i) => deleteCommitMessageFile(i));

  unlinkSync('./count.txt');
  unlinkSync('./rebase-exec.sh');

  outro('Preparing to push rebased commits to remote.');

  await exec.exec('git', ['status']);

  // Safety check before force push
  if (!ENABLE_FORCE_PUSH) {
    outro('⚠️  Force push is disabled. Rebased commits will NOT be pushed.');
    outro('Set enable_force_push: true in your workflow to enable force push.');
    return;
  }

  const branchName = getBranchName();
  if (isProtectedBranch(branchName)) {
    core.warning(
      `⚠️  Force pushing to protected branch '${branchName}'`
    );
  }

  // Force push the rebased commits
  outro('Force pushing rebased commits to remote.');
  await exec.exec('git', ['push', `--force`]);

  outro('Done 🧙');
}

async function run() {
  intro('CommitAI — improving lame commit messages');

  try {
    // Perform safety checks first
    const safetyCheck = performSafetyChecks();
    if (!safetyCheck.proceed) {
      outro(`❌ Safety check failed: ${safetyCheck.message}`);
      core.setFailed(safetyCheck.message);
      return;
    }
    outro(`✓ ${safetyCheck.message}`);

    if (github.context.eventName === 'push') {
      outro(`Processing commits in a Push event`);

      const payload = github.context.payload as PushEvent;

      const commits = payload.commits;

      // Set local Git user identity for future git history manipulations
      if (payload.pusher.email)
        await exec.exec('git', ['config', 'user.email', payload.pusher.email]);

      await exec.exec('git', ['config', 'user.name', payload.pusher.name]);

      await exec.exec('git', ['status']);
      await exec.exec('git', ['log', '--oneline']);

      await improveCommitMessages(commits);
    } else {
      outro('Wrong action.');
      core.error(
        `CommitAI was called on ${github.context.payload.action}. CommitAI is supposed to be used on "push" action.`
      );
    }
  } catch (error: any) {
    const err = error?.message || error;
    core.setFailed(err);
  }
}

run();
