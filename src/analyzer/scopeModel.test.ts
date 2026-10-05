import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DependencyModel, FunctionModel, RouteModel } from '../model/types';
import { scopeDependencies, scopeRoutes } from './scopeModel';

test('scopeDependencies keeps external edges from scoped files but drops internal edges leaving scope', () => {
  const deps: DependencyModel = {
    modules: ['a', 'b', 'c'],
    externalPackages: ['stripe'],
    edges: [
      { from: 'a', to: 'b', external: false },
      { from: 'a', to: 'c', external: false },
      { from: 'a', to: 'stripe', external: true },
    ],
    cycles: [],
    violations: [],
  };

  const scoped = scopeDependencies(deps, new Set(['a', 'b']));

  assert.deepEqual(scoped.modules, ['a', 'b']);
  assert.deepEqual(scoped.edges, [
    { from: 'a', to: 'b', external: false },
    { from: 'a', to: 'stripe', external: true },
  ]);
  assert.deepEqual(scoped.externalPackages, ['stripe']);
});

test('scopeRoutes keeps only routes whose handler is implemented in one of the resource\'s own files', () => {
  const routes: RouteModel = {
    routes: [
      { method: 'GET', path: '/customers', handler: 'CustomerController.list', calls: [], returns: 'void', file: 'src/app', line: 1 },
      { method: 'GET', path: '/deals', handler: 'DealController.list', calls: [], returns: 'void', file: 'src/app', line: 2 },
      { method: 'GET', path: '/health', handler: '<inline handler>', calls: [], returns: 'unknown', file: 'src/app', line: 3 },
    ],
  };
  const functions: FunctionModel = {
    functions: [
      { name: 'CustomerController.list', file: 'src/controllers/customerController', line: 1, params: [], returnType: 'void', complexity: 'O(1)', calls: [] },
      { name: 'DealController.list', file: 'src/controllers/dealController', line: 1, params: [], returnType: 'void', complexity: 'O(1)', calls: [] },
    ],
  };

  const scoped = scopeRoutes(routes, functions, ['src/controllers/customerController']);

  assert.deepEqual(scoped.routes.map((r) => r.path), ['/customers']);
});
