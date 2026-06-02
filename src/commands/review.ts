import { intro, outro, spinner, confirm, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { execa } from 'execa';
import { OpenAI } from 'openai';
import { getEngine } from '../utils/engine';
import { COMMANDS } from './ENUMS';
import { getConfig } from './config';
import { startElapsedHeartbeat } from '../utils/heartbeat';
import { filterDiffForReview } from '../utils/git';
import { standardsFileExists, getStandards } from './standards';
import { getCachedReview, cacheReview, clearReviewCache, getCacheStats } from '../utils/reviewCache';

const config = getConfig();

export type ReviewSeverity = 'error' | 'warning' | 'info';

export interface ReviewFinding {
  category: 'security' | 'performance' | 'style' | 'best-practices' | 'bugs' | 'maintainability';
  severity: ReviewSeverity;
  title: string;
  description: string;
  file?: string;
  line?: string;
  suggestion?: string;
}

export interface ReviewResult {
  summary: string;
  overallScore: number;
  findings: ReviewFinding[];
  recommendation: 'approve' | 'review' | 'block';
}

function buildCodeReviewPrompt(): string {
  const standards = getStandards();
  const standardsSection = standards
    ? `\n\n**Project Code Standards:**\nThe following code standards have been configured for this project. Review the code against these specific requirements:\n\n${standards}\n\n`
    : '';

  return `You are an expert code reviewer with deep knowledge of software engineering best practices, security, performance optimization, and code quality.

Your task is to analyze a git diff and provide a comprehensive code review.${standardsSection}
**Review Criteria:**
1. **Security**: Identify potential vulnerabilities (SQL injection, XSS, authentication issues, secrets exposure, etc.)
2. **Performance**: Detect inefficient algorithms, unnecessary computations, memory leaks, or performance bottlenecks
3. **Best Practices**: Check for adherence to language-specific conventions, design patterns, and industry standards
4. **Code Quality**: Assess readability, maintainability, naming conventions, and code organization
5. **Bugs & Edge Cases**: Identify potential bugs, race conditions, null pointer issues, and unhandled edge cases
6. **Style**: Check for consistency in formatting, naming, and code structure

**Output Format (JSON):**
Respond with a valid JSON object in this exact format:
{
  "summary": "A brief 2-3 sentence summary of the overall code quality and key concerns",
  "overallScore": <number 0-100, where 100 is perfect code>,
  "recommendation": "approve" | "review" | "block",
  "findings": [
    {
      "category": "security" | "performance" | "style" | "best-practices" | "bugs" | "maintainability",
      "severity": "error" | "warning" | "info",
      "title": "Brief title of the issue",
      "description": "Detailed description of what the issue is and why it matters",
      "file": "path/to/file.ext (if identifiable)",
      "line": "L123 or L123-L145 (if identifiable)",
      "suggestion": "Specific actionable suggestion to fix the issue"
    }
  ]
}

**Recommendation Guidelines:**
- "approve": Score 80-100, no critical issues, minor improvements only
- "review": Score 50-79, notable issues that should be addressed but not blocking
- "block": Score 0-49, critical issues that must be fixed before committing

**Important:**
- Be constructive and specific
- Provide actionable suggestions
- Focus on actual issues, not nitpicking
- If the code is high quality, say so
- Respond ONLY with valid JSON, no additional text${standards ? '\n- Pay special attention to violations of the project-specific code standards listed above' : ''}`;
}

const CODE_REVIEW_PROMPT = buildCodeReviewPrompt();

async function getStagedDiff(): Promise<string> {
  try {
    const { stdout } = await execa('git', ['diff', '--staged']);
    if (!stdout || stdout.trim() === '') {
      throw new Error('No staged changes found. Stage files with: git add <files>');
    }

    // Filter diff based on .commit-ai-review-ignore patterns
    const filteredDiff = filterDiffForReview(stdout);

    if (!filteredDiff || filteredDiff.trim() === '') {
      throw new Error('All staged files are excluded from review. Check .commit-ai-review-ignore file.');
    }

    return filteredDiff;
  } catch (error: any) {
    throw new Error(`Failed to get staged diff: ${error.message}`);
  }
}

export async function performCodeReview(diff: string, useCache: boolean = true): Promise<ReviewResult> {
  const standards = getStandards();

  // Check cache first
  if (useCache) {
    const cachedResult = getCachedReview(diff, standards);
    if (cachedResult) {
      console.log(chalk.gray('  ℹ Using cached review result (diff unchanged)\n'));
      return cachedResult;
    }
  }

  const { stop: stopHeartbeat } = startElapsedHeartbeat({
    label: 'Analyzing code quality'
  });

  try {
    // Rebuild prompt to include any standards that may have been added
    const reviewPrompt = buildCodeReviewPrompt();

    const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: reviewPrompt
      },
      {
        role: 'user',
        content: `Please review the following git diff:\n\n${diff}`
      }
    ];

    const engine = getEngine();
    const reviewText = await engine.generateCommitMessage(prompt);

    // Parse JSON response
    let reviewResult: ReviewResult;
    try {
      // Try to extract JSON if response contains extra text
      const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : reviewText;
      reviewResult = JSON.parse(jsonText);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      reviewResult = {
        summary: reviewText,
        overallScore: 70,
        recommendation: 'review',
        findings: []
      };
    }

    // Cache the result
    if (useCache) {
      cacheReview(diff, standards, reviewResult);
    }

    return reviewResult;
  } finally {
    stopHeartbeat();
  }
}

function formatSeverityIcon(severity: ReviewSeverity): string {
  switch (severity) {
    case 'error':
      return chalk.red('✖');
    case 'warning':
      return chalk.yellow('⚠');
    case 'info':
      return chalk.blue('ℹ');
  }
}

function formatCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'security': chalk.red.bold('SECURITY'),
    'performance': chalk.yellow.bold('PERFORMANCE'),
    'style': chalk.blue.bold('STYLE'),
    'best-practices': chalk.cyan.bold('BEST PRACTICES'),
    'bugs': chalk.red.bold('BUGS'),
    'maintainability': chalk.magenta.bold('MAINTAINABILITY')
  };
  return labels[category] || chalk.gray.bold(category.toUpperCase());
}

function formatScoreColor(score: number): chalk.Chalk {
  if (score >= 80) return chalk.green;
  if (score >= 50) return chalk.yellow;
  return chalk.red;
}

export function printReviewResult(result: ReviewResult): void {
  const boxWidth = 100;
  const border = '─'.repeat(boxWidth);

  console.log('');
  console.log(chalk.hex('#9333ea')('┌') + chalk.hex('#9333ea')(border) + chalk.hex('#9333ea')('┐'));
  console.log(chalk.hex('#9333ea')('│') + chalk.bold.white(' Code Review Results'.padEnd(boxWidth)) + chalk.hex('#9333ea')('│'));
  console.log(chalk.hex('#7f42d6')('├') + chalk.hex('#7f42d6')(border) + chalk.hex('#7f42d6')('┤'));

  // Summary
  console.log(chalk.hex('#6366f1')('│') + ''.padEnd(boxWidth) + chalk.hex('#6366f1')('│'));
  const summaryLines = result.summary.match(/.{1,96}/g) || [result.summary];
  summaryLines.forEach(line => {
    console.log(chalk.hex('#6366f1')('│') + `  ${line}`.padEnd(boxWidth) + chalk.hex('#6366f1')('│'));
  });
  console.log(chalk.hex('#6366f1')('│') + ''.padEnd(boxWidth) + chalk.hex('#6366f1')('│'));

  // Score
  console.log(chalk.hex('#5e52c2')('├') + chalk.hex('#5e52c2')(border) + chalk.hex('#5e52c2')('┤'));
  const scoreColor = formatScoreColor(result.overallScore);
  const scoreLine = `  Overall Quality Score: ${scoreColor.bold(result.overallScore.toString())}/100`;
  const scoreStripped = scoreLine.replace(/\x1b\[[0-9;]*m/g, '');
  const scorePadding = ' '.repeat(Math.max(0, boxWidth - scoreStripped.length));
  console.log(chalk.hex('#5e52c2')('│') + scoreLine + scorePadding + chalk.hex('#5e52c2')('│'));

  // Recommendation
  const recIcon = result.recommendation === 'approve' ? chalk.green('✓') :
                  result.recommendation === 'review' ? chalk.yellow('!') :
                  chalk.red('✖');
  const recText = result.recommendation === 'approve' ? chalk.green('APPROVED - Ready to commit') :
                  result.recommendation === 'review' ? chalk.yellow('REVIEW SUGGESTED - Address findings') :
                  chalk.red('BLOCKED - Fix critical issues');
  const recLine = `  Recommendation: ${recIcon} ${recText}`;
  const recStripped = recLine.replace(/\x1b\[[0-9;]*m/g, '');
  const recPadding = ' '.repeat(Math.max(0, boxWidth - recStripped.length));
  console.log(chalk.hex('#5e52c2')('│') + recLine + recPadding + chalk.hex('#5e52c2')('│'));

  // Findings
  if (result.findings.length > 0) {
    console.log(chalk.hex('#3b62ae')('├') + chalk.hex('#3b62ae')(border) + chalk.hex('#3b62ae')('┤'));
    console.log(chalk.hex('#3b62ae')('│') + chalk.bold.white(` Findings (${result.findings.length})`.padEnd(boxWidth)) + chalk.hex('#3b62ae')('│'));
    console.log(chalk.hex('#3b62ae')('├') + chalk.hex('#3b62ae')(border) + chalk.hex('#3b62ae')('┤'));

    result.findings.forEach((finding, index) => {
      const icon = formatSeverityIcon(finding.severity);
      const category = formatCategoryLabel(finding.category);

      console.log(chalk.hex('#2563eb')('│') + ''.padEnd(boxWidth) + chalk.hex('#2563eb')('│'));

      // Title line
      const titleLine = `  ${icon} ${category} - ${finding.title}`;
      const titleStripped = titleLine.replace(/\x1b\[[0-9;]*m/g, '');
      const titlePadding = ' '.repeat(Math.max(0, boxWidth - titleStripped.length));
      console.log(chalk.hex('#2563eb')('│') + titleLine + titlePadding + chalk.hex('#2563eb')('│'));

      // Location
      if (finding.file || finding.line) {
        const location = `    📁 ${finding.file || 'unknown'}${finding.line ? ':' + finding.line : ''}`;
        console.log(chalk.hex('#2563eb')('│') + chalk.gray(location.padEnd(boxWidth)) + chalk.hex('#2563eb')('│'));
      }

      // Description
      const descLines = finding.description.match(/.{1,94}/g) || [finding.description];
      descLines.forEach(line => {
        console.log(chalk.hex('#2563eb')('│') + `    ${line}`.padEnd(boxWidth) + chalk.hex('#2563eb')('│'));
      });

      // Suggestion
      if (finding.suggestion) {
        console.log(chalk.hex('#2563eb')('│') + chalk.green('    💡 Suggestion:'.padEnd(boxWidth)) + chalk.hex('#2563eb')('│'));
        const suggLines = finding.suggestion.match(/.{1,94}/g) || [finding.suggestion];
        suggLines.forEach(line => {
          console.log(chalk.hex('#2563eb')('│') + chalk.gray(`    ${line}`.padEnd(boxWidth)) + chalk.hex('#2563eb')('│'));
        });
      }
    });
  }

  console.log(chalk.hex('#2563eb')('│') + ''.padEnd(boxWidth) + chalk.hex('#2563eb')('│'));
  console.log(chalk.hex('#2563eb')('└') + chalk.hex('#2563eb')(border) + chalk.hex('#2563eb')('┘'));
  console.log('');
}

export const reviewClearCacheCommand = command(
  {
    name: 'clear-cache',
    help: {
      description: 'Clear cached review results'
    }
  },
  async () => {
    intro(chalk.bold.cyan('Clear Review Cache'));

    const confirmClear = await confirm({
      message: 'Are you sure you want to clear all cached review results?',
      initialValue: false
    });

    if (isCancel(confirmClear) || !confirmClear) {
      outro(chalk.yellow('Cache clear cancelled'));
      process.exit(0);
    }

    clearReviewCache();
    outro(chalk.green('✓ Review cache cleared successfully'));
  }
);

export const reviewCacheStatsCommand = command(
  {
    name: 'cache-stats',
    help: {
      description: 'Show review cache statistics'
    }
  },
  async () => {
    intro(chalk.bold.cyan('Review Cache Statistics'));

    const stats = getCacheStats();

    console.log('');
    console.log(chalk.gray('  Total entries:     ') + chalk.white(stats.totalEntries));
    console.log(chalk.gray('  Valid entries:     ') + chalk.white(stats.validEntries));
    console.log(chalk.gray('  Expired entries:   ') + chalk.white(stats.totalEntries - stats.validEntries));
    console.log(chalk.gray('  Cache size:        ') + chalk.white(stats.cacheSize));
    console.log('');

    if (stats.totalEntries > 0 && stats.validEntries === 0) {
      outro(chalk.yellow('All cache entries have expired. Consider running "cmt review clear-cache" to clean up.'));
    } else if (stats.validEntries > 0) {
      outro(chalk.green(`✓ ${stats.validEntries} cached review(s) available`));
    } else {
      outro(chalk.gray('No cached reviews yet'));
    }
  }
);

export const reviewCommand = command(
  {
    name: COMMANDS.review,
    commands: [reviewClearCacheCommand, reviewCacheStatsCommand],
    flags: {
      json: {
        type: Boolean,
        description: 'Output results as JSON',
        default: false
      },
      noCache: {
        type: Boolean,
        description: 'Skip cache and perform fresh review',
        default: false
      }
    },
    help: {
      description: 'AI-powered code review of staged changes with security, performance, and quality analysis'
    }
  },
  async (argv) => {
    intro(chalk.bold.cyan('CommitAI Code Review'));

    try {
      const { json, noCache } = argv.flags;

      // Check if standards file exists
      if (!standardsFileExists()) {
        outro(
          chalk.yellow(
            '⚠️  No code standards configured.\n\n' +
            'For better review results, configure code standards first:\n' +
            chalk.cyan('  cmt standards import') + ' - Import from popular style guides\n' +
            chalk.cyan('  cmt standards set') + '    - Create custom standards\n'
          )
        );

        const continueWithoutStandards = await confirm({
          message: 'Continue review without standards?',
          initialValue: true
        });

        if (isCancel(continueWithoutStandards) || !continueWithoutStandards) {
          outro(chalk.yellow('Review cancelled. Configure standards and try again.'));
          process.exit(0);
        }
      }

      // Get staged diff
      const diff = await getStagedDiff();

      // Perform review (with or without cache)
      const result = await performCodeReview(diff, !noCache);

      // Output results
      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printReviewResult(result);

        // Exit with appropriate code
        if (result.recommendation === 'block') {
          outro(chalk.red('⚠️  Critical issues found. Please address them before committing.'));
          process.exit(1);
        } else if (result.recommendation === 'review') {
          outro(chalk.yellow('📝 Review suggested. Consider addressing the findings.'));
        } else {
          outro(chalk.green('✓ Code review passed. Ready to commit!'));
        }
      }
    } catch (error) {
      outro(chalk.red(`✖ ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  }
);
