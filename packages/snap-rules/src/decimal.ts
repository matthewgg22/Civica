// Minimal decimal wrapper. SNAP math rounds to whole dollars at specific
// steps (round half AWAY from zero, matching Python's ROUND_HALF_UP and
// Swift's NSDecimalRound .plain on positive values).
//
// Why a custom class instead of bignum: portability + zero deps. Values
// in SNAP math don't exceed 5 significant digits, so the JS number type
// is sufficient ONCE we round at the documented steps. This wrapper makes
// the round-discipline explicit at call sites.

export class Decimal {
  private readonly v: number;

  constructor(value: number | string) {
    this.v = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(this.v)) {
      throw new Error(`Decimal initialized from non-finite value: ${value}`);
    }
  }

  toNumber(): number { return this.v; }
  toString(): string { return String(this.v); }

  add(other: Decimal | number): Decimal {
    const x = other instanceof Decimal ? other.v : other;
    return new Decimal(this.v + x);
  }
  sub(other: Decimal | number): Decimal {
    const x = other instanceof Decimal ? other.v : other;
    return new Decimal(this.v - x);
  }
  mul(other: Decimal | number): Decimal {
    const x = other instanceof Decimal ? other.v : other;
    return new Decimal(this.v * x);
  }
  div(other: Decimal | number): Decimal {
    const x = other instanceof Decimal ? other.v : other;
    if (x === 0) throw new Error("Decimal division by zero");
    return new Decimal(this.v / x);
  }

  gt(other: Decimal | number): boolean {
    return this.v > (other instanceof Decimal ? other.v : other);
  }
  gte(other: Decimal | number): boolean {
    return this.v >= (other instanceof Decimal ? other.v : other);
  }
  lt(other: Decimal | number): boolean {
    return this.v < (other instanceof Decimal ? other.v : other);
  }
  lte(other: Decimal | number): boolean {
    return this.v <= (other instanceof Decimal ? other.v : other);
  }
  eq(other: Decimal | number): boolean {
    return this.v === (other instanceof Decimal ? other.v : other);
  }

  /** Larger of this and other. */
  max(other: Decimal | number): Decimal {
    const x = other instanceof Decimal ? other.v : other;
    return new Decimal(Math.max(this.v, x));
  }
  /** Smaller of this and other. */
  min(other: Decimal | number): Decimal {
    const x = other instanceof Decimal ? other.v : other;
    return new Decimal(Math.min(this.v, x));
  }

  /** Round to whole dollars, half away from zero (matches Python ROUND_HALF_UP). */
  roundDollar(): Decimal {
    const sign = this.v < 0 ? -1 : 1;
    return new Decimal(sign * Math.round(Math.abs(this.v)));
  }
}

export function dec(value: number | string): Decimal {
  return new Decimal(value);
}

export const ZERO = new Decimal(0);
