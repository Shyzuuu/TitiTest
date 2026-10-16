/**
 * Bonus temporaires et hoverboard, décomptés en pas de simulation (entiers, donc exacts).
 */

import { HOVERBOARD_TICKS, POWERUP_BASE_SECONDS, POWERUP_KINDS, POWERUP_SECONDS_PER_LEVEL, TICK_RATE } from '../constants.js';

/**
 * @param {number} level
 * @returns {number} durée en pas
 */
export function powerupDurationTicks(level) {
  return Math.round((POWERUP_BASE_SECONDS + POWERUP_SECONDS_PER_LEVEL * level) * TICK_RATE);
}

/**
 * @param {import('../GameWorld.js').GameWorld} world
 * @param {'MAGNET'|'DOUBLE'|'SNEAKERS'|'JETPACK'} kind
 */
export function activatePowerup(world, kind) {
  const level = world.config.upgrades[kind];
  // Le jetpack dure moins longtemps : il rend invulnérable.
  const dur = kind === 'JETPACK' ? Math.round(powerupDurationTicks(level) * 0.6) : powerupDurationTicks(level);
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
  if (world.hoverboardTicks > 0) {
    world.hoverboardTicks--;
    if (world.hoverboardTicks === 0) world.emit('HOVERBOARD_END', { reason: 'expired' });
  }
  if (world.player.invulnerableTicks > 0) world.player.invulnerableTicks--;
}

/**
 * Active une planche de l'inventaire figé de la run.
 * @param {import('../GameWorld.js').GameWorld} world
 * @returns {boolean}
 */
export function activateHoverboard(world) {
  if (world.player.crashed || world.hoverboardTicks > 0 || world.hoverboardsLeft <= 0) return false;
  world.hoverboardsLeft--;
  world.hoverboardsUsed++;
  world.hoverboardTicks = HOVERBOARD_TICKS;
  world.emit('HOVERBOARD_START', { dur: HOVERBOARD_TICKS, left: world.hoverboardsLeft });
  return true;
}
