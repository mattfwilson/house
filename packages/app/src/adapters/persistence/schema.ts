// Drizzle SQLite schema — the persistence substrate every 06-05 repository builds on.
//
// MONEY DISCIPLINE (CORE-02 / D-09): every monetary/rate leaf is a TEXT column holding a
// canonical decimal STRING, never a SQLite REAL/float column. Re-introducing a floating-point
// money column is the one thing the pure core exists to prevent — the calc core lifts these
// strings to `Money` in memory and only ever rounds at the cent boundary. The floating-point
// column constructor must appear zero times in this file.
//
// `created_at`/`updated_at` are integer epoch-ms columns. They are SET IN THE APP LAYER
// (the imperative shell is allowed `Date.now()`); core forbids it for determinism, so a
// timestamp is never generated inside a pure core function.
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * `profiles` — a saved financial profile = `{ id, name } & Household`. Persists ALL NINE
 * Household leaves (`engine-input.ts:116-154`), not just the five PROF-01-visible fields, so
 * the row can drive the affordability/FI engines. PROF-01 "net worth" IS `available_net_worth`
 * — there is deliberately NO separate `net_worth` column (it would diverge from what the
 * engines read via `Household.availableNetWorth`). Each snake_case column maps to its
 * camelCase TS field, matching the Household leaf name verbatim.
 */
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  grossAnnualIncome: text('gross_annual_income').notNull(),
  existingMonthlyDebt: text('existing_monthly_debt').notNull(),
  targetSavingsRate: text('target_savings_rate').notNull(), // fraction in [0,1) — refined in Zod
  availableNetWorth: text('available_net_worth').notNull(), // PROF-01 "net worth"
  currentRent: text('current_rent').notNull(),
  downPaymentCash: text('down_payment_cash').notNull(),
  reserve: text('reserve').notNull(),
  currentAnnualSavings: text('current_annual_savings').notNull(),
  targetAnnualRetirementSpend: text('target_annual_retirement_spend').notNull(),
  createdAt: integer('created_at').notNull(), // epoch ms — set in the app layer (determinism)
  updatedAt: integer('updated_at').notNull(),
});

/**
 * `scenarios` — a named house scenario belonging to a profile (FK). The `snapshot` TEXT column
 * is the canonicalJson FROZEN `EngineInput` blob and the SOURCE OF TRUTH for reproducibility
 * (D-05): a saved scenario reloads to byte-identical canonical JSON even after the owning
 * profile is later edited. The thin `id`/`profile_id`/`name`/timestamps columns are queryable
 * metadata only (D-06). A unique index enforces scenario-name-uniqueness-within-profile (D-11).
 */
export const scenarios = sqliteTable(
  'scenarios',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    name: text('name').notNull(),
    snapshot: text('snapshot').notNull(), // canonicalJson EngineInput blob — source of truth (D-05)
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    // D-11: a scenario name is unique WITHIN its profile (two profiles may both have "Newton").
    uniqueIndex('uniq_scenario_name_per_profile').on(t.profileId, t.name),
  ],
);
