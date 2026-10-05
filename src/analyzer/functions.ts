import * as ts from 'typescript';
import { FunctionEntry, FunctionModel } from '../model/types';
import { estimateComplexity } from './complexity';
import { toModuleId } from './moduleId';
import { extractParams, typeToText } from './tsHelpers';

type NamedFunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration | ts.ConstructorDeclaration;

function isFunctionLikeExpr(node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

function qualify(enclosing: string, name: string): string {
  return `${enclosing}.${name}`;
}

function shortName(qualifiedName: string): string {
  const parts = qualifiedName.split('.');
  return parts[parts.length - 1];
}

const UNRESOLVED_TYPE_NAMES = new Set(['any', 'unknown', 'error', '__type', '__object']);

/**
 * Resolves a call's callee to a qualified name matching our own naming
 * scheme (`ClassName.method`), using the type checker for `obj.method()`
 * so it points at the object's real declared type rather than the local
 * variable name. Returns undefined when it can't be resolved to something
 * nameable (e.g. a call on an expression with no resolvable type) — we
 * don't guess.
 */
function resolveCalleeName(checker: ts.TypeChecker, callee: ts.Expression, enclosingClassName: string | undefined): string | undefined {
  if (ts.isPropertyAccessExpression(callee)) {
    const methodName = callee.name.text;
    if (callee.expression.kind === ts.SyntaxKind.ThisKeyword && enclosingClassName) {
      return `${enclosingClassName}.${methodName}`;
    }
    try {
      const typeName = checker.getTypeAtLocation(callee.expression).getSymbol()?.getName();
      if (typeName && !UNRESOLVED_TYPE_NAMES.has(typeName)) return `${typeName}.${methodName}`;
    } catch {
      // unresolvable - fall through
    }
    return undefined;
  }
  if (ts.isIdentifier(callee)) return callee.text;
  return undefined;
}

/**
 * Collects every call this function body makes (at any nesting depth,
 * unlike routes.ts's depth-1 heuristic — general methods nest calls in
 * loops/conditions far more often than route handlers do), resolved to our
 * own qualified naming scheme. `await` doesn't need unwrapping here: the
 * recursive walk reaches the inner CallExpression regardless of the
 * AwaitExpression wrapping it. Self-recursive calls are omitted —
 * complexity.ts already surfaces recursion via the "(recursive)" suffix.
 */
function collectCallTargets(body: ts.Node, checker: ts.TypeChecker, enclosingClassName: string | undefined, selfName: string): string[] {
  const calls = new Set<string>();
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const resolved = resolveCalleeName(checker, node.expression, enclosingClassName);
      if (resolved && resolved !== selfName) calls.add(resolved);
    }
    ts.forEachChild(node, visit);
  }
  visit(body);
  return [...calls].sort();
}

export function analyzeFunctions(program: ts.Program, files: string[], rootDir: string): FunctionModel {
  const checker = program.getTypeChecker();
  const functions: FunctionEntry[] = [];

  for (const file of files) {
    const maybeSourceFile = program.getSourceFile(file);
    if (!maybeSourceFile) continue;
    const sourceFile = maybeSourceFile;
    const fileId = toModuleId(rootDir, file);

    function record(name: string, node: NamedFunctionLike): void {
      const returnType = ts.isConstructorDeclaration(node) ? 'void' : typeToText(checker, node, node.type);
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const paramNames = node.parameters.filter((p) => ts.isIdentifier(p.name)).map((p) => (p.name as ts.Identifier).text);
      const enclosingClassName = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : undefined;
      functions.push({
        name,
        file: fileId,
        line: line + 1,
        params: extractParams(checker, node.parameters),
        returnType,
        complexity: estimateComplexity(node.body, shortName(name), paramNames),
        calls: node.body ? collectCallTargets(node.body, checker, enclosingClassName, name) : [],
      });
    }

    function visit(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        record(node.name.text, node);
      } else if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && member.body) {
            record(qualify(className, member.name.getText()), member);
          } else if (ts.isConstructorDeclaration(member) && member.body) {
            record(qualify(className, 'constructor'), member);
          }
        }
      } else if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
        if (isFunctionLikeExpr(node.initializer) && node.initializer.body) {
          record(node.name.text, node.initializer);
        } else if (ts.isObjectLiteralExpression(node.initializer)) {
          const objectName = node.name.text;
          for (const prop of node.initializer.properties) {
            if (ts.isMethodDeclaration(prop) && prop.name && prop.body) {
              record(qualify(objectName, prop.name.getText()), prop);
            } else if (
              ts.isPropertyAssignment(prop) &&
              ts.isIdentifier(prop.name) &&
              isFunctionLikeExpr(prop.initializer) &&
              prop.initializer.body
            ) {
              record(qualify(objectName, prop.name.text), prop.initializer);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  functions.sort((a, b) => (a.file + String(a.line).padStart(6, '0')).localeCompare(b.file + String(b.line).padStart(6, '0')));
  return { functions };
}
