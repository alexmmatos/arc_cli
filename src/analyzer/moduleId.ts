import * as path from 'path';

export function toModuleId(rootDir: string, filePath: string): string {
  const rel = path.relative(rootDir, filePath);
  const withoutExt = rel.replace(/\.(tsx?|jsx?)$/, '');
  return withoutExt.split(path.sep).join('/');
}

const RESOLUTION_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
];

export function resolveImportToFile(fromFile: string, importPath: string, allFiles: Set<string>): string | null {
  if (!importPath.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), importPath);
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = base + suffix;
    if (allFiles.has(candidate)) return candidate;
  }
  return null;
}
