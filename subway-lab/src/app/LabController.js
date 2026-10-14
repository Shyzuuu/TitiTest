/**
 * Orchestrateur sans DOM : relie horloge, monde, enregistreur, rejeu,
 * ressources et stockage, sous le contrôle de la machine à états.
 * L'interface et les tests pilotent exclusivement cette classe : un bouton
 * de l'UI n'a pas d'autre effet que l'appel d'une méthode publique d'ici.
 *
 * Ordre d'un pas (identique en jeu, en enregistrement et en rejeu) :
 *   1. actions (redémarrage puis entrées, dans leur ordre d'arrivée / de séquence) ;
 *   2. GameWorld.step() ;
 *   3. point de contrôle éventuel ;
 *   4. tick global + 1.
 */

import { LabError } from '../core/errors.js';
import { decideAction } from '../game/AutoPilot.js';
import { ACTIONS, CHECKPOINT_INTERVAL, PHYSICS_VERSION } from '../game/constants.js';
import { GameWorld } from '../game/GameWorld.js';
import { createRunId } from '../recorder/EventSchema.js';
import { RunRecorder, removeDraft } from '../recorder/RunRecorder.js';
import { compareRuns } from '../replay/ReplayComparator.js';
import { ReplayEngine } from '../replay/ReplayEngine.js';
import { PurchaseSimulator, reviveCost } from '../resources/PurchaseSimulator.js';
import { ResourceTestManager } from '../resources/ResourceTestManager.js';
import { FixedStepRunner, TICK_RATE } from '../simulation/FixedStepRunner.js';
import { generateSeed } from '../simulation/RandomProvider.js';
import { SimulationClock, monotonicNow } from '../simulation/SimulationClock.js';
import { RunRepository, sanitizeRunName } from '../storage/RunRepository.js';
import { SaveManager } from '../storage/SaveManager.js';
import { LABELS, StateMachine, States } from './StateMachine.js';

const S = States;
const MAX_PENDING_INPUTS = 16;
const ERROR_LOG_LIMIT = 30;
const NOTICE_LIMIT = 50;

/**
 * @typedef {{ level: 'info'|'success'|'warning'|'error', message: string, at: number }} Notice
 */

export class LabController {
  /**
   * @param {{ storage: import('../storage/StorageAdapter.js').KeyValueStorage, now?: () => number,
   *   maxStepsPerFrame?: number, budgetChars?: number,
   *   recorderOptions?: { flushEvery?: number, flushIntervalMs?: number } }} options
   */
  constructor({ storage, now = monotonicNow, maxStepsPerFrame = 8, budgetChars, recorderOptions = {} }) {
    this.now = now;
    this.saveManager = new SaveManager(storage, budgetChars ? { budgetChars } : {});
    this.fsm = new StateMachine();
    this.clock = new SimulationClock({ now });
    this.runner = new FixedStepRunner({ maxStepsPerFrame });
    this.resources = new ResourceTestManager(this.saveManager);
    this.shop = new PurchaseSimulator(this.saveManager, this.resources);
    this.repo = new RunRepository(this.saveManager);
    this.recorder = new RunRecorder({ saveManager: this.saveManager, ...recorderOptions });
    // Le rejeu enregistre dans un enregistreur sans stockage : il ne peut jamais écraser l'original.
    this.shadow = new RunRecorder({ saveManager: null });
    this.replay = new ReplayEngine();

    /** @type {GameWorld | null} */
    this.world = null;
    this.globalTick = 0;
    /** @type {string[]} */
    this.pendingInputs = [];
    /** @type {number | null} */
    this.pendingRestartSeed = null;
    this.worldSettled = true;
    this.followOriginalSpeed = true;
    this.autopilot = false;

    /** @type {import('../recorder/RunValidator.js').RunRecord | null} */
    this.replayRun = null;
    /** @type {import('../replay/ReplayComparator.js').ComparisonReport | null} */
    this.lastReplayReport = null;
    /** Pas atteint par le dernier rejeu (fin ou arrêt), pour l'affichage. */
    this.lastReplayStopTick = 0;
    /** @type {import('../storage/RunRepository.js').RunSummary | null} */
    this.lastSavedRun = null;
    /** @type {import('../recorder/RunValidator.js').RunRecord | null} */
    this.unsavedRun = null;
    /** @type {{ score: number, distance: number, coins: number, keys: number, mode: string } | null} */
    this.lastRunSummary = null;

    /** @type {{ at: number, code: string, message: string }[]} */
    this.errors = [];
    /** @type {Notice[]} */
    this.notices = [];
    this.stats = { ignoredInputs: 0, rejectedInputs: 0, frameMs: 0, lastFrameSteps: 0, totalSteps: 0 };
    /** @type {import('../recorder/EventSchema.js').EventTuple[]} */
    this.actionBuffer = [];

    this.onWorldEvent = this.onWorldEvent.bind(this);
  }

  // ───────────────────────────── cycle de vie ─────────────────────────────

  init() {
    try {
      this.saveManager.cleanupTemporaries();
      this.resources.load();
      this.shop.load();
      this.repo.load();
      for (const w of [this.resources.loadWarning, this.shop.loadWarning, ...this.repo.warnings]) {
        if (w) this.notify('warning', w);
      }
      const recovered = RunRecorder.recoverDrafts(this.saveManager);
      for (const run of recovered.runs) {
        try {
          this.repo.save(run);
          removeDraft(this.saveManager, run.id);
          this.notify('warning', `Enregistrement interrompu récupéré : « ${run.name} » (${run.meta.eventCount} événements).`);
        } catch (e) {
          this.logError('RECOVERY', /** @type {Error} */ (e).message);
        }
      }
      for (const msg of recovered.errors) {
        this.logError('RECOVERY', msg);
        const id = /run_[a-z0-9_]+/.exec(msg)?.[0];
        // Brouillon signalé puis retiré : sinon l'erreur réapparaîtrait à chaque lancement.
        if (id) removeDraft(this.saveManager, id);
      }
      this.fsm.transition(S.READY, 'initialisation terminée');
    } catch (e) {
      this.logError('INIT', /** @type {Error} */ (e).message);
      this.fsm.fail('échec d\'initialisation');
    }
    return this;
  }

  /** Revient à un état cohérent après une erreur. */
  recover() {
    if (!this.fsm.is(S.ERROR)) return;
    this.pendingInputs.length = 0;
    this.pendingRestartSeed = null;
    if (this.recorder.active) this.recorder.reset();
    if (this.shadow.active) this.shadow.reset();
    this.clock.stop();
    this.fsm.transition(S.READY, 'récupération après erreur');
  }

  // ───────────────────────────── partie ─────────────────────────────

  /**
   * @param {{ record?: boolean, name?: string, seed?: number }} [options]
   */
  startRun({ record = false, name, seed } = {}) {
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) throw new LabError('BUSY', 'Impossible de lancer une partie pendant un rejeu.');
    if (this.fsm.is(S.RECORDING, S.RECORDING_PAUSED)) throw new LabError('ALREADY_RECORDING', 'Un enregistrement est déjà en cours.');
    const target = record ? S.RECORDING : S.RUNNING;
    if (!this.fsm.can(target)) throw new LabError('BUSY', `Action impossible dans l'état « ${LABELS[/** @type {keyof typeof LABELS} */ (this.fsm.state)]} ».`);
    const runName = record ? (name !== undefined && name !== '' ? sanitizeRunName(name) : defaultRunName()) : '';
    const cfg = this.shop.consumeRunConfig();
    const s = seed ?? generateSeed();
    this.world = new GameWorld({ seed: s, config: cfg, onEvent: this.onWorldEvent });
    this.worldSettled = false;
    this.globalTick = 0;
    this.pendingInputs.length = 0;
    this.pendingRestartSeed = null;
    this.clock.start();
    this.runner.reset();
    this.lastRunSummary = null;
    if (record) {
      this.recorder.start({
        id: createRunId(), name: runName, seed: s, config: cfg,
        initialSpeed: this.clock.multiplier, initialHash: this.world.stateHash(),
      });
      this.recorder.record('RUN_START', 0, 0, { seed: s, speed: this.clock.multiplier, physics: PHYSICS_VERSION });
    }
    this.fsm.transition(target, record ? 'REC' : 'jouer');
    return { seed: s, config: cfg };
  }

  /**
   * Politique d'entrée : une commande reçue pendant une pause est IGNORÉE (ni
   * appliquée ni mise en file ni enregistrée) et comptée dans stats.ignoredInputs.
   * Pendant un rejeu, les commandes du joueur sont refusées.
   * @param {string} action
   * @returns {{ accepted: boolean, reason?: string }}
   */
  input(action) {
    if (!ACTIONS.includes(action) || action === 'REVIVE') return { accepted: false, reason: 'Action inconnue.' };
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) {
      this.stats.rejectedInputs++;
      return { accepted: false, reason: 'Rejeu en cours : commandes désactivées.' };
    }
    if (this.fsm.is(S.PAUSED, S.RECORDING_PAUSED)) {
      this.stats.ignoredInputs++;
      return { accepted: false, reason: 'Pause : commande ignorée.' };
    }
    if (!this.fsm.is(S.RUNNING, S.RECORDING)) return { accepted: false, reason: 'Aucune partie en cours.' };
    if (this.pendingInputs.length >= MAX_PENDING_INPUTS) return { accepted: false, reason: 'File d\'entrées pleine.' };
    this.pendingInputs.push(action);
    return { accepted: true };
  }

  pause() {
    const map = { [S.RUNNING]: S.PAUSED, [S.RECORDING]: S.RECORDING_PAUSED, [S.REPLAYING]: S.REPLAY_PAUSED };
    const to = map[this.fsm.state];
    if (!to) return false;
    this.clock.pause();
    if (to === S.RECORDING_PAUSED) this.recorder.record('PAUSE', this.globalTick, this.realMs(), {});
    this.fsm.transition(to, 'pause');
    return true;
  }

  resume() {
    const map = { [S.PAUSED]: S.RUNNING, [S.RECORDING_PAUSED]: S.RECORDING, [S.REPLAY_PAUSED]: S.REPLAYING };
    const to = map[this.fsm.state];
    if (!to) return false;
    this.clock.resume();
    if (to === S.RECORDING) this.recorder.record('RESUME', this.globalTick, this.realMs(), {});
    this.runner.reset();
    this.fsm.transition(to, 'reprise');
    return true;
  }

  togglePause() {
    return this.fsm.is(S.PAUSED, S.RECORDING_PAUSED, S.REPLAY_PAUSED) ? this.resume() : this.pause();
  }

  /**
   * Changement de vitesse à chaud : seul le rythme réel des pas change ; l'état
   * du monde, les timers et l'enregistrement ne sont pas touchés.
   * @param {unknown} value
   * @param {{ user?: boolean }} [options]
   */
  setSpeed(value, { user = true } = {}) {
    const { from, to, changed } = this.clock.setMultiplier(value);
    if (changed && this.recorder.active) this.recorder.record('SPEED_CHANGE', this.globalTick, this.realMs(), { from, to });
    // Une action manuelle pendant le rejeu prend le pas sur la chronologie de vitesse d'origine.
    if (user && this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) this.followOriginalSpeed = false;
    return to;
  }

  /** @param {boolean} follow */
  setFollowOriginalSpeed(follow) {
    this.followOriginalSpeed = !!follow;
  }

  /** Touche R : recommence (jamais pendant un rejeu). */
  restart() {
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) throw new LabError('BUSY', 'Recommencer est désactivé pendant un rejeu.');
    if (this.fsm.is(S.RECORDING, S.RECORDING_PAUSED)) {
      // Le redémarrage fait partie de la run enregistrée : il est appliqué au prochain pas et rejoué à l'identique.
      this.pendingInputs.length = 0;
      this.pendingRestartSeed = generateSeed();
      if (this.fsm.is(S.RECORDING_PAUSED)) this.resume();
      return { recorded: true };
    }
    if (this.fsm.is(S.RUNNING, S.PAUSED)) this.finishRun();
    this.startRun();
    return { recorded: false };
  }

  /** Résurrection payée en clés (coût doublé à chaque utilisation dans la run). */
  revive() {
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) throw new LabError('BUSY', 'Résurrection impossible pendant un rejeu.');
    if (!this.fsm.is(S.RUNNING, S.RECORDING)) throw new LabError('NOT_PLAYING', 'Reprenez la partie avant de ressusciter.');
    if (!this.world || !this.world.player.crashed) throw new LabError('NOT_CRASHED', 'Aucune collision à annuler.');
    if (this.pendingInputs.includes('REVIVE')) return { ok: true, cost: reviveCost(this.world.revives) };
    const cost = reviveCost(this.world.revives);
    const paid = this.shop.buyRevive(this.world.revives);
    if (!paid.ok) throw new LabError('INSUFFICIENT', paid.reason);
    this.pendingInputs.push('REVIVE');
    return { ok: true, cost };
  }

  /** Termine une partie non enregistrée et crédite les gains. */
  finishRun() {
    if (!this.fsm.is(S.RUNNING, S.PAUSED)) throw new LabError('NOT_PLAYING', 'Aucune partie libre en cours.');
    this.settleWorldEarnings();
    this.clock.stop();
    this.lastRunSummary = this.world ? { ...pickStats(this.world), mode: 'jeu' } : null;
    this.fsm.transition(S.FINISHED, 'fin de partie');
    return this.lastRunSummary;
  }

  /**
   * STOP : finalise, valide et sauvegarde l'enregistrement.
   * En cas d'échec de stockage, la run reste en mémoire (exportable) et le brouillon est conservé.
   * @param {{ name?: string, reason?: string }} [options]
   */
  stopRecording({ name, reason } = {}) {
    if (!this.fsm.is(S.RECORDING, S.RECORDING_PAUSED) || !this.recorder.active || !this.world) {
      throw new LabError('NOT_RECORDING', 'Aucun enregistrement en cours.');
    }
    if (name !== undefined && name !== '' && this.recorder.head) this.recorder.head.name = sanitizeRunName(name);
    const run = this.recorder.stop({
      tick: this.globalTick, realMs: this.realMs(),
      reason: reason ?? (this.world.player.crashed ? 'crash' : 'stop'), stats: pickStats(this.world),
    });
    this.settleWorldEarnings();
    this.clock.stop();
    this.lastRunSummary = { ...pickStats(this.world), mode: 'enregistrement' };
    this.fsm.transition(S.FINISHED, 'STOP');
    return this.persistRun(run);
  }

  /**
   * @param {import('../recorder/RunValidator.js').RunRecord} run
   * @returns {{ ok: true, summary: import('../storage/RunRepository.js').RunSummary, run: import('../recorder/RunValidator.js').RunRecord } | { ok: false, error: string, run: import('../recorder/RunValidator.js').RunRecord }}
   */
  persistRun(run) {
    try {
      const summary = this.repo.save(run);
      if (this.recorder.head?.id === run.id) this.recorder.discardDraft();
      else removeDraft(this.saveManager, run.id);
      this.lastSavedRun = summary;
      this.unsavedRun = null;
      this.notify('success', `Run « ${summary.name} » sauvegardée (${summary.eventCount} événements, intégrité vérifiée).`);
      return { ok: true, summary, run };
    } catch (e) {
      this.unsavedRun = run;
      const message = /** @type {Error} */ (e).message;
      this.logError('SAVE', message);
      return { ok: false, error: message, run };
    }
  }

  retrySaveUnsaved() {
    if (!this.unsavedRun) throw new LabError('NOTHING', 'Aucune run en attente de sauvegarde.');
    return this.persistRun(this.unsavedRun);
  }

  // ───────────────────────────── rejeu ─────────────────────────────

  /** @param {string} id */
  loadReplay(id) {
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) throw new LabError('BUSY', 'Arrêtez le rejeu en cours avant d\'en charger un autre.');
    const { run, warnings } = this.repo.get(id);
    const info = this.replay.load(run);
    this.replayRun = this.replay.run;
    for (const w of warnings) this.notify('warning', w);
    return { ...info, warnings: [...warnings, ...info.warnings] };
  }

  /** @param {string} [id] */
  startReplay(id) {
    if (this.fsm.is(S.RECORDING, S.RECORDING_PAUSED)) throw new LabError('BUSY', 'Impossible de lancer un rejeu pendant un enregistrement.');
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) throw new LabError('BUSY', 'Un rejeu est déjà en cours.');
    if (this.fsm.is(S.RUNNING, S.PAUSED)) throw new LabError('BUSY', 'Terminez la partie en cours avant de lancer un rejeu.');
    if (!this.fsm.can(S.REPLAYING)) throw new LabError('BUSY', 'Rejeu impossible dans cet état.');
    if (id !== undefined && id !== this.replayRun?.id) this.loadReplay(id);
    if (!this.replayRun) throw new LabError('NO_REPLAY', 'Sélectionnez une run à rejouer.');
    const run = this.replayRun;
    this.replay.rewind();
    this.world = new GameWorld({ seed: run.setup.seed, config: run.setup.config, onEvent: this.onWorldEvent });
    this.worldSettled = true; // un rejeu ne crédite jamais de ressources
    const initialHash = this.world.stateHash();
    if (initialHash !== run.setup.initialHash) {
      this.notify('warning', 'État initial différent de celui enregistré : le rejeu va probablement diverger.');
    }
    this.globalTick = 0;
    this.pendingInputs.length = 0;
    this.pendingRestartSeed = null;
    this.followOriginalSpeed = true;
    this.lastReplayReport = null;
    this.clock.setMultiplier(run.setup.initialSpeed);
    this.clock.start();
    this.runner.reset();
    this.shadow.start({
      id: run.id, name: run.name, seed: run.setup.seed, config: run.setup.config,
      initialSpeed: run.setup.initialSpeed, initialHash,
    });
    this.shadow.record('RUN_START', 0, 0, { seed: run.setup.seed, speed: run.setup.initialSpeed, physics: PHYSICS_VERSION });
    this.fsm.transition(S.REPLAYING, `rejeu ${run.id}`);
    if (this.replay.isFinished(0)) this.finishReplay();
    return { id: run.id, endTick: this.replay.endTick };
  }

  /** Arrêt manuel : rapport partiel jusqu'au tick courant, retour à READY. */
  stopReplay() {
    if (!this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) throw new LabError('NOT_REPLAYING', 'Aucun rejeu en cours.');
    if (this.replayRun) {
      this.lastReplayReport = compareRuns(this.replayRun, { events: this.shadow.events }, { untilTick: this.globalTick });
    }
    this.lastReplayStopTick = this.globalTick;
    this.shadow.reset();
    this.clock.stop();
    this.fsm.transition(S.READY, 'arrêt du rejeu');
    return this.lastReplayReport;
  }

  restartReplay() {
    if (!this.replayRun) throw new LabError('NO_REPLAY', 'Aucune run chargée.');
    if (this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED)) this.stopReplay();
    return this.startReplay();
  }

  finishReplay() {
    if (!this.world || !this.replayRun) return;
    const replayed = this.shadow.stop({
      tick: this.globalTick, realMs: this.realMs(), reason: 'replay', stats: pickStats(this.world),
    });
    this.lastReplayReport = compareRuns(this.replayRun, replayed);
    this.lastReplayStopTick = this.globalTick;
    this.clock.stop();
    this.lastRunSummary = { ...pickStats(this.world), mode: 'rejeu' };
    this.fsm.transition(S.FINISHED, 'fin du rejeu');
    this.notify(this.lastReplayReport.exact ? 'success' : 'warning', `Rejeu terminé — ${this.lastReplayReport.verdict}`);
  }

  // ───────────────────────────── boucle ─────────────────────────────

  /**
   * À appeler à chaque image d'affichage.
   * @returns {{ steps: number, alpha: number }}
   */
  frame() {
    const t0 = this.now();
    let steps = 0;
    if (this.clock.running && this.fsm.is(S.RUNNING, S.RECORDING, S.REPLAYING, S.PAUSED, S.RECORDING_PAUSED, S.REPLAY_PAUSED)) {
      const sim = this.clock.tick();
      try {
        steps = this.runner.advance(sim, () => this.step());
      } catch (e) {
        this.handleSimulationError(/** @type {Error} */ (e));
      }
    }
    const dt = this.now() - t0;
    // Moyenne glissante exponentielle : lisse le bruit sans conserver d'historique.
    this.stats.frameMs = this.stats.frameMs === 0 ? dt : this.stats.frameMs * 0.9 + dt * 0.1;
    this.stats.lastFrameSteps = steps;
    return { steps, alpha: this.runner.alpha };
  }

  /**
   * Avance de n pas sans horloge réelle (tests, outils). Ignoré en pause.
   * @param {number} n
   * @returns {number} pas réellement exécutés
   */
  advanceTicks(n) {
    let done = 0;
    try {
      while (done < n && this.fsm.is(S.RUNNING, S.RECORDING, S.REPLAYING)) {
        done++;
        if (this.step() === false) break;
      }
    } catch (e) {
      this.handleSimulationError(/** @type {Error} */ (e));
    }
    return done;
  }

  /** @returns {boolean} false si la boucle doit s'arrêter */
  step() {
    const world = /** @type {GameWorld} */ (this.world);
    const tick = this.globalTick;
    const replaying = this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED);
    if (replaying) {
      const speed = this.replay.takeSpeedAt(tick);
      if (speed !== null && this.followOriginalSpeed) this.clock.setMultiplier(speed);
      for (const e of this.replay.takeActionsAt(tick, this.actionBuffer)) this.applyAction(e[3], e[4]);
    } else {
      if (this.autopilot) this.autopilotStep(world);
      if (this.pendingRestartSeed !== null) {
        const seed = this.pendingRestartSeed;
        this.pendingRestartSeed = null;
        this.applyAction('RESTART', { seed });
      }
      for (let i = 0; i < this.pendingInputs.length; i++) this.applyAction(this.pendingInputs[i], {});
      this.pendingInputs.length = 0;
    }
    world.step();
    if ((tick + 1) % CHECKPOINT_INTERVAL === 0) {
      const cp = world.checkpoint();
      this.recordEvent('CHECKPOINT', cp);
      if (replaying) {
        const div = this.replay.checkCheckpoint(tick, cp);
        if (div && this.replay.divergenceCount === 1) this.notify('warning', `Divergence de rejeu au tick ${div.tick} : ${div.detail}`);
      }
    }
    this.globalTick++;
    this.stats.totalSteps++;
    if (replaying && this.replay.isFinished(this.globalTick)) {
      this.finishReplay();
      return false;
    }
    return true;
  }

  /** @param {GameWorld} world */
  autopilotStep(world) {
    if (world.player.crashed) {
      if (!this.pendingInputs.includes('REVIVE')) {
        try {
          this.revive();
        } catch (e) {
          this.autopilot = false;
          this.notify('warning', `Pilote automatique arrêté : ${/** @type {Error} */ (e).message}`);
        }
      }
      return;
    }
    const a = decideAction(world);
    if (a && this.pendingInputs.length < MAX_PENDING_INPUTS) this.pendingInputs.push(a);
  }

  /**
   * L'action est enregistrée AVANT d'être appliquée : elle précède ainsi ses conséquences.
   * @param {string} type
   * @param {Record<string, unknown>} payload
   */
  applyAction(type, payload) {
    const world = /** @type {GameWorld} */ (this.world);
    this.recordEvent(type, payload);
    if (type === 'RESTART') {
      this.settleWorldEarnings();
      world.reset(/** @type {number} */ (payload.seed));
      this.worldSettled = this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED);
      return;
    }
    world.applyAction(type);
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} payload
   */
  onWorldEvent(type, payload) {
    this.recordEvent(type, payload);
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} payload
   */
  recordEvent(type, payload) {
    if (this.recorder.active) this.recorder.record(type, this.globalTick, this.realMs(), payload);
    else if (this.shadow.active) this.shadow.record(type, this.globalTick, this.realMs(), payload);
  }

  /** @param {Error} e */
  handleSimulationError(e) {
    const message = `Erreur de simulation : ${e.message}`;
    this.logError('SIMULATION', message);
    try {
      if (this.recorder.active) {
        this.recorder.record('SIM_ERROR', this.globalTick, this.realMs(), { msg: e.message.slice(0, 200) });
        this.stopRecording({ reason: 'error' });
      }
    } catch (inner) {
      this.logError('SIMULATION', `Sauvegarde de secours impossible : ${/** @type {Error} */ (inner).message}`);
    }
    if (this.shadow.active) this.shadow.reset();
    this.clock.stop();
    this.fsm.fail(message);
  }

  settleWorldEarnings() {
    if (this.worldSettled || !this.world) return;
    this.worldSettled = true;
    try {
      this.resources.earn({ coins: this.world.coinsRun, keys: this.world.keysRun });
    } catch (e) {
      this.logError('SAVE', /** @type {Error} */ (e).message);
    }
  }

  // ───────────────────────────── utilitaires ─────────────────────────────

  realMs() {
    return Math.round(this.clock.realElapsed * 1000);
  }

  /**
   * @param {string} code
   * @param {string} message
   */
  logError(code, message) {
    this.errors.push({ at: Date.now(), code, message });
    if (this.errors.length > ERROR_LOG_LIMIT) this.errors.shift();
    this.notify('error', message);
  }

  /**
   * @param {Notice['level']} level
   * @param {string} message
   */
  notify(level, message) {
    this.notices.push({ level, message, at: Date.now() });
    if (this.notices.length > NOTICE_LIMIT) this.notices.shift();
  }

  /** @returns {Notice[]} notifications non encore affichées */
  drainNotices() {
    return this.notices.splice(0, this.notices.length);
  }

  capabilities() {
    const f = this.fsm;
    const crashed = !!this.world?.player.crashed;
    return {
      play: f.can(S.RUNNING) && !f.is(S.REPLAYING, S.REPLAY_PAUSED),
      record: f.can(S.RECORDING),
      stopRecording: f.is(S.RECORDING, S.RECORDING_PAUSED),
      pause: f.is(S.RUNNING, S.RECORDING, S.REPLAYING),
      resume: f.is(S.PAUSED, S.RECORDING_PAUSED, S.REPLAY_PAUSED),
      finish: f.is(S.RUNNING, S.PAUSED),
      restart: !f.is(S.REPLAYING, S.REPLAY_PAUSED, S.INITIALIZING, S.ERROR),
      revive: f.is(S.RUNNING, S.RECORDING) && crashed,
      replay: f.can(S.REPLAYING) && this.replayRun !== null,
      loadReplay: !f.is(S.REPLAYING, S.REPLAY_PAUSED),
      stopReplay: f.is(S.REPLAYING, S.REPLAY_PAUSED),
      restartReplay: this.replayRun !== null && (f.is(S.REPLAYING, S.REPLAY_PAUSED) || f.can(S.REPLAYING)),
      recover: f.is(S.ERROR),
      input: f.is(S.RUNNING, S.RECORDING),
    };
  }

  snapshot() {
    const w = this.world;
    const replaying = this.fsm.is(S.REPLAYING, S.REPLAY_PAUSED);
    return {
      state: this.fsm.state,
      stateLabel: LABELS[/** @type {keyof typeof LABELS} */ (this.fsm.state)],
      caps: this.capabilities(),
      clock: this.clock.snapshot(),
      tick: this.globalTick,
      simTime: this.globalTick / TICK_RATE,
      world: w ? w.summary() : null,
      reviveCost: w ? reviveCost(w.revives) : null,
      recording: {
        active: this.recorder.active,
        name: this.recorder.head?.name ?? null,
        eventCount: this.recorder.eventCount,
        pending: this.recorder.pendingCount,
        durationMs: this.recorder.active ? this.realMs() : 0,
        draftError: this.recorder.draftError,
        lastSaved: this.lastSavedRun,
        unsaved: this.unsavedRun ? { id: this.unsavedRun.id, name: this.unsavedRun.name } : null,
      },
      replay: {
        loaded: this.replayRun ? { id: this.replayRun.id, name: this.replayRun.name } : null,
        active: replaying,
        progress: replaying ? this.replay.progress(this.globalTick) : this.lastReplayReport && !this.lastReplayReport.partial ? 1 : 0,
        currentS: (replaying ? this.globalTick : this.lastReplayStopTick) / TICK_RATE,
        totalS: this.replay.endTick / TICK_RATE,
        followOriginalSpeed: this.followOriginalSpeed,
        divergences: this.replay.divergenceCount,
        lastDivergence: this.replay.lastDivergence,
        report: this.lastReplayReport,
      },
      resources: this.resources.snapshot(),
      autopilot: this.autopilot,
      lastRun: this.lastRunSummary,
      diagnostics: {
        frameMs: this.stats.frameMs,
        lastFrameSteps: this.stats.lastFrameSteps,
        totalSteps: this.stats.totalSteps,
        droppedSteps: this.runner.droppedSteps,
        ignoredInputs: this.stats.ignoredInputs,
        rejectedInputs: this.stats.rejectedInputs,
        saveError: this.saveManager.lastError?.message ?? null,
        lastWriteAt: this.saveManager.lastWriteAt,
        writeCount: this.saveManager.writeCount,
        errors: this.errors.slice(-5),
        transitions: this.fsm.history.slice(-8),
      },
    };
  }
}

/** @param {GameWorld} w */
function pickStats(w) {
  return { score: w.score, distance: w.distance, coins: w.coinsRun, keys: w.keysRun };
}

function defaultRunName() {
  const d = new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `Run du ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
