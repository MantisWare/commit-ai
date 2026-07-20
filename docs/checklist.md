# CommitAI — Features Checklist & Roadmap

This is a living checklist of what CommitAI **already supports** and what we may want to build next.

> Update policy: check off items when shipped; don’t delete historical items.

---

## Implemented (checked)

### CLI & UX

- [x] `cmt` default command (generate commit message from staged diff)
- [x] `cmt check` environment/version check command (prints banner + validates toolchain basics + Quick Start Guide with essential commands incl. full `cmt local` workflow)
- [x] `cmt update` command to check for and install updates (`--check`, `--yes`)
- [x] `CMT_AUTO_UPDATE` config to auto-install updates when running `cmt`
- [x] Refresh console banner to match Commit-AI branding (cyan→purple gradient + "AI-Powered Git Commits" + author attribution)
- [x] Interactive staging when nothing is staged (stage all or choose files)
- [x] `--context` / `-c` additional context support
- [x] `--yes` / `-y` skip commit confirmation
- [x] `--fgm` full GitMoji prompt spec (when emojis are enabled)
- [x] `--log` / `-l` generate a branch-diff-based tester log summary

### Prompting & output shaping

- [x] Conventional commit prompting (default prompt module)
- [x] Optional GitMoji prompting (`CMT_EMOJI`)
- [x] Optional appended description ("why") (`CMT_DESCRIPTION`)
- [x] One-line commit mode (`CMT_ONE_LINE_COMMIT`)
- [x] Single-line Multi-file Log mode (`CMT_SML`) for condensed per-file messages
- [x] Template placeholder substitution (`CMT_MESSAGE_TEMPLATE_PLACEHOLDER`)
- [x] Token-aware diff chunking/splitting for large diffs
- [x] Parallel chunk LLM generation with `CMT_CHUNK_CONCURRENCY` and synthesis pass (`CMT_SYNTHESIZE_CHUNKS`)
- [x] Chunk progress in CLI heartbeat (preparing / generating / synthesizing)
- [x] Enforce `CMT_MAX_FILES` and `CMT_MAX_DIFF_BYTES` guardrails before commit generation
- [x] Auto-split oversized staged changes into multiple commits when `CMT_MAX_FILES` is exceeded (`cmt` CLI)

> **Auto-updated by Cursor:** Added `cmt update` and `CMT_AUTO_UPDATE` on 2026-06-02.

> **Auto-updated by Cursor:** Expanded `cmt check` Quick Start Guide with all `cmt local` subcommands on 2026-06-09.

> **Auto-updated by Cursor:** Batch generation uses per-batch timeouts, in-flight status updates, and rate-limit retry logging on 2026-06-02.

### Config & project setup

- [x] Global config file at `~/.commit-ai`
- [x] Repo-local `.env` support with precedence over global config
- [x] `cmt config get|set` command
- [x] `.commit-aiignore` support for filtering staged files before prompting
- [x] Default diff exclusions for lockfiles and common binary/asset types
- [x] Use pnpm as the package manager (pnpm lockfile + scripts updated)

### Providers / engines

- [x] OpenAI engine (`openai`)
- [x] Anthropic engine (`anthropic`)
- [x] Azure OpenAI engine (`azure`)
- [x] Gemini engine (`gemini`)
- [x] Groq engine (`groq`)
- [x] Mistral engine (`mistral`)
- [x] DeepSeek engine (`deepseek`)
- [x] Ollama engine (`ollama`, local)
- [x] MLX engine (`mlx`, local)
- [x] Flowise engine (`flowise`)
- [x] Test engine (`test`)
- [x] Built-in local SLM provider (`local`, llama.cpp / node-llama-cpp + mlx-lm)
- [x] Dual runtime — GGUF (Win/Linux) + MLX (Apple Silicon)
- [x] `cmt local` commands (setup, serve, stop, status, models)
- [x] Qwen2.5-0.5B default preset (smallest VRAM)
- [x] Gemma 2 2B optional preset
- [x] Animated warmup indicator with model name during local load
- [x] Cloud fallback when local model fails (`CMT_LOCAL_CLOUD_FALLBACK`)
- [x] Install `mlx-lm` into an isolated venv (fixes PEP 668 externally-managed-environment error)
- [x] Fix MLX server spawn hang (return live subprocess handle instead of awaiting the never-exiting process)

> **Auto-updated by Cursor:** Added built-in local SLM provider with dual GGUF/MLX runtime, `cmt local` commands, warmup UX, and cloud fallback on 2026-06-09.
>
> **Auto-updated by Cursor:** `cmt local setup` now installs `mlx-lm` into a dedicated virtual environment (`~/.commit-ai-local/venv`) instead of the system Python, resolving the Homebrew PEP 668 "externally-managed-environment" failure on 2026-07-20.
>
> **Auto-updated by Cursor:** Fixed indefinite hang in the MLX smoke test / daemon startup — `spawnEphemeralMlxServer` and `spawnMlxDaemon` were `async` functions returning the execa subprocess, so awaiting them blocked until the (never-exiting) server process terminated. They now return the live subprocess handle synchronously on 2026-07-20.

### Integrations

- [x] Git `prepare-commit-msg` hook installation (`cmt hook set|unset`)
- [x] `@commitlint` prompt module support (`CMT_PROMPT_MODULE=@commitlint`)
- [x] `cmt commitlint get|force` to manage commitlint LLM prompt config
- [x] GitHub Action (beta) for improving commit messages on push (rebase + force push)

### Internationalization

- [x] Multi-language commit output via `CMT_LANGUAGE`

---

## Planned / future work (includes completed items for history)

### CLI & UX

- [x] Add `--dry-run` to generate output without running `git commit` or `git push`
- [x] Add `--no-push` flag (explicit override) to bypass any push prompts/behavior
- [x] Add `--edit` flow to open the generated message in `$EDITOR` before committing
- [x] Add a non-interactive "stage all + commit" flag (`--stage-all` / `-a`)
- [x] Improve long-running AI busy indicator (elapsed-time heartbeat; avoid spinner lockups)
- [x] Handle “only excluded files staged” cleanly (clear message + no stuck UX)

### Prompting & quality

- [x] Wire up `CMT_WHY` (currently present as a config key) to explicitly control "why" behavior
- [ ] Add deterministic unit tests around prompt text generation for key combinations
- [x] Add a configurable "max files" or "max diff bytes" guardrail with actionable errors
- [x] Add timeout-safe chunking fallback (split large diffs into smaller chunks and combine results)

### Config & compatibility

- [x] Align README defaults with code defaults (tokens/models) and keep them in sync
- [x] Make `CMT_AI_PROVIDER` validation accept all supported engines uniformly when using `cmt config set`
- [x] Add config command autocompletion / improved help output

### Providers / integrations

- [x] Add provider-specific docs for required env vars and example model names
- [x] Add GitHub Action safety rails (opt-in force push, allowlist branches, explicit confirmation)
- [x] Add support for generating PR descriptions / changelogs from diffs (adjacent capability)

### Code Review

- [x] Add `cmt review` command to analyze staged changes with AI-powered code review
- [x] Generate quality assessment report with scoring (e.g., readability, maintainability, security, performance)
- [x] Identify code smells and anti-patterns in the diff
- [x] Detect potential bugs, security vulnerabilities, and edge cases
- [x] Suggest improvements with specific code examples
- [x] Flag violations of configured coding standards with severity levels (error, warning, info)
- [x] Generate review summary with categorized findings (security, performance, style, best practices, bugs, maintainability)
- [x] Support inline review comments mapped to specific lines/files in the diff
- [x] Support `--json` flag for CI/CD integration
- [x] Exit codes based on review recommendation (approve=0, review=0, block=1)
- [x] Interactive prompt to continue/abort commit based on review results
- [x] Add `--review` flag (`-r`) to `cmt` to automatically review before committing
- [x] Support review thresholds (`CMT_REVIEW_MIN_SCORE`) - minimum quality score to proceed with commit
- [x] Support excluding files/patterns from code review via `.commit-ai-review-ignore`
- [x] Implement code standards/rules configuration system (stored in `.commit-ai-standards` file)
- [x] Support custom code standards per project (language-specific, framework-specific, team conventions)
- [x] Add `cmt standards set` command to configure review rules interactively
- [x] Add `cmt standards import` to load standards from 10 popular style guides (React, Angular, Vue, Node.js, Python, Java, Go, Rust, TypeScript, C#)
- [x] Add `cmt standards view` command to display current standards
- [x] Prompt users to configure standards on first review (with option to proceed without)
- [x] Integrate standards into AI review prompt for targeted analysis
- [x] Cache review results to avoid re-analyzing unchanged code
- [x] Implement SHA-256 diff hashing for cache keys
- [x] Add configurable cache TTL (CMT_REVIEW_CACHE_TTL, default 24 hours)
- [x] Add cache disable option (CMT_REVIEW_CACHE_DISABLED)
- [x] Add `cmt review cache-stats` command to view cache statistics
- [x] Add `cmt review clear-cache` command to manually clear cache
- [x] Add `--no-cache` flag to skip cache for fresh review
- [x] Automatic cache expiration and cleanup


