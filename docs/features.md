# CommitAI — Current Features (as implemented)

This document summarizes **features that exist in the codebase today** (not aspirations).

> Version reference: `package.json` currently indicates **v1.0.5**.

---

## CLI surface area

CommitAI is a CLI tool named `commit-ai` with alias **`cmt`**.

### Primary command (default)

- `cmt`: Generates a commit message from your staged diff and (optionally) runs `git commit`.
- **Auto-staging flow**:
  - If nothing is staged, CommitAI can:
    - stage all files, or
    - let you pick specific changed files to stage.

### Flags

- `--context`, `-c`: Extra user-provided context that influences the generated message.
- `--yes`, `-y`: Skip commit confirmation prompt.
- `--fgm`: Use the *full* GitMoji specification in prompts (when `CMT_EMOJI=true`).
- `--log <branch>`, `-l <branch>`: Generates a **tester-friendly summary** from the diff vs a branch (defaults to `master` when omitted).

### Subcommands

- `cmt check`
  - Prints a console banner + version and runs an environment check (Git availability, config presence, basic config sanity).
- `cmt config get <KEY...>` / `cmt config set <KEY=VALUE...>`
  - Manages **global** config stored at `~/.commit-ai`.
- `cmt hook set` / `cmt hook unset`
  - Installs/uninstalls a Git `prepare-commit-msg` hook that runs CommitAI automatically.
- `cmt commitlint get` / `cmt commitlint force`
  - Reads or regenerates the local repo’s `@commitlint`-based LLM prompt configuration (see “Prompt modules” below).

---

## Commit message generation

### Input

- CommitAI generates messages from `git diff --staged` for the selected staged files.
- **Default file exclusions** (excluded from `git diff` for prompting):
  - Lock files: `*.lock`, `*-lock.*`
  - Common binary/asset types: `*.svg`, `*.png`, `*.jpg`, `*.jpeg`, `*.webp`, `*.gif`
  - If **all staged files** are excluded, CommitAI **exits cleanly** with a clear message (no stuck UX).

### Ignore file support

- If a `.commit-aiignore` file exists in the repo root, its patterns are used to ignore staged files before prompting.

### Prompt modules

CommitAI supports two “prompt module” modes:

- **`conventional-commit` (default)**: Conventional commit keywords; optional GitMoji instructions.
- **`@commitlint`**:
  - Reads the project’s local `@commitlint` configuration.
  - Generates a repo-specific prompt/consistency config and writes it to a file (it prints the target path when complete).
  - CommitAI will auto-generate this config on-demand if `CMT_PROMPT_MODULE=@commitlint` is set but the file isn’t present.

### Output shaping

- **GitMoji support**: controlled by `CMT_EMOJI` (and `--fgm` for the full list).
- **Optional description**: when `CMT_DESCRIPTION=true`, CommitAI asks the model to add a short “why” description after the title.
- **One-line mode**: when `CMT_ONE_LINE_COMMIT=true`, CommitAI asks the model for a single unified message rather than multi-part output.
- **Message templates**:
  - If you pass a commit arg containing the placeholder (default `$msg`), CommitAI will replace the placeholder with the generated message and then run `git commit ...`.

### Token-aware diff splitting

If the staged diff is too large for the configured input/output budget:

- CommitAI splits/merges diffs into smaller chunks,
- generates messages for each chunk sequentially (avoids parallel overload/timeouts), and
- joins the results.

If a provider call fails with a **timeout-like error**, CommitAI retries by chunking the diff into smaller pieces and combining the results.

---

## Configuration (global + local)

### Where config is read from

- **Local repo**: `.env` in the repo root (if present)
- **Global**: `~/.commit-ai` (INI file)
- **Precedence**: `.env` overrides global config.

### Package manager

- This repository uses **pnpm** and commits `pnpm-lock.yaml`.

### Key configuration options

Common keys:

- `CMT_AI_PROVIDER`: selects the LLM provider/engine.
- `CMT_API_KEY`: API key (required for hosted providers; local providers may not require it depending on setup).
- `CMT_API_URL`: base URL / endpoint override (useful for local servers, proxies, and some providers).
- `CMT_MODEL`: model identifier (provider-specific).
- `CMT_LANGUAGE`: commit message language (see “Internationalization” below).
- `CMT_TOKENS_MAX_INPUT`, `CMT_TOKENS_MAX_OUTPUT`: token budgets used for prompt sizing and diff splitting.
- `CMT_EMOJI`: GitMoji instructions on/off.
- `CMT_DESCRIPTION`: append a short description (“why”) on/off.
- `CMT_ONE_LINE_COMMIT`: one-line commit output on/off.
- `CMT_MESSAGE_TEMPLATE_PLACEHOLDER`: placeholder token used for message templates (default `$msg`).
- `CMT_PROMPT_MODULE`: `conventional-commit` or `@commitlint`.
- `CMT_DEBUG`: prints prompt payloads for debugging.
- `CMT_GITPUSH`: controls whether CommitAI prompts for / runs `git push` after a successful commit (noted in code as “todo: deprecate”).

---

## Supported LLM providers (engines)

CommitAI includes engines for:

- `openai` (default)
- `anthropic`
- `azure`
- `gemini`
- `groq`
- `mistral`
- `deepseek`
- `ollama` (local)
- `mlx` (local)
- `flowise`
- `test` (test/deterministic engine used in the test suite)

> The active engine is selected by `CMT_AI_PROVIDER`; the engine receives `model`, `maxTokensInput`, `maxTokensOutput`, `baseURL`, and `apiKey` from config.

---

## Internationalization (i18n)

CommitAI supports multiple languages for commit output via `CMT_LANGUAGE`, including:

- `en`, `de`, `fr`, `es_ES`, `it`, `nl`, `pt_br`, `sv`, `ru`
- `zh_CN`, `zh_TW`, `ja`, `ko`
- `cs`, `pl`, `tr`, `th`, `id_ID`, `vi_VN`

---

## Git integrations

### Git hook: `prepare-commit-msg`

When enabled (`cmt hook set`), CommitAI can generate a message automatically during `git commit` (including IDE-driven commits), and it writes the generated message into Git’s commit message file.

When the AI call takes a long time, the CLI shows an **elapsed-time heartbeat** so it does not appear frozen.

### GitHub Action (BETA)

The GitHub Action implementation:

- processes push events,
- fetches diffs for commits in the push payload,
- generates improved messages in request chunks (with retries/sleeps), then
- rebases/amends commits non-interactively and **force pushes** the rewritten history.


