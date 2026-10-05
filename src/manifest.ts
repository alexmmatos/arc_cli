import * as fs from 'fs';
import * as path from 'path';
import { ArcModel } from './model/types';

const SCHEMA_VERSION = '1.0.0';
const DIAGRAM_FILES = ['architecture.mmd', 'routes.mmd', 'classes.mmd', 'dependencies.mmd', 'functions.mmd', 'sequence.mmd'];

function getPackageVersion(): string {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

export function buildManifest(
  model: ArcModel,
  resourceNames: string[],
  miniFlows: Record<string, string[]>,
  index: Record<string, Record<string, string>>
): Record<string, unknown> {
  return {
    arcCodeVersion: getPackageVersion(),
    schemaVersion: SCHEMA_VERSION,
    language: model.meta.language,
    generatedAt: new Date().toISOString(),
    analyzedFiles: model.meta.analyzedFiles,
    diagrams: DIAGRAM_FILES,
    resources: resourceNames.map((name) => ({
      name,
      dir: `domains/${name}`,
      diagrams: DIAGRAM_FILES,
    })),
    miniFlows,
    // Lookup table so a route path / function name / class name / module id can be
    // resolved straight to its mini-flow file, without listing a directory first.
    index,
  };
}
