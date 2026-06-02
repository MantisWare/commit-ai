/**
 * Split an array into chunks of at most `maxChunkSize` items.
 */
export const chunkStagedFiles = <T>(
  items: T[],
  maxChunkSize: number
): T[][] => {
  if (maxChunkSize <= 0) {
    throw new Error('maxChunkSize must be a positive number');
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += maxChunkSize) {
    chunks.push(items.slice(i, i + maxChunkSize));
  }
  return chunks;
};
