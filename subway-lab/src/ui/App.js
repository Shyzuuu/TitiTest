/**
 * Point d'entrée navigateur : construit l'interface, branche les entrées et
 * anime la boucle. Toute logique métier passe par LabController.
 */

import { LabController } from '../app/LabController.js';
import { InputController } from '../input/InputController.js';
import { Renderer } from '../render/Renderer.js';
import { formatSpeed } from '../simulation/SimulationClock.js';
import { BrowserStorage, MemoryStorage } from '../storage/StorageAdapter.js';
import { fmtInt, fmtNum, fmtTime, h, setClass, setText, setVisible } from './dom.js';
import { createDiagnosticsPanel } from './panels/DiagnosticsPanel.js';
import { createGameplayPanel } from './panels/GameplayPanel.js';
import { createLibraryPanel } from './panels/LibraryPanel.js';
import { createRecordingPanel } from './panels/RecordingPanel.js';
import { createReplayPanel } from './panels/ReplayPanel.js';
import { createResourcesPanel } from './panels/ResourcesPanel.js';
import { createSettingsPanel } from './panels/SettingsPanel.js';
import { createShopPanel } from './panels/ShopPanel.js';
import { createSpeedPanel } from './panels/SpeedPanel.js';

const UI_REFRESH_MS = 100;
const DESKTOP_QUERY = '(min-width: 1000px)';

/** @param {string} id */
function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} absent du document.`);
  return el;
}

export function bootstrap() {
  /** @type {import('../storage/StorageAdapter.js').KeyValueStorage} */
  let storage;
  let storageWarning = null;
  try {
    storage = new BrowserStorage();
  } catch (e) {
    storage = new MemoryStorage();
    storageWarning = /** @type {Error} */ (e).message;
  }
  const lab = new LabController({ storage }).init();
  const canvas = /** @type {HTMLCanvasElement} */ ($('game'));
  const renderer = new Renderer(canvas);
  const metrics = { fps: 0, renderMs: 0, drawCount: 0 };

  const toasts = $('toasts');
  /** @type {UiToast} */
  const toast = (level, message) => {
    const el = h('div', { class: `toast ${level}`, role: level === 'error' ? 'alert' : 'status' }, message);
    toasts.append(el);
    while (toasts.childElementCount > 4) toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), level === 'error' ? 7000 : 4000);
  };
  /** @param {unknown} e */
  const onError = (e) => toast('error', e instanceof Error ? e.message : String(e));

  const dialog = /** @type {HTMLDialogElement} */ ($('dialog'));
  const dialogText = $('dialog-text');
  const dialogInput = /** @type {HTMLInputElement} */ ($('dialog-input'));
  /**
   * @param {string} message
   * @param {string | null} initial null = simple confirmation
   * @returns {Promise<string | null>}
   */
  const ask = (message, initial) => new Promise((resolve) => {
    setText(dialogText, message);
    setVisible(dialogInput, initial !== null);
    dialogInput.value = initial ?? '';
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'ok' ? dialogInput.value : null);
    };
    dialog.addEventListener('close', onClose);
    dialog.returnValue = '';
    dialog.showModal();
    if (initial !== null) dialogInput.select();
  });

  const input = new InputController({
    keyTarget: window,
    touchTarget: $('stage'),
    saveManager: lab.saveManager,
    onAction: (a) => {
      const r = lab.input(a);
      if (!r.accepted && r.reason && lab.fsm.is('REPLAYING')) toast('info', r.reason);
    },
    onPause: () => lab.togglePause(),
    onRestart: () => {
      try {
        lab.restart();
      } catch (e) {
        onError(e);
      }
    },
  });
  input.load();
  input.attach();

  const panelEl = $('panel');
  const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;
  /** @param {boolean} open */
  const setPanelOpen = (open) => {
    setClass(panelEl, 'open', open);
    setClass(document.body, 'panel-open', open);
    $('fab').setAttribute('aria-expanded', String(open));
  };

  /** @type {import('./UiContext.js').UiContext} */
  const ctx = {
    lab, input, metrics, toast, onError,
    confirm: async (m) => (await ask(m, null)) !== null,
    prompt: (m, initial = '') => ask(m, initial),
    refreshLibrary: () => {
      const runs = library.refresh();
      replay.setRuns(runs);
    },
    stopRecording: async () => {
      const r = lab.stopRecording();
      ctx.refreshLibrary();
      if (!r.ok) return;
      const name = await ctx.prompt(`Run sauvegardée (${r.summary.eventCount} événements, ${fmtTime(r.summary.simDurationS)} simulées). Renommer ?`, r.summary.name);
      if (name !== null && name.trim() && name !== r.summary.name) {
        try {
          lab.repo.rename(r.summary.id, name);
          ctx.refreshLibrary();
        } catch (e) {
          onError(e);
        }
      }
    },
    closePanelOnMobile: () => {
      if (!isDesktop()) setPanelOpen(false);
    },
    applyTouchButtons: (on) => setVisible($('touch-controls'), on),
  };

  const library = createLibraryPanel(ctx);
  const replay = createReplayPanel(ctx);
  const panels = [
    createGameplayPanel(ctx), createRecordingPanel(ctx), createSpeedPanel(ctx), replay, library,
    createResourcesPanel(ctx), createShopPanel(ctx), createDiagnosticsPanel(ctx), createSettingsPanel(ctx),
  ];
  const tabs = $('tabs');
  const body = $('panel-body');
  let activeTab = 'jeu';
  try {
    activeTab = localStorage.getItem('sslab:ui:tab') ?? 'jeu';
  } catch {
    /* préférence d'affichage seulement */
  }
  for (const p of panels) {
    const tab = h('button', { type: 'button', role: 'tab', class: 'tab', dataset: { tab: p.id } }, p.title);
    tab.addEventListener('click', () => selectTab(p.id));
    tabs.append(tab);
    p.el.dataset.panel = p.id;
    body.append(p.el);
  }
  /** @param {string} id */
  function selectTab(id) {
    if (!panels.some((p) => p.id === id)) id = 'jeu';
    activeTab = id;
    for (const t of tabs.children) setClass(t, 'active', /** @type {HTMLElement} */ (t).dataset.tab === id);
    for (const p of panels) setVisible(p.el, p.id === id);
    try {
      localStorage.setItem('sslab:ui:tab', id);
    } catch {
      /* ignoré */
    }
    if (id === 'runs') ctx.refreshLibrary();
  }
  selectTab(activeTab);
  ctx.refreshLibrary();
  ctx.applyTouchButtons(input.settings.touchButtons);
  setPanelOpen(isDesktop());

  $('fab').addEventListener('click', () => setPanelOpen(!panelEl.classList.contains('open')));
  $('btn-collapse').addEventListener('click', () => setPanelOpen(!panelEl.classList.contains('open')));
  $('btn-settings').addEventListener('click', () => {
    setPanelOpen(true);
    selectTab('reglages');
  });
  for (const b of document.querySelectorAll('#touch-controls [data-action]')) {
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      lab.input(/** @type {HTMLElement} */ (b).dataset.action ?? '');
    });
  }

  // Overlay (démarrage, pause, collision, fin)
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayText = $('overlay-text');
  const overlayButtons = $('overlay-buttons');
  let overlayKey = '';
  /** @param {string} label @param {() => unknown} fn @param {string} [cls] */
  const ob = (label, fn, cls = '') => {
    const b = h('button', { type: 'button', class: cls }, label);
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await fn();
      } catch (err) {
        onError(err);
      }
    });
    return b;
  };

  /** @param {ReturnType<LabController['snapshot']>} s */
  function updateOverlay(s) {
    const crashed = !!s.world?.crashed && (s.state === 'RUNNING' || s.state === 'RECORDING');
    const key = `${s.state}|${crashed}|${s.reviveCost?.keys}|${s.replay.loaded?.id}|${s.recording.lastSaved?.id}|${s.replay.report ? 1 : 0}`;
    if (key === overlayKey) return;
    overlayKey = key;
    /** @type {HTMLElement[]} */
    let buttons = [];
    let title = '';
    let text = '';
    switch (s.state) {
      case 'READY':
        title = 'Subway Surfers Infinite Lab';
        text = 'Glissez ou utilisez les flèches. REC enregistre la run pour la rejouer ensuite.';
        buttons = [ob('▶ Jouer', () => lab.startRun(), 'primary'), ob('● REC', () => lab.startRun({ record: true }), 'rec')];
        if (s.caps.replay) buttons.push(ob('⟲ Rejouer la run chargée', () => lab.startReplay()));
        break;
      case 'PAUSED':
      case 'RECORDING_PAUSED':
      case 'REPLAY_PAUSED':
        title = 'Pause';
        text = s.state === 'RECORDING_PAUSED' ? 'L\'enregistrement est en pause : il reprendra exactement là où il s\'est arrêté.' : '';
        buttons = [ob('⏵ Reprendre', () => lab.resume(), 'primary')];
        break;
      case 'FINISHED': {
        title = s.lastRun?.mode === 'rejeu' ? 'Rejeu terminé' : 'Partie terminée';
        const lr = s.lastRun;
        text = lr ? `Score ${fmtInt(lr.score)} · ${fmtNum(lr.distance)} m · ${lr.coins} pièces · ${lr.keys} clés` : '';
        if (s.replay.report && lr?.mode === 'rejeu') text += ` — ${s.replay.report.verdict}`;
        buttons = [ob('▶ Nouvelle partie', () => lab.startRun(), 'primary'), ob('● REC', () => lab.startRun({ record: true }), 'rec')];
        if (s.caps.replay) buttons.push(ob(lr?.mode === 'rejeu' ? '↺ Revoir' : '⟲ Rejouer une run', () => lab.startReplay()));
        if (s.recording.lastSaved && lr?.mode === 'enregistrement') {
          const id = s.recording.lastSaved.id;
          buttons.push(ob('⟲ Rejouer cette run', () => lab.startReplay(id)));
        }
        break;
      }
      case 'ERROR':
        title = 'Erreur';
        text = s.diagnostics.errors.at(-1)?.message ?? 'Erreur inconnue.';
        buttons = [ob('Revenir à l\'état prêt', () => lab.recover(), 'primary')];
        break;
      default:
        if (crashed) {
          title = 'Collision !';
          text = s.state === 'RECORDING' ? 'L\'enregistrement continue. Ressuscitez ou arrêtez-le.' : '';
          buttons = [ob(`✚ Ressusciter (${s.reviveCost?.keys ?? 1} clé${(s.reviveCost?.keys ?? 1) > 1 ? 's' : ''})`, () => lab.revive(), 'accent')];
          buttons.push(s.state === 'RECORDING' ? ob('■ STOP et sauvegarder', () => ctx.stopRecording(), 'danger') : ob('■ Terminer', () => lab.finishRun(), 'danger'));
        }
    }
    setVisible(overlay, buttons.length > 0);
    setText(overlayTitle, title);
    setText(overlayText, text);
    overlayButtons.replaceChildren(...buttons);
  }

  // HUD
  const hud = {
    score: $('hud-score'), coins: $('hud-coins'), keys: $('hud-keys'), board: $('hud-board'), distance: $('hud-distance'), speed: $('hud-speed'),
    rec: $('hud-rec'), replay: $('hud-replay'), progress: /** @type {HTMLElement} */ ($('hud-progress')),
  };
  const top = { state: $('top-state'), rec: $('top-rec'), replay: $('top-replay'), speed: $('top-speed') };

  /** @param {ReturnType<LabController['snapshot']>} s */
  function updateChrome(s) {
    const w = s.world;
    setText(hud.score, w ? fmtInt(w.score) : '0');
    setText(hud.coins, w ? fmtInt(w.coins) : '0');
    setText(hud.keys, w ? fmtInt(w.keys) : '0');
    const boardOn = !!w && (w.hoverboardTicks > 0 || w.hoverboardsLeft > 0) && !w.crashed;
    setVisible(hud.board, boardOn);
    if (w && boardOn) {
      setText(hud.board, w.hoverboardTicks > 0 ? `HOVERBOARD ${Math.ceil(w.hoverboardTicks / 60)} s` : `Hoverboards : ${w.hoverboardsLeft} (double appui)`);
    }
    setText(hud.distance, w ? `${fmtInt(w.distance)} m` : '0 m');
    setText(hud.speed, formatSpeed(s.clock.multiplier));
    setClass(hud.speed, 'slow', s.clock.multiplier < 1);
    const recOn = s.recording.active;
    setVisible(hud.rec, recOn);
    if (recOn) setText(hud.rec, `● REC ${fmtTime(s.recording.durationMs / 1000)}${s.state === 'RECORDING_PAUSED' ? ' (pause)' : ''}`);
    setVisible(hud.replay, s.replay.active);
    if (s.replay.active) {
      setText(hud.replay, `⟲ REJEU ${fmtTime(s.replay.currentS)} / ${fmtTime(s.replay.totalS)}`);
      hud.progress.style.width = `${(s.replay.progress * 100).toFixed(1)}%`;
    }
    setText(top.state, s.stateLabel);
    top.state.dataset.state = s.state;
    setText(top.rec, recOn ? `REC ${s.recording.eventCount} évts` : 'REC —');
    setClass(top.rec, 'on', recOn && s.state === 'RECORDING');
    setText(top.replay, s.replay.active ? `REJEU ${Math.round(s.replay.progress * 100)} %` : s.replay.loaded ? `Rejeu prêt` : 'Rejeu —');
    setClass(top.replay, 'on', s.replay.active);
    setText(top.speed, formatSpeed(s.clock.multiplier));
  }

  if (storageWarning) toast('error', storageWarning);
  if (input.loadWarning) toast('warning', input.loadWarning);

  // Boucle principale
  let lastUi = 0;
  let frames = 0;
  let fpsStart = performance.now();
  let lastIndexKey = '';
  /** @param {number} t */
  function loop(t) {
    const { alpha } = lab.frame();
    const r0 = performance.now();
    try {
      renderer.render(lab.world, alpha, t);
    } catch (e) {
      lab.logError('RENDER', /** @type {Error} */ (e).message);
    }
    metrics.renderMs = metrics.renderMs * 0.9 + (performance.now() - r0) * 0.1;
    metrics.drawCount = renderer.drawCount;
    frames++;
    if (t - fpsStart >= 1000) {
      metrics.fps = (frames * 1000) / (t - fpsStart);
      frames = 0;
      fpsStart = t;
    }
    if (t - lastUi >= UI_REFRESH_MS) {
      lastUi = t;
      const s = lab.snapshot();
      updateChrome(s);
      updateOverlay(s);
      const active = panels.find((p) => p.id === activeTab);
      if (panelEl.classList.contains('open') && active) active.update(s);
      for (const n of lab.drainNotices()) toast(n.level, n.message);
      const indexKey = lab.repo.index.map((x) => x.id + x.name).join('|');
      if (indexKey !== lastIndexKey) {
        lastIndexKey = indexKey;
        ctx.refreshLibrary();
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Onglet masqué : pause automatique pour ne pas perdre d'actions pendant que le joueur ne voit rien.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && lab.fsm.is('RUNNING', 'RECORDING')) lab.pause();
    if (document.hidden && lab.recorder.active) lab.recorder.flushDraft();
  });
  window.addEventListener('pagehide', () => {
    if (lab.recorder.active) lab.recorder.flushDraft();
  });

  // Point d'accès pour le débogage et les tests E2E (lecture/pilotage, aucune donnée sensible).
  /** @type {any} */ (window).__lab = lab;
  return lab;
}

/** @typedef {import('./UiContext.js').UiContext['toast']} UiToast */
