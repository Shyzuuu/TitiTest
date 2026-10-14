/** Panneau « Diagnostic » : uniquement des valeurs mesurées. */

import { formatChars } from '../../storage/SaveManager.js';
import { fmtDate, fmtNum, h, setClass, setText, statRow } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createDiagnosticsPanel(ctx) {
  const { lab } = ctx;
  const stats = h('dl', { class: 'stats' });
  const v = {
    fps: statRow(stats, 'FPS (mesuré)'),
    frame: statRow(stats, 'Durée de mise à jour'),
    render: statRow(stats, 'Durée de rendu'),
    steps: statRow(stats, 'Pas / image'),
    dropped: statRow(stats, 'Pas abandonnés'),
    events: statRow(stats, 'Événements enregistrés'),
    buffer: statRow(stats, 'Tampon d\'événements'),
    inputs: statRow(stats, 'Entrées ignorées / refusées'),
    save: statRow(stats, 'Sauvegarde'),
    storage: statRow(stats, 'Stockage'),
    memory: statRow(stats, 'Mémoire JS'),
    divergence: statRow(stats, 'Dernière divergence'),
    drawn: statRow(stats, 'Objets dessinés'),
  };
  const errors = h('ul', { class: 'log' });
  const transitions = h('ul', { class: 'log' });
  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Diagnostic'),
    stats,
    h('h4', {}, 'Erreurs récentes'),
    errors,
    h('h4', {}, 'Transitions d\'état'),
    transitions,
  );
  let lastErrorsKey = '';
  let lastTransKey = '';
  let storageCheck = 0;
  let storageText = '—';

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const d = s.diagnostics;
    const m = ctx.metrics;
    setText(v.fps, m.fps ? fmtNum(m.fps, 0) : '—');
    setText(v.frame, `${fmtNum(d.frameMs, 2)} ms`);
    setText(v.render, `${fmtNum(m.renderMs, 2)} ms`);
    setText(v.steps, String(d.lastFrameSteps));
    setText(v.dropped, String(d.droppedSteps));
    setText(v.events, s.recording.active ? String(s.recording.eventCount) : '—');
    setText(v.buffer, s.recording.active ? `${s.recording.pending} en attente d'écriture` : '—');
    setText(v.inputs, `${d.ignoredInputs} / ${d.rejectedInputs}`);
    setText(v.save, d.saveError ? d.saveError : d.lastWriteAt ? `OK (${d.writeCount} écritures, dernière ${fmtDate(new Date(d.lastWriteAt).toISOString())})` : 'aucune écriture');
    setClass(v.save, 'error-text', !!d.saveError);
    const now = performance.now();
    if (now - storageCheck > 2000) {
      // Parcours complet du stockage : limité à toutes les 2 s.
      storageCheck = now;
      storageText = `${formatChars(lab.saveManager.usageChars())} / budget ${formatChars(lab.saveManager.budgetChars)}`;
    }
    setText(v.storage, storageText);
    const mem = /** @type {any} */ (performance).memory;
    setText(v.memory, mem ? `${fmtNum(mem.usedJSHeapSize / 1048576)} Mo utilisés / ${fmtNum(mem.jsHeapSizeLimit / 1048576, 0)} Mo` : 'non exposée par ce navigateur');
    const div = s.replay.lastDivergence;
    setText(v.divergence, div ? `tick ${div.tick} : ${div.detail}` : 'aucune');
    setText(v.drawn, String(m.drawCount));
    const ek = d.errors.map((e) => e.at).join(',');
    if (ek !== lastErrorsKey) {
      lastErrorsKey = ek;
      errors.replaceChildren(...(d.errors.length ? d.errors.map((e) => h('li', { class: 'error-text' }, `[${e.code}] ${e.message}`)) : [h('li', { class: 'hint' }, 'aucune')]));
    }
    const tk = d.transitions.map((t) => t.at + t.to).join(',');
    if (tk !== lastTransKey) {
      lastTransKey = tk;
      transitions.replaceChildren(...d.transitions.map((t) => h('li', {}, `${t.from} → ${t.to}${t.reason ? ` (${t.reason})` : ''}`)));
    }
  }

  return { id: 'diag', title: 'Diagnostic', el, update };
}
