export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Horloge pilotable pour les tests : le temps n'avance que sur demande. */
export class ManualClock implements Clock {
  constructor(private current = Date.UTC(2026, 0, 15, 14, 0, 0)) {}
  now(): number {
    return this.current;
  }
  set(ms: number): void {
    this.current = ms;
  }
  advance(ms: number): number {
    this.current += ms;
    return this.current;
  }
}
