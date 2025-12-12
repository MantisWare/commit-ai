import { build } from 'esbuild';
import fs from 'fs';

const punycodeSuppressionBanner = `
// Suppress punycode deprecation warning from transitive dependencies
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, type, code, ...args) {
  if (code === 'DEP0040') {
    return;
  }
  return originalEmitWarning.call(this, warning, type, code, ...args);
};
`;

await build({
  entryPoints: ['./src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './out/cli.cjs',
  banner: {
    js: punycodeSuppressionBanner
  }
});

await build({
  entryPoints: ['./src/github-action.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './out/github-action.cjs',
  banner: {
    js: punycodeSuppressionBanner
  }
});

const wasmFile = fs.readFileSync(
  './node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm'
);

fs.writeFileSync('./out/tiktoken_bg.wasm', wasmFile);
