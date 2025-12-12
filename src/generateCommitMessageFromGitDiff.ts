import { OpenAI } from 'openai';
import { DEFAULT_TOKEN_LIMITS, getConfig } from './commands/config';
import { getMainCommitPrompt } from './prompts';
import { debug } from './utils/debug';
import { getEngine } from './utils/engine';
import { mergeDiffs } from './utils/mergeDiffs';
import { sanitizeSpecialTokens } from './utils/sanitizeSpecialTokens';
import { tokenCount } from './utils/tokenCount';

const config = getConfig();
const MAX_TOKENS_INPUT = config.CMT_TOKENS_MAX_INPUT;
const MAX_TOKENS_OUTPUT = config.CMT_TOKENS_MAX_OUTPUT;

const generateCommitMessageChatCompletionPrompt = async (
  diff: string,
  fullGitMojiSpec: boolean,
  context?: string
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(fullGitMojiSpec, context);

  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

  // Sanitize the diff to remove special tokens that could cause issues
  const sanitizedDiff = sanitizeSpecialTokens(diff);

  chatContextAsCompletionRequest.push({
    role: 'user',
    content: sanitizedDiff
  });

  return chatContextAsCompletionRequest;
};

export enum GenerateCommitMessageErrorEnum {
  tooMuchTokens = 'TOO_MUCH_TOKENS',
  internalError = 'INTERNAL_ERROR',
  emptyMessage = 'EMPTY_MESSAGE',
  outputTokensTooHigh = 'OUTPUT_TOKENS_TOO_HIGH'
}

export const getOutputTokensErrorMessage = () =>
  `Token limit exceeded, CMT_TOKENS_MAX_OUTPUT must not be much higher than the default ${DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT} tokens.`;

const ADJUSTMENT_FACTOR = 20;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isTimeoutLikeError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  const patterns = [
    'timeout',
    'timed out',
    'etimedout',
    'econnaborted',
    'aborterror',
    'socket hang up'
  ];

  return patterns.some((p) => message.includes(p));
};

type CommitMessageTask = () => Promise<string | null | undefined>;

export const generateCommitMessageByDiff = async (
  diff: string,
  fullGitMojiSpec: boolean = false,
  context: string = ""
): Promise<string> => {
  try {
    debug('Starting generateCommitMessageByDiff');
    debug('Getting main commit prompt...');
    const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
      fullGitMojiSpec,
      context
    );
    debug('Got main commit prompt, calculating token counts...');

    const INIT_MESSAGES_PROMPT_LENGTH = INIT_MESSAGES_PROMPT.map(
      (msg) => tokenCount(msg.content as string) + 4
    ).reduce((a, b) => a + b, 0);
    debug('Calculated prompt token count:', INIT_MESSAGES_PROMPT_LENGTH);

    const MAX_REQUEST_TOKENS =
      MAX_TOKENS_INPUT -
      ADJUSTMENT_FACTOR -
      INIT_MESSAGES_PROMPT_LENGTH -
      MAX_TOKENS_OUTPUT;

    debug('Counting diff tokens...');
    const diffTokenCount = tokenCount(diff);
    debug('Diff token count:', diffTokenCount, 'Max allowed:', MAX_REQUEST_TOKENS);

    if (diffTokenCount >= MAX_REQUEST_TOKENS) {
      debug('Diff too large, splitting into smaller chunks');
      const commitMessageTasks = await getCommitMsgsTasksFromFileDiffs(
        diff,
        MAX_REQUEST_TOKENS,
        fullGitMojiSpec,
        context
      );

      const commitMessages = [] as string[];
      for (const task of commitMessageTasks) {
        const msg = await task();
        if (msg !== null && msg !== undefined && msg.trim() !== '') {
          commitMessages.push(msg);
        }
        await delay(2000);
      }

      return commitMessages.join('\n\n');
    }

    debug('Generating chat completion prompt...');
    const messages = await generateCommitMessageChatCompletionPrompt(
      diff,
      fullGitMojiSpec,
      context,
    );
    debug('Got messages, initializing engine...');

    const engine = getEngine();
    debug('Engine initialized, making API call...');
    const commitMessage = await engine.generateCommitMessage(messages);
    debug('Got response from API');

    if (!commitMessage)
      throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);

    return commitMessage;
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      const fallbackMaxDiffLength = Math.max(200, Math.floor(MAX_TOKENS_INPUT / 6));
      const commitMessageTasks = await getCommitMsgsTasksFromFileDiffs(
        diff,
        fallbackMaxDiffLength,
        fullGitMojiSpec,
        context
      );

      const commitMessages = [] as string[];
      for (const task of commitMessageTasks) {
        const msg = await task();
        if (msg !== null && msg !== undefined && msg.trim() !== '') {
          commitMessages.push(msg);
        }
        await delay(2000);
      }

      if (commitMessages.length > 0) {
        return commitMessages.join('\n\n');
      }
    }

    throw error;
  }
};

function getMessagesPromisesByChangesInFile(
  fileDiff: string,
  separator: string,
  maxChangeLength: number,
  fullGitMojiSpec: boolean,
  context: string
): CommitMessageTask[] {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  // merge multiple line-diffs into 1 to save tokens
  const mergedChanges = mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader = [] as string[];
  for (const change of mergedChanges) {
    const totalChange = fileHeader + change;
    if (tokenCount(totalChange) > maxChangeLength) {
      // If the totalChange is too large, split it into smaller pieces
      const splitChanges = splitDiff(totalChange, maxChangeLength);
      lineDiffsWithHeader.push(...splitChanges);
    } else {
      lineDiffsWithHeader.push(totalChange);
    }
  }

  const engine = getEngine();
  const commitMsgsFromFileLineDiffs: CommitMessageTask[] = lineDiffsWithHeader.map(
    (lineDiff) => async () => {
      const messages = await generateCommitMessageChatCompletionPrompt(
        separator + lineDiff,
        fullGitMojiSpec,
        context
      );

      return engine.generateCommitMessage(messages);
    }
  );

  return commitMsgsFromFileLineDiffs;
}

function splitDiff(diff: string, maxChangeLength: number) {
  const lines = diff.split('\n');
  const splitDiffs = [] as string[];
  let currentDiff = '';

  if (maxChangeLength <= 0) {
    throw new Error(getOutputTokensErrorMessage());
  }

  for (let line of lines) {
    // If a single line exceeds maxChangeLength, split it into multiple lines
    while (tokenCount(line) > maxChangeLength) {
      const subLine = line.substring(0, maxChangeLength);
      line = line.substring(maxChangeLength);
      splitDiffs.push(subLine);
    }

    // Check the tokenCount of the currentDiff and the line separately
    if (tokenCount(currentDiff) + tokenCount('\n' + line) > maxChangeLength) {
      // If adding the next line would exceed the maxChangeLength, start a new diff
      splitDiffs.push(currentDiff);
      currentDiff = line;
    } else {
      // Otherwise, add the line to the current diff
      currentDiff += '\n' + line;
    }
  }

  // Add the last diff
  if (currentDiff) {
    splitDiffs.push(currentDiff);
  }

  return splitDiffs;
}

export const getCommitMsgsPromisesFromFileDiffs = async (
  diff: string,
  maxDiffLength: number,
  fullGitMojiSpec: boolean
) => {
  // kept for backward-compatibility inside this file; prefer getCommitMsgsTasksFromFileDiffs
  return getCommitMsgsTasksFromFileDiffs(diff, maxDiffLength, fullGitMojiSpec, '');
};

const getCommitMsgsTasksFromFileDiffs = async (
  diff: string,
  maxDiffLength: number,
  fullGitMojiSpec: boolean,
  context: string
): Promise<CommitMessageTask[]> => {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);

  // merge multiple files-diffs into 1 prompt to save tokens
  const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

  const commitMessageTasks = [] as CommitMessageTask[];

  for (const fileDiff of mergedFilesDiffs) {
    if (tokenCount(fileDiff) >= maxDiffLength) {
      // if file-diff is bigger than gpt context — split fileDiff into lineDiff
      const messagesPromises = getMessagesPromisesByChangesInFile(
        fileDiff,
        separator,
        maxDiffLength,
        fullGitMojiSpec,
        context
      );

      commitMessageTasks.push(...messagesPromises);
    } else {
      const engine = getEngine();
      commitMessageTasks.push(async () => {
        const messages = await generateCommitMessageChatCompletionPrompt(
          separator + fileDiff,
          fullGitMojiSpec,
          context
        );
        return engine.generateCommitMessage(messages);
      });
    }
  }

  return commitMessageTasks;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
