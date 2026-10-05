import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgram } from '../parser/project';
import { writeFixture } from './testFixture';
import { analyzeClasses } from './classes';

test('extracts classes, interfaces, members, and heritage', () => {
  const { file, dir } = writeFixture(
    'model.ts',
    `
    export interface Animal {
      name: string;
      speak(): string;
    }

    export class Dog implements Animal {
      private name: string = 'Rex';

      speak(): string {
        return 'Woof';
      }
    }
    `
  );

  const program = createProgram([file]);
  const model = analyzeClasses(program, [file], dir);

  assert.equal(model.interfaces.length, 1);
  assert.equal(model.interfaces[0].name, 'Animal');
  assert.equal(model.interfaces[0].methods[0].returnType, 'string');

  assert.equal(model.classes.length, 1);
  const dog = model.classes[0];
  assert.equal(dog.name, 'Dog');
  assert.deepEqual(dog.implements, ['Animal']);
  assert.equal(dog.properties[0].visibility, 'private');
  assert.equal(dog.methods[0].name, 'speak');
  assert.equal(dog.methods[0].returnType, 'string');
});
