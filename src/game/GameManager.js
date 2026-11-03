import { DIFFICULTIES, TIMING } from '../config.js';
import { PLAYABLE_LEVELS } from '../levels.js';
import { PUZZLES } from '../puzzles/index.js';
import { TOOLS, toolCost } from '../tools.js';
import { ScoreManager } from './ScoreManager.js';
import { Timer } from './Timer.js';

// idle/ended: no run in progress. input: accepting an answer.
// locked: run in progress, but answers are ignored (stage transition or
// post-mistake cooldown). The timer keeps running through locked.
const State = { IDLE: 'idle', INPUT: 'input', LOCKED: 'locked', ENDED: 'ended' };

export class GameManager {
  constructor({
    difficulty = DIFFICULTIES.normal,
    levels = PLAYABLE_LEVELS,
    score = new ScoreManager({ difficultyId: difficulty.id }),
    rng = Math.random,
    now,
  } = {}) {
    this.difficulty = difficulty;
    this.levels = levels;
    this.score = score;
    this.rng = rng;
    this.now = now;
    this.state = State.IDLE;
    this.timer = null;
    this.level = levels[0];
    this.stages = levels[0].stages;
    this.stageIndex = 0;
    this.mistakes = 0;
    this.shielded = false;
    this.hintsLeft = 0;
    this.puzzle = null;
    this.pendingId = null;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, detail = {}) {
    for (const listener of this.listeners) listener({ type, ...detail });
  }

  get inProgress() {
    return this.state === State.INPUT || this.state === State.LOCKED;
  }

  // Saved progress for one catalog entry, merged at read time.
  levelState({ id, stages }) {
    const playable = stages.length > 0;
    const unlocked = playable && id <= this.score.unlockedLevel;
    const completed = playable && this.score.isCleared(id);
    const status = completed ? 'completed' : unlocked ? 'available' : 'locked';
    return { unlocked, completed, status, best: this.score.bestFor(id) };
  }

  canAfford(toolIds) {
    return toolCost(toolIds) <= this.score.points;
  }

  start(levelId = 1, toolIds = []) {
    const level = this.levels.find(({ id }) => id === levelId);
    if (this.inProgress || !level || levelId > this.score.unlockedLevel) return false;
    if (!this.canAfford(toolIds)) return false;
    this.score.addPoints(-toolCost(toolIds));
    const bonusMs = TOOLS.find(({ id }) => id === 'time' && toolIds.includes(id))?.bonusMs ?? 0;
    this.level = level;
    this.stages = level.stages;
    this.stageIndex = 0;
    this.mistakes = 0;
    this.shielded = toolIds.includes('shield');
    this.hintsLeft = toolIds.includes('hint') ? 1 : 0;
    this.timer = new Timer({
      durationMs: this.difficulty.timeLimitMs + bonusMs,
      tickMs: TIMING.tickMs,
      now: this.now,
      onTick: (remainingMs) => this.emit('tick', { remainingMs }),
      onExpire: () => this.finish('timeout'),
    });
    this.emit('run-start', {
      level,
      stages: this.stages,
      shielded: this.shielded,
      hintsLeft: this.hintsLeft,
    });
    this.timer.start();
    this.loadStage();
    return true;
  }

  loadStage() {
    const stage = this.stages[this.stageIndex];
    this.puzzle = PUZZLES[stage.puzzle].generate({ tier: stage.tier, rng: this.rng });
    const { revealMs } = this.puzzle;
    this.state = revealMs ? State.LOCKED : State.INPUT;
    this.emit('stage', { index: this.stageIndex, stage, puzzle: this.puzzle });
    if (revealMs) {
      this.timer.pause(); // No answers yet, so these seconds are free.
      this.schedule(() => this.startRecall(), revealMs);
    }
  }

  startRecall() {
    this.state = State.INPUT;
    this.timer.resume();
    this.emit('recall-start');
  }

  submit(input) {
    if (this.state !== State.INPUT) return false;

    // Ticks are 100ms apart, so the clock may have run out since the last one.
    // The deadline decides: a late answer loses even if the tick hasn't fired.
    if (this.timer.remainingMs() <= 0) {
      this.finish('timeout');
      return false;
    }

    const stage = this.stages[this.stageIndex];
    if (PUZZLES[stage.puzzle].check(this.puzzle, input)) {
      this.handleCorrect();
    } else {
      this.handleWrong();
    }
    return true;
  }

  // Shows recall digits again for a price. The clock waits, as it did the first time.
  review() {
    const { reviewMs, reviewCostMs } = this.puzzle ?? {};
    if (this.state !== State.INPUT || !reviewMs) return false;
    if (this.timer.remainingMs() <= reviewCostMs) {
      this.emit('review-denied');
      return false;
    }
    this.timer.penalize(reviewCostMs);
    this.timer.pause();
    this.state = State.LOCKED;
    this.emit('review-start', { costMs: reviewCostMs });
    this.schedule(() => this.startRecall(), reviewMs);
    return true;
  }

  handleCorrect() {
    const index = this.stageIndex;
    this.stageIndex += 1;
    this.emit('correct', { index, solved: this.stageIndex });

    if (this.stageIndex === this.stages.length) {
      this.finish('cleared');
      return;
    }
    this.state = State.LOCKED;
    this.schedule(() => this.loadStage(), TIMING.stageTransitionMs);
  }

  useHint() {
    if (this.state !== State.INPUT || this.hintsLeft === 0) return false;
    this.hintsLeft -= 1;
    this.emit('hint-used');
    return true;
  }

  handleWrong() {
    this.mistakes += 1;
    const penaltyMs = this.shielded ? 0 : this.level.penaltyMs;
    if (this.shielded) {
      this.shielded = false;
      this.emit('shield-used');
    } else {
      this.timer.penalize(penaltyMs);
    }
    this.emit('wrong', { penaltyMs, mistakes: this.mistakes });

    if (this.timer.remainingMs() <= 0) {
      this.finish('penalty');
      return;
    }
    this.state = State.LOCKED;
    this.schedule(() => {
      this.state = State.INPUT;
      this.emit('unlocked');
    }, TIMING.wrongCooldownMs);
  }

  schedule(callback, delayMs) {
    this.pendingId = setTimeout(() => {
      this.pendingId = null;
      callback();
    }, delayMs);
  }

  // Leaves the run with no result. Tools already bought stay spent.
  abandon() {
    if (!this.inProgress) return false;
    this.state = State.IDLE;
    clearTimeout(this.pendingId);
    this.pendingId = null;
    this.timer.stop();
    this.emit('abandon');
    return true;
  }

  finish(cause) {
    if (!this.inProgress) return;
    this.state = State.ENDED;
    clearTimeout(this.pendingId);
    this.pendingId = null;
    this.timer.stop();

    const success = cause === 'cleared';
    const remainingMs = this.timer.remainingMs();
    const secondsLeft = Math.ceil(remainingMs / 1000);
    const solved = this.stageIndex;
    const score = this.score.calculate({ solved, success, secondsLeft });
    const { best, isNew } = this.score.record(this.level.id, score);
    const nextLevel = this.levels.find(({ id }) => id === this.level.id + 1)?.id ?? null;
    const firstClear = !this.score.isCleared(this.level.id);
    const pointsEarned = success
      ? this.score.pointsFor({ ...this.level, mistakes: this.mistakes, firstClear })
      : 0;
    this.score.addPoints(pointsEarned);
    if (success) this.score.markCleared(this.level.id);
    if (success && nextLevel) this.score.unlock(nextLevel);

    this.emit('end', {
      result: {
        success,
        cause,
        levelId: this.level.id,
        nextLevel: success ? nextLevel : null,
        secondsLeft,
        solved,
        total: this.stages.length,
        layer: Math.min(solved + 1, this.stages.length),
        mistakes: this.mistakes,
        score,
        best,
        isNew,
        pointsEarned,
        points: this.score.points,
      },
    });
  }
}
