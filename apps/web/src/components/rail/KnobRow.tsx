// KnobRow — a single tunable assumption row in the docked rail (D-10). It is a thin presentational
// control: a Label (12px/600 — UI-SPEC Label role) over a numeric Input that holds and emits a
// canonical decimal STRING. It performs NO validation and NO money math (D-16 / T-7-04): the raw
// string the user types is passed straight through `onChange(path, value)` to the working set, and
// the core's Zod boundary at the recompute Server Action is the single place values are validated.
//
// The input is `type="text" inputMode="decimal"` ON PURPOSE: a native `type="number"` silently
// rewrites/clears partial input (a lone "-" or trailing "."), which would mangle the decimal string
// before it ever reaches the engine boundary. Keeping it a plain text field means the exact string
// crosses the boundary and `Number()` is never called here (the money→float edge is confined to
// lib/format.ts + charts/**). Figures render in Geist Mono via `.num-readout` so the rail aligns
// vertically with the comparison table (UI-SPEC §Typography). The teal `accent` affordance is
// reserved for the budget control per the UI-SPEC accent list.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface KnobRowProps {
  /** Human label (Label typography role). */
  readonly label: string;
  /** Dot-path into the working-set AssumptionSet (e.g. "returns.realAnnual"). */
  readonly path: string;
  /** The current canonical decimal-string value (empty string when the leaf is absent). */
  readonly value: string;
  /** Emit the raw decimal string for this knob's path — wired to working-set.updateKnob upstream. */
  readonly onChange: (path: string, value: string) => void;
  /** Reserve the teal active affordance for the budget control (UI-SPEC accent list). */
  readonly accent?: boolean;
  /** Optional unit / scale hint shown beneath the input (e.g. "annual (0.04 = 4%)"). */
  readonly hint?: string;
}

export function KnobRow({ label, path, value, onChange, accent, hint }: KnobRowProps) {
  const id = `knob-${path.replace(/\./g, '-')}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-card-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(path, event.target.value)}
        className={cn('num-readout', accent && 'border-primary focus-visible:ring-primary/50')}
      />
      {hint ? <span className="text-[11px] leading-tight text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
