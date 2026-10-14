/**
 * Entrées clavier et tactiles → actions logiques. Les touches sont
 * remappables ; les lettres sont reconnues par leur caractère (event.key) ET
 * leur position (event.code), ce qui rend « A » fonctionnel en AZERTY comme en QWERTY.
 */

export const BINDABLE = /** @type {const} */ (['LANE_LEFT', 'LANE_RIGHT', 'JUMP', 'SLIDE', 'PAUSE', 'RESTART']);
export const BINDING_LABELS = Object.freeze({
  LANE_LEFT: 'Voie gauche', LANE_RIGHT: 'Voie droite', JUMP: 'Saut', SLIDE: 'Glissade', PAUSE: 'Pause', RESTART: 'Recommencer',
});
export const SETTINGS_VERSION = 1;
const MAX_BINDINGS = 3;
const CODE_PATTERN = /^[A-Za-z0-9]{1,24}$/;

/** @typedef {Record<typeof BINDABLE[number], string[]>} KeyMap */

/** @returns {KeyMap} */
export function defaultKeyMap() {
  return {
    LANE_LEFT: ['ArrowLeft', 'KeyA'],
    LANE_RIGHT: ['ArrowRight', 'KeyD'],
    JUMP: ['ArrowUp', 'Space', 'KeyW'],
    SLIDE: ['ArrowDown', 'KeyS'],
    PAUSE: ['Escape', 'KeyP'],
    RESTART: ['KeyR'],
  };
}

/** @returns {{ version: number, keymap: KeyMap, swipeThreshold: number, touchButtons: boolean }} */
export function defaultSettings() {
  return { version: SETTINGS_VERSION, keymap: defaultKeyMap(), swipeThreshold: 28, touchButtons: false };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof defaultSettings>}
 */
export function parseSettings(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('objet attendu');
  const r = /** @type {Record<string, any>} */ (raw);
  if (r.version !== SETTINGS_VERSION) throw new Error(`version ${String(r.version)} non prise en charge`);
  const out = defaultSettings();
  for (const action of BINDABLE) {
    const list = r.keymap?.[action];
    if (!Array.isArray(list) || list.length > MAX_BINDINGS || !list.every((c) => typeof c === 'string' && CODE_PATTERN.test(c))) {
      throw new Error(`touches de ${action} invalides`);
    }
    out.keymap[action] = [...list];
  }
  if (!Number.isFinite(r.swipeThreshold) || r.swipeThreshold < 10 || r.swipeThreshold > 120) throw new Error('seuil de glissement invalide');
  out.swipeThreshold = r.swipeThreshold;
  out.touchButtons = r.touchButtons === true;
  return out;
}

/**
 * @param {KeyboardEvent} e
 * @returns {string[]} identifiants candidats pour la recherche dans la table
 */
export function keyCandidates(e) {
  const out = [e.code];
  if (typeof e.key === 'string' && /^[a-zA-Z]$/.test(e.key)) out.push(`Key${e.key.toUpperCase()}`);
  if (e.key === ' ') out.push('Space');
  return out;
}

/**
 * @param {KeyMap} keymap
 * @param {string[]} candidates
 * @returns {typeof BINDABLE[number] | null}
 */
export function resolveBinding(keymap, candidates) {
  for (const action of BINDABLE) {
    if (keymap[action].some((code) => candidates.includes(code))) return action;
  }
  return null;
}

/**
 * Direction d'un glissement, ou null s'il est trop court.
 * @param {number} dx
 * @param {number} dy
 * @param {number} threshold
 * @returns {'LANE_LEFT'|'LANE_RIGHT'|'JUMP'|'SLIDE'|null}
 */
export function swipeToAction(dx, dy, threshold) {
  if (Math.hypot(dx, dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'LANE_LEFT' : 'LANE_RIGHT';
  return dy < 0 ? 'JUMP' : 'SLIDE';
}

export class InputController {
  /**
   * @param {{ keyTarget: Window, touchTarget: HTMLElement,
   *   saveManager: import('../storage/SaveManager.js').SaveManager | null,
   *   onAction: (a: string) => void, onPause: () => void, onRestart: () => void }} options
   */
  constructor({ keyTarget, touchTarget, saveManager, onAction, onPause, onRestart }) {
    this.keyTarget = keyTarget;
    this.touchTarget = touchTarget;
    this.saveManager = saveManager;
    this.onAction = onAction;
    this.onPause = onPause;
    this.onRestart = onRestart;
    this.settings = defaultSettings();
    /** @type {string | null} */
    this.loadWarning = null;
    /** @type {((code: string) => void) | null} */
    this.captureNext = null;
    /** @type {{ id: number, x: number, y: number, fired: boolean } | null} */
    this.gesture = null;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  load() {
    if (!this.saveManager) return;
    const res = this.saveManager.read('settings', parseSettings);
    this.loadWarning = res.error;
    if (res.value) this.settings = res.value;
  }

  save() {
    this.saveManager?.writeAtomic('settings', this.settings, { validate: (v) => void parseSettings(v) });
  }

  attach() {
    this.keyTarget.addEventListener('keydown', this.onKeyDown);
    this.touchTarget.addEventListener('pointerdown', this.onPointerDown);
    this.touchTarget.addEventListener('pointermove', this.onPointerMove);
    this.touchTarget.addEventListener('pointerup', this.onPointerUp);
    this.touchTarget.addEventListener('pointercancel', this.onPointerUp);
  }

  detach() {
    this.keyTarget.removeEventListener('keydown', this.onKeyDown);
    this.touchTarget.removeEventListener('pointerdown', this.onPointerDown);
    this.touchTarget.removeEventListener('pointermove', this.onPointerMove);
    this.touchTarget.removeEventListener('pointerup', this.onPointerUp);
    this.touchTarget.removeEventListener('pointercancel', this.onPointerUp);
  }

  /**
   * Attend la prochaine touche pour l'associer à une action.
   * @param {typeof BINDABLE[number]} action
   * @returns {Promise<string | null>} code associé, ou null si annulé (Échap)
   */
  remap(action) {
    return new Promise((resolve) => {
      this.captureNext = (code) => {
        this.captureNext = null;
        if (code === 'Escape' && action !== 'PAUSE') return resolve(null);
        // Une touche ne peut servir qu'une action : on la retire des autres.
        for (const a of BINDABLE) this.settings.keymap[a] = this.settings.keymap[a].filter((c) => c !== code);
        this.settings.keymap[action] = [code, ...this.settings.keymap[action]].slice(0, MAX_BINDINGS);
        this.save();
        resolve(code);
      };
    });
  }

  resetBindings() {
    this.settings = defaultSettings();
    this.save();
  }

  /** @param {KeyboardEvent} e */
  onKeyDown(e) {
    if (this.captureNext) {
      e.preventDefault();
      if (CODE_PATTERN.test(e.code)) this.captureNext(e.code);
      return;
    }
    const tag = /** @type {HTMLElement | null} */ (e.target)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const action = resolveBinding(this.settings.keymap, keyCandidates(e));
    if (!action) return;
    e.preventDefault();
    if (action === 'PAUSE') this.onPause();
    else if (action === 'RESTART') this.onRestart();
    else this.onAction(action);
  }

  /** @param {PointerEvent} e */
  onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
  }

  /** @param {PointerEvent} e */
  onPointerMove(e) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId || g.fired) return;
    const action = swipeToAction(e.clientX - g.x, e.clientY - g.y, this.settings.swipeThreshold);
    if (!action) return;
    // Déclenche dès que le seuil est franchi (réactivité), un seul geste par contact.
    g.fired = true;
    this.onAction(action);
  }

  /** @param {PointerEvent} e */
  onPointerUp(e) {
    if (this.gesture && this.gesture.id === e.pointerId) this.gesture = null;
  }
}
