---
phase: 7
slug: web-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (new `apps/web` project — jsdom/happy-dom env; core/app projects unchanged) |
| **Config file** | root `vitest.config.ts` — add an `apps/web` projects entry (currently globs only `packages/*`) |
| **Quick run command** | `npx vitest run apps/web` |
| **Full suite command** | `npm test` (all projects) + `npm run build -w apps/web` (clean `next build` — proves no client-bundle leak / transpile conflict) |
| **Estimated runtime** | ~TBD seconds (set during Wave 0) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run apps/web`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite green AND `next build` clean
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | (UI surface) | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*To be populated by the planner from RESEARCH.md "## Validation Architecture": Server Action DTO contracts (Money→string, no float coercion), the single Money→number chart-conversion point, and the "component holds no math" boundary assertion.*

---

## Wave 0 Requirements

- [ ] `apps/web` Vitest project entry added to root `vitest.config.ts` (jsdom/happy-dom)
- [ ] Shared test fixtures for Server Action DTO mapping
- [ ] Clean `next build` wired as a phase gate

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | (UI surface) | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
