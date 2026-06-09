import { formatEngineStatusLabel } from '../local/statusLabels';
import type { EngineStatus } from '../local/types';

export type StopWarmupIndicator = () => void;

export interface WarmupIndicator {
  update: (status: EngineStatus) => void;
  stop: StopWarmupIndicator;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DEFAULT_INTERVAL_MS = 80;
const LINE_WIDTH = 100;

const padRight = (input: string, width: number): string => {
  if (input.length >= width) return input;
  return input + ' '.repeat(width - input.length);
};

export const startWarmupIndicator = (
  stream: NodeJS.WriteStream = process.stderr
): WarmupIndicator => {
  const isTty = stream.isTTY === true;

  if (isTty !== true) {
    let lastPhase: string | undefined;
    return {
      update: (status: EngineStatus) => {
        if (status.phase === 'ready') return;
        const label = formatEngineStatusLabel(status);
        if (label !== lastPhase) {
          stream.write(`${label}\n`);
          lastPhase = label;
        }
      },
      stop: () => undefined
    };
  }

  const startedAt = Date.now();
  let frameIndex = 0;
  let currentStatus: EngineStatus = { phase: 'checking_runtime' };
  let timer: ReturnType<typeof setInterval> | undefined;

  const tick = () => {
    if (currentStatus.phase === 'ready') return;
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    frameIndex += 1;
    const label = formatEngineStatusLabel(currentStatus);
    const line = `${frame} ${label} (${elapsedSeconds}s elapsed)…`;
    stream.write(`\r${padRight(line, LINE_WIDTH)}`);
  };

  timer = setInterval(tick, DEFAULT_INTERVAL_MS);
  tick();

  return {
    update: (status: EngineStatus) => {
      currentStatus = status;
      if (status.phase === 'ready') {
        if (timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
        stream.write(`\r${' '.repeat(LINE_WIDTH)}\r`);
        return;
      }
      tick();
    },
    stop: () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
      stream.write(`\r${' '.repeat(LINE_WIDTH)}\r`);
    }
  };
};
