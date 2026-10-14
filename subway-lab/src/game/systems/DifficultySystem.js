/**
 * Difficulté progressive, fonction pure de la distance : la génération reste
 * reproductible quelle que soit la vitesse d'affichage.
 */

import { BASE_SPEED, MAX_SPEED, SPEED_PER_METER } from '../constants.js';

/**
 * @param {number} distance
 * @returns {number} vitesse d'avance en m/s de simulation
 */
export function speedForDistance(distance) {
  return Math.min(MAX_SPEED, BASE_SPEED + Math.max(0, distance) * SPEED_PER_METER);
}

/**
 * @param {number} distance
 * @returns {number} 0..1
 */
export function difficultyForDistance(distance) {
  return Math.min(1, Math.max(0, distance) / 3000);
}

/**
 * @param {number} distance
 * @returns {number} niveau entier affiché (1..)
 */
export function difficultyLevel(distance) {
  return 1 + Math.floor(Math.max(0, distance) / 500);
}
