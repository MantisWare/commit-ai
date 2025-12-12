import { note } from '@clack/prompts';
import { OpenAI } from 'openai';
import { getConfig } from './commands/config';
import { i18n, I18nLocals } from './i18n';
import { configureCommitlintIntegration } from './modules/commitlint/config';
import { commitlintPrompts } from './modules/commitlint/prompts';
import { ConsistencyPrompt } from './modules/commitlint/types';
import * as utils from './modules/commitlint/utils';
import { removeConventionalCommitWord } from './utils/removeConventionalCommitWord';

const config = getConfig();
const translation = i18n[(config.CMT_LANGUAGE as I18nLocals) || 'en'];

export const IDENTITY =
  'You are tasked with crafting commit messages for Git as an author.';

const GITMOJI_HELP = `Start each commit with a GitMoji to indicate its purpose. Below are some examples to help you select the right emoji (emoji, meaning): 
🐛, Fix an issue; 
✨, Introduce new functionality; 
📝, Create or modify documentation; 
🚀, Deploy updates; 
✅, Implement, update, or pass tests; 
♻️, Refactor existing code; 
⬆️, Update dependencies; 
🔧, Modify configuration files; 
🌐, Handle internationalization or localization; 
💡, Add or improve comments in code;`;

const FULL_GITMOJI_SPEC = `${GITMOJI_HELP}
🎨, Enhance code structure or formatting; 
⚡️, Optimize performance; 
🔥, Remove unnecessary code or files; 
🚑️, Apply a critical fix; 
💄, Modify UI or style assets; 
🎉, Initialize a project; 
🔒️, Resolve security vulnerabilities; 
🔐, Manage or update secrets; 
🔖, Tag releases or versions; 
🚨, Address compiler or linter warnings; 
🚧, Mark ongoing development; 
💚, Fix CI build issues; 
⬇️, Downgrade dependencies; 
📌, Lock dependencies to specific versions; 
👷, Update or configure CI/CD pipelines; 
📈, Add or modify analytics or tracking code; 
➕, Introduce a new dependency; 
➖, Remove an unused dependency; 
🔨, Create or refine development scripts; 
✏️, Correct typos; 
💩, Implement temporary or suboptimal code; 
⏪️, Revert prior changes; 
🔀, Merge branches; 
📦️, Include or update compiled files or packages; 
👽️, Adjust code due to external API changes; 
🚚, Relocate or rename files, paths, or routes; 
📄, Add or update license information; 
💥, Implement breaking changes; 
🍱, Modify or add assets; 
♿️, Improve accessibility features; 
🍻, Code under the influence; 
💬, Modify text content or literals; 
🗃️, Make database-related modifications; 
🔊, Add or modify logging output; 
🔇, Remove log statements; 
👥, Add or update contributors; 
🚸, Enhance user experience or usability; 
🏗️, Modify architecture or system design; 
📱, Improve responsive design; 
🤡, Create mock implementations; 
🥚, Introduce or modify Easter eggs; 
🙈, Modify the .gitignore file; 
📸, Update or add snapshots; 
⚗️, Conduct experiments; 
🔍️, Optimize SEO; 
🏷️, Define or update type definitions; 
🌱, Add or update seed data files; 
🚩, Manage feature flags; 
🥅, Implement error handling; 
💫, Add or improve animations and transitions; 
🗑️, Mark deprecated code for future cleanup; 
🛂, Implement or adjust authorization and permissions; 
🩹, Apply a minor fix for a non-critical issue; 
🧐, Analyze or inspect data; 
⚰️, Remove obsolete or dead code; 
🧪, Introduce a failing test; 
👔, Modify business logic; 
🩺, Implement or update health checks; 
🧱, Make infrastructure-related updates; 
🧑‍💻, Enhance the developer experience; 
💸, Add sponsorships or financial-related infrastructure; 
🧵, Develop or refine multithreading/concurrency features; 
🦺, Improve validation processes.`;

const CONVENTIONAL_COMMIT_KEYWORDS =
  'Do not preface the commit with anything, except for the conventional commit keywords: fix, feat, build, chore, ci, docs, style, refactor, perf, test.';

const getCommitConvention = (fullGitMojiSpec: boolean) => {
  if (!config.CMT_EMOJI) {
    return CONVENTIONAL_COMMIT_KEYWORDS;
  }
  
  return fullGitMojiSpec ? FULL_GITMOJI_SPEC : GITMOJI_HELP;
};

const getDescriptionInstruction = () => {
  if (!config.CMT_DESCRIPTION) {
    return "Don't add any descriptions to the commit, only commit message.";
  }

  if (config.CMT_WHY) {
    return 'Add a short description explaining WHY the changes were made after the commit message. Focus on the reasoning, motivation, and business/technical context behind the changes. Don\'t start with "This commit", just explain the rationale.';
  }

  return 'Add a short description of WHAT the changes do after the commit message. Keep it concise and factual. Don\'t start with "This commit", just describe the changes.';
};

const getOneLineCommitInstruction = () =>
  config.CMT_ONE_LINE_COMMIT
    ? 'Craft a concise commit message that encapsulates all changes made, with an emphasis on the primary updates. If the modifications share a common theme or scope, mention it succinctly; otherwise, leave the scope out to maintain focus. The goal is to provide a clear and unified overview of the changes in a one single message, without diverging into a list of commit per file change.'
    : '';

const getSMLInstruction = () =>
  config.CMT_SML
    ? 'Generate condensed single-line messages per file. For each changed file, output one line with: filename (with relative path), affected line numbers or ranges, and a brief description of what changed. Format: "path/to/file.ext:L123-L145 - Brief description of change". Focus on conciseness while maintaining clarity. List all changed files separately.'
    : '';

/**
 * Get the context of the user input
 * @param extraArgs - The arguments passed to the command line
 * @example
 *  $ cmt -- This is a context used to generate the commit message
 * @returns - The context of the user input
 */
const userInputCodeContext = (context?: string) => {
  if (context && context !== '' && context !== ' ') {
    return `Additional context provided by the user: <context>${context}</context>\nConsider this context when generating the commit message, incorporating relevant information when appropriate.`;
  }
  return '';
};

const INIT_MAIN_PROMPT = (
  language: string,
  fullGitMojiSpec: boolean,
  context?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: 'system',
  content: (() => {
    const commitConvention = fullGitMojiSpec
      ? 'GitMoji specification'
      : 'Conventional Commit Convention';
    const missionStatement = `${IDENTITY} Your mission is to create clean and comprehensive commit messages as per the ${commitConvention} and explain WHAT were the changes and mainly WHY the changes were done.`;
    const diffInstruction =
      "I'll send you an output of 'git diff --staged' command, and you are to convert it into a commit message.";
    const conventionGuidelines = getCommitConvention(fullGitMojiSpec);
    const descriptionGuideline = getDescriptionInstruction();
    const oneLineCommitGuideline = getOneLineCommitInstruction();
    const smlGuideline = getSMLInstruction();
    const generalGuidelines = `Use the present tense. Lines must not be longer than 74 characters. Use ${language} for the commit message.`;
    const userInputContext = userInputCodeContext(context);

    return `${missionStatement}\n${diffInstruction}\n${conventionGuidelines}\n${descriptionGuideline}\n${oneLineCommitGuideline}\n${smlGuideline}\n${generalGuidelines}\n${userInputContext}`;
  })()
});

export const INIT_DIFF_PROMPT: OpenAI.Chat.Completions.ChatCompletionMessageParam =
{
  role: 'user',
  content: `diff --git a/src/server.ts b/src/server.ts
    index ad4db42..f3b18a9 100644
    --- a/src/server.ts
    +++ b/src/server.ts
    @@ -10,7 +10,7 @@
    import {
        initWinstonLogger();
        
        const app = express();
        -const port = 7799;
        +const PORT = 7799;
        
        app.use(express.json());
        
        @@ -34,6 +34,6 @@
        app.use((_, res, next) => {
            // ROUTES
            app.use(PROTECTED_ROUTER_URL, protectedRouter);
            
            -app.listen(port, () => {
                -  console.log(\`Server listening on port \${port}\`);
                +app.listen(process.env.PORT || PORT, () => {
                    +  console.log(\`Server listening on port \${PORT}\`);
                });`
};

const getContent = (translation: ConsistencyPrompt) => {
  const fix = config.CMT_EMOJI
    ? `🐛 ${removeConventionalCommitWord(translation.commitFix)}`
    : translation.commitFix;

  const feat = config.CMT_EMOJI
    ? `✨ ${removeConventionalCommitWord(translation.commitFeat)}`
    : translation.commitFeat;

  const description = config.CMT_DESCRIPTION
    ? translation.commitDescription
    : '';

  return `${fix}\n${feat}\n${description}`;
};

const INIT_CONSISTENCY_PROMPT = (
  translation: ConsistencyPrompt
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: 'assistant',
  content: getContent(translation)
});

export const getMainCommitPrompt = async (
  fullGitMojiSpec: boolean,
  context?: string
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  let returnArray: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [];

  if (config.CMT_PROMPT_MODULE === '@commitlint') {
    if (!(await utils.commitlintLLMConfigExists())) {
      note(
        `CMT_PROMPT_MODULE is @commitlint but you haven't generated consistency for this project yet.`
      );
      await configureCommitlintIntegration();
    }

    // Replace example prompt with a prompt that's generated by OpenAI for the commitlint config.
    const commitLintConfig = await utils.getCommitlintLLMConfig();

    returnArray = [
      commitlintPrompts.INIT_MAIN_PROMPT(
        translation.localLanguage,
        commitLintConfig.prompts
      ),
      INIT_DIFF_PROMPT,
      INIT_CONSISTENCY_PROMPT(
        commitLintConfig.consistency[
        translation.localLanguage
        ] as ConsistencyPrompt
      )
    ];
  } else {
    // Default prompt
    returnArray = [
      INIT_MAIN_PROMPT(translation.localLanguage, fullGitMojiSpec, context),
      INIT_DIFF_PROMPT,
      INIT_CONSISTENCY_PROMPT(translation)
    ];
  }

  if (config.CMT_DEBUG) {
    console.log('DEBUG PROMPT TO AI: ', returnArray);
  }

  return returnArray;
};
