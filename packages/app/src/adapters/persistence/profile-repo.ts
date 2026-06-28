// SqliteProfileRepository — persists the nine-leaf `Profile` (PROF-01/PROF-02). Every monetary/rate
// leaf round-trips as a canonical decimal STRING in a TEXT column (CORE-02 / D-09) — a JS float can
// never re-enter here. The five PROF-01-visible fields are NOT enough: the full nine leaves are
// stored so a loaded `Profile` can drive the affordability/FI engines exactly as a `Household` does.
//
// DEFENSE IN DEPTH (T-06-13): `load`/`list` reassemble the row into a plain object and pass it
// THROUGH `parseProfile` (the same `.strict()` + `decStr` boundary the affordability solvers trust),
// so a corrupt DB value (a non-canonical string, a smuggled extra column) is REJECTED on read, not
// blindly trusted. Timestamps (`created_at`/`updated_at`) are OWNED BY THIS adapter via an INJECTED
// `now` clock — the locked nine-leaf `Profile` port carries NO timestamp fields, so the caller
// cannot supply them. The container injects the real `Date.now()`; tests inject a fixed clock.
// (Contrast `scenario-service`, where the CALLER owns the clock and passes `now` in.)
import { eq, sql } from 'drizzle-orm';
import { parseProfile, type Profile, type ProfileRepository } from '@house/core';
import type { Db } from './db.js';
import { profiles } from './schema.js';

/**
 * SQLite-backed `ProfileRepository`. Drizzle parameterizes every write/read (T-06-14). This adapter
 * OWNS the wall clock via an injected `now` (real `Date.now()` in the container, a fixed clock in
 * tests) and stamps `created_at`/`updated_at` itself — the locked `Profile` port carries no
 * timestamp fields, so the caller cannot supply them.
 */
export class SqliteProfileRepository implements ProfileRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Upsert a profile, mapping ALL NINE `Household` money/rate leaves to their TEXT columns
   * (`available_net_worth` IS PROF-01 "net worth"). `onConflictDoUpdate` on the primary key makes
   * save idempotent for an EDIT — re-saving the same id refreshes the leaves and `updated_at`,
   * preserving the original `created_at`.
   */
  save(p: Profile): void {
    const ts = this.now();
    this.db
      .insert(profiles)
      .values({
        id: p.id,
        name: p.name,
        grossAnnualIncome: p.grossAnnualIncome,
        existingMonthlyDebt: p.existingMonthlyDebt,
        targetSavingsRate: p.targetSavingsRate,
        availableNetWorth: p.availableNetWorth,
        currentRent: p.currentRent,
        downPaymentCash: p.downPaymentCash,
        reserve: p.reserve,
        currentAnnualSavings: p.currentAnnualSavings,
        targetAnnualRetirementSpend: p.targetAnnualRetirementSpend,
        createdAt: ts,
        updatedAt: ts,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          name: p.name,
          grossAnnualIncome: p.grossAnnualIncome,
          existingMonthlyDebt: p.existingMonthlyDebt,
          targetSavingsRate: p.targetSavingsRate,
          availableNetWorth: p.availableNetWorth,
          currentRent: p.currentRent,
          downPaymentCash: p.downPaymentCash,
          reserve: p.reserve,
          currentAnnualSavings: p.currentAnnualSavings,
          targetAnnualRetirementSpend: p.targetAnnualRetirementSpend,
          updatedAt: ts,
        },
      })
      .run();
  }

  /** Load a profile by id (or `null` if absent), re-validated through `parseProfile` (T-06-13). */
  load(id: string): Profile | null {
    const row = this.db.select().from(profiles).where(eq(profiles.id, id)).get();
    if (row === undefined) return null;
    return rowToProfile(row);
  }

  /** All saved profiles, each re-validated through `parseProfile`. */
  list(): Profile[] {
    return this.db.select().from(profiles).all().map(rowToProfile);
  }

  /** Row count — backs the service-layer ≤2-profiles guard (D-10, enforced in 06-06). */
  count(): number {
    const row = this.db.select({ c: sql<number>`count(*)` }).from(profiles).get();
    return row?.c ?? 0;
  }

  /**
   * Remove a profile row (a subsequent `load` returns `null`) — mirrors the scenario adapter's
   * `delete`. The scenarios→profiles foreign key is RESTRICT, so deleting a profile that still owns
   * saved scenarios raises a constraint error (the caller removes the scenarios first).
   */
  delete(id: string): void {
    this.db.delete(profiles).where(eq(profiles.id, id)).run();
  }
}

/** A persisted profiles row (the nine TEXT money leaves + identity + timestamps). */
type ProfileRow = typeof profiles.$inferSelect;

/**
 * Reassemble a DB row into a trusted `Profile` by routing the nine money leaves + identity through
 * `parseProfile` (defense in depth — the DB is re-validated, never blindly trusted). The integer
 * timestamp columns are persistence metadata and are NOT part of the `Profile` domain type.
 */
function rowToProfile(row: ProfileRow): Profile {
  return parseProfile({
    id: row.id,
    name: row.name,
    grossAnnualIncome: row.grossAnnualIncome,
    existingMonthlyDebt: row.existingMonthlyDebt,
    targetSavingsRate: row.targetSavingsRate,
    availableNetWorth: row.availableNetWorth,
    currentRent: row.currentRent,
    downPaymentCash: row.downPaymentCash,
    reserve: row.reserve,
    currentAnnualSavings: row.currentAnnualSavings,
    targetAnnualRetirementSpend: row.targetAnnualRetirementSpend,
  });
}
