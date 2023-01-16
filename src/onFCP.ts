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
import {whenActivated} from './lib/whenActivated.js';
import {FCPMetric, FCPReportCallback, ReportOpts, SoftNavs} from './types.js';

/**
 * Calculates the [FCP](https://web.dev/fcp/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `paint` performance entry used to determine the value. The reported
 * value is a `DOMHighResTimeStamp`.
 */
export const onFCP = (onReport: FCPReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};
  let softNavs: SoftNavigationEntry[] = [];
  let currentURL = '';
  let firstFCPreported = false;
  const eventsToBeHandled: FCPMetric['entries'] = [];

  whenActivated(() => {
    // https://web.dev/fcp/#what-is-a-good-fcp-score
    const thresholds = [1800, 3000];

    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('FCP');
    let report: ReturnType<typeof bindReporter>;

    const handleEntries = (
      entries: FCPMetric['entries'],
      beforeStartTime?: number
    ) => {
      (entries as PerformancePaintTiming[]).forEach((entry) => {
        if (
          // Only include FCP as no separate entry for that
          entry.name === 'first-contentful-paint' &&
          // Only include if not reported yet (for live observing)
          // Or if the time is before the current soft nav start time
          // (for processing buffered times).
          (!firstFCPreported ||
            (beforeStartTime && entry.startTime < beforeStartTime))
        ) {
          let value = 0;
          let pageUrl: string = window.location.href;
          firstFCPreported = true;
          if (!opts!.reportSoftNavs) {
            // If not measuring soft navs, then can disconnect the PO now
            po!.disconnect();
            // The activationStart reference is used because FCP should be
            // relative to page activation rather than navigation start if the
            // page was prerendered. But in cases where `activationStart` occurs
            // after the FCP, this time should be clamped at 0.
            value = Math.max(entry.startTime - getActivationStart(), 0);
          } else {
            // Get the navigation id for this entry
            const id = entry.NavigationId;
            // And look up the startTime of that navigation
            // Falling back to getActivationStart() for the initial nav
            const nav = softNavs.filter((entry) => entry.NavigationId == id)[0];
            const navStartTime = nav ? nav.startTime : getActivationStart();
            // Calculate the actual start time
            value = Math.max(entry.startTime - navStartTime, 0);
            pageUrl = currentURL;
          }

          // Only report if the page wasn't hidden prior to the first paint.
          if (entry.startTime < visibilityWatcher.firstHiddenTime) {
            metric.value = value;
            metric.entries.push(entry);
            metric.pageUrl = pageUrl;
            report(true);
          }
        }
      });
    };

    const po = observe('paint', handleEntries);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        thresholds,
        opts!.reportAllChanges
      );

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered or the `paint` entry exists.
      onBFCacheRestore((event) => {
        metric = initMetric('FCP');
        report = bindReporter(
          onReport,
          metric,
          thresholds,
          opts!.reportAllChanges
        );

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          report(true);
        });
      });

      const handleSoftNav = (entries: SoftNavs['entries']) => {
        // store all the new softnavs to allow us to look them up
        // to get the start time for this navigation
        softNavs = entries;

        // We clear down the po with takeRecords() but might have multiple
        // softNavs before web-vitals.js was initialised (unlikely but possible)
        // so save them to process them over again for each soft nav.
        const poEntries = po!.takeRecords() as FCPMetric['entries'];

        // Process each soft nav, finalizing the previous one, and setting
        // up the next one
        entries.forEach((entry) => {
          if (!currentURL) {
            currentURL = entry.name;
          }
          // We report all FCPs up until just before this startTime
          handleEntries(poEntries, entry.startTime);

          // Set up a new metric for the next soft nav
          firstFCPreported = false;
          metric = initMetric('FCP', 0, 'soft-navigation');
          currentURL = entry.name;
          report = bindReporter(
            onReport,
            metric,
            thresholds,
            opts!.reportAllChanges
          );
        });
      };

      // Listen for soft navs
      if (opts!.reportSoftNavs) {
        observe('soft-navigation', handleSoftNav);
      }
    }
  });
};
