/**
 * Mouvement vertical : saut balistique (Euler semi-implicite sur pas fixe),
 * sol variable (rampes, toits de trains) et vol au jetpack.
 */

import {
  GRAVITY, JETPACK_CLIMB_SPEED, JETPACK_HEIGHT, JUMP_VELOCITY, MAX_ROW_SPREAD, OBSTACLE_HALF_WIDTH, SLIDE_TICKS,
  SNEAKERS_JUMP_VELOCITY, STEP, STEP_UP, TRAIN_TOP, laneX,
} from '../constants.js';

/**
 * Hauteur du sol sous le joueur. Un toit de train ne porte le joueur que s'il
 * est déjà à sa hauteur (arrivé par une rampe ou en descendant du jetpack).
 * @param {import('../GameWorld.js').GameWorld} world
 * @param {number} x
 * @param {number} z
 * @param {number} y
 * @returns {number}
 */
export function groundHeightAt(world, x, z, y) {
  let g = 0;
  const list = world.obstacles;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.z > z + MAX_ROW_SPREAD) break;
    if (o.z > z || o.z + o.len < z) continue;
    if (Math.abs(x - laneX(o.lane)) > OBSTACLE_HALF_WIDTH) continue;
    if (o.kind === 'RAMP') {
      const h = (TRAIN_TOP * (z - o.z)) / o.len;
      if (h <= y + STEP_UP && h > g) g = h;
    } else if (o.kind === 'TRAIN' && y >= TRAIN_TOP - STEP_UP && TRAIN_TOP > g) {
      g = TRAIN_TOP;
    }
  }
  return g;
}

/**
 * @param {import('../GameWorld.js').PlayerState} player
 * @param {boolean} sneakers
 * @returns {boolean}
 */
export function requestJump(player, sneakers) {
  if (player.airborne) return false;
  // Sauter annule la glissade en cours, comme dans le jeu de référence.
  player.slideTicks = 0;
  player.slideQueued = false;
  player.airborne = true;
  player.vy = sneakers ? SNEAKERS_JUMP_VELOCITY : JUMP_VELOCITY;
  return true;
}

/** @param {import('../GameWorld.js').GameWorld} world */
export function updateVertical(world) {
  const p = world.player;
  if (world.powerups.JETPACK > 0) {
    // Montée régulière vers l'altitude de vol, au-dessus de tous les obstacles.
    p.airborne = true;
    p.vy = 0;
    p.slideTicks = 0;
    p.slideQueued = false;
    p.y = Math.min(JETPACK_HEIGHT, p.y + JETPACK_CLIMB_SPEED * STEP);
    return;
  }
  const ground = groundHeightAt(world, p.x, p.z, p.y);
  if (!p.airborne) {
    if (ground >= p.y - 1e-9) {
      p.y = ground; // montée de rampe, ou course sur un toit
      return;
    }
    p.airborne = true; // fin du toit : chute libre
    p.vy = 0;
  }
  p.vy -= GRAVITY * STEP;
  p.y += p.vy * STEP;
  if (p.y <= ground) {
    p.y = ground;
    p.vy = 0;
    p.airborne = false;
    if (p.slideQueued) {
      p.slideQueued = false;
      p.slideTicks = SLIDE_TICKS;
    }
  }
}

