'use client';
// The cockpit — the home route that IS the ranked comparison view (D-03). It assembles the active
// profile's household + its saved buy scenarios + the shared working-set assumptions into the
// `recompareAction` payload, renders the core-ranked comparison table (the pinned rent baseline can
// win = the don't-buy signal, D-04/D-05), expands a row into its FI instruments + trajectory hero
// chart (D-07), and offers the inline add/edit editor (D-14/D-15). Bank affordability shows only as
// the amber gap caution (D-06). It NEVER nudges toward a buy.
//
// CROSS-PLAN WIRING: the cockpit POPULATES the `comparison-input` bridge store (07-07) with the
// non-knob recompare context (asOf / household / baseline / scenarios) so the assumptions rail's
// live debounced recompute (D-08) actually fires — the rail skips recompute while that store is null.
// The rail's results land in `useRecompute`; the cockpit reads them so a knob edit re-flies the table.
//
// All dollars cross as decimal STRINGS and are formatted at the display edge (lib/format.ts / chart).
// No money math, no ranking, and no `Number()` here — every number comes from a Server Action.
import { useEffect, useMemo, useState } from 'react';
import { useSelection } from '@/store/selection';
import { useWorkingSet } from '@/store/working-set';
import { useComparisonInput } from '@/store/comparison-input';
import { useRecompute } from '@/store/recompute';
import { listProfilesAction } from '@/app/actions/profiles';
import {
  listScenariosAction,
  loadScenarioAction,
  recompareAction,
  gapAction,
  type SavedScenarioDTO,
} from '@/app/actions/scenarios';
import { listTownsAction, defaultAssumptionsAction } from '@/app/actions/cockpit';
import type { ProfileDTO } from '@/lib/dto/profile';
import type { CompareDTO, GapDTO } from '@/lib/dto/scenario';
import type { AssumptionSet } from '@house/core';
import { ComparisonTable, type RankedScenarioRow } from '@/components/cockpit/ComparisonTable';
import { ExpandedScenario } from '@/components/cockpit/ExpandedScenario';
import { InlineScenarioEditor } from '@/components/cockpit/InlineScenarioEditor';
import { RENT_BASELINE_LABEL } from '@/components/cockpit/ScenarioRow';
import { Button } from '@/components/ui/button';

/** UI-SPEC error-state copy for a failed Server Action (07-UI-SPEC §Microcopy). */
const ERROR_COPY =
  "Couldn't run the numbers. The calculation didn't complete — check your inputs and try again. " +
  'If it persists, the saved snapshot may be malformed.';

/** Strip identity from a ProfileDTO → the 9-leaf Household the Server Actions validate (`.strict()`). */
function toHousehold(profile: ProfileDTO): Record<string, string> {
  const { id: _id, name: _name, ...household } = profile;
  return household;
}

export default function Cockpit() {
  const activeProfileId = useSelection((s) => s.activeProfileId);
  const setActiveProfile = useSelection((s) => s.setActiveProfile);
  const expandedKey = useSelection((s) => s.expandedScenarioId);
  const setExpanded = useSelection((s) => s.setExpanded);

  const workingSet = useWorkingSet((s) => s.assumptions);
  const loadFrozenSet = useWorkingSet((s) => s.loadFrozenSet);
  const setComparisonInput = useComparisonInput((s) => s.setComparisonInput);
  const liveResult = useRecompute((s) => s.result) as CompareDTO | null;

  const [profiles, setProfiles] = useState<readonly ProfileDTO[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [scenarios, setScenarios] = useState<readonly SavedScenarioDTO[]>([]);
  const [towns, setTowns] = useState<readonly string[]>([]);
  const [compare, setCompare] = useState<CompareDTO | null>(null);
  const [liveOverride, setLiveOverride] = useState<CompareDTO | null>(null);
  const [gap, setGap] = useState<GapDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [todayAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  // Load the profiles + the curated town list once.
  useEffect(() => {
    void listProfilesAction().then((list) => {
      setProfiles(list);
      setProfilesLoaded(true);
    });
    void listTownsAction().then(setTowns);
  }, []);

  // Auto-select the first profile when none is active so the cockpit is immediately useful (D-02).
  useEffect(() => {
    if (activeProfileId === null && profiles.length > 0) setActiveProfile(profiles[0]!.id);
  }, [activeProfileId, profiles, setActiveProfile]);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId],
  );

  // Load the active profile's saved scenarios, seed the shared working set, build the comparison, and
  // POPULATE the bridge store (so the rail's live recompute fires). Re-runs on a save/delete reload.
  useEffect(() => {
    if (activeProfileId === null || activeProfile === null) return;
    let active = true;
    setError(null);
    void (async () => {
      const metas = await listScenariosAction(activeProfileId);
      const loaded = await Promise.all(metas.map((m) => loadScenarioAction(m.id)));
      if (!active) return;
      const full = loaded.filter((s): s is SavedScenarioDTO => s !== null);
      setScenarios(full);

      // Seed the shared working set for this profile (D-09): the first snapshot's frozen assumptions,
      // or the engine defaults when the profile has no scenarios yet (so a first Add can be saved).
      const seed = (full[0]?.input.assumptions ?? (await defaultAssumptionsAction())) as AssumptionSet;
      if (!active) return;
      loadFrozenSet(seed);

      if (full.length === 0) {
        setCompare(null);
        setGap(null);
        setComparisonInput(null);
        return;
      }

      const household = toHousehold(activeProfile);
      const asOf = String(full[0]!.input.asOf);
      const baseline = { ...full[0]!.input.scenario, label: RENT_BASELINE_LABEL };
      const buyScenarios = full.map((s) => s.input.scenario);

      // CROSS-PLAN WIRING (07-07): the non-knob recompare context the rail needs to re-fly live.
      setComparisonInput({ asOf, household, baseline, scenarios: buyScenarios });

      const [dto, g] = await Promise.all([
        recompareAction({ asOf, household, assumptions: seed, baseline, scenarios: buyScenarios }),
        gapAction({ asOf, household, assumptions: seed, scenario: buyScenarios[0] }).catch(() => null),
      ]);
      if (!active) return;
      setCompare(dto);
      setGap(g);
    })().catch(() => {
      if (active) setError(ERROR_COPY);
    });
    return () => {
      active = false;
    };
  }, [activeProfileId, activeProfile, reloadKey, loadFrozenSet, setComparisonInput]);

  // Live loop: a rail knob edit lands a fresh ranked result in `useRecompute`; prefer it until the
  // cockpit itself recomputes (a profile/scenario reload clears the override so the table is fresh).
  useEffect(() => {
    if (liveResult) setLiveOverride(liveResult);
  }, [liveResult]);
  useEffect(() => {
    setLiveOverride(null);
  }, [compare]);

  const displayCompare = liveOverride ?? compare;

  // Zip each ranked row to the saved scenario behind it (matched by label; null for the baseline).
  const rankedRows: readonly RankedScenarioRow[] = useMemo(
    () =>
      (displayCompare?.rows ?? []).map((row) => ({
        row,
        scenarioId: row.isBaseline
          ? null
          : (scenarios.find((s) => s.input.scenario.label === row.label)?.id ?? null),
      })),
    [displayCompare, scenarios],
  );

  const household = activeProfile ? toHousehold(activeProfile) : null;
  const asOf = scenarios[0] ? String(scenarios[0].input.asOf) : todayAsOf;

  const reloadAfterMutation = () => {
    setAdding(false);
    setEditingId(null);
    setReloadKey((k) => k + 1);
  };
  const onDeleted = () => {
    setExpanded(null);
    reloadAfterMutation();
  };

  const renderExpanded = (r: RankedScenarioRow) => {
    if (workingSet === null || household === null) return null;
    // Edit mode (D-15): swap the expanded instruments for the inline editor on this row.
    if (r.scenarioId !== null && editingId === r.scenarioId) {
      const sc = scenarios.find((s) => s.id === r.scenarioId);
      return (
        <InlineScenarioEditor
          profileId={activeProfileId!}
          household={household}
          assumptions={workingSet}
          asOf={asOf}
          towns={towns}
          initial={sc?.input.scenario ?? null}
          scenarioId={r.scenarioId}
          onSaved={reloadAfterMutation}
          onCancel={() => setEditingId(null)}
          onDeleted={onDeleted}
        />
      );
    }
    const sc = r.scenarioId ? scenarios.find((s) => s.id === r.scenarioId) : null;
    return (
      <ExpandedScenario
        row={r.row}
        scenario={sc?.input.scenario ?? null}
        household={household}
        assumptions={workingSet}
        asOf={asOf}
        onEdit={r.scenarioId ? () => setEditingId(r.scenarioId) : undefined}
      />
    );
  };

  // ── Empty states ────────────────────────────────────────────────────────
  if (profilesLoaded && profiles.length === 0) {
    return (
      <main className="flex flex-col gap-2 p-8">
        <h1 className="text-xl font-semibold">Create a profile to get started</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Add your household — net worth, income, savings rate, current rent, and target retirement
          spend. You can save up to two profiles.
        </p>
      </main>
    );
  }

  const showAddEditor = adding && workingSet !== null && household !== null && activeProfileId !== null;

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Cockpit</h1>
        <p className="text-sm text-muted-foreground">
          Ranked by what each house does to your FI date — against renting and investing the difference.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs leading-snug text-destructive">
          {error}
        </p>
      ) : null}

      {scenarios.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold">Add a house to see what it does to your FI date</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              You haven&apos;t added any scenarios yet. Add a house — price, town, down payment — and
              it&apos;ll be ranked against renting and investing the difference.
            </p>
          </div>
          {showAddEditor ? (
            <InlineScenarioEditor
              profileId={activeProfileId!}
              household={household!}
              assumptions={workingSet!}
              asOf={asOf}
              towns={towns}
              onSaved={reloadAfterMutation}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
              Add scenario
            </Button>
          )}
        </div>
      ) : (
        <ComparisonTable
          rows={rankedRows}
          gap={gap}
          expandedKey={expandedKey}
          onToggleRow={(key) => setExpanded(expandedKey === key ? null : key)}
          renderExpanded={renderExpanded}
          onAddScenario={() => {
            setEditingId(null);
            setAdding(true);
          }}
          addingEditor={
            showAddEditor ? (
              <InlineScenarioEditor
                profileId={activeProfileId!}
                household={household!}
                assumptions={workingSet!}
                asOf={asOf}
                towns={towns}
                onSaved={reloadAfterMutation}
                onCancel={() => setAdding(false)}
              />
            ) : null
          }
        />
      )}
    </main>
  );
}
