// dto/sensitivity.ts — the tornado DTO mapper (07-04 Task 1; ASMP-02 / FI-05). `TornadoResult` is
// already plain-serializable — it carries NO `Money` (every dollar comparison happened inside the core
// `Dec` clone; the rows expose only the discriminated `FiOutcome`s, the plain driver names, and a
// FINITE `swingMonths`). This mapper therefore adds no conversion; it exists to GUARANTEE the contract
// at the server→client boundary (RESEARCH Pattern 3):
//   1. Every `swingMonths` is asserted FINITE here (FI-05 / L3) — an `Infinity` would JSON.stringify to
//      `null` where a number is expected, silently corrupting the tornado. The core never produces one
//      (an unreached endpoint contributes its `cappedAtMonth` bound), so this guard never trips on valid
//      input; it is a boundary tripwire, not arithmetic.
//   2. Each discriminated `FiOutcome` is reconstructed into a fresh PLAIN object, so no method-bearing
//      instance can ride along even if the core shape evolves.
// NO financial logic lives here — `swingMonths`, the ranking, and `topDrivers` are all core outputs.
import type { TornadoResult, TornadoRow, TornadoDriver, FiOutcome } from '@house/core';

/**
 * The discriminated FI outcome the tornado surfaces, reconstructed as a plain object. `reached` carries
 * the 1-based `month` + `years` (a decimal STRING); `unreached` carries the horizon `cappedAtMonth`. No
 * numeric sentinel is invented (L3) — the union stays discriminated on `kind`.
 */
export type FiOutcomeDTO =
  | { readonly kind: 'reached'; readonly month: number; readonly years: string }
  | { readonly kind: 'unreached'; readonly cappedAtMonth: number };

/** One tornado row DTO: the driver name, its low/base/high FI outcomes, and the FINITE month swing. */
export interface TornadoRowDTO {
  readonly driver: TornadoDriver;
  readonly low: FiOutcomeDTO;
  readonly base: FiOutcomeDTO;
  readonly high: FiOutcomeDTO;
  readonly swingMonths: number;
}

/** The tornado DTO — the ranked rows (DESC by swing) + the top-3 driver names, all RSC-serializable. */
export interface TornadoDTO {
  readonly rows: readonly TornadoRowDTO[];
  readonly topDrivers: readonly TornadoDriver[];
}

/** Reconstruct a discriminated `FiOutcome` into a fresh plain object (no class instance can ride along). */
function mapOutcome(outcome: FiOutcome): FiOutcomeDTO {
  return outcome.kind === 'reached'
    ? { kind: 'reached', month: outcome.month, years: outcome.years }
    : { kind: 'unreached', cappedAtMonth: outcome.cappedAtMonth };
}

/**
 * Assert `swingMonths` is finite at the boundary (FI-05 / L3). The core never emits a non-finite swing
 * (an unreached endpoint contributes its `cappedAtMonth`), so this never trips on valid input — it is a
 * tripwire that fails LOUD rather than letting an `Infinity` serialize to a silent `null`.
 */
function finiteSwing(swingMonths: number): number {
  if (!Number.isFinite(swingMonths)) {
    throw new Error(`tornado swingMonths must be finite (FI-05), got: ${String(swingMonths)}`);
  }
  return swingMonths;
}

/** Map one core `TornadoRow` to its DTO — plain outcomes + a finiteness-checked swing. */
function mapRow(row: TornadoRow): TornadoRowDTO {
  return {
    driver: row.driver,
    low: mapOutcome(row.low),
    base: mapOutcome(row.base),
    high: mapOutcome(row.high),
    swingMonths: finiteSwing(row.swingMonths),
  };
}

/**
 * Map the core `TornadoResult` to its serializable `TornadoDTO`, PRESERVING the core ranking (rows are
 * already sorted DESC by swing; `topDrivers` is the core's top-3). No `Money`, no math, no re-ranking —
 * the mapper only guarantees finiteness and plain objects cross the boundary.
 */
export function toTornadoDTO(result: TornadoResult): TornadoDTO {
  return {
    rows: result.rows.map(mapRow),
    topDrivers: [...result.topDrivers],
  };
}
