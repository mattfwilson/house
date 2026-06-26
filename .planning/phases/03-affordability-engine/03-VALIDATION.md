---
phase: 3
slug: affordability-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture (HIGH confidence; all commands grounded in codebase reads).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (installed); core project runs in `node` env with the determinism guard setup file |
| **Config file** | `packages/core/vitest.config.ts` (merges `vitest.shared.ts`; `setupFiles: ['./src/determinism/guard.setup.ts']`) |
| **Quick run command** | `npx vitest run packages/core/src/affordability/<module>.test.ts` (the touched module's test file) |
| **Full suite command** | `npm test` (root — runs all Vitest projects) + `npm run -w @house/core typecheck` (tsc -b, picks up `*.type-test.ts`) |
| **Estimated runtime** | ~5–15 seconds (pure in-memory decimal math; no I/O) |

> Wave 0 must confirm the exact `-w @house/core` workspace alias / script name against root `package.json`.

---

## Sampling Rate

- **After every task commit:** Run the touched module's test file (e.g. `npx vitest run packages/core/src/affordability/dti.test.ts`)
- **After every plan wave:** Run `npm run -w @house/core test` (whole core project) + `npm run -w @house/core typecheck`
- **Before `/gsd-verify-work`:** Full suite green (`npm test`) AND golden masters unchanged (no `UPDATE_GOLDEN` diff)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are keyed by requirement + target test file so plans can bind their tasks to these checks. `Threat Ref` maps to the input-validation control (V5 / `household` `.strict()` boundary) — the single applicable ASVS-L1 surface.

| Req | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| AFF-01 | Front-end ratio = lenderDtiCarryingCost / grossMonthly, hand-verified | — | N/A | unit (worked example) | `npx vitest run packages/core/src/affordability/dti.test.ts` | ❌ W0 | ⬜ pending |
| AFF-01 | Back-end ratio = (numer + existingMonthlyDebt) / grossMonthly, hand-verified | — | N/A | unit (worked example) | `npx vitest run packages/core/src/affordability/dti.test.ts` | ❌ W0 | ⬜ pending |
| AFF-01 | DTI numerator EXCLUDES maintenance + amortizedClosing (D-14) | — | N/A | unit | `npx vitest run packages/core/src/affordability/dti.test.ts` | ❌ W0 | ⬜ pending |
| AFF-01 | Bank max price: binding ratio sits at its threshold; max loan = price − cash | — | N/A | unit (solver) | `npx vitest run packages/core/src/affordability/bank-affordability.test.ts` | ❌ W0 | ⬜ pending |
| AFF-01 | Solver monotonic across the PMI kink (price below vs above ~5× cash) | — | N/A | unit (property) | `npx vitest run packages/core/src/affordability/bank-affordability.test.ts` | ❌ W0 | ⬜ pending |
| AFF-02 | Savings drain = (total − amortizedClosing) − currentRent (KEEPS maintenance, D-03/D-14) | — | N/A | unit | `npx vitest run packages/core/src/affordability/true-affordability.test.ts` | ❌ W0 | ⬜ pending |
| AFF-02 | Savings-rate floor: solved price's post-purchase savings rate = target (baseline = `currentAnnualSavings`, D-17) | — | N/A | unit (solver) | `npx vitest run packages/core/src/affordability/true-affordability.test.ts` | ❌ W0 | ⬜ pending |
| AFF-02 | Cash-on-hand gate: trueMax = min(floor, cash); cash binds when NW − reserve small (D-05) | — | N/A | unit | `npx vitest run packages/core/src/affordability/true-affordability.test.ts` | ❌ W0 | ⬜ pending |
| AFF-03 | Gap = bank − true; bindingRatio + bindingConstraint reported (D-12) | — | N/A | unit | `npx vitest run packages/core/src/affordability/gap.test.ts` | ❌ W0 | ⬜ pending |
| AFF-03 | Verdict enum correct in all three directions, incl. anti-funnel `bankExceedsTrue` (D-13) | — | N/A | unit (acceptance) | `npx vitest run packages/core/src/affordability/gap.test.ts` | ❌ W0 | ⬜ pending |
| AFF-01/02/03 | Result types carry no bare-number dollar field (Money-only, CORE-02) | — | N/A | type-test | `npm run -w @house/core typecheck` | ❌ W0 | ⬜ pending |
| AFF-01/02/03 | Affordability/gap result recomputes cent-identically (Pitfall 11) | — | N/A | golden-master | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend | ⬜ pending |
| boundary | `household` `.strict()` rejects extra keys; decStr leaves; range refines (`targetSavingsRate ∈ [0,1)`) | T-03-V5 | Forged/corrupt snapshot rejected at boundary, not silently computed | unit | `npx vitest run packages/core/src/engine/engine-input.test.ts` | ⚠️ extend | ⬜ pending |
| boundary | EngineInput round-trip lossless with `household` (serialize→parseHousehold→recompute) | T-03-V5 | Non-canonical numbers cannot re-enter the math | golden round-trip | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/affordability/dti.test.ts` — worked-example front/back DTI fixtures (AFF-01, Pitfall 4)
- [ ] `packages/core/src/affordability/bank-affordability.test.ts` — solver + monotonicity (AFF-01)
- [ ] `packages/core/src/affordability/true-affordability.test.ts` — floor + cash gate (AFF-02)
- [ ] `packages/core/src/affordability/gap.test.ts` — gap + verdict incl. anti-funnel (AFF-03)
- [ ] `packages/core/src/affordability/affordability.type-test.ts` — no-bare-number guard (mirror `tco.type-test.ts`)
- [ ] `packages/core/src/__fixtures__/affordability-golden-snapshot.json` — reproducibility golden (extend `golden.test.ts`)
- [ ] Extend `packages/core/src/engine/engine-input.test.ts` + `engine-input.type-test.ts` for the `household` block
- [ ] Extend `golden.test.ts roundTrip()` to carry `household` through `parseHousehold`
- [ ] Framework install: none — Vitest 4 already configured.

*Existing infrastructure (Vitest projects, determinism guard, `*.type-test.ts` in the tsc -b graph, `UPDATE_GOLDEN`-gated golden harness) fully covers Phase 3's needs; only new test files + extensions are required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification — Phase 3 is a pure, deterministic calculation library.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
