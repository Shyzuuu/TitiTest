/**
 * Erreurs typées du laboratoire. Chaque erreur porte un `code` stable
 * (exploitable par l'UI et les tests) et un message français lisible.
 */

export class LabError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LabError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends LabError {
  /**
   * @param {string} message
   * @param {string[]} [errors]
   */
  constructor(message, errors = []) {
    super('VALIDATION', message, { errors });
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class StorageError extends LabError {
  /**
   * @param {'QUOTA'|'WRITE_FAILED'|'READ_FAILED'|'CORRUPT'|'UNAVAILABLE'|'VERIFY_FAILED'} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'StorageError';
  }
}

export class InvalidTransitionError extends LabError {
  /**
   * @param {string} from
   * @param {string} to
   */
  constructor(from, to) {
    super('INVALID_TRANSITION', `Transition interdite : ${from} → ${to}.`, { from, to });
    this.name = 'InvalidTransitionError';
  }
}
