'use server';
// trajectory.ts — the FI net-worth trajectory Server Action (07-04 Task 3; SC-2 / D-07 hero chart). A
// THIN validate→call-once→map wrapper holding ZERO trajectory logic (RESEARCH Pattern 1/2/3, the
// scenarios.ts precedent): it validates the untrusted household/assumptions/scenario through the core Zod
// boundary (D-16), calls `fiTrajectory` EXACTLY ONCE (the month-by-month series 07-02 surfaced), and maps
// the result to a plain DTO whose dollars cross as decimal STRINGS for the single chart-edge float
// conversion. There is NO net-worth loop here — the series is a core output (Don't-Hand-Roll).
import {
  parseHousehold,
  parseAssumptionSet,
  parseScenarioInputs,
  engineInput,
  calendarDate,
  migrate,
  fiTrajectory,
  type EngineInput,
} from '@house/core';
import { toTrajectoryDTO, type TrajectoryDTO } from '@/lib/dto/trajectory';

/** The raw trajectory payload — a household + assumptions + one priced scenario to project. */
interface TrajectoryRaw {
  readonly asOf: string;
  readonly household: unknown;
  readonly assumptions: unknown;
  readonly scenario: unknown;
}

/**
 * Build a frozen `EngineInput` from raw client input, validating EVERY leaf through the core Zod
 * boundary (D-16): `parseAssumptionSet` (+ `migrate`), `parseHousehold`, `parseScenarioInputs`, then
 * `engineInput` (which re-validates + freezes). Throws a `ZodError` on any malformed leaf BEFORE the
 * engine runs (Server Actions are public POST endpoints — RESEARCH Pitfall 7 / T-7-01).
 */
function buildEngineInput(
  asOf: string,
  assumptions: unknown,
  scenarioRaw: unknown,
  householdRaw: unknown,
): EngineInput {
  const current = migrate(parseAssumptionSet(assumptions));
  const household = parseHousehold(householdRaw);
  const scenario = parseScenarioInputs(scenarioRaw);
  return engineInput({ asOf: calendarDate(asOf), assumptions: current, scenario, household });
}

/**
 * Project the month-by-month net-worth trajectory for the D-07 cockpit chart (SC-2): validate the
 * payload, call `fiTrajectory` ONCE, and return the serializable `TrajectoryDTO` (net worth + threshold
 * as decimal strings; the two FI-crossover markers as `number | null`). No trajectory math here.
 */
export async function fiTrajectoryAction(raw: TrajectoryRaw): Promise<TrajectoryDTO> {
  const input = buildEngineInput(raw.asOf, raw.assumptions, raw.scenario, raw.household);
  return toTrajectoryDTO(fiTrajectory(input));
}
