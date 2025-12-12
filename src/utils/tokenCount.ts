import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from '@dqbd/tiktoken/lite';
import { sanitizeSpecialTokens } from './sanitizeSpecialTokens';

export function tokenCount(content: string): number {
  const encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );
  const sanitized = sanitizeSpecialTokens(content);
  const tokens = encoding.encode(sanitized);
  encoding.free();
  return tokens.length;
}
