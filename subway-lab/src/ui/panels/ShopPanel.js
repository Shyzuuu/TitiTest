/** Panneau « Boutique » : personnages, améliorations, objets et multiplicateur. */

import { CHARACTERS, characterById } from '../../game/characters.js';
import { MAX_UPGRADE_LEVEL } from '../../game/constants.js';
import { button, fmtInt, h, setClass, setDisabled, setText } from '../dom.js';

const SECTIONS = /** @type {const} */ ([
  ['character', 'Personnages'],
  ['upgrade', 'Améliorations'],
  ['item', 'Objets'],
  ['multiplier', 'Multiplicateur'],
]);

/** @param {{ coins: number, keys: number } | null} cost */
function costText(cost) {
  if (!cost) return '';
  return [cost.coins ? `${fmtInt(cost.coins)} pièces` : '', cost.keys ? `${cost.keys} clé${cost.keys > 1 ? 's' : ''}` : ''].filter(Boolean).join(' + ') || 'gratuit';
}

/** @param {import('../../game/characters.js').Character} c */
function avatar(c) {
  const el = h('span', { class: `avatar acc-${c.accessory}`, 'aria-hidden': 'true' });
  el.style.setProperty('--av-body', c.colors.body);
  el.style.setProperty('--av-legs', c.colors.legs);
  el.style.setProperty('--av-head', c.colors.head);
  el.style.setProperty('--av-hair', c.colors.hair);
  el.style.setProperty('--av-accent', c.colors.accent);
  el.append(h('span', { class: 'av-head' }), h('span', { class: 'av-body' }), h('span', { class: 'av-legs' }));
  return el;
}

/** @param {import('../UiContext.js').UiContext} ctx */
export function createShopPanel(ctx) {
  const { lab } = ctx;
  const err = ctx.onError;
  const wallet = h('p', { class: 'wallet' });
  const inventory = h('p', { class: 'hint' });

  /**
   * @type {Map<string, { btn: HTMLButtonElement, cost: HTMLElement, level?: HTMLElement, equip?: HTMLButtonElement, card: HTMLElement }>}
   */
  const rows = new Map();
  const lists = Object.fromEntries(SECTIONS.map(([cat]) => [cat, h('ul', { class: cat === 'character' ? 'char-grid' : 'shop-list' })]));

  /** @param {string} id @param {string} label */
  const buyButton = (id, label) => button(label, () => {
    const r = lab.shop.buy(id);
    if (!r.ok) return ctx.toast('warning', r.reason);
    const reward = r.reward;
    if (reward) {
      const what = reward.kind === 'COINS' ? `${fmtInt(reward.amount)} pièces` : reward.kind === 'KEYS' ? `${reward.amount} clé(s)` : '1 hoverboard';
      ctx.toast('success', `Boîte mystère : ${what} !`);
    } else ctx.toast('success', `Acheté : ${lab.shop.item(id).label}.`);
  }, err);

  for (const it of lab.shop.snapshot().catalog) {
    const cost = h('span', { class: 'cost' });
    if (it.category === 'character') {
      const c = characterById(it.id.slice(5));
      const btn = buyButton(it.id, 'Débloquer');
      const equip = button('Équiper', () => lab.shop.equip(c.id), err);
      const card = h('li', { class: 'char-card' }, avatar(c), h('strong', {}, c.name), cost, btn, equip);
      rows.set(it.id, { btn, cost, equip, card });
      lists.character.append(card);
      continue;
    }
    const btn = buyButton(it.id, 'Acheter');
    const level = it.category === 'upgrade' ? h('span', { class: 'level' }) : undefined;
    const card = h('li', {}, h('span', { class: 'item-label' }, h('strong', {}, it.label), h('small', {}, it.detail)), level ?? h('span'), cost, btn);
    rows.set(it.id, { btn, cost, level, card });
    lists[it.category].append(card);
  }
  // Le personnage de départ est toujours possédé.
  const def = CHARACTERS[0];
  const defEquip = button('Équiper', () => lab.shop.equip(def.id), err);
  const defCard = h('li', { class: 'char-card' }, avatar(def), h('strong', {}, def.name), h('span', { class: 'cost' }, 'offert'), defEquip);
  lists.character.prepend(defCard);

  const el = h('section', { class: 'panel-section' },
    h('h3', {}, 'Boutique'),
    wallet,
    inventory,
    ...SECTIONS.flatMap(([cat, title]) => [h('h4', {}, title), lists[cat]]),
    h('h4', {}, 'Outils de test'),
    h('div', { class: 'btn-row' },
      button('Test : 1 000 achats', () => {
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
        if (await ctx.confirm('Réinitialiser personnages, améliorations et inventaire ?')) lab.shop.resetProfile();
      }, err, { class: 'danger' }),
    ),
    h('p', { class: 'hint' }, 'Personnages et décors originaux du prototype. Hoverboard : double appui sur l\'écran ou touche H pendant une run.'),
  );

  /** @param {ReturnType<import('../../app/LabController.js').LabController['snapshot']>} s */
  function update(s) {
    const snap = lab.shop.snapshot();
    const p = snap.profile;
    setText(wallet, `${fmtInt(s.resources.coins.balance)} pièces · ${fmtInt(s.resources.keys.balance)} clés`);
    setText(inventory, `Hoverboards : ${p.hoverboards} · Aimants de départ : ${p.startMagnets} · Multiplicateur : ×${p.scoreMultiplier}`);
    for (const it of snap.catalog) {
      const row = rows.get(it.id);
      if (!row) continue;
      if (it.category === 'character') {
        const id = it.id.slice(5);
        const owned = p.characters.includes(id);
        setText(row.cost, owned ? (p.equippedCharacter === id ? 'équipé' : 'débloqué') : costText(it.cost));
        row.btn.hidden = owned;
        if (row.equip) {
          row.equip.hidden = !owned;
          setDisabled(row.equip, p.equippedCharacter === id);
        }
        setClass(row.card, 'equipped', p.equippedCharacter === id);
        setDisabled(row.btn, !it.affordable);
        continue;
      }
      setText(row.cost, it.cost ? costText(it.cost) : 'max');
      setDisabled(row.btn, !it.affordable);
      if (row.level) {
        const lvl = p.upgrades[/** @type {'MAGNET'} */ (it.id.slice(8))];
        setText(row.level, `${'■'.repeat(lvl)}${'□'.repeat(MAX_UPGRADE_LEVEL - lvl)}`);
      }
    }
    setDisabled(defEquip, p.equippedCharacter === def.id);
    setClass(defCard, 'equipped', p.equippedCharacter === def.id);
  }

  return { id: 'boutique', title: 'Boutique', el, update };
}
