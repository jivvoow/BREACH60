import { POINTS, SCORING } from '../config.js';

const STORAGE_PREFIX = 'breach60.';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // Access can throw when site data is blocked.
  }
}

// Scores and level progress. Everything also lives in `session`, so the game
// keeps working for the visit when storage is unavailable.
export class ScoreManager {
  constructor({ difficultyId, storage = defaultStorage() }) {
    this.prefix = `${STORAGE_PREFIX}${difficultyId}.`;
    this.storage = storage;
    this.session = new Map();
  }

  calculate({ solved, success, secondsLeft }) {
    const puzzles = solved * SCORING.perPuzzle;
    if (!success) return puzzles;
    return puzzles + SCORING.successBonus + secondsLeft * SCORING.perSecondLeft;
  }

  pointsFor({ difficulty, mistakes, firstClear }) {
    const earned = POINTS.clearBase
      + difficulty * POINTS.perDifficulty
      + (mistakes === 0 ? POINTS.noMistakeBonus : 0);
    return Math.round(earned * (firstClear ? 1 : POINTS.replayRatio));
  }

  get points() {
    return this.read('points');
  }

  addPoints(amount) {
    this.write('points', this.points + amount);
  }

  read(key) {
    if (this.session.has(key)) return this.session.get(key);
    let stored = 0;
    try {
      stored = Number.parseInt(this.storage?.getItem(this.prefix + key), 10);
    } catch {
      stored = 0;
    }
    return Number.isFinite(stored) ? stored : 0;
  }

  write(key, value) {
    this.session.set(key, value);
    try {
      this.storage?.setItem(this.prefix + key, String(value));
    } catch {
      // Storage full or blocked: the session still holds it.
    }
  }

  bestFor(levelId) {
    return this.read(`best.${levelId}`);
  }

  record(levelId, score) {
    const isNew = score > this.bestFor(levelId);
    if (isNew) this.write(`best.${levelId}`, score);
    return { best: this.bestFor(levelId), isNew };
  }

  // Highest level the player may start. Level 1 is always open.
  get unlockedLevel() {
    return Math.max(1, this.read('unlocked'));
  }

  unlock(levelId) {
    if (levelId > this.unlockedLevel) this.write('unlocked', levelId);
  }

  markCleared(levelId) {
    if (levelId > this.read('cleared')) this.write('cleared', levelId);
  }

  // Levels clear in order. The unlock check keeps saves from before `cleared`.
  isCleared(levelId) {
    return levelId <= this.read('cleared') || levelId < this.unlockedLevel;
  }
}
