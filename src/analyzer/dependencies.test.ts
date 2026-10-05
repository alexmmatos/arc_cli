import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDependencies } from './dependencies';
import { RawEdge } from './imports';
import { LayerModel } from '../model/types';

const noLayers: LayerModel = { strategy: 'directory-graph', nodes: [], edges: [] };

test('builds internal and external edges, deduplicated', () => {
  const files = ['/root/a.ts', '/root/b.ts'];
  const rawEdges: RawEdge[] = [
    { from: '/root/a.ts', to: '/root/b.ts', external: false },
    { from: '/root/a.ts', to: '/root/b.ts', external: false },
    { from: '/root/a.ts', to: 'lodash', external: true, externalPackage: 'lodash' },
  ];

  const model = analyzeDependencies(rawEdges, files, '/root', noLayers);

  assert.deepEqual(model.modules, ['a', 'b']);
  assert.deepEqual(model.externalPackages, ['lodash']);
  assert.equal(model.edges.length, 2);
});

test('detects a cycle between two modules', () => {
  const files = ['/root/a.ts', '/root/b.ts'];
  const rawEdges: RawEdge[] = [
    { from: '/root/a.ts', to: '/root/b.ts', external: false },
    { from: '/root/b.ts', to: '/root/a.ts', external: false },
  ];

  const model = analyzeDependencies(rawEdges, files, '/root', noLayers);

  assert.equal(model.cycles.length, 1);
  assert.deepEqual([...model.cycles[0]].sort(), ['a', 'a', 'b']);
});

test('flags an import that goes against the declared layer order', () => {
  const files = ['/root/src/repositories/userRepository.ts', '/root/src/controllers/userController.ts'];
  const rawEdges: RawEdge[] = [
    {
      from: '/root/src/repositories/userRepository.ts',
      to: '/root/src/controllers/userController.ts',
      external: false,
    },
  ];
  const layers: LayerModel = {
    strategy: 'known-layers',
    nodes: [
      { id: 'controller', label: 'Controllers' },
      { id: 'repository', label: 'Repositories' },
    ],
    edges: [{ from: 'controller', to: 'repository' }],
  };

  const model = analyzeDependencies(rawEdges, files, '/root', layers);

  assert.equal(model.violations.length, 1);
  assert.equal(model.violations[0].from, 'src/repositories/userRepository');
});

test('does not flag a repository or service importing a domain type (that is the expected direction)', () => {
  const files = [
    '/root/src/repositories/userRepository.ts',
    '/root/src/services/userService.ts',
    '/root/src/domain/user.ts',
  ];
  const rawEdges: RawEdge[] = [
    { from: '/root/src/repositories/userRepository.ts', to: '/root/src/domain/user.ts', external: false },
    { from: '/root/src/services/userService.ts', to: '/root/src/domain/user.ts', external: false },
  ];
  const layers: LayerModel = {
    strategy: 'known-layers',
    nodes: [
      { id: 'service', label: 'Services' },
      { id: 'domain', label: 'Domain' },
      { id: 'repository', label: 'Repositories' },
    ],
    edges: [
      { from: 'service', to: 'domain' },
      { from: 'domain', to: 'repository' },
    ],
  };

  const model = analyzeDependencies(rawEdges, files, '/root', layers);

  assert.deepEqual(model.violations, []);
});
