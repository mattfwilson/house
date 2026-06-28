// profile-form.ts — the PURE form helpers behind the profile editor (no React, no I/O). It owns the
// two edge transforms the editor needs and NOTHING else (D-16): it holds NO validation schema — every
// rule still lives in the core `parseProfile`/`HouseholdSchema` boundary. Two responsibilities:
//
//   1. `formToRawProfile` — convert each form value to a canonical decimal STRING at the edge so a
//      bare-number money value can NEVER cross to the Server Action (T-7-04). A JS `number` is
//      stringified WITHOUT any arithmetic; an already-string field passes through verbatim (so the
//      core regex — not this layer — judges canonicality). There is no `Number()` money math here.
//   2. `fieldErrorsFromZod` — project a core parse failure's `issues[]` onto a `{ leaf -> message }`
//      map for per-field display (T-7-01). Duck-typed on `.issues` so `zod` need not be imported and a
//      non-Zod value (or `undefined`) yields an empty map — the editor surfaces ONLY what core rejected.

/** The nine `Household` leaves in display order, each with its human label (UI-SPEC Label role). */
export const HOUSEHOLD_FIELDS = [
  { key: 'grossAnnualIncome', label: 'Gross annual income' },
  { key: 'existingMonthlyDebt', label: 'Monthly debt' },
  { key: 'targetSavingsRate', label: 'Target savings rate' },
  { key: 'availableNetWorth', label: 'Available net worth' },
  { key: 'currentRent', label: 'Current rent' },
  { key: 'downPaymentCash', label: 'Down-payment cash' },
  { key: 'reserve', label: 'Reserve' },
  { key: 'currentAnnualSavings', label: 'Current annual savings' },
  { key: 'targetAnnualRetirementSpend', label: 'Target retirement spend' },
] as const;

/** The union of the nine Household leaf keys (derived from {@link HOUSEHOLD_FIELDS} — single source). */
export type HouseholdFieldKey = (typeof HOUSEHOLD_FIELDS)[number]['key'];

/** A form's nine leaf values — each may be a raw string (from a text input) or a bare JS number. */
export type ProfileFormValues = Readonly<Record<HouseholdFieldKey, string | number>>;

/** The raw, all-string profile shape `parseProfile` expects (identity + the nine decimal-string leaves). */
export type RawProfile = Record<string, string>;

/**
 * Convert one form value to a decimal STRING at the edge. A JS `number` is stringified with no
 * arithmetic (so `120000 -> "120000"`, `0.4 -> "0.4"`); a string passes through verbatim so the core
 * regex — not this layer — decides canonicality (D-16: no duplicated validation). NOT a money cast.
 */
function toDecimalString(value: string | number): string {
  return typeof value === 'number' ? String(value) : value;
}

/**
 * Build the raw `{ id?, name, ...nine leaves }` object `parseProfile` validates. Every leaf is forced
 * to a string at this edge so no bare-number money reaches the Server Action (T-7-04); `id` is omitted
 * when creating (the action mints/keeps identity) and present when editing.
 */
export function formToRawProfile(
  values: ProfileFormValues,
  name: string,
  id?: string,
): RawProfile {
  const raw: RawProfile = { name };
  if (id !== undefined) raw.id = id;
  for (const { key } of HOUSEHOLD_FIELDS) {
    raw[key] = toDecimalString(values[key]);
  }
  return raw;
}

/** Duck-typed Zod error shape — an object carrying an `issues[]` array (so `zod` need not be imported). */
interface ZodLikeIssue {
  readonly path?: unknown;
  readonly message?: unknown;
}

/**
 * Project a core parse failure onto a `{ leafKey -> message }` map for per-field display (D-16). The
 * last path segment is the field key; an issue with no path falls back to `_form`. A non-Zod value or
 * `undefined` yields an empty map — the editor shows ONLY the core's rejection, never a fabricated rule.
 */
export function fieldErrorsFromZod(error: unknown): Record<string, string> {
  const issues =
    typeof error === 'object' && error !== null && Array.isArray((error as { issues?: unknown }).issues)
      ? ((error as { issues: readonly ZodLikeIssue[] }).issues)
      : [];
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const path = Array.isArray(issue.path) ? issue.path : [];
    const key = path.length > 0 ? String(path[path.length - 1]) : '_form';
    if (map[key] === undefined && typeof issue.message === 'string') {
      map[key] = issue.message;
    }
  }
  return map;
}
