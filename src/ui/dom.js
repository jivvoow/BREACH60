import { t } from '../i18n.js';

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Returns a digit, 'Enter', 'Backspace' or null. A Korean IME reports letters,
// digits and Enter as key "Process", so the physical key code is the fallback.
export function readKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (/^\d$/.test(event.key)) return event.key;
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code);
  if (digit) return digit[1];
  if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') return 'Enter';
  if (event.key === 'Backspace' || event.code === 'Backspace') return 'Backspace';
  return null;
}

export function replay(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // Restart the CSS animation.
  node.classList.add(className);
}

export function ruleLine({ textKey, textValues }) {
  return element('p', 'rule', t('ui.rule', { rule: t(`rule.${textKey}`, textValues) }));
}

export function puzzleHeading(definition, index) {
  const heading = element('div', 'puzzle-heading');
  heading.append(
    element('p', 'puzzle-kicker', t('ui.puzzle', { number: String(index + 1).padStart(2, '0') })),
    element('h2', 'puzzle-title', t(`puzzle.${definition.id}.title`)),
    element('p', 'puzzle-subtitle', t(`puzzle.${definition.id}.subtitle`)),
  );
  return heading;
}
