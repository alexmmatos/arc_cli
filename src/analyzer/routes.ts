import * as ts from 'typescript';
import { RouteEntry, RouteModel } from '../model/types';
import { toModuleId } from './moduleId';
import { unwrapAwait } from './tsHelpers';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);
const ROUTER_NAME_RE = /(app|router)/i;

type FunctionLike = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node)
  );
}

function collectDirectCalls(body: ts.ConciseBody): string[] {
  const calls: string[] = [];

  function textOfCall(call: ts.CallExpression): string {
    return `${call.expression.getText()}()`;
  }

  if (ts.isBlock(body)) {
    for (const statement of body.statements) {
      if (ts.isExpressionStatement(statement)) {
        const expr = unwrapAwait(statement.expression);
        if (ts.isCallExpression(expr)) calls.push(textOfCall(expr));
      } else if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (!decl.initializer) continue;
          const expr = unwrapAwait(decl.initializer);
          if (ts.isCallExpression(expr)) calls.push(textOfCall(expr));
        }
      } else if (ts.isReturnStatement(statement) && statement.expression) {
        const expr = unwrapAwait(statement.expression);
        if (ts.isCallExpression(expr)) calls.push(textOfCall(expr));
      }
    }
  } else {
    const expr = unwrapAwait(body);
    if (ts.isCallExpression(expr)) calls.push(textOfCall(expr));
  }

  return calls;
}

function resolveHandler(
  checker: ts.TypeChecker,
  handlerExpr: ts.Expression
): { label: string; calls: string[]; returns: string } {
  if (ts.isArrowFunction(handlerExpr) || ts.isFunctionExpression(handlerExpr)) {
    return {
      label: '<inline handler>',
      calls: collectDirectCalls(handlerExpr.body),
      returns: handlerExpr.type?.getText() ?? 'unknown',
    };
  }

  const label = handlerExpr.getText();
  const symbol = checker.getSymbolAtLocation(
    ts.isPropertyAccessExpression(handlerExpr) ? handlerExpr.name : handlerExpr
  );
  const decl = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

  if (decl && isFunctionLike(decl) && decl.body) {
    return {
      label,
      calls: collectDirectCalls(decl.body),
      returns: decl.type?.getText() ?? 'unknown',
    };
  }

  return { label, calls: [], returns: 'unknown' };
}

export function analyzeRoutes(program: ts.Program, files: string[], rootDir: string): RouteModel {
  const checker = program.getTypeChecker();
  const routes: RouteEntry[] = [];

  for (const file of files) {
    const maybeSourceFile = program.getSourceFile(file);
    if (!maybeSourceFile) continue;
    const sourceFile = maybeSourceFile;
    const fileId = toModuleId(rootDir, file);

    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ROUTER_NAME_RE.test(node.expression.expression.text) &&
        HTTP_METHODS.has(node.expression.name.text.toLowerCase()) &&
        node.arguments.length >= 2 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const method = node.expression.name.text.toUpperCase();
        const path = node.arguments[0].text;
        const handlerExpr = node.arguments[node.arguments.length - 1];
        const { label, calls, returns } = resolveHandler(checker, handlerExpr);
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

        routes.push({
          method,
          path,
          handler: label,
          calls,
          returns,
          file: fileId,
          line: line + 1,
        });
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  routes.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
  return { routes };
}
