export const randomInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

export const pick = (rng, items) => items[randomInt(rng, 0, items.length - 1)];

export function shuffle(rng, items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
