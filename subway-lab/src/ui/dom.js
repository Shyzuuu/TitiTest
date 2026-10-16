/**
 * Utilitaires DOM minimalistes. Les mises à jour comparent avant d'écrire :
 * l'interface est rafraîchie à 10 Hz sans provoquer de recalcul de mise en page inutile.
 */

/**
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {...(Node | string | null | undefined | false)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** @param {Element} el @param {string} text */
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

/** @param {HTMLButtonElement | HTMLInputElement | HTMLSelectElement} el @param {boolean} disabled */
export function setDisabled(el, disabled) {
  if (el.disabled !== disabled) el.disabled = disabled;
}

/** @param {Element} el @param {string} cls @param {boolean} on */
export function setClass(el, cls, on) {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}

/** @param {HTMLElement} el @param {boolean} visible */
export function setVisible(el, visible) {
  if (el.hidden === visible) el.hidden = !visible;
}

/** @param {number} seconds */
export function fmtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

/** @param {number} n */
export function fmtInt(n) {
  if (n === Infinity) return '∞';
  return Math.floor(n).toLocaleString('fr-FR');
}

/** @param {number} n @param {number} [digits] */
export function fmtNum(n, digits = 1) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** @param {string} iso */
export function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

/**
 * @param {string} filename
 * @param {string} text
 */
export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @param {File} file
 * @param {number} maxBytes
 * @returns {Promise<string>}
 */
export function readFileText(file, maxBytes) {
  if (file.size > maxBytes) return Promise.reject(new Error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo).`));
  return file.text();
}

/**
 * Bouton dont l'action est protégée : toute exception est convertie en notification.
 * @param {string} label
 * @param {() => unknown} action
 * @param {(e: unknown) => void} onError
 * @param {Record<string, any>} [attrs]
 */
export function button(label, action, onError, attrs = {}) {
  const el = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', ...attrs }, label));
  el.addEventListener('click', async () => {
    try {
      await action();
    } catch (e) {
      onError(e);
    }
  });
  return el;
}

/**
 * Ligne « libellé : valeur » ; renvoie l'élément valeur pour les mises à jour.
 * @param {HTMLElement} parent
 * @param {string} label
 * @returns {HTMLElement}
 */
export function statRow(parent, label) {
  const value = h('dd', {}, '—');
  parent.append(h('dt', {}, label), value);
  return value;
}
