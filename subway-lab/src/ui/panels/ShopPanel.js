/** Panneau « Boutique » : achats simulés pour éprouver les ressources de test. */

import { button, fmtInt, h, setDisabled, setText } from '../dom.js';

/** @param {import('../UiContext.js').UiContext} ctx */
export function createShopPanel(ctx) {
  const { lab } = ctx;
  const err = ctx.onError;
  const list = h('ul', { class: 'shop-list' });
  const owned = h('p', { class: 'hint' });
  const skinSelect = /** @type {HTMLSelectElement} */ (h('select', { 'aria-label': 'Tenue équipée' }));
  skinSelect.addEventListener('change', () => {
    try {
      lab.shop.equip(skinSelect.value);
    } catch (e) {
      err(e);
    }
  });
  /** @type {Map<string, { btn: HTMLButtonElement, cost: HTMLElement }>} */
  const rows = new Map();
  for (const it of lab.shop.snapshot().catalog) {
    const cost = h('span', { class: 'cost' });
    const btn = button('Acheter', () => {
      const r = lab.shop.buy(it.id);
      if (r.ok) ctx.toast('success', `Achat : ${it.label}.`);
      else ctx.toast('warning', r.reason);
    }, err);
    rows.set(it.id, { btn, cost });
    list.append(h('li', {}, h('span', {}, it.label), cost, btn));
  }

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Boutique (fictive)'),
    list,
    h('div', { class: 'row' }, h('span', {}, 'Tenue : '), skinSelect),
    owned,
    h('div', { class: 'btn-row' },
      button('Test : 1 000 achats', () => {
        // Achats en rafale sans persistance individuelle, puis une seule sauvegarde.
        const before = lab.resources.snapshot();
        let ok = 0;
        for (let i = 0; i < 1000; i++) {
          if (lab.resources.spend({ coins: 1, keys: 1 }, { persist: false }).ok) ok++;
        }
        lab.resources.save();
        const after = lab.resources.snapshot();
        ctx.toast(ok === 1000 ? 'success' : 'warning', `${ok}/1000 débits acceptés. Pièces ${fmtInt(before.coins.balance)} → ${fmtInt(after.coins.balance)}, clés ${fmtInt(before.keys.balance)} → ${fmtInt(after.keys.balance)}.`);
      }, err),
      button('Réinitialiser le profil', async () => {
        if (await ctx.confirm('Réinitialiser améliorations, tenues et bonus de départ ?')) lab.shop.resetProfile();
      }, err, { class: 'danger' }),
    ),
  );

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} _s */
  function update(_s) {
    const snap = lab.shop.snapshot();
    for (const it of snap.catalog) {
      const row = rows.get(it.id);
      if (!row) continue;
      setText(row.cost, it.cost ? [it.cost.coins ? `${fmtInt(it.cost.coins)} pièces` : '', it.cost.keys ? `${it.cost.keys} clés` : ''].filter(Boolean).join(' + ') : 'acquis / max');
      setDisabled(row.btn, !it.affordable);
    }
    const p = snap.profile;
    setText(owned, `Niveaux : aimant ${p.upgrades.MAGNET}, ×2 ${p.upgrades.DOUBLE}, baskets ${p.upgrades.SNEAKERS} · bonus de départ en stock : ${p.startMagnets}`);
    const opts = p.skins.join(',');
    if (skinSelect.dataset.opts !== opts) {
      skinSelect.dataset.opts = opts;
      skinSelect.replaceChildren(...p.skins.map((s) => h('option', { value: s }, s)));
    }
    if (skinSelect.value !== p.equippedSkin && document.activeElement !== skinSelect) skinSelect.value = p.equippedSkin;
  }

  return { id: 'boutique', title: 'Boutique', el, update };
}
