---
phase: 4
slug: fi-impact-engine-sensitivity-flagship
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 04-RESEARCH.md "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (`projects` config; core runs in `node` env) — per CLAUDE.md + Phases 1–3 |
| **Config file** | Root `vitest.config.ts` (+ shared `vitest.shared.ts`); `packages/core` has its own project |
| **Quick run command** | `npx vitest run packages/core/src/fi` |
| **Full suite command** | `npm test` (or `npx vitest run` at root) |
| **Golden regen (gated)** | `UPDATE_GOLDEN=1 npx vitest run packages/core/src/golden.test.ts` (then review diff) |
| **Estimated runtime** | ~10–20 seconds (core unit suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/core/src/fi`
- **After every plan wave:** Run `npm test` (full core suite, incl. golden + round-trip)
- **Before `/gsd-verify-work`:** Full suite green + golden recomputes cent-identically (review any regenerated fixture diff)
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| FI-01 | DP+closing seed reduction + monthly premium decomposition | unit | `npx vitest run packages/core/src/fi/fi-impact.test.ts` | ❌ W0 |
| FI-02 | Monthly projection + FI date vs baseline; SWR default 0.033 | unit | `npx vitest run packages/core/src/fi/projection.test.ts` | ❌ W0 |
| FI-03 | FI-date delta in months and years | unit | `npx vitest run packages/core/src/fi/fi-impact.test.ts` | ❌ W0 |
| FI-04 | N-scenario ranking, baseline row 0, unreachable last | unit | `npx vitest run packages/core/src/fi/compare.test.ts` | ❌ W0 |
| FI-05 | Oracle reconciliation: 0% (exact) + high-inflation (Fisher) | unit (oracle) | `npx vitest run packages/core/src/fi/oracle.test.ts` | ❌ W0 |
| FI-05 | FI result recomputes cent-identically (golden) | golden | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend existing |
| FI-06 | A realistic input set yields "don't buy" / unreachable verdict | unit | `npx vitest run packages/core/src/fi/compare.test.ts` | ❌ W0 |
| ASMP-02 | Tornado: six drivers, ranked swing, top flagged | unit | `npx vitest run packages/core/src/fi/sensitivity.test.ts` | ❌ W0 |
| (boundary) | No-bare-number on FI result types | type-test | `tsc -b` (`fi.type-test.ts`) | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/fi/oracle.test.ts` — FV-of-annuity oracle (0% exact + high-inflation Fisher) — covers FI-05
- [ ] `packages/core/src/fi/projection.test.ts` — monthly loop, termination, unreachable verdict — covers FI-02, FI-06
- [ ] `packages/core/src/fi/fi-impact.test.ts` — target asymmetry surfaced, FI delta — covers FI-01, FI-03
- [ ] `packages/core/src/fi/compare.test.ts` — ranking + don't-buy row — covers FI-04, FI-06
- [ ] `packages/core/src/fi/sensitivity.test.ts` — tornado ranking — covers ASMP-02
- [ ] `packages/core/src/fi/fi.type-test.ts` — no-bare-number on result types (the `tco.type-test.ts` precedent)
- [ ] Extend `golden.test.ts` + add `__fixtures__/fi-golden-snapshot.json` (+ round-trip through `parseHousehold` for the new field)
- [ ] If AssumptionsV3: update `migrate.test.ts` for the `v2ToV3` arm; regenerate the three existing goldens (reviewed)
- [ ] Framework install: none — Vitest 4 already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Asymmetric-target fulcrum (D-02) reads as honest/defensible | FI-01 | Modeling-judgment call, not a numeric assertion | Inspect that renter target surfaces perpetual rent and owner target surfaces perpetual tax+ins+maint, both as explicit result fields (not buried) |

*All numeric phase behaviors have automated verification (unit + oracle + golden).*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (six `fi/*.test.ts` + type-test + golden extension)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
