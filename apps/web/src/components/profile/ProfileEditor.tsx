'use client';
// ProfileEditor — the create/edit/delete form for a financial profile (PROF-01/02/03, D-16). It is the
// MISSING entry path for the nine-leaf `Household` the whole affordability/FI engine runs on: a brand-
// new user creates the FIRST profile here, and existing ones are edited or deleted.
//
// VALIDATION BOUNDARY (D-16 / T-7-01): this editor holds NO schema. Every field is a plain string; on
// save `formToRawProfile` forces each to a canonical decimal string at the edge (no bare-number money —
// T-7-04) and `saveProfileFormAction` validates the whole raw through the core `parseProfile` boundary,
// returning per-field errors which are surfaced inline. The editor never re-implements a rule and does
// no `Number()` money math.
//
// SOFT CAP (T-7-08): the ≤2-profile cap is a SERVICE invariant (`saveProfile`). `maxProfiles` is shown
// as display copy only — the editor NEVER re-checks the count or gates the Save button on it.
//
// Boundary note: a client component — it imports only the 'use server' profile actions and the pure
// `profile-form` helpers, never `@house/app`/`container.server` (the eslint client-leak guard).
import { useState } from 'react';
import { saveProfileFormAction, deleteProfileAction } from '@/app/actions/profiles';
import type { ProfileDTO } from '@/lib/dto/profile';
import { useSelection } from '@/store/selection';
import {
  HOUSEHOLD_FIELDS,
  formToRawProfile,
  type HouseholdFieldKey,
  type ProfileFormValues,
} from '@/components/profile/profile-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/** The editable string form: a free-text name + the nine Household leaves as plain strings. */
type FieldValues = Record<HouseholdFieldKey, string>;

function emptyFields(): FieldValues {
  const out = {} as FieldValues;
  for (const { key } of HOUSEHOLD_FIELDS) out[key] = '';
  return out;
}

function fieldsFrom(initial: ProfileDTO): FieldValues {
  const out = {} as FieldValues;
  for (const { key } of HOUSEHOLD_FIELDS) out[key] = initial[key];
  return out;
}

export interface ProfileEditorProps {
  /** Edit-mode prefill (its `id` is preserved on save); null/undefined = create a new profile. */
  readonly initial?: ProfileDTO | null;
  /** The ≤2-profile soft cap — DISPLAY COPY ONLY (never a client-side cap check). */
  readonly maxProfiles: number;
  /** Called with the saved profile after a successful create/edit (the active profile is also set). */
  readonly onSaved: (profile: ProfileDTO) => void;
  /** Optional cancel affordance (the empty-state create has nothing to cancel back to). */
  readonly onCancel?: () => void;
  /** Called after a successful delete (edit mode only). */
  readonly onDeleted?: () => void;
}

export function ProfileEditor({
  initial = null,
  maxProfiles,
  onSaved,
  onCancel,
  onDeleted,
}: ProfileEditorProps) {
  const setActiveProfile = useSelection((s) => s.setActiveProfile);

  const [name, setName] = useState<string>(initial?.name ?? '');
  const [fields, setFields] = useState<FieldValues>(() =>
    initial !== null ? fieldsFrom(initial) : emptyFields(),
  );
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = initial !== null;

  const setField = (key: HouseholdFieldKey, value: string): void =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    // Mint a stable id when creating; preserve it when editing. Every leaf is forced to a decimal
    // string at the edge — no bare-number money crosses to the action (T-7-04).
    const id = initial?.id ?? crypto.randomUUID();
    const raw = formToRawProfile(fields as ProfileFormValues, name, id);
    const result = await saveProfileFormAction(raw);
    setSaving(false);
    if (result.ok && result.saved) {
      // 07-06: a saved profile becomes the active one so the cockpit/header pick it up immediately.
      setActiveProfile(result.saved.id);
      onSaved(result.saved);
      return;
    }
    if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    if (result.formError) setFormError(result.formError);
  };

  const handleDelete = async (): Promise<void> => {
    if (initial === null) return;
    try {
      await deleteProfileAction(initial.id);
      onDeleted?.();
    } catch {
      // A profile that still owns saved scenarios cannot be deleted (the scenarios->profiles FK is
      // RESTRICT). Surface that as a form-level message rather than a crash.
      setFormError(
        "Couldn't delete this profile — remove its saved scenarios first, then try again.",
      );
    }
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-md border border-border bg-card/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{isEdit ? 'Edit profile' : 'New profile'}</h3>
        <p className="text-xs text-muted-foreground">
          You can save up to {maxProfiles} profiles.
        </p>
      </div>

      {/* Name — the profile's human label (e.g. "Matt & Wife"). */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name" className="text-xs font-semibold">
          Profile name
        </Label>
        <Input
          id="profile-name"
          type="text"
          value={name}
          aria-label="Profile name"
          onChange={(event) => setName(event.target.value)}
        />
        {fieldErrors.name ? (
          <span className="text-[11px] text-destructive">{fieldErrors.name}</span>
        ) : null}
      </div>

      {/* The nine Household leaves — the data the engine runs on (PROF-01). Dense md field spacing. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {HOUSEHOLD_FIELDS.map(({ key, label }) => (
          <ProfileField
            key={key}
            field={key}
            label={label}
            value={fields[key]}
            error={fieldErrors[key]}
            onChange={setField}
          />
        ))}
      </div>

      {formError ? (
        <p role="alert" className="text-xs leading-snug text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        {isEdit ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  aria-label="Delete profile"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete profile</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &quot;{initial?.name}&quot; and all of its saved scenarios.
                  This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => void handleDelete()}
                >
                  Delete profile
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </form>
  );
}

/** A single labelled text field (decimal-string passthrough) with its surfaced core field error. */
function ProfileField({
  field,
  label,
  value,
  error,
  onChange,
}: {
  readonly field: HouseholdFieldKey;
  readonly label: string;
  readonly value: string;
  readonly error?: string | undefined;
  readonly onChange: (field: HouseholdFieldKey, value: string) => void;
}) {
  const id = `profile-${field}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(field, event.target.value)}
        className="num-readout"
      />
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
