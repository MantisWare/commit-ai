import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { existsSync, writeFileSync } from 'fs';
import { OpenAI } from 'openai';
import {
  getConfig,
  getGlobalConfig,
  setGlobalConfig,
  type ConfigType
} from './config';
import {
  DEFAULT_DAEMON_PORT,
  isDaemonRunning,
  startDaemon,
  stopDaemon
} from '../local/daemon';
import {
  downloadModelForRuntime,
  isGgufModelDownloaded
} from '../local/downloadModel';
import {
  DEFAULT_LOCAL_PRESET,
  LOCAL_MODEL_PRESETS,
  LOCAL_MODEL_PRESET_IDS,
  getModelDisplayLabel,
  isLocalModelPresetId,
  resolvePreset
} from '../local/modelPresets';
import {
  detectRuntime,
  getRuntimeDisplayName,
  resolveLocalRuntimeOverride
} from '../local/runtime';
import { LOCAL_SETUP_MARKER, ensureLocalDirs } from '../local/paths';
import {
  checkMlxLmInstalled,
  installMlxLm
} from '../local/mlxRuntime';
import { LocalEngine } from '../engine/local';

const runSetup = async (): Promise<void> => {
  const config = getConfig();
  const runtime = detectRuntime(
    resolveLocalRuntimeOverride(config.CMT_LOCAL_RUNTIME)
  );
  const presetId = isLocalModelPresetId(config.CMT_LOCAL_MODEL_PRESET)
    ? config.CMT_LOCAL_MODEL_PRESET
    : DEFAULT_LOCAL_PRESET;
  const preset = resolvePreset(presetId);
  const modelLabel = getModelDisplayLabel(preset, runtime);

  intro(`Setting up local model: ${modelLabel}`);

  ensureLocalDirs();

  if (runtime === 'mlx') {
    const spin = spinner();
    spin.start('Checking mlx-lm installation…');
    const installed = await checkMlxLmInstalled();
    if (installed !== true) {
      spin.stop('mlx-lm not found');
      const installSpin = spinner();
      installSpin.start('Installing mlx-lm in an isolated environment…');
      await installMlxLm();
      installSpin.stop('mlx-lm ready');
    } else {
      spin.stop('mlx-lm ready');
    }
  } else {
    const spin = spinner();
    spin.start('Checking node-llama-cpp…');
    try {
      const { importNodeLlamaCpp } = await import('../local/importNodeLlamaCpp');
      await importNodeLlamaCpp();
      spin.stop('node-llama-cpp ready');
    } catch (error) {
      spin.stop('node-llama-cpp not installed');
      throw new Error(
        `node-llama-cpp is required for GGUF runtime. Install with: pnpm add node-llama-cpp. ${error instanceof Error ? error.message : ''}`
      );
    }
  }

  const downloadSpin = spinner();
  downloadSpin.start(`Warming up ${preset.label} — downloading if needed…`);
  await downloadModelForRuntime(preset, runtime);
  downloadSpin.stop(`Model ready: ${modelLabel}`);

  const testSpin = spinner();
  testSpin.start(`Running smoke test with ${modelLabel}…`);
  const engine = new LocalEngine({
    apiKey: '',
    model: presetId,
    maxTokensInput: config.CMT_LOCAL_CONTEXT_SIZE ?? 4096,
    maxTokensOutput: 128,
    baseURL: ''
  });
  const testMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> =
    [
      {
        role: 'system',
        content: 'You write git commit messages.'
      },
      {
        role: 'user',
        content: 'diff --git a/test.ts b/test.ts\n+const x = 1;'
      }
    ];
  await engine.generateCommitMessage(testMessages);
  testSpin.stop('Smoke test passed');

  writeFileSync(
    LOCAL_SETUP_MARKER,
    JSON.stringify(
      {
        runtime,
        preset: presetId,
        completedAt: new Date().toISOString()
      },
      null,
      2
    ),
    'utf8'
  );

  const currentConfig = getGlobalConfig();
  setGlobalConfig({
    ...currentConfig,
    CMT_AI_PROVIDER: 'local' as ConfigType['CMT_AI_PROVIDER'],
    CMT_LOCAL_MODEL_PRESET: presetId
  } as ConfigType);

  outro(
    `${chalk.green('✔')} Local LLM setup complete. Run ${chalk.cyan('cmt local serve')} for faster git hooks.`
  );
};

const runServe = async (background: boolean): Promise<void> => {
  const config = getConfig();
  const runtime = detectRuntime(
    resolveLocalRuntimeOverride(config.CMT_LOCAL_RUNTIME)
  );
  const presetId = isLocalModelPresetId(config.CMT_LOCAL_MODEL_PRESET)
    ? config.CMT_LOCAL_MODEL_PRESET
    : DEFAULT_LOCAL_PRESET;
  const preset = resolvePreset(presetId);
  const modelLabel = getModelDisplayLabel(preset, runtime);
  const port = config.CMT_LOCAL_DAEMON_PORT ?? DEFAULT_DAEMON_PORT;

  const spin = spinner();
  spin.start(`Starting local server — ${modelLabel}…`);

  const { info } = await startDaemon({
    presetId,
    runtime,
    port,
    contextSize: config.CMT_LOCAL_CONTEXT_SIZE ?? 4096,
    gpuLayers: config.CMT_LOCAL_GPU_LAYERS ?? -1,
    maxTokensOutput: config.CMT_TOKENS_MAX_OUTPUT ?? 512,
    idleTimeoutSeconds: config.CMT_LOCAL_IDLE_TIMEOUT ?? 1800,
    background
  });

  spin.stop(
    `Local daemon running on :${info.port} (${getRuntimeDisplayName(info.runtime)})`
  );

  if (background !== true && info.runtime === 'gguf') {
    outro(
      `${chalk.green('✔')} GGUF daemon listening on http://127.0.0.1:${info.port} — press Ctrl+C to stop`
    );
    await new Promise<void>(() => undefined);
  } else {
    outro(`${chalk.green('✔')} Daemon started (pid ${info.pid})`);
  }
};

const runStatus = async (): Promise<void> => {
  const config = getConfig();
  const runtime = detectRuntime(
    resolveLocalRuntimeOverride(config.CMT_LOCAL_RUNTIME)
  );
  const presetId = isLocalModelPresetId(config.CMT_LOCAL_MODEL_PRESET)
    ? config.CMT_LOCAL_MODEL_PRESET
    : DEFAULT_LOCAL_PRESET;
  const preset = resolvePreset(presetId);
  const port = config.CMT_LOCAL_DAEMON_PORT ?? DEFAULT_DAEMON_PORT;
  const daemon = await isDaemonRunning(port);

  intro('Local LLM status');
  console.log(chalk.cyan('Runtime:'), getRuntimeDisplayName(runtime));
  console.log(chalk.cyan('Preset:'), `${preset.label} (${presetId})`);
  console.log(chalk.cyan('Model:'), getModelDisplayLabel(preset, runtime));
  console.log(
    chalk.cyan('VRAM estimate:'),
    `~${preset.vramEstimateMb} MB (4K context)`
  );
  console.log(
    chalk.cyan('GGUF downloaded:'),
    isGgufModelDownloaded(preset) ? 'yes' : 'no'
  );
  console.log(
    chalk.cyan('Setup marker:'),
    existsSync(LOCAL_SETUP_MARKER) ? 'yes' : 'no — run cmt local setup'
  );

  if (daemon !== undefined) {
    console.log(
      chalk.green('Daemon:'),
      `running (pid ${daemon.pid}, port ${daemon.port}, ${daemon.runtime})`
    );
  } else {
    console.log(
      chalk.yellow('Daemon:'),
      'not running — run cmt local serve for faster commits'
    );
  }

  outro('');
};

const runModelsList = (): void => {
  intro('Available local model presets');
  for (const presetId of LOCAL_MODEL_PRESET_IDS) {
    const preset = LOCAL_MODEL_PRESETS[presetId];
    console.log(
      chalk.bold(presetId),
      `— ${preset.label} (~${preset.vramEstimateMb} MB VRAM)`
    );
    console.log(`  GGUF: ${preset.gguf.repo} (${preset.gguf.diskMb} MB)`);
    console.log(`  MLX:  ${preset.mlx.repo} (${preset.mlx.diskMb} MB)`);
  }
  outro('');
};

const runModelsDownload = async (
  presetArg: string | undefined,
  runtimeArg: string | undefined
): Promise<void> => {
  const config = getConfig();
  const presetId = isLocalModelPresetId(presetArg)
    ? presetArg
    : isLocalModelPresetId(config.CMT_LOCAL_MODEL_PRESET)
      ? config.CMT_LOCAL_MODEL_PRESET
      : DEFAULT_LOCAL_PRESET;
  const runtime =
    runtimeArg === 'mlx' || runtimeArg === 'gguf'
      ? runtimeArg
      : detectRuntime(resolveLocalRuntimeOverride(config.CMT_LOCAL_RUNTIME));
  const preset = resolvePreset(presetId);
  const spin = spinner();
  spin.start(`Downloading ${getModelDisplayLabel(preset, runtime)}…`);
  await downloadModelForRuntime(preset, runtime);
  spin.stop('Download complete');
  outro(`${chalk.green('✔')} Model ready`);
};

const LOCAL_MODES = ['setup', 'serve', 'stop', 'status', 'models'] as const;
type LocalMode = (typeof LOCAL_MODES)[number];

const isLocalMode = (value: string | undefined): value is LocalMode =>
  value !== undefined && LOCAL_MODES.includes(value as LocalMode);

const showLocalHelp = (): void => {
  console.log(chalk.bold.cyan('\nBuilt-in Local LLM:\n'));
  console.log(chalk.gray('  cmt local setup'));
  console.log(chalk.gray('  cmt local serve [--background]'));
  console.log(chalk.gray('  cmt local stop'));
  console.log(chalk.gray('  cmt local status'));
  console.log(chalk.gray('  cmt local models list'));
  console.log(chalk.gray('  cmt local models download [preset]'));
  console.log('');
};

const showModelsHelp = (): void => {
  console.log(chalk.bold.cyan('\nLocal model commands:\n'));
  console.log(chalk.gray('  cmt local models list'));
  console.log(chalk.gray('  cmt local models download [preset] [--runtime mlx|gguf]'));
  console.log('');
};

export const localCommand = command(
  {
    name: 'local',
    parameters: ['[setup/serve/stop/status/models]', '[action]', '[preset]'],
    flags: {
      background: {
        type: Boolean,
        description: 'Start daemon in background',
        default: false
      },
      runtime: {
        type: String,
        description: 'Runtime for download: mlx or gguf'
      }
    },
    help: {
      description:
        'Manage built-in local SLM (setup, serve, stop, status, models)'
    }
  },
  async (argv) => {
    const mode = argv._.setupServeStopStatusModels;
    const action = argv._.action;
    const preset = argv._.preset;

    if (mode === undefined) {
      showLocalHelp();
      return;
    }

    if (isLocalMode(mode) !== true) {
      showLocalHelp();
      throw new Error(`Unknown local command: ${mode}`);
    }

    switch (mode) {
      case 'setup':
        await runSetup();
        return;
      case 'serve':
        await runServe(argv.flags.background === true);
        return;
      case 'stop': {
        const stopped = await stopDaemon();
        outro(
          stopped
            ? `${chalk.green('✔')} Local daemon stopped`
            : `${chalk.yellow('!')} No local daemon was running`
        );
        return;
      }
      case 'status':
        await runStatus();
        return;
      case 'models':
        if (action === undefined) {
          showModelsHelp();
          return;
        }
        if (action === 'list') {
          runModelsList();
          return;
        }
        if (action === 'download') {
          await runModelsDownload(preset, argv.flags.runtime);
          return;
        }
        showModelsHelp();
        throw new Error(`Unknown models command: ${action}`);
      default: {
        const _exhaustive: never = mode;
        throw new Error(`Unhandled local command: ${_exhaustive}`);
      }
    }
  }
);
