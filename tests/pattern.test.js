import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSolvable, patternPuzzle, predictions } from '../src/puzzles/pattern.js';

const RUNS = 20_000;

test('every generated pattern has exactly one correct option', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const puzzle = patternPuzzle.generate({ tier: (i % 4) + 1 });
    assert.ok(isSolvable(puzzle), JSON.stringify(puzzle));
    assert.equal(puzzle.options.length, 4);

    const predicted = predictions(puzzle)[0];
    const matches = puzzle.options.filter((option) =>
      option.every((lit, cell) => lit === predicted[cell]));
    assert.equal(matches.length, 1);
    assert.ok(patternPuzzle.check(puzzle, puzzle.answer));
  }
});

test('check rejects the other options', () => {
  const puzzle = patternPuzzle.generate({});
  for (let i = 0; i < puzzle.options.length; i += 1) {
    assert.equal(patternPuzzle.check(puzzle, i), i === puzzle.answer);
  }
  assert.equal(patternPuzzle.check(puzzle, '0000'), false);
});
