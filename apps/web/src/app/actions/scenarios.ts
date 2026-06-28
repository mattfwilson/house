'use server';
// scenarios.ts — the scenario Server Actions. Each is a THIN validate→call-once→map wrapper holding
// ZERO financial logic (RESEARCH Pattern 1/2/3, the scenario-service.ts precedent). The shape is
// always the same three steps:
//   1. VALIDATE raw client input THROUGH the existing core Zod schemas (D-16) — `parseHousehold`,
//      `parseAssumptionSet`, `parseScenarioInputs` (also re-applied inside `engineInput`). A forged
//      payload is rejected at the boundary BEFORE any engine runs (Server Actions are public POST
//      endpoints — RESEARCH Pitfall 7). Field errors surface from the Zod parse result.
//   2. CALL exactly ONE `@house/core` entry point (`compareScenarios` / `evaluateScenario` /
//      `affordabilityGap`) or ONE `@house/app` service (`computeAndSaveScenario` / `loadScenario` /
//      `listScenarios` / `deleteScenario`). No math, no ranking, no gap arithmetic lives here.
//   3. MAP every `Money`/`Decimal` field to a string via a `lib/dto/*` mapper before returning a
//      plain serializable object — a class instance cannot cross the React server→client boundary.
import {
  parseHousehold,
  parseAssumptionSet,
  parseScenarioInputs,
  engineInput,
  calendarDate,
  migrate,
  compareScenarios,
  evaluateScenario,
  affordabilityGap,
  type EngineInput,
  type SavedScenario,
  type SavedScenarioMeta,
} from '@house/core';
import {
  computeAndSaveScenario,
  loadScenario,
  listScenarios,
  deleteScenario,
  type Container,
} from '@house/app';
import {
  toCompareDTO,
  toEvaluateDTO,
  toGapDTO,
  type CompareDTO,
  type EvaluateDTO,
  type GapDTO,
} from '@/lib/dto/scenario';

/** The raw recompare payload — a household + assumptions + a keep-renting baseline + N buy scenarios. */
interface RecompareRaw {
  readonly asOf: string;
  readonly household: unknown;
  readonly assumptions: unknown;
  readonly baseline: unknown;
  readonly scenarios: readonly unknown[];
}

/** The raw single-scenario payload (evaluate / gap) — a household + assumptions + one scenario. */
interface SingleScenarioRaw {
  readonly asOf: string;
  readonly household: unknown;
  readonly assumptions: unknown;
  readonly scenario: unknown;
}

/** The raw save payload — identity + the snapshot ingredients to freeze. */
interface SaveScenarioRaw {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly asOf: string;
  readonly household: unknown;
  readonly assumptions: unknown;
  readonly scenario: unknown;
}

/** The plain saved-scenario DTO — the frozen `EngineInput` snapshot carries no `Money` (all strings). */
export interface SavedScenarioDTO {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly input: EngineInput;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Resolve the container: the injected one in tests (`:memory:`), else the real server-only singleton
 * via a LAZY import — so importing this module never eagerly pulls `server-only` into a non-RSC env
 * (e.g. a Vitest worker), and the test path never constructs the file-backed singleton.
 */
async function resolveContainer(injected?: Container): Promise<Container> {
  if (injected) return injected;
  const mod = await import('@/lib/container.server');
  return mod.container();
}

/**
 * Build a frozen `EngineInput` from raw client input, validating EVERY leaf through the core Zod
 * boundary (D-16): `parseAssumptionSet` (+ `migrate` to the current version), `parseHousehold`,
 * `parseScenarioInputs`, then `engineInput` (which re-validates scenario + household and freezes).
 * Throws a `ZodError` on any malformed leaf BEFORE the engine is ever reached.
 */
function buildEngineInput(asOf: string, assumptions: unknown, scenarioRaw: unknown, householdRaw: unknown): EngineInput {
  const current = migrate(parseAssumptionSet(assumptions));
  const household = parseHousehold(householdRaw);
  const scenario = parseScenarioInputs(scenarioRaw);
  return engineInput({ asOf: calendarDate(asOf), assumptions: current, scenario, household });
}

/** Map a persisted `SavedScenario` to its plain DTO (the embedded snapshot is already string-only). */
function toSavedScenarioDTO(saved: SavedScenario): SavedScenarioDTO {
  return {
    id: saved.id,
    profileId: saved.profileId,
    name: saved.name,
    input: saved.input,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}

/**
 * Recompute the ranked comparison (SC-2): parse the household/assumptions + the baseline and each buy
 * scenario through the core Zod schemas, build the `EngineInput`s, call `compareScenarios` ONCE, and
 * return the serializable, ranking-preserving `CompareDTO`. No ranking logic lives here.
 */
export async function recompareAction(raw: RecompareRaw): Promise<CompareDTO> {
  const baselineInput = buildEngineInput(raw.asOf, raw.assumptions, raw.baseline, raw.household);
  const inputs = raw.scenarios.map((scenario) =>
    buildEngineInput(raw.asOf, raw.assumptions, scenario, raw.household),
  );
  return toCompareDTO(compareScenarios(baselineInput, inputs));
}

/**
 * Evaluate one already-priced scenario for the household (D-06): validate, call `evaluateScenario`
 * ONCE, return the plain report DTO (ratios/pass-flags/headroom — already string/boolean).
 */
export async function evaluateAction(raw: SingleScenarioRaw): Promise<EvaluateDTO> {
  const input = buildEngineInput(raw.asOf, raw.assumptions, raw.scenario, raw.household);
  return toEvaluateDTO(evaluateScenario(input));
}

/**
 * Compute the bank-vs-true GAP (SC-4): validate, call `affordabilityGap` ONCE, return the `GapDTO`
 * (the two ceilings + signed gap as strings + the directional verdict enum). No gap arithmetic here.
 */
export async function gapAction(raw: SingleScenarioRaw): Promise<GapDTO> {
  const input = buildEngineInput(raw.asOf, raw.assumptions, raw.scenario, raw.household);
  return toGapDTO(affordabilityGap(input));
}

/**
 * Freeze the working set into a reproducible snapshot and persist it (D-09 / PROF-04). `engineInput`
 * freezes the validated snapshot; `computeAndSaveScenario` recomputes it once (proving it replays)
 * and stores it. The action does NOT mutate the snapshot in place. Returns the saved DTO.
 */
export async function computeAndSaveScenarioAction(
  raw: SaveScenarioRaw,
  injected?: Container,
): Promise<SavedScenarioDTO> {
  const container = await resolveContainer(injected);
  const input = buildEngineInput(raw.asOf, raw.assumptions, raw.scenario, raw.household);
  const saved = computeAndSaveScenario(container.scenarios, {
    id: raw.id,
    profileId: raw.profileId,
    name: raw.name,
    input,
    now: Date.now(), // the imperative shell is allowed the wall clock (never core — determinism).
  });
  return toSavedScenarioDTO(saved);
}

/**
 * Load a saved scenario by id (PROF-04): the repository re-parses the FROZEN snapshot through the
 * existing Zod boundary on load and never re-joins the live profile. Returns the plain DTO or `null`.
 */
export async function loadScenarioAction(
  id: string,
  injected?: Container,
): Promise<SavedScenarioDTO | null> {
  const container = await resolveContainer(injected);
  const saved = loadScenario(container.scenarios, id);
  return saved === null ? null : toSavedScenarioDTO(saved);
}

/** List the thin saved-scenario metadata for a profile (no heavy snapshot blobs deserialized — D-06). */
export async function listScenariosAction(
  profileId: string,
  injected?: Container,
): Promise<SavedScenarioMeta[]> {
  const container = await resolveContainer(injected);
  return listScenarios(container.scenarios, profileId);
}

/** Delete a saved scenario by id (a subsequent load returns `null`). */
export async function deleteScenarioAction(id: string, injected?: Container): Promise<void> {
  const container = await resolveContainer(injected);
  deleteScenario(container.scenarios, id);
}
