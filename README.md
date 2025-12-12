<div align="center">
  <div>
    <img src=".github/commitAi.png" alt="CommitAI logo"/>
    <h1 align="center">CommitAI</h1>
    <h4 align="center">Author <a href="https://waldomarais.com">Waldo Marais</a>
  </div>
	<h2>Create amazing commits in just seconds</h2>
	<p>Say farewell to boring commits with AI! 🤯�</p>
	<a href="https://www.npmjs.com/package/commit-ai"><img src="https://img.shields.io/npm/v/@mantisware/commit-ai" alt="Current version"></a>
</div>

---

## Install CommitAI as a CLI Tool

CommitAI lets you automate meaningful commit messages effortlessly using the CLI with `cmt`. In just two seconds, your staged changes are committed with an AI-generated message.

### Installation

1. Install CommitAI globally for use in any repository:
   
   ```sh
   pnpm add -g @mantisware/commit-ai
   ```

2. Obtain an API key from [OpenAI](https://platform.openai.com/account/api-keys) or another supported LLM provider. Ensure your OpenAI account has an active payment method for API access.

3. Configure CommitAI with your API key:
   
   ```sh
   cmt config set CMT_API_KEY=<your_api_key>
   ```

   The API key is stored securely in `~/.commit-ai`.

## Usage

To generate a commit message for staged changes, run:

```sh
git add <files...>
cmt
```

Running `git add` is optional—`cmt` will automatically stage changes for you.

### Running Locally with Ollama

You can also run CommitAI with a local model through Ollama:

- Install and start Ollama.
- Execute `ollama run mistral` (only once, to pull the model).
- In your project directory, configure CommitAI:

```sh
git add <files...>
cmt config set CMT_AI_PROVIDER='ollama' CMT_MODEL='llama3:8b'
```

By default, the model used is `mistral`.

If Ollama runs on another machine or within Docker with GPU support, update the API endpoint:

```sh
cmt config set CMT_API_URL='http://192.168.1.10:11434/api/chat'
```

Replace `192.168.1.10` with the appropriate endpoint.

### Running with DeepSeek Locally with LM Studio

You can also run CommitAI with a local model through LM Studio:

- Install and start LM Studio.
- Add the DeepSeekCoder model to your project. current: `deepseek-coder-v2-lite-instruct` or for macos `deepseek-coder-v2-lite-instruct-mlx`
- In your `~/.commit-ai` configure CommitAI:

```sh
cmt config set CMT_MODEL='deepseek-coder-v2-lite-instruct-mlx' CMT_API_URL='http://127.0.0.1:1234' CMT_AI_PROVIDER='deepseek'
```

Replace `http://127.0.0.1:1234` with the appropriate endpoint provided by LM Studio.


## Configuration Options

### Local Repository Configuration

Add CommitAI configurations to a `.env` file in your repository:

```env
CMT_AI_PROVIDER=<openai (default), anthropic, azure, ollama, gemini, flowise, mlx, deepseek>
CMT_API_KEY=<your OpenAI API token> # or another LLM provider API key
CMT_API_URL=<optional proxy path to OpenAI API>
CMT_TOKENS_MAX_INPUT=40960  # Maximum input tokens (optional, provider/model specific)
CMT_TOKENS_MAX_OUTPUT=4096  # Maximum output tokens (optional, provider/model specific)
CMT_DESCRIPTION=false  # Append a brief description of changes (default: false)
CMT_EMOJI=false  # Enable GitMoji support (default: false)
CMT_MODEL='gpt-4o-mini'  # AI model (default: 'gpt-4o-mini' for openai)
CMT_LANGUAGE='en'  # Language preference (default: 'en')
CMT_MESSAGE_TEMPLATE_PLACEHOLDER='$msg'  # Message template placeholder
CMT_PROMPT_MODULE='conventional-commit'  # Use 'conventional-commit' or '@commitlint'
CMT_ONE_LINE_COMMIT=false  # Single-line commit messages
CMT_WHY=false  # Focus description on WHY changes were made (vs WHAT changes are)
CMT_SML=false  # Generate condensed single-line messages per file with filename, line numbers, and brief description
CMT_DEBUG=false  # Enable debug logging for troubleshooting
CMT_MAX_FILES=50  # Maximum number of files allowed in a single commit (optional)
CMT_MAX_DIFF_BYTES=102400  # Maximum diff size in bytes (100 KB, optional)
```

### Global Configuration

Global settings are stored in `~/.commit-ai` and configured with:

```sh
cmt config set CMT_MODEL=gpt-4o
```

Local settings take precedence over global configurations.

### Enable Full GitMoji Support

By default, CommitAI limits GitMoji to 10 emojis (🐛✨📝🚀✅♻️⬆️🔧🌐💡) to optimize API usage. To enable full GitMoji support:

```sh
cmt --fgm
```

Ensure `CMT_EMOJI` is set to `true`.

### Skip Commit Confirmation

To commit changes without requiring manual confirmation:

```sh
cmt --yes
```

### Advanced CLI Options

**Dry Run Mode** - Generate commit message without actually committing:
```sh
cmt --dry-run
```

**Edit Before Committing** - Open generated message in your `$EDITOR` before committing:
```sh
cmt --edit  # or -e
```

**Skip Push Prompts** - Commit without being prompted to push:
```sh
cmt --no-push
```

**Stage All & Commit** - Non-interactively stage all files and commit:
```sh
cmt --stage-all  # or -a
```

These flags can be combined:
```sh
cmt --stage-all --edit --no-push
```

### Single-line Multi-file Log (SML Mode)

For large commits where you want a quick overview, enable SML mode to generate condensed per-file messages:

```sh
cmt config set CMT_SML=true
```

**Example output format:**
```
src/commands/config.ts:L29-L32 - Added CMT_SML configuration option
src/prompts.ts:L122-L125 - Implemented SML instruction generator
README.md:L105 - Documented SML feature
```

Each line shows:
- **Filename** with relative path
- **Line numbers** or ranges where changes occurred
- **Brief description** of what changed

This is particularly useful for:
- Code reviews of large changesets
- Quick scanning of multi-file commits
- Understanding the scope of changes at a glance

### Commit Size Guardrails

Prevent accidentally committing too many files or too much code at once by setting limits:

**Limit Maximum Files** - Reject commits with more than N files:
```sh
cmt config set CMT_MAX_FILES=50
```

**Limit Maximum Diff Size** - Reject commits when diff exceeds N bytes:
```sh
cmt config set CMT_MAX_DIFF_BYTES=102400  # 100 KB
```

When a limit is exceeded, CommitAI will display a clear error with actionable suggestions:
- Split changes into smaller, focused commits
- Unstage some files
- Adjust the configured limits

These guardrails help maintain code review quality and encourage atomic commits.

## Generate PR Descriptions & Changelogs

CommitAI can generate pull request descriptions and changelogs from your git diffs.

### PR Description Generation

Generate a comprehensive PR description comparing your current branch with a base branch:

```sh
# Compare with default base branch (main/master)
cmt pr

# Compare with specific branch
cmt pr develop

# Save to file
cmt pr develop --output pr-description.md
```

**Generated PR descriptions include:**
- Concise title (max 72 characters)
- Summary of changes
- Categorized changes (Features, Bug Fixes, Refactoring, etc.)
- Technical details and implementation notes
- Testing notes
- Breaking changes (if applicable)

The output is formatted in markdown and ready to paste into GitHub/GitLab/Bitbucket.

### Changelog Generation

Generate changelog entries following the [Keep a Changelog](https://keepachangelog.com/) format:

```sh
# Generate changelog for version (compare base branch to HEAD)
cmt changelog v1.2.0

# Specify from and to refs
cmt changelog v1.2.0 v1.1.0 HEAD

# Save to CHANGELOG.md (default)
cmt changelog v1.2.0 --output CHANGELOG.md

# Append to existing changelog
cmt changelog v1.2.0 --append
```

**Generated changelogs include:**
- Version number and date
- Changes grouped by type (Added, Changed, Fixed, Deprecated, Removed, Security)
- Present tense, imperative mood
- Specific, actionable descriptions

### Example Workflow

```sh
# 1. Create feature branch and make changes
git checkout -b feature/new-dashboard

# ... make changes ...

# 2. Generate commit messages as you work
git add <files>
cmt

# 3. When ready for PR, generate description
cmt pr main --output pr-description.md

# 4. Create PR with generated description
gh pr create --title "Add new dashboard" --body-file pr-description.md

# 5. When releasing, generate changelog
cmt changelog v2.0.0 v1.9.0 HEAD
```

## Provider-Specific Configuration

CommitAI supports multiple AI providers. Below are detailed setup instructions for each provider.

### OpenAI (Default)

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=openai
CMT_API_KEY=sk-...  # Get from https://platform.openai.com/api-keys
```

**Recommended Models:**
- `gpt-4o-mini` (default, fastest, cost-effective)
- `gpt-4o` (most capable)
- `gpt-3.5-turbo` (budget option)

**Token Limits:** Configure based on your chosen model (see [OpenAI pricing](https://openai.com/pricing))

---

### Anthropic Claude

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=anthropic
CMT_API_KEY=sk-ant-...  # Get from https://console.anthropic.com/
CMT_MODEL=claude-3-5-sonnet-20240620
```

**Available Models:**
- `claude-3-5-sonnet-20240620` (recommended, balanced performance)
- `claude-3-opus-20240229` (most capable)
- `claude-3-haiku-20240307` (fastest, budget-friendly)

**Token Limits:** Claude models support 200K tokens input by default

---

### Google Gemini

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=gemini
CMT_API_KEY=AIza...  # Get from https://makersuite.google.com/app/apikey
CMT_MODEL=gemini-1.5-flash
```

**Available Models:**
- `gemini-1.5-flash` (recommended, fast and cost-effective)
- `gemini-1.5-pro` (most capable)
- `gemini-1.0-pro` (stable)

**Token Limits:** Gemini 1.5 models support up to 1M tokens input

---

### Azure OpenAI

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=azure
CMT_API_KEY=your-azure-key
CMT_API_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-02-15-preview
CMT_MODEL=your-deployment-name
```

**Setup:** Requires an Azure OpenAI service deployment. See [Azure OpenAI docs](https://learn.microsoft.com/en-us/azure/ai-services/openai/)

---

### Groq

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=groq
CMT_API_KEY=gsk_...  # Get from https://console.groq.com/keys
CMT_MODEL=llama3-70b-8192
```

**Available Models:**
- `llama3-70b-8192` (recommended, no daily token limit)
- `llama-3.1-70b-versatile` (latest)
- `llama3-8b-8192` (fastest)
- `gemma2-9b-it` (Google's Gemma)

**Note:** Groq provides extremely fast inference with generous rate limits

---

### Mistral AI

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=mistral
CMT_API_KEY=...  # Get from https://console.mistral.ai/
CMT_MODEL=ministral-8b-latest
```

**Recommended Models:**
- `ministral-8b-latest` (fast, cost-effective)
- `mistral-large-latest` (most capable)
- `codestral-latest` (optimized for code)

---

### DeepSeek

**Required Environment Variables:**
```env
CMT_AI_PROVIDER=deepseek
CMT_API_KEY=...  # Get from https://platform.deepseek.com/
CMT_MODEL=deepseek-chat
```

**Available Models:**
- `deepseek-chat` (general purpose)
- `deepseek-coder` (optimized for code)
- `deepseek-reasoner` (enhanced reasoning)

---

### Ollama (Local)

**Setup:**
1. Install Ollama from https://ollama.ai/
2. Pull a model: `ollama pull llama3:8b`
3. Configure CommitAI:

```env
CMT_AI_PROVIDER=ollama
CMT_MODEL=llama3:8b
CMT_API_URL=http://localhost:11434/api/chat  # Optional, default
```

**Popular Models:**
- `llama3:8b` (recommended, fast)
- `mistral` (balanced)
- `codellama:7b` (code-focused)

**Remote Ollama:** Set `CMT_API_URL` to your remote Ollama endpoint

---

### MLX (Apple Silicon Local)

**Setup:**
1. Install MLX LM from https://github.com/ml-explore/mlx-examples
2. Start the server
3. Configure CommitAI:

```env
CMT_AI_PROVIDER=mlx
CMT_API_URL=http://localhost:8080
CMT_MODEL=your-mlx-model
```

**Note:** Optimized for Apple Silicon (M1/M2/M3)

---

### Flowise

**Setup:**
For custom Flowise deployments:

```env
CMT_AI_PROVIDER=flowise
CMT_API_URL=http://localhost:3000/api/v1/prediction/your-chatflow-id
CMT_API_KEY=your-flowise-api-key  # If authentication enabled
```

---

### Test Provider

For development and testing:

```env
CMT_AI_PROVIDER=test
CMT_TEST_MOCK_TYPE=commit-message  # or 'commit-message-description'
```

**Note:** Returns mock responses without calling any AI API

## Ignore Files from AI Processing

Prevent CommitAI from processing certain files by creating a `.commit-aiignore` file:

```ignorelang
path/to/large-asset.zip
**/*.jpg
```

By default, CommitAI ignores files like `*-lock.*` and `*.lock`.

## Set Up CommitAI as a Git Hook

CommitAI can integrate as a Git `prepare-commit-msg` hook for seamless commit message generation within your IDE.

To enable:

```sh
cmt hook set
```

To disable:

```sh
cmt hook unset
```

To use the hook:

```sh
git add <files...>
git commit
```

## Use CommitAI in GitHub Actions (BETA) 🔥

CommitAI can enhance commit messages automatically when pushing to a remote repository.

### Safety Rails

The GitHub Action includes safety rails to prevent accidental force pushes to protected branches:

- **`enable_force_push`**: Must be explicitly set to `true` to enable force pushing (default: `false`)
- **`allowed_branches`**: Comma-separated list of branches to allow (default: all branches)
- **`require_confirmation`**: Issues warnings when force pushing to protected branches (default: `true`)

Protected branches (main, master, production, prod) require explicit opt-in for force pushing.

### Basic Setup (Safe Mode - No Force Push)

Create `.github/workflows/commit-ai.yml`:

```yml
name: 'CommitAI Action'

on:
  push:
    branches: [develop, feature/*]  # Only run on non-protected branches

jobs:
  commit-ai:
    runs-on: ubuntu-latest
    permissions: write-all
    steps:
      - name: Set Up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - uses: actions/checkout@v3
      - uses: MantisWare/commit-ai@github-action-v1.0.4
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # enable_force_push: false (default - rebases locally but doesn't push)
          allowed_branches: 'develop,feature/*'
        env:
          CMT_API_KEY: ${{ secrets.CMT_API_KEY }}
          CMT_MODEL: gpt-4o-mini
          CMT_LANGUAGE: en
```

### Advanced Setup (With Force Push)

**⚠️ WARNING:** Force pushing rewrites Git history. Only use on non-protected branches or with team agreement.

```yml
name: 'CommitAI Action'

on:
  push:
    branches: [develop]  # Specific branch only

jobs:
  commit-ai:
    runs-on: ubuntu-latest
    permissions: write-all
    steps:
      - name: Set Up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - uses: actions/checkout@v3
      - uses: MantisWare/commit-ai@github-action-v1.0.4
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          enable_force_push: true  # Explicitly enable force push
          allowed_branches: 'develop'  # Only allow on develop branch
          require_confirmation: true  # Warn on protected branches
        env:
          CMT_API_KEY: ${{ secrets.CMT_API_KEY }}
          CMT_MODEL: gpt-4o-mini
          CMT_LANGUAGE: en
```

**Important:** Ensure the OpenAI API key is stored as a GitHub secret (`CMT_API_KEY`).

## Payment Information

CommitAI uses OpenAI API, and you are responsible for associated costs. 
By default, it uses `gpt-3.5-turbo`, which should not exceed **$0.10 per workday**. Upgrading to `gpt-4o` improves quality but increases cost.
