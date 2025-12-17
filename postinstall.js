#!/usr/bin/env node

/**
 * Post-installation script for CommitAI
 * Displays environment check and quick start guide
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

// Check if this is a global installation
const isGlobalInstall = process.env.npm_config_global === 'true' || 
                        process.env.npm_config_global === '1';

// Only run postinstall for global installations
if (!isGlobalInstall) {
  process.exit(0);
}

// Path to the compiled CLI
const cliPath = join(__dirname, 'out', 'cli.cjs');

// Check if CLI exists (it should after build)
if (!existsSync(cliPath)) {
  console.log('\n✨ CommitAI installed successfully!');
  console.log('Run "cmt check" to verify your setup.\n');
  process.exit(0);
}

try {
  // Run the check command
  execSync(`node "${cliPath}" check`, { 
    stdio: 'inherit',
    env: { ...process.env, CMT_SKIP_VERSION_CHECK: 'true' }
  });
} catch (error) {
  // Check command might exit with non-zero if there are warnings
  // This is fine, we just want to display the info
  process.exit(0);
}

