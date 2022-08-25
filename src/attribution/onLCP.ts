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


import {getNavigationEntry} from '../lib/getNavigationEntry.js';
import {getSelector} from '../lib/getSelector.js';
import {onLCP as unattributedOnLCP} from '../onLCP.js';
import {LCPAttribution, LCPMetric, LCPMetricWithAttribution, LCPReportCallback, LCPReportCallbackWithAttribution, ReportOpts} from '../types.js';


const attributeLCP = (metric: LCPMetric) => {
  if (metric.entries.length) {
    const navigationEntry = getNavigationEntry();

    if (navigationEntry) {
      const activationStart = navigationEntry.activationStart || 0;
      const lcpEntry = metric.entries[metric.entries.length - 1];
      const lcpResourceEntry = lcpEntry.url &&performance
          .getEntriesByType('resource')
          .filter((e) => e.name === lcpEntry.url)[0];

      const ttfb = Math.max(0, navigationEntry.responseStart - activationStart);

      const lcpRequestStart = Math.max(
        ttfb,
        // Prefer `requestStart` (if TOA is set), otherwise use `startTime`.
        lcpResourceEntry ? (lcpResourceEntry.requestStart ||
            lcpResourceEntry.startTime) - activationStart : 0
      );
      const lcpResponseEnd = Math.max(
        lcpRequestStart,
        lcpResourceEntry ? lcpResourceEntry.responseEnd - activationStart : 0
      );
      const lcpRenderTime = Math.max(
        lcpResponseEnd,
        lcpEntry ? lcpEntry.startTime - activationStart : 0
      );

      const attribution: LCPAttribution = {
        element: getSelector(lcpEntry.element),
        timeToFirstByte: ttfb,
        resourceLoadDelay: lcpRequestStart - ttfb,
        resourceLoadTime: lcpResponseEnd - lcpRequestStart,
        elementRenderDelay: lcpRenderTime - lcpResponseEnd,
        navigationEntry,
        lcpEntry,
      };

      // Only attribution the URL and resource entry if they exist.
      if (lcpEntry.url) {
        attribution.url = lcpEntry.url;
      }
      if (lcpResourceEntry) {
        attribution.lcpResourceEntry = lcpResourceEntry;
      }

      (metric as LCPMetricWithAttribution).attribution = attribution;
    }
  } else {
    // There are no entries when restored from bfcache.
    (metric as LCPMetricWithAttribution).attribution = {
      timeToFirstByte: 0,
      resourceLoadDelay: 0,
      resourceLoadTime: 0,
      elementRenderDelay: metric.value,
    };
  }
};

/**
 * Calculates the [LCP](https://web.dev/lcp/) value for the current page and
 * calls the `callback` function once the value is ready (along with the
 * relevant `largest-contentful-paint` performance entry used to determine the
 * value). The reported value is a `DOMHighResTimeStamp`.
 *
 * If the `reportAllChanges` configuration option is set to `true`, the
 * `callback` function will be called any time a new `largest-contentful-paint`
 * performance entry is dispatched, or once the final value of the metric has
 * been determined.
 */
export const onLCP = (onReport: LCPReportCallbackWithAttribution, opts?: ReportOpts) => {
  unattributedOnLCP(((metric: LCPMetricWithAttribution) => {
    attributeLCP(metric);
    onReport(metric);
  }) as LCPReportCallback, opts);
};
