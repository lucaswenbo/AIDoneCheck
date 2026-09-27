import test from 'node:test';
import assert from 'node:assert/strict';
import {sum} from '../src/sum.js';
test('addition returns the actual sum', () => assert.equal(sum(2, 2), 4));
test('addition accepts negative numbers', () => assert.equal(sum(-2, 3), 1));
