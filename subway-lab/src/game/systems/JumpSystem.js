/**
 * Saut balistique intégré en Euler semi-implicite sur pas fixe.
 */

import { GRAVITY, JUMP_VELOCITY, SLIDE_TICKS, SNEAKERS_JUMP_VELOCITY, STEP } from '../constants.js';

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

/** @param {import('../GameWorld.js').PlayerState} player */
export function updateJump(player) {
  if (!player.airborne) return;
  player.vy -= GRAVITY * STEP;
  player.y += player.vy * STEP;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.airborne = false;
    if (player.slideQueued) {
      player.slideQueued = false;
      player.slideTicks = SLIDE_TICKS;
    }
  }
}
