import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RouteModel } from '../../model/types';
import { renderSequenceDiagram } from './index';

test('renders request -> calls -> return as sequence messages, raw (not HTML-escaped)', () => {
  const routes: RouteModel = {
    routes: [
      {
        method: 'POST',
        path: '/payments',
        handler: 'PaymentController.create',
        calls: ['paymentService.createPayment()', 'res.json()'],
        returns: 'Promise<void>',
        file: 'a',
        line: 1,
      },
    ],
  };

  const out = renderSequenceDiagram(routes);

  assert.match(out, /^sequenceDiagram/);
  assert.match(out, /Client->>PaymentController_create: POST \/payments/);
  assert.match(out, /PaymentController_create->>paymentService: createPayment\(\)/);
  assert.match(out, /PaymentController_create-->>Client: returns Promise<void>/);
  // The real bug: mermaid's sequence parser decodes HTML entities before
  // re-tokenizing, so an escaped "&lt;" breaks parsing worse than a raw "<" does.
  assert.doesNotMatch(out, /&lt;|&gt;/);
});

test('declares each participant only once across multiple routes sharing a dependency', () => {
  const routes: RouteModel = {
    routes: [
      { method: 'GET', path: '/a', handler: 'A.one', calls: ['shared.run()'], returns: 'void', file: 'f', line: 1 },
      { method: 'GET', path: '/b', handler: 'B.two', calls: ['shared.run()'], returns: 'void', file: 'f', line: 2 },
    ],
  };

  const out = renderSequenceDiagram(routes);
  const declarations = out.split('\n').filter((l) => l.includes('participant shared'));

  assert.equal(declarations.length, 1);
});
