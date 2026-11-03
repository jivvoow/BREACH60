// Tools the player buys with hacking points before a run. Each lasts one run.
export const TOOLS = [
  { id: 'time', cost: 20, bonusMs: 3_000 },
  { id: 'shield', cost: 25 }, // The first wrong answer costs no time.
  { id: 'hint', cost: 15 }, // One use, on any puzzle of the run.
];

export const toolCost = (toolIds) => TOOLS
  .filter(({ id }) => toolIds.includes(id))
  .reduce((total, { cost }) => total + cost, 0);
