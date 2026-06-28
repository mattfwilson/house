'use server';
// towns.ts — the town-heatmap Server Action (07-04 Task 2; SC-3 / TOWN-01..04). A THIN
// validate→call-once→map wrapper holding ZERO scoring logic (RESEARCH Pattern 1/2/3): it validates the
// untrusted payload through the core boundary, calls `scoreTowns` EXACTLY ONCE, and maps the result to a
// plain DTO. The Town-Scoring engine is DECOUPLED from the Affordability/FI chain (D-11) — this action
// needs no household/scenario and no container (scoring is a pure read over the seeded town table).
//
// The three boundary validations (D-16 / T-7-01 — Server Actions are public POST endpoints):
//   1. `assumptions` (carrying the V4 `townScoring` config) is parsed through `parseAssumptionSet` and
//      migrated to the current version — a forged config is rejected before any scoring runs.
//   2. The active `budget` (inherited from the cockpit context, D-02) crosses as a canonical decimal
//      STRING and is validated by `Money.of`, which THROWS on a bare number / non-canonical string —
//      so a bare-number budget can never enter the bucket channel.
//   3. The commute `anchor` is checked against the locked three-anchor set (A8 / D-04) — a forged
//      anchor is rejected, not silently degraded to all-missing commute.
import {
  parseAssumptionSet,
  migrate,
  Money,
  scoreTowns,
  type TownScoringInput,
  type CommuteAnchor,
} from '@house/core';
import { toScoreboardDTO, type ScoreboardDTO } from '@/lib/dto/town';

/** The locked commute anchors (A8 / D-04 — the small fixed set the town table keys against). */
const COMMUTE_ANCHORS = ['downtownBoston', 'kendallCambridge', 'route128Burlington'] as const;

/** The raw score-towns payload: the V4 assumptions, the active budget (decimal string), the anchor. */
interface ScoreTownsRaw {
  readonly assumptions: unknown;
  /** The active budget as a canonical decimal STRING (D-02) — never a bare number (T-7-01). */
  readonly budget: string;
  /** The commute anchor to score against (one of `COMMUTE_ANCHORS`). */
  readonly anchor: string;
}

/** Validate the anchor against the locked set (a boundary range guard, not scoring math). */
function parseAnchor(raw: string): CommuteAnchor {
  if ((COMMUTE_ANCHORS as readonly string[]).includes(raw)) return raw as CommuteAnchor;
  throw new Error(
    `Invalid commute anchor: ${JSON.stringify(raw)} (expected one of ${COMMUTE_ANCHORS.join(', ')})`,
  );
}

/**
 * Score every town against the stored `townScoring` config + the active budget/anchor (SC-3): validate
 * the payload through the core boundary, build the `TownScoringInput`, call `scoreTowns` ONCE, and return
 * the serializable `ScoreboardDTO` (the 05-UI-SPEC heatmap encoding). No bucketing/composite math here.
 */
export async function scoreTownsAction(raw: ScoreTownsRaw): Promise<ScoreboardDTO> {
  const assumptions = migrate(parseAssumptionSet(raw.assumptions));
  const budget = Money.of(raw.budget);
  const anchor = parseAnchor(raw.anchor);
  const input: TownScoringInput = { assumptions, budget, anchor };
  return toScoreboardDTO(scoreTowns(input));
}
