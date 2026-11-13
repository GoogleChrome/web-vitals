import type {
  CLSMetric,
  INPMetric,
  LargestContentfulPaint,
  LayoutShift,
  LCPMetric,
  PerformanceEventTiming,
  PerformanceSoftNavigation,
  TTFBMetric,
} from 'web-vitals/types';

// This fixture is type-checked against the built package, not executed. It is
// checked on its own so that the global augmentations from `web-vitals` are
// not part of the program.
function expectType<T>(_value: T): void {}

declare const cls: CLSMetric;
declare const inp: INPMetric;
declare const lcp: LCPMetric;
declare const ttfb: TTFBMetric;

expectType<LayoutShift[]>(cls.entries);
expectType<PerformanceEventTiming[]>(inp.entries);
expectType<number>(inp.entries[0].interactionId);
expectType<LargestContentfulPaint[]>(lcp.entries);
expectType<PerformanceNavigationTiming[] | PerformanceSoftNavigation[]>(
  ttfb.entries,
);

// @ts-expect-error `Document.wasDiscarded` is only added by the global
// augmentations in `web-vitals`, which `web-vitals/types` must not include.
expectType<boolean | undefined>(document.wasDiscarded);
