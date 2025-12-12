# CommitAI — Current Features (as implemented)

This document summarizes **features that exist in the codebase today** (not aspirations).

> Version reference: `package.json` currently indicates **v1.0.6**.

---

## CLI surface area

CommitAI is a CLI tool named `commit-ai` with alias **`cmt`**.

### Branding / banner

- CommitAI prints a modern **cyan→purple gradient** ASCII banner (see `src/utils/banner.ts`).
- Banner includes the version and the line **“AI-Powered Git Commits”**.

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
- `--dry-run`: Generate commit message without actually committing.
- `--edit`, `-e`: Open generated message in `$EDITOR` before committing.
- `--no-push`: Skip push prompts and behavior.
- `--stage-all`, `-a`: Non-interactively stage all files and commit.

### Subcommands

- `cmt check`
  - Prints a **gradient Commit-AI console banner** + version and runs an environment check (Git availability, config presence, basic config sanity).
  - Includes a **Quick Start Guide** box showing common commands and usage patterns.
- `cmt config get <KEY...>` / `cmt config set <KEY=VALUE...>`
  - Manages **global** config stored at `~/.commit-ai`.
- `cmt config help`
  - Displays comprehensive help for all configuration options with descriptions, examples, and defaults.
- `cmt hook set` / `cmt hook unset`
  - Installs/uninstalls a Git `prepare-commit-msg` hook that runs CommitAI automatically.
- `cmt commitlint get` / `cmt commitlint force`
  - Reads or regenerates the local repo's `@commitlint`-based LLM prompt configuration (see "Prompt modules" below).
- `cmt pr [base-branch]`
  - Generates a comprehensive pull request description comparing the current branch with a base branch (defaults to main/master).
  - Supports `--output` flag to save to a file.
- `cmt changelog <version> [from-ref] [to-ref]`
  - Generates a changelog entry following the Keep a Changelog format.
  - Supports `--output` (default: CHANGELOG.md) and `--append` flags.

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
- **Optional description**: when `CMT_DESCRIPTION=true`, CommitAI asks the model to add a short description after the title.
  - **Description focus**: when `CMT_WHY=true` (requires `CMT_DESCRIPTION=true`), the description focuses on WHY changes were made (reasoning, motivation, context) rather than WHAT the changes do.
- **One-line mode**: when `CMT_ONE_LINE_COMMIT=true`, CommitAI asks the model for a single unified message rather than multi-part output.
- **Message templates**:
  - If you pass a commit arg containing the placeholder (default `$msg`), CommitAI will replace the placeholder with the generated message and then run `git commit ...`.

### Token-aware diff splitting

If the staged diff is too large for the configured input/output budget:

- CommitAI splits/merges diffs into smaller chunks,
- generates messages for each chunk sequentially (avoids parallel overload/timeouts), and
- joins the results.

If a provider call fails with a **timeout-like error**, CommitAI retries by chunking the diff into smaller pieces and combining the results.

### Commit size guardrails

CommitAI can enforce limits to prevent overly large commits:

- **Maximum files**: When `CMT_MAX_FILES` is set, CommitAI rejects commits with more staged files than the limit.
- **Maximum diff size**: When `CMT_MAX_DIFF_BYTES` is set, CommitAI rejects commits when the diff exceeds the byte limit.
- Both guardrails provide clear error messages with actionable suggestions (split commits, unstage files, or adjust limits).

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
- `CMT_TOKENS_MAX_INPUT`, `CMT_TOKENS_MAX_OUTPUT`: token budgets used for prompt sizing and diff splitting (optional, provider/model specific).
- `CMT_EMOJI`: GitMoji instructions on/off.
- `CMT_DESCRIPTION`: append a short description on/off.
- `CMT_WHY`: when enabled with `CMT_DESCRIPTION=true`, focuses description on WHY changes were made rather than WHAT they do.
- `CMT_ONE_LINE_COMMIT`: one-line commit output on/off.
- `CMT_MESSAGE_TEMPLATE_PLACEHOLDER`: placeholder token used for message templates (default `$msg`).
- `CMT_PROMPT_MODULE`: `conventional-commit` or `@commitlint`.
- `CMT_MAX_FILES`: maximum number of files allowed in a single commit (optional guardrail).
- `CMT_MAX_DIFF_BYTES`: maximum diff size in bytes (optional guardrail).
- `CMT_DEBUG`: prints prompt payloads for debugging.
- `CMT_GITPUSH`: controls whether CommitAI prompts for / runs `git push` after a successful commit (noted in code as "todo: deprecate").

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
- rebases/amends commits non-interactively and optionally **force pushes** the rewritten history.

**Safety Rails:**
- `enable_force_push`: Must be explicitly set to `true` to enable force pushing (default: `false`).
- `allowed_branches`: Comma-separated list of branches to allow (default: all branches).
- `require_confirmation`: Issues warnings when force pushing to protected branches (default: `true`).
- Protected branches (main, master, production, prod) require explicit opt-in for force pushing.


