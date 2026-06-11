import { tokenCount } from './tokenCount';

export function mergeDiffs(arr: string[], maxStringLength: number): string[] {
  if (arr.length <= 1) return [...arr];

  const mergedArr: string[] = [];
  let currentItem: string = arr[0];
  // Track a running token count instead of re-tokenizing the accumulated
  // string on every iteration (quadratic on large diffs). The sum of part
  // counts is an upper bound on the merged count, so this stays within
  // budget while only tokenizing each item once.
  let currentTokens = tokenCount(arr[0]);

  for (const item of arr.slice(1)) {
    const itemTokens = tokenCount(item);
    if (currentTokens + itemTokens <= maxStringLength) {
      currentItem += item;
      currentTokens += itemTokens;
    } else {
      mergedArr.push(currentItem);
      currentItem = item;
      currentTokens = itemTokens;
    }
  }

  mergedArr.push(currentItem);

  return mergedArr;
}
