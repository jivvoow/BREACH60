import { pick, randomInt, shuffle } from './random.js';

export const GRID_SIZE = 3;
const CELLS = GRID_SIZE * GRID_SIZE;
const OPTION_COUNT = 4;

const remap = (locate) => (frame) => frame.map((_, i) => {
  const col = i % GRID_SIZE;
  const row = Math.floor(i / GRID_SIZE);
  const [c, r] = locate(col, row);
  return frame[r * GRID_SIZE + c];
});

const last = GRID_SIZE - 1;
const wrap = (value) => (value + GRID_SIZE) % GRID_SIZE;

const shiftRight = remap((c, r) => [wrap(c - 1), r]);
const shiftLeft = remap((c, r) => [wrap(c + 1), r]);
const shiftDown = remap((c, r) => [c, wrap(r - 1)]);
const shiftUp = remap((c, r) => [c, wrap(r + 1)]);
const rotateCw = remap((c, r) => [r, last - c]);
const rotateCcw = remap((c, r) => [last - r, c]);
const mirror = remap((c, r) => [last - c, r]);
const flip = remap((c, r) => [c, last - r]);
const invert = (frame) => frame.map((lit) => !lit);
const then = (first, second) => (frame) => second(first(frame));

// Every rule turns one frame into the next the same way.
const SHIFT_RULES = [shiftRight, shiftLeft, shiftDown, shiftUp];
const FLIP_RULES = [mirror, flip];
const TURN_RULES = [rotateCw, rotateCcw];
const DIAGONAL_RULES = [then(shiftRight, shiftDown), then(shiftLeft, shiftDown)];
// Only ever wrong options: they look clearly different from the shown frames.
const INVERT_RULES = [then(shiftRight, invert), then(shiftDown, invert), then(rotateCw, invert)];
const RULES = [
  ...SHIFT_RULES,
  ...FLIP_RULES,
  ...TURN_RULES,
  ...DIAGONAL_RULES,
  ...INVERT_RULES,
];

// Fewer lit cells are easier to follow from frame to frame.
const TIERS = {
  1: { rules: SHIFT_RULES, minLit: 2, maxLit: 3 },
  2: { rules: [...SHIFT_RULES, ...FLIP_RULES], minLit: 3, maxLit: 3 },
  3: { rules: [...SHIFT_RULES, ...FLIP_RULES, ...TURN_RULES], minLit: 3, maxLit: 4 },
  4: { rules: [...TURN_RULES, ...DIAGONAL_RULES], minLit: 3, maxLit: 4 },
};

const same = (a, b) => a.every((lit, i) => lit === b[i]);

function randomFrame(rng, { minLit, maxLit }) {
  const lit = randomInt(rng, minLit, maxLit);
  return shuffle(rng, Array.from({ length: CELLS }, (_, i) => i < lit));
}

// The answers every rule that fits the shown frames would predict.
export function predictions({ frames }) {
  const [a, b, c] = frames;
  return RULES
    .filter((rule) => same(rule(a), b) && same(rule(b), c))
    .map((rule) => rule(c));
}

export function isSolvable(puzzle) {
  const { frames, options, answer } = puzzle;
  const predicted = predictions(puzzle);
  return predicted.length > 0
    && predicted.every((frame) => same(frame, options[answer]))
    && !same(frames[0], frames[1])
    && !same(frames[2], options[answer])
    && options.every((a, i) => options.every((b, j) => i === j || !same(a, b)));
}

function generate({ tier = 2, rng = Math.random }) {
  let puzzle;
  do {
    const rule = pick(rng, TIERS[tier].rules);
    const first = randomFrame(rng, TIERS[tier]);
    const second = rule(first);
    const third = rule(second);
    const correct = rule(third);
    const decoys = shuffle(rng, RULES).map((other) => other(third)).slice(0, OPTION_COUNT - 1);
    const options = shuffle(rng, [correct, ...decoys]);
    puzzle = {
      frames: [first, second, third],
      options,
      answer: options.indexOf(correct),
    };
  } while (!isSolvable(puzzle));
  return {
    ...puzzle,
    textKey: 'pattern',
    hintKey: `pattern${tier}`,
    textValues: {},
  };
}

export const patternPuzzle = {
  id: 'pattern',
  command: 'decode',
  generate,
  check: (puzzle, input) => input === puzzle.answer,
};
