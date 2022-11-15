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
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {bindReporter} from './lib/bindReporter.js';
import {doubleRAF} from './lib/doubleRAF.js';
import {whenActivated} from './lib/whenActivated.js';
import {onFCP} from './onFCP.js';
import {CLSMetric, CLSReportCallback, ReportOpts} from './types.js';


/**
 * Calculates the [CLS](https://web.dev/cls/) value for the current page and
 * calls the `callback` function once the value is ready to be reported, along
 * with all `layout-shift` performance entries that were used in the metric
 * value calculation. The reported value is a `double` (corresponding to a
 * [layout shift score](https://web.dev/cls/#layout-shift-score)).
 *
 * If the `reportAllChanges` configuration option is set to `true`, the
 * `callback` function will be called as soon as the value is initially
 * determined as well as any time the value changes throughout the page
 * lifespan.
 *
 * _**Important:** CLS should be continually monitored for changes throughout
 * the entire lifespan of a page—including if the user returns to the page after
 * it's been hidden/backgrounded. However, since browsers often [will not fire
 * additional callbacks once the user has backgrounded a
 * page](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden),
 * `callback` is always called when the page's visibility state changes to
 * hidden. As a result, the `callback` function might be called multiple times
 * during the same page load._
 */
export const onCLS = (onReport: CLSReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};

  whenActivated(() => {
    // https://web.dev/cls/#what-is-a-good-cls-score
    const thresholds = [0.1, 0.25];

    let metric = initMetric('CLS');
    let report: ReturnType<typeof bindReporter>;

    let fcpValue = -1;
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const onReportWrapped: CLSReportCallback = (arg) => {
      if (fcpValue > -1) {
        onReport(arg);
      }
    };

    // const handleEntries = (entries: Metric['entries']) => {
    const handleEntries = (entries: LayoutShift[]) => {
      entries.forEach((entry) => {
        // Only count layout shifts without recent user input.
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          // If the entry occurred less than 1 second after the previous entry
          // and less than 5 seconds after the first entry in the session,
          // include the entry in the current session. Otherwise, start a new
          // session.
          if (sessionValue &&
              entry.startTime - lastSessionEntry.startTime < 1000 &&
              entry.startTime - firstSessionEntry.startTime < 5000) {
            sessionValue += entry.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = entry.value;
            sessionEntries = [entry];
          }

          // If the current session value is larger than the current CLS value,
          // update CLS and the entries contributing to it.
          if (sessionValue > metric.value) {
            metric.value = sessionValue;
            metric.entries = sessionEntries;
            report();
          }
        }
      });
    };

    const po = observe('layout-shift', handleEntries);
    if (po) {
      report = bindReporter(
          onReportWrapped, metric, thresholds, opts!.reportAllChanges);

      // Start monitoring FCP so we can only report CLS if FCP is also reported.
      // Note: this is done to match the current behavior of CrUX.
      // Also, if there have not been any layout shifts when FCP is dispatched,
      // call "report" with a zero value
      onFCP((fcpMetric) => {
        fcpValue = fcpMetric.value;
        if (metric.value < 0) {
          metric.value = 0;
          report();
        }
      });

      onHidden(() => {
        handleEntries(po.takeRecords() as CLSMetric['entries']);
        report(true);
      });

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered.
      onBFCacheRestore(() => {
        sessionValue = 0;
        fcpValue = -1;
        metric = initMetric('CLS', 0);
        report = bindReporter(
            onReportWrapped, metric, thresholds, opts!.reportAllChanges);

        doubleRAF(() => report());
      });
    }
  });
};
