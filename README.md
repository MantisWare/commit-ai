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
   npm install -g @mantisware/commit-ai
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
CMT_TOKENS_MAX_INPUT=4096  # Maximum input tokens (default: 4096)
CMT_TOKENS_MAX_OUTPUT=500  # Maximum output tokens (default: 500)
CMT_DESCRIPTION=true  # Append a brief description of changes
CMT_EMOJI=true  # Enable GitMoji support
CMT_MODEL='gpt-4o'  # Set AI model (e.g., 'gpt-4o', 'gpt-3.5-turbo')
CMT_LANGUAGE='en'  # Language preference
CMT_MESSAGE_TEMPLATE_PLACEHOLDER='$msg'  # Message template placeholder
CMT_PROMPT_MODULE='conventional-commit'  # Use 'conventional-commit' or '@commitlint'
CMT_ONE_LINE_COMMIT=false  # Single-line commit messages
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

1. Create `.github/workflows/commit-ai.yml` with:

```yml
name: 'CommitAI Action'

on:
  push:
    branches-ignore: [main, master, dev, development, release]

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
        env:
          CMT_API_KEY: ${{ secrets.CMT_API_KEY }}
          CMT_MODEL: gpt-4o
          CMT_LANGUAGE: en
```

Ensure the OpenAI API key is stored as a GitHub secret (`CMT_API_KEY`).

## Payment Information

CommitAI uses OpenAI API, and you are responsible for associated costs. 
By default, it uses `gpt-3.5-turbo`, which should not exceed **$0.10 per workday**. Upgrading to `gpt-4o` improves quality but increases cost.
