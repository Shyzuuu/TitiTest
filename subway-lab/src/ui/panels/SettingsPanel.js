/** Panneau « Réglages » : remappage des touches et sensibilité tactile. */

import { BINDABLE, BINDING_LABELS } from '../../input/InputController.js';
import { button, h, setText } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createSettingsPanel(ctx) {
  const { input } = ctx;
  const err = ctx.onError;
  /** @type {Map<string, HTMLElement>} */
  const labels = new Map();
  const table = h('ul', { class: 'bindings' });
  for (const action of BINDABLE) {
    const keys = h('code');
    labels.set(action, keys);
    table.append(h('li', {},
      h('span', {}, BINDING_LABELS[action]),
      keys,
      button('Changer', async (/** @type {any} */ _e) => {
        ctx.toast('info', `Appuyez sur la nouvelle touche pour « ${BINDING_LABELS[action]} » (Échap pour annuler).`);
        const code = await input.remap(action);
        if (code) ctx.toast('success', `« ${BINDING_LABELS[action]} » → ${code}`);
        refresh();
      }, err),
    ));
  }
  const threshold = /** @type {HTMLInputElement} */ (h('input', { type: 'range', min: 12, max: 80, step: 2 }));
  const thresholdValue = h('output');
  threshold.addEventListener('change', () => {
    try {
      input.settings.swipeThreshold = threshold.valueAsNumber;
      input.save();
      refresh();
    } catch (e) {
      err(e);
    }
  });
  const touchButtons = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
  touchButtons.addEventListener('change', () => {
    try {
      input.settings.touchButtons = touchButtons.checked;
      input.save();
      ctx.applyTouchButtons(touchButtons.checked);
    } catch (e) {
      err(e);
    }
  });

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Commandes'),
    table,
    h('div', { class: 'btn-row' }, button('Touches par défaut', () => {
      input.resetBindings();
      ctx.applyTouchButtons(false);
      refresh();
    }, err)),
    h('h4', {}, 'Tactile'),
    h('label', {}, 'Distance minimale d\'un glissement : ', thresholdValue, threshold),
    h('label', { class: 'check' }, touchButtons, ' Afficher les boutons tactiles'),
    h('p', { class: 'hint' }, 'Glisser à gauche/droite : changer de voie · vers le haut : sauter · vers le bas : glisser.'),
  );

  function refresh() {
    for (const action of BINDABLE) setText(/** @type {HTMLElement} */ (labels.get(action)), input.settings.keymap[action].join(' · ') || '—');
    threshold.value = String(input.settings.swipeThreshold);
    setText(thresholdValue, `${input.settings.swipeThreshold} px `);
    touchButtons.checked = input.settings.touchButtons;
  }
  refresh();

  return { id: 'reglages', title: 'Réglages', el, update: () => {} };
}
