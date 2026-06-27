// composite — per-metric breakdown + missing-weight renormalization (Vitest, types stripped).
//
// The explainable scoring core (TOWN-01/TOWN-03): per town, build the itemized per-metric breakdown
// the UI-SPEC matrix renders, drop missing metrics WITHOUT imputing (D-03 — a missing metric is never
// 0/worst), renormalize the PRESENT weights to sum 1, and weighted-sum the normalized values into a
// dimensionless composite STRING (never `Money` — the score isn't dollars). Worked-example oracle
// strings were hand-derived against the real `Dec` clone (34-sig-digit HALF_EVEN); assert EXACT
// equality, never `toBeCloseTo`. Edge cases (all-missing, Σpresent==0, amenities sub-composite)
// guard against the NaN/0-impute threats (T-05-10/T-05-12).
import { describe, test, expect } from 'vitest';
import { Dec } from '../money/decimal-config.js';
import { computeComposite, type MetricInput } from './composite.js';

/** The worked example (RESEARCH §Code Examples L356-367): school + millRate present, price missing. */
const WORKED: readonly MetricInput[] = [
  { metric: 'school', rawValue: '8', direction: 'higherBetter', range: { min: '1', max: '10' }, weight: '0.20' },
  { metric: 'millRate', rawValue: '6', direction: 'lowerBetter', range: { min: '4', max: '16' }, weight: '0.15' },
  { metric: 'medianPrice', rawValue: null, direction: 'lowerBetter', range: { min: '400000', max: '2500000' }, weight: '0.30' },
];

describe('computeComposite — present-weight-renormalized weighted sum + breakdown (TOWN-01, D-03/D-10)', () => {
  test('worked example: composite is the EXACT present-weight-renormalized weighted sum', () => {
    // normalize(school)   = (8-1)/(10-1)   = 0.7777...  higherBetter, weight 0.20
    // normalize(millRate) = (16-6)/(16-4)  = 0.8333...  lowerBetter,  weight 0.15
    // medianPrice MISSING (weight 0.30 dropped) → present Σweight = 0.35
    // composite = 0.7777*(0.20/0.35) + 0.8333*(0.15/0.35)
    const { composite } = computeComposite(WORKED);
    expect(composite).toBe('0.8015873015873015873015873015873016');
  });

  test('the MISSING metric is dropped: { missing:true, rawValue:null, normalizedValue:null, weightedContribution:null }', () => {
    const { metrics } = computeComposite(WORKED);
    const price = metrics.find((m) => m.metric === 'medianPrice');
    expect(price).toMatchObject({
      missing: true,
      rawValue: null,
      normalizedValue: null,
      weightedContribution: null,
    });
  });

  test('each PRESENT contribution carries the CONFIGURED weight (not the renormalized one) + its direction', () => {
    const { metrics } = computeComposite(WORKED);
    const school = metrics.find((m) => m.metric === 'school');
    const mill = metrics.find((m) => m.metric === 'millRate');
    expect(school).toMatchObject({ weight: '0.20', direction: 'higherBetter', missing: false });
    expect(mill).toMatchObject({ weight: '0.15', direction: 'lowerBetter', missing: false });
    expect(school?.normalizedValue).toBe('0.7777777777777777777777777777777778');
    expect(mill?.normalizedValue).toBe('0.8333333333333333333333333333333333');
  });

  test('present weightedContributions sum EXACTLY to the composite (Dec equality)', () => {
    const { composite, metrics } = computeComposite(WORKED);
    const sum = metrics
      .filter((m) => m.weightedContribution !== null)
      .reduce((acc, m) => acc.plus(new Dec(m.weightedContribution as string)), new Dec(0));
    expect(sum.toFixed()).toBe(composite);
    expect(new Dec(sum).equals(new Dec(composite as string))).toBe(true);
  });

  test('ALL metrics missing → composite null; every contribution missing:true with null values (never 0)', () => {
    const allMissing: readonly MetricInput[] = WORKED.map((m) => ({ ...m, rawValue: null }));
    const { composite, metrics } = computeComposite(allMissing);
    expect(composite).toBeNull();
    for (const m of metrics) {
      expect(m.missing).toBe(true);
      expect(m.normalizedValue).toBeNull();
      expect(m.weightedContribution).toBeNull();
      expect(m.normalizedValue).not.toBe('0');
      expect(m.weightedContribution).not.toBe('0');
    }
  });

  test('Σ present weight == 0 (all present weighted "0") → composite null, present contributions still itemized', () => {
    const zeroWeighted: readonly MetricInput[] = [
      { metric: 'school', rawValue: '8', direction: 'higherBetter', range: { min: '1', max: '10' }, weight: '0' },
      { metric: 'millRate', rawValue: '6', direction: 'lowerBetter', range: { min: '4', max: '16' }, weight: '0' },
    ];
    const { composite, metrics } = computeComposite(zeroWeighted);
    expect(composite).toBeNull();
    // present (not missing), itemized with normalized values, but no weighted contribution
    for (const m of metrics) {
      expect(m.missing).toBe(false);
      expect(m.normalizedValue).not.toBeNull();
      expect(m.weightedContribution).toBeNull();
    }
  });

  describe('amenities sub-composite (a metric whose normalized value is itself a renormalized sub-sum)', () => {
    const amenitiesWithGap: MetricInput = {
      metric: 'amenities',
      rawValue: null,
      direction: 'higherBetter',
      range: { min: '0', max: '100' },
      weight: '0.10',
      subMetrics: [
        { metric: 'walkability', rawValue: '88', direction: 'higherBetter', range: { min: '0', max: '100' }, weight: '0.30' },
        { metric: 'transit', rawValue: null, direction: 'higherBetter', range: { min: '0', max: '100' }, weight: '0.25' },
        { metric: 'dining', rawValue: '90', direction: 'higherBetter', range: { min: '0', max: '100' }, weight: '0.25' },
        { metric: 'parks', rawValue: '70', direction: 'higherBetter', range: { min: '0', max: '100' }, weight: '0.20' },
      ],
    };

    test('a missing SUB-metric is dropped + present sub-weights renormalized; sub weightedContributions sum to the amenities normalizedValue', () => {
      const { metrics } = computeComposite([amenitiesWithGap]);
      const amenities = metrics.find((m) => m.metric === 'amenities');
      expect(amenities?.missing).toBe(false);
      expect(amenities?.normalizedValue).not.toBeNull();
      const subs = amenities?.subMetrics ?? [];
      const transit = subs.find((s) => s.metric === 'transit');
      expect(transit).toMatchObject({ missing: true, normalizedValue: null, weightedContribution: null });
      // The present sub weightedContributions renormalize to the amenities normalizedValue.
      const subSum = subs
        .filter((s) => s.weightedContribution !== null)
        .reduce((acc, s) => acc.plus(new Dec(s.weightedContribution as string)), new Dec(0));
      expect(subSum.toFixed()).toBe(amenities?.normalizedValue);
    });

    test('ALL amenity sub-metrics missing → the amenities metric itself is missing:true and drops from the top-level renormalization', () => {
      const allSubMissing: MetricInput = {
        ...amenitiesWithGap,
        subMetrics: (amenitiesWithGap.subMetrics ?? []).map((s) => ({ ...s, rawValue: null })),
      };
      // school present so there IS a top-level composite; amenities must drop out cleanly.
      const inputs: readonly MetricInput[] = [
        { metric: 'school', rawValue: '8', direction: 'higherBetter', range: { min: '1', max: '10' }, weight: '0.20' },
        allSubMissing,
      ];
      const { composite, metrics } = computeComposite(inputs);
      const amenities = metrics.find((m) => m.metric === 'amenities');
      expect(amenities?.missing).toBe(true);
      expect(amenities?.normalizedValue).toBeNull();
      expect(amenities?.weightedContribution).toBeNull();
      // amenities dropped → school is the only present metric → composite == its normalized value.
      expect(composite).toBe('0.7777777777777777777777777777777778');
    });
  });
});
