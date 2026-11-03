import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brokenRules, isSolvable, logPuzzle, suspects } from '../src/puzzles/log.js';

const RUNS = 20_000;

test('every generated log breaks one shown rule on exactly one line', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const tier = (i % 3) + 1;
    const puzzle = logPuzzle.generate({ tier });
    assert.ok(isSolvable(puzzle), JSON.stringify(puzzle));
    assert.deepEqual(suspects(puzzle), [puzzle.answer]);
    assert.equal(puzzle.lines.length, tier === 3 ? 6 : 5);
    assert.ok(logPuzzle.check(puzzle, puzzle.answer));
  }
});

test('low tiers only break the time order, higher tiers mix every kind', () => {
  const kinds = (tier) => {
    const seen = new Set();
    for (let i = 0; i < 2_000; i += 1) seen.add(...brokenRules(logPuzzle.generate({ tier })));
    return [...seen].sort();
  };
  assert.deepEqual(kinds(1), ['order']);
  assert.deepEqual(kinds(2), ['code', 'order']);
  assert.deepEqual(kinds(3), ['code', 'order', 'session']);
});

test('a broken time is out of place on its own', () => {
  for (let i = 0; i < 2_000; i += 1) {
    const { lines, answer } = logPuzzle.generate({ tier: 1 });
    assert.ok(answer >= 2);
    assert.ok(lines[answer].time < lines[answer - 2].time);
  }
});

test('check rejects the other lines', () => {
  const puzzle = logPuzzle.generate({ tier: 3 });
  puzzle.lines.forEach((_, i) => assert.equal(logPuzzle.check(puzzle, i), i === puzzle.answer));
  assert.equal(logPuzzle.check(puzzle, String(puzzle.answer)), false);
});
