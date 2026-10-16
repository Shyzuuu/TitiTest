/** Panneau « Vitesse » : curseur et préréglages du multiplicateur de temps. */

import { MAX_SPEED, MIN_SPEED, SPEED_PRESETS, formatSpeed } from '../../simulation/SimulationClock.js';
import { fmtNum, fmtTime, h, setClass, setText, statRow } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createSpeedPanel(ctx) {
  const { lab } = ctx;
  const value = h('output', { class: 'speed-value' }, '1,00×');
  const slider = /** @type {HTMLInputElement} */ (h('input', {
    type: 'range', min: MIN_SPEED, max: MAX_SPEED, step: 0.01, value: 1, 'aria-label': 'Multiplicateur de vitesse',
  }));
  // 'input' (et non 'change') : effet immédiat pendant le glissement du curseur.
  slider.addEventListener('input', () => {
    try {
      lab.setSpeed(slider.valueAsNumber);
    } catch (e) {
      ctx.onError(e);
    }
  });
  const presets = SPEED_PRESETS.map((p) => {
    const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', title: p.label, dataset: { speed: String(p.value) } }, formatSpeed(p.value)));
    b.addEventListener('click', () => {
      try {
        lab.setSpeed(p.value);
      } catch (e) {
        ctx.onError(e);
      }
    });
    return b;
  });
  const stats = h('dl', { class: 'stats' });
  const v = {
    real: statRow(stats, 'Temps réel écoulé'),
    sim: statRow(stats, 'Temps de simulation'),
    ratio: statRow(stats, 'Ratio mesuré'),
    paused: statRow(stats, 'Durée de pause'),
    perSpeed: statRow(stats, 'Temps par vitesse'),
  };
  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Vitesse'),
    h('div', { class: 'speed-head' }, h('span', {}, 'Vitesse actuelle : '), value),
    slider,
    h('div', { class: 'btn-row presets' }, ...presets),
    stats,
    h('p', { class: 'hint' }, 'Le multiplicateur ne change que le rythme des pas fixes (60 pas = 1 s simulée) : positions, timers et collisions restent identiques à toutes les vitesses.'),
  );

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const m = s.clock.multiplier;
    setText(value, formatSpeed(m));
    if (document.activeElement !== slider && Math.abs(slider.valueAsNumber - m) > 1e-6) slider.value = String(m);
    for (const b of presets) setClass(b, 'active', Number(b.dataset.speed) === m);
    const activeReal = s.clock.realElapsed - s.clock.pausedDuration;
    setText(v.real, fmtTime(s.clock.realElapsed));
    setText(v.sim, fmtTime(s.simTime));
    setText(v.ratio, activeReal > 0.5 ? `${fmtNum(s.simTime / activeReal, 2)}×` : '—');
    setText(v.paused, fmtTime(s.clock.pausedDuration));
    const per = Object.entries(s.clock.timeAtSpeed).map(([k, t]) => `${k.replace('.', ',')}× : ${fmtNum(t)} s`);
    setText(v.perSpeed, per.length ? per.join(' · ') : '—');
  }

  return { id: 'vitesse', title: 'Vitesse', el, update };
}
