/**
 * Traduit une action logique (issue du clavier, du tactile ou d'un rejeu)
 * en requêtes vers les systèmes de mouvement. Aucune notion de périphérique ici.
 */

import { requestJump } from './systems/JumpSystem.js';
import { requestLaneChange } from './systems/LaneMovementSystem.js';
import { requestSlide } from './systems/SlideSystem.js';

/**
 * @param {import('./GameWorld.js').GameWorld} world
 * @param {string} action
 * @returns {boolean} vrai si l'action a eu un effet
 */
export function applyPlayerAction(world, action) {
  const p = world.player;
  if (action === 'REVIVE') return world.revive();
  if (p.crashed) return false;
  switch (action) {
    case 'LANE_LEFT':
      return requestLaneChange(p, -1);
    case 'LANE_RIGHT':
      return requestLaneChange(p, 1);
    case 'JUMP':
      return requestJump(p, world.powerups.SNEAKERS > 0);
    case 'SLIDE':
      return requestSlide(p);
    default:
      throw new RangeError(`Action inconnue : ${action}`);
  }
}
