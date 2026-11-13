/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
  InteractionContentfulPaint as _InteractionContentfulPaint,
  LargestContentfulPaint as _LargestContentfulPaint,
  LayoutShift as _LayoutShift,
  LayoutShiftAttribution as _LayoutShiftAttribution,
  PerformanceLongAnimationFrameTiming as _PerformanceLongAnimationFrameTiming,
  PerformanceScriptTiming as _PerformanceScriptTiming,
  PerformanceSoftNavigation as _PerformanceSoftNavigation,
  ScriptInvokerType as _ScriptInvokerType,
  ScriptWindowAttribution as _ScriptWindowAttribution,
} from './types/entries.js';

export * from './types/index.js';

// --------------------------------------------------------------------------
// Everything below is modifications to built-in modules.
// --------------------------------------------------------------------------

interface PerformanceEntryMap {
  'event': PerformanceEventTiming;
  'interaction-contentful-paint': InteractionContentfulPaint;
  'layout-shift': LayoutShift;
  'navigation': PerformanceNavigationTiming;
  'paint': PerformancePaintTiming;
  'resource': PerformanceResourceTiming;
  'soft-navigation': PerformanceSoftNavigation;
}

// Update built-in types to be more accurate.
declare global {
  interface Document {
    // https://wicg.github.io/nav-speculation/prerendering.html#document-prerendering
    prerendering?: boolean;
    // https://wicg.github.io/page-lifecycle/#sec-api
    wasDiscarded?: boolean;
  }

  interface Performance {
    getEntriesByType<K extends keyof PerformanceEntryMap>(
      type: K,
    ): PerformanceEntryMap[K][];
  }

  // https://w3c.github.io/event-timing/#sec-modifications-perf-timeline
  interface PerformanceEntry {
    navigationId?: number;
  }

  // https://w3c.github.io/event-timing/#sec-modifications-perf-timeline
  interface PerformanceObserverInit {
    durationThreshold?: number;
  }

  // https://wicg.github.io/nav-speculation/prerendering.html#performance-navigation-timing-extension
  interface PerformanceNavigationTiming extends PerformanceEntry {
    activationStart?: number;
  }

  // https://wicg.github.io/event-timing/#sec-performance-event-timing
  interface PerformanceEventTiming extends PerformanceEntry {
    duration: DOMHighResTimeStamp;
    readonly interactionId: number;
    readonly targetSelector: string;
  }

  // The interfaces below are defined in `./types/entries.ts` and exposed here
  // as globals for backwards compatibility. They have to be interfaces rather
  // than type aliases so they merge with TypeScript's DOM lib declarations.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  interface LayoutShiftAttribution extends _LayoutShiftAttribution {}
  interface LayoutShift extends _LayoutShift {}
  interface LargestContentfulPaint extends _LargestContentfulPaint {}
  interface InteractionContentfulPaint extends _InteractionContentfulPaint {}
  interface PerformanceSoftNavigation extends _PerformanceSoftNavigation {}

  var PerformanceSoftNavigation: {
    prototype: PerformanceSoftNavigation;
  };

  export type ScriptInvokerType = _ScriptInvokerType;
  export type ScriptWindowAttribution = _ScriptWindowAttribution;
  interface PerformanceScriptTiming extends _PerformanceScriptTiming {}
  interface PerformanceLongAnimationFrameTiming extends _PerformanceLongAnimationFrameTiming {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}
