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

import type {Metric} from './base.js';

/**
 * A TTFB-specific version of the Metric object.
 */
export interface TTFBMetric extends Metric {
  name: 'TTFB';
  entries: PerformanceNavigationTiming[];
}

/**
 * An object containing potentially-helpful debugging information that
 * can be sent along with the TTFB value for the current page visit in order
 * to help identify issues happening to real-users in the field.
 */
export interface TTFBAttribution {
  /**
   * The total time spent in redirects before the current page processes the
   * request. Npote in future this may only include same-origin redirects.
   */
  redirectDuration: number;
  /**
   * The total time spent looking up local caches for the navigation request.
   * This includes service worker startup, service worker fetch processing, and
   * HTTP cache lookup times.
   */
  cacheDuration: number;
  /**
   * The total time to resolve the DNS for the current request.
   */
  dnsDuration: number;
  /**
   * The total time to create the connection to the requested domain.
   */
  connectionDuration: number;
  /**
   * The total time from when the request was sent until the first byte of the
   * response was received. This includes network time as well as server
   * processing time.
   */
  requestDuration: number;
  /**
   * The `navigation` entry of the current page, which is useful for diagnosing
   * general page load issues. This can be used to access `serverTiming` for example:
   * navigationEntry?.serverTiming
   */
  navigationEntry?: PerformanceNavigationTiming;
}

/**
 * A TTFB-specific version of the Metric object with attribution.
 */
export interface TTFBMetricWithAttribution extends TTFBMetric {
  attribution: TTFBAttribution;
}

/**
 * A TTFB-specific version of the ReportCallback function.
 */
export interface TTFBReportCallback {
  (metric: TTFBMetric): void;
}

/**
 * A TTFB-specific version of the ReportCallback function with attribution.
 */
export interface TTFBReportCallbackWithAttribution {
  (metric: TTFBMetricWithAttribution): void;
}
