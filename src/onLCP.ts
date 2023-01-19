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
import {doubleRAF} from './lib/doubleRAF.js';
import {getActivationStart} from './lib/getActivationStart.js';
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {softNavs} from './lib/softNavs.js';
import {whenActivated} from './lib/whenActivated.js';
import {LCPMetric, Metric, ReportCallback, ReportOpts} from './types.js';

const reportedMetricIDs: Record<string, boolean> = {};

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
export const onLCP = (onReport: ReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};
  let currentNav = 1;
  const softNavsEnabled = softNavs(opts);

  whenActivated(() => {
    // https://web.dev/lcp/#what-is-a-good-lcp-score
    const thresholds = [2500, 4000];

    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('LCP');
    let report: ReturnType<typeof bindReporter>;

    const initNewLCPMetric = (navigation?: Metric['navigationType']) => {
      metric = initMetric('LCP', 0, navigation);
      report = bindReporter(
        onReport,
        metric,
        thresholds,
        opts!.reportAllChanges
      );
    };

    const handleEntries = (entries: LCPMetric['entries']) => {
      const uniqueNavigationIds = [
        ...new Set(entries.map((entry) => entry.navigationId)),
      ].filter((n) => n);

      uniqueNavigationIds.forEach((navigationId) => {
        const filterEntires = entries.filter(
          (entry) => entry.navigationId === navigationId
        );
        const lastEntry = filterEntires[
          filterEntires.length - 1
        ] as LargestContentfulPaint;

        if (navigationId && navigationId > currentNav) {
          if (!reportedMetricIDs[metric.id]) report(true);
          initNewLCPMetric('soft-navigation');
          currentNav = navigationId;
        }

        if (lastEntry) {
          let value = 0;
          let pageUrl = '';
          if (navigationId === 1 || !navigationId) {
            // The startTime attribute returns the value of the renderTime if it is
            // not 0, and the value of the loadTime otherwise. The activationStart
            // reference is used because LCP should be relative to page activation
            // rather than navigation start if the page was prerendered. But in cases
            // where `activationStart` occurs after the LCP, this time should be
            // clamped at 0.
            value = Math.max(lastEntry.startTime - getActivationStart(), 0);
            pageUrl = performance.getEntriesByType('navigation')[0].name;
          } else {
            const navEntry =
              performance.getEntriesByType('soft-navigation')[navigationId - 2];
            const navStartTime = navEntry?.startTime || 0;
            // As a soft nav needs an interaction, it should never be before
            // getActivationStart so can just cap to 0
            value = Math.max(lastEntry.startTime - navStartTime, 0);
            pageUrl = navEntry?.name;
          }

          // Only report if the page wasn't hidden prior to LCP.
          if (lastEntry.startTime < visibilityWatcher.firstHiddenTime) {
            metric.value = value;
            metric.entries = [lastEntry];
            metric.pageUrl = pageUrl;
            report();
          }
        }
      });
    };

    const finalizeLCP = () => {
      if (!reportedMetricIDs[metric.id]) {
        handleEntries(po!.takeRecords() as LCPMetric['entries']);
        if (!softNavsEnabled) po!.disconnect();
        reportedMetricIDs[metric.id] = true;
        report(true);
      }
    };

    const po = observe('largest-contentful-paint', handleEntries);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        thresholds,
        opts!.reportAllChanges
      );

      // Stop listening after input. Note: while scrolling is an input that
      // stops LCP observation, it's unreliable since it can be programmatically
      // generated. See: https://github.com/GoogleChrome/web-vitals/issues/75
      ['keydown', 'click'].forEach((type) => {
        addEventListener(type, finalizeLCP, true);
      });

      onHidden(finalizeLCP);

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered.
      onBFCacheRestore((event) => {
        initNewLCPMetric();

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          reportedMetricIDs[metric.id] = true;
          report(true);
        });
      });
    }
  });
};
