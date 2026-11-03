// Tunable game data. Add EASY / HARD by adding entries to DIFFICULTIES.
export const DIFFICULTIES = {
  normal: {
    id: 'normal',
    label: 'NORMAL',
    timeLimitMs: 60_000,
  },
};

export const SCORING = {
  perPuzzle: 100,
  successBonus: 200,
  perSecondLeft: 10,
};

// Hacking points for a cleared level. Replays pay a fraction, so one easy level
// can't be farmed for tools.
export const POINTS = {
  clearBase: 20,
  perDifficulty: 10,
  noMistakeBonus: 10,
  replayRatio: 0.25,
};

export const TIMING = {
  tickMs: 100,
  stageTransitionMs: 750,
  wrongCooldownMs: 400,
};
