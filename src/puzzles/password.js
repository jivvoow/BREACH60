import { pick, randomInt, shuffle } from './random.js';

const CODE_LENGTH = 4;
const CODE_PATTERN = /^\d{4}$/;

const wrap = (digit) => ((digit % 10) + 10) % 10;

function distinctDigits(rng, count) {
  return shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, count);
}

function transformRule(textKey, transform, textValues = {}) {
  return (rng) => {
    const digits = distinctDigits(rng, CODE_LENGTH);
    return {
      textKey,
      textValues,
      tiles: digits.map(String),
      answer: transform(digits).join(''),
      clues: [],
    };
  };
}

const shiftRule = (rng) => {
  const amount = randomInt(rng, 2, 7);
  return transformRule(
    'shift',
    (digits) => digits.map((digit) => wrap(digit + amount)),
    { amount, sum: 9 + amount, last: wrap(9 + amount) },
  )(rng);
};

const reverseShiftRule = (rng) => {
  const amount = randomInt(rng, 1, 3);
  return transformRule(
    'reverseShift',
    (digits) => [...digits].reverse().map((digit) => wrap(digit + amount)),
    { amount },
  )(rng);
};

// One digit is hidden behind A and given away by a single sum.
const deduceOneRule = (rng) => {
  const digits = distinctDigits(rng, CODE_LENGTH);
  const slot = randomInt(rng, 0, CODE_LENGTH - 1);
  const offset = randomInt(rng, 1, 5);
  const total = digits[slot] + offset;
  const tiles = digits.map(String);
  tiles[slot] = 'A';
  return {
    textKey: 'deduceOne',
    textValues: {},
    tiles,
    answer: digits.join(''),
    clues: [{ text: `A + ${offset} = ${total}`, offset, total }],
  };
};

// Two digits are hidden behind letters and pinned down by their sum and
// difference. A is always the larger digit, so the difference is never
// negative, and the two clues leave one option (findSolutions confirms it).
const deduceRule = (rng) => {
  const digits = distinctDigits(rng, CODE_LENGTH);
  const hiddenSlots = distinctDigits(rng, 10).filter((slot) => slot < CODE_LENGTH).slice(0, 2);
  const [slotA, slotB] = hiddenSlots.sort((x, y) => digits[y] - digits[x]);
  const a = digits[slotA];
  const b = digits[slotB];
  const tiles = digits.map(String);
  tiles[slotA] = 'A';
  tiles[slotB] = 'B';
  return {
    textKey: 'deduce',
    textValues: {},
    tiles,
    answer: digits.join(''),
    clues: [
      { text: `A + B = ${a + b}`, sum: a + b },
      { text: `A - B = ${a - b}`, difference: a - b },
    ],
  };
};

const RULES_BY_TIER = {
  1: [
    transformRule('reverse', (d) => [...d].reverse()),
    transformRule('ascending', (d) => [...d].sort((a, b) => a - b)),
    transformRule('descending', (d) => [...d].sort((a, b) => b - a)),
  ],
  2: [
    shiftRule,
    transformRule('swap', ([a, b, c, d]) => [b, a, d, c]),
    transformRule('complement', (d) => d.map((digit) => 9 - digit)),
  ],
  3: [
    reverseShiftRule,
    transformRule('position', (d) => d.map((digit, i) => wrap(digit + i + 1))),
  ],
  4: [deduceOneRule],
  5: [deduceRule],
};

// All codes that satisfy the visible tiles and clues (deduction puzzles only).
export function findSolutions({ tiles, clues }) {
  const solutions = [];
  const lastB = tiles.includes('B') ? 9 : 0;
  for (let a = 0; a <= 9; a += 1) {
    for (let b = 0; b <= lastB; b += 1) {
      const fitsClues = clues.every(({ sum, difference, offset, total }) =>
        (sum === undefined || a + b === sum)
        && (difference === undefined || a - b === difference)
        && (offset === undefined || a + offset === total));
      if (fitsClues) {
        solutions.push(tiles.map((tile) => ({ A: a, B: b })[tile] ?? tile).join(''));
      }
    }
  }
  return solutions;
}

export function isSolvable(puzzle) {
  if (!CODE_PATTERN.test(puzzle.answer)) return false;
  if (puzzle.clues.length > 0) {
    const solutions = findSolutions(puzzle);
    return solutions.length === 1 && solutions[0] === puzzle.answer;
  }
  // Rule puzzles: the answer must take work, not just retyping the tiles.
  return puzzle.answer !== puzzle.tiles.join('');
}

function generate({ tier, rng = Math.random }) {
  const rules = RULES_BY_TIER[tier];
  let puzzle;
  do {
    puzzle = pick(rng, rules)(rng);
  } while (!isSolvable(puzzle));
  return { ...puzzle, length: CODE_LENGTH };
}

export const passwordPuzzle = {
  id: 'password',
  command: 'decrypt',
  generate,
  check: (puzzle, input) => input === puzzle.answer,
};
