import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassModel } from '../../model/types';
import { renderClassesDiagram } from './index';

test('draws a "uses" relation when a class references another known class/interface in its signatures', () => {
  const model: ClassModel = {
    classes: [
      {
        name: 'CustomerService',
        file: 'a',
        implements: [],
        properties: [],
        methods: [
          { name: 'constructor', visibility: 'public', static: false, params: [{ name: 'repository', type: 'CustomerRepository' }], returnType: 'void' },
          { name: 'create', visibility: 'public', static: false, params: [], returnType: 'Customer' },
        ],
      },
      { name: 'CustomerRepository', file: 'b', implements: [], properties: [{ name: 'items', visibility: 'private', type: 'Customer[]' }], methods: [] },
    ],
    interfaces: [{ name: 'Customer', file: 'c', extends: [], properties: [], methods: [] }],
  };

  const out = renderClassesDiagram(model);

  assert.match(out, /CustomerService --> CustomerRepository : uses/);
  assert.match(out, /CustomerService --> Customer : uses/);
  assert.match(out, /CustomerRepository --> Customer : uses/);
});

test('does not duplicate a relation already drawn as extends/implements', () => {
  const model: ClassModel = {
    classes: [
      {
        name: 'Dog',
        file: 'a',
        extends: 'Animal',
        implements: [],
        properties: [],
        methods: [{ name: 'parent', visibility: 'public', static: false, params: [], returnType: 'Animal' }],
      },
      { name: 'Animal', file: 'b', implements: [], properties: [], methods: [] },
    ],
    interfaces: [],
  };

  const out = renderClassesDiagram(model);
  const relationLines = out.split('\n').filter((l) => /-->|--\|>|\.\.\|>/.test(l) && l.includes('Animal'));

  assert.equal(relationLines.length, 1);
  assert.match(relationLines[0], /extends/);
});
