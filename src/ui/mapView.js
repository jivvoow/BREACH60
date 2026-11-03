import { localized, t } from '../i18n.js';
import { LEVEL_CATALOG, sectorOf, SECTOR_SIZE, TOTAL_LEVELS } from '../levels.js';
import { PUZZLES } from '../puzzles/index.js';
import { TOOLS, toolCost } from '../tools.js';
import { element } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_DIFFICULTY = 5;
const TRANSITION_MS = 1_300;
const ALL_SECTORS = 'all';
const PACKET_MS_PER_NODE = 320;
const PACKET_REST_MS = 900;
const OVERVIEW_ROW_STEP = 9.4;
const OVERVIEW_FIRST_ROW = 6.5;

// Where a sector's ten nodes sit, in percent. A snake, so every sector reads as
// one route. Narrow screens swap x and y (see .map-node in style.css).
const NODE_POINTS = [
  [10, 30], [30, 18], [50, 30], [70, 18], [90, 30],
  [90, 72], [70, 84], [50, 72], [30, 84], [10, 72],
];

const sectorCount = Math.ceil(TOTAL_LEVELS / SECTOR_SIZE);
const pad = (value, length = 2) => String(value).padStart(length, '0');

const rowY = (row) => OVERVIEW_FIRST_ROW + row * OVERVIEW_ROW_STEP;

// The whole network on one board: one row per sector, snaking down.
function overviewPoint(levelId) {
  const index = levelId - 1;
  const row = Math.floor(index / SECTOR_SIZE);
  const step = index % SECTOR_SIZE;
  const column = row % 2 === 0 ? step : SECTOR_SIZE - 1 - step;
  const stagger = column % 2 === 0 ? -1 : 1;
  return [10 + column * 9.4, rowY(row) + stagger];
}

// Right-angle circuit trace between two points.
function traceRoute([ax, ay], [bx, by]) {
  if (ax === bx) return [[ax, ay], [bx, by]];
  const middle = (ax + bx) / 2;
  return [[ax, ay], [middle, ay], [middle, by], [bx, by]];
}

function tracePoints(from, to, swapAxes) {
  return traceRoute(from, to)
    .map(([x, y]) => (swapAxes ? `${y},${x}` : `${x},${y}`))
    .join(' ');
}

function traceLine(from, to, shape, isLit) {
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', tracePoints(from, to, shape === 'tall'));
  line.setAttribute('class', `map-trace map-trace-${shape}${isLit ? ' is-lit' : ''}`);
  return line;
}

function boardSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

export function createMapView({ game, elements, onEnter }) {
  const { tabs, board, detail } = elements;
  let selected = 1;
  let zoomedSector = ALL_SECTORS;
  let transitionId = null;
  let loadout = [];

  const stateOf = (level) => game.levelState(level);
  const levelsIn = (sector) => LEVEL_CATALOG.slice((sector - 1) * SECTOR_SIZE, sector * SECTOR_SIZE);

  function renderTabs() {
    const sectors = [ALL_SECTORS, ...Array.from({ length: sectorCount }, (_, i) => i + 1)];
    tabs.replaceChildren(...sectors.map((sector) => {
      const isAll = sector === ALL_SECTORS;
      const button = element('button', 'sector-tab', isAll ? t('map.all') : pad(sector));
      button.type = 'button';
      button.dataset.sector = sector;
      button.setAttribute('aria-label', isAll ? t('map.all') : t('ui.sector', { number: sector }));
      button.classList.toggle('is-open', isAll || levelsIn(sector).some((level) => stateOf(level).unlocked));
      button.classList.toggle('is-selected', sector === zoomedSector);
      return button;
    }));
  }

  function nodeButton(level, [x, y], index) {
    const { status } = stateOf(level);
    const node = element('button', `map-node is-${status}`);
    node.type = 'button';
    node.dataset.level = level.id;
    node.style.setProperty('--x', x);
    node.style.setProperty('--y', y);
    node.style.setProperty('--i', index);
    node.classList.toggle('is-selected', level.id === selected);
    node.setAttribute('aria-pressed', level.id === selected);
    node.setAttribute('aria-label', `${t('ui.level')} ${level.id}: ${t(`map.status.${status}`)}`);
    node.append(element('span', 'map-node-number', pad(level.id)));
    return node;
  }

  // Ring or ping laid over a node. CSS places it like the node underneath.
  function marker(className, [x, y]) {
    const mark = element('span', `map-mark ${className}`);
    mark.style.setProperty('--x', x);
    mark.style.setProperty('--y', y);
    return mark;
  }

  // A packet of light loops along the breached route up to the current node.
  function packet(points) {
    if (points.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    const swapAxes = zoomedSector !== ALL_SECTORS && matchMedia('(max-width: 760px)').matches;
    const route = points.slice(1).flatMap((point, i) => traceRoute(points[i], point));
    const keyframes = route.map(([x, y]) => (swapAxes
      ? { left: `${y}%`, top: `${x}%` }
      : { left: `${x}%`, top: `${y}%` }));
    const mark = element('span', 'map-packet');
    const travelMs = (points.length - 1) * PACKET_MS_PER_NODE;
    mark.animate(keyframes, {
      duration: travelMs,
      endDelay: PACKET_REST_MS,
      iterations: Infinity,
    });
    return [mark];
  }

  function markers(levels, pointOf) {
    const current = LEVEL_CATALOG.find((level) => stateOf(level).status === 'available');
    const trail = levels.filter((level) => stateOf(level).completed || level === current);
    const shown = levels.find((level) => level.id === selected);
    const mini = zoomedSector === ALL_SECTORS ? ' is-mini' : '';
    return [
      ...packet(trail.map((level) => pointOf(level))),
      ...(levels.includes(current) ? [marker(`map-ping${mini}`, pointOf(current))] : []),
      ...(shown ? [marker(`map-ring${mini}`, pointOf(shown))] : []),
    ];
  }

  function overviewStage() {
    const svg = boardSvg();
    LEVEL_CATALOG.slice(1).forEach((level, i) => {
      const previous = LEVEL_CATALOG[i];
      svg.append(traceLine(overviewPoint(previous.id), overviewPoint(level.id), 'all', stateOf(previous).completed));
    });
    const labels = Array.from({ length: sectorCount }, (_, i) => {
      const label = element('button', 'map-row-label', `S${i + 1}`);
      label.type = 'button';
      label.dataset.sector = i + 1;
      label.style.setProperty('--y', rowY(i));
      label.setAttribute('aria-label', t('ui.sector', { number: i + 1 }));
      return label;
    });
    const nodes = LEVEL_CATALOG.map((level, i) => {
      const node = nodeButton(level, overviewPoint(level.id), i);
      node.classList.add('is-mini');
      return node;
    });
    return [svg, ...labels, ...nodes, ...markers(LEVEL_CATALOG, ({ id }) => overviewPoint(id))];
  }

  function sectorStage(sector) {
    const levels = levelsIn(sector);
    const svg = boardSvg();
    for (const shape of ['wide', 'tall']) {
      NODE_POINTS.slice(1).forEach((point, i) => {
        svg.append(traceLine(NODE_POINTS[i], point, shape, stateOf(levels[i]).completed));
      });
      const [first, last] = [NODE_POINTS[0], NODE_POINTS.at(-1)];
      if (levels[0].id > 1) svg.append(traceLine([0, first[1]], first, shape, false));
      if (levels.at(-1).id < TOTAL_LEVELS) {
        svg.append(traceLine(last, [0, last[1]], shape, stateOf(levels.at(-1)).completed));
      }
    }
    const pointOf = (level) => NODE_POINTS[levels.indexOf(level)];
    return [
      svg,
      ...levels.map((level, i) => nodeButton(level, NODE_POINTS[i], i)),
      ...markers(levels, pointOf),
    ];
  }

  function renderBoard(transition) {
    const stage = element('div', `map-stage${zoomedSector === ALL_SECTORS ? ' is-overview' : ''}`);
    stage.append(...(zoomedSector === ALL_SECTORS ? overviewStage() : sectorStage(zoomedSector)));
    stage.style.setProperty('--zoom-y', `${rowY(sectorOf(selected) - 1)}%`);
    board.replaceChildren(stage);

    if (!transition) return;
    clearTimeout(transitionId);
    board.classList.remove('is-entering', 'is-zooming', 'is-zooming-out');
    void board.offsetWidth; // Restart the CSS animation.
    board.classList.add(transition);
    transitionId = setTimeout(() => board.classList.remove(transition), TRANSITION_MS);
  }

  function renderDetail(levelId = selected) {
    const level = LEVEL_CATALOG[levelId - 1];
    const { status, unlocked, best } = stateOf(level);
    const known = level.stages.length > 0;

    detail.kicker.textContent = `${t('ui.level')} ${pad(levelId, 3)} // ${t('ui.sector', { number: pad(sectorOf(levelId)) })}`;
    detail.name.textContent = localized(level.name) ?? t('map.unknown');
    detail.status.textContent = t(`map.status.${status}`);
    detail.status.dataset.status = status;

    detail.difficulty.replaceChildren(...Array.from({ length: MAX_DIFFICULTY }, (_, i) =>
      element('span', i < level.difficulty ? 'pip is-on' : 'pip')));
    detail.steps.textContent = known ? level.stages.length : '-';
    detail.penalty.textContent = known ? t('ui.penalty', { seconds: level.penaltyMs / 1000 }) : '-';
    detail.best.textContent = best || '-';

    const puzzles = [...new Set(level.stages.map((stage) => PUZZLES[stage.puzzle].id))];
    detail.puzzles.replaceChildren(...(known
      ? puzzles.map((id) => element('span', 'chip', t(`puzzle.${id}.title`)))
      : [element('span', 'chip chip-unknown', t('map.unknown'))]));

    detail.enter.disabled = !unlocked;
    detail.note.textContent = unlocked ? '' : t(known ? 'map.lockedNote' : 'map.soonNote');
  }

  function renderTools() {
    const balance = game.score.points;
    const spent = toolCost(loadout);
    elements.points.textContent = balance;
    elements.toolBalance.textContent = balance;
    elements.tools.replaceChildren(...TOOLS.map(({ id, cost }) => {
      const equipped = loadout.includes(id);
      const button = element('button', `tool${equipped ? ' is-on' : ''}`);
      button.type = 'button';
      button.dataset.tool = id;
      button.disabled = !equipped && spent + cost > balance;
      button.setAttribute('aria-pressed', equipped);
      button.append(element('span', 'tool-name', t(`tool.${id}`)), element('span', 'tool-cost', `${cost}`));
      return button;
    }));
  }

  // Tools the player can still pay for: a retry may not leave enough points.
  function affordableLoadout() {
    while (!game.canAfford(loadout)) loadout = loadout.slice(0, -1);
    return loadout;
  }

  function render(transition) {
    affordableLoadout();
    renderTabs();
    renderBoard(transition);
    renderDetail();
    renderTools();
  }

  function select(levelId) {
    selected = levelId;
    render();
  }

  function zoomTo(levelId) {
    selected = levelId;
    zoomedSector = sectorOf(levelId);
    render('is-zooming');
  }

  function showOverview(transition) {
    zoomedSector = ALL_SECTORS;
    render(transition);
  }

  // Most useful node of a sector: the newest open one, else the first.
  function openSector(sector) {
    const open = levelsIn(sector).filter((level) => stateOf(level).unlocked);
    zoomTo((open.at(-1) ?? levelsIn(sector)[0]).id);
  }

  function onSectorPick(event) {
    const sector = event.target.closest('[data-sector]')?.dataset.sector;
    if (sector === ALL_SECTORS) showOverview('is-zooming-out');
    else if (sector) openSector(Number(sector));
  }

  tabs.addEventListener('click', onSectorPick);
  board.addEventListener('click', (event) => {
    onSectorPick(event);
    const node = event.target.closest('[data-level]');
    if (!node) return;
    const levelId = Number(node.dataset.level);
    if (zoomedSector === ALL_SECTORS) zoomTo(levelId);
    else select(levelId);
  });

  // Hovering the overview previews a node without leaving the big picture.
  board.addEventListener('pointerover', (event) => {
    const node = event.target.closest('[data-level]');
    if (node && event.pointerType === 'mouse' && zoomedSector === ALL_SECTORS) {
      renderDetail(Number(node.dataset.level));
    }
  });
  board.addEventListener('pointerleave', () => renderDetail());

  detail.enter.addEventListener('click', () => onEnter(selected));
  elements.tools.addEventListener('click', (event) => {
    const id = event.target.closest('[data-tool]')?.dataset.tool;
    if (!id) return;
    loadout = loadout.includes(id) ? loadout.filter((tool) => tool !== id) : [...loadout, id];
    renderTools();
  });

  return { select, showOverview, affordableLoadout, get selected() { return selected; } };
}
