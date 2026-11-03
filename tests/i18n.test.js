import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STRINGS } from '../src/i18n.js';
import { PLAYABLE_LEVELS } from '../src/levels.js';
import { PUZZLES } from '../src/puzzles/index.js';

const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

test('every language has the same keys and placeholders', () => {
  const { en, ko } = STRINGS;
  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) assert.deepEqual(placeholders(ko[key]), placeholders(en[key]), key);
});

test('every stage and generated puzzle has its text', () => {
  const strings = STRINGS.en;
  for (const { stages } of PLAYABLE_LEVELS) {
    for (const stage of stages) {
      const { id, generate } = PUZZLES[stage.puzzle];
      assert.ok(strings[`stage.${stage.id}`]);
      assert.ok(strings[`puzzle.${id}.title`]);
      assert.ok(strings[`puzzle.${id}.subtitle`]);
      for (let i = 0; i < 500; i += 1) {
        const { textKey, hintKey, textValues } = generate({ tier: stage.tier });
        for (const key of [`rule.${textKey}`, `hint.${hintKey ?? textKey}`]) {
          const text = strings[key];
          assert.ok(text, key);
          for (const holder of placeholders(text)) assert.ok(holder.slice(1, -1) in textValues);
        }
      }
    }
  }
});
