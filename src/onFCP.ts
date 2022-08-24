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

import {onBFCacheRestore} from './lib/bfcache.js';
import {bindReporter} from './lib/bindReporter.js';
import {getActivationStart} from './lib/getActivationStart.js';
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {FCPMetric, FCPReportCallback, ReportOpts} from './types.js';

/**
 * Calculates the [FCP](https://web.dev/fcp/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `paint` performance entry used to determine the value. The reported
 * value is a `DOMHighResTimeStamp`.
 */
export const onFCP = (onReport: FCPReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};

  // https://web.dev/fcp/#what-is-a-good-fcp-score
  const thresholds = [1800, 3000];

  const visibilityWatcher = getVisibilityWatcher();
  let metric = initMetric('FCP');
  let report: ReturnType<typeof bindReporter>;

  const handleEntries = (entries: FCPMetric['entries']) => {
    (entries as PerformancePaintTiming[]).forEach((entry) => {
      if (entry.name === 'first-contentful-paint') {
        if (po) {
          po.disconnect();
        }

        // Only report if the page wasn't hidden prior to the first paint.
        if (entry.startTime < visibilityWatcher.firstHiddenTime) {
          // The activationStart reference is used because FCP should be
          // relative to page activation rather than navigation start if the
          // page was prerendered.
          metric.value = entry.startTime - getActivationStart();
          metric.entries.push(entry);
          report(true);
        }
      }
    });
  };

  // TODO(philipwalton): remove the use of `fcpEntry` once this bug is fixed.
  // https://bugs.webkit.org/show_bug.cgi?id=225305
  // The check for `getEntriesByName` is needed to support Opera:
  // https://github.com/GoogleChrome/web-vitals/issues/159
  // The check for `window.performance` is needed to support Opera mini:
  // https://github.com/GoogleChrome/web-vitals/issues/185
  const fcpEntry = window.performance && window.performance.getEntriesByName &&
      window.performance.getEntriesByName('first-contentful-paint')[0];

  const po = fcpEntry ? null : observe('paint', handleEntries);

  if (fcpEntry || po) {
    report = bindReporter(onReport, metric, thresholds, opts.reportAllChanges);

    if (fcpEntry) {
      handleEntries([fcpEntry]);
    }

    // Only report after a bfcache restore if the `PerformanceObserver`
    // successfully registered or the `paint` entry exists.
    onBFCacheRestore((event) => {
      metric = initMetric('FCP');
      report = bindReporter(
          onReport, metric, thresholds, opts!.reportAllChanges);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          metric.value = performance.now() - event.timeStamp;
          report(true);
        });
      });
    });
  }
};
