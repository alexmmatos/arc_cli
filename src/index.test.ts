import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { generateInitialDiagrams } from './index';

const sampleProjectDir = path.join(__dirname, '../examples/sample-project');

function readGenerated(dir: string): Record<string, string> {
  const arch = path.join(dir, '.arch');
  const files: Record<string, string> = {};

  function walk(current: string, relPrefix: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), rel);
        continue;
      }
      let content = fs.readFileSync(path.join(current, entry.name), 'utf-8');
      if (entry.name === 'manifest.json') {
        content = content.replace(/"generatedAt": ".*"/, '"generatedAt": "<ts>"');
      }
      files[rel] = content;
    }
  }

  walk(arch, '');
  return files;
}

test('generating twice on the same project produces identical output (ignoring timestamps)', () => {
  generateInitialDiagrams(sampleProjectDir);
  const first = readGenerated(sampleProjectDir);

  generateInitialDiagrams(sampleProjectDir);
  const second = readGenerated(sampleProjectDir);

  assert.deepEqual(second, first);
});

test('architecture diagram detects the controller -> service -> domain -> repository chain', () => {
  generateInitialDiagrams(sampleProjectDir);
  const architecture = fs.readFileSync(path.join(sampleProjectDir, '.arch/architecture.mmd'), 'utf-8');
  assert.match(architecture, /controller --> service/);
  assert.match(architecture, /service --> domain/);
  assert.match(architecture, /domain --> repository/);
});

test('throws a clear error when there are no TS/JS source files', () => {
  const emptyDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'arc-code-empty-'));
  assert.throws(() => generateInitialDiagrams(emptyDir), /No TypeScript\/JavaScript source files found/);
});
