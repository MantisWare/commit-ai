import chalk from 'chalk';

export interface BannerOptions {
  version?: string;
}

export const printCommitAiBanner = ({ version }: BannerOptions = {}) => {
  const versionText = version === undefined ? '' : chalk.gray(`v${version}`);

  // Modern AI-inspired design with cyan to purple gradient (matching the logo)
  const art = `
${chalk.hex('#00d9ff')(' ██████╗')}${chalk.hex('#22b0ff')(' ██████╗')}${chalk.hex('#4499ff')(' ███╗   ███╗')}${chalk.hex('#6682ff')('███╗   ███╗')}${chalk.hex('#886bff')('██╗')}${chalk.hex('#aa54ff')('████████╗')}
${chalk.hex('#00ccff')('██╔════╝')}${chalk.hex('#1eb3ff')('██╔═══██╗')}${chalk.hex('#3c9cff')('████╗ ████║')}${chalk.hex('#5a85ff')('████╗ ████║')}${chalk.hex('#786eff')('██║')}${chalk.hex('#9657ff')('╚══██╔══╝')}
${chalk.hex('#00bfff')('██║     ')}${chalk.hex('#1ab6ff')('██║   ██║')}${chalk.hex('#349fff')('██╔████╔██║')}${chalk.hex('#4e88ff')('██╔████╔██║')}${chalk.hex('#6871ff')('██║')}${chalk.hex('#825aff')('   ██║   ')}
${chalk.hex('#11b5ff')('██║     ')}${chalk.hex('#26aeff')('██║   ██║')}${chalk.hex('#3b9dff')('██║╚██╔╝██║')}${chalk.hex('#508cff')('██║╚██╔╝██║')}${chalk.hex('#657bff')('██║')}${chalk.hex('#7a6aff')('   ██║   ')}
${chalk.hex('#22abff')('╚██████╗')}${chalk.hex('#32a7ff')('╚██████╔╝')}${chalk.hex('#429bff')('██║ ╚═╝ ██║')}${chalk.hex('#528fff')('██║ ╚═╝ ██║')}${chalk.hex('#6284ff')('██║')}${chalk.hex('#7279ff')('   ██║   ')}
${chalk.hex('#33a1ff')(' ╚═════╝')}${chalk.hex('#3e9fff')(' ╚═════╝ ')}${chalk.hex('#4999ff')('╚═╝     ╚═╝')}${chalk.hex('#5493ff')('╚═╝     ╚═╝')}${chalk.hex('#5f8dff')('╚═╝')}${chalk.hex('#6a87ff')('   ╚═╝   ')}
${chalk.hex('#4499ff')('                   ')}${chalk.hex('#5a85ff')('█████╗ ')}${chalk.hex('#706fff')('██╗')}
${chalk.hex('#5085ff')('                  ')}${chalk.hex('#6479ff')('██╔══██╗')}${chalk.hex('#786dff')('██║')}
${chalk.hex('#5c7aff')('                  ')}${chalk.hex('#6e6dff')('███████║')}${chalk.hex('#806bff')('██║')}
${chalk.hex('#6870ff')('                  ')}${chalk.hex('#7861ff')('██╔══██║')}${chalk.hex('#8869ff')('██║')}
${chalk.hex('#7466ff')('                  ')}${chalk.hex('#8255ff')('██║  ██║')}${chalk.hex('#9067ff')('██║')}
${chalk.hex('#805cff')('                  ')}${chalk.hex('#8c49ff')('╚═╝  ╚═╝')}${chalk.hex('#9865ff')('╚═╝')}
`;

  // eslint-disable-next-line no-console
  console.log(art);
  // eslint-disable-next-line no-console
  console.log(chalk.bold.hex('#00d9ff')('  C O M M I T A I') + ' ' + versionText);
  // eslint-disable-next-line no-console
  console.log(chalk.hex('#886bff')('  AI-Powered Git Commits'));
  // eslint-disable-next-line no-console
  console.log('');
};


