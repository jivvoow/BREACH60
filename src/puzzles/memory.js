import { shuffle } from './random.js';

// Memory length and how long the digits stay on screen.
const TIERS = {
  1: { length: 4, revealMs: 3_000 },
  2: { length: 5, revealMs: 3_000 },
  3: { length: 6, revealMs: 3_500 },
  4: { length: 7, revealMs: 4_000 },
};

// Seeing the digits again, for players who forgot them.
const REVIEW = { reviewMs: 2_000, reviewCostMs: 5_000 };

function generate({ tier = 1, rng = Math.random }) {
  const { length, revealMs } = TIERS[tier];
  const digits = shuffle(rng, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']).slice(0, length);
  return {
    tiles: digits,
    answer: digits.join(''),
    clues: [],
    length,
    revealMs,
    ...REVIEW,
    textKey: 'memory',
    textValues: { seconds: revealMs / 1000 },
  };
}

export const memoryPuzzle = {
  id: 'memory',
  command: 'recall',
  generate,
  check: (puzzle, input) => input === puzzle.answer,
};
