import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectResources, scopedFilesForResource } from './resources';

test('groups files by shared resource prefix across controller/service/repository/domain', () => {
  const moduleIds = [
    'src/app',
    'src/controllers/customerController',
    'src/services/customerService',
    'src/repositories/customerRepository',
    'src/domain/customer',
    'src/services/historyService',
    'src/controllers/historyController',
  ];

  const resources = detectResources(moduleIds);

  assert.deepEqual(resources.map((r) => r.name), ['customer', 'history']);
  assert.deepEqual(resources[0].coreFiles, [
    'src/controllers/customerController',
    'src/domain/customer',
    'src/repositories/customerRepository',
    'src/services/customerService',
  ]);
});

test('drops resources with only one file, and infra files like app.ts', () => {
  const moduleIds = ['src/app', 'src/domain/orphan'];
  assert.deepEqual(detectResources(moduleIds), []);
});

test('scopedFilesForResource pulls in direct dependency targets but does not recurse', () => {
  const edges = [
    { from: 'src/services/historyService', to: 'src/repositories/dealRepository', external: false },
    { from: 'src/repositories/dealRepository', to: 'src/domain/deal', external: false },
    { from: 'src/services/historyService', to: 'stripe', external: true },
  ];

  const scoped = scopedFilesForResource(['src/services/historyService'], edges);

  assert.ok(scoped.has('src/repositories/dealRepository'));
  assert.ok(!scoped.has('src/domain/deal'), 'should not recurse a 2nd hop');
  assert.ok(!scoped.has('stripe'), 'should not pull in external packages');
});
