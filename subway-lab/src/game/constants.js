/**
 * Paramètres physiques du prototype. Toute modification change le résultat
 * d'un rejeu : incrémenter PHYSICS_VERSION pour que les anciennes runs soient
 * signalées comme incompatibles au lieu de diverger silencieusement.
 */

import { STEP, TICK_RATE } from '../simulation/FixedStepRunner.js';

export const PHYSICS_VERSION = 2;
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
export const TRAIN_TOP = 3.4;
/** @type {Readonly<Record<'LOW'|'HIGH'|'TRAIN'|'RAMP', {bottom:number, top:number}>>} */
export const OBSTACLE_SHAPES = Object.freeze({
  LOW: Object.freeze({ bottom: 0, top: 1.0 }),
  HIGH: Object.freeze({ bottom: 1.15, top: 2.8 }),
  TRAIN: Object.freeze({ bottom: 0, top: TRAIN_TOP }),
  // La rampe n'est jamais un obstacle : c'est un sol incliné qui mène au toit du train.
  RAMP: Object.freeze({ bottom: 0, top: 0 }),
});
export const BARRIER_DEPTH = 0.6;
export const RAMP_LENGTH = 7;
/** Tolérance verticale : on « monte » sur un sol plus haut tant que l'écart reste sous ce seuil. */
export const STEP_UP = 0.6;
/** Écart max entre le z d'un obstacle et celui des obstacles insérés avant lui (rampe + train d'une rangée). */
export const MAX_ROW_SPREAD = RAMP_LENGTH;
export const JETPACK_HEIGHT = 6;
export const JETPACK_CLIMB_SPEED = 8;
export const HOVERBOARD_TICKS = 30 * 60;
export const INVULNERABLE_TICKS = 60;
export const MAX_HOVERBOARDS = 99;
export const MAX_SCORE_MULTIPLIER = 30;

export const SPAWN_AHEAD = 150;
export const DESPAWN_BEHIND = 12;
export const FIRST_ROW_Z = 40;
export const COIN_SPACING = 2;
export const COIN_VALUE = 10;

export const MAGNET_RANGE_AHEAD = 10;
export const POWERUP_KINDS = Object.freeze(['MAGNET', 'DOUBLE', 'SNEAKERS', 'JETPACK']);
export const POWERUP_BASE_SECONDS = 10;
export const POWERUP_SECONDS_PER_LEVEL = 2;
export const MAX_UPGRADE_LEVEL = 5;

export const DISTANCE_MILESTONE = 100;
export const SCORE_MILESTONE = 1000;
export const CHECKPOINT_INTERVAL = 120;

export const ACTIONS = Object.freeze(['LANE_LEFT', 'LANE_RIGHT', 'JUMP', 'SLIDE', 'HOVERBOARD', 'REVIVE']);
export const PLAYER_STATES = Object.freeze(['RUNNING', 'JUMPING', 'SLIDING', 'FLYING', 'CRASHED']);
