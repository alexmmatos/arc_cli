import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgram } from '../parser/project';
import { writeFixture } from './testFixture';
import { analyzeFunctions } from './functions';

test('estimates Big-O from loop nesting and recursion', () => {
  const { file, dir } = writeFixture(
    'complexity.ts',
    `
    function constant(x: number): number {
      return x + 1;
    }

    function linear(items: number[]): number {
      let total = 0;
      for (const item of items) {
        total += item;
      }
      return total;
    }

    function quadratic(items: number[]): void {
      items.forEach((a) => {
        items.forEach((b) => {
          console.log(a, b);
        });
      });
    }

    function fib(n: number): number {
      if (n <= 1) return n;
      return fib(n - 1) + fib(n - 2);
    }

    class Counter {
      count(items: number[]): number {
        return items.filter((x) => x > 0).length;
      }
    }
    `
  );

  const program = createProgram([file]);
  const model = analyzeFunctions(program, [file], dir);
  const byName = Object.fromEntries(model.functions.map((f) => [f.name, f]));

  assert.equal(byName.constant.complexity, 'O(1)');
  assert.equal(byName.linear.complexity, 'O(n)');
  assert.equal(byName.quadratic.complexity, 'O(n²)');
  assert.equal(byName.fib.complexity, 'O(2^n) (recursive, multiple self-calls)');
  assert.equal(byName.linear.returnType, 'number');
  assert.equal(byName['Counter.count'].complexity, 'O(n)');
});

test('estimates logarithmic complexity from geometric loops, binary search, and halving recursion', () => {
  const { file, dir } = writeFixture(
    'logarithmic.ts',
    `
    function geometricFor(n: number): number {
      let steps = 0;
      for (let i = 1; i < n; i *= 2) {
        steps++;
      }
      return steps;
    }

    function geometricWhile(n: number): number {
      let steps = 0;
      while (n > 1) {
        n = Math.floor(n / 2);
        steps++;
      }
      return steps;
    }

    function binarySearch(arr: number[], target: number): number {
      let low = 0;
      let high = arr.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
      }
      return -1;
    }

    function binarySearchRecursive(arr: number[], target: number, low: number, high: number): number {
      if (low > high) return -1;
      const mid = Math.floor((low + high) / 2);
      if (arr[mid] === target) return mid;
      if (arr[mid] < target) return binarySearchRecursive(arr, target, mid + 1, high);
      return binarySearchRecursive(arr, target, low, mid - 1);
    }

    function mergeSort(items: number[]): number[] {
      if (items.length <= 1) return items;
      const mid = Math.floor(items.length / 2);
      const left = mergeSort(items.slice(0, mid));
      const right = mergeSort(items.slice(mid));
      return left.concat(right);
    }

    function sortEach(lists: number[][]): void {
      lists.forEach((list) => {
        let n = list.length;
        while (n > 1) {
          n = n >> 1;
        }
      });
    }
    `
  );

  const program = createProgram([file]);
  const model = analyzeFunctions(program, [file], dir);
  const byName = Object.fromEntries(model.functions.map((f) => [f.name, f]));

  assert.equal(byName.geometricFor.complexity, 'O(log n)');
  assert.equal(byName.geometricWhile.complexity, 'O(log n)');
  assert.equal(byName.binarySearch.complexity, 'O(log n)');
  assert.equal(byName.binarySearchRecursive.complexity, 'O(log n) (recursive)');
  assert.equal(byName.mergeSort.complexity, 'O(n log n) (recursive, divide-and-conquer)');
  assert.equal(byName.sortEach.complexity, 'O(n log n)');
});

test('resolves calls to other analyzed functions via the type checker, not the local variable name', () => {
  const { file, dir } = writeFixture(
    'callGraph.ts',
    `
    class Repository {
      save(x: number): number {
        return x;
      }
    }

    class Service {
      constructor(private repository: Repository) {}

      create(x: number): number {
        const saved = this.repository.save(x);
        return this.normalize(saved);
      }

      normalize(x: number): number {
        return x;
      }
    }

    function controller(service: Service): number {
      return service.create(1);
    }
    `
  );

  const program = createProgram([file]);
  const model = analyzeFunctions(program, [file], dir);
  const byName = Object.fromEntries(model.functions.map((f) => [f.name, f]));

  assert.deepEqual(byName['Service.create'].calls, ['Repository.save', 'Service.normalize']);
  assert.deepEqual(byName.controller.calls, ['Service.create']);
  assert.deepEqual(byName['Repository.save'].calls, []);
});
