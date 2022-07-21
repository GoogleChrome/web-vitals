/*
 * Copyright 2022 Google LLC
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

import {FirstInputPolyfillEntry, NavigationTimingPolyfillEntry} from './polyfills.js';


export interface Metric {
  /**
   * The name of the metric (in acronym form).
   */
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';

  /**
   * The current value of the metric.
   */
  value: number;

  /**
   * The rating as to whether the metric value is within the "good",
   * "needs improvement", or "poor" thresholds of the metric.
   */
  rating: 'good' | 'needs-improvement' | 'poor';

  /**
   * The delta between the current value and the last-reported value.
   * On the first report, `delta` and `value` will always be the same.
   */
  delta: number;

  /**
   * A unique ID representing this particular metric instance. This ID can
   * be used by an analytics tool to dedupe multiple values sent for the same
   * metric instance, or to group multiple deltas together and calculate a
   * total. It can also be used to differentiate multiple different metric
   * instances sent from the same page, which can happen if the page is
   * restored from the back/forward cache (in that case new metrics object
   * get created).
   */
  id: string;

  /**
   * Any performance entries relevant to the metric value calculation.
   * The array may also be empty if the metric value was not based on any
   * entries (e.g. a CLS value of 0 given no layout shifts).
   */
  entries: (PerformanceEntry | LayoutShift | FirstInputPolyfillEntry | NavigationTimingPolyfillEntry)[];

  /**
   * For regular navigations, the type will be the same as the type indicated
   * by the Navigation Timing API (or `undefined` if the browser doesn't
   * support that API). For pages that are restored from the bfcache, this
   * value will be 'back_forward_cache'.
   */
  navigationType:  NavigationTimingType | 'back_forward_cache' | 'prerender' | undefined;
}

/**
 * A version of the `Metric` that is used with the attribution build.
 */
export interface MetricWithAttribution extends Metric {
  /**
   * An object containing potentially-helpful debugging information that
   * can be sent along with the metric value for the current page visit in
   * order to help identify issues happening to real-users in the field.
   */
  attribution: {[key: string]: unknown};
}

export interface ReportCallback {
  (metric: Metric): void;
}

export interface ReportOpts {
  reportAllChanges?: boolean;
  durationThreshold?: number;
}

/**
 * The loading state of the document. Note: this value is similar to
 * `document.readyState` but it subdivides the "interactive" state into the
 * time before and after the DOMContentLoaded event fires.
 *
 * State descriptions:
 * - `loading`: the initial document response has not yet been fully downloaded
 *   and parsed. This is equivalent to the corresponding `readyState` value.
 * - `domInteractive`: the document has been fully loaded and parsed, but
 *   scripts may not have yet finished loading and executing.
 * - `domContentLoaded`: the document is fully loaded and parsed, and all
 *   scripts (except `async` scripts) have loaded and finished executing.
 * - `loaded`: the document and all of its sub-resources have finished loading.
 *   This is equivalent to a document `readyState` of "complete".
 */
export type LoadState = 'loading' | 'domInteractive' | 'domContentloaded' | 'loaded';
