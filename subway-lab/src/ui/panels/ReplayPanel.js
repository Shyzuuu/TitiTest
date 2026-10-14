/** Panneau « Rejeu » : sélection, lecture et rapport de comparaison. */

import { formatReport } from '../../replay/ReplayComparator.js';
import { formatSpeed } from '../../simulation/SimulationClock.js';
import { button, fmtInt, fmtTime, h, setClass, setDisabled, setText, statRow } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createReplayPanel(ctx) {
  const { lab } = ctx;
  const err = ctx.onError;
  const select = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Run à rejouer' }));
  const bLoad = button('Charger', () => {
    if (!select.value) throw new Error('Aucune run sélectionnée.');
    const info = lab.loadReplay(select.value);
    ctx.toast('info', `« ${info.name} » chargée : ${info.actionCount} actions, ${fmtTime(info.durationS)} simulées.`);
    for (const w of info.warnings) ctx.toast('warning', w);
  }, err);
  const bPlay = button('▶ Lecture', () => lab.startReplay(), err, { class: 'primary' });
  const bPause = button('⏸ Pause', () => lab.pause(), err);
  const bResume = button('⏵ Reprendre', () => lab.resume(), err);
  const bStop = button('■ Arrêt', () => lab.stopReplay(), err, { class: 'danger' });
  const bRestart = button('↺ Depuis le début', () => lab.restartReplay(), err);
  const follow = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: true }));
  follow.addEventListener('change', () => lab.setFollowOriginalSpeed(follow.checked));

  const progress = /** @type {HTMLProgressElement} */ (h('progress', { max: 1, value: 0 }));
  const stats = h('dl', { class: 'stats' });
  const v = {
    loaded: statRow(stats, 'Run chargée'),
    time: statRow(stats, 'Temps'),
    speed: statRow(stats, 'Vitesse du rejeu'),
    live: statRow(stats, 'Divergences en direct'),
  };
  const report = h('div', { class: 'report' });
  let lastReport = /** @type {unknown} */ (null);

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Rejeu'),
    h('div', { class: 'row' }, select, bLoad),
    h('div', { class: 'btn-row' }, bPlay, bPause, bResume, bStop, bRestart),
    progress,
    stats,
    h('label', { class: 'check' }, follow, ' Suivre la chronologie de vitesse d\'origine (désactivé dès que vous changez la vitesse)'),
    h('h4', {}, 'Comparaison original / rejeu'),
    report,
  );

  /** @param {import('../../storage/RunRepository.js').RunSummary[]} runs */
  function setRuns(runs) {
    const current = select.value;
    select.replaceChildren(h('option', { value: '' }, runs.length ? '— Choisir une run —' : 'Aucune run enregistrée'));
    for (const r of runs) {
      if (r.integrity === 'corrupt') continue;
      select.append(h('option', { value: r.id }, `${r.name} · ${fmtTime(r.simDurationS)} · ${fmtInt(r.score)} pts`));
    }
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  }

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const r = s.replay;
    setText(v.loaded, r.loaded ? r.loaded.name : 'aucune');
    setText(v.time, `${fmtTime(r.currentS)} / ${fmtTime(r.totalS)}`);
    setText(v.speed, `${formatSpeed(s.clock.multiplier)}${r.active && r.followOriginalSpeed ? ' (chronologie d\'origine)' : ''}`);
    setText(v.live, r.active || r.divergences ? `${r.divergences}${r.lastDivergence ? ` — tick ${r.lastDivergence.tick} : ${r.lastDivergence.detail}` : ''}` : '—');
    setClass(v.live, 'error-text', r.divergences > 0);
    if (Math.abs(progress.value - r.progress) > 1e-4) progress.value = r.progress;
    if (follow.checked !== r.followOriginalSpeed) follow.checked = r.followOriginalSpeed;
    setDisabled(select, !s.caps.loadReplay);
    setDisabled(bLoad, !s.caps.loadReplay);
    setDisabled(bPlay, !s.caps.replay);
    setDisabled(bPause, s.state !== 'REPLAYING');
    setDisabled(bResume, s.state !== 'REPLAY_PAUSED');
    setDisabled(bStop, !s.caps.stopReplay);
    setDisabled(bRestart, !s.caps.restartReplay);
    if (r.report !== lastReport) {
      lastReport = r.report;
      report.replaceChildren(...(r.report
        ? formatReport(r.report).map((line, i) => h('p', { class: i === 0 ? (r.report?.exact ? 'ok-text' : 'error-text') : '' }, line))
        : [h('p', { class: 'hint' }, 'Le rapport apparaît à la fin (ou à l\'arrêt) d\'un rejeu.')]));
    }
  }

  return { id: 'rejeu', title: 'Rejeu', el, update, setRuns };
}
