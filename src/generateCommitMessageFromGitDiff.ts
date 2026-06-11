import { OpenAI } from 'openai';
import { getConfig } from './commands/config';
import { getMainCommitPrompt, getSynthesisPrompt } from './prompts';
import { debug } from './utils/debug';
import type { OnEngineStatus } from './local/types';
import { getEngine } from './utils/engine';
import { capOversizedFileDiffs } from './utils/capOversizedFileDiffs';
import { mergeDiffs } from './utils/mergeDiffs';
import {
  isTransientNetworkError,
  runWithConcurrency
} from './utils/runWithConcurrency';
import { sanitizeSpecialTokens } from './utils/sanitizeSpecialTokens';
import { applyClassicTlsGroupsFallback } from './utils/tlsFallback';
import { tokenCount } from './utils/tokenCount';
import { yieldToEventLoop } from './utils/yieldToEventLoop';

const config = getConfig();
const MAX_TOKENS_INPUT = config.CMT_TOKENS_MAX_INPUT ?? 8192;
const MAX_TOKENS_OUTPUT = config.CMT_TOKENS_MAX_OUTPUT ?? 2048;
const DEFAULT_CHUNK_CONCURRENCY = 4;
const PREP_YIELD_EVERY_N_FILES = 8;

const getChunkConcurrency = (): number => {
  const configured = config.CMT_CHUNK_CONCURRENCY;
  if (configured === undefined || typeof configured !== 'number') {
    return DEFAULT_CHUNK_CONCURRENCY;
  }
  return Math.max(1, Math.min(10, configured));
};

const shouldSynthesizeChunks = (): boolean =>
  config.CMT_SYNTHESIZE_CHUNKS !== false;

const generateCommitMessageChatCompletionPrompt = async (
  diff: string,
  fullGitMojiSpec: boolean,
  context?: string
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(fullGitMojiSpec, context);

  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

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
  `Token limit exceeded. Please adjust CMT_TOKENS_MAX_OUTPUT to match your provider's limits.`;

const ADJUSTMENT_FACTOR = 20;

export type GenerateCommitProgressPhase =
  | 'preparing'
  | 'generating'
  | 'synthesizing';

export interface GenerateCommitProgress {
  phase: GenerateCommitProgressPhase;
  completed?: number;
  total?: number;
}

export type OnGenerateCommitProgress = (
  progress: GenerateCommitProgress
) => void;

export type OnEngineStatusCallback = OnEngineStatus;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isRecoverableRequestError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  const timeoutPatterns = ['timeout', 'timed out', 'aborterror'];

  return (
    timeoutPatterns.some((p) => message.includes(p)) ||
    isTransientNetworkError(error)
  );
};

type CommitMessageTask = () => Promise<string | null | undefined>;

const collectNonEmptyMessages = (
  messages: Array<string | null | undefined>
): string[] =>
  messages.filter(
    (msg): msg is string =>
      msg !== null && msg !== undefined && msg.trim() !== ''
  );

const joinChunkMessages = (messages: string[]): string =>
  messages.join('\n\n');

const synthesizeChunkMessages = async (
  chunkMessages: string[],
  fullGitMojiSpec: boolean,
  context: string,
  onProgress?: OnGenerateCommitProgress,
  onEngineStatus?: OnEngineStatusCallback
): Promise<string> => {
  onProgress?.({ phase: 'synthesizing' });

  try {
    const engine = getEngine({ onStatus: onEngineStatus });
    const messages = getSynthesisPrompt(chunkMessages, fullGitMojiSpec, context);
    const synthesized = await engine.generateCommitMessage(messages);

    if (
      synthesized !== null &&
      synthesized !== undefined &&
      synthesized.trim() !== ''
    ) {
      return synthesized;
    }
  } catch (error) {
    debug('Synthesis failed, falling back to joined chunk messages:', error);
  }

  return joinChunkMessages(chunkMessages);
};

const finalizeChunkMessages = async (
  chunkMessages: string[],
  fullGitMojiSpec: boolean,
  context: string,
  onProgress?: OnGenerateCommitProgress,
  onEngineStatus?: OnEngineStatusCallback
): Promise<string> => {
  if (chunkMessages.length === 0) {
    throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);
  }

  if (chunkMessages.length === 1) {
    return chunkMessages[0];
  }

  if (shouldSynthesizeChunks()) {
    return synthesizeChunkMessages(
      chunkMessages,
      fullGitMojiSpec,
      context,
      onProgress,
      onEngineStatus
    );
  }

  return joinChunkMessages(chunkMessages);
};

const runChunkTasks = async (
  commitMessageTasks: CommitMessageTask[],
  fullGitMojiSpec: boolean,
  context: string,
  onProgress?: OnGenerateCommitProgress,
  onEngineStatus?: OnEngineStatusCallback
): Promise<string> => {
  const concurrency = getChunkConcurrency();
  const batchDelayMs = concurrency > 1 ? 750 : 0;

  onProgress?.({
    phase: 'generating',
    completed: 0,
    total: commitMessageTasks.length
  });

  const results = await runWithConcurrency({
    tasks: commitMessageTasks,
    concurrency,
    batchDelayMs,
    onProgress: (completed, total) => {
      onProgress?.({ phase: 'generating', completed, total });
    }
  });

  const chunkMessages = collectNonEmptyMessages(results);
  return finalizeChunkMessages(
    chunkMessages,
    fullGitMojiSpec,
    context,
    onProgress,
    onEngineStatus
  );
};

export const generateCommitMessageByDiff = async (
  rawDiff: string,
  fullGitMojiSpec: boolean = false,
  context: string = '',
  onProgress?: OnGenerateCommitProgress,
  onEngineStatus?: OnEngineStatusCallback
): Promise<string> => {
  // Must happen before any token counting: huge generated/minified file
  // diffs make synchronous tokenization block the event loop (frozen
  // heartbeat/timeouts) and would fan out into hundreds of API calls.
  const diff = capOversizedFileDiffs(rawDiff);

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
        context,
        onProgress,
        onEngineStatus
      );

      return runChunkTasks(
        commitMessageTasks,
        fullGitMojiSpec,
        context,
        onProgress,
        onEngineStatus
      );
    }

    debug('Generating chat completion prompt...');
    const messages = await generateCommitMessageChatCompletionPrompt(
      diff,
      fullGitMojiSpec,
      context
    );
    debug('Got messages, initializing engine...');

    const engine = getEngine({ onStatus: onEngineStatus });
    debug('Engine initialized, making API call...');
    const commitMessage = await engine.generateCommitMessage(messages);
    debug('Got response from API');

    if (!commitMessage)
      throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);

    return commitMessage;
  } catch (error) {
    if (isRecoverableRequestError(error)) {
      // Stale or blocked TLS sockets (e.g. ECONNRESET caused by middleboxes
      // rejecting post-quantum ClientHellos) are remedied before retrying.
      applyClassicTlsGroupsFallback();

      const fallbackMaxDiffLength = Math.max(
        200,
        Math.floor(MAX_TOKENS_INPUT / 6)
      );
      const commitMessageTasks = await getCommitMsgsTasksFromFileDiffs(
        diff,
        fallbackMaxDiffLength,
        fullGitMojiSpec,
        context,
        onProgress,
        onEngineStatus
      );

      if (commitMessageTasks.length > 0) {
        return runChunkTasks(
          commitMessageTasks,
          fullGitMojiSpec,
          context,
          onProgress,
          onEngineStatus
        );
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
  context: string,
  onEngineStatus?: OnEngineStatusCallback
): CommitMessageTask[] {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  const mergedChanges = mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader = [] as string[];
  for (const change of mergedChanges) {
    const totalChange = fileHeader + change;
    if (tokenCount(totalChange) > maxChangeLength) {
      const splitChanges = splitDiff(totalChange, maxChangeLength);
      lineDiffsWithHeader.push(...splitChanges);
    } else {
      lineDiffsWithHeader.push(totalChange);
    }
  }

  const engine = getEngine({ onStatus: onEngineStatus });
  const commitMsgsFromFileLineDiffs: CommitMessageTask[] =
    lineDiffsWithHeader.map((lineDiff) => async () => {
      const messages = await generateCommitMessageChatCompletionPrompt(
        separator + lineDiff,
        fullGitMojiSpec,
        context
      );

      return engine.generateCommitMessage(messages);
    });

  return commitMsgsFromFileLineDiffs;
}

function splitDiff(diff: string, maxChangeLength: number) {
  const lines = diff.split('\n');
  const splitDiffs = [] as string[];
  let currentDiff = '';
  let currentDiffTokens = 0;

  if (maxChangeLength <= 0) {
    throw new Error(getOutputTokensErrorMessage());
  }

  for (let line of lines) {
    // Slice very long lines by characters: a chunk of N chars never exceeds
    // ~N tokens, and this avoids re-tokenizing the entire remaining line on
    // every iteration (which is quadratic and froze the CLI on multi-MB
    // single-line diffs of minified files).
    while (line.length > maxChangeLength) {
      splitDiffs.push(line.substring(0, maxChangeLength));
      line = line.substring(maxChangeLength);
    }

    const lineTokens = tokenCount('\n' + line);
    if (currentDiffTokens + lineTokens > maxChangeLength) {
      if (currentDiff !== '') {
        splitDiffs.push(currentDiff);
      }
      currentDiff = line;
      currentDiffTokens = tokenCount(line);
    } else {
      currentDiff += '\n' + line;
      currentDiffTokens += lineTokens;
    }
  }

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
  return getCommitMsgsTasksFromFileDiffs(
    diff,
    maxDiffLength,
    fullGitMojiSpec,
    ''
  );
};

const getCommitMsgsTasksFromFileDiffs = async (
  diff: string,
  maxDiffLength: number,
  fullGitMojiSpec: boolean,
  context: string,
  onProgress?: OnGenerateCommitProgress,
  onEngineStatus?: OnEngineStatusCallback
): Promise<CommitMessageTask[]> => {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);
  const totalFiles = diffByFiles.length;

  onProgress?.({ phase: 'preparing', completed: 0, total: totalFiles });

  for (let fileIndex = 0; fileIndex < diffByFiles.length; fileIndex += 1) {
    if (
      fileIndex > 0 &&
      fileIndex % PREP_YIELD_EVERY_N_FILES === 0
    ) {
      onProgress?.({
        phase: 'preparing',
        completed: fileIndex,
        total: totalFiles
      });
      await yieldToEventLoop();
    }
  }

  const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

  onProgress?.({
    phase: 'preparing',
    completed: totalFiles,
    total: totalFiles
  });

  const commitMessageTasks = [] as CommitMessageTask[];

  for (const fileDiff of mergedFilesDiffs) {
    if (tokenCount(fileDiff) >= maxDiffLength) {
      const messagesPromises = getMessagesPromisesByChangesInFile(
        fileDiff,
        separator,
        maxDiffLength,
        fullGitMojiSpec,
        context,
        onEngineStatus
      );

      commitMessageTasks.push(...messagesPromises);
    } else {
      const engine = getEngine({ onStatus: onEngineStatus });
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
