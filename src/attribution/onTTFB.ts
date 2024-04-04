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

import {onTTFB as unattributedOnTTFB} from '../onTTFB.js';
import {
  TTFBMetric,
  TTFBMetricWithAttribution,
  TTFBReportCallback,
  TTFBReportCallbackWithAttribution,
  ReportOpts,
} from '../types.js';

const attributeTTFB = (metric: TTFBMetric): void => {
  if (metric.entries.length) {
    const navigationEntry = metric.entries[0];
    const activationStart = navigationEntry.activationStart || 0;

    // Set cacheStart to be based on redirectEnd or workerStart or fetchStart
    // (whichever is set first) to get even when redirectEnd is not set in
    // cross-origin instances and when a service worker is not present.
    // fetchStart should always be set so it's the last fall back.
    const cacheStart = Math.max(
      (navigationEntry.redirectEnd ||
        navigationEntry.workerStart ||
        navigationEntry.fetchStart) - activationStart,
      0,
    );
    const dnsStart = Math.max(
      navigationEntry.domainLookupStart - activationStart,
      0,
    );
    const connectStart = Math.max(
      navigationEntry.connectStart - activationStart,
      0,
    );
    const requestStart = Math.max(
      navigationEntry.requestStart - activationStart,
      0,
    );

    (metric as TTFBMetricWithAttribution).attribution = {
      // Set redirectDuration to the time before cacheStart.
      // See https://github.com/w3c/navigation-timing/issues/160
      // Note this can result in small "redirect times" even when there are no
      // redirects
      redirectDuration: cacheStart,
      cacheDuration: dnsStart - cacheStart,
      dnsDuration: connectStart - dnsStart,
      connectionDuration: requestStart - connectStart,
      requestDuration: metric.value - requestStart,
      navigationEntry: navigationEntry,
    };
    return;
  }
  // Set an empty object if no other attribution has been set.
  (metric as TTFBMetricWithAttribution).attribution = {
    redirectDuration: 0,
    cacheDuration: 0,
    dnsDuration: 0,
    connectionDuration: 0,
    requestDuration: 0,
  };
};

/**
 * Calculates the [TTFB](https://web.dev/articles/ttfb) value for the
 * current page and calls the `callback` function once the page has loaded,
 * along with the relevant `navigation` performance entry used to determine the
 * value. The reported value is a `DOMHighResTimeStamp`.
 *
 * Note, this function waits until after the page is loaded to call `callback`
 * in order to ensure all properties of the `navigation` entry are populated.
 * This is useful if you want to report on other metrics exposed by the
 * [Navigation Timing API](https://w3c.github.io/navigation-timing/). For
 * example, the TTFB metric starts from the page's [time
 * origin](https://www.w3.org/TR/hr-time-2/#sec-time-origin), which means it
 * includes time spent on DNS lookup, connection negotiation, network latency,
 * and server processing time.
 */
export const onTTFB = (
  onReport: TTFBReportCallbackWithAttribution,
  opts?: ReportOpts,
) => {
  unattributedOnTTFB(
    ((metric: TTFBMetricWithAttribution) => {
      attributeTTFB(metric);
      onReport(metric);
    }) as TTFBReportCallback,
    opts,
  );
};
