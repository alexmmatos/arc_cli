import * as ts from 'typescript';

const LOOP_ARRAY_METHODS = new Set(['forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'find', 'flatMap', 'sort']);

const GEOMETRIC_BINARY_OPS = new Set([
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.LessThanLessThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
]);

const GEOMETRIC_COMPOUND_OPS = new Set([
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
]);

const SHRINKING_BINARY_OPS = new Set([
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.GreaterThanGreaterThanToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
]);

function unwrapParens(expr: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
}

function identifierName(expr: ts.Expression): string | undefined {
  const e = unwrapParens(expr);
  return ts.isIdentifier(e) ? e.text : undefined;
}

/** Walks `a.b.c` / `a[i]` chains down to the leftmost identifier, so `items.length` resolves to `items`. */
function rootIdentifier(expr: ts.Expression): string | undefined {
  const e = unwrapParens(expr);
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return rootIdentifier(e.expression);
  if (ts.isElementAccessExpression(e)) return rootIdentifier(e.expression);
  return undefined;
}

/** Unwraps Math.floor/ceil/round/trunc(x) -> x, since rounding doesn't change the growth rate. */
function unwrapMathRounding(expr: ts.Expression): ts.Expression {
  const e = unwrapParens(expr);
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.arguments.length === 1) {
    const obj = e.expression.expression;
    const fn = e.expression.name.text;
    if (ts.isIdentifier(obj) && obj.text === 'Math' && ['floor', 'ceil', 'round', 'trunc'].includes(fn)) {
      return unwrapMathRounding(e.arguments[0]);
    }
  }
  return e;
}

/** Matches `target / k`, `target * k`, `target >> k`, `target << k` where target is a bare identifier (loop counters). */
function isGeometricUpdate(target: string, expr: ts.Expression): boolean {
  const e = unwrapMathRounding(expr);
  if (!ts.isBinaryExpression(e)) return false;
  return GEOMETRIC_BINARY_OPS.has(e.operatorToken.kind) && ts.isIdentifier(e.left) && e.left.text === target;
}

/** Matches `root / k` or `root >> k`, where root may be `x` or `x.length`/`x[i]` rooted at one of `paramNames`. */
function isShrinkingDerivedFrom(expr: ts.Expression, paramNames: string[]): boolean {
  const e = unwrapMathRounding(expr);
  if (!ts.isBinaryExpression(e)) return false;
  if (!SHRINKING_BINARY_OPS.has(e.operatorToken.kind)) return false;
  const root = rootIdentifier(e.left);
  return !!root && paramNames.includes(root);
}

function conditionIdentifiers(expr: ts.Expression | undefined): Set<string> {
  const names = new Set<string>();
  if (!expr) return names;
  function visit(n: ts.Node): void {
    if (ts.isIdentifier(n)) names.add(n.text);
    ts.forEachChild(n, visit);
  }
  visit(expr);
  return names;
}

function referencesAny(expr: ts.Node, names: Set<string>): boolean {
  let hit = false;
  function visit(n: ts.Node): void {
    if (hit) return;
    if (ts.isIdentifier(n) && names.has(n.text)) hit = true;
    ts.forEachChild(n, visit);
  }
  visit(expr);
  return hit;
}

/** True if `loop`'s own condition variable is multiplied/divided/shifted each iteration: `for(i=1;i<n;i*=2)`, `while(n>1){n=Math.floor(n/2)}`. */
function hasGeometricConditionUpdate(condition: ts.Expression, body: ts.Node): boolean {
  const names = conditionIdentifiers(condition);
  if (names.size === 0) return false;
  let found = false;
  function visit(n: ts.Node): void {
    if (found) return;
    if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) && names.has(n.left.text)) {
      if (GEOMETRIC_COMPOUND_OPS.has(n.operatorToken.kind)) found = true;
      else if (n.operatorToken.kind === ts.SyntaxKind.EqualsToken && isGeometricUpdate(n.left.text, n.right)) found = true;
    }
    ts.forEachChild(n, visit);
  }
  visit(body);
  return found;
}

/** Matches the classic binary-search midpoint: `(a + b) / 2`, `(a + b) >> 1`, or `a + Math.floor((b - a) / 2)`, for a, b in `rangeNames`. */
function isMidpointOfRange(expr: ts.Expression, rangeNames: Set<string>): boolean {
  const e = unwrapMathRounding(expr);
  if (!ts.isBinaryExpression(e)) return false;

  if (e.operatorToken.kind === ts.SyntaxKind.SlashToken || e.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanToken) {
    const inner = unwrapParens(e.left);
    if (ts.isBinaryExpression(inner) && (inner.operatorToken.kind === ts.SyntaxKind.PlusToken || inner.operatorToken.kind === ts.SyntaxKind.MinusToken)) {
      const a = identifierName(inner.left);
      const b = identifierName(inner.right);
      if ((a && rangeNames.has(a)) || (b && rangeNames.has(b))) return true;
    }
  }

  if (e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const leftName = identifierName(e.left);
    if (leftName && rangeNames.has(leftName)) {
      const rhs = unwrapMathRounding(e.right);
      if (ts.isBinaryExpression(rhs) && (rhs.operatorToken.kind === ts.SyntaxKind.SlashToken || rhs.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanToken)) {
        return true;
      }
    }
  }

  return false;
}

/** Finds variables assigned from a midpoint-of-range or a shrinking derivation of `rangeNames` (covers both the low/high/mid and the size/2 halving idioms). */
function findHalvingDerivedVariables(body: ts.Node, rangeNames: Set<string>): Set<string> {
  const paramNames = [...rangeNames];
  const derived = new Set<string>();
  function visit(n: ts.Node): void {
    let target: string | undefined;
    let rhs: ts.Expression | undefined;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      target = n.name.text;
      rhs = n.initializer;
    } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left)) {
      target = n.left.text;
      rhs = n.right;
    }
    if (target && rhs && (isMidpointOfRange(rhs, rangeNames) || isShrinkingDerivedFrom(rhs, paramNames))) {
      derived.add(target);
    }
    ts.forEachChild(n, visit);
  }
  visit(body);
  return derived;
}

/**
 * Detects the "low/high/mid" range-narrowing idiom used by binary search:
 * a midpoint derived from the loop's own condition variables, later used to
 * reassign one of those variables (`low = mid + 1`, `high = mid - 1`, ...).
 */
function hasBinarySearchNarrowing(condition: ts.Expression, body: ts.Node): boolean {
  const rangeNames = conditionIdentifiers(condition);
  if (rangeNames.size < 2) return false;

  const midNames = findHalvingDerivedVariables(body, rangeNames);
  if (midNames.size === 0) return false;

  let narrows = false;
  function visit(n: ts.Node): void {
    if (narrows) return;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(n.left) && rangeNames.has(n.left.text)) {
      if (referencesAny(n.right, midNames)) narrows = true;
    }
    ts.forEachChild(n, visit);
  }
  visit(body);
  return narrows;
}

type LoopKind = 'linear' | 'log' | null;

function classifyLoop(node: ts.Node): LoopKind {
  if (ts.isForStatement(node)) {
    const inc = node.incrementor;
    if (inc && ts.isBinaryExpression(inc)) {
      if (GEOMETRIC_COMPOUND_OPS.has(inc.operatorToken.kind)) return 'log';
      if (inc.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(inc.left) && isGeometricUpdate(inc.left.text, inc.right)) {
        return 'log';
      }
    }
    return 'linear';
  }
  if (ts.isWhileStatement(node) || ts.isDoStatement(node)) {
    if (hasBinarySearchNarrowing(node.expression, node.statement) || hasGeometricConditionUpdate(node.expression, node.statement)) {
      return 'log';
    }
    return 'linear';
  }
  if (ts.isForInStatement(node) || ts.isForOfStatement(node)) return 'linear';
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && LOOP_ARRAY_METHODS.has(node.expression.name.text)) {
    return 'linear';
  }
  return null;
}

interface Factors {
  n: number;
  log: number;
}

function worse(a: Factors, b: Factors): Factors {
  if (a.n !== b.n) return a.n > b.n ? a : b;
  return a.log >= b.log ? a : b;
}

function maxComplexityFactors(body: ts.Node): Factors {
  let max: Factors = { n: 0, log: 0 };
  function visit(n: ts.Node, current: Factors): void {
    max = worse(max, current);
    const kind = classifyLoop(n);
    const next =
      kind === 'linear' ? { n: current.n + 1, log: current.log } : kind === 'log' ? { n: current.n, log: current.log + 1 } : current;
    ts.forEachChild(n, (child) => visit(child, next));
  }
  visit(body, { n: 0, log: 0 });
  return max;
}

function nPart(n: number): string | null {
  if (n <= 0) return null;
  if (n === 1) return 'n';
  if (n === 2) return 'n²';
  if (n === 3) return 'n³';
  return `n^${n}`;
}

function logPart(log: number): string | null {
  if (log <= 0) return null;
  if (log === 1) return 'log n';
  return `log^${log} n`;
}

function factorsToBigO(f: Factors): string {
  const parts = [nPart(f.n), logPart(f.log)].filter((p): p is string => p !== null);
  return parts.length === 0 ? 'O(1)' : `O(${parts.join(' ')})`;
}

function isSelfCall(expr: ts.Expression, selfName: string): boolean {
  const isBareSelfCall = ts.isIdentifier(expr) && expr.text === selfName;
  const isThisSelfCall =
    ts.isPropertyAccessExpression(expr) && expr.expression.kind === ts.SyntaxKind.ThisKeyword && expr.name.text === selfName;
  return isBareSelfCall || isThisSelfCall;
}

/** True if `stmt` unconditionally exits (return/throw, or an if/else where both branches do). Approximates by checking only the last statement of a block. */
function alwaysReturns(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isBlock(stmt)) {
    return stmt.statements.length > 0 && alwaysReturns(stmt.statements[stmt.statements.length - 1]);
  }
  if (ts.isIfStatement(stmt)) {
    return !!stmt.elseStatement && alwaysReturns(stmt.thenStatement) && alwaysReturns(stmt.elseStatement);
  }
  return false;
}

/**
 * Collects the argument lists of self-recursive calls lying on a single
 * execution path, so mutually-exclusive branches count as ONE call while
 * genuinely sequential calls (merge sort's two recursive calls back to back,
 * or `fib(n-1) + fib(n-2)`) count as several. Handles both `if/else` and the
 * "guard clause" style (`if (cond) return x;` followed by the rest of the
 * block, which is effectively its else branch) — binary search is usually
 * written the second way. Branches take the longer side; everything else is
 * summed/recursed into.
 */
function selfCallsAlongPath(node: ts.Node, selfName: string): ts.Expression[][] {
  if (ts.isIfStatement(node)) {
    const thenCalls = selfCallsAlongPath(node.thenStatement, selfName);
    const elseCalls = node.elseStatement ? selfCallsAlongPath(node.elseStatement, selfName) : [];
    return thenCalls.length >= elseCalls.length ? thenCalls : elseCalls;
  }
  if (ts.isBlock(node)) {
    return selfCallsInStatements(node.statements, selfName);
  }
  if (ts.isReturnStatement(node)) {
    return node.expression ? selfCallsAlongPath(node.expression, selfName) : [];
  }
  if (ts.isExpressionStatement(node)) {
    return selfCallsAlongPath(node.expression, selfName);
  }
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap((d) => (d.initializer ? selfCallsAlongPath(d.initializer, selfName) : []));
  }
  if (ts.isBinaryExpression(node)) {
    return [...selfCallsAlongPath(node.left, selfName), ...selfCallsAlongPath(node.right, selfName)];
  }
  if (ts.isParenthesizedExpression(node)) {
    return selfCallsAlongPath(node.expression, selfName);
  }
  if (ts.isCallExpression(node)) {
    const own = isSelfCall(node.expression, selfName) ? [[...node.arguments]] : [];
    const nested = node.arguments.flatMap((arg) => selfCallsAlongPath(arg, selfName));
    return [...own, ...nested];
  }

  let found: ts.Expression[][] = [];
  ts.forEachChild(node, (child) => {
    found = found.concat(selfCallsAlongPath(child, selfName));
  });
  return found;
}

/** Sequentially folds a statement list, treating a trailing-return guard (`if (cond) return x;`) and the statements after it as alternative branches rather than summing them. */
function selfCallsInStatements(statements: readonly ts.Statement[], selfName: string): ts.Expression[][] {
  const acc: ts.Expression[][] = [];
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (ts.isIfStatement(stmt) && !stmt.elseStatement && alwaysReturns(stmt.thenStatement)) {
      const thenCalls = selfCallsAlongPath(stmt.thenStatement, selfName);
      const restCalls = selfCallsInStatements(statements.slice(i + 1), selfName);
      const branch = thenCalls.length >= restCalls.length ? thenCalls : restCalls;
      return [...acc, ...branch];
    }
    acc.push(...selfCallsAlongPath(stmt, selfName));
  }
  return acc;
}

interface RecursionInfo {
  count: number;
  allHalving: boolean;
}

function analyzeRecursion(body: ts.Node, selfName: string, paramNames: string[]): RecursionInfo {
  const calls = selfCallsAlongPath(body, selfName);
  if (calls.length === 0) return { count: 0, allHalving: false };

  const derivedVars = findHalvingDerivedVariables(body, new Set(paramNames));
  const allHalving = calls.every((args) =>
    args.some((arg) => isShrinkingDerivedFrom(arg, paramNames) || (derivedVars.size > 0 && referencesAny(arg, derivedVars)))
  );
  return { count: calls.length, allHalving };
}

/**
 * Heuristic only: classifies loops (linear vs. geometric/log step, including
 * the binary-search low/high/mid idiom) and self-recursive calls (plain,
 * argument-halving, or branching) by pattern-matching common idioms. It is
 * not a real control-flow, data-flow, or recurrence-relation analysis.
 * ponytail: recognizes the idioms above and defaults to linear/O(2^n)
 * otherwise — it will not catch an unusual-looking halving loop or prove
 * termination. Upgrade to a proper CFG + recurrence estimator if this starts
 * misleading.
 */
export function estimateComplexity(body: ts.Node | undefined, selfName: string, paramNames: string[] = []): string {
  if (!body) return 'O(1)';

  const loopFactors = maxComplexityFactors(body);
  const loopLabel = factorsToBigO(loopFactors);
  const recursion = analyzeRecursion(body, selfName, paramNames);

  if (recursion.count === 0) return loopLabel;

  if (recursion.count === 1) {
    if (recursion.allHalving) {
      return `${factorsToBigO({ n: loopFactors.n, log: loopFactors.log + 1 })} (recursive)`;
    }
    return loopFactors.n === 0 && loopFactors.log === 0 ? 'O(n) (recursive)' : `${loopLabel} (recursive, depth not statically known)`;
  }

  if (recursion.allHalving) {
    return 'O(n log n) (recursive, divide-and-conquer)';
  }
  return 'O(2^n) (recursive, multiple self-calls)';
}
