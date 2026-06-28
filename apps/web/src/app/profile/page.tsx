'use client';
// /profile — the dedicated profile-management route (PROF-02). It is the entry path a brand-new user
// needs: when no profile exists yet it renders the locked "Create a profile to get started" empty state
// with the `ProfileEditor` mounted in CREATE mode (the FIRST-profile path that seeds the whole engine);
// when profiles exist it lists each with an Edit affordance (opening the editor pre-filled, where the
// destructive-red delete lives) and an always-available "Add profile" affordance.
//
// SOFT CAP (T-7-08): the ≤2-profile cap is a SERVICE invariant. `MAX_PROFILES` is shown as display copy
// only — this route performs NO client-side count check and never gates the Add affordance on it; a
// save past the cap is rejected (and surfaced) by `saveProfile`, not hidden here.
//
// Boundary note: this is an `app/**` route (server tier by location) but marked `'use client'` for the
// interactive list — it reads server truth only through the 'use server' profile actions.
import { useCallback, useEffect, useState } from 'react';
import {
  listProfilesAction,
  maxProfilesAction,
} from '@/app/actions/profiles';
import type { ProfileDTO } from '@/lib/dto/profile';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { formatUSD } from '@/lib/format';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const [profiles, setProfiles] = useState<readonly ProfileDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [maxProfiles, setMaxProfiles] = useState(2);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    void listProfilesAction().then((list) => {
      setProfiles(list);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    reload();
    void maxProfilesAction().then(setMaxProfiles);
  }, [reload]);

  const afterMutation = (): void => {
    setEditingId(null);
    setCreating(false);
    reload();
  };

  // ── Empty state: the FIRST-profile create path (locked UI-SPEC copy) ──────
  if (loaded && profiles.length === 0) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Create a profile to get started</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Add your household — net worth, income, savings rate, current rent, and target retirement
            spend. You can save up to two profiles.
          </p>
        </div>
        <ProfileEditor maxProfiles={maxProfiles} onSaved={afterMutation} />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Manage profiles</h1>
        <p className="text-sm text-muted-foreground">
          You can save up to {maxProfiles} profiles.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {profiles.map((profile) => (
          <li key={profile.id}>
            {editingId === profile.id ? (
              <ProfileEditor
                initial={profile}
                maxProfiles={maxProfiles}
                onSaved={afterMutation}
                onCancel={() => setEditingId(null)}
                onDeleted={afterMutation}
              />
            ) : (
              <ProfileCard profile={profile} onEdit={() => setEditingId(profile.id)} />
            )}
          </li>
        ))}
      </ul>

      {/* Add affordance — always available (no client-side cap check, T-7-08). */}
      {creating ? (
        <ProfileEditor
          maxProfiles={maxProfiles}
          onSaved={afterMutation}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
            Add profile
          </Button>
        </div>
      )}
    </main>
  );
}

/** A read-back summary card for a saved profile (dollars formatted at the display edge). */
function ProfileCard({
  profile,
  onEdit,
}: {
  readonly profile: ProfileDTO;
  readonly onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card/40 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">{profile.name}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span className="num-readout">Net worth {formatUSD(profile.availableNetWorth)}</span>
          <span className="num-readout">Income {formatUSD(profile.grossAnnualIncome)}</span>
          <span className="num-readout">Savings rate {profile.targetSavingsRate}</span>
          <span className="num-readout">Rent {formatUSD(profile.currentRent)}/mo</span>
          <span className="num-readout">
            Retirement spend {formatUSD(profile.targetAnnualRetirementSpend)}/yr
          </span>
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label="Edit profile">
        Edit
      </Button>
    </div>
  );
}
