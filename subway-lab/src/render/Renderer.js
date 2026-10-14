/**
 * Rendu pseudo-3D Canvas 2D (projection perspective manuelle), sans dépendance.
 * Purement visuel : lit l'état du monde, ne le modifie jamais. L'interpolation
 * entre deux pas (alpha) lisse l'affichage au ralenti extrême (0,10× ≈ 6 pas/s).
 */

import { LANE_WIDTH, PLAYER_HEIGHT, PLAYER_SLIDE_HEIGHT, laneX } from '../game/constants.js';

const VIEW_DISTANCE = 150;
const CAMERA_BACK = 7.5;
const TRACK_HALF = LANE_WIDTH * 1.5 + 0.6;
const WALL_X = TRACK_HALF + 1.6;
const SEGMENT = 12;

const TRAIN_COLORS = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98'];
const SKIN_COLORS = {
  DEFAULT: { body: '#ff8a3d', head: '#ffd2a6', cap: '#2e86de' },
  NEON: { body: '#39ff9f', head: '#ffd2a6', cap: '#ff2fd0' },
  GOLD: { body: '#f4c542', head: '#ffe0b3', cap: '#8a6d00' },
};
const COLLECTIBLE_STYLE = {
  KEY: { fill: '#4fc3f7', label: 'K' },
  MAGNET: { fill: '#e74c3c', label: 'M' },
  DOUBLE: { fill: '#9b59b6', label: '×2' },
  SNEAKERS: { fill: '#2ecc71', label: 'S' },
};

/**
 * @param {number} n
 * @returns {number} pseudo-aléatoire stable [0,1) pour le décor
 */
function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * @param {{ z: number }} a
 * @param {{ z: number }} b
 */
const byDepthDesc = (a, b) => b.z - a.z;

export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible sur cet appareil.');
    this.ctx = ctx;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.camX = 0;
    this.camY = 3.6;
    this.camZ = 0;
    this.focal = 1;
    this.horizon = 0;
    /** @type {{ z: number, kind: number, ref: any }[]} pool réutilisé chaque image */
    this.drawList = [];
    /** @type {{ z: number, kind: number, ref: any }[]} vue triée, réutilisée (aucune allocation par image) */
    this.sorted = [];
    this.drawCount = 0;
    this.time = 0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // DPR plafonné à 2 : au-delà, le coût de remplissage explose sur mobile sans gain visible.
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {[number, number, number] | null} [sx, sy, échelle]
   */
  project(x, y, z) {
    const dz = z - this.camZ;
    if (dz < 0.35) return null;
    const s = this.focal / dz;
    return [this.width / 2 + (x - this.camX) * s, this.horizon + (this.camY - y) * s, s];
  }

  /**
   * @param {import('../game/GameWorld.js').GameWorld | null} world
   * @param {number} alpha
   * @param {number} timeMs temps d'affichage (animations purement visuelles)
   */
  render(world, alpha, timeMs) {
    this.resize();
    this.time = timeMs;
    const { ctx, width: W, height: H } = this;
    const portrait = H > W;
    const p = world?.player;
    const px = p ? lerp(world.prevX, p.x, alpha) : 0;
    const pz = p ? lerp(world.prevZ, p.z, alpha) : 0;
    const py = p ? lerp(world.prevY, p.y, alpha) : 0;

    // Portrait : caméra plus haute et focale plus longue, sinon l'horizon tombe très bas et la piste est minuscule.
    this.focal = portrait ? W * 1.1 : Math.min(H * 0.95, W * 0.7);
    this.camY = portrait ? 7 : 3.6;
    const back = portrait ? CAMERA_BACK + 1.5 : CAMERA_BACK;
    this.camZ = pz - back;
    this.camX = px * 0.55;
    this.horizon = H * 0.83 - (this.camY * this.focal) / back;

    this.drawSky();
    this.drawTrack();
    this.drawWalls();
    if (!world || !p) return;

    let n = 0;
    const far = pz + VIEW_DISTANCE;
    const pool = this.drawList;
    /** @param {number} z @param {number} kind @param {any} ref */
    const push = (z, kind, ref) => {
      if (n === pool.length) pool.push({ z: 0, kind: 0, ref: null });
      const it = pool[n++];
      it.z = z;
      it.kind = kind;
      it.ref = ref;
    };
    for (const o of world.obstacles) {
      if (o.z > far) break;
      if (o.z + o.len < this.camZ + 0.4) continue;
      push(Math.max(o.z, this.camZ + 0.4), 0, o);
    }
    for (const c of world.collectibles) {
      if (c.z > far || c.z < this.camZ + 0.5) continue;
      push(c.z, 1, c);
    }
    push(pz, 2, null);
    const list = this.sorted;
    list.length = n;
    for (let i = 0; i < n; i++) list[i] = pool[i];
    list.sort(byDepthDesc);
    this.drawCount = n;
    for (const it of list) {
      if (it.kind === 0) this.drawObstacle(it.ref);
      else if (it.kind === 1) this.drawCollectible(it.ref);
      else this.drawPlayer(world, px, py, pz);
    }
    this.drawFog();
  }

  drawSky() {
    const { ctx, width: W, height: H, horizon } = this;
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    g.addColorStop(0, '#5aa9e6');
    g.addColorStop(1, '#cfe8f7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.max(0, horizon) + 1);
    ctx.fillStyle = '#6b6158';
    ctx.fillRect(0, Math.max(0, horizon), W, H - Math.max(0, horizon));
  }

  drawTrack() {
    const { ctx } = this;
    const near = this.camZ + 0.5;
    const far = this.camZ + VIEW_DISTANCE;
    // Ballast
    this.quad(-TRACK_HALF, 0, near, TRACK_HALF, 0, near, TRACK_HALF, 0, far, -TRACK_HALF, 0, far, '#8d8172');
    // Traverses (une toutes les 2 m, alignées sur le monde pour donner la sensation de vitesse)
    ctx.fillStyle = '#5b4636';
    const start = Math.ceil(near / 2) * 2;
    for (let z = start; z < Math.min(far, near + 70); z += 2) {
      for (let l = 0; l < 3; l++) {
        const cx = laneX(l);
        const a = this.project(cx - 0.95, 0, z);
        const b = this.project(cx + 0.95, 0, z + 0.35);
        if (!a || !b) continue;
        ctx.fillRect(a[0], b[1], b[0] - a[0], Math.max(1, a[1] - b[1]));
      }
    }
    // Rails
    ctx.strokeStyle = '#c9ced6';
    ctx.lineWidth = Math.max(1, this.dpr * 1.5);
    ctx.beginPath();
    for (let l = 0; l < 3; l++) {
      for (const off of [-0.6, 0.6]) {
        const a = this.project(laneX(l) + off, 0.05, near);
        const b = this.project(laneX(l) + off, 0.05, far);
        if (!a || !b) continue;
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
    }
    ctx.stroke();
  }

  drawWalls() {
    const first = Math.floor((this.camZ + 0.5) / SEGMENT);
    const last = Math.floor((this.camZ + VIEW_DISTANCE) / SEGMENT);
    // Du plus lointain au plus proche pour un recouvrement correct.
    for (let i = last; i >= first; i--) {
      for (const side of [-1, 1]) {
        const r = hash01(i * 2 + (side > 0 ? 1 : 0));
        const h = 4 + r * 9;
        const z0 = Math.max(i * SEGMENT, this.camZ + 0.5);
        const z1 = (i + 1) * SEGMENT;
        if (z1 <= z0) continue;
        const x = side * WALL_X;
        const shade = 120 + Math.floor(r * 70);
        const color = `rgb(${shade - 30},${shade - 40},${shade - 20})`;
        this.quad(x, 0, z0, x, h, z0, x, h, z1, x, 0, z1, color);
        // Fenêtres
        if (r > 0.35) {
          const wz = z0 + (z1 - z0) * 0.3;
          this.quad(x, h * 0.55, wz, x, h * 0.8, wz, x, h * 0.8, wz + 2.5, x, h * 0.55, wz + 2.5, '#f7dc6f');
        }
      }
    }
  }

  /** @param {import('../game/GameWorld.js').Obstacle} o */
  drawObstacle(o) {
    const x0 = laneX(o.lane) - 1.0;
    const x1 = laneX(o.lane) + 1.0;
    const z0 = Math.max(o.z, this.camZ + 0.4);
    const z1 = o.z + o.len;
    if (o.kind === 'TRAIN') {
      const color = TRAIN_COLORS[o.id % TRAIN_COLORS.length];
      this.box(x0, 0, z0, x1, 3.4, z1, color, '#2c3e50');
      // Bande de fenêtres sur la face avant
      if (z0 === o.z) {
        this.quad(x0 + 0.25, 2.0, z0 - 0.01, x1 - 0.25, 2.0, z0 - 0.01, x1 - 0.25, 2.9, z0 - 0.01, x0 + 0.25, 2.9, z0 - 0.01, '#d6eaf8');
      }
    } else if (o.kind === 'LOW') {
      this.box(x0, 0, z0, x1, 1.0, z1, '#e74c3c', '#fdfefe');
    } else {
      // Barrière haute : panneau suspendu sur deux poteaux
      this.box(x0, 0, z0, x0 + 0.15, 2.8, z1, '#7f8c8d', null);
      this.box(x1 - 0.15, 0, z0, x1, 2.8, z1, '#7f8c8d', null);
      this.box(x0, 1.15, z0, x1, 2.8, z1, '#f1c40f', '#2c3e50');
    }
  }

  /** @param {import('../game/GameWorld.js').Collectible} c */
  drawCollectible(c) {
    const pr = this.project(laneX(c.lane), c.y, c.z);
    if (!pr) return;
    const { ctx } = this;
    const r = Math.max(1.5, 0.38 * pr[2]);
    if (c.kind === 'COIN') {
      const spin = Math.abs(Math.cos(this.time / 180 + c.id));
      ctx.fillStyle = '#f5b700';
      ctx.beginPath();
      ctx.ellipse(pr[0], pr[1], Math.max(1, r * (0.25 + 0.75 * spin)), r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9a6b00';
      ctx.lineWidth = Math.max(1, r * 0.15);
      ctx.stroke();
      return;
    }
    const style = COLLECTIBLE_STYLE[/** @type {'KEY'} */ (c.kind)];
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.arc(pr[0], pr[1], r * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(r * 1.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, pr[0], pr[1]);
  }

  /**
   * @param {import('../game/GameWorld.js').GameWorld} world
   * @param {number} px
   * @param {number} py
   * @param {number} pz
   */
  drawPlayer(world, px, py, pz) {
    const p = world.player;
    const sliding = p.slideTicks > 0;
    const h = sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
    const skin = SKIN_COLORS[/** @type {'DEFAULT'} */ (world.config.skin)] ?? SKIN_COLORS.DEFAULT;
    const { ctx } = this;
    // Ombre au sol
    const sh = this.project(px, 0, pz);
    if (sh) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(sh[0], sh[1], 0.5 * sh[2], 0.16 * sh[2], 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const body = p.crashed ? '#7f8c8d' : skin.body;
    const torsoTop = py + h * 0.72;
    this.box(px - 0.35, py, pz - 0.3, px + 0.35, torsoTop, pz + 0.3, body, null);
    const head = this.project(px, py + h * 0.86, pz);
    if (head) {
      ctx.fillStyle = skin.head;
      ctx.beginPath();
      ctx.arc(head[0], head[1], 0.24 * head[2], 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.cap;
      ctx.fillRect(head[0] - 0.26 * head[2], head[1] - 0.26 * head[2], 0.52 * head[2], 0.12 * head[2]);
    }
    if (world.powerups.MAGNET > 0 && head) {
      ctx.strokeStyle = 'rgba(231,76,60,0.6)';
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.arc(head[0], head[1] + 0.5 * head[2], 1.1 * head[2], 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.stumbleTicks > 0 && Math.floor(this.time / 120) % 2 === 0 && head) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(head[0] - 0.5 * head[2], head[1] - 0.3 * head[2], head[2], 1.6 * head[2]);
    }
  }

  drawFog() {
    const { ctx, width: W, horizon } = this;
    const g = ctx.createLinearGradient(0, horizon - 2, 0, horizon + this.height * 0.12);
    g.addColorStop(0, 'rgba(207,232,247,0.85)');
    g.addColorStop(1, 'rgba(207,232,247,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon - 2, W, this.height * 0.12 + 2);
  }

  /**
   * Boîte alignée : face avant, dessus et face latérale visible.
   * @param {number} x0 @param {number} y0 @param {number} z0
   * @param {number} x1 @param {number} y1 @param {number} z1
   * @param {string} color
   * @param {string | null} stripe
   */
  box(x0, y0, z0, x1, y1, z1, color, stripe) {
    // Face latérale tournée vers la caméra
    if (this.camX < x0) this.quad(x0, y0, z0, x0, y1, z0, x0, y1, z1, x0, y0, z1, shadeColor(color, -0.25));
    else if (this.camX > x1) this.quad(x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1, shadeColor(color, -0.25));
    if (this.camY > y1) this.quad(x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1, shadeColor(color, 0.15));
    this.quad(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, color);
    if (stripe) {
      const ym = y0 + (y1 - y0) * 0.45;
      const yh = y0 + (y1 - y0) * 0.6;
      this.quad(x0, ym, z0 - 0.01, x1, ym, z0 - 0.01, x1, yh, z0 - 0.01, x0, yh, z0 - 0.01, stripe);
    }
  }

  /**
   * Quadrilatère 3D projeté ; ignoré si un sommet est derrière la caméra
   * (les appelants bornent déjà z au plan proche).
   * @param {number} ax @param {number} ay @param {number} az
   * @param {number} bx @param {number} by @param {number} bz
   * @param {number} cx @param {number} cy @param {number} cz
   * @param {number} dx @param {number} dy @param {number} dz
   * @param {string} color
   */
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color) {
    const a = this.project(ax, ay, az);
    const b = this.project(bx, by, bz);
    const c = this.project(cx, cy, cz);
    const d = this.project(dx, dy, dz);
    if (!a || !b || !c || !d) return;
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  }
}

/** @type {Map<string, string>} */
const shadeCache = new Map();

/**
 * @param {string} hex #rrggbb
 * @param {number} amount -1..1
 */
function shadeColor(hex, amount) {
  const key = hex + amount;
  const cached = shadeCache.get(key);
  if (cached) return cached;
  const n = parseInt(hex.slice(1), 16);
  const f = (/** @type {number} */ c) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const out = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  shadeCache.set(key, out);
  return out;
}
