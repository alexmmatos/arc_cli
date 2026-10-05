import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FunctionModel } from '../../model/types';
import { renderFunctionsDiagram } from './index';

test('draws a "calls" relation only to targets that are themselves analyzed functions', () => {
  const model: FunctionModel = {
    functions: [
      { name: 'Controller.create', file: 'a', line: 1, params: [], returnType: 'void', complexity: 'O(1)', calls: ['Service.create', 'Response.json'] },
      { name: 'Service.create', file: 'b', line: 1, params: [], returnType: 'Customer', complexity: 'O(1)', calls: [] },
    ],
  };

  const out = renderFunctionsDiagram(model);

  assert.match(out, /Controller_create --> Service_create : calls/);
  assert.doesNotMatch(out, /Response/);
});
