# Project Research Summary

**Project:** Boston Home Affordability and FI-Impact Engine
**Domain:** Personal financial decision tool -- home affordability + FI impact modeling (greater Boston / MA)
**Researched:** 2026-06-22
**Confidence:** HIGH

## Executive Summary

This is a private two-user decision tool that inverts the standard real-estate search flow: rather than starting with houses and asking whether we can afford this, it starts with actual financial profiles and FI (financial independence) goals, then answers what does buying this house do to our retire-by-45 timeline. The research consistently points to one architecture: a functional core / imperative shell pattern where all financial math lives in a pure TypeScript package with zero framework dependencies, composed of three engines (TCO, Affordability, FI-Impact) that share inputs and combine into a single deterministic computeScenario function. The Next.js shell is a thin wrapper; the calculation engine is the product.

The recommended approach is a two-package npm workspaces monorepo (packages/core + apps/web), with decimal.js for precision arithmetic, Drizzle ORM + better-sqlite3 for local SQLite persistence, and Vitest for the pure-core test suite. The key architectural insight is that all four stated constraints (pure calc core, ListingsProvider adapter, assumptions as data, reproducible scenarios) are facets of the same decision: the engine is a pure function of explicit serializable inputs, and everything else -- UI, DB, listings -- is a replaceable shell. The dependency graph dictates build order: types and pure math first, persistence and UI last.

The headline risk is financial math correctness, specifically: floating-point money arithmetic, real-vs-nominal mixing in FI projections, opportunity-cost asymmetry in rent-vs-buy, and a too-aggressive default SWR for a 40-50 year early-retirement horizon. These pitfalls are existential -- a confident wrong answer is worse than no answer. They must be addressed at the foundation before any engine code, not retrofit later. Secondary risks are MA-specific: Prop 2.5 misunderstood as a bill cap (it is a levy cap), PMI drop-off at the wrong LTV/basis, and town-score normalization distortions. The pure-core architecture makes these fixable in isolation once caught.
