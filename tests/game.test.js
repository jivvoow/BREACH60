import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { DIFFICULTIES, TIMING } from '../src/config.js';
import { GameManager } from '../src/game/GameManager.js';
import { ScoreManager } from '../src/game/ScoreManager.js';
import { LEVEL_CATALOG, PLAYABLE_LEVELS } from '../src/levels.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

const STAGES = PLAYABLE_LEVELS[0].stages;
const LAST_LEVEL = PLAYABLE_LEVELS.length;

let clockMs;

function advance(ms) {
  // Moves the fake clock in sync with mocked timers, as a real browser would.
  for (let left = ms; left > 0; left -= 10) {
    clockMs += Math.min(10, left);
    mock.timers.tick(Math.min(10, left));
  }
}

function setup(storage = memoryStorage()) {
  const score = new ScoreManager({ difficultyId: 'normal', storage });
  const game = new GameManager({ score, now: () => clockMs });
  const events = [];
  game.subscribe((event) => {
    if (event.type !== 'tick') events.push(event);
  });
  const count = (type) => events.filter((event) => event.type === type).length;
  const result = () => events.find((event) => event.type === 'end')?.result;
  return { game, events, count, result };
}

const wrongCode = (game) => (game.puzzle.answer === '0000' ? '0001' : '0000');

function solveCurrent(game) {
  advance(game.puzzle.revealMs ?? 0);
  game.submit(game.puzzle.answer);
  advance(TIMING.stageTransitionMs);
}

beforeEach(() => {
  clockMs = 1000;
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
});

afterEach(() => mock.timers.reset());

test('clearing all layers grants access and scores per the rules', () => {
  const { game, result } = setup();
  game.start();
  advance(1000);
  for (let i = 0; i < STAGES.length; i += 1) solveCurrent(game);

  const { success, solved, secondsLeft, score, pointsEarned } = result();
  assert.equal(success, true);
  assert.equal(solved, STAGES.length);
  assert.ok(secondsLeft > 50);
  assert.equal(score, STAGES.length * 100 + 200 + secondsLeft * 10);
  assert.equal(pointsEarned, 40); // 20 base + 10 difficulty + 10 no mistakes.
});

test('the timer runs through stage transitions', () => {
  const { game } = setup();
  game.start();
  const before = game.timer.remainingMs();
  game.submit(game.puzzle.answer);
  advance(TIMING.stageTransitionMs);
  assert.equal(game.timer.remainingMs(), before - TIMING.stageTransitionMs);
});

test('time running out denies access and stops the timer', () => {
  const { game, count, result } = setup();
  game.start();
  solveCurrent(game);
  advance(DIFFICULTIES.normal.timeLimitMs);

  assert.equal(result().success, false);
  assert.equal(result().cause, 'timeout');
  assert.equal(result().score, 100);
  assert.equal(result().layer, 2);
  assert.equal(game.timer.running, false);
  advance(5000);
  assert.equal(count('end'), 1);
});

test('a wrong answer costs 5 seconds', () => {
  const { game, result } = setup();
  game.start();
  game.submit(wrongCode(game));
  assert.equal(game.timer.remainingMs(), 55_000);
  assert.equal(result(), undefined);
});

test('rapid correct submissions count once', () => {
  const { game, count } = setup();
  game.start();
  const { answer } = game.puzzle;
  game.submit(answer);
  game.submit(answer);
  game.submit(answer);
  assert.equal(count('correct'), 1);
  assert.equal(game.stageIndex, 1);
});

test('rapid wrong submissions cost one penalty per cooldown', () => {
  const { game, count } = setup();
  game.start();
  const wrong = wrongCode(game);
  game.submit(wrong);
  game.submit(wrong);
  game.submit(wrong);
  assert.equal(count('wrong'), 1);
  advance(TIMING.wrongCooldownMs);
  game.submit(wrong);
  assert.equal(count('wrong'), 2);
});

test('an answer after the deadline loses, even before the next tick fires', () => {
  const { game, count, result } = setup();
  game.start();
  // Jump the clock past the deadline without letting the interval run.
  clockMs += DIFFICULTIES.normal.timeLimitMs;
  game.submit(game.puzzle.answer);
  assert.equal(count('correct'), 0);
  assert.equal(result().cause, 'timeout');
  assert.equal(result().success, false);
});

test('an answer in the last moment still wins', () => {
  const { game, result } = setup();
  game.start();
  for (let i = 0; i < STAGES.length - 1; i += 1) solveCurrent(game);
  clockMs = 1000 + DIFFICULTIES.normal.timeLimitMs - 1;
  game.submit(game.puzzle.answer);
  assert.equal(result().success, true);
  assert.equal(result().secondsLeft, 1);
});

test('a penalty that drains the clock ends the run once', () => {
  const { game, count, result } = setup();
  game.start();
  advance(DIFFICULTIES.normal.timeLimitMs - 3000);
  game.submit(wrongCode(game));
  assert.equal(result().cause, 'penalty');
  assert.equal(result().secondsLeft, 0);
  advance(5000);
  assert.equal(count('end'), 1);
});

test('expiring during a stage transition does not load the next stage', () => {
  const { game, count } = setup();
  game.start();
  advance(DIFFICULTIES.normal.timeLimitMs - 100);
  game.submit(game.puzzle.answer);
  advance(TIMING.stageTransitionMs + 100);
  assert.equal(count('end'), 1);
  assert.equal(count('stage'), 1);
});

test('start is ignored during a run; repeated retry starts one run', () => {
  const { game, count } = setup();
  assert.equal(game.start(), true);
  assert.equal(game.start(), false);
  assert.equal(count('run-start'), 1);

  advance(DIFFICULTIES.normal.timeLimitMs);
  assert.equal(game.start(), true);
  assert.equal(game.start(), false);
  assert.equal(game.start(), false);
  assert.equal(count('run-start'), 2);
  assert.equal(game.timer.remainingMs(), DIFFICULTIES.normal.timeLimitMs);
});

test('retry leaves no leftover timer from the previous run', () => {
  const { game, count } = setup();
  game.start();
  game.submit(game.puzzle.answer); // Pending stage transition.
  advance(DIFFICULTIES.normal.timeLimitMs);
  assert.equal(count('end'), 1);
  game.start();
  advance(DIFFICULTIES.normal.timeLimitMs);
  assert.equal(count('end'), 2);
});

test('best score survives a reload and only ever rises', () => {
  const storage = memoryStorage();
  const first = new ScoreManager({ difficultyId: 'normal', storage });
  assert.deepEqual(first.record(1, 500), { best: 500, isNew: true });
  assert.deepEqual(first.record(1, 300), { best: 500, isNew: false });

  const reloaded = new ScoreManager({ difficultyId: 'normal', storage });
  assert.equal(reloaded.bestFor(1), 500);
  assert.equal(reloaded.bestFor(2), 0);
});

test('scores work with broken or unavailable storage', () => {
  const garbled = new ScoreManager({
    difficultyId: 'normal',
    storage: memoryStorage({ 'breach60.normal.best.1': 'not-a-number', 'breach60.normal.unlocked': 'x' }),
  });
  assert.equal(garbled.bestFor(1), 0);
  assert.equal(garbled.unlockedLevel, 1);

  const blocked = new ScoreManager({
    difficultyId: 'normal',
    storage: {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
    },
  });
  assert.deepEqual(blocked.record(1, 400), { best: 400, isNew: true });
});

function clearLevel(game) {
  for (let i = 0; i < game.stages.length; i += 1) solveCurrent(game);
}

test('locked levels cannot start; clearing a level unlocks the next', () => {
  const { game, result } = setup();
  assert.equal(game.start(2), false);
  game.start(1);
  clearLevel(game);
  assert.equal(result().nextLevel, 2);
  assert.equal(game.score.unlockedLevel, 2);
  assert.equal(game.start(2), true);
  assert.equal(game.level.id, 2);
});

test('failing a level unlocks nothing', () => {
  const { game, result } = setup();
  game.start(1);
  advance(DIFFICULTIES.normal.timeLimitMs);
  assert.equal(result().nextLevel, null);
  assert.equal(game.score.unlockedLevel, 1);
});

test('progress survives a reload, and replaying keeps it', () => {
  const storage = memoryStorage();
  const { game } = setup(storage);
  game.start(1);
  clearLevel(game);
  game.start(2);
  clearLevel(game);
  game.start(1);
  clearLevel(game);
  assert.equal(setup(storage).game.score.unlockedLevel, 3);
});

test('later levels charge their own penalty', () => {
  const storage = memoryStorage({ 'breach60.normal.unlocked': String(LAST_LEVEL) });
  const { game } = setup(storage);
  game.start(LAST_LEVEL);
  game.submit(wrongCode(game));
  assert.equal(game.timer.remainingMs(), 60_000 - PLAYABLE_LEVELS.at(-1).penaltyMs);
});

test('the last level reports no next level', () => {
  const storage = memoryStorage({ 'breach60.normal.unlocked': String(LAST_LEVEL) });
  const { game, result } = setup(storage);
  game.start(LAST_LEVEL);
  clearLevel(game);
  assert.equal(result().success, true);
  assert.equal(result().nextLevel, null);
  assert.equal(game.levelState(PLAYABLE_LEVELS.at(-1)).completed, true);
});

test('level state merges saved progress with the catalog', () => {
  const { game } = setup();
  const state = (id) => game.levelState(LEVEL_CATALOG[id - 1]);
  assert.equal(state(1).status, 'available');
  assert.equal(state(2).status, 'locked');
  game.start(1);
  clearLevel(game);
  assert.equal(state(1).status, 'completed');
  assert.ok(state(1).best > 0);
  assert.equal(state(2).status, 'available');
  assert.equal(state(3).status, 'locked');
});

test('uncharted levels stay locked even with a tampered save', () => {
  const storage = memoryStorage({ 'breach60.normal.unlocked': '50' });
  const { game } = setup(storage);
  assert.equal(game.levelState(LEVEL_CATALOG[30]).unlocked, false);
  assert.equal(game.start(31), false);
});

test('saves from before cleared tracking still show completed levels', () => {
  const storage = memoryStorage({ 'breach60.normal.unlocked': '4' });
  const { game } = setup(storage);
  assert.equal(game.levelState(LEVEL_CATALOG[2]).completed, true);
  assert.equal(game.levelState(LEVEL_CATALOG[3]).completed, false);
});
test('tools cost points, and a run without enough points does not start', () => {
  const { game, count } = setup();
  assert.equal(game.start(1, ['hint']), false);
  assert.equal(count('run-start'), 0);

  game.score.addPoints(100);
  assert.equal(game.start(1, ['time', 'shield', 'hint']), true);
  assert.equal(game.score.points, 40);
  assert.equal(game.timer.remainingMs(), 63_000);
});

test('the shield absorbs one mistake, once', () => {
  const { game, count } = setup();
  game.score.addPoints(25);
  game.start(1, ['shield']);
  game.submit(wrongCode(game));
  assert.equal(game.timer.remainingMs(), 60_000);
  assert.equal(count('shield-used'), 1);
  advance(TIMING.wrongCooldownMs);
  const before = game.timer.remainingMs();
  game.submit(wrongCode(game));
  assert.equal(game.timer.remainingMs(), before - 5_000);
  assert.equal(count('shield-used'), 1);
});

test('a hint works once, only while answering', () => {
  const { game, count } = setup();
  game.score.addPoints(15);
  assert.equal(game.useHint(), false);
  game.start(1, ['hint']);
  assert.equal(game.useHint(), true);
  assert.equal(game.useHint(), false);
  assert.equal(count('hint-used'), 1);
});

test('tools are lost on a failed run', () => {
  const { game, result } = setup();
  game.score.addPoints(20);
  game.start(1, ['time']);
  advance(63_000);
  assert.equal(result().success, false);
  assert.equal(result().pointsEarned, 0);
  assert.equal(game.score.points, 0);
});

test('replays pay a quarter, and mistakes cost the bonus', () => {
  const { game, events } = setup();
  game.start(1);
  clearLevel(game);
  game.start(1);
  clearLevel(game);
  game.start(1);
  game.submit(wrongCode(game));
  advance(TIMING.wrongCooldownMs);
  clearLevel(game);
  const earned = events.filter(({ type }) => type === 'end').map(({ result }) => result.pointsEarned);
  assert.deepEqual(earned, [40, 10, 8]);
  assert.equal(game.score.points, 58);
});

test('points survive a reload', () => {
  const storage = memoryStorage();
  new ScoreManager({ difficultyId: 'normal', storage }).addPoints(70);
  assert.equal(new ScoreManager({ difficultyId: 'normal', storage }).points, 70);
});

function startOnRecall(storage = memoryStorage({ 'breach60.normal.unlocked': '2' })) {
  const context = setup(storage);
  context.game.start(2); // Level 2 opens with a recall layer.
  return context;
}

test('the clock stops while recall digits show, and answers are ignored', () => {
  const { game, count } = startOnRecall();
  assert.ok(game.puzzle.revealMs > 0);
  game.submit(game.puzzle.answer);
  game.submit('0000');
  assert.equal(count('correct') + count('wrong'), 0);
  advance(1000);
  assert.equal(game.timer.remainingMs(), 60_000);
});

test('the clock runs once the digits hide', () => {
  const { game, count } = startOnRecall();
  advance(game.puzzle.revealMs);
  assert.equal(count('recall-start'), 1);
  assert.equal(game.timer.remainingMs(), 60_000);
  advance(2000);
  assert.equal(game.timer.remainingMs(), 58_000);
  game.submit('0');
  assert.equal(game.timer.remainingMs(), 53_000);
});

test('time can run out on a recall layer', () => {
  const { game, result } = startOnRecall();
  advance(game.puzzle.revealMs);
  advance(60_000);
  assert.equal(result().cause, 'timeout');
});

test('a recall layer later in a run stops the clock too', () => {
  const storage = memoryStorage({ 'breach60.normal.unlocked': '5' });
  const { game } = setup(storage);
  game.start(5);
  solveCurrent(game);
  solveCurrent(game);
  assert.ok(game.puzzle.revealMs > 0);
  const held = game.timer.remainingMs();
  advance(1000);
  assert.equal(game.timer.remainingMs(), held);
});

test('abandoning ends the run with no result and no progress', () => {
  const { game, count } = setup();
  game.start();
  solveCurrent(game);
  assert.equal(game.abandon(), true);
  assert.equal(count('abandon'), 1);
  assert.equal(count('end'), 0);
  assert.equal(game.timer.running, false);
  assert.equal(game.score.bestFor(1), 0);
  assert.equal(game.submit(game.puzzle.answer), false);
  advance(70_000);
  assert.equal(count('end'), 0);
  assert.equal(game.abandon(), false);
});

test('abandoning during a recall or a transition leaves nothing pending', () => {
  const { game, count } = startOnRecall();
  assert.equal(game.abandon(), true);
  advance(5000);
  assert.equal(count('recall-start'), 0);

  game.start(1);
  game.submit(game.puzzle.answer);
  game.abandon();
  advance(5000);
  assert.equal(count('stage'), 2);
  assert.equal(game.start(1), true);
});

test('tools stay spent after abandoning', () => {
  const { game } = setup();
  game.score.addPoints(20);
  game.start(1, ['time']);
  game.abandon();
  assert.equal(game.score.points, 0);
});

test('review costs time, shows the digits with the clock stopped, and can repeat', () => {
  const { game, count } = startOnRecall();
  assert.equal(game.review(), false); // Digits are already showing.
  advance(game.puzzle.revealMs);
  assert.equal(game.review(), true);
  assert.equal(count('review-start'), 1);
  assert.equal(game.timer.remainingMs(), 55_000);

  game.submit(game.puzzle.answer);
  assert.equal(count('correct'), 0); // No answers while the digits show.
  advance(game.puzzle.reviewMs - 10);
  assert.equal(game.timer.remainingMs(), 55_000);
  advance(10);
  assert.equal(count('recall-start'), 2);

  assert.equal(game.review(), true);
  assert.equal(game.timer.remainingMs(), 50_000);
  advance(game.puzzle.reviewMs);
  game.submit(game.puzzle.answer);
  assert.equal(count('correct'), 1);
});

test('review does not count as a mistake', () => {
  const { game, count, result } = startOnRecall();
  advance(game.puzzle.revealMs);
  game.review();
  advance(game.puzzle.reviewMs);
  assert.equal(game.mistakes, 0);
  assert.equal(count('wrong'), 0);
  clearLevel(game);
  assert.equal(result().mistakes, 0);
});

test('review is refused when it would use up the clock', () => {
  const { game, count, result } = startOnRecall();
  advance(game.puzzle.revealMs);
  advance(56_000);
  assert.equal(game.review(), false);
  assert.equal(count('review-denied'), 1);
  assert.equal(result(), undefined);
  assert.equal(game.timer.remainingMs(), 4_000);
});

test('review is only for recall puzzles', () => {
  const { game } = setup();
  game.start(1);
  assert.equal(game.review(), false);
  assert.equal(game.timer.running, true);
});

test('abandoning during a review leaves nothing pending', () => {
  const { game, count } = startOnRecall();
  advance(game.puzzle.revealMs);
  game.review();
  game.abandon();
  advance(5000);
  assert.equal(count('recall-start'), 1);
});
