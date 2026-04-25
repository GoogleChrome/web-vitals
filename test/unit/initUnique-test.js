import {describe, it} from 'node:test';
import assert from 'node:assert';
import {initUnique} from '../../dist/modules/lib/initUnique.js';

class A {}
class B {}

describe('initUnique', () => {
  it('returns the same instance for the same class and same opts', () => {
    const opts = {};
    assert.strictEqual(initUnique(opts, A), initUnique(opts, A));
  });

  it('returns different instances for different classes with the same opts', () => {
    const opts = {};
    const a = initUnique(opts, A);
    const b = initUnique(opts, B);
    assert.notStrictEqual(a, b);
    assert.ok(a instanceof A);
    assert.ok(b instanceof B);
  });

  it('returns different instances for the same class with different opts', () => {
    assert.notStrictEqual(initUnique({}, A), initUnique({}, A));
  });
});
