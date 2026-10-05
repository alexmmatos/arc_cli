import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export function writeFixture(name: string, content: string): { file: string; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-code-test-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return { file, dir };
}
