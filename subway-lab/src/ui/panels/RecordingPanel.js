/** Panneau « REC » : enregistrement d'une run. */

import { button, downloadText, fmtTime, h, setClass, setDisabled, setText, setVisible, statRow } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createRecordingPanel(ctx) {
  const { lab } = ctx;
  const err = ctx.onError;
  const nameInput = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 80, placeholder: 'Nom de la run (optionnel)' }));
  const bRec = button('● REC', () => {
    lab.startRun({ record: true, name: nameInput.value });
    nameInput.value = '';
  }, err, { class: 'rec' });
  const bPause = button('⏸ PAUSE', () => lab.pause(), err);
  const bResume = button('⏵ REPRENDRE', () => lab.resume(), err);
  const bStop = button('■ STOP', () => ctx.stopRecording(), err, { class: 'danger' });

  const stats = h('dl', { class: 'stats' });
  const v = {
    status: statRow(stats, 'État'),
    duration: statRow(stats, 'Durée (réelle)'),
    sim: statRow(stats, 'Durée (simulation)'),
    events: statRow(stats, 'Événements'),
    buffer: statRow(stats, 'Tampon non vidé'),
    save: statRow(stats, 'Sauvegarde'),
  };
  const recovery = h('div', { class: 'warning-box', hidden: true });
  const recoveryText = h('p');
  recovery.append(
    recoveryText,
    h('div', { class: 'btn-row' },
      button('Réessayer la sauvegarde', () => {
        const r = lab.retrySaveUnsaved();
        if (!r.ok) ctx.toast('error', r.error);
      }, err),
      button('Exporter en JSON', () => {
        if (lab.unsavedRun) downloadText(`${lab.unsavedRun.id}.json`, JSON.stringify(lab.unsavedRun));
      }, err),
    ),
  );

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Enregistrement'),
    nameInput,
    h('div', { class: 'btn-row' }, bRec, bPause, bResume, bStop),
    stats,
    recovery,
    h('p', { class: 'hint' }, 'Politique de pause : une commande reçue pendant la pause est ignorée (ni appliquée ni enregistrée). Les changements de vitesse sont enregistrés séparément et n\'interrompent jamais la capture.'),
  );

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const r = s.recording;
    setText(v.status, r.active ? (s.state === 'RECORDING_PAUSED' ? 'En pause' : 'REC en cours') : 'Inactif');
    setClass(v.status, 'rec-text', r.active && s.state === 'RECORDING');
    setText(v.duration, r.active ? fmtTime(r.durationMs / 1000) : '—');
    setText(v.sim, r.active ? fmtTime(s.simTime) : '—');
    setText(v.events, r.active ? String(r.eventCount) : '—');
    setText(v.buffer, r.active ? `${r.pending} événement(s)` : '—');
    setText(v.save, r.draftError ? `Brouillon en échec : ${r.draftError}` : r.lastSaved ? `Dernière run : « ${r.lastSaved.name} »` : 'Aucune run sauvegardée dans cette session');
    setClass(v.save, 'error-text', !!r.draftError);
    setDisabled(bRec, !s.caps.record);
    setDisabled(nameInput, !s.caps.record);
    setDisabled(bPause, !(s.state === 'RECORDING'));
    setDisabled(bResume, !(s.state === 'RECORDING_PAUSED'));
    setDisabled(bStop, !s.caps.stopRecording);
    setVisible(recovery, !!r.unsaved);
    if (r.unsaved) setText(recoveryText, `La run « ${r.unsaved.name} » n'a pas pu être sauvegardée. Elle est conservée en mémoire : réessayez ou exportez-la.`);
  }

  return { id: 'rec', title: 'REC', el, update };
}
