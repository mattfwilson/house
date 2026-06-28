// dto/trajectory.ts — the FI-trajectory DTO mapper (07-04 Task 1; SC-2 / D-07 hero chart). This is a
// `Money`→string boundary like `dto/scenario.ts`: every dollar on `FiTrajectoryResult` (each point's
// `buyNetWorth`/`rentNetWorth` and the `fiThreshold` line) crosses as a canonical decimal STRING via
// `Money.toDecimalString()`. The single lossy float conversion is DEFERRED to the chart edge
// (`components/charts/**`, RESEARCH Pitfall 5, eslint-confined) — it is FORBIDDEN here, so a `Money`
// never becomes a float on the server. The FI-month markers are already `number | null` (the anti-funnel
// "never reached" verdict stays null — no sentinel), so they pass through unchanged. No math lives here.
import type { FiTrajectoryResult } from '@house/core';

/** One sampled trajectory point: the hold month + both paths' comparison net worth as decimal STRINGS. */
export interface TrajectoryPointDTO {
  readonly month: number;
  readonly buyNetWorth: string;
  readonly rentNetWorth: string;
}

/**
 * The FI-trajectory DTO (D-07): the year-sampled series, the FI-threshold line as a decimal STRING, and
 * the two exact FI crossover markers as `number | null` (null = the path never reached within horizon).
 */
export interface TrajectoryDTO {
  readonly points: readonly TrajectoryPointDTO[];
  readonly fiThreshold: string;
  readonly buyFiMonth: number | null;
  readonly rentFiMonth: number | null;
}

/**
 * Map the core `FiTrajectoryResult` to its serializable `TrajectoryDTO`. Each `Money` dollar becomes a
 * canonical decimal string via `.toDecimalString()` (NEVER a float cast — that single conversion
 * belongs to the chart component). The crossover markers pass through as `number | null`.
 */
export function toTrajectoryDTO(result: FiTrajectoryResult): TrajectoryDTO {
  return {
    points: result.points.map((point) => ({
      month: point.month,
      buyNetWorth: point.buyNetWorth.toDecimalString(),
      rentNetWorth: point.rentNetWorth.toDecimalString(),
    })),
    fiThreshold: result.fiThreshold.toDecimalString(),
    buyFiMonth: result.buyFiMonth,
    rentFiMonth: result.rentFiMonth,
  };
}
