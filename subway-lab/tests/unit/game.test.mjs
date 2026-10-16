import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameWorld } from '../../src/game/GameWorld.js';
import { defaultRunConfig, parseRunConfig } from '../../src/game/runConfig.js';
import { BARRIER_DEPTH, JUMP_VELOCITY, GRAVITY, LANE_WIDTH, RAMP_LENGTH, SLIDE_TICKS, TRAIN_TOP, laneX } from '../../src/game/constants.js';
import { generateRow } from '../../src/game/systems/ObstacleSpawner.js';
import { speedForDistance } from '../../src/game/systems/DifficultySystem.js';

/** Monde vide d'obstacles (contrôle total du scénario). */
function emptyWorld(seed = 1, config = defaultRunConfig()) {
  /** @type {[string, any][]} */
  const events = [];
  const w = new GameWorld({ seed, config, onEvent: (t, p) => events.push([t, p]) });
  w.obstacles.length = 0;
  w.collectibles.length = 0;
  // Repousse la génération très loin pour garder la piste vide pendant le test.
  w.spawner.nextRowZ = 1e9;
  return { w, events };
}

test('Voies : trois voies, déplacement borné et position X atteinte', () => {
  const { w } = emptyWorld();
  assert.equal(w.player.lane, 1);
  assert.equal(w.applyAction('LANE_LEFT'), true);
  assert.equal(w.applyAction('LANE_LEFT'), false, 'pas de 4e voie');
  for (let i = 0; i < 15; i++) w.step();
  assert.equal(w.player.x, laneX(0));
  w.applyAction('LANE_RIGHT');
  w.applyAction('LANE_RIGHT');
  assert.equal(w.applyAction('LANE_RIGHT'), false);
  for (let i = 0; i < 30; i++) w.step();
  assert.equal(w.player.x, LANE_WIDTH);
});

test('Saut : hauteur maximale cohérente avec la physique et atterrissage', () => {
  const { w } = emptyWorld();
  assert.equal(w.applyAction('JUMP'), true);
  assert.equal(w.applyAction('JUMP'), false, 'pas de double saut');
  let maxY = 0;
  let ticks = 0;
  do {
    w.step();
    maxY = Math.max(maxY, w.player.y);
    ticks++;
  } while (w.player.airborne && ticks < 200);
  const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
  assert.ok(Math.abs(maxY - apex) < 0.1, `apex ${maxY} ≈ ${apex}`);
  assert.equal(w.player.y, 0);
  assert.ok(ticks > 35 && ticks < 50, `durée de vol ${ticks} pas`);
});

test('Glissade : durée fixe, et glissade en l\'air = chute rapide puis glissade', () => {
  const { w } = emptyWorld();
  w.applyAction('SLIDE');
  assert.equal(w.player.slideTicks, SLIDE_TICKS);
  for (let i = 0; i < SLIDE_TICKS; i++) w.step();
  assert.equal(w.player.slideTicks, 0);
  w.applyAction('JUMP');
  for (let i = 0; i < 8; i++) w.step();
  w.applyAction('SLIDE');
  let n = 0;
  while (w.player.airborne && n++ < 100) w.step();
  assert.ok(n < 10, 'la chute rapide ramène vite au sol');
  assert.ok(w.player.slideTicks > 0, 'glissade déclenchée à l\'atterrissage');
});

test('Collisions : barrière basse (sauter), haute (glisser), train (fatal)', () => {
  // Barrière basse sans saut → fatal
  let { w, events } = emptyWorld();
  w.addObstacle('LOW', 1, 5, BARRIER_DEPTH);
  for (let i = 0; i < 60 && !w.player.crashed; i++) w.step();
  assert.equal(w.player.crashed, true);
  assert.ok(events.some(([t, p]) => t === 'COLLISION' && p.fatal && p.kind === 'LOW'));
  // Barrière basse avec saut au bon moment → franchie
  ({ w } = emptyWorld());
  w.addObstacle('LOW', 1, 5, BARRIER_DEPTH);
  for (let i = 0; i < 120; i++) {
    if (!w.player.airborne && w.obstacles[0] && w.obstacles[0].z - w.player.z < 2 && w.obstacles[0].z > w.player.z) w.applyAction('JUMP');
    w.step();
  }
  assert.equal(w.player.crashed, false);
  // Barrière haute : debout → fatal, en glissade → passe
  ({ w } = emptyWorld());
  w.addObstacle('HIGH', 1, 5, BARRIER_DEPTH);
  for (let i = 0; i < 60; i++) w.step();
  assert.equal(w.player.crashed, true);
  ({ w } = emptyWorld());
  w.addObstacle('HIGH', 1, 5, BARRIER_DEPTH);
  w.applyAction('SLIDE');
  for (let i = 0; i < 60; i++) w.step();
  assert.equal(w.player.crashed, false);
  // Train : fatal même en sautant
  ({ w } = emptyWorld());
  w.addObstacle('TRAIN', 1, 6, 20);
  w.applyAction('JUMP');
  for (let i = 0; i < 60; i++) w.step();
  assert.equal(w.player.crashed, true);
});

test('Collision latérale : trébuchement et retour dans la voie, second choc fatal', () => {
  const { w, events } = emptyWorld();
  w.addObstacle('TRAIN', 0, -2, 40); // train déjà à côté du joueur (voie gauche)
  w.applyAction('LANE_LEFT');
  for (let i = 0; i < 10; i++) w.step();
  assert.equal(w.player.crashed, false);
  assert.equal(w.player.lane, 1);
  assert.ok(events.some(([t]) => t === 'STUMBLE'));
  w.applyAction('LANE_LEFT');
  for (let i = 0; i < 10; i++) w.step();
  assert.equal(w.player.crashed, true, 'deuxième choc pendant le trébuchement');
});

test('Pièces, clés, bonus, score et distance', () => {
  const { w, events } = emptyWorld();
  w.addCollectible('COIN', 1, 3, 0.7);
  w.addCollectible('KEY', 1, 4, 0.9);
  w.addCollectible('DOUBLE', 1, 5, 0.9);
  w.addCollectible('COIN', 0, 6, 0.7); // autre voie : non ramassée
  for (let i = 0; i < 60; i++) w.step();
  assert.equal(w.coinsRun, 1);
  assert.equal(w.keysRun, 1);
  assert.ok(w.powerups.DOUBLE > 0);
  assert.ok(events.some(([t, p]) => t === 'POWERUP_START' && p.kind === 'DOUBLE'));
  assert.ok(w.distance > 10);
  assert.ok(w.score >= Math.floor(w.distance), 'score ≥ distance (pièces et ×2)');
  // Aimant : ramasse les pièces des autres voies
  const m = emptyWorld();
  m.w.addCollectible('MAGNET', 1, 2, 0.9);
  m.w.addCollectible('COIN', 0, 8, 0.7);
  m.w.addCollectible('COIN', 2, 9, 0.7);
  for (let i = 0; i < 60; i++) m.w.step();
  assert.equal(m.w.coinsRun, 2);
});

test('Fin de bonus et bonus de départ', () => {
  const cfg = defaultRunConfig();
  cfg.startBonus = 'MAGNET';
  const { w, events } = emptyWorld(1, cfg);
  w.step();
  assert.ok(w.powerups.MAGNET > 0);
  const dur = w.powerups.MAGNET;
  for (let i = 0; i < dur; i++) w.step();
  assert.ok(events.some(([t, p]) => t === 'POWERUP_END' && p.kind === 'MAGNET'));
});

test('Résurrection : dégage la zone et relance la course', () => {
  const { w } = emptyWorld();
  w.addObstacle('TRAIN', 1, 3, 20);
  for (let i = 0; i < 30; i++) w.step();
  assert.equal(w.player.crashed, true);
  const z = w.player.z;
  for (let i = 0; i < 30; i++) w.step();
  assert.equal(w.player.z, z, 'aucun mouvement après collision');
  assert.equal(w.applyAction('JUMP'), false);
  assert.equal(w.applyAction('REVIVE'), true);
  assert.equal(w.revives, 1);
  for (let i = 0; i < 30; i++) w.step();
  assert.equal(w.player.crashed, false);
});

test('Déterminisme : même graine + mêmes actions ⇒ même empreinte', () => {
  const play = () => {
    const w = new GameWorld({ seed: 777, config: defaultRunConfig() });
    for (let i = 0; i < 3000; i++) {
      if (i % 37 === 0) w.applyAction(['LANE_LEFT', 'JUMP', 'LANE_RIGHT', 'SLIDE'][(i / 37) % 4]);
      if (w.player.crashed) w.applyAction('REVIVE');
      w.step();
    }
    return w.stateHash();
  };
  assert.equal(play(), play());
  const other = new GameWorld({ seed: 778, config: defaultRunConfig() });
  for (let i = 0; i < 100; i++) other.step();
  assert.notEqual(other.stateHash(), new GameWorld({ seed: 777, config: defaultRunConfig() }).stateHash());
});

test('Générateur : jamais trois voies bloquées par des trains, difficulté progressive', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = new GameWorld({ seed, config: defaultRunConfig() });
    // Le constructeur a déjà généré les premières rangées : on poursuit la même séquence.
    let z = w.spawner.nextRowZ;
    while (z < 6000) {
      generateRow(w, z);
      z = w.spawner.nextRowZ;
    }
    // Une rampe précède son train : l'ensemble bloque la voie (on ne monte que par l'avant).
    const trains = w.obstacles.filter((o) => o.kind === 'TRAIN' || o.kind === 'RAMP');
    // Balayage par événements : O(n log n) au lieu d'un échantillonnage dense.
    const edges = trains.flatMap((t) => [[t.z, 1, t.lane], [t.z + t.len, -1, t.lane]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const active = [0, 0, 0];
    for (const [, d, lane] of edges) {
      active[lane] += d;
      assert.ok(!(active[0] > 0 && active[1] > 0 && active[2] > 0), `graine ${seed} : trois voies bloquées`);
    }
    // Pas de pièce à l'intérieur d'un train (les pièces de toit sont au-dessus)
    for (const c of w.collectibles.filter((x) => x.y < 3)) {
      assert.ok(!trains.some((t) => t.lane === c.lane && c.z > t.z && c.z < t.z + t.len), `graine ${seed} : pièce dans un train`);
    }
  }
  assert.ok(speedForDistance(3000) > speedForDistance(0));
  assert.ok(speedForDistance(1e6) === 24);
});

test('Configuration de run validée', () => {
  assert.equal(parseRunConfig(defaultRunConfig()).ok, true);
  assert.equal(parseRunConfig({ ...defaultRunConfig(), skin: 'HACK' }).ok, false);
  assert.equal(parseRunConfig({ ...defaultRunConfig(), upgrades: { MAGNET: 9, DOUBLE: 0, SNEAKERS: 0 } }).ok, false);
  assert.throws(() => new GameWorld({ seed: 1, config: /** @type {any} */ ({}) }));
});

test('Rampe : monter sur le toit, courir dessus, retomber à la fin', () => {
  const { w } = emptyWorld();
  w.addObstacle('RAMP', 1, 5, RAMP_LENGTH);
  w.addObstacle('TRAIN', 1, 5 + RAMP_LENGTH, 20);
  let maxY = 0;
  let roofTicks = 0;
  for (let i = 0; i < 300; i++) {
    w.step();
    maxY = Math.max(maxY, w.player.y);
    if (!w.player.airborne && w.player.y === TRAIN_TOP) roofTicks++;
  }
  assert.equal(w.player.crashed, false, 'la rampe mène au toit sans collision');
  assert.equal(maxY, TRAIN_TOP);
  assert.ok(roofTicks > 60);
  assert.equal(w.player.y, 0, 'retombé au sol après le train');
});

test('Train sans rampe : on ne peut pas sauter dessus', () => {
  const { w } = emptyWorld();
  w.addObstacle('TRAIN', 1, 4, 20);
  w.applyAction('JUMP');
  for (let i = 0; i < 40; i++) w.step();
  assert.equal(w.player.crashed, true);
});

test('Jetpack : vol au-dessus des obstacles, pièces aspirées, atterrissage', () => {
  const { w, events } = emptyWorld();
  w.addCollectible('JETPACK', 1, 2, 0.9);
  for (let i = 0; i < 20; i++) w.step();
  assert.ok(w.powerups.JETPACK > 0);
  w.addObstacle('TRAIN', 1, w.player.z + 20, 30);
  w.addObstacle('HIGH', 1, w.player.z + 60, BARRIER_DEPTH);
  w.addCollectible('COIN', 1, w.player.z + 15, 0.7);
  assert.equal(w.applyAction('JUMP'), false, 'pas de saut en vol');
  for (let i = 0; i < 240; i++) w.step();
  assert.equal(w.player.crashed, false);
  assert.ok(w.coinsRun >= 1);
  assert.ok(events.some(([t, p]) => t === 'PLAYER_STATE' && p.to === 'FLYING'));
  while (w.powerups.JETPACK > 0) w.step();
  w.obstacles.length = 0;
  for (let i = 0; i < 120; i++) w.step();
  assert.equal(w.player.y, 0);
});

test('Hoverboard : absorbe un crash puis disparaît ; inventaire limité', () => {
  const cfg = defaultRunConfig();
  cfg.hoverboards = 1;
  const { w, events } = emptyWorld(1, cfg);
  assert.equal(w.applyAction('HOVERBOARD'), true);
  assert.equal(w.applyAction('HOVERBOARD'), false, 'déjà actif');
  w.addObstacle('TRAIN', 1, 6, 20);
  for (let i = 0; i < 60; i++) w.step();
  assert.equal(w.player.crashed, false);
  assert.ok(events.some(([t, p]) => t === 'HOVERBOARD_END' && p.reason === 'crash'));
  assert.equal(w.hoverboardTicks, 0);
  assert.equal(w.applyAction('HOVERBOARD'), false, 'plus de planche');
  for (let i = 0; i < 60; i++) w.step();
  assert.equal(w.player.crashed, true, 'sans planche, le train est fatal');
});

test('Boîte mystère et multiplicateur de score', () => {
  const cfg = defaultRunConfig();
  cfg.scoreMultiplier = 3;
  const { w, events } = emptyWorld(5, cfg);
  w.addCollectible('BOX', 1, 3, 0.9);
  for (let i = 0; i < 60; i++) w.step();
  const box = events.find(([t]) => t === 'BOX');
  assert.ok(box);
  assert.ok(w.coinsRun > 0 || w.keysRun === 1);
  assert.ok(w.score >= Math.floor(w.distance * 3) - 1, 'multiplicateur appliqué aux points de distance');
});

test('Résumé du monde (utilisé par l\'interface à chaque rafraîchissement)', () => {
  const cfg = defaultRunConfig();
  cfg.hoverboards = 2;
  const w = new GameWorld({ seed: 9, config: cfg });
  for (let i = 0; i < 120; i++) w.step();
  const s = w.summary();
  assert.equal(s.hoverboardsLeft, 2);
  assert.equal(s.onRoof, false);
  assert.equal(typeof s.powerups.JETPACK, 'number');
  assert.ok(s.distance > 0);
});
