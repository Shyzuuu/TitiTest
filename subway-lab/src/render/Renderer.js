/**
 * Rendu pseudo-3D Canvas 2D (projection perspective manuelle), sans dépendance.
 * Purement visuel : lit l'état du monde, ne le modifie jamais. L'interpolation
 * entre deux pas (alpha) lisse l'affichage au ralenti extrême (0,10× ≈ 6 pas/s).
 */

import { characterById } from '../game/characters.js';
import { LANE_WIDTH, PLAYER_HEIGHT, PLAYER_SLIDE_HEIGHT, STUMBLE_TICKS, TRAIN_TOP, laneX } from '../game/constants.js';

const VIEW_DISTANCE = 150;
const CAMERA_BACK = 7.5;
const TRACK_HALF = LANE_WIDTH * 1.5 + 0.6;
const WALL_X = TRACK_HALF + 1.6;
const SEGMENT = 12;

const TRAIN_COLORS = ['#c0392b', '#2471a3', '#1e8449', '#b9770e', '#7d3c98'];
const COLLECTIBLE_STYLE = {
  KEY: { fill: '#4fc3f7', label: 'K' },
  MAGNET: { fill: '#e74c3c', label: 'M' },
  DOUBLE: { fill: '#9b59b6', label: '×2' },
  SNEAKERS: { fill: '#2ecc71', label: 'S' },
  JETPACK: { fill: '#e67e22', label: 'J' },
  BOX: { fill: '#8e5a2b', label: '?' },
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
 * Distance visuelle des poursuivants derrière le joueur, ou null s'ils sont hors champ.
 * @param {import('../game/GameWorld.js').GameWorld} world
 * @returns {number | null}
 */
function chaseDistance(world) {
  const p = world.player;
  if (p.crashed) return 1.6;
  if (world.powerups.JETPACK > 0 || p.y > 1.5) return null;
  // Restent entre le joueur et la caméra sans la toucher (caméra 7,5 à 9 m derrière).
  if (p.stumbleTicks > 0) return 2.2 + (1 - p.stumbleTicks / STUMBLE_TICKS) * 2;
  if (world.tick < 150) return 2 + world.tick / 75;
  return null;
}

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
    // La caméra suit la hauteur du joueur (toits, jetpack) avec un léger retard visuel.
    this.camY = (portrait ? 7 : 3.6) + py * 0.85;
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
      if (o.z > far) continue;
      if (o.z + o.len < this.camZ + 0.4) continue;
      // Rampe ou toit sous le joueur : dessiné avant lui (clé de tri = extrémité la plus lointaine).
      const under = o.z <= pz && o.z + o.len >= pz && Math.abs(px - laneX(o.lane)) < 1.4;
      push(under ? o.z + o.len + 0.01 : Math.max(o.z, this.camZ + 0.4), 0, o);
    }
    for (const c of world.collectibles) {
      if (c.z > far || c.z < this.camZ + 0.5) continue;
      push(c.z, 1, c);
    }
    push(pz, 2, null);
    if (chaseDistance(world) !== null) push(pz - (chaseDistance(world) ?? 0), 3, null);
    const list = this.sorted;
    list.length = n;
    for (let i = 0; i < n; i++) list[i] = pool[i];
    list.sort(byDepthDesc);
    this.drawCount = n;
    for (const it of list) {
      if (it.kind === 0) this.drawObstacle(it.ref);
      else if (it.kind === 1) this.drawCollectible(it.ref);
      else if (it.kind === 2) this.drawPlayer(world, px, py, pz);
      else this.drawChasers(world, px, pz - (chaseDistance(world) ?? 0));
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
    if (o.kind === 'RAMP') {
      // Rampe métallique : surface inclinée de 0 à la hauteur du toit, flancs triangulaires.
      const h0 = (TRAIN_TOP * (z0 - o.z)) / o.len;
      if (this.camX < x0) this.quad(x0, 0, z0, x0, h0, z0, x0, TRAIN_TOP, z1, x0, 0, z1, '#5d6670');
      else if (this.camX > x1) this.quad(x1, 0, z0, x1, h0, z0, x1, TRAIN_TOP, z1, x1, 0, z1, '#5d6670');
      this.quad(x0, h0, z0, x1, h0, z0, x1, TRAIN_TOP, z1, x0, TRAIN_TOP, z1, '#9aa3ad');
      for (let k = 1; k < 6; k++) {
        const zk = o.z + (o.len * k) / 6;
        if (zk <= z0) continue;
        const hk = (TRAIN_TOP * k) / 6;
        this.quad(x0, hk, zk, x1, hk, zk, x1, hk + 0.05, zk + 0.15, x0, hk + 0.05, zk + 0.15, '#6c757f');
      }
      return;
    }
    if (o.kind === 'TRAIN') {
      const color = TRAIN_COLORS[o.id % TRAIN_COLORS.length];
      this.box(x0, 0, z0, x1, TRAIN_TOP, z1, color, null);
      // Fenêtres le long du flanc visible
      const side = this.camX < x0 ? x0 - 0.01 : this.camX > x1 ? x1 + 0.01 : null;
      if (side !== null) {
        for (let wz = o.z + 1.5; wz < z1 - 1; wz += 3) {
          if (wz < z0) continue;
          this.quad(side, 1.9, wz, side, 2.8, wz, side, 2.8, wz + 1.8, side, 1.9, wz + 1.8, '#d6eaf8');
        }
        this.quad(side, 0.5, z0, side, 0.75, z0, side, 0.75, z1, side, 0.5, z1, shadeColor(color, -0.35));
      }
      if (z0 === o.z) {
        const zf = z0 - 0.01;
        this.quad(x0 + 0.25, 2.0, zf, x1 - 0.25, 2.0, zf, x1 - 0.25, 2.9, zf, x0 + 0.25, 2.9, zf, '#d6eaf8');
        this.quad(x0 + 0.3, 0.45, zf, x0 + 0.6, 0.45, zf, x0 + 0.6, 0.75, zf, x0 + 0.3, 0.75, zf, '#ffe9a8');
        this.quad(x1 - 0.6, 0.45, zf, x1 - 0.3, 0.45, zf, x1 - 0.3, 0.75, zf, x1 - 0.6, 0.75, zf, '#ffe9a8');
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
   * Personnage articulé (jambes animées par la distance parcourue, donc figées en pause).
   * @param {import('../game/GameWorld.js').GameWorld} world
   * @param {number} px
   * @param {number} py
   * @param {number} pz
   */
  drawPlayer(world, px, py, pz) {
    const p = world.player;
    const sliding = p.slideTicks > 0;
    const flying = world.powerups.JETPACK > 0;
    const h = sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
    const ch = characterById(world.config.skin);
    const c = ch.colors;
    const { ctx } = this;
    if (p.invulnerableTicks > 0 && Math.floor(this.time / 90) % 2 === 0) return;
    const ground = p.airborne ? 0 : py;
    const sh = this.project(px, ground, pz);
    if (sh && !flying) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(sh[0], sh[1], 0.5 * sh[2], 0.16 * sh[2], 0, 0, Math.PI * 2);
      ctx.fill();
    }
    let base = py;
    if (world.hoverboardTicks > 0) {
      // Planche flottante sous les pieds
      base = py + 0.25;
      const glow = Math.floor(this.time / 150) % 2 ? '#00e5ff' : '#00b8d4';
      this.box(px - 0.45, py + 0.1, pz - 0.75, px + 0.45, py + 0.22, pz + 0.75, '#ff4fa3', null);
      this.quad(px - 0.45, py + 0.09, pz - 0.75, px + 0.45, py + 0.09, pz - 0.75, px + 0.45, py + 0.09, pz + 0.75, px - 0.45, py + 0.09, pz + 0.75, glow);
    }
    const body = p.crashed ? '#7f8c8d' : c.body;
    const legH = sliding ? 0.25 : h * 0.42;
    const phase = Math.sin(pz * 1.7);
    const stride = p.airborne || sliding || p.crashed ? 0 : 0.28 * phase;
    // Jambes (alternées en z)
    this.box(px - 0.3, base, pz - 0.12 + stride, px - 0.04, base + legH, pz + 0.12 + stride, c.legs, null);
    this.box(px + 0.04, base, pz - 0.12 - stride, px + 0.3, base + legH, pz + 0.12 - stride, c.legs, null);
    const torso0 = base + legH;
    const torso1 = base + h * 0.78;
    if (flying) this.box(px - 0.28, torso0 + 0.05, pz - 0.55, px + 0.28, torso1, pz - 0.3, '#7f8c8d', null);
    this.box(px - 0.36, torso0, pz - 0.25, px + 0.36, torso1, pz + 0.25, body, null);
    // Bras
    this.box(px - 0.5, torso0 + 0.1, pz - 0.1 - stride, px - 0.36, torso1 - 0.05, pz + 0.1 - stride, body, null);
    this.box(px + 0.36, torso0 + 0.1, pz - 0.1 + stride, px + 0.5, torso1 - 0.05, pz + 0.1 + stride, body, null);
    const head = this.project(px, base + h * 0.9, pz);
    if (head) {
      const r = 0.24 * head[2];
      ctx.fillStyle = c.head;
      ctx.beginPath();
      ctx.arc(head[0], head[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.hair;
      ctx.beginPath();
      ctx.arc(head[0], head[1], r, Math.PI, Math.PI * 2);
      ctx.fill();
      this.drawAccessory(ch.accessory, head[0], head[1], r, c.accent);
    }
    if (flying) {
      const fl = this.project(px, torso0 - 0.2, pz - 0.45);
      if (fl) {
        ctx.fillStyle = Math.floor(this.time / 80) % 2 ? '#ffb347' : '#ff6b1a';
        ctx.beginPath();
        ctx.moveTo(fl[0] - 0.12 * fl[2], fl[1]);
        ctx.lineTo(fl[0] + 0.12 * fl[2], fl[1]);
        ctx.lineTo(fl[0], fl[1] + 0.6 * fl[2]);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (world.powerups.MAGNET > 0 && head) {
      ctx.strokeStyle = 'rgba(231,76,60,0.6)';
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      ctx.arc(head[0], head[1] + 0.5 * head[2], 1.1 * head[2], 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /**
   * @param {string} kind
   * @param {number} x
   * @param {number} y
   * @param {number} r
   * @param {string} color
   */
  drawAccessory(kind, x, y, r, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, r * 0.2);
    switch (kind) {
      case 'cap':
        ctx.fillRect(x - r * 1.05, y - r * 0.95, r * 2.1, r * 0.5);
        ctx.fillRect(x - r * 0.2, y - r * 0.6, r * 1.6, r * 0.22);
        break;
      case 'band':
        ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.25);
        break;
      case 'crest':
        ctx.fillRect(x - r * 0.18, y - r * 1.7, r * 0.36, r * 1.1);
        break;
      case 'hood':
        ctx.beginPath();
        ctx.arc(x, y, r * 1.2, Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();
        break;
      case 'antenna':
        ctx.fillRect(x - r * 0.06, y - r * 1.8, r * 0.12, r * 0.9);
        ctx.beginPath();
        ctx.arc(x, y - r * 1.85, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'crown':
        ctx.beginPath();
        ctx.moveTo(x - r * 0.8, y - r * 0.8);
        ctx.lineTo(x - r * 0.8, y - r * 1.5);
        ctx.lineTo(x - r * 0.4, y - r * 1.1);
        ctx.lineTo(x, y - r * 1.6);
        ctx.lineTo(x + r * 0.4, y - r * 1.1);
        ctx.lineTo(x + r * 0.8, y - r * 1.5);
        ctx.lineTo(x + r * 0.8, y - r * 0.8);
        ctx.closePath();
        ctx.fill();
        break;
      default:
    }
  }

  /**
   * Contrôleur et son chien : apparaissent au départ, après un trébuchement et à la capture.
   * Purement visuel (dérivé de l'état), sans effet sur la simulation.
   * @param {import('../game/GameWorld.js').GameWorld} world
   * @param {number} px
   * @param {number} z
   */
  drawChasers(world, px, z) {
    const x = px * 0.9;
    // Chien (à gauche du contrôleur)
    const dx = x - 0.7;
    const hop = Math.abs(Math.sin(z * 2.2)) * 0.12;
    this.box(dx - 0.18, 0.25 + hop, z - 0.35, dx + 0.18, 0.6 + hop, z + 0.35, '#a0522d', null);
    this.box(dx - 0.15, 0.45 + hop, z + 0.3, dx + 0.15, 0.75 + hop, z + 0.6, '#8b4513', null);
    this.box(dx - 0.14, 0, z - 0.3, dx + 0.14, 0.27 + hop, z + 0.3, '#5c3317', null);
    // Contrôleur
    const stride = 0.22 * Math.sin(z * 1.7);
    this.box(x - 0.28, 0, z - 0.1 + stride, x - 0.04, 0.85, z + 0.12 + stride, '#1c2833', null);
    this.box(x + 0.04, 0, z - 0.1 - stride, x + 0.28, 0.85, z + 0.12 - stride, '#1c2833', null);
    this.box(x - 0.42, 0.85, z - 0.28, x + 0.42, 1.65, z + 0.28, '#1f3a93', null);
    const head = this.project(x, 1.85, z);
    if (head) {
      const { ctx } = this;
      const r = 0.25 * head[2];
      ctx.fillStyle = '#e0ac69';
      ctx.beginPath();
      ctx.arc(head[0], head[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f3a93';
      ctx.fillRect(head[0] - r * 1.15, head[1] - r * 1.05, r * 2.3, r * 0.6);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(head[0] - r * 0.25, head[1] - r * 0.95, r * 0.5, r * 0.35);
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
