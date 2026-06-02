export type StopHeartbeat = () => void;

export interface StartHeartbeatOptions {
  label: string;
  intervalMs?: number;
  enabled?: boolean;
  stream?: NodeJS.WriteStream;
}

export interface StartHeartbeatResult {
  stop: StopHeartbeat;
  updateLabel: (label: string) => void;
}

const DEFAULT_INTERVAL_MS = 1000;

const padRight = (input: string, width: number): string => {
  if (input.length >= width) return input;
  return input + ' '.repeat(width - input.length);
};

export const startElapsedHeartbeat = ({
  label,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled,
  stream
}: StartHeartbeatOptions): StartHeartbeatResult => {
  const output = stream ?? process.stdout;
  const isTty = output.isTTY === true;

  const shouldEnable = enabled ?? isTty;
  if (shouldEnable !== true) {
    return {
      stop: () => undefined,
      updateLabel: () => undefined
    };
  }

  const startedAt = Date.now();
  const lineWidth = 90;
  let currentLabel = label;

  const tick = () => {
    const elapsedMs = Date.now() - startedAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const line = `${currentLabel} (${elapsedSeconds}s elapsed)…`;
    output.write(`\r${padRight(line, lineWidth)}`);
  };

  tick();
  const timer = setInterval(tick, intervalMs);

  return {
    updateLabel: (nextLabel: string) => {
      currentLabel = nextLabel;
      tick();
    },
    stop: () => {
      clearInterval(timer);
      output.write(`\r${' '.repeat(lineWidth)}\r`);
    }
  };
};
