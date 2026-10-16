/**
 * Collisions AABB joueur/obstacle.
 * - Choc frontal (le joueur était déjà aligné en X au pas précédent) : fatal.
 * - Choc latéral (pendant un changement de voie) : trébuchement et retour dans
 *   la voie d'origine ; un second choc pendant le trébuchement est fatal.
 * - Hoverboard actif : le choc fatal détruit la planche à la place du joueur.
 * - Les rampes ne sont jamais des obstacles ; un train n'arrête pas un joueur
 *   qui arrive à hauteur de son toit.
 */

import {
  INVULNERABLE_TICKS, MAX_ROW_SPREAD, OBSTACLE_HALF_WIDTH, OBSTACLE_SHAPES, PLAYER_HALF_DEPTH, PLAYER_HALF_WIDTH,
  STEP_UP, STUMBLE_TICKS, laneX,
} from '../constants.js';
import { playerHeight } from './SlideSystem.js';

const X_REACH = PLAYER_HALF_WIDTH + OBSTACLE_HALF_WIDTH;

/**
 * @param {import('../GameWorld.js').GameWorld} world
 * @param {number} prevX position X avant le pas courant
 */
export function resolveCollisions(world, prevX) {
  const p = world.player;
  if (p.crashed || p.invulnerableTicks > 0) return;
  const h = playerHeight(p);
  const z0 = p.z - PLAYER_HALF_DEPTH;
  const z1 = p.z + PLAYER_HALF_DEPTH;
  const list = world.obstacles;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    // Obstacles insérés par rangée (z croissant à MAX_ROW_SPREAD près) : rien plus loin ne peut toucher.
    if (o.z > z1 + MAX_ROW_SPREAD) break;
    if (o.kind === 'RAMP' || o.z > z1 || o.z + o.len < z0) continue;
    const ox = laneX(o.lane);
    if (Math.abs(p.x - ox) >= X_REACH) continue;
    const shape = OBSTACLE_SHAPES[o.kind];
    const top = o.kind === 'TRAIN' ? shape.top - STEP_UP : shape.top;
    if (p.y >= top || p.y + h <= shape.bottom) continue;

    const frontal = Math.abs(prevX - ox) < X_REACH;
    if (world.hoverboardTicks > 0) {
      world.hoverboardTicks = 0;
      p.invulnerableTicks = INVULNERABLE_TICKS;
      world.emit('COLLISION', { id: o.id, kind: o.kind, fatal: false, side: !frontal });
      world.emit('HOVERBOARD_END', { reason: 'crash' });
      if (!frontal) {
        p.lane = p.prevLane;
        p.x = prevX;
      }
      return;
    }
    if (frontal || p.stumbleTicks > 0) {
      p.crashed = true;
      world.emit('COLLISION', { id: o.id, kind: o.kind, fatal: true, side: !frontal });
      return;
    }
    p.stumbleTicks = STUMBLE_TICKS;
    p.lane = p.prevLane;
    p.x = prevX;
    world.emit('STUMBLE', { id: o.id, kind: o.kind });
    world.emit('COLLISION', { id: o.id, kind: o.kind, fatal: false, side: true });
    return;
  }
}
