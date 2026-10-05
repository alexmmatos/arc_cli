#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { generateInitialDiagrams } from '../index';

const HELP = `arc-code - static architecture analyzer (no AI, no network)

Usage:
  arc-code generate-diagrams   Analyze the current project and write .arch/
  arc-code --help              Show this help
  arc-code --version           Show the installed version
`;

function getVersion(): string {
  const pkgPath = path.join(__dirname, '../../package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
}

function main(argv: string[]): void {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(getVersion() + '\n');
    return;
  }

  const command = argv[0];
  if (command === 'generate-diagrams') {
    const rootDir = process.cwd();
    try {
      const result = generateInitialDiagrams(rootDir);
      process.stdout.write(`Arc Code: analyzed ${result.model.meta.analyzedFiles.length} file(s).\n`);
      process.stdout.write(`Written to ${result.outDir}:\n`);
      for (const name of ['architecture.mmd', 'routes.mmd', 'classes.mmd', 'dependencies.mmd', 'functions.mmd', 'manifest.json']) {
        process.stdout.write(`  - ${name}\n`);
      }
      if (result.resources.length > 0) {
        process.stdout.write(`  - domains/<resource>/ (${result.resources.length}): ${result.resources.join(', ')}\n`);
      }
      for (const [dir, count] of Object.entries(result.miniFlowCounts)) {
        if (count > 0) process.stdout.write(`  - ${dir}/ (${count} mini-flow${count === 1 ? '' : 's'})\n`);
      }
    } catch (err) {
      process.stderr.write(`Error: ${(err as Error).message}\n`);
      process.exitCode = 1;
    }
    return;
  }

  process.stderr.write(`Unknown command: ${command ?? '(none)'}\n\n${HELP}`);
  process.exitCode = 1;
}

main(process.argv.slice(2));
