# CommitAI — Features Checklist & Roadmap

This is a living checklist of what CommitAI **already supports** and what we may want to build next.

> Update policy: check off items when shipped; don’t delete historical items.

---

## Implemented (checked)

### CLI & UX

- [x] `cmt` default command (generate commit message from staged diff)
- [x] `cmt check` environment/version check command (prints banner + validates toolchain basics)
- [x] Interactive staging when nothing is staged (stage all or choose files)
- [x] `--context` / `-c` additional context support
- [x] `--yes` / `-y` skip commit confirmation
- [x] `--fgm` full GitMoji prompt spec (when emojis are enabled)
- [x] `--log` / `-l` generate a branch-diff-based tester log summary

### Prompting & output shaping

- [x] Conventional commit prompting (default prompt module)
- [x] Optional GitMoji prompting (`CMT_EMOJI`)
- [x] Optional appended description (“why”) (`CMT_DESCRIPTION`)
- [x] One-line commit mode (`CMT_ONE_LINE_COMMIT`)
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

- [ ] Wire up `CMT_WHY` (currently present as a config key) to explicitly control “why” behavior
- [ ] Add deterministic unit tests around prompt text generation for key combinations
- [ ] Add a configurable “max files” or “max diff bytes” guardrail with actionable errors
- [x] Add timeout-safe chunking fallback (split large diffs into smaller chunks and combine results)

### Config & compatibility

- [ ] Align README defaults with code defaults (tokens/models) and keep them in sync
- [ ] Make `CMT_AI_PROVIDER` validation accept all supported engines uniformly when using `cmt config set`
- [ ] Add config command autocompletion / improved help output

### Providers / integrations

- [ ] Add provider-specific docs for required env vars and example model names
- [ ] Add GitHub Action safety rails (opt-in force push, allowlist branches, explicit confirmation)
- [ ] Add support for generating PR descriptions / changelogs from diffs (adjacent capability)


