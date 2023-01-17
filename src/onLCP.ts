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
import {whenActivated} from './lib/whenActivated.js';
import {LCPMetric, ReportCallback, ReportOpts, SoftNavs} from './types.js';

const reportedMetricIDs: Record<string, boolean> = {};
const navToMetric: Record<number, LCPMetric> = {};
const navToReport: Record<number, ReturnType<typeof bindReporter>> = {};

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
  let softNavs: SoftNavigationEntry[] = [];
  let currentURL: string;
  let firstNav = -1; // Should be 1, but let's not assume

  whenActivated(() => {
    // https://web.dev/lcp/#what-is-a-good-lcp-score
    const thresholds = [2500, 4000];

    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('LCP');
    navToMetric[0] = metric as LCPMetric;
    let report: ReturnType<typeof bindReporter>;

    const handleEntries = (
      entries: LCPMetric['entries'],
      navigationId?: number
    ) => {
      const pageUrl: string = window.location.href;
      const filteredEntries: LargestContentfulPaint[] = navigationId
        ? entries.filter((entry) => (entry.navigationId = navigationId))
        : entries;
      if (!opts!.reportSoftNavs) {
        const lastEntry = filteredEntries[entries.length - 1];
        // The startTime attribute returns the value of the renderTime if it is
        // not 0, and the value of the loadTime otherwise. The activationStart
        // reference is used because LCP should be relative to page activation
        // rather than navigation start if the page was prerendered. But in cases
        // where `activationStart` occurs after the LCP, this time should be
        // clamped at 0.
        const value = Math.max(lastEntry.startTime - getActivationStart(), 0);

        // Only report if the page wasn't hidden prior to LCP.
        if (value < visibilityWatcher.firstHiddenTime) {
          metric.value = value;
          metric.entries = [lastEntry];
          metric.pageUrl = pageUrl;
          report();
        }
      } else {
        if (firstNav === -1 && entries[0]?.navigationId) {
          firstNav = entries[0].navigationId;
          navToMetric[firstNav] = metric as LCPMetric;
          navToReport[firstNav] = report;
        }
        const uniqueNavigationIds = [
          ...new Set(filteredEntries.map((entry) => entry.navigationId)),
        ].filter((n) => n);
        uniqueNavigationIds.forEach((navigationId) => {
          const lastEntry = filteredEntries.filter(
            (entry) => entry.navigationId === navigationId
          )[0];

          if (!navigationId) return; // Needed for Typescript to be happy
          // If one doesn't exist already, then set up a new metric for the next soft nav
          report = navToReport[navigationId];
          metric = navToMetric[navigationId];
          if (!report) {
            metric = initMetric('LCP', 0, 'soft-navigation');
            navToMetric[navigationId] = metric as LCPMetric;
            report = bindReporter(
              onReport,
              metric,
              thresholds,
              opts!.reportAllChanges
            );
            navToReport[navigationId] = report;
          }

          // The startTime attribute returns the value of the renderTime if it is
          // not 0, and the value of the loadTime otherwise. The activationStart
          // reference is used because LCP should be relative to page activation
          // rather than navigation start if the page was prerendered. But in cases
          // where `activationStart` occurs after the LCP, this time should be
          // clamped at 0.
          let value = lastEntry.startTime;
          const softNav = softNavs.filter(
            (softNav) => softNav.navigationId === navigationId
          )[0];
          if (navigationId == firstNav) {
            value = Math.max(lastEntry.startTime - getActivationStart(), 0);
          }

          if (softNav) {
            value = Math.max(
              lastEntry.startTime -
                Math.max(softNav.startTime, getActivationStart()),
              0
            );
          }
          // Only report if the page wasn't hidden prior to LCP.
          if (value < visibilityWatcher.firstHiddenTime) {
            metric.value = value;
            metric.entries = [lastEntry];
            metric.pageUrl = currentURL || pageUrl;
            metric.navigationId = navigationId;
            report();
          }
        });
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
      navToReport[0] = report;

      const finalizeLCPForNavId = (
        poEntries: LCPMetric['entries'],
        navigationId?: number
      ) => {
        metric = navigationId ? navToMetric[navigationId] : metric;
        report = navigationId ? navToReport[navigationId] : report;
        if (!reportedMetricIDs[metric.id]) {
          handleEntries(poEntries, navigationId);
          // If not measuring soft navs, then can disconnect the PO now
          if (!opts!.reportSoftNavs) {
            po!.disconnect();
          }
          reportedMetricIDs[metric.id] = true;
          report(true);
        }
      };

      const finalizeLCP = () => {
        if (!reportedMetricIDs[metric.id]) {
          const LCPEntries = po!.takeRecords() as LCPMetric['entries'];
          finalizeLCPForNavId(LCPEntries);
        }
      };

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
        metric = initMetric('LCP');
        report = bindReporter(
          onReport,
          metric,
          thresholds,
          opts!.reportAllChanges
        );

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          reportedMetricIDs[metric.id] = true;
          report(true);
        });
      });

      const handleSoftNav = (entries: SoftNavs['entries']) => {
        // store all the new softnavs to allow us to look them up
        // to get the start time for this navigation
        softNavs = softNavs.concat(entries);

        // We clear down the po with takeRecords() but might have multiple
        // softNavs before web-vitals.js was initialised (unlikely but possible)
        // so save them to process them over again for each soft nav.
        const poEntries = po!.takeRecords() as LCPMetric['entries'];

        // Process each soft nav, finalizing the previous one, and setting
        // up the next one
        entries.forEach((entry) => {
          if (!entry.navigationId) return;
          // We report all LCPs for the previous navigationId
          finalizeLCPForNavId(poEntries, entry.navigationId - 1);
          // We are about to initialise a new metric so shouldn't need the old one
          // So clean it up to avoid it growing and growing
          const prevMetric = navToMetric[entry.navigationId - 1];
          if (prevMetric) {
            delete reportedMetricIDs[prevMetric.id];
            delete navToMetric[entry.navigationId - 1];
            delete navToReport[entry.navigationId - 1];
          }

          // If one doesn't exist already, then set up a new metric for the next soft nav
          metric = navToMetric[entry.navigationId];
          report = navToReport[entry.navigationId];
          if (metric) {
            // Set the URL name
            currentURL = entry.name;
            // Reset the value based on startTime (as it couldn't have been known below)
            metric.value = Math.max(
              metric.value - Math.max(entry.startTime, getActivationStart()),
              0
            );
          } else {
            metric = initMetric('LCP', 0, 'soft-navigation');
            navToMetric[entry.navigationId] = metric as LCPMetric;
            currentURL = entry.name;
            report = bindReporter(
              onReport,
              metric,
              thresholds,
              opts!.reportAllChanges
            );
            navToReport[entry.navigationId] = report;
          }
        });
      };

      // Listen for soft navs and finalise the previous LCP
      if (opts!.reportSoftNavs) {
        observe('soft-navigation', handleSoftNav);
      }
    }
  });
};
