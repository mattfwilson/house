'use client';

// Header.tsx — the persistent app chrome (D-02). A slate-800 instrument-panel bar, present on EVERY
// route via layout.tsx, carrying the profile switcher + the scenario switcher. The active selection
// lives in the ephemeral Zustand selection store (07-06) so the cockpit / heatmap / sensitivity
// routes all read the same active profile/scenario context.
//
// Boundary note: this is a CLIENT component (components/** tier). It imports only the 'use server'
// list actions (`@/app/actions/*`) — never `@house/app` or `container.server` (the eslint client-leak
// guard forbids those). `SavedScenarioMeta` is a TYPE-only `@house/core` import (erased at compile;
// pure shape, no native dep crosses into the client bundle — same pattern as the 07-06 stores).
//
// Scope for THIS plan: wire both switchers to the list actions + the selection store. The "Manage
// profiles" entry, the empty-state "Create a profile" CTA, and the profile editor land in 07-11; the
// switchers driving a live recompute land with the cockpit (07-07/07-08).

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { SavedScenarioMeta } from '@house/core';
import { listProfilesAction } from '@/app/actions/profiles';
import { listScenariosAction } from '@/app/actions/scenarios';
import type { ProfileDTO } from '@/lib/dto/profile';
import { useSelection } from '@/store/selection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function Header() {
  const activeProfileId = useSelection((s) => s.activeProfileId);
  const activeScenarioId = useSelection((s) => s.activeScenarioId);
  const setActiveProfile = useSelection((s) => s.setActiveProfile);
  const setActiveScenario = useSelection((s) => s.setActiveScenario);

  const [profiles, setProfiles] = useState<readonly ProfileDTO[]>([]);
  const [scenarios, setScenarios] = useState<readonly SavedScenarioMeta[]>([]);

  // Load the saved profiles once on mount (D-02 header context).
  useEffect(() => {
    let active = true;
    void listProfilesAction().then((list) => {
      if (active) setProfiles(list);
    });
    return () => {
      active = false;
    };
  }, []);

  // Load the active profile's saved scenarios whenever the active profile changes (D-02 inheritance).
  useEffect(() => {
    if (activeProfileId === null) {
      setScenarios([]);
      return;
    }
    let active = true;
    void listScenariosAction(activeProfileId).then((list) => {
      if (active) setScenarios(list);
    });
    return () => {
      active = false;
    };
  }, [activeProfileId]);

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 text-card-foreground">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {/* Teal mark — the one reserved-accent affordance in the chrome (UI-SPEC accent list). */}
        <Building2 className="size-4 text-primary" aria-hidden="true" />
        <span>House</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Select
          value={activeProfileId}
          onValueChange={(value) => {
            // Switching profiles resets the scenario context (its scenarios belong to the old profile).
            setActiveProfile(value);
            setActiveScenario(null);
          }}
        >
          <SelectTrigger aria-label="Switch profile" size="sm" className="min-w-44">
            <SelectValue placeholder="Select a profile" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeScenarioId}
          onValueChange={(value) => setActiveScenario(value)}
          disabled={activeProfileId === null || scenarios.length === 0}
        >
          <SelectTrigger aria-label="Switch scenario" size="sm" className="min-w-44">
            <SelectValue placeholder="Select a scenario" />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((scenario) => (
              <SelectItem key={scenario.id} value={scenario.id}>
                {scenario.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
