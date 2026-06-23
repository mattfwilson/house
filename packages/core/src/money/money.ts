// Money — immutable, decimal-precise dollar amount with a CLOSED API (D-01, D-03, CORE-02).
//
// The whole point is enforcement: a Money that can be bypassed is worthless. So:
//   - The constructor is private and the type is BRANDED (a unique symbol) → outside
//     code can neither `new Money(...)` nor duck-type a structurally-identical object.
//   - The only entry points are `Money.of(decimalString)` and `Money.zero()` — there is
//     NO number-accepting dollar factory. Dollar amounts cross the boundary as strings.
//   - Arithmetic (`add`/`sub`) takes a `Money`; `mul`/`percentOf` take a DIMENSIONLESS
//     rate STRING (never a number, never another Money).
//   - Full precision is retained through ALL intermediate math; rounding to cents happens
//     ONLY at `toCents()` (the single output boundary), using the clone's banker's rounding.
//   - There is intentionally NO `valueOf`/`toJSON` returning a number — adding one would
//     re-open the bare-number hole (`money * 1.05` would silently coerce to a float).
import { Dec, type DecimalInstance } from './decimal-config.js';

declare const MoneyBrand: unique symbol;

export class Money {
  // Nominal brand: makes a plain object non-assignable to Money. `declare` keeps it
  // type-only (no runtime field), so it never appears on instances or in JSON.
  declare private readonly [MoneyBrand]: void;

  private constructor(private readonly v: DecimalInstance) {}

  /** Construct from a canonical decimal STRING (never a bare JS number — CORE-02). */
  static of(decimalString: string): Money {
    return new Money(new Dec(decimalString));
  }

  /** The additive identity, $0. */
  static zero(): Money {
    return new Money(new Dec(0));
  }

  /** Sum of two amounts (immutable; full precision retained). */
  add(other: Money): Money {
    return new Money(this.v.plus(other.v));
  }

  /** Difference of two amounts (immutable; full precision retained). */
  sub(other: Money): Money {
    return new Money(this.v.minus(other.v));
  }

  /** Multiply by a DIMENSIONLESS rate string (e.g. '1.05'); full precision retained. */
  mul(rate: string): Money {
    return new Money(this.v.times(new Dec(rate)));
  }

  /** Take a fraction of this amount, expressed as a rate string (e.g. '0.035'). */
  percentOf(rate: string): Money {
    return this.mul(rate);
  }

  /**
   * THE ONLY rounding boundary (D-03): round to whole cents using the clone's
   * banker's rounding (HALF_EVEN), and return an exact integer `bigint` of cents.
   */
  toCents(): bigint {
    return BigInt(this.v.times(100).toDecimalPlaces(0).toFixed(0));
  }

  /** Full-precision canonical string (for canonical JSON / snapshots — D-06/D-10). */
  toDecimalString(): string {
    return this.v.toFixed();
  }

  /** 2-decimal-place DISPLAY string (banker's rounding). Display only — never for math. */
  toString(): string {
    return this.v.toDecimalPlaces(2).toFixed(2);
  }
}
