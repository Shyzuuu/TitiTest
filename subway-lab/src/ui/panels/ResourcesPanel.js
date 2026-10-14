/** Panneau « Ressources » : pièces et clés de TEST du prototype. */

import { MAX_RESOURCE } from '../../resources/ResourceTestManager.js';
import { button, fmtDate, fmtInt, h, setClass, setText, statRow } from '../dom.js';

const MODE_LABELS = { NORMAL: 'Normal', UNLIMITED: 'Illimité', CUSTOM: 'Personnalisé' };

/** @param {import('../UiContext.js').UiContext} ctx */
export function createResourcesPanel(ctx) {
  const { lab } = ctx;
  const err = ctx.onError;
  const res = lab.resources;
  const stats = h('dl', { class: 'stats' });
  const v = {
    coins: statRow(stats, 'Pièces'),
    coinsMode: statRow(stats, 'Mode pièces'),
    keys: statRow(stats, 'Clés'),
    keysMode: statRow(stats, 'Mode clés'),
    wallet: statRow(stats, 'Portefeuille normal'),
    updated: statRow(stats, 'Modifié le'),
  };
  const coinsInput = /** @type {HTMLInputElement} */ (h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Pièces', 'aria-label': 'Quantité de pièces' }));
  const keysInput = /** @type {HTMLInputElement} */ (h('input', { type: 'text', inputmode: 'numeric', placeholder: 'Clés', 'aria-label': 'Quantité de clés' }));

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Ressources de test'),
    stats,
    h('div', { class: 'btn-row' },
      button('∞ Pièces', () => res.enableUnlimited('coins'), err, { class: 'accent' }),
      button('∞ Clés', () => res.enableUnlimited('keys'), err, { class: 'accent' }),
      button('∞ Les deux', () => res.enableUnlimited('both'), err, { class: 'accent' }),
      button('Désactiver l\'illimité', () => res.disableUnlimited('both'), err),
      button('Mode normal', () => res.returnToNormal(), err),
      button('Réinitialiser', async () => {
        if (await ctx.confirm('Remettre le portefeuille et les quantités personnalisées à zéro ?')) res.resetResources();
      }, err, { class: 'danger' }),
    ),
    h('h4', {}, 'Quantité personnalisée'),
    h('div', { class: 'row' }, coinsInput, button('Appliquer', () => {
      const n = res.setCustom('coins', coinsInput.value);
      ctx.toast('success', `Pièces : ${fmtInt(n)} (mode personnalisé).`);
      coinsInput.value = '';
    }, err)),
    h('div', { class: 'row' }, keysInput, button('Appliquer', () => {
      const n = res.setCustom('keys', keysInput.value);
      ctx.toast('success', `Clés : ${fmtInt(n)} (mode personnalisé).`);
      keysInput.value = '';
    }, err)),
    h('p', { class: 'hint' }, `Entiers de 0 à ${fmtInt(MAX_RESOURCE)}. Ces ressources n'existent que dans ce prototype : aucun compte, achat ou sauvegarde du jeu officiel n'est concerné.`),
  );

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const r = s.resources;
    setText(v.coins, fmtInt(r.coins.balance));
    setText(v.keys, fmtInt(r.keys.balance));
    setText(v.coinsMode, MODE_LABELS[r.coins.mode]);
    setText(v.keysMode, MODE_LABELS[r.keys.mode]);
    setClass(v.coinsMode, 'ok-text', r.coins.mode === 'UNLIMITED');
    setClass(v.keysMode, 'ok-text', r.keys.mode === 'UNLIMITED');
    setText(v.wallet, `${fmtInt(r.coins.wallet)} pièces · ${fmtInt(r.keys.wallet)} clés`);
    setText(v.updated, r.updatedAt.startsWith('1970') ? 'jamais' : fmtDate(r.updatedAt));
  }

  return { id: 'ressources', title: 'Ressources', el, update };
}
