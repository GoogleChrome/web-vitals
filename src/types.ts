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

export interface Metric {
  // The name of the metric (in acronym form).
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';

  // The current value of the metric.
  value: number;

  // The delta between the current value and the last-reported value.
  // On the first report, `delta` and `value` will always be the same.
  delta: number;

  // A unique ID representing this particular metric instance. This ID can
  // be used by an analytics tool to dedupe multiple values sent for the same
  // metric instance, or to group multiple deltas together and calculate a
  // total. It can also be used to differentiate multiple different metric
  // instances sent from the same page, which can happen if the page is
  // restored from the back/forward cache (in that case new metrics object
  // get created).
  id: string;

  // Any performance entries relevant to the metric value calculation.
  // The array may also be empty if the metric value was not based on any
  // entries (e.g. a CLS value of 0 given no layout shifts).
  entries: (PerformanceEntry | LayoutShift | FirstInputPolyfillEntry | NavigationTimingPolyfillEntry)[];

  // For regular navigations, the type will be the same as the type indicated
  // by the Navigation Timing API (or `undefined` if the browser doesn't
  // support that API). For pages that are restored from the bfcache, this
  // value will be 'back_forward_cache'.
  navigationType:  NavigationTimingType | 'back_forward_cache' | undefined;
}

export interface ReportCallback {
  (metric: Metric): void;
}

export interface ReportOpts {
  reportAllChanges?: boolean;
  durationThreshold?: number;
}

interface PerformanceEntryMap {
  'navigation': PerformanceNavigationTiming;
  'resource': PerformanceResourceTiming;
  'paint': PerformancePaintTiming;
}

declare global {
  interface Performance {
    getEntriesByType<K extends keyof PerformanceEntryMap>(type: K): PerformanceEntryMap[K][]
  }
}

// https://wicg.github.io/event-timing/#sec-performance-event-timing
export interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: DOMHighResTimeStamp;
  processingEnd: DOMHighResTimeStamp;
  duration: DOMHighResTimeStamp;
  cancelable?: boolean;
  target?: Element;
  interactionId?: number;
}

// https://wicg.github.io/layout-instability/#sec-layout-shift
export interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

export interface PerformanceObserverInit {
  durationThreshold?: number;
}

export type FirstInputPolyfillEntry =
    Omit<PerformanceEventTiming, 'processingEnd'>

export interface FirstInputPolyfillCallback {
  (entry: FirstInputPolyfillEntry): void;
}

export type NavigationTimingPolyfillEntry = Omit<PerformanceNavigationTiming,
    'initiatorType' | 'nextHopProtocol' | 'redirectCount' | 'transferSize' |
    'encodedBodySize' | 'decodedBodySize'>

export interface WebVitalsGlobal {
  firstInputPolyfill: (onFirstInput: FirstInputPolyfillCallback) => void;
  resetFirstInputPolyfill: () => void;
  firstHiddenTime: number;
}

declare global {
  interface Window {
    webVitals: WebVitalsGlobal;

    // Build flags:
    __WEB_VITALS_POLYFILL__: boolean;
  }
}
