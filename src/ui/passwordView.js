import { t } from '../i18n.js';
import { element, puzzleHeading, readKey, replay, ruleLine } from './dom.js';

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0'];

// Input lives on the document, not in an <input>, so the code entry never loses
// focus and phones keep the on-screen keypad instead of the system keyboard.
export function mountPasswordView(container, { puzzle, definition, index, onSubmit, onIncomplete, onReview }) {
  const root = element('div', 'password');

  const rule = ruleLine(puzzle);

  const tiles = element('div', 'tiles');
  for (const tile of puzzle.tiles) {
    tiles.append(element('span', /\d/.test(tile) ? 'tile' : 'tile tile-hidden', tile));
  }

  const clues = element('div', 'clues');
  for (const clue of puzzle.clues) clues.append(element('span', 'clue', clue.text));

  const entry = element('div', 'entry');
  const field = element('div', 'code-field');
  const value = element('span', 'code-value');
  value.setAttribute('aria-label', t('ui.codeInput'));
  field.append(element('span', 'code-label', t('ui.codeInput')), value, element('span', 'code-cursor'));
  const enter = element('button', 'btn btn-enter', t('ui.enter'));
  enter.type = 'button';
  entry.append(field, enter);
  if (puzzle.reviewMs) {
    const review = element('button', 'btn btn-review', t('ui.review', { seconds: puzzle.reviewCostMs / 1000 }));
    review.type = 'button';
    review.addEventListener('click', onReview);
    entry.append(review);
  }

  const keypad = element('div', 'keypad');
  for (const key of KEYPAD) {
    const isDelete = key === 'DEL';
    const button = element('button', isDelete ? 'key key-del' : 'key', isDelete ? t('ui.del') : key);
    button.type = 'button';
    button.dataset.key = key;
    keypad.append(button);
  }

  root.append(puzzleHeading(definition, index), rule, tiles);
  if (puzzle.clues.length > 0) root.append(clues);
  root.append(entry, keypad);
  container.replaceChildren(root);

  let code = '';

  // Recall puzzles take no input until the digits are hidden.
  let waiting = Boolean(puzzle.revealMs);
  root.classList.toggle('is-waiting', waiting);

  const update = (next) => {
    code = next;
    value.textContent = code;
    field.classList.toggle('is-full', code.length === puzzle.length);
  };

  const submit = () => {
    if (waiting) return;
    if (code.length < puzzle.length) {
      replay(field, 'is-short');
      onIncomplete(puzzle.length);
      return;
    }
    onSubmit(code);
  };

  const press = (key) => {
    if (waiting) return;
    if (key === 'DEL') update(code.slice(0, -1));
    else if (code.length < puzzle.length) update(code + key);
  };

  const onKeyDown = (event) => {
    const key = readKey(event);
    if (key === 'Enter') {
      event.preventDefault(); // A focused button would otherwise also click.
      if (!event.repeat) submit();
    } else if (key === 'Backspace') {
      press('DEL');
    } else if (key) {
      press(key);
    }
  };

  const onKeypad = (event) => {
    const key = event.target.closest('[data-key]')?.dataset.key;
    if (key) press(key);
  };

  document.addEventListener('keydown', onKeyDown);
  keypad.addEventListener('click', onKeypad);
  enter.addEventListener('click', submit);

  return {
    reject() {
      update('');
      replay(field, 'is-wrong');
    },
    showDigits() {
      update('');
      waiting = true;
      root.classList.add('is-waiting');
      puzzle.tiles.forEach((digit, i) => {
        tiles.children[i].textContent = digit;
        tiles.children[i].classList.remove('tile-hidden');
      });
    },
    startRecall() {
      waiting = false;
      root.classList.remove('is-waiting');
      for (const tile of tiles.children) {
        tile.textContent = '?';
        tile.classList.add('tile-hidden');
      }
    },
    // Fills in the first digit.
    hint() {
      update(puzzle.answer[0]);
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
