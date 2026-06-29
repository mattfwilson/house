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
// Scope for THIS plan: wire both switchers to the list actions + the selection store. 07-11 adds the
// "Manage profiles" entry + the empty-state "Create a profile" CTA (both linking to /profile) without
// disturbing the D-02 switcher; the switchers driving a live recompute land with the cockpit (07-07/08).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Users } from 'lucide-react';
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
      {/* Brand mark doubles as the persistent home/cockpit nav — the only always-present way back to
          `/` from every route (07-10 gap fix). Teal stays reserved for the Building2 mark + primary CTA;
          the "House" text stays slate. Affordance: cursor-pointer + a slate hover. */}
      <Link
        href="/"
        aria-label="House — go to cockpit"
        className="flex items-center gap-2 text-sm font-semibold text-card-foreground hover:text-foreground"
      >
        <Building2 className="size-4 text-primary" aria-hidden="true" />
        <span>House</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {profiles.length === 0 ? (
          // Empty-state entry path (07-11): a brand-new user has no profile to switch to, so the chrome
          // offers a teal primary CTA into /profile instead of an empty switcher.
          <Link
            href="/profile"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create a profile
          </Link>
        ) : (
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
        )}

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

        {/* Persistent "Manage profiles" entry (07-11) — an icon-only nav affordance (44px hit target,
            aria-label per the UI-SPEC). Slate, NOT teal: teal stays reserved for the active/primary CTA. */}
        <Link
          href="/profile"
          aria-label="Manage profiles"
          className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Users className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
