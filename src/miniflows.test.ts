import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildClassMiniFlows, buildDependencyMiniFlows, buildFunctionMiniFlows, buildRouteMiniFlows } from './miniflows';
import { ClassModel, DependencyModel, FunctionModel, RouteModel } from './model/types';

test('buildRouteMiniFlows produces one self-contained file per route, index-prefixed for uniqueness', () => {
  const routes: RouteModel = {
    routes: [
      { method: 'POST', path: '/customers', handler: 'CustomerController.create', calls: [], returns: 'void', file: 'a', line: 1 },
      { method: 'GET', path: '/customers', handler: 'CustomerController.list', calls: [], returns: 'void', file: 'a', line: 2 },
    ],
  };

  const flows = buildRouteMiniFlows(routes);

  assert.equal(flows.length, 2);
  assert.equal(flows[0].filename, '00_POST__customers.mmd');
  assert.match(flows[0].content, /POST \/customers/);
  assert.doesNotMatch(flows[0].content, /GET \/customers/);
});

test('buildFunctionMiniFlows includes both callees and callers as neighbors', () => {
  const functions: FunctionModel = {
    functions: [
      { name: 'Controller.handle', file: 'a', line: 1, params: [], returnType: 'void', complexity: 'O(1)', calls: ['Service.run'] },
      { name: 'Service.run', file: 'b', line: 1, params: [], returnType: 'void', complexity: 'O(1)', calls: [] },
      { name: 'Unrelated.fn', file: 'c', line: 1, params: [], returnType: 'void', complexity: 'O(1)', calls: [] },
    ],
  };

  const flows = buildFunctionMiniFlows(functions);
  const serviceRun = flows.find((f) => f.filename === 'Service_run.mmd');

  assert.ok(serviceRun);
  assert.match(serviceRun!.content, /Controller_handle/);
  assert.doesNotMatch(serviceRun!.content, /Unrelated/);
});

test('buildClassMiniFlows includes reverse "uses" neighbors, not just forward ones', () => {
  const classes: ClassModel = {
    classes: [
      { name: 'Service', file: 'a', implements: [], properties: [], methods: [{ name: 'constructor', visibility: 'public', static: false, params: [{ name: 'repo', type: 'Repository' }], returnType: 'void' }] },
      { name: 'Repository', file: 'b', implements: [], properties: [], methods: [] },
      { name: 'Unrelated', file: 'c', implements: [], properties: [], methods: [] },
    ],
    interfaces: [],
  };

  const flows = buildClassMiniFlows(classes);
  const repository = flows.find((f) => f.filename === 'Repository.mmd');

  assert.ok(repository);
  assert.match(repository!.content, /class Service/);
  assert.match(repository!.content, /Service --> Repository : uses/);
  assert.doesNotMatch(repository!.content, /Unrelated/);
});

test('buildDependencyMiniFlows scopes cycles/violations to only those touching the module', () => {
  const deps: DependencyModel = {
    modules: ['a', 'b', 'c'],
    externalPackages: [],
    edges: [
      { from: 'a', to: 'b', external: false },
      { from: 'b', to: 'a', external: false },
      { from: 'b', to: 'c', external: false },
    ],
    cycles: [['a', 'b', 'a']],
    violations: [],
  };

  const flows = buildDependencyMiniFlows(deps);
  const forC = flows.find((f) => f.filename === 'c.mmd');

  assert.ok(forC);
  assert.doesNotMatch(forC!.content, /\|cycle\|/);
  assert.match(forC!.content, /b --> c/);
});
