/**
 * Bonus temporaires décomptés en pas de simulation (entiers, donc exacts).
 */

import { POWERUP_BASE_SECONDS, POWERUP_KINDS, POWERUP_SECONDS_PER_LEVEL, TICK_RATE } from '../constants.js';

/**
 * @param {number} level
 * @returns {number} durée en pas
 */
export function powerupDurationTicks(level) {
  return Math.round((POWERUP_BASE_SECONDS + POWERUP_SECONDS_PER_LEVEL * level) * TICK_RATE);
}

/**
 * @param {import('../GameWorld.js').GameWorld} world
 * @param {'MAGNET'|'DOUBLE'|'SNEAKERS'} kind
 */
export function activatePowerup(world, kind) {
  const dur = powerupDurationTicks(world.config.upgrades[kind]);
  world.powerups[kind] = dur;
  world.emit('POWERUP_START', { kind, dur });
}

/** @param {import('../GameWorld.js').GameWorld} world */
export function updatePowerups(world) {
  for (const kind of POWERUP_KINDS) {
    const left = world.powerups[kind];
    if (left <= 0) continue;
    world.powerups[kind] = left - 1;
    if (left === 1) world.emit('POWERUP_END', { kind });
  }
}
