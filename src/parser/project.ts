import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { Language } from '../model/types';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.arch', 'coverage', 'out']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export function findSourceFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      if (!SOURCE_EXTENSIONS.includes(ext)) continue;
      if (entry.name.endsWith('.d.ts')) continue;
      results.push(path.join(dir, entry.name));
    }
  }

  walk(rootDir);
  return results.sort();
}

export function detectLanguage(files: string[]): Language {
  return files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx')) ? 'typescript' : 'javascript';
}

export function createProgram(files: string[]): ts.Program {
  return ts.createProgram(files, {
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    noEmit: true,
  });
}
