import { logPuzzle } from './log.js';
import { memoryPuzzle } from './memory.js';
import { networkPuzzle } from './network.js';
import { passwordPuzzle } from './password.js';
import { patternPuzzle } from './pattern.js';

// Puzzle contract:
//   title, subtitle, command            display text
//   generate({ tier, rng }) -> puzzle   always solvable, plain data
//                                       with rule, hint and answer
//   check(puzzle, input) -> boolean     pure answer validation
// Each puzzle also registers a view in src/ui/render.js (PUZZLE_VIEWS).
export const PUZZLES = {
  password: passwordPuzzle,
  network: networkPuzzle,
  pattern: patternPuzzle,
  memory: memoryPuzzle,
  log: logPuzzle,
};
