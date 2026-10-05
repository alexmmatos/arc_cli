import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeLayers, layerKeyForModuleId } from './layers';

test('detects canonical layers regardless of nesting depth under src/', () => {
  const moduleIds = [
    'src/controllers/userController',
    'src/services/userService',
    'src/repositories/userRepository',
    'src/app',
  ];
  const model = analyzeLayers(moduleIds, []);

  assert.equal(model.strategy, 'known-layers');
  assert.deepEqual(model.nodes.map((n) => n.id), ['controller', 'service', 'repository']);
  assert.deepEqual(model.edges, [
    { from: 'controller', to: 'service' },
    { from: 'service', to: 'repository' },
  ]);
});

test('falls back to the real directory graph when no layer names are found', () => {
  const moduleIds = ['src/utils/format', 'src/helpers/parse'];
  const model = analyzeLayers(moduleIds, [{ from: 'src/utils/format', to: 'src/helpers/parse' }]);

  assert.equal(model.strategy, 'directory-graph');
  assert.deepEqual(model.nodes.map((n) => n.id).sort(), ['src/helpers', 'src/utils']);
  assert.deepEqual(model.edges, [{ from: 'src/utils', to: 'src/helpers' }]);
});

test('layerKeyForModuleId normalizes plurals (repositories -> repository)', () => {
  assert.equal(layerKeyForModuleId('src/repositories/userRepository'), 'repository');
  assert.equal(layerKeyForModuleId('src/domain/user'), 'domain');
  assert.equal(layerKeyForModuleId('src/utils/format'), null);
});
