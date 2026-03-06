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
  .option('-f, --format <format>', 'output format: md|txt|json|docx|pdf', 'md')
  .option('-s, --with-sources', 'append primary source snippets in report', false)
  .action(async (target = '.', opts: { format: string; withSources: boolean }) => {
    try {
      const out = await analyzeRepo(target, {
        format: (opts.format || 'md').toLowerCase() as any,
        withSources: !!opts.withSources,
      });
      console.log(chalk.green(`✅ Report generated: ${out}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`❌ ${msg}`));
      process.exit(1);
    }
  });

program.parse();
