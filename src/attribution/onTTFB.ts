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
    let redirectDuration = 0;
    let swStartupDuration = 0;
    let swFetchEventDuration = 0;
    let cacheDuration = 0;
    const dnsDuration = 0;
    let connectionDuration = 0;
    let waitingDuration = 0;

    const requestDuration =
      metric.value -
      Math.max(navigationEntry.requestStart - activationStart, 0);

    if (navigationEntry.workerStart) {
      // Service worker-based timings
      redirectDuration = navigationEntry.workerStart - activationStart;

      swStartupDuration = Math.max(
        navigationEntry.fetchStart -
          activationStart -
          navigationEntry.workerStart -
          activationStart,
        0,
      );

      swFetchEventDuration =
        Math.max(
          navigationEntry.connectEnd -
            activationStart -
            navigationEntry.workerStart -
            activationStart,
          0,
        ) - swStartupDuration;
    } else {
      // HTTP Cache-based timings
      redirectDuration = Math.max(
        navigationEntry.fetchStart - activationStart,
        0,
      );
      cacheDuration =
        Math.max(navigationEntry.domainLookupStart - activationStart, 0) -
        redirectDuration;
    }

    connectionDuration = Math.max(
      navigationEntry.connectEnd -
        activationStart -
        navigationEntry.connectStart -
        activationStart,
      0,
    );

    waitingDuration = Math.max(
      navigationEntry.requestStart -
        activationStart -
        navigationEntry.connectEnd -
        activationStart,
      0,
    );

    // If the redirect time is less than 20ms then it can't really redirect time and is a misreporting
    // Attribute it to the waitingDuration to avoid confusion
    if (redirectDuration < 20) {
      waitingDuration = waitingDuration + redirectDuration;
      redirectDuration = 0;
    }

    (metric as TTFBMetricWithAttribution).attribution = {
      redirectDuration: redirectDuration,
      swStartupDuration: swStartupDuration,
      swFetchEventDuration: swFetchEventDuration,
      cacheDuration: cacheDuration,
      dnsDuration: dnsDuration,
      connectionDuration: connectionDuration,
      waitingDuration: waitingDuration,
      requestDuration: requestDuration,
      navigationEntry: navigationEntry,
    };
    return;
  }
  // Set an empty object if no other attribution has been set.
  (metric as TTFBMetricWithAttribution).attribution = {
    redirectDuration: 0,
    swStartupDuration: 0,
    swFetchEventDuration: 0,
    cacheDuration: 0,
    dnsDuration: 0,
    connectionDuration: 0,
    requestDuration: 0,
    waitingDuration: 0,
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
