---
phase: 5
slug: town-scoring-heatmap
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Engine-only phase: pure decimal-scoring core in `packages/core/src/towns/`. No rendering, no app, no network.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (`projects` config; core runs in `node` env, no JSX) |
| **Config file** | root `vitest.config.ts` / `vitest.shared.ts` (per CLAUDE.md; `extends` not allowed under `projects`) |
| **Quick run command** | `npx vitest run packages/core/src/towns` |
| **Full suite command** | `npm test` (root) / `npx vitest run` |
| **Golden regeneration** | `UPDATE_GOLDEN=1 npx vitest run packages/core/src/golden.test.ts` (gated, reviewable diff — DO NOT use to "fix" the four existing goldens) |
| **Type-test** | `tsc -b` (picks up `towns.type-test.ts`) |
| **Estimated runtime** | ~10 seconds (core suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core/src/towns` + `tsc -b`
- **After every plan wave:** Run `npm test` (full core suite, incl. goldens)
- **Before `/gsd-verify-work`:** Full suite green + the four existing result goldens byte-identical (NO regen) + the new town-scoring golden committed
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| TOWN-01 | Fixed-range normalize + direction fold → [0,1] (clamp + /0 guard) | unit | `npx vitest run packages/core/src/towns/normalize.test.ts` | ❌ Wave 0 | ⬜ pending |
| TOWN-01 | Composite + per-metric breakdown (worked example, exact decimal string) | unit | `npx vitest run packages/core/src/towns/composite.test.ts` | ❌ Wave 0 | ⬜ pending |
| TOWN-01 | Missing-metric weight renormalization (drop + renormalize to Σ=1) | unit | `npx vitest run packages/core/src/towns/composite.test.ts` | ❌ Wave 0 | ⬜ pending |
| TOWN-02 | Bucket boundaries (== budget, == budget×1.25, just above) | unit | `npx vitest run packages/core/src/towns/bucket.test.ts` | ❌ Wave 0 | ⬜ pending |
| TOWN-03 | `scoreTowns` over seeded table → matrix shape + anchor echo | unit | `npx vitest run packages/core/src/towns/score-towns.test.ts` | ❌ Wave 0 | ⬜ pending |
| TOWN-03 | Reproducibility golden (canonical JSON, byte-identical) | golden | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend existing | ⬜ pending |
| TOWN-04 | Flags attached, prop2½ universal, never alter score/bucket | unit | `npx vitest run packages/core/src/towns/score-towns.test.ts` | ❌ Wave 0 | ⬜ pending |
| D-06 | AssumptionsV4 migrate V1/V2/V3→V4 (verbatim copy + new block) | unit | `npx vitest run packages/core/src/assumptions/migrate.test.ts` | ⚠️ extend existing | ⬜ pending |
| CORE-02 | No bare-`number` dollar/score leak (compile-time) | type-test | `tsc -b` | ❌ Wave 0 | ⬜ pending |
| D-02 | Extended town rows parse through `townRowSchema.strict()` | unit | `npx vitest run packages/core/src/towns/town-table.test.ts` | ⚠️ extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/towns/normalize.test.ts` — covers TOWN-01 (normalization + direction + clamp + /0 guard)
- [ ] `packages/core/src/towns/composite.test.ts` — covers TOWN-01 (composite + missing-metric renormalization)
- [ ] `packages/core/src/towns/bucket.test.ts` — covers TOWN-02 (bucket boundaries)
- [ ] `packages/core/src/towns/score-towns.test.ts` — covers TOWN-03/TOWN-04 (end-to-end matrix + flags)
- [ ] `packages/core/src/towns/towns.type-test.ts` — covers CORE-02 (no bare-`number` leak)
- [ ] Extend `town-table.test.ts`, `migrate.test.ts`, `schema.test.ts`, `golden.test.ts` (new town-scoring golden block + fixture)
- [ ] Framework install: **none** — Vitest already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Numeric defensibility of `[ASSUMED]` reference ranges / weights | TOWN-01 | Magnitudes are user-tunable AssumptionsV4 data, not correctness invariants | Review Discretion Proposals + Assumptions Log (A1–A10) in `05-RESEARCH.md`; confirm or adjust the seeded values |

*All structural/behavioral phase outputs have automated verification; only the tunable numeric magnitudes are a judgment call.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-27 (plan-checker: all tasks have automated verify, no 3-consecutive gap, inline TDD for new test files)
