---
phase: 07-web-shell
plan: 11
subsystem: web-ui
tags: [profile-editor, household-form, first-profile-create, field-errors, zod-boundary, d-16, decimal-strings, soft-cap, header-affordance, anti-funnel]

# Dependency graph
requires:
  - phase: 07-03
    provides: "saveProfileAction/listProfilesAction/deleteProfileAction + maxProfilesAction + toProfileDTO; the ProfileRepository.delete capability"
  - phase: 07-05
    provides: "dark-slate shadcn chrome (Input/Label/Button/AlertDialog Base-UI blocks) + the persistent D-02 profile/scenario Header + lib/format.formatUSD"
  - phase: 07-06
    provides: "selection store (setActiveProfile) so a saved profile becomes the active context"
provides:
  - "apps/web/src/components/profile/profile-form.ts — HOUSEHOLD_FIELDS, formToRawProfile (numerics->canonical decimal strings), fieldErrorsFromZod (core issues->per-field map); pure, no schema, no Number()"
  - "apps/web/src/components/profile/ProfileEditor.tsx — create/edit/delete form rendering name + nine Household leaves, wired to saveProfileFormAction/deleteProfileAction, core-surfaced field errors (D-16)"
  - "apps/web/src/app/profile/page.tsx — the dedicated /profile route: first-profile empty-state create + list/edit/delete + MAX_PROFILES display copy"
  - "apps/web/src/app/actions/profiles.ts saveProfileFormAction — translates the thrown core ZodError into a serializable field-error map across the Server Action boundary (mirrors 07-08's saveScenarioFormAction)"
  - "apps/web/src/components/chrome/Header.tsx — persistent 'Manage profiles' entry + empty-state 'Create a profile' CTA, both -> /profile"
affects: [07-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [edge-numeric-to-decimal-string-no-money-cast, zod-error-to-serializable-field-map-wrapper, core-parse-is-the-only-validation-D16, display-only-soft-cap-no-client-check, shared-pure-mapper-across-server-and-client-tiers]

key-files:
  created:
    - apps/web/src/components/profile/profile-form.ts
    - apps/web/src/components/profile/profile-form.test.ts
    - apps/web/src/components/profile/ProfileEditor.tsx
    - apps/web/src/app/profile/page.tsx
  modified:
    - apps/web/src/app/actions/profiles.ts
    - apps/web/src/components/chrome/Header.tsx

key-decisions:
  - "formToRawProfile forces every leaf to a STRING at the edge — a JS number is String()'d with NO arithmetic, a string passes through verbatim so the core regex (not the editor) judges canonicality. No Number() money cast anywhere in the profile tier (T-7-04, grep-confirmed)."
  - "The editor holds NO schema (D-16). A thrown core ZodError does NOT cross the Server Action boundary with .issues intact, so saveProfileFormAction (added to profiles.ts) wraps saveProfileAction and translates the parse failure into a serializable {fieldErrors} map — mirroring 07-08's saveScenarioFormAction. fieldErrorsFromZod is the single pure mapper, shared by the action and the test."
  - "The <=2-profile soft cap stays a saveProfile service invariant (T-7-08). MAX_PROFILES is shown as display copy only; the /profile route and editor perform NO client-side count check and never gate the Add affordance — a save past the cap is rejected (and surfaced) server-side."
  - "Header extended, not overwritten: the D-02 profile/scenario switcher is intact; added a teal empty-state 'Create a profile' CTA (swapped in only when no profiles exist) + a slate icon-only 'Manage profiles' entry (aria-label, 44px hit target). Teal stays reserved for the primary CTA per the UI-SPEC accent list."
  - "Delete uses the destructive-red alert-dialog with the verbatim UI-SPEC 'Delete profile' copy; the scenarios->profiles FK is RESTRICT, so a delete that still owns scenarios is caught and surfaced as a form message rather than crashing."

requirements-completed: [SC-1]

# Metrics
duration: ~10min
completed: 2026-06-28
---

# Phase 7 Plan 11: Profile Editor (first-profile create + edit/delete) Summary

**The missing entry path is closed: a brand-new user can now create the FIRST profile — the nine-leaf `Household` the whole affordability/FI engine runs on — from a locked empty state on a dedicated `/profile` route, and edit/delete existing ones, through a form that holds NO validation schema. Every numeric leaf is forced to a canonical decimal string at the edge (no bare-number money), validation comes solely from the core `parseProfile`/`HouseholdSchema` boundary surfaced as per-field errors (D-16), and the `<=2` soft cap stays a service invariant shown only as display copy. The persistent header gained a 'Manage profiles' entry + an empty-state 'Create a profile' CTA without disturbing the D-02 switcher.**

## Performance
- **Duration:** ~10 min
- **Completed:** 2026-06-28
- **Tasks:** 2 (Task 1 TDD red->green; Task 2 auto)
- **Files:** 4 created + 2 modified

## Accomplishments
- **profile-form.ts (pure, TDD):** `HOUSEHOLD_FIELDS` (the nine leaves in display order with human labels), `formToRawProfile(values, name, id?)` (each leaf forced to a decimal string at the edge — a JS number is `String()`'d with no arithmetic, a string passes through verbatim; no `Number()` money cast), and `fieldErrorsFromZod(error)` (duck-typed on `.issues`, projects a core parse failure onto a `{ leaf -> message }` map; returns `{}` for a non-error). Two tests run against the REAL `parseProfile`: numerics->strings (every leaf + name `typeof === 'string'`, `120000`->`"120000"`, `0.4`->`"0.4"`, round-trips through the core) and field errors (out-of-`[0,1)` `targetSavingsRate` keyed to its leaf, a missing leaf keyed to that leaf, valid input -> empty map).
- **ProfileEditor.tsx:** a `'use client'` form rendering a name field + one labeled input per `HOUSEHOLD_FIELDS` entry (dense `md` field spacing, `.num-readout` figures), pre-filled from a passed `ProfileDTO` when editing and empty when creating. On submit it mints/keeps an id, builds the raw via `formToRawProfile`, calls `saveProfileFormAction`, surfaces per-field errors inline, and on success sets the active profile in the selection store (07-06). Delete is the destructive-red shadcn alert-dialog with the verbatim "Delete profile" copy. `MAX_PROFILES` shown as display copy only; no client-side cap check.
- **saveProfileFormAction (profiles.ts):** the boundary translator — wraps `saveProfileAction`, returns `{ ok, saved }` on success, `{ ok:false, fieldErrors }` on a core Zod rejection (via the shared `fieldErrorsFromZod`), and `{ ok:false, formError }` on any other failure (e.g. the soft cap thrown by `saveProfile`). Mirrors 07-08's `saveScenarioFormAction` exactly — a thrown ZodError cannot cross the Server Action boundary with `.issues` intact, so the map is built server-side.
- **/profile route (page.tsx):** empty list -> the locked "Create a profile to get started" heading + body with `ProfileEditor` in create mode (the first-profile path); non-empty -> a list of profile cards (name + `formatUSD` read-backs) each with an Edit affordance opening the prefilled editor, an always-available "Add profile" affordance (no cap check), and the `MAX_PROFILES` cap copy. No `app/layout.tsx` / cockpit `app/page.tsx` change (diff-confirmed).
- **Header entry affordance:** a persistent slate icon-only "Manage profiles" link (`aria-label="Manage profiles"`, 44px hit target) -> `/profile`, and a teal empty-state "Create a profile" CTA (rendered in place of the profile switcher only when no profiles exist) -> `/profile`. The D-02 switcher is untouched.

## Task Commits
1. **Task 1 (RED): failing profile-form mapper specs** — `3e667ae` (test)
2. **Task 1 (GREEN): profile-form mappers + ProfileEditor + saveProfileFormAction wrapper** — `3c39d9a` (feat)
3. **Task 2: /profile route + header entry affordance** — `ebd8cf2` (feat)

## TDD Gate Compliance
Task 1 followed RED->GREEN: `3e667ae` (test — `./profile-form` absent, transform error -> RED) precedes `3c39d9a` (feat — both behaviors pass, 3 green). No REFACTOR commit needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `saveProfileFormAction` to surface field-level Zod errors across the RSC boundary**
- **Found during:** Task 1
- **Issue:** The plan key-link wires `ProfileEditor -> saveProfileAction -> fieldErrorsFromZod on reject`, but `saveProfileAction` THROWS a `ZodError`, and a thrown error does NOT cross the Server Action boundary with its `.issues` intact (only the message/digest survive in production) — the client editor could never read per-field messages. The cross-plan wiring note anticipated this ("mirror 07-08's saveScenarioFormAction if needed").
- **Fix:** Added a thin wrapper `saveProfileFormAction(raw)` to `apps/web/src/app/actions/profiles.ts` that calls `saveProfileAction` and, on a Zod-like failure, returns a serializable `{ fieldErrors }` map (built via the shared pure `fieldErrorsFromZod`) — WITHOUT duplicating any validation (the schema still lives in core). Non-validation failures (e.g. the soft cap) return a generic `formError`.
- **Files modified:** apps/web/src/app/actions/profiles.ts (+ imports `fieldErrorsFromZod` from the pure profile-form module)
- **Verification:** tsc clean for plan files (only the 2 deferred 07-03 test errors); eslint apps/web exit 0; vitest apps/web 27 green.
- **Committed in:** 3c39d9a

**2. [Rule 1 - Bug] `error` prop under `exactOptionalPropertyTypes`**
- **Found during:** Task 1 typecheck
- **Issue:** `ProfileField`'s `error?: string` rejected the `fieldErrors[key]` (`string | undefined`) it receives under this repo's `exactOptionalPropertyTypes: true`.
- **Fix:** Widened the prop to `error?: string | undefined` (mirroring the 07-08 Base-UI `exactOptionalPropertyTypes` precedent).
- **Files modified:** apps/web/src/components/profile/ProfileEditor.tsx
- **Committed in:** 3c39d9a

### Other small notes (within plan intent)
- No `@/components/ui/form` block exists in the 07-05 install set, so the editor uses a native `<form onSubmit>` over shadcn `Input`/`Label`/`Button`/`AlertDialog` (same approach as 07-08's `InlineScenarioEditor`). Not a schema/validation surface — just the layout primitive.

No architectural (Rule 4) changes; no auth gates.

## Threat Model Coverage
- **T-7-01** (Tampering/DoS — editor inputs): the editor holds NO schema; every leaf is validated at the `parseProfile`/`HouseholdSchema` core boundary inside `saveProfileAction` (D-16). `saveProfileFormAction` only translates the core's parse failure into a serializable map — it adds no rule. Grep: no `z.object`/`.parse(`/schema definition in `ProfileEditor.tsx`.
- **T-7-04** (Tampering/correctness — bare-number money): `formToRawProfile` converts every numeric to a canonical decimal string at the edge (test asserts every leaf + name is `typeof === 'string'`); zero `Number(` tokens in the profile tier (grep-confirmed — the only matches are comments asserting its absence).
- **T-7-08** (client re-checking/bypassing the `<=2` cap): the cap stays a `saveProfile` service invariant; the UI shows `MAX_PROFILES` for copy only and performs no count check — the Add affordance is never gated on profile count.

## Known Stubs
None. The editor is fully wired to the real `saveProfileFormAction`/`deleteProfileAction`/`listProfilesAction`/`maxProfilesAction`; the `/profile` route lists/creates/edits/deletes real persisted profiles; the header links are live. Profile delete of a profile that still owns scenarios surfaces the FK-RESTRICT constraint as a form message (an honest limitation, not a stub).

## Verification Evidence
- `npx vitest run apps/web/src/components/profile` -> 3 green (numerics->strings, core-parse field errors, empty-map-on-valid). Full `npx vitest run apps/web` -> 7 files, 27 tests green.
- `npx tsc -p apps/web/tsconfig.json --noEmit` -> ONLY the 2 pre-existing deferred 07-03 test errors (`scenarios.test.ts:80`, `scenario.test.ts:109`); ZERO new errors from this plan's files.
- `npx eslint apps/web` -> exit 0 (client-leak guard + the `Number()` money->float confinement satisfied).
- Anti-funnel/boundary greps: no `Number(`/`green`/`success`/`emerald`/`z.object`/`.parse(` in the profile tier (only comments asserting their absence); `git diff` confirms no `app/layout.tsx` or cockpit `app/page.tsx` change.
- Build note: the full `next build` stays the 07-10 phase gate (known-blocked by the @house/app drizzle-packaging issue, untouched here — apps/web uses webpack; YOUR work verified via tsc/eslint/vitest).

## Self-Check: PASSED
- All 4 created files + the 2 modified files verified present on disk.
- All 3 task commits (`3e667ae`, `3c39d9a`, `ebd8cf2`) verified in git log.
- tsc clean for plan files (only the 2 deferred 07-03 errors); eslint apps/web exit 0; vitest apps/web 27 green; no layout.tsx / cockpit page.tsx in the plan diff.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*
