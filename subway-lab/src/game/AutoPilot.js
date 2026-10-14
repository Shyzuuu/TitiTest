/**
 * Pilote automatique simple : sert aux tests de longue durée et à la démo.
 * Il ne lit que l'état public du monde et produit des actions logiques,
 * exactement comme un joueur ; ses actions sont donc enregistrées et rejouées normalement.
 */

import { LANE_COUNT, OBSTACLE_SHAPES, PLAYER_HALF_DEPTH, STEP_UP, laneX } from './constants.js';

/**
 * @param {import('./GameWorld.js').GameWorld} world
 * @param {number} lane
 * @param {number} from
 * @param {number} to
 * @returns {import('./GameWorld.js').Obstacle | null}
 */
function firstObstacle(world, lane, from, to) {
  const y = world.player.y;
  for (const o of world.obstacles) {
    if (o.lane !== lane || o.kind === 'RAMP') continue;
    if (o.z + o.len < from) continue;
    // Un obstacle sous le joueur (toit, vol) ne le menace pas.
    const top = o.kind === 'TRAIN' ? OBSTACLE_SHAPES.TRAIN.top - STEP_UP : OBSTACLE_SHAPES[o.kind].top;
    if (y >= top) continue;
    if (o.z > to) return null;
    // Un train précédé d'une rampe dans la même voie est franchissable.
    if (o.kind === 'TRAIN' && world.obstacles.some((r) => r.kind === 'RAMP' && r.lane === lane && Math.abs(r.z + r.len - o.z) < 1e-6 && r.z + r.len >= from)) continue;
    return o;
  }
  return null;
}

/**
 * @param {import('./GameWorld.js').GameWorld} world
 * @returns {string | null} action à injecter avant le prochain pas
 */
export function decideAction(world) {
  const p = world.player;
  if (p.crashed || world.powerups.JETPACK > 0) return null;
  const front = p.z + PLAYER_HALF_DEPTH;
  const look = world.speed * 1.3 + 8;
  const threat = firstObstacle(world, p.lane, p.z - 0.6, p.z + look);
  const centered = Math.abs(p.x - laneX(p.lane)) < 1e-9;

  /** @param {number} lane */
  const laneScore = (lane) => {
    // Une voie dont le flanc est occupé à hauteur du joueur est inaccessible (choc latéral).
    if (firstObstacle(world, lane, p.z - 1.2, p.z + world.speed * 0.25 + 1.5)) return -1;
    const o = firstObstacle(world, lane, p.z - 0.6, p.z + look * 1.6);
    if (!o) return 1e6;
    return o.kind === 'TRAIN' ? o.z - p.z : o.z - p.z + 40;
  };

  const mustAvoid = threat && (threat.kind === 'TRAIN' || p.airborne);
  if (threat && !mustAvoid) {
    const dz = threat.z - front;
    if (threat.kind === 'LOW' && dz < world.speed * 0.16 && dz > -0.2 && !p.airborne) return 'JUMP';
    if (threat.kind === 'HIGH' && dz < world.speed * 0.2 && p.slideTicks < 20 && !p.airborne) return 'SLIDE';
    if (threat.kind === 'HIGH' && p.airborne && p.y + 1.7 > OBSTACLE_SHAPES.HIGH.bottom && dz < world.speed * 0.3) return 'SLIDE';
    return null;
  }
  if (!threat || !centered) return null;

  let best = p.lane;
  let bestScore = threat.z - p.z;
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    if (lane === p.lane) continue;
    // Toutes les voies traversées doivent avoir un flanc dégagé ; une voie lointaine coûte un peu plus.
    let s = 0;
    const step = lane > p.lane ? 1 : -1;
    for (let k = p.lane + step; ; k += step) {
      const ks = laneScore(k);
      if (ks < 0) {
        s = -1;
        break;
      }
      if (k === lane) {
        s = ks - Math.abs(lane - p.lane) * 0.5;
        break;
      }
    }
    if (s > bestScore) {
      bestScore = s;
      best = lane;
    }
  }
  if (best < p.lane) return 'LANE_LEFT';
  if (best > p.lane) return 'LANE_RIGHT';
  return null;
}
