// Clock abstraction for time-dependent logic in SourceAdapterBase.
//
// Real polling uses SystemClock (Date.now() + setTimeout). Tests use
// FakeClock to step time deterministically and skip the wall-clock
// waits that would otherwise make rate-limit and backoff tests slow.

/**
 * Anything time-dependent in the source adapter base class reads from
 * a Clock. Default production wiring is SystemClock; tests inject
 * FakeClock.
 */
export interface Clock {
  /** Wall-clock UTC milliseconds since epoch. */
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * Deterministic clock for tests. Starts at the constructor-supplied
 * epoch and only advances when advance() is called.
 */
export class FakeClock implements Clock {
  private current: number;

  constructor(initial: number | Date = new Date("2026-05-27T00:00:00Z")) {
    this.current = typeof initial === "number" ? initial : initial.getTime();
  }

  now(): number {
    return this.current;
  }

  /** Advance time forward by the given number of milliseconds. */
  advance(ms: number): void {
    if (ms < 0) {
      throw new Error(`FakeClock.advance(${ms}): cannot move backwards`);
    }
    this.current += ms;
  }

  /** Set to a specific instant (useful for "jump to 25h later" assertions). */
  set(at: number | Date): void {
    this.current = typeof at === "number" ? at : at.getTime();
  }
}
