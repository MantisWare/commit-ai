import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from '@dqbd/tiktoken/lite';
import { sanitizeSpecialTokens } from './sanitizeSpecialTokens';

let sharedEncoding: Tiktoken | undefined;

const getEncoding = (): Tiktoken => {
  if (sharedEncoding === undefined) {
    sharedEncoding = new Tiktoken(
      cl100k_base.bpe_ranks,
      cl100k_base.special_tokens,
      cl100k_base.pat_str
    );
  }
  return sharedEncoding;
};

export function tokenCount(content: string): number {
  const encoding = getEncoding();
  const sanitized = sanitizeSpecialTokens(content);
  return encoding.encode(sanitized).length;
}
