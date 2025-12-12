# CommitAI — Features Checklist & Roadmap

This is a living checklist of what CommitAI **already supports** and what we may want to build next.

> Update policy: check off items when shipped; don’t delete historical items.

---

## Implemented (checked)

### CLI & UX

- [x] `cmt` default command (generate commit message from staged diff)
- [x] `cmt check` environment/version check command (prints banner + validates toolchain basics + Quick Start Guide with 10 essential commands)
- [x] Refresh console banner to match Commit-AI branding (cyan→purple gradient + “AI-Powered Git Commits”)
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

- [ ] Add `cmt review` command to analyze staged changes with AI-powered code review
- [ ] Implement code standards/rules configuration system (stored in global config or `.commit-ai-standards` file)
- [ ] Support custom code standards per project (language-specific, framework-specific, team conventions)
- [ ] Generate quality assessment report with scoring (e.g., readability, maintainability, security, performance)
- [ ] Identify code smells and anti-patterns in the diff
- [ ] Detect potential bugs, security vulnerabilities, and edge cases
- [ ] Suggest improvements with specific code examples
- [ ] Flag violations of configured coding standards with severity levels (error, warning, info)
- [ ] Interactive prompt to continue/abort commit based on review results
- [ ] Add `--review` flag to `cmt` to automatically review before committing
- [ ] Support review thresholds (e.g., minimum quality score to proceed with commit)
- [ ] Add `--review-only` flag to run review without generating commit message
- [ ] Generate review summary with categorized findings (security, performance, style, best practices)
- [ ] Support inline review comments mapped to specific lines in the diff
- [ ] Add `cmt standards set` command to configure review rules interactively
- [ ] Add `cmt standards import` to load standards from popular style guides (Airbnb, Google, etc.)
- [ ] Cache review results to avoid re-analyzing unchanged code
- [ ] Support excluding files/patterns from code review via `.commit-ai-review-ignore`


