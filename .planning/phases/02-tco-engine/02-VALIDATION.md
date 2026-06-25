---
phase: 2
slug: tco-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (`^4.1.9`), root `projects: ['packages/*']` config |
| **Config file** | `vitest.config.ts` (root) + `packages/core/vitest.config.ts` + `vitest.shared.ts` |
| **Quick run command** | `npx vitest run packages/core/src/tco` |
| **Full suite command** | `npm test` (root → `vitest run`, all projects) |
| **Estimated runtime** | ~10–20 seconds (pure unit suite, no I/O) |

Supporting commands:
- **Typecheck (type-tests in `tsc -b` graph):** `npm run typecheck`
- **Golden regenerate (reviewable diff):** `npm run update-golden` (`UPDATE_GOLDEN=1 vitest run packages/core`)
- **Coverage gate (v8):** lines 95 / functions 95 / branches 90 / statements 95 — the TCO module must clear these.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core/src/tco/<module>.test.ts` + `npm run typecheck`
- **After every plan wave:** Run `npm test` (full core suite, coverage-gated)
- **Before `/gsd-verify-work`:** Full suite green + golden fixtures regenerated-and-reviewed; SC1 invariant + oracle tests pass with **exact equality** (no `toBeCloseTo` on dollar assertions)
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (assigned by planner) | — | — | TCO-01 | — | Money-typed schedule; no bare-number dollars | unit/invariant + oracle | `npx vitest run packages/core/src/tco/amortization.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | TCO-02 | T-snapshot | tax = assessed × millRate; FY-stamped; no 2.5% bill cap | unit | `npx vitest run packages/core/src/tco/property-tax.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | TCO-03 | — | maintenance %-of-appreciating; insurance/HOA flat | unit | `npx vitest run packages/core/src/tco/carrying-costs.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | TCO-04 | — | PMI DP<20%; 78% auto / 80% requested vs original value + scheduled balance (toggle) | unit/toggle | `npx vitest run packages/core/src/tco/pmi.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | TCO-05 | — | closing = price×rate OR override; amortized over hold; t=0 lump in net-worth model | unit | `npx vitest run packages/core/src/tco/closing-costs.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | TCO-06 | — | breakdown present monthly AND annualized for every line | unit + golden | `npx vitest run packages/core/src/tco/tco.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | TCO-07 | — | symmetric invest-the-difference; Fisher real; separate appreciation; sell haircut; crossover; RENT-can-win | unit + anti-funnel | `npx vitest run packages/core/src/tco/rent-vs-buy.test.ts` | ❌ W0 | ⬜ pending |
| (assigned by planner) | — | — | (cross) reproducibility | T-float-reintro | full TCO result recomputes cent-identically | golden | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ exists; extend | ⬜ pending |
| (assigned by planner) | — | — | (cross) closed shape | T-float-reintro | result fields are `Money`, not `number` | type-test | `npm run typecheck` | ❌ W0 (`tco.type-test.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/tco/amortization.test.ts` — TCO-01 invariants (length, sum(principal)==loan, finalBalance==$0.00, interest cross-check) + non-round-rate oracle
- [ ] `packages/core/src/tco/property-tax.test.ts` — TCO-02 (assessed × millRate, FY-stamp, no 2.5% cap, appreciating assessed)
- [ ] `packages/core/src/tco/carrying-costs.test.ts` — TCO-03
- [ ] `packages/core/src/tco/pmi.test.ts` — TCO-04 toggle (auto vs requested → different drop-off months)
- [ ] `packages/core/src/tco/closing-costs.test.ts` — TCO-05
- [ ] `packages/core/src/tco/tco.test.ts` — TCO-06 + golden
- [ ] `packages/core/src/tco/rent-vs-buy.test.ts` — TCO-07 + anti-funnel "rent wins" case
- [ ] `packages/core/src/tco/tco.type-test.ts` — closed-shape / no-bare-number guard (mirrors `money.type-test.ts`)
- [ ] `packages/core/src/towns/town-table.test.ts` — resolver + FY-stamp-into-snapshot
- [ ] Extend `packages/core/src/golden.test.ts` + add a TCO golden fixture under `__fixtures__/`
- [ ] Framework install: **none** — Vitest already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| External-oracle agreement on amortization payment | TCO-01 / SC1 | The oracle figure is a human-verified bank/spreadsheet value, not a package | Cross-check scheduled payment against `PMT(0.06375/12, 360, -400000)` → 2495.479595… → $2,495.48 in any spreadsheet/bank calculator; bake the verified figure into `amortization.test.ts` as the committed oracle |
| Seeded MA mill-rate transcription accuracy | TCO-02 | Rates are hand-transcribed from the public DLS "Tax Rates by Class" report (no live API in Phase 2) | Spot-check ~3–5 seeded towns' residential rate + FY vintage against the DLS report at seed time; FY-stamp per row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
