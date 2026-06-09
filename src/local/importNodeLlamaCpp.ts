// Dynamic import path is split so esbuild does not try to bundle node-llama-cpp
// (optional dependency, resolved at runtime when GGUF runtime is used).
export const importNodeLlamaCpp = async (): Promise<typeof import('node-llama-cpp')> => {
  const moduleName = ['node-llama', 'cpp'].join('-');
  return import(moduleName);
};
