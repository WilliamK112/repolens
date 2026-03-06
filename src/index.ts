#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { analyzeRepo } from './report.js';

const program = new Command();

program
  .name('repolens')
  .description('Analyze a local repo and generate REPORT.md')
  .version('0.1.0');

program
  .command('analyze [target]')
  .description('Analyze local repo path OR GitHub URL (default: current directory)')
  .action(async (target = '.') => {
    try {
      const out = await analyzeRepo(target);
      console.log(chalk.green(`✅ Report generated: ${out}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`❌ ${msg}`));
      process.exit(1);
    }
  });

program.parse();
