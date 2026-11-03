import { applyLanguage, getLanguage, setLanguage, t } from '../i18n.js';
import { LEVEL_CATALOG, TOTAL_LEVELS } from '../levels.js';
import { PUZZLES } from '../puzzles/index.js';
import { replay } from './dom.js';
import { mountLogView } from './logView.js';
import { createMapView } from './mapView.js';
import { mountNetworkView } from './networkView.js';
import { mountPasswordView } from './passwordView.js';
import { mountPatternView } from './patternView.js';
import { Terminal } from './Terminal.js';

const PUZZLE_VIEWS = {
  password: mountPasswordView,
  network: mountNetworkView,
  pattern: mountPatternView,
  memory: mountPasswordView,
  log: mountLogView,
};

const RESULT_DELAY_MS = 800;
const QUIT_CONFIRM_MS = 2_500;
const WARN_SECONDS = 20;
const CRITICAL_SECONDS = 10;

const $ = (id) => document.getElementById(id);
const pad = (value) => String(value).padStart(2, '0');

function formatClock(seconds) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export function createUI(game) {
  const screens = [...document.querySelectorAll('.screen')];
  const frame = $('game-frame');
  const card = $('puzzle-card');
  const clock = $('clock');
  const howto = $('howto');
  const layers = $('layers');
  const gameLog = new Terminal($('game-terminal'));
  const successLog = new Terminal($('success-terminal'), { maxLines: 4 });
  const failLog = new Terminal($('fail-terminal'), { maxLines: 4 });

  let view = null;
  let resultTimeoutId = null;
  let shownSeconds = null;
  let quitArmedId = null;

  function showScreen(id) {
    for (const screen of screens) screen.classList.toggle('is-active', screen.id === id);
    window.scrollTo(0, 0);
  }

  function startRun(levelId) {
    game.start(levelId, map.affordableLoadout());
  }

  const map = createMapView({
    game,
    onEnter: startRun,
    elements: {
      tabs: $('sector-tabs'),
      tools: $('map-tools'),
      points: $('map-points'),
      toolBalance: $('tools-balance'),
      board: $('map-board'),
      detail: {
        kicker: $('detail-kicker'),
        name: $('detail-name'),
        status: $('detail-status'),
        difficulty: $('detail-difficulty'),
        steps: $('detail-steps'),
        penalty: $('detail-penalty'),
        best: $('detail-best'),
        puzzles: $('detail-puzzles'),
        enter: $('btn-enter-node'),
        note: $('detail-note'),
      },
    },
  });

  function renderLanguageSwitch() {
    for (const button of $('lang-switch').children) {
      const active = button.dataset.lang === getLanguage();
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', active);
    }
  }

  function showMenu() {
    renderLanguageSwitch();
    const cleared = LEVEL_CATALOG.filter((level) => game.levelState(level).completed).length;
    $('start-progress').textContent = `${cleared} / ${TOTAL_LEVELS}`;
    showScreen('screen-start');
  }

  function showMap() {
    map.showOverview('is-entering');
    showScreen('screen-map');
  }

  function setLayerStates(activeIndex, solved) {
    [...layers.children].forEach((layer, i) => {
      const status = i < solved ? 'breached' : i === activeIndex ? 'active' : 'locked';
      layer.dataset.status = status;
      layer.querySelector('.layer-status').textContent = t(`status.${status}`);
    });
    $('access-count').textContent = `${solved} / ${layers.childElementCount}`;
  }

  function updateClock(remainingMs) {
    const seconds = Math.ceil(remainingMs / 1000);
    if (seconds === shownSeconds) return;
    shownSeconds = seconds;
    clock.textContent = formatClock(seconds);
    frame.dataset.alert =
      seconds <= CRITICAL_SECONDS ? 'critical' : seconds <= WARN_SECONDS ? 'warn' : 'calm';
    document.body.classList.toggle('is-critical', game.inProgress && seconds <= CRITICAL_SECONDS);
  }

  function clearView() {
    view?.destroy();
    view = null;
  }

  function disarmQuit() {
    clearTimeout(quitArmedId);
    quitArmedId = null;
    const button = $('btn-quit');
    button.classList.remove('is-armed');
    button.textContent = t('ui.quit');
  }

  // Leaving loses the run, so the first press only asks.
  function onQuitPress() {
    if (quitArmedId === null) {
      const button = $('btn-quit');
      button.classList.add('is-armed');
      button.textContent = t('ui.quitConfirm');
      quitArmedId = setTimeout(disarmQuit, QUIT_CONFIRM_MS);
      return;
    }
    disarmQuit();
    game.abandon();
  }

  function onAbandon() {
    clearView();
    clock.classList.remove('is-paused');
    document.body.classList.remove('is-critical');
    showMenu();
  }

  function renderRunTools({ shielded, hintsLeft }) {
    $('shield-status').hidden = !shielded;
    $('btn-hint').hidden = hintsLeft === 0;
  }

  function onRunStart({ level, stages, shielded, hintsLeft }) {
    renderRunTools({ shielded, hintsLeft });
    disarmQuit();
    clock.classList.remove('is-paused');
    clearTimeout(resultTimeoutId);
    map.select(level.id);
    $('level').textContent = pad(level.id);
    $('penalty-pop').textContent = t('ui.penalty', { seconds: level.penaltyMs / 1000 });
    shownSeconds = null;
    gameLog.clear();
    card.classList.remove('is-breached');
    document.body.classList.remove('is-critical', 'is-denied');
    layers.style.setProperty('--layer-count', stages.length);
    layers.dataset.count = stages.length;
    layers.replaceChildren(...stages.map((stage, i) => {
      const layer = document.createElement('li');
      layer.className = 'layer';
      const label = document.createElement('span');
      label.className = 'layer-name';
      const number = document.createElement('span');
      number.className = 'layer-index';
      number.textContent = `L${i + 1} `;
      label.append(number, t(`stage.${stage.id}`));
      const status = document.createElement('span');
      status.className = 'layer-status';
      layer.append(label, status);
      return layer;
    }));
    showScreen('screen-game');
  }

  function onStage({ index, stage, puzzle }) {
    clearView();
    card.classList.remove('is-breached');
    clock.classList.toggle('is-paused', Boolean(puzzle.revealMs));
    setLayerStates(index, index);
    view = PUZZLE_VIEWS[stage.puzzle]($('puzzle-mount'), {
      puzzle,
      index,
      definition: PUZZLES[stage.puzzle],
      onSubmit: (input) => game.submit(input),
      onReview: () => game.review(),
      onIncomplete: (length) => gameLog.print('hint', t('log.incomplete', { length })),
    });
    gameLog.print('cmd', `root@breach60:~$ ${PUZZLES[stage.puzzle].command} --layer ${index + 1}`);
    gameLog.print('system', t('log.loaded', { stage: t(`stage.${stage.id}`) }));
    gameLog.print('hint', `[HINT] ${t(`hint.${puzzle.hintKey ?? puzzle.textKey}`, puzzle.textValues)}`);
    gameLog.print('input', t('log.awaiting'));
  }

  function onCorrect({ index, solved }) {
    clearView();
    setLayerStates(-1, solved);
    replay(card, 'is-breached');
    gameLog.print('ok', t('log.breached', { layer: index + 1 }));
  }

  function onWrong({ penaltyMs }) {
    view?.reject();
    replay(frame, 'is-hit');
    if (penaltyMs > 0) replay($('penalty-pop'), 'is-shown');
    if (penaltyMs > 0) gameLog.print('error', t('log.rejected', { seconds: penaltyMs / 1000 }));
  }

  function onRecallStart() {
    view?.startRecall();
    clock.classList.remove('is-paused');
    gameLog.print('system', t('log.recall'));
  }

  function onReviewStart({ costMs }) {
    view?.showDigits();
    clock.classList.add('is-paused');
    gameLog.print('hint', t('log.review', { seconds: costMs / 1000 }));
  }

  function onShieldUsed() {
    $('shield-status').hidden = true;
    gameLog.print('hint', t('log.shield'));
  }

  function onHintUsed() {
    view?.hint();
    $('btn-hint').hidden = true;
    gameLog.print('hint', t('log.hint'));
  }

  function showSuccess(result) {
    $('success-time').textContent = formatClock(result.secondsLeft);
    $('success-score').textContent = result.score;
    $('success-best').textContent = result.best;
    $('success-new').hidden = !result.isNew;
    $('success-layers').textContent = `${result.solved} / ${result.total}`;
    $('success-points').textContent = `+${result.pointsEarned}`;
    $('success-total').textContent = result.points;
    $('btn-next').hidden = !result.nextLevel;
    showScreen('screen-success');
    successLog.clear();
    successLog.print('cmd', 'root@breach60:~$ finalize_run');
    successLog.print('system', t('log.extracted'));
    successLog.print('hint', t('log.transfer'));
    successLog.print('ok', result.nextLevel
      ? t('log.unlocked', { level: result.nextLevel })
      : t('log.allClear'));
  }

  function showFailure(result) {
    $('fail-cause').textContent = t(`fail.${result.cause}`);
    $('fail-layer').textContent = pad(result.layer);
    $('fail-layers').textContent = `${result.solved} / ${result.total}`;
    $('fail-score').textContent = result.score;
    $('fail-best').textContent = result.best;
    $('fail-new').hidden = !result.isNew;
    showScreen('screen-fail');
    failLog.clear();
    failLog.print('cmd', 'root@breach60:~$ finalize_run');
    failLog.print('error', t(`fail.${result.cause}Log`));
    failLog.print('hint', t('log.traced'));
    failLog.print('error', t('log.denied'));
  }

  function onEnd({ result }) {
    disarmQuit();
    clearView();
    document.body.classList.remove('is-critical');
    if (!result.success) document.body.classList.add('is-denied');
    if (result.nextLevel) map.select(result.nextLevel);
    resultTimeoutId = setTimeout(
      () => (result.success ? showSuccess(result) : showFailure(result)),
      RESULT_DELAY_MS,
    );
  }

  const handlers = {
    'run-start': onRunStart,
    stage: onStage,
    tick: ({ remainingMs }) => updateClock(remainingMs),
    correct: onCorrect,
    wrong: onWrong,
    'recall-start': onRecallStart,
    'review-start': onReviewStart,
    'review-denied': () => gameLog.print('hint', t('log.reviewDenied')),
    abandon: onAbandon,
    'shield-used': onShieldUsed,
    'hint-used': onHintUsed,
    end: onEnd,
  };

  game.subscribe((event) => handlers[event.type]?.(event));

  $('btn-map').addEventListener('click', showMap);
  $('btn-hint').addEventListener('click', () => game.useHint());
  $('btn-quit').addEventListener('click', onQuitPress);
  $('lang-switch').addEventListener('click', (event) => {
    const lang = event.target.closest('[data-lang]')?.dataset.lang;
    if (!lang) return;
    setLanguage(lang);
    showMenu();
  });
  $('btn-howto').addEventListener('click', () => howto.showModal());
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'next' || action === 'retry') startRun(action === 'next' ? map.selected : game.level.id);
    if (action === 'map') showMap();
    if (action === 'menu') showMenu();
  });

  map.select(Math.min(game.score.unlockedLevel, game.levels.length));
  applyLanguage();
  showMenu();
}
