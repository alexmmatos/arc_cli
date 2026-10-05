import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeFlowLabel, mermaidSafeType, slug } from './mermaidUtils';

test('slug replaces non-alphanumeric characters', () => {
  assert.equal(slug('src/services/dealService'), 'src_services_dealService');
});

test('escapeFlowLabel HTML-escapes angle brackets so they cannot be read as tags', () => {
  assert.equal(escapeFlowLabel('returns Promise<void>'), 'returns Promise&lt;void&gt;');
});

test('mermaidSafeType converts a simple generic to Mermaid tilde form', () => {
  assert.equal(mermaidSafeType('Promise<void>'), 'Promise~void~');
  assert.equal(mermaidSafeType('Promise<Payment>'), 'Promise~Payment~');
});

test('mermaidSafeType drops generic args that contain a comma (Mermaid generics cannot)', () => {
  assert.equal(mermaidSafeType('Record<string, number>'), 'Record');
});

test('mermaidSafeType turns a union into "or"', () => {
  assert.equal(mermaidSafeType('Customer | undefined'), 'Customer or undefined');
});

test('mermaidSafeType collapses an inline object-literal type to a safe placeholder', () => {
  assert.equal(mermaidSafeType('{ name: string; email: string }'), 'object');
});

test('mermaidSafeType leaves plain and array types untouched', () => {
  assert.equal(mermaidSafeType('string'), 'string');
  assert.equal(mermaidSafeType('Customer[]'), 'Customer[]');
});

test('mermaidSafeType never leaves a Mermaid-reserved character in its output', () => {
  const inputs = ['Promise<void>', 'Customer | undefined', '{ a: string }', 'Record<string, number>', 'Map<string, Array<number>>'];
  for (const input of inputs) {
    assert.doesNotMatch(mermaidSafeType(input), /[<>{}:;]/);
  }
});
