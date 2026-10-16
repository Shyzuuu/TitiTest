/**
 * Glissade ; en l'air, elle déclenche une chute rapide puis une glissade à l'atterrissage.
 */

import { FAST_FALL_VELOCITY, PLAYER_HEIGHT, PLAYER_SLIDE_HEIGHT, SLIDE_TICKS } from '../constants.js';

/**
 * @param {import('../GameWorld.js').PlayerState} player
 * @returns {boolean}
 */
export function requestSlide(player) {
  if (player.airborne) {
    player.vy = Math.min(player.vy, FAST_FALL_VELOCITY);
    player.slideQueued = true;
    return true;
  }
  player.slideTicks = SLIDE_TICKS;
  return true;
}

/** @param {import('../GameWorld.js').PlayerState} player */
export function updateSlide(player) {
  if (player.slideTicks > 0) player.slideTicks--;
}

/**
 * @param {import('../GameWorld.js').PlayerState} player
 * @returns {number}
 */
export function playerHeight(player) {
  return player.slideTicks > 0 ? PLAYER_SLIDE_HEIGHT : PLAYER_HEIGHT;
}
