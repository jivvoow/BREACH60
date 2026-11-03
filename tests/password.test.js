import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSolutions, isSolvable, passwordPuzzle } from '../src/puzzles/password.js';

const TIERS = [1, 2, 3, 4, 5];
const RUNS = 20_000;

test('every generated puzzle at every tier is solvable', () => {
  for (const tier of TIERS) {
    for (let i = 0; i < RUNS; i += 1) {
      const puzzle = passwordPuzzle.generate({ tier });
      assert.ok(isSolvable(puzzle), `tier ${tier}: ${JSON.stringify(puzzle)}`);
      assert.equal(puzzle.answer.length, puzzle.length);
      assert.equal(puzzle.tiles.length, puzzle.length);
      assert.ok(passwordPuzzle.check(puzzle, puzzle.answer));
    }
  }
});

test('deduction puzzles have exactly one answer', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const one = passwordPuzzle.generate({ tier: 4 });
    assert.deepEqual(findSolutions(one), [one.answer]);
    assert.ok(one.tiles.includes('A') && !one.tiles.includes('B'));

    const two = passwordPuzzle.generate({ tier: 5 });
    assert.deepEqual(findSolutions(two), [two.answer]);
    assert.ok(two.tiles.includes('A') && two.tiles.includes('B'));
  }
});

test('check rejects anything but the exact code', () => {
  const puzzle = passwordPuzzle.generate({ tier: 1 });
  const wrong = puzzle.answer === '0000' ? '0001' : '0000';
  for (const input of [wrong, '', puzzle.answer.slice(1), `${puzzle.answer}0`]) {
    assert.equal(passwordPuzzle.check(puzzle, input), false);
  }
});

test('rule text matches the produced answer', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const puzzle = passwordPuzzle.generate({ tier: 1 });
    const digits = puzzle.tiles.join('');
    const expected = {
      reverse: [...digits].reverse().join(''),
      ascending: [...digits].sort().join(''),
      descending: [...digits].sort().reverse().join(''),
    }[puzzle.textKey];
    assert.equal(puzzle.answer, expected);
  }
});
