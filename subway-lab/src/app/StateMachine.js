/**
 * Machine à états explicite de l'application. Toute transition est validée
 * contre la table ci-dessous et journalisée ; une transition non prévue lève
 * InvalidTransitionError au lieu de laisser l'interface dans un état ambigu.
 */

import { InvalidTransitionError } from '../core/errors.js';

export const States = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  RECORDING: 'RECORDING',
  RECORDING_PAUSED: 'RECORDING_PAUSED',
  REPLAYING: 'REPLAYING',
  REPLAY_PAUSED: 'REPLAY_PAUSED',
  FINISHED: 'FINISHED',
  ERROR: 'ERROR',
});

/** @type {Readonly<Record<string, readonly string[]>>} */
export const TRANSITIONS = Object.freeze({
  INITIALIZING: ['READY', 'ERROR'],
  READY: ['RUNNING', 'RECORDING', 'REPLAYING', 'ERROR'],
  RUNNING: ['PAUSED', 'FINISHED', 'ERROR'],
  PAUSED: ['RUNNING', 'FINISHED', 'ERROR'],
  RECORDING: ['RECORDING_PAUSED', 'FINISHED', 'ERROR'],
  RECORDING_PAUSED: ['RECORDING', 'FINISHED', 'ERROR'],
  REPLAYING: ['REPLAY_PAUSED', 'FINISHED', 'READY', 'ERROR'],
  REPLAY_PAUSED: ['REPLAYING', 'FINISHED', 'READY', 'ERROR'],
  FINISHED: ['READY', 'RUNNING', 'RECORDING', 'REPLAYING', 'ERROR'],
  ERROR: ['READY'],
});

export const LABELS = Object.freeze({
  INITIALIZING: 'Initialisation',
  READY: 'Prêt',
  RUNNING: 'En jeu',
  PAUSED: 'En pause',
  RECORDING: 'Enregistrement',
  RECORDING_PAUSED: 'Enregistrement en pause',
  REPLAYING: 'Rejeu',
  REPLAY_PAUSED: 'Rejeu en pause',
  FINISHED: 'Terminé',
  ERROR: 'Erreur',
});

const HISTORY_LIMIT = 200;

export class StateMachine {
  /** @param {{ now?: () => number }} [options] */
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    /** @type {string} */
    this.state = States.INITIALIZING;
    /** @type {{ from: string, to: string, reason: string, at: number }[]} */
    this.history = [];
    /** @type {Set<(to: string, from: string, reason: string) => void>} */
    this.listeners = new Set();
  }

  /** @param {string} to */
  can(to) {
    return TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  /** @param {...string} states */
  is(...states) {
    return states.includes(this.state);
  }

  /**
   * @param {string} to
   * @param {string} [reason]
   */
  transition(to, reason = '') {
    if (!this.can(to)) throw new InvalidTransitionError(this.state, to);
    const from = this.state;
    this.state = to;
    this.history.push({ from, to, reason, at: this.now() });
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, this.history.length - HISTORY_LIMIT);
    for (const fn of this.listeners) fn(to, from, reason);
  }

  /**
   * Bascule d'urgence vers ERROR, autorisée depuis tout état sauf ERROR lui-même.
   * @param {string} reason
   */
  fail(reason) {
    if (this.state === States.ERROR) return;
    if (this.state === States.INITIALIZING || this.can(States.ERROR)) this.transition(States.ERROR, reason);
  }

  /** @param {(to: string, from: string, reason: string) => void} fn */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
