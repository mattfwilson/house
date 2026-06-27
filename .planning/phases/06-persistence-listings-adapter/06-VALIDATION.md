---
phase: 6
slug: persistence-listings-adapter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (`projects` config, node environment) |
| **Config file** | Root `vitest.config.ts` (`projects: ['packages/*']`); NEW `packages/app/vitest.config.ts` (Wave 0, `mergeConfig(sharedTest)`) |
| **Quick run command** | `npx vitest run packages/app` |
| **Full suite command** | `npm test` (runs all projects, incl. core golden suite) |
| **Estimated runtime** | ~5–15 seconds (in-memory SQLite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/app` (fast — in-memory SQLite)
- **After every plan wave:** Run `npm test` (all projects; proves core golden suite untouched)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Save + reload two profiles; 3rd rejected by service-layer guard | unit/integration | `npx vitest run packages/app -t profile` | ❌ W0 |
| PROF-02 | Named scenario under a profile; duplicate name within profile rejected | integration | `npx vitest run packages/app -t scenario` | ❌ W0 |
| PROF-03 | Save then reload in a fresh DB connection returns the scenario | integration | `npx vitest run packages/app -t reload` | ❌ W0 |
| PROF-03 | save → reload → `canonicalJson` byte-identical (reproducibility) | reproducibility | `npx vitest run packages/app -t round-trip` | ❌ W0 |
| LIST-01 | `ListingsProvider` port defined in core, depended on via interface only | contract/lint | `npx vitest run packages/app -t listings` | ❌ W0 |
| LIST-02 | `MockListingsProvider.getListings(query)` filters; `getListingById` hit/miss | contract | `npx vitest run packages/app -t listings` | ❌ W0 |
| D-03 | services never import concrete adapters (eslint boundary trips) | lint-as-test | `npx vitest run packages/app -t boundary` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Contract-test strategy:** one shared `describe` factory `repositoryContract(makeRepo)` invoked twice — against `SqliteScenarioRepository(openDb(':memory:'))` (real adapter, migrated schema) and an `InMemoryScenarioRepository` fake. Both pass identical assertions (save/load/list/delete/unique-name/round-trip). Byte-identity uses plain `expect(produced).toBe(stored)`, **not** `toMatchSnapshot`.

---

## Wave 0 Requirements

- [ ] `packages/app/package.json` + `tsconfig.json` + `vitest.config.ts` (node env, `mergeConfig(sharedTest)`)
- [ ] `packages/app/drizzle.config.ts` + initial generated migration in `drizzle/`
- [ ] `packages/app/src/adapters/persistence/db.ts` — `:memory:` DB helper + `runMigrations`
- [ ] Shared repository contract-test factory file
- [ ] `.gitignore` entries for `*.sqlite*` / `*.db`
- [ ] eslint flat-config `app` boundary element + adapter-import restriction (+ a boundary test asserting it trips)
- [ ] Add `{ path: "./packages/app" }` to root `tsconfig.json` references + `packages/app` in project graph

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | All phase behaviors have automated verification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
