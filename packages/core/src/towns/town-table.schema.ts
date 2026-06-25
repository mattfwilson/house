// Town mill-rate row — the Zod boundary for a single seeded MA town rate (TCO-02 data half).
//
// This mirrors the AssumptionSet boundary discipline: the SAME canonical-decimal `decStr`
// validator from assumptions/schema.ts is reused (one definition of "canonical decimal
// string" across the codebase — a rate cannot be canonical at one door and a float at
// another), and `.strict()` rejects any unknown key so a row can't smuggle extra fields.
//
// `residentialMillRate` is stored AS PUBLISHED by the MA DLS "Tax Rates by Class" report —
// dollars of tax per $1,000 of assessed value (Assumption A3) — NOT pre-divided. The
// property-tax calc module divides by 1000 at use; storing the published figure keeps the
// table directly auditable against the DLS source.
import { z } from 'zod';
import { decStr } from '../assumptions/schema.js';

/**
 * A single town's residential mill rate, FY-stamped. `fy` is the fiscal year the rate was
 * published for (per-row, mixed vintage allowed — Open Question 1). `.strict()` so the row
 * shape is locked; `decStr` so a float mill rate is rejected at parse (T-02-02).
 */
export const townRowSchema = z
  .object({
    town: z.string(),
    fy: z.number().int(),
    residentialMillRate: decStr, // $/$1,000 of assessed value, AS PUBLISHED (A3)
  })
  .strict();

/** A validated town rate row (Zod-inferred — single source of truth with the runtime schema). */
export type TownRateRow = z.infer<typeof townRowSchema>;
