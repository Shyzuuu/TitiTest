/**
 * Paramètres physiques du prototype. Toute modification change le résultat
 * d'un rejeu : incrémenter PHYSICS_VERSION pour que les anciennes runs soient
 * signalées comme incompatibles au lieu de diverger silencieusement.
 */

import { STEP, TICK_RATE } from '../simulation/FixedStepRunner.js';

export const PHYSICS_VERSION = 1;
export { STEP, TICK_RATE };

export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.4;
/** @param {number} lane 0..2 */
export const laneX = (lane) => (lane - 1) * LANE_WIDTH;

export const PLAYER_HALF_WIDTH = 0.35;
export const PLAYER_HALF_DEPTH = 0.35;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_SLIDE_HEIGHT = 0.8;

/** Un changement de voie dure ~0,12 s. */
export const LANE_CHANGE_SPEED = LANE_WIDTH / 0.12;

export const GRAVITY = 25;
export const JUMP_VELOCITY = 9;
export const SNEAKERS_JUMP_VELOCITY = 11.5;
export const FAST_FALL_VELOCITY = -18;
export const SLIDE_TICKS = Math.round(0.65 * TICK_RATE);
export const STUMBLE_TICKS = 3 * TICK_RATE;

export const BASE_SPEED = 11;
export const MAX_SPEED = 24;
export const SPEED_PER_METER = 0.0045;

export const OBSTACLE_HALF_WIDTH = 1.0;
/** @type {Readonly<Record<'LOW'|'HIGH'|'TRAIN', {bottom:number, top:number}>>} */
export const OBSTACLE_SHAPES = Object.freeze({
  LOW: Object.freeze({ bottom: 0, top: 1.0 }),
  HIGH: Object.freeze({ bottom: 1.15, top: 2.8 }),
  TRAIN: Object.freeze({ bottom: 0, top: 3.4 }),
});
export const BARRIER_DEPTH = 0.6;

export const SPAWN_AHEAD = 150;
export const DESPAWN_BEHIND = 12;
export const FIRST_ROW_Z = 40;
export const COIN_SPACING = 2;
export const COIN_VALUE = 10;

export const MAGNET_RANGE_AHEAD = 10;
export const POWERUP_KINDS = Object.freeze(['MAGNET', 'DOUBLE', 'SNEAKERS']);
export const POWERUP_BASE_SECONDS = 10;
export const POWERUP_SECONDS_PER_LEVEL = 2;
export const MAX_UPGRADE_LEVEL = 5;

export const DISTANCE_MILESTONE = 100;
export const SCORE_MILESTONE = 1000;
export const CHECKPOINT_INTERVAL = 120;

export const ACTIONS = Object.freeze(['LANE_LEFT', 'LANE_RIGHT', 'JUMP', 'SLIDE', 'REVIVE']);
export const PLAYER_STATES = Object.freeze(['RUNNING', 'JUMPING', 'SLIDING', 'CRASHED']);
export const SKINS = Object.freeze(['DEFAULT', 'NEON', 'GOLD']);
