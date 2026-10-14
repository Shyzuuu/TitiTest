/**
 * Génération procédurale par rangées, pilotée uniquement par le RNG et la
 * coordonnée z. Invariant d'équité : chaque rangée possède une voie « sûre »
 * sans train, atteignable depuis la voie sûre précédente sans traverser de train.
 */

import { BARRIER_DEPTH, COIN_SPACING, FIRST_ROW_Z, LANE_COUNT, POWERUP_KINDS, SPAWN_AHEAD } from '../constants.js';
import { difficultyForDistance, speedForDistance } from './DifficultySystem.js';

const NO_TRAIN = -1e9;

/** @returns {import('../GameWorld.js').SpawnerState} */
export function createSpawnerState() {
  return { nextRowZ: FIRST_ROW_Z, trainEnd: [NO_TRAIN, NO_TRAIN, NO_TRAIN], safeLane: 1, rows: 0 };
}

/** @param {import('../GameWorld.js').GameWorld} world */
export function updateSpawner(world) {
  const sp = world.spawner;
  while (sp.nextRowZ < world.player.z + SPAWN_AHEAD) generateRow(world, sp.nextRowZ);
}

/**
 * @param {import('../GameWorld.js').GameWorld} world
 * @param {number} z
 */
export function generateRow(world, z) {
  const { rng, spawner: sp } = world;
  const diff = difficultyForDistance(z);
  const speed = speedForDistance(z);
  // Marge : temps de réaction + durée d'un changement de voie à la vitesse prévue.
  const margin = speed * 0.4 + 2;
  /** @param {number} l */
  const free = (l) => sp.trainEnd[l] < z - margin;

  /** @type {number[]} */
  const candidates = [];
  for (let l = 0; l < LANE_COUNT; l++) {
    if (!free(l)) continue;
    const lo = Math.min(l, sp.safeLane);
    const hi = Math.max(l, sp.safeLane);
    let reachable = true;
    for (let k = lo; k <= hi; k++) if (!free(k)) reachable = false;
    if (reachable) candidates.push(l);
  }
  // Par construction l'ancienne voie sûre n'a jamais reçu de train : la liste n'est pas vide.
  // Garde-fou défensif si l'invariant venait à être cassé par une évolution future.
  if (candidates.length === 0) {
    sp.trainEnd[sp.safeLane] = NO_TRAIN;
    candidates.push(sp.safeLane);
  }
  const safe = rng.pick(candidates);
  sp.safeLane = safe;

  const gap = Math.max(14, speed * rng.range(0.9, 1.5) * (1.2 - 0.3 * diff));
  const obstacleChance = 0.45 + 0.4 * diff;
  /** @type {boolean[]} */
  const trainPlacedHere = [false, false, false];
  // Instantané avant placement : un joueur dans une voie libre doit pouvoir rejoindre la voie sûre.
  const freeBefore = [free(0), free(1), free(2)];
  /** @param {number} lane */
  const canEscape = (lane) => {
    const lo = Math.min(lane, safe);
    const hi = Math.max(lane, safe);
    for (let k = lo + 1; k < hi; k++) if (!freeBefore[k]) return false;
    return true;
  };

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    if (lane === safe) {
      // La voie sûre peut porter une barrière franchissable (saut ou glissade).
      if (rng.chance(0.2 + 0.25 * diff)) {
        world.addObstacle(rng.chance(0.5) ? 'LOW' : 'HIGH', lane, z, BARRIER_DEPTH);
      }
      continue;
    }
    if (!free(lane)) continue;
    if (!rng.chance(obstacleChance)) continue;
    // Pas de train qui piégerait un joueur séparé de la voie sûre par un autre train.
    const kind = rng.weighted([
      ['TRAIN', canEscape(lane) ? 0.35 + 0.25 * diff : 0],
      ['LOW', 0.35],
      ['HIGH', 0.3],
    ]);
    if (kind === 'TRAIN') {
      const len = rng.range(16, 34);
      sp.trainEnd[lane] = z + len;
      trainPlacedHere[lane] = true;
      world.addObstacle('TRAIN', lane, z, len);
    } else {
      world.addObstacle(kind, lane, z, BARRIER_DEPTH);
    }
  }

  // Ligne de pièces derrière la rangée, jamais dans un train et jamais dans la rangée suivante.
  const coinLanes = [];
  for (let l = 0; l < LANE_COUNT; l++) if (!trainPlacedHere[l] && sp.trainEnd[l] < z) coinLanes.push(l);
  if (coinLanes.length > 0 && rng.chance(0.75)) {
    const lane = rng.pick(coinLanes);
    const maxCount = Math.floor((gap - 5) / COIN_SPACING);
    const count = Math.min(rng.int(4, 8), maxCount);
    for (let i = 0; i < count; i++) world.addCollectible('COIN', lane, z + 2.5 + i * COIN_SPACING, 0.7);
  }
  if (rng.chance(0.03)) world.addCollectible('KEY', safe, z + gap * 0.5, 0.9);
  if (rng.chance(0.06)) world.addCollectible(rng.pick(POWERUP_KINDS), safe, z + gap * 0.75, 0.9);

  sp.nextRowZ = z + gap;
  sp.rows++;
}
