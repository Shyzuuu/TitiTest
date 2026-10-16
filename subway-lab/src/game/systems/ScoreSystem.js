/**
 * Score et distance. Le score brut est un flottant accumulé ; la valeur
 * affichée est sa partie entière. Les jalons émettent des événements discrets
 * plutôt qu'un événement par pas (taille d'enregistrement maîtrisée).
 */

import { DISTANCE_MILESTONE, SCORE_MILESTONE, STEP } from '../constants.js';

/**
 * @param {import('../GameWorld.js').GameWorld} world
 */
export function updateDistanceAndScore(world) {
  const advance = world.speed * STEP;
  world.player.z += advance;
  world.distance = world.player.z;
  world.addScore(advance);

  const milestone = Math.floor(world.distance / DISTANCE_MILESTONE);
  if (milestone > world.lastDistanceMilestone) {
    world.lastDistanceMilestone = milestone;
    world.emit('DISTANCE_MILESTONE', { d: milestone * DISTANCE_MILESTONE, s: world.score });
  }
}

/**
 * @param {import('../GameWorld.js').GameWorld} world
 */
export function checkScoreMilestone(world) {
  const m = Math.floor(world.score / SCORE_MILESTONE);
  if (m > world.lastScoreMilestone) {
    world.lastScoreMilestone = m;
    world.emit('SCORE_CHANGE', { s: world.score });
  }
}
