import chalk from 'chalk';

export interface BannerOptions {
  version?: string;
}

export const printCommitAiBanner = ({ version }: BannerOptions = {}) => {
  const title = chalk.bold.magenta('Commit-AI');
  const tagline = chalk.hex('#9333ea')('✨ Where commits meet vibes ✨');
  const versionText = version === undefined ? '' : chalk.gray(`v${version}`);

  // Gradient from purple (#9333ea) to blue (#2563eb)
  const art = `
${chalk.hex('#9333ea')(' ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗')}
${chalk.hex('#8b3ae0')('██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝')}
${chalk.hex('#7f42d6')('██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║')}
${chalk.hex('#6f4acc')('██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║')}
${chalk.hex('#5e52c2')('╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║')}
${chalk.hex('#4d5ab8')(' ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝')}
${chalk.hex('#3b62ae')('                █████╗ ██╗')}
${chalk.hex('#346aaa')('               ██╔══██╗██║')}
${chalk.hex('#2d72a6')('               ███████║██║')}
${chalk.hex('#267aa2')('               ██╔══██║██║')}
${chalk.hex('#2f6bb0')('               ██║  ██║██║')}
${chalk.hex('#2563eb')('               ╚═╝  ╚═╝╚═╝')}
`;

  // eslint-disable-next-line no-console
  console.log(art);
  // eslint-disable-next-line no-console
  console.log(`${title} ${versionText}`.trim());
  // eslint-disable-next-line no-console
  console.log(tagline);
  // eslint-disable-next-line no-console
  console.log('');
};


