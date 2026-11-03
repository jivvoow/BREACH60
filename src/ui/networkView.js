import { COLS, neighborsOf, ROWS } from '../puzzles/network.js';
import { t } from '../i18n.js';
import { element, puzzleHeading, replay, ruleLine } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const xOf = (id) => (id % COLS) + 0.5;
const yOf = (id) => Math.floor(id / COLS) + 0.5;

function nodeLabel(puzzle, id) {
  if (id === puzzle.start) return t('ui.nodeStart');
  if (id === puzzle.target) return t('ui.nodeTarget');
  return '';
}

function nodeKind(puzzle, id) {
  if (id === puzzle.start || id === puzzle.target) return 'net-node-end';
  return puzzle.relays.includes(id) ? 'net-node-relay' : '';
}

export function mountNetworkView(container, { puzzle, definition, index, onSubmit }) {
  const root = element('div', 'network');

  const status = element('p', 'net-status');
  const board = element('div', 'net-board');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${COLS} ${ROWS}`);
  svg.setAttribute('aria-hidden', 'true');
  for (const [a, b] of puzzle.links) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', xOf(a));
    line.setAttribute('y1', yOf(a));
    line.setAttribute('x2', xOf(b));
    line.setAttribute('y2', yOf(b));
    line.setAttribute('class', 'net-link');
    svg.append(line);
  }
  const trace = document.createElementNS(SVG_NS, 'polyline');
  trace.setAttribute('class', 'net-trace');
  svg.append(trace);
  board.append(svg);

  const ids = [...new Set(puzzle.links.flat())];
  const buttons = new Map(ids.map((id) => {
    const button = element('button', `net-node ${nodeKind(puzzle, id)}`, nodeLabel(puzzle, id));
    button.type = 'button';
    button.dataset.node = id;
    button.style.left = `${(xOf(id) / COLS) * 100}%`;
    button.style.top = `${(yOf(id) / ROWS) * 100}%`;
    button.setAttribute('aria-label', nodeLabel(puzzle, id) || t('ui.node', { id }));
    board.append(button);
    return [id, button];
  }));

  root.append(
    puzzleHeading(definition, index),
    ruleLine(puzzle),
    status,
    board,
  );
  container.replaceChildren(root);

  let path = [puzzle.start];
  let dragging = false;
  let collected = 0;

  const draw = () => {
    trace.setAttribute('points', path.map((id) => `${xOf(id)},${yOf(id)}`).join(' '));
    for (const [id, button] of buttons) {
      button.classList.toggle('is-on-path', path.includes(id));
      button.classList.toggle('is-head', id === path.at(-1));
      button.classList.toggle(
        'is-reachable',
        neighborsOf(puzzle, path.at(-1)).includes(id) && !path.includes(id),
      );
    }
    const linked = puzzle.relays.filter((relay) => path.includes(relay)).length;
    const complete = linked === puzzle.relays.length;
    status.textContent = complete
      ? t('ui.relaysDone')
      : t('ui.relays', { linked, total: puzzle.relays.length });
    status.classList.toggle('is-complete', complete);
    buttons.get(puzzle.target).classList.toggle('is-armed', complete);
    if (linked > collected) replay(buttons.get(path.at(-1)), 'is-collected');
    collected = linked;
  };

  const step = (id, { fromDrag }) => {
    if (id === path.at(-1)) return;
    if (path.includes(id)) {
      path = path.slice(0, path.indexOf(id) + 1);
    } else if (neighborsOf(puzzle, path.at(-1)).includes(id)) {
      path = [...path, id];
    } else {
      if (!fromDrag) replay(buttons.get(id), 'is-denied');
      return;
    }
    draw();
    if (id === puzzle.target && !onSubmit(path)) {
      // Ignored during the post-mistake cooldown: step back and let them retry.
      path = path.slice(0, -1);
      draw();
    }
  };

  const nodeAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-node]');

  // Pointer events cover mouse and touch alike, for both tapping and dragging.
  board.addEventListener('pointerdown', (event) => {
    const node = event.target.closest('[data-node]');
    if (!node) return;
    event.preventDefault();
    dragging = true;
    step(Number(node.dataset.node), { fromDrag: false });
  });
  board.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const node = nodeAt(event.clientX, event.clientY);
    if (node) step(Number(node.dataset.node), { fromDrag: true });
  });
  const endDrag = () => {
    dragging = false;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  // Keyboard activation arrives as a click with no pointer detail.
  board.addEventListener('click', (event) => {
    const node = event.target.closest('[data-node]');
    if (node && event.detail === 0) step(Number(node.dataset.node), { fromDrag: false });
  });

  draw();

  return {
    // Walks the first half of a working route.
    hint() {
      path = puzzle.answer.slice(0, Math.ceil(puzzle.answer.length / 2));
      draw();
    },
    reject() {
      replay(board, 'is-wrong');
      path = [puzzle.start];
      draw();
    },
    destroy() {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    },
  };
}
