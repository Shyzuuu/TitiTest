/**
 * Convertit un temps de simulation continu en pas fixes entiers.
 * Le résultat de la simulation dépend uniquement du nombre de pas exécutés,
 * jamais de la cadence d'affichage ni du multiplicateur.
 */

export const TICK_RATE = 60;
export const STEP = 1 / TICK_RATE;

export class FixedStepRunner {
  /**
   * @param {{ step?: number, maxStepsPerFrame?: number }} [options]
   */
  constructor({ step = STEP, maxStepsPerFrame = 8 } = {}) {
    this.step = step;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.accumulator = 0;
    this.droppedSteps = 0;
  }

  reset() {
    this.accumulator = 0;
  }

  /**
   * @param {number} simDelta
   * @param {() => boolean | void} stepFn renvoie `false` pour interrompre la boucle (fin de rejeu, erreur)
   * @returns {number} nombre de pas exécutés
   */
  advance(simDelta, stepFn) {
    if (simDelta > 0) this.accumulator += simDelta;
    let n = 0;
    while (this.accumulator >= this.step && n < this.maxStepsPerFrame) {
      this.accumulator -= this.step;
      n++;
      if (stepFn() === false) {
        this.accumulator = 0;
        return n;
      }
    }
    if (this.accumulator >= this.step) {
      // Machine trop lente : on abandonne le retard plutôt que de s'enfoncer (spirale de la mort).
      const lost = Math.floor(this.accumulator / this.step);
      this.droppedSteps += lost;
      this.accumulator -= lost * this.step;
    }
    return n;
  }

  /** Fraction du pas suivant déjà écoulée, pour l'interpolation du rendu. */
  get alpha() {
    return Math.min(1, Math.max(0, this.accumulator / this.step));
  }
}
