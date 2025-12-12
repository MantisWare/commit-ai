// Special tokens that tiktoken and AI models use internally
const SPECIAL_TOKENS = [
  '<|endoftext|>',
  '<|fim_prefix|>',
  '<|fim_middle|>',
  '<|fim_suffix|>',
  '<|endofprompt|>'
];

/**
 * Sanitizes special tokens in text by adding spaces to prevent them from being interpreted
 * as control tokens by tiktoken or AI models
 */
export function sanitizeSpecialTokens(content: string): string {
  let sanitized = content;
  for (const token of SPECIAL_TOKENS) {
    // Replace special tokens with escaped versions by adding spaces
    sanitized = sanitized.replaceAll(token, token.replace('<|', '< |').replace('|>', '| >'));
  }
  return sanitized;
}
