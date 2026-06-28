'use client';
// InlineScenarioEditor — the Add/Edit scenario surface (D-14/D-15). It is an INLINE expanding editor
// row inside the comparison table — NOT a modal, NOT a separate /new route. Manual entry is the
// DEFAULT path (D-14): plain numeric fields whose raw values are passed straight through as canonical
// decimal STRINGS; the OPTIONAL "prefill from a sample listing" affordance (MockListingsProvider) is a
// convenience starting point only, never the required entry point.
//
// VALIDATION BOUNDARY (D-16): this editor holds NO schema. The money/rate fields cross verbatim as
// strings; the only conversions are the two bare COUNTS (`termMonths`/`holdingYears`) via `parseInt`
// (the money→float guard does not apply — these are counts, not money, and parseInt is not the
// banned float-cast call). On save, `saveScenarioFormAction` validates every leaf through the
// core Zod boundary and returns field-level errors which are surfaced inline — the editor never
// re-implements a rule. Delete uses the destructive-red alert-dialog with the locked confirmation copy.
import { useEffect, useState } from 'react';
import type { ScenarioInputs, AssumptionSet } from '@house/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  saveScenarioFormAction,
  browseListingsAction,
  type ListingDTO,
} from '@/app/actions/cockpit';
import { deleteScenarioAction } from '@/app/actions/scenarios';

/** Convert a count field to an integer WITHOUT the banned money→float cast (these are counts). */
function toCount(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed; // 0 fails the core's positive() check → surfaced as a field error
}

/** The editable string form (every field a plain string; counts parsed only at save). */
interface FormState {
  label: string;
  price: string;
  downPaymentPct: string;
  annualRate: string;
  termMonths: string;
  holdingYears: string;
  town: string;
  insuranceAnnual: string;
  hoaMonthly: string;
  monthlyRent: string;
}

function initialForm(initial: ScenarioInputs | null, fallbackTown: string): FormState {
  if (initial !== null) {
    return {
      label: initial.label,
      price: initial.price,
      downPaymentPct: initial.downPaymentPct,
      annualRate: initial.annualRate,
      termMonths: String(initial.termMonths),
      holdingYears: String(initial.holdingYears),
      town: initial.town,
      insuranceAnnual: initial.insuranceAnnual,
      hoaMonthly: initial.hoaMonthly,
      monthlyRent: initial.monthlyRent,
    };
  }
  return {
    label: '',
    price: '',
    downPaymentPct: '0.20',
    annualRate: '0.06375',
    termMonths: '360',
    holdingYears: '30',
    town: fallbackTown,
    insuranceAnnual: '1800',
    hoaMonthly: '0',
    monthlyRent: '',
  };
}

export interface InlineScenarioEditorProps {
  readonly profileId: string;
  readonly household: unknown;
  readonly assumptions: AssumptionSet;
  readonly asOf: string;
  readonly towns: readonly string[];
  /** Edit-mode prefill; null for Add. */
  readonly initial?: ScenarioInputs | null;
  /** Edit-mode scenario id; null/undefined for Add (a fresh id is minted). */
  readonly scenarioId?: string | null;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
  readonly onDeleted?: () => void;
}

export function InlineScenarioEditor({
  profileId,
  household,
  assumptions,
  asOf,
  towns,
  initial = null,
  scenarioId = null,
  onSaved,
  onCancel,
  onDeleted,
}: InlineScenarioEditorProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(initial, towns[0] ?? ''));
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listings, setListings] = useState<readonly ListingDTO[]>([]);

  // Load the optional sample listings once (D-14 — convenience prefill, never required).
  useEffect(() => {
    let active = true;
    void browseListingsAction().then((list) => {
      if (active) setListings(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const set = (key: keyof FormState, value: string): void =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const prefillFromListing = (id: string | null): void => {
    const listing = listings.find((l) => l.id === id);
    if (listing === undefined) return;
    setForm((prev) => ({
      ...prev,
      label: prev.label === '' ? `${listing.address}, ${listing.town}` : prev.label,
      price: listing.listPrice,
      town: listing.town,
    }));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    // Build the raw scenario — money/rate fields verbatim (decimal strings), counts parsed.
    const scenario = {
      label: form.label,
      price: form.price,
      downPaymentPct: form.downPaymentPct,
      annualRate: form.annualRate,
      termMonths: toCount(form.termMonths),
      holdingYears: toCount(form.holdingYears),
      town: form.town,
      insuranceAnnual: form.insuranceAnnual,
      hoaMonthly: form.hoaMonthly,
      monthlyRent: form.monthlyRent,
    };
    const result = await saveScenarioFormAction({
      id: scenarioId ?? crypto.randomUUID(),
      profileId,
      name: form.label,
      asOf,
      household,
      assumptions,
      scenario,
    });
    setSaving(false);
    if (result.ok) {
      onSaved();
      return;
    }
    if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    if (result.formError) setFormError(result.formError);
  };

  const handleDelete = async (): Promise<void> => {
    if (scenarioId === null) return;
    await deleteScenarioAction(scenarioId);
    onDeleted?.();
  };

  const isEdit = scenarioId !== null;

  return (
    <div className="flex flex-col gap-4 bg-secondary/20 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{isEdit ? 'Edit scenario' : 'Add scenario'}</h3>
        {listings.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Prefill from a sample listing</span>
            <Select onValueChange={prefillFromListing}>
              <SelectTrigger size="sm" aria-label="Prefill from a sample listing" className="min-w-56">
                <SelectValue placeholder="Optional — manual entry is the default" />
              </SelectTrigger>
              <SelectContent>
                {listings.map((listing) => (
                  <SelectItem key={listing.id} value={listing.id}>
                    {listing.address} — {listing.town}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <EditorField label="Label" field="label" form={form} errors={fieldErrors} onChange={set} />
        <EditorField label="Price ($)" field="price" form={form} errors={fieldErrors} onChange={set} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="editor-town" className="text-xs font-semibold">
            Town
          </Label>
          <Select
            value={form.town}
            onValueChange={(value) => {
              if (value !== null) set('town', value);
            }}
          >
            <SelectTrigger id="editor-town" size="sm" aria-label="Town">
              <SelectValue placeholder="Select a town" />
            </SelectTrigger>
            <SelectContent>
              {towns.map((town) => (
                <SelectItem key={town} value={town}>
                  {town}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.town ? (
            <span className="text-[11px] text-destructive">{fieldErrors.town}</span>
          ) : null}
        </div>
        <EditorField
          label="Down payment (fraction, 0–1)"
          field="downPaymentPct"
          form={form}
          errors={fieldErrors}
          onChange={set}
        />
        <EditorField
          label="Mortgage rate (e.g. 0.06375)"
          field="annualRate"
          form={form}
          errors={fieldErrors}
          onChange={set}
        />
        <EditorField label="Term (months)" field="termMonths" form={form} errors={fieldErrors} onChange={set} />
        <EditorField label="Holding (years)" field="holdingYears" form={form} errors={fieldErrors} onChange={set} />
        <EditorField
          label="Insurance ($/yr)"
          field="insuranceAnnual"
          form={form}
          errors={fieldErrors}
          onChange={set}
        />
        <EditorField label="HOA ($/mo)" field="hoaMonthly" form={form} errors={fieldErrors} onChange={set} />
        <EditorField
          label="Market rent ($/mo)"
          field="monthlyRent"
          form={form}
          errors={fieldErrors}
          onChange={set}
        />
      </div>

      {formError ? (
        <p role="alert" className="text-xs leading-snug text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving…' : 'Save scenario'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        {isEdit ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  aria-label="Delete scenario"
                />
              }
            >
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete scenario</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &quot;{form.label}&quot; and its saved snapshot. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => void handleDelete()}
                >
                  Delete scenario
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}

/** A single labelled text field (decimal string passthrough) with its surfaced core field error. */
function EditorField({
  label,
  field,
  form,
  errors,
  onChange,
}: {
  readonly label: string;
  readonly field: keyof FormState;
  readonly form: FormState;
  readonly errors: Readonly<Record<string, string>>;
  readonly onChange: (field: keyof FormState, value: string) => void;
}) {
  const id = `editor-${field}`;
  const error = errors[field];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={form[field]}
        aria-label={label}
        onChange={(event) => onChange(field, event.target.value)}
        className="num-readout"
      />
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
