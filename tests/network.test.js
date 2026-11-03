import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findRoutes,
  isSolvable,
  isValidRoute,
  neighborsOf,
  networkPuzzle,
} from '../src/puzzles/network.js';

const RUNS = 3_000;

test('every generated network is solvable and needs a detour', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const puzzle = networkPuzzle.generate({});
    assert.ok(isSolvable(puzzle), JSON.stringify(puzzle));
    assert.ok(networkPuzzle.check(puzzle, puzzle.answer));
    assert.ok(findRoutes(puzzle).length > 0);
    assert.equal(new Set(puzzle.relays).size, puzzle.relays.length);
  }
});

test('relay count follows the tier', () => {
  for (const [tier, relays] of [[1, 2], [2, 2], [3, 3], [4, 4], [5, 5]]) {
    for (let i = 0; i < 300; i += 1) {
      const puzzle = networkPuzzle.generate({ tier });
      assert.equal(puzzle.relays.length, relays);
      assert.ok(isSolvable(puzzle));
    }
  }
});

test('check accepts any valid route, not just the generated one', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const puzzle = networkPuzzle.generate({});
    for (const route of findRoutes(puzzle)) assert.ok(networkPuzzle.check(puzzle, route));
  }
});

test('check rejects bad routes', () => {
  const puzzle = networkPuzzle.generate({});
  const { answer, relays, start } = puzzle;

  assert.equal(isValidRoute(puzzle, '0000'), false);
  assert.equal(isValidRoute(puzzle, []), false);
  assert.equal(isValidRoute(puzzle, answer.slice(1)), false, 'wrong start');
  assert.equal(isValidRoute(puzzle, answer.slice(0, -1)), false, 'wrong end');
  assert.equal(isValidRoute(puzzle, answer.filter((id) => id !== relays[0])), false, 'skipped');

  const repeat = [answer[0], answer[1], answer[0], ...answer.slice(1)];
  assert.equal(isValidRoute(puzzle, repeat), false, 'repeated node');

  const stranger = [...Array(15).keys()].find((id) => !neighborsOf(puzzle, start).includes(id)
    && id !== start);
  assert.equal(isValidRoute(puzzle, [start, stranger, ...answer.slice(2)]), false, 'no link');
});
