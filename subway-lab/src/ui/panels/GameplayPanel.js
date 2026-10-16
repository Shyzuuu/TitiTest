/** Panneau « Jeu » : état en temps réel et commandes de partie. */

import { button, fmtInt, fmtNum, h, setDisabled, setText, statRow } from '../dom.js';

const PLAYER_STATE_LABELS = { RUNNING: 'Course', JUMPING: 'Saut', SLIDING: 'Glissade', FLYING: 'Vol (jetpack)', CRASHED: 'Collision' };
const POWERUP_LABELS = { MAGNET: 'Aimant', DOUBLE: 'Score ×2', SNEAKERS: 'Super-baskets', JETPACK: 'Jetpack' };

/** @param {import('../UiContext.js').UiContext} ctx */
export function createGameplayPanel(ctx) {
  const { lab } = ctx;
  const stats = h('dl', { class: 'stats' });
  const v = {
    score: statRow(stats, 'Score'),
    distance: statRow(stats, 'Distance'),
    coins: statRow(stats, 'Pièces (run)'),
    keys: statRow(stats, 'Clés (run)'),
    speed: statRow(stats, 'Vitesse d\'avance'),
    multiplier: statRow(stats, 'Multiplicateur temps'),
    player: statRow(stats, 'Personnage'),
    game: statRow(stats, 'État du jeu'),
    level: statRow(stats, 'Difficulté'),
    powerups: statRow(stats, 'Bonus actifs'),
    board: statRow(stats, 'Hoverboards'),
    seed: statRow(stats, 'Graine'),
  };
  const err = ctx.onError;
  const bPlay = button('▶ Jouer', () => lab.startRun(), err, { class: 'primary' });
  const bPause = button('⏸ Pause', () => lab.pause(), err);
  const bResume = button('⏵ Reprendre', () => lab.resume(), err);
  const bFinish = button('■ Terminer', () => lab.finishRun(), err);
  const bRestart = button('↻ Recommencer (R)', () => lab.restart(), err);
  const bRevive = button('✚ Ressusciter', () => {
    const r = lab.revive();
    ctx.toast('info', `Résurrection : ${r.cost.keys} clé(s) dépensée(s).`);
  }, err, { class: 'accent' });
  const bBoard = button('Hoverboard (H)', () => {
    const r = lab.input('HOVERBOARD');
    if (!r.accepted) ctx.toast('info', r.reason ?? 'Hoverboard indisponible.');
  }, err);
  const autopilot = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', id: 'opt-autopilot' }));
  autopilot.addEventListener('change', () => {
    lab.autopilot = autopilot.checked;
  });

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Partie'),
    stats,
    h('div', { class: 'btn-row' }, bPlay, bPause, bResume, bFinish, bRestart, bRevive, bBoard),
    h('label', { class: 'check' }, autopilot, ' Pilote automatique (ses actions sont enregistrées comme celles d\'un joueur)'),
  );

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const w = s.world;
    setText(v.score, w ? fmtInt(w.score) : '—');
    setText(v.distance, w ? `${fmtNum(w.distance)} m` : '—');
    setText(v.coins, w ? fmtInt(w.coins) : '—');
    setText(v.keys, w ? fmtInt(w.keys) : '—');
    setText(v.speed, w ? `${fmtNum(w.speed)} m/s` : '—');
    setText(v.multiplier, `${s.clock.multiplier.toFixed(2).replace('.', ',')}×`);
    setText(v.player, w ? PLAYER_STATE_LABELS[/** @type {'RUNNING'} */ (w.playerState)] ?? w.playerState : '—');
    setText(v.game, s.stateLabel);
    setText(v.level, w ? `Niveau ${w.level}` : '—');
    const active = w ? Object.entries(w.powerups).filter(([, t]) => t > 0).map(([k, t]) => `${POWERUP_LABELS[/** @type {'MAGNET'} */ (k)]} ${Math.ceil(t / 60)} s`) : [];
    setText(v.powerups, active.length ? active.join(', ') : 'aucun');
    setText(v.seed, w ? String(w.seed) : '—');
    setText(v.board, w ? `${w.hoverboardsLeft} en stock${w.hoverboardTicks > 0 ? ` · actif ${Math.ceil(w.hoverboardTicks / 60)} s` : ''}` : '—');
    setDisabled(bBoard, !s.caps.input || !w || w.hoverboardsLeft <= 0 || w.hoverboardTicks > 0);
    setDisabled(bPlay, !s.caps.play);
    setDisabled(bPause, !s.caps.pause);
    setDisabled(bResume, !s.caps.resume);
    setDisabled(bFinish, !s.caps.finish);
    setDisabled(bRestart, !s.caps.restart);
    setDisabled(bRevive, !s.caps.revive);
    setText(bRevive, s.reviveCost && s.caps.revive ? `✚ Ressusciter (${s.reviveCost.keys} clé${s.reviveCost.keys > 1 ? 's' : ''})` : '✚ Ressusciter');
    if (autopilot.checked !== s.autopilot) autopilot.checked = s.autopilot;
  }

  return { id: 'jeu', title: 'Jeu', el, update };
}
