import { pick, randomInt, shuffle } from './random.js';

const USERS = ['admin', 'guest', 'ops', 'dev', 'audit', 'svc'];
const TERMINALS = ['T1', 'T2', 'T3', 'T4'];
const ACTIONS = ['READ', 'WRITE', 'COPY'];
const ALLOWED_CODES = 3;

const code = (rng) => `AC-${randomInt(rng, 10, 99)}`;

// Which rules a tier checks, and how big the log is. Each rule is also a kind
// of broken line; only the tier's rules are shown on screen.
const TIERS = {
  1: { rules: ['order'], lines: 5, users: 2 },
  2: { rules: ['order', 'code'], lines: 5, users: 2 },
  3: { rules: ['order', 'code', 'session'], lines: 6, users: 3 },
};

// Each rule passes or fails for a whole log.
const RULES = {
  // Times run from top to bottom.
  order: ({ lines }) => lines.every((line, i) => i === 0 || line.time >= lines[i - 1].time),
  code: ({ lines, codes }) => lines.every((line) => codes.includes(line.code)),
  // An ID logs in once, then only acts from that terminal.
  session: ({ lines }) => {
    const terminals = new Map();
    return lines.every(({ user, action, terminal }) => {
      if (action === 'LOGIN') {
        if (terminals.has(user)) return false;
        terminals.set(user, terminal);
        return true;
      }
      return terminals.get(user) === terminal;
    });
  },
};

export const brokenRules = (puzzle) => Object.keys(RULES).filter((rule) => !RULES[rule](puzzle));

// The lines whose removal would fix every broken rule.
export function suspects(puzzle) {
  const broken = brokenRules(puzzle);
  return puzzle.lines
    .map((_, i) => i)
    .filter((i) => {
      const without = { ...puzzle, lines: puzzle.lines.filter((__, j) => j !== i) };
      return broken.every((rule) => RULES[rule](without));
    });
}

export function isSolvable(puzzle) {
  const broken = brokenRules(puzzle);
  const found = suspects(puzzle);
  return broken.length === 1
    && puzzle.rules.includes(broken[0])
    && found.length === 1
    && found[0] === puzzle.answer;
}

function cleanLog(rng, { lines: count, users: userCount }) {
  const users = shuffle(rng, USERS).slice(0, userCount);
  const terminals = shuffle(rng, TERMINALS);
  const home = new Map(users.map((user, i) => [user, terminals[i]]));
  const codes = [];
  while (codes.length < ALLOWED_CODES) {
    const next = code(rng);
    if (!codes.includes(next)) codes.push(next);
  }

  const seen = new Set();
  let time = randomInt(rng, 8 * 3600, 20 * 3600);
  const lines = Array.from({ length: count }, () => {
    const user = pick(rng, users);
    const action = seen.has(user) ? pick(rng, ACTIONS) : 'LOGIN';
    seen.add(user);
    time += randomInt(rng, 40, 180);
    return { time, user, action, terminal: home.get(user), code: pick(rng, codes) };
  });
  return { lines, codes: codes.sort() };
}

// Breaks exactly one line. Returns its index.
const BREAKERS = {
  // At least two minutes before the line two above, so only this line can be
  // the one out of place.
  order: (rng, { lines }) => {
    const i = randomInt(rng, 2, lines.length - 1);
    lines[i].time = lines[i - 2].time - randomInt(rng, 120, 600);
    return i;
  },
  code: (rng, { lines, codes }) => {
    const i = randomInt(rng, 0, lines.length - 1);
    let next;
    do next = code(rng); while (codes.includes(next));
    lines[i].code = next;
    return i;
  },
  session: (rng, { lines }) => {
    const i = pick(rng, lines.flatMap((line, j) => (line.action === 'LOGIN' ? [] : [j])));
    lines[i].terminal = pick(rng, TERMINALS.filter((terminal) => terminal !== lines[i].terminal));
    return i;
  },
};

function generate({ tier = 1, rng = Math.random }) {
  const { rules } = TIERS[tier];
  let puzzle;
  do {
    const log = cleanLog(rng, TIERS[tier]);
    const answer = BREAKERS[pick(rng, rules)](rng, log);
    puzzle = { ...log, rules, answer };
  } while (!isSolvable(puzzle));
  return {
    ...puzzle,
    textKey: 'log',
    hintKey: `log${tier}`,
    textValues: { count: puzzle.lines.length },
  };
}

export const logPuzzle = {
  id: 'log',
  command: 'audit',
  generate,
  check: (puzzle, input) => input === puzzle.answer,
};
