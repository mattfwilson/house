// format.test.ts — the display-edge contract for the two client-side formatting helpers
// (07-UI-SPEC §Color color-honesty + §Copywriting anti-funnel locked strings). These prove the
// two load-bearing invariants of the presentation layer:
//   1. formatUSD renders a canonical decimal STRING as 2dp en-US currency (the `Number()` is the
//      LAST step, feeding only Intl.NumberFormat — never re-entering money math; Pitfall 5).
//   2. fiDeltaLabel emits the EXACT anti-funnel copy and is COLOR-HONEST: a delay is `tone:'delay'`
//      (amber), earlier is `tone:'earlier'` (neutral — NEVER a 'good'/green tone), and the
//      no-data / same-date cases are `tone:'none'`.
import { describe, expect, it } from 'vitest';
import { formatUSD, fiDeltaLabel } from './format.js';

describe('formatUSD (display edge — decimal string → 2dp USD)', () => {
  it('renders a canonical decimal string as 2dp en-US currency', () => {
    expect(formatUSD('1234.5')).toBe('$1,234.50');
  });

  it('rounds and groups larger values to 2dp with thousands separators', () => {
    expect(formatUSD('1000000')).toBe('$1,000,000.00');
    expect(formatUSD('0')).toBe('$0.00');
  });
});

describe('fiDeltaLabel (color-honest FI-date delta copy — D-04)', () => {
  it('a delay reads "+Y yr M mo later" with tone "delay" (amber)', () => {
    expect(fiDeltaLabel(40)).toEqual({ text: '+3 yr 4 mo later', tone: 'delay' });
  });

  it('earlier reads "Y yr M mo earlier" with tone "earlier" (neutral — NEVER green/good)', () => {
    const label = fiDeltaLabel(-14);
    expect(label).toEqual({ text: '1 yr 2 mo earlier', tone: 'earlier' });
    // Anti-funnel guard: reaching FI sooner must NOT be celebrated as success.
    expect(label.tone).not.toBe('good');
    expect(label.tone).not.toBe('green');
  });

  it('a zero delta is tone "none" (no emphasis)', () => {
    expect(fiDeltaLabel(0).tone).toBe('none');
  });

  it('a null delta renders the em-dash placeholder with tone "none"', () => {
    expect(fiDeltaLabel(null)).toEqual({ text: '—', tone: 'none' });
  });
});
