import * as ts from 'typescript';
import { resolveImportToFile } from './moduleId';

export interface RawEdge {
  from: string;
  to: string;
  external: boolean;
  externalPackage?: string;
}

function collectImportSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function toPackageName(spec: string): string {
  return spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
}

export function collectRawEdges(program: ts.Program, files: string[]): RawEdge[] {
  const fileSet = new Set(files);
  const edges: RawEdge[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;

    for (const spec of collectImportSpecifiers(sourceFile)) {
      const resolved = resolveImportToFile(file, spec, fileSet);
      if (resolved) {
        if (resolved === file) continue;
        const key = `${file}=>${resolved}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: file, to: resolved, external: false });
      } else if (!spec.startsWith('.')) {
        const pkg = toPackageName(spec);
        const key = `${file}=>pkg:${pkg}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: file, to: pkg, external: true, externalPackage: pkg });
      }
    }
  }

  return edges;
}
