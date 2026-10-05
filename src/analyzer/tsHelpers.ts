import * as ts from 'typescript';
import { ParamEntry } from '../model/types';

export function visibilityOf(modifiers: readonly ts.ModifierLike[] | undefined): 'public' | 'private' | 'protected' {
  if (!modifiers) return 'public';
  for (const m of modifiers) {
    if (m.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
    if (m.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
  }
  return 'public';
}

export function isStatic(modifiers: readonly ts.ModifierLike[] | undefined): boolean {
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
}

export function typeToText(checker: ts.TypeChecker, node: ts.Node, typeNode: ts.TypeNode | undefined): string {
  if (typeNode) return typeNode.getText();
  try {
    const type = checker.getTypeAtLocation(node);
    return checker.typeToString(type);
  } catch {
    return 'unknown';
  }
}

export function extractParams(checker: ts.TypeChecker, params: ts.NodeArray<ts.ParameterDeclaration>): ParamEntry[] {
  return params.map((p) => ({
    name: p.name.getText(),
    type: typeToText(checker, p, p.type),
  }));
}

/** Unwraps `await expr` -> `expr`, since awaiting doesn't change which call is being made. */
export function unwrapAwait(expr: ts.Expression): ts.Expression {
  return ts.isAwaitExpression(expr) ? unwrapAwait(expr.expression) : expr;
}
