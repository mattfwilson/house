# Phase 1: Foundations & Determinism Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 01-foundations-determinism-core
**Areas discussed:** Money type & rounding policy, AssumptionSet structure & versioning, Reproducibility harness design, Determinism enforcement

---

## Money type & rounding policy

### Money representation
| Option | Description | Selected |
|--------|-------------|----------|
| Money class wrapping Decimal | Immutable class holding a decimal.js Decimal, curated API; cannot bypass policy or mix with raw numbers | ✓ |
| Branded Decimal alias | `type Money = Decimal & {__brand}` via factory; lightweight but raw Decimal ops can sidestep policy | |
| You decide | Defer to Claude | |

**User's choice:** Money class wrapping Decimal

### Rounding mode
| Option | Description | Selected |
|--------|-------------|----------|
| Banker's (HALF_EVEN) | Round-half-to-even; avoids upward bias when summing many rounded values | ✓ |
| HALF_UP | Round half away from zero; intuitive but biased | |
| You decide | Defer to Claude (would default to HALF_EVEN) | |

**User's choice:** Banker's (HALF_EVEN)

### When rounding happens
| Option | Description | Selected |
|--------|-------------|----------|
| Full precision, round at boundaries | Keep full precision through intermediate math; round to cents only at output boundaries | ✓ |
| Round after every operation | Ledger-style cent-exact per op; degrades precision in compounding | |
| You decide | Defer to Claude | |

**User's choice:** Full precision, round at boundaries

---

## AssumptionSet structure & versioning

### Structure
| Option | Description | Selected |
|--------|-------------|----------|
| Nested by domain | Namespaced groups (tax, dti, returns, …); avoids collisions, scales | ✓ |
| Flat key-value map | One flat object; simplest but unwieldy and collision-prone | |
| You decide | Defer to Claude | |

**User's choice:** Nested by domain

### Versioning
| Option | Description | Selected |
|--------|-------------|----------|
| Integer schema version | `schemaVersion: 1` + per-version Zod schema + explicit migrate() | ✓ |
| Semver string | `'1.2.0'`; more expressive, heavier ceremony | |
| You decide | Defer to Claude | |

**User's choice:** Integer schema version

### Snapshot reference to assumptions
| Option | Description | Selected |
|--------|-------------|----------|
| Embed full set inline | Snapshot carries entire AssumptionSet by value; self-contained reproducibility | ✓ |
| Reference by id + version | Resolve from registry; smaller snapshots but must retain all history | |
| You decide | Defer to Claude | |

**User's choice:** Embed full set inline

### Serialized numeric value representation
| Option | Description | Selected |
|--------|-------------|----------|
| Canonical decimal strings | Store rates as strings; no float round-trip drift through JSON | ✓ |
| JS numbers | Store as plain numbers; simpler JSON but reintroduces float at the edge | |
| You decide | Defer to Claude | |

**User's choice:** Canonical decimal strings

---

## Reproducibility harness design

### Golden test subject
| Option | Description | Selected |
|--------|-------------|----------|
| Canary computation + data round-trip | Real Decimal compounding + rounding + assumption read, plus snapshot serialize→deserialize | ✓ |
| Data round-trip only | Serialize/deserialize/deep-equal; exercises no math | |
| You decide | Defer to Claude | |

**User's choice:** Canary computation + data round-trip

### Master fixture storage & regeneration
| Option | Description | Selected |
|--------|-------------|----------|
| Committed JSON fixture + explicit regen | Checked-in fixture, regenerated only via gated command; diffs visible in review | ✓ |
| Vitest toMatchSnapshot | Built-in snapshots; auto-writes on first run, `-u` re-blesses silently | |
| You decide | Defer to Claude | |

**User's choice:** Committed JSON fixture + explicit regen

### Equality assertion
| Option | Description | Selected |
|--------|-------------|----------|
| Deep-equal on canonical JSON | Money as decimal strings, sorted keys, structural deep-equal | ✓ |
| Money-aware comparator | Custom tree-walking comparator using Decimal.equals | |
| You decide | Defer to Claude | |

**User's choice:** Deep-equal on canonical JSON

---

## Determinism enforcement

### Threading asOf + assumptions
| Option | Description | Selected |
|--------|-------------|----------|
| Single immutable input object | Frozen `EngineInput {asOf, assumptions, ...}` that doubles as snapshot shape | ✓ |
| Separate explicit params | Distinct params per fn; transparent but noisy at call sites | |
| You decide | Defer to Claude | |

**User's choice:** Single immutable input object

### Rejecting ambient nondeterminism
| Option | Description | Selected |
|--------|-------------|----------|
| Both lint rule + test guard | ESLint scoped to core fails CI, plus runtime test guard that throws | ✓ |
| ESLint rule only | Static lint only; no runtime backstop | |
| You decide | Defer to Claude | |

**User's choice:** Both lint rule + test guard

### asOf representation
| Option | Description | Selected |
|--------|-------------|----------|
| Branded ISO date string | `CalendarDate = 'YYYY-MM-DD'`; no JS Date in core | ✓ |
| JS Date object | Native Date; timezone-sensitive, mutable, nondeterministic | |
| You decide | Defer to Claude | |

**User's choice:** Branded ISO date string

### decimal.js global config trap
| Option | Description | Selected |
|--------|-------------|----------|
| Frozen configured Decimal clone | One immutable `Decimal.clone({precision, rounding})` constant; never mutate global | ✓ |
| You decide | Defer to Claude | |

**User's choice:** Frozen configured Decimal clone

---

## Claude's Discretion

- Monorepo bootstrap mechanics (npm workspaces, tsconfig layout with no DOM/JSX in core, Vitest `projects` wiring, core coverage gating).
- Lint-boundary plugin choice (`import/no-restricted-paths` vs `eslint-plugin-boundaries`).
- Exact `Money` API surface, `EngineInput` shape, canary computation formula, and seed default assumption values.
- Internal decimal.js precision (significant digits) for the configured clone.

## Deferred Ideas

- `apps/web` scaffolding — later Web Shell phase; this phase is core-only.
- Persistence (SQLite / Drizzle) — golden test must work before persistence exists.
- Sensitivity analysis (ASMP-02) and the real FI engine (FI-*) — depend on these foundations, out of Phase 1 scope.
- Exact seed mill-rate / tax tables — Phase 2 (TCO); only AssumptionSet shape locked here.
