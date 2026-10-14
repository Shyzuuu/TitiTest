/**
 * Changements de voie : la voie cible change instantanément, la position X
 * la rejoint à vitesse constante (déplacement déterministe, sans easing flottant).
 */

import { LANE_CHANGE_SPEED, LANE_COUNT, STEP, laneX } from '../constants.js';

/**
 * @param {import('../GameWorld.js').PlayerState} player
 * @param {-1 | 1} direction
 * @returns {boolean} vrai si la voie a effectivement changé
 */
export function requestLaneChange(player, direction) {
  const target = player.lane + direction;
  if (target < 0 || target >= LANE_COUNT) return false;
  player.prevLane = player.lane;
  player.lane = target;
  return true;
}

/** @param {import('../GameWorld.js').PlayerState} player */
export function updateLaneMovement(player) {
  const targetX = laneX(player.lane);
  const dx = targetX - player.x;
  const maxStep = LANE_CHANGE_SPEED * STEP;
  if (Math.abs(dx) <= maxStep) player.x = targetX;
  else player.x += dx > 0 ? maxStep : -maxStep;
}
