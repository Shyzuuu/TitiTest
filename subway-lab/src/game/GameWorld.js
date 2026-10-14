/**
 * État complet et pas de simulation du gameplay (rôle de GameStateManager).
 * Strictement déterministe : même graine + même configuration + mêmes actions
 * aux mêmes pas ⇒ même état, bit pour bit.
 */

import { hashNumbers } from '../core/hash.js';
import { RandomProvider } from '../simulation/RandomProvider.js';
import { DESPAWN_BEHIND, POWERUP_KINDS, laneX } from './constants.js';
import { applyPlayerAction } from './PlayerController.js';
import { parseRunConfig } from './runConfig.js';
import { resolveCollisions } from './systems/CollisionSystem.js';
import { updateCollectibles } from './systems/CollectibleSystem.js';
import { speedForDistance, difficultyLevel } from './systems/DifficultySystem.js';
import { updateJump } from './systems/JumpSystem.js';
import { updateLaneMovement } from './systems/LaneMovementSystem.js';
import { createSpawnerState, updateSpawner } from './systems/ObstacleSpawner.js';
import { activatePowerup, updatePowerups } from './systems/PowerupSystem.js';
import { checkScoreMilestone, updateDistanceAndScore } from './systems/ScoreSystem.js';
import { updateSlide } from './systems/SlideSystem.js';

/**
 * @typedef {{ lane:number, prevLane:number, x:number, y:number, vy:number, z:number,
 *   airborne:boolean, slideTicks:number, slideQueued:boolean, stumbleTicks:number, crashed:boolean }} PlayerState
 * @typedef {{ id:number, kind:'LOW'|'HIGH'|'TRAIN', lane:number, z:number, len:number }} Obstacle
 * @typedef {{ id:number, kind:'COIN'|'KEY'|'MAGNET'|'DOUBLE'|'SNEAKERS', lane:number, z:number, y:number }} Collectible
 * @typedef {{ nextRowZ:number, trainEnd:number[], safeLane:number, rows:number }} SpawnerState
 * @typedef {(type: string, payload: Record<string, unknown>) => void} EventSink
 */

/** @type {EventSink} */
const NOOP_SINK = () => {};

export class GameWorld {
  /**
   * @param {{ seed: number, config: import('./runConfig.js').RunConfig, onEvent?: EventSink }} options
   */
  constructor({ seed, config, onEvent = NOOP_SINK }) {
    const parsed = parseRunConfig(config);
    if (!parsed.ok) throw new RangeError(`Configuration de run invalide : ${parsed.errors.join(' ')}`);
    this.config = parsed.value;
    this.onEvent = onEvent;
    this.rng = new RandomProvider(seed);
    this.reset(seed);
  }

  /** @param {number} seed */
  reset(seed) {
    this.rng.setSeed(seed);
    this.seed = seed;
    this.tick = 0;
    /** @type {PlayerState} */
    this.player = {
      lane: 1, prevLane: 1, x: laneX(1), y: 0, vy: 0, z: 0,
      airborne: false, slideTicks: 0, slideQueued: false, stumbleTicks: 0, crashed: false,
    };
    this.speed = speedForDistance(0);
    this.distance = 0;
    this.scoreRaw = 0;
    this.score = 0;
    this.coinsRun = 0;
    this.keysRun = 0;
    this.revives = 0;
    this.lastDistanceMilestone = 0;
    this.lastScoreMilestone = 0;
    /** @type {Obstacle[]} */
    this.obstacles = [];
    /** @type {Collectible[]} */
    this.collectibles = [];
    this.nextEntityId = 1;
    this.spawner = createSpawnerState();
    /** @type {Record<'MAGNET'|'DOUBLE'|'SNEAKERS', number>} pas restants */
    this.powerups = { MAGNET: 0, DOUBLE: 0, SNEAKERS: 0 };
    this.playerState = 'RUNNING';
    this.prevX = this.player.x;
    this.prevY = 0;
    this.prevZ = 0;
    updateSpawner(this);
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} payload
   */
  emit(type, payload) {
    this.onEvent(type, payload);
  }

  /**
   * @param {Obstacle['kind']} kind
   * @param {number} lane
   * @param {number} z
   * @param {number} len
   */
  addObstacle(kind, lane, z, len) {
    this.obstacles.push({ id: this.nextEntityId++, kind, lane, z, len });
  }

  /**
   * @param {Collectible['kind']} kind
   * @param {number} lane
   * @param {number} z
   * @param {number} y
   */
  addCollectible(kind, lane, z, y) {
    this.collectibles.push({ id: this.nextEntityId++, kind, lane, z, y });
  }

  /** @param {number} base points avant multiplicateur */
  addScore(base) {
    const mult = this.powerups.DOUBLE > 0 ? 2 : 1;
    this.scoreRaw += base * mult;
    this.score = Math.floor(this.scoreRaw);
  }

  /**
   * @param {string} action
   * @returns {boolean}
   */
  applyAction(action) {
    return applyPlayerAction(this, action);
  }

  /** @returns {boolean} */
  revive() {
    const p = this.player;
    if (!p.crashed) return false;
    // Dégage la zone devant le joueur pour éviter une mort immédiate après la résurrection.
    const from = p.z - 2;
    const to = p.z + 25;
    this.obstacles = this.obstacles.filter((o) => o.z + o.len < from || o.z > to);
    p.crashed = false;
    p.stumbleTicks = 0;
    p.airborne = false;
    p.y = 0;
    p.vy = 0;
    p.slideTicks = 0;
    p.slideQueued = false;
    p.prevLane = p.lane;
    p.x = laneX(p.lane);
    this.revives++;
    this.updatePlayerState();
    return true;
  }

  /** Un pas de simulation fixe. */
  step() {
    const p = this.player;
    this.prevX = p.x;
    this.prevY = p.y;
    this.prevZ = p.z;
    // Le bonus de départ est activé au premier pas (et non dans reset) pour que son
    // événement soit capturé par l'enregistreur, démarré après la création du monde.
    if (this.tick === 0 && this.config.startBonus === 'MAGNET') activatePowerup(this, 'MAGNET');
    this.tick++;
    if (p.crashed) return;

    const prevX = p.x;
    updateLaneMovement(p);
    updateJump(p);
    updateSlide(p);
    if (p.stumbleTicks > 0) p.stumbleTicks--;

    this.speed = speedForDistance(this.distance);
    updateDistanceAndScore(this);
    updateSpawner(this);
    resolveCollisions(this, prevX);
    updateCollectibles(this);
    updatePowerups(this);
    checkScoreMilestone(this);
    this.despawnObstacles();
    this.updatePlayerState();
  }

  updatePlayerState() {
    const p = this.player;
    const next = p.crashed ? 'CRASHED' : p.airborne ? 'JUMPING' : p.slideTicks > 0 ? 'SLIDING' : 'RUNNING';
    if (next !== this.playerState) {
      const from = this.playerState;
      this.playerState = next;
      this.emit('PLAYER_STATE', { from, to: next });
    }
  }

  despawnObstacles() {
    const limit = this.player.z - DESPAWN_BEHIND;
    const list = this.obstacles;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.z + o.len >= limit) list[w++] = o;
    }
    list.length = w;
  }

  /** @returns {string} empreinte exacte de l'état simulé */
  stateHash() {
    const p = this.player;
    return hashNumbers([
      this.tick, p.lane, p.prevLane, p.x, p.y, p.vy, p.z, p.airborne ? 1 : 0, p.slideTicks, p.slideQueued ? 1 : 0,
      p.stumbleTicks, p.crashed ? 1 : 0, this.scoreRaw, this.coinsRun, this.keysRun, this.revives,
      this.rng.getState(), this.nextEntityId, this.obstacles.length, this.collectibles.length,
      this.powerups.MAGNET, this.powerups.DOUBLE, this.powerups.SNEAKERS, this.spawner.nextRowZ,
    ]);
  }

  /** @returns {Record<string, number|string>} */
  checkpoint() {
    const p = this.player;
    const r3 = (/** @type {number} */ v) => Math.round(v * 1000) / 1000;
    return {
      wt: this.tick, d: r3(this.distance), s: this.score, x: r3(p.x), y: r3(p.y),
      ln: p.lane, c: this.coinsRun, k: this.keysRun, h: this.stateHash(),
    };
  }

  summary() {
    return {
      seed: this.seed,
      tick: this.tick,
      score: this.score,
      distance: this.distance,
      coins: this.coinsRun,
      keys: this.keysRun,
      revives: this.revives,
      speed: this.speed,
      level: difficultyLevel(this.distance),
      playerState: this.playerState,
      crashed: this.player.crashed,
      lane: this.player.lane,
      powerups: { ...this.powerups },
    };
  }
}

export { POWERUP_KINDS };
