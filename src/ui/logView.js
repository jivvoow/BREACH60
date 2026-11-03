import { t } from '../i18n.js';
import { element, puzzleHeading, readKey, replay, ruleLine } from './dom.js';

const COLUMNS = ['time', 'user', 'action', 'terminal', 'code'];

const pad = (value) => String(value).padStart(2, '0');

function formatTime(seconds) {
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function rulesPanel({ rules, codes }) {
  const panel = element('div', 'audit-rules');
  panel.append(element('p', 'audit-rules-title', t('audit.rules')));
  const list = element('ul');
  for (const rule of rules) {
    const item = element('li', '', t(`audit.${rule}`));
    // Codes never wrap mid-code on a narrow screen.
    if (rule === 'code') item.append(...codes.map((code) => element('span', 'audit-allowed', code)));
    list.append(item);
  }
  panel.append(list);
  return panel;
}

const cells = (texts) => texts.map((text, i) => element('span', `audit-cell audit-${COLUMNS[i]}`, text));

export function mountLogView(container, { puzzle, definition, index, onSubmit }) {
  const root = element('div', 'audit');

  const table = element('div', 'audit-table');
  const head = element('div', 'audit-head');
  head.append(element('span', 'audit-key'), ...cells(COLUMNS.map((column) => t(`audit.head.${column}`))));
  table.append(head);

  const buttons = puzzle.lines.map((line, i) => {
    const button = element('button', 'audit-line');
    button.type = 'button';
    button.setAttribute('aria-label', t('ui.line', { number: i + 1 }));
    button.append(
      element('span', 'audit-key', String(i + 1)),
      ...cells([formatTime(line.time), line.user, line.action, line.terminal, line.code]),
    );
    button.addEventListener('click', () => choose(i));
    table.append(button);
    return button;
  });

  root.append(
    puzzleHeading(definition, index),
    ruleLine(puzzle),
    rulesPanel(puzzle),
    element('p', 'pattern-prompt', t('ui.pickLine')),
    table,
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
    // Strikes out two clean lines.
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
