'use server';
// sensitivity.ts — the FI-tornado Server Action (07-04 Task 3; ASMP-02 / SC-3, the "no headline number
// without a range" instrument). A THIN validate→call-once→map wrapper holding ZERO sensitivity logic
// (RESEARCH Pattern 1/2/3, the scenarios.ts precedent): it validates the untrusted household/assumptions/
// scenario through the core Zod boundary (D-16 — `engineInput` re-validates and freezes), calls
// `tornado` EXACTLY ONCE, and maps the result to a plain DTO. There is NO driver-perturbation loop here —
// the core runs `fiImpact` ~12× internally; the web layer never re-derives a swing (Don't-Hand-Roll).
import {
  parseHousehold,
  parseAssumptionSet,
  parseScenarioInputs,
  engineInput,
  calendarDate,
  migrate,
  tornado,
  type EngineInput,
} from '@house/core';
import { toTornadoDTO, type TornadoDTO } from '@/lib/dto/sensitivity';

/** The raw tornado payload — a household + assumptions + one priced scenario to sweep. */
interface TornadoRaw {
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
 * Run the one-way FI tornado for a scenario (ASMP-02 / SC-3): validate the payload, call `tornado` ONCE,
 * and return the serializable `TornadoDTO` (finite swings, no `Infinity` — FI-05). No swing math here.
 */
export async function tornadoAction(raw: TornadoRaw): Promise<TornadoDTO> {
  const input = buildEngineInput(raw.asOf, raw.assumptions, raw.scenario, raw.household);
  return toTornadoDTO(tornado(input));
}
