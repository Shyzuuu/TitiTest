/**
 * Ramassage des pièces, clés, bonus et boîtes mystère ; compaction en place
 * du tableau (aucune allocation par pas).
 */

import { COIN_VALUE, DESPAWN_BEHIND, MAGNET_RANGE_AHEAD, laneX } from '../constants.js';
import { playerHeight } from './SlideSystem.js';
import { activatePowerup } from './PowerupSystem.js';

/** @param {import('../GameWorld.js').GameWorld} world */
export function updateCollectibles(world) {
  const p = world.player;
  const list = world.collectibles;
  const magnet = world.powerups.MAGNET > 0;
  const flying = world.powerups.JETPACK > 0;
  const y0 = p.y;
  const y1 = p.y + playerHeight(p);
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const dz = c.z - p.z;
    let taken = false;
    if (!p.crashed && dz > -1 && dz < MAGNET_RANGE_AHEAD) {
      const sameLane = Math.abs(p.x - laneX(c.lane)) < 1.0;
      if (magnet && c.kind === 'COIN') taken = true;
      // En vol, les pièces de la voie survolée sont aspirées (pas de pièces en altitude).
      else if (flying && c.kind === 'COIN' && sameLane && Math.abs(dz) < 0.9) taken = true;
      else if (Math.abs(dz) < 0.9 && sameLane && c.y + 0.4 > y0 && c.y - 0.4 < y1) taken = true;
    }
    if (taken) {
      collect(world, c);
      continue;
    }
    if (dz < -DESPAWN_BEHIND) continue;
    list[w++] = c;
  }
  list.length = w;
}

/**
 * @param {import('../GameWorld.js').GameWorld} world
 * @param {import('../GameWorld.js').Collectible} c
 */
function collect(world, c) {
  switch (c.kind) {
    case 'COIN':
      world.coinsRun++;
      world.addScore(COIN_VALUE);
      world.emit('COIN', { id: c.id, n: world.coinsRun });
      break;
    case 'KEY':
      world.keysRun++;
      world.emit('KEY', { id: c.id, n: world.keysRun });
      break;
    case 'BOX': {
      // Tirage par le RNG du monde : identique au rejeu.
      if (world.rng.chance(0.15)) {
        world.keysRun++;
        world.emit('BOX', { id: c.id, reward: 'KEY', amount: 1 });
      } else {
        const amount = world.rng.int(5, 30) * 10;
        world.coinsRun += amount;
        world.emit('BOX', { id: c.id, reward: 'COINS', amount });
      }
      break;
    }
    default:
      activatePowerup(world, c.kind);
  }
}
