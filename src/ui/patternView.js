import { GRID_SIZE } from '../puzzles/pattern.js';
import { t } from '../i18n.js';
import { element, puzzleHeading, readKey, replay, ruleLine } from './dom.js';

function frameGrid(frame) {
  const grid = element('div', 'pattern-grid');
  grid.style.setProperty('--grid-size', GRID_SIZE);
  for (const lit of frame) grid.append(element('span', lit ? 'cell is-lit' : 'cell'));
  return grid;
}

export function mountPatternView(container, { puzzle, definition, index, onSubmit }) {
  const root = element('div', 'pattern');

  const sequence = element('div', 'pattern-sequence');
  for (const frame of puzzle.frames) sequence.append(frameGrid(frame));
  const unknown = element('div', 'pattern-grid pattern-unknown', '?');
  sequence.append(unknown);

  const options = element('div', 'pattern-options');
  const buttons = puzzle.options.map((frame, i) => {
    const button = element('button', 'pattern-option');
    button.type = 'button';
    button.setAttribute('aria-label', t('ui.option', { number: i + 1 }));
    button.append(frameGrid(frame), element('span', 'pattern-key', String(i + 1)));
    button.addEventListener('click', () => choose(i));
    options.append(button);
    return button;
  });

  root.append(
    puzzleHeading(definition, index),
    ruleLine(puzzle),
    sequence,
    element('p', 'pattern-prompt', t('ui.pickOption')),
    options,
  );
  container.replaceChildren(root);

  let chosen = null;

  function choose(i) {
    if (buttons[i].disabled) return;
    chosen = i;
    onSubmit(i);
  }

  const onKeyDown = (event) => {
    const key = readKey(event);
    if (event.repeat || !/^\d$/.test(key)) return;
    if (buttons[Number(key) - 1]) choose(Number(key) - 1);
  };
  document.addEventListener('keydown', onKeyDown);

  return {
    // Strikes out two wrong options.
    hint() {
      buttons
        .filter((button, i) => i !== puzzle.answer && !button.disabled)
        .slice(0, 2)
        .forEach((button) => {
          button.disabled = true;
        });
    },
    reject() {
      buttons[chosen].disabled = true;
      replay(buttons[chosen], 'is-wrong');
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
