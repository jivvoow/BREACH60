import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_CATALOG, PLAYABLE_LEVELS, sectorOf, TOTAL_LEVELS } from '../src/levels.js';
import { memoryPuzzle } from '../src/puzzles/memory.js';
import { PUZZLES } from '../src/puzzles/index.js';

test('the catalog holds every level in order', () => {
  assert.equal(LEVEL_CATALOG.length, TOTAL_LEVELS);
  LEVEL_CATALOG.forEach((level, i) => assert.equal(level.id, i + 1));
  assert.equal(sectorOf(10), 1);
  assert.equal(sectorOf(11), 2);
  assert.equal(sectorOf(100), 10);
});

test('levels 1-20 are playable and the rest are placeholders', () => {
  assert.deepEqual(PLAYABLE_LEVELS.map(({ id }) => id), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const level of LEVEL_CATALOG.slice(20)) assert.equal(level.stages.length, 0);
});

test('every playable level is complete, and every stage generates a solvable puzzle', () => {
  for (const level of PLAYABLE_LEVELS) {
    assert.ok(level.name.en && level.name.ko);
    assert.ok(level.difficulty >= 1 && level.difficulty <= 5);
    assert.ok(level.penaltyMs > 0);
    for (const stage of level.stages) {
      const definition = PUZZLES[stage.puzzle];
      for (let i = 0; i < 200; i += 1) {
        const puzzle = definition.generate({ tier: stage.tier });
        assert.ok(definition.check(puzzle, puzzle.answer));
      }
    }
  }
});

test('levels never get easier in layers or mistake cost', () => {
  PLAYABLE_LEVELS.slice(1).forEach((level, i) => {
    const previous = PLAYABLE_LEVELS[i];
    assert.ok(level.stages.length >= previous.stages.length);
    assert.ok(level.penaltyMs >= previous.penaltyMs);
  });
});

test('recall puzzles use the tier as memory length', () => {
  for (const [tier, length] of [[1, 4], [2, 5], [3, 6], [4, 7]]) {
    const puzzle = memoryPuzzle.generate({ tier });
    assert.equal(puzzle.length, length);
    assert.equal(puzzle.answer, puzzle.tiles.join(''));
    assert.ok(puzzle.revealMs > 0);
    assert.equal(memoryPuzzle.check(puzzle, puzzle.answer), true);
    assert.equal(memoryPuzzle.check(puzzle, `${puzzle.answer}0`), false);
  }
});
