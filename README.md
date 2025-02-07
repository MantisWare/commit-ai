<div align="center">
  <div>
    <img src=".github/commitAi.png" alt="CommitAI logo"/>
    <h1 align="center">CommitAI</h1>
    <h4 align="center">Author <a href="https://waldomarais.com">Waldo Marais</a>
  </div>
	<h2>Create amazing commits in just seconds</h2>
	<p>Say farewell to boring commits with AI! 🤯�</p>
	<a href="https://www.npmjs.com/package/commit-ai"><img src="https://img.shields.io/npm/v/commit-ai" alt="Current version"></a>
</div>

---

## Setup CommitAI as a CLI tool

You can use CommitAI by simply running it via the CLI like this `cmt`. 2 seconds and your staged changes are committed with a meaningful message.

1. Install CommitAI globally to use in any repository:

   ```sh
   npm install -g @mantisware/commit-ai
   ```

2. Get your API key from [OpenAI](https://platform.openai.com/account/api-keys) or other supported LLM providers (we support them all). Make sure that you add your OpenAI payment details to your account, so the API works.

3. Set the key to CommitAI config:

   ```sh
   cmt config set CMT_API_KEY=<your_api_key>
   ```

   Your API key is stored locally in the `~/.commit-ai` config file.

## Usage

You can call CommitAI with `cmt` command to generate a commit message for your staged changes:

```sh
git add <files...>
cmt
```

Running `git add` is optional, `cmt` will do it for you.

### Running locally with Ollama

You can also run it with local model through ollama:

- install and start ollama
- run `ollama run mistral` (do this only once, to pull model)
- run (in your project directory):

```sh
git add <files...>
cmt config set CMT_AI_PROVIDER='ollama' CMT_MODEL='llama3:8b'
```

Default model is `mistral`.

If you have ollama that is set up in docker/ on another machine with GPUs (not locally), you can change the default endpoint url.

You can do so by setting the `CMT_API_URL` environment variable as follows:

```sh
cmt config set CMT_API_URL='http://192.168.1.10:11434/api/chat'
```

where 192.168.1.10 is example of endpoint URL, where you have ollama set up.

### Flags

There are multiple optional flags that can be used with the `cmt` command:

#### Use Full GitMoji Specification

Link to the GitMoji specification: https://gitmoji.dev/

This flag can only be used if the `CMT_EMOJI` configuration item is set to `true`. This flag allows users to use all emojis in the GitMoji specification, By default, the GitMoji full specification is set to `false`, which only includes 10 emojis (🐛✨📝🚀✅♻️⬆️🔧🌐💡).

This is due to limit the number of tokens sent in each request. However, if you would like to use the full GitMoji specification, you can use the `--fgm` flag.

```
cmt --fgm
```

#### Skip Commit Confirmation

This flag allows users to automatically commit the changes without having to manually confirm the commit message. This is useful for users who want to streamline the commit process and avoid additional steps. To use this flag, you can run the following command:

```
cmt --yes
```

## Configuration

### Local per repo configuration

Create a `.env` file and add CommitAI config variables there like this:

```env
...
CMT_AI_PROVIDER=<openai (default), anthropic, azure, ollama, gemini, flowise, mlx, deepseek>
CMT_API_KEY=<your OpenAI API token> // or other LLM provider API token
CMT_API_URL=<may be used to set proxy path to OpenAI api>
CMT_TOKENS_MAX_INPUT=<max model token limit (default: 4096)>
CMT_TOKENS_MAX_OUTPUT=<max response tokens (default: 500)>
CMT_DESCRIPTION=<postface a message with ~3 sentences description of the changes>
CMT_EMOJI=<boolean, add GitMoji>
CMT_MODEL=<either 'gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo' (default), 'gpt-3.5-turbo-0125', 'gpt-4-1106-preview', 'gpt-4-turbo-preview' or 'gpt-4-0125-preview' or any Anthropic or Ollama model or any string basically, but it should be a valid model name>
CMT_LANGUAGE=<locale, scroll to the bottom to see options>
CMT_MESSAGE_TEMPLATE_PLACEHOLDER=<message template placeholder, default: '$msg'>
CMT_PROMPT_MODULE=<either conventional-commit or @commitlint, default: conventional-commit>
CMT_ONE_LINE_COMMIT=<one line commit message, default: false>
```

Global configs are same as local configs, but they are stored in the global `~/.commit-ai` config file and set with `cmt config set` command, e.g. `cmt config set CMT_MODEL=gpt-4o`.

### Global config for all repos

Local config still has more priority than Global config, but you may set `CMT_MODEL` and `CMT_LOCALE` globally and set local configs for `CMT_EMOJI` and `CMT_DESCRIPTION` per repo which is more convenient.

Simply set any of the variables above like this:

```sh
cmt config set CMT_MODEL=gpt-4o-mini
```

Configure [GitMoji](https://gitmoji.dev/) to preface a message.

```sh
cmt config set CMT_EMOJI=true
```

To remove preface emojis:

```sh
cmt config set CMT_EMOJI=false
```

Other config options are behaving the same.

### Output WHY the changes were done (WIP)

You can set the `CMT_WHY` config to `true` to have CommitAI output a short description of WHY the changes were done after the commit message. Default is `false`.

To make this perform accurate we must store 'what files do' in some kind of an index or embedding and perform a lookup (kinda RAG) for the accurate git commit message.

```sh
cmt config set CMT_WHY=true
```

### Switch to GPT-4 or other models

By default, CommitAI uses `gpt-4o-mini` model.

You may switch to gpt-4o which performs better, but costs more 🤠

```sh
cmt config set CMT_MODEL=gpt-4o
```

or for as a cheaper option:

```sh
cmt config set CMT_MODEL=gpt-3.5-turbo
```

### Switch to other LLM providers with a custom URL

By default CommitAI uses [OpenAI](https://openai.com).

You could switch to [Azure OpenAI Service](https://learn.microsoft.com/azure/cognitive-services/openai/) or Flowise or Ollama.

```sh
cmt config set CMT_AI_PROVIDER=azure CMT_API_KEY=<your_azure_api_key> CMT_API_URL=<your_azure_endpoint>

cmt config set CMT_AI_PROVIDER=flowise CMT_API_KEY=<your_flowise_api_key> CMT_API_URL=<your_flowise_endpoint>

cmt config set CMT_AI_PROVIDER=ollama CMT_API_KEY=<your_ollama_api_key> CMT_API_URL=<your_ollama_endpoint>
```

### Locale configuration

To globally specify the language used to generate commit messages:

```sh
# de, German, Deutsch
cmt config set CMT_LANGUAGE=de
cmt config set CMT_LANGUAGE=German
cmt config set CMT_LANGUAGE=Deutsch

# fr, French, française
cmt config set CMT_LANGUAGE=fr
cmt config set CMT_LANGUAGE=French
cmt config set CMT_LANGUAGE=française
```

The default language setting is **English**
All available languages are currently listed in the [i18n](https://github.com/MantisWare/commit-ai/tree/master/src/i18n) folder

### Push to git (gonna be deprecated)

A prompt for pushing to git is on by default but if you would like to turn it off just use:

```sh
cmt config set CMT_GITPUSH=false
```

and it will exit right after commit is confirmed without asking if you would like to push to remote.

### Switch to `@commitlint`

CommitAI allows you to choose the prompt module used to generate commit messages. By default, CommitAI uses its conventional-commit message generator. However, you can switch to using the `@commitlint` prompt module if you prefer. This option lets you generate commit messages in respect with the local config.

You can set this option by running the following command:

```sh
cmt config set CMT_PROMPT_MODULE=<module>
```

Replace `<module>` with either `conventional-commit` or `@commitlint`.

#### Example:

To switch to using the `'@commitlint` prompt module, run:

```sh
cmt config set CMT_PROMPT_MODULE=@commitlint
```

To switch back to the default conventional-commit message generator, run:

```sh
cmt config set CMT_PROMPT_MODULE=conventional-commit
```

#### Integrating with `@commitlint`

The integration between `@commitlint` and CommitAI is done automatically the first time CommitAI is run with `CMT_PROMPT_MODULE` set to `@commitlint`. However, if you need to force set or reset the configuration for `@commitlint`, you can run the following command:

```sh
cmt commitlint force
```

To view the generated configuration for `@commitlint`, you can use this command:

```sh
cmt commitlint get
```

This allows you to ensure that the configuration is set up as desired.

Additionally, the integration creates a file named `.commit-ai-commitlint` which contains the prompts used for the local `@commitlint` configuration. You can modify this file to fine-tune the example commit message generated by OpenAI. This gives you the flexibility to make adjustments based on your preferences or project guidelines.

CommitAI generates a file named `.commit-ai-commitlint` in your project directory which contains the prompts used for the local `@commitlint` configuration. You can modify this file to fine-tune the example commit message generated by OpenAI. If the local `@commitlint` configuration changes, this file will be updated the next time CommitAI is run.

This offers you greater control over the generated commit messages, allowing for customization that aligns with your project's conventions.

## Git flags

The `commit-ai` or `cmt` commands can be used in place of the `git commit -m "${generatedMessage}"` command. This means that any regular flags that are used with the `git commit` command will also be applied when using `commit-ai` or `cmt`.

```sh
cmt --no-verify
```

is translated to :

```sh
git commit -m "${generatedMessage}" --no-verify
```

To include a message in the generated message, you can utilize the template function, for instance:

```sh
cmt '#205: $msg’
```

> commit-ai examines placeholders in the parameters, allowing you to append additional information before and after the placeholders, such as the relevant Issue or Pull Request. Similarly, you have the option to customize the CMT_MESSAGE_TEMPLATE_PLACEHOLDER configuration item, for example, simplifying it to $m!"

### Message Template Placeholder Config

#### Overview

The `CMT_MESSAGE_TEMPLATE_PLACEHOLDER` feature in the `commit-ai` tool allows users to embed a custom message within the generated commit message using a template function. This configuration is designed to enhance the flexibility and customizability of commit messages, making it easier for users to include relevant information directly within their commits.

#### Implementation Details

In our codebase, the implementation of this feature can be found in the following segment:

```javascript
commitMessage = messageTemplate.replace(
  config.CMT_MESSAGE_TEMPLATE_PLACEHOLDER,
  commitMessage
);
```

This line is responsible for replacing the placeholder in the `messageTemplate` with the actual `commitMessage`.

#### Usage

For instance, using the command `cmt '$msg #205’`, users can leverage this feature. The provided code represents the backend mechanics of such commands, ensuring that the placeholder is replaced with the appropriate commit message.

#### Committing with the Message

Once users have generated their desired commit message, they can proceed to commit using the generated message. By understanding the feature's full potential and its implementation details, users can confidently use the generated messages for their commits.

### Ignore files

You can remove files from being sent to OpenAI by creating a `.commit-aiignore` file. For example:

```ignorelang
path/to/large-asset.zip
**/*.jpg
```

This helps prevent commit-ai from uploading artifacts and large files.

By default, commit-ai ignores files matching: `*-lock.*` and `*.lock`

## Git hook (KILLER FEATURE)

You can set CommitAI as Git [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. Hook integrates with your IDE Source Control and allows you to edit the message before committing.

To set the hook:

```sh
cmt hook set
```

To unset the hook:

```sh
cmt hook unset
```

To use the hook:

```sh
git add <files...>
git commit
```

Or follow the process of your IDE Source Control feature, when it calls `git commit` command — CommitAI will integrate into the flow.

## Setup CommitAI as a GitHub Action (BETA) 🔥

CommitAI is now available as a GitHub Action which automatically improves all new commits messages when you push to remote!

This is great if you want to make sure all commits in all of your repository branches are meaningful and not lame like `fix1` or `done2`.

Create a file `.github/workflows/commit-ai.yml` with the contents below:

```yml
name: 'CommitAI Action'

on:
  push:
    # this list of branches is often enough,
    # but you may still ignore other public branches
    branches-ignore: [main master dev development release]

jobs:
  commit-ai:
    timeout-minutes: 10
    name: CommitAI
    runs-on: ubuntu-latest
    permissions: write-all
    steps:
      - name: Setup Node.js Environment
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: MantisWare/commit-ai@github-action-v1.0.4
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

        env:
          # set openAI api key in repo actions secrets,
          # for openAI keys go to: https://platform.openai.com/account/api-keys
          # for repo secret go to: <your_repo_url>/settings/secrets/actions
          CMT_API_KEY: ${{ secrets.CMT_API_KEY }}

          # customization
          CMT_TOKENS_MAX_INPUT: 4096
          CMT_TOKENS_MAX_OUTPUT: 512
          CMT_OPENAI_BASE_PATH: ''
          CMT_DESCRIPTION: false
          CMT_EMOJI: false
          CMT_MODEL: gpt-4o
          CMT_LANGUAGE: en
          CMT_PROMPT_MODULE: conventional-commit
```

That is it. Now when you push to any branch in your repo — all NEW commits are being improved by your never-tired AI.

Make sure you exclude public collaboration branches (`main`, `dev`, `etc`) in `branches-ignore`, so CommitAI does not rebase commits there while improving the messages.

Interactive rebase (`rebase -i`) changes commits' SHA, so the commit history in remote becomes different from your local branch history. This is okay if you work on the branch alone, but may be inconvenient for other collaborators.

## Payments

You pay for your requests to OpenAI API on your own.

CommitAI stores your key locally.

CommitAI by default uses 3.5-turbo model, it should not exceed $0.10 per casual working day.

You may switch to gpt-4, it's better, but more expensive.
