import { pick, randomInt } from './random.js';

export const COLS = 5;
export const ROWS = 3;
const TIERS = {
  1: { relays: 2, minNodes: 6, maxNodes: 9 },
  2: { relays: 2, minNodes: 8, maxNodes: 11 },
  3: { relays: 3, minNodes: 8, maxNodes: 13 },
  4: { relays: 4, minNodes: 8, maxNodes: 13 },
  5: { relays: 5, minNodes: 10, maxNodes: 14 },
};
const DECOY_NODE_CHANCE = 0.6;
const EXTRA_LINK_CHANCE = 0.4;

const idOf = (col, row) => row * COLS + col;
const colOf = (id) => id % COLS;
const rowOf = (id) => Math.floor(id / COLS);

function gridNeighbors(id) {
  const col = colOf(id);
  const row = rowOf(id);
  return [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]
    .filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS)
    .map(([c, r]) => idOf(c, r));
}

function randomWalk(rng, start, target) {
  const walk = [start];
  let current = start;
  while (current !== target) {
    const options = gridNeighbors(current).filter((id) => !walk.includes(id));
    if (options.length === 0) return null;
    current = pick(rng, options);
    walk.push(current);
  }
  return walk;
}

function randomRoute(rng, start, target, { minNodes, maxNodes }) {
  let walk = null;
  while (!walk || walk.length < minNodes || walk.length > maxNodes) {
    walk = randomWalk(rng, start, target);
  }
  return walk;
}

// One relay from each equal slice of the route, so they spread across the board.
function chooseRelays(rng, route, count) {
  const inner = route.length - 2;
  return Array.from({ length: count }, (_, i) => {
    const from = 1 + Math.floor((inner * i) / count);
    const to = Math.floor((inner * (i + 1)) / count);
    return route[randomInt(rng, from, to)];
  });
}

const linkKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function buildLinks(rng, route) {
  const present = new Set(route);
  for (let id = 0; id < COLS * ROWS; id += 1) {
    if (rng() < DECOY_NODE_CHANCE) present.add(id);
  }
  const links = new Set(route.slice(1).map((id, i) => linkKey(route[i], id)));
  for (const a of present) {
    for (const b of gridNeighbors(a)) {
      if (a < b && present.has(b) && rng() < EXTRA_LINK_CHANCE) links.add(linkKey(a, b));
    }
  }
  return [...links].map((key) => key.split('-').map(Number));
}

export function neighborsOf(puzzle, id) {
  return puzzle.links.flatMap(([a, b]) => {
    if (a === id) return [b];
    return b === id ? [a] : [];
  });
}

export function isValidRoute(puzzle, route) {
  if (!Array.isArray(route)) return false;
  return route[0] === puzzle.start
    && route.at(-1) === puzzle.target
    && new Set(route).size === route.length
    && route.slice(1).every((id, i) => neighborsOf(puzzle, route[i]).includes(id))
    && puzzle.relays.every((relay) => route.includes(relay));
}

// Every valid route, by exhaustive search.
export function findRoutes(puzzle) {
  const routes = [];
  const walk = (route) => {
    const head = route.at(-1);
    if (head === puzzle.target) {
      if (isValidRoute(puzzle, route)) routes.push(route);
      return;
    }
    for (const next of neighborsOf(puzzle, head)) {
      if (!route.includes(next)) walk([...route, next]);
    }
  };
  walk([puzzle.start]);
  return routes;
}

function shortestDistance(puzzle) {
  const distance = new Map([[puzzle.start, 1]]);
  const queue = [puzzle.start];
  for (const id of queue) {
    for (const next of neighborsOf(puzzle, id)) {
      if (!distance.has(next)) {
        distance.set(next, distance.get(id) + 1);
        queue.push(next);
      }
    }
  }
  return distance.get(puzzle.target);
}

// Solvable, and the direct path must not work: the relays have to force a detour.
// Every row is used too, so the board never shows an empty strip.
export function isSolvable(puzzle) {
  if (new Set(puzzle.links.flat().map(rowOf)).size < ROWS) return false;
  const routes = findRoutes(puzzle);
  if (routes.length === 0) return false;
  return Math.min(...routes.map((route) => route.length)) > shortestDistance(puzzle);
}

function generate({ tier = 2, rng = Math.random }) {
  let puzzle;
  do {
    const start = idOf(0, randomInt(rng, 0, ROWS - 1));
    const target = idOf(COLS - 1, randomInt(rng, 0, ROWS - 1));
    const route = randomRoute(rng, start, target, TIERS[tier]);
    puzzle = {
      start,
      target,
      relays: chooseRelays(rng, route, TIERS[tier].relays),
      links: buildLinks(rng, route),
      answer: route,
    };
  } while (!isSolvable(puzzle));
  return {
    ...puzzle,
    textKey: 'network',
    textValues: {},
  };
}

export const networkPuzzle = {
  id: 'network',
  command: 'traceroute',
  generate,
  check: isValidRoute,
};
