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

import {bindReporter} from './lib/bindReporter.js';
import {checkSoftNavsEnabled, storeSoftNavEntry} from './lib/softNavs.js';
import {doubleRAF} from './lib/doubleRAF.js';
import {getActivationStart} from './lib/getActivationStart.js';
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {initMetric} from './lib/initMetric.js';
import {initUnique} from './lib/initUnique.js';
import {FCPEntryManager} from './lib/FCPEntryManager.js';
import {observe} from './lib/observe.js';
import {getBFCacheRestoreTime, onBFCacheRestore} from './lib/bfcache.js';
import {whenActivated} from './lib/whenActivated.js';
import {FCPMetric, MetricRatingThresholds, ReportOpts} from './types.js';

/** Thresholds for FCP. See https://web.dev/articles/fcp#what_is_a_good_fcp_score */
export const FCPThresholds: MetricRatingThresholds = [1800, 3000];

/**
 * Calculates the [FCP](https://web.dev/articles/fcp) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `paint` performance entry used to determine the value. The reported
 * value is a `DOMHighResTimeStamp`.
 */
export const onFCP = (
  onReport: (metric: FCPMetric) => void,
  opts: ReportOpts = {},
) => {
  const softNavsEnabled = checkSoftNavsEnabled(opts);

  whenActivated(() => {
    // Create a new FCP entry manager for each page activation
    // This allows us to track soft navigations separately
    // needed when attribution is enabled.
    const fcpEntryManager = initUnique(opts, FCPEntryManager);
    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('FCP');
    let report: ReturnType<typeof bindReporter>;

    const handleEntries = (entries: FCPMetric['entries']) => {
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          po!.disconnect();

          // Only report if the page wasn't hidden prior to FCP.
          if (entry.startTime < visibilityWatcher.firstHiddenTime) {
            // The activationStart reference is used because FCP should be
            // relative to page activation rather than navigation start if the
            // page was prerendered. But in cases where `activationStart` occurs
            // after the FCP, this time should be clamped at 0.
            metric.value = Math.max(entry.startTime - getActivationStart(), 0);
            metric.entries.push(entry);
            metric.navigationId = entry.navigationId || metric.navigationId;
            // FCP should only be reported once so can report right away
            report(true);
          }
        }
      }
    };

    const po = observe(['paint'], handleEntries);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        FCPThresholds,
        opts!.reportAllChanges,
      );

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered or the `paint` entry exists.
      onBFCacheRestore((event) => {
        metric = initMetric(
          'FCP',
          -1,
          metric.interactionId,
          'back-forward-cache',
          metric.navigationId,
          metric.navigationURL,
          getBFCacheRestoreTime(),
        );
        report = bindReporter(
          onReport,
          metric,
          FCPThresholds,
          opts!.reportAllChanges,
        );

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          report(true);
        });
      });
    }

    if (softNavsEnabled) {
      // As first-contentful-paint is only reported once, we can handle soft
      // navigations afterwards on their own for simplicity, as no need to
      // observe both and sort the entries like for the other metrics
      const handleSoftNavEntries = (entries: PerformanceSoftNavigation[]) => {
        entries.forEach((entry) => {
          // Store the soft navigation entries in the entry manager so that
          // they can be retrieved for attribution if necessary. This code
          // is only used when attribution is enabled which sets the
          // _softNavigationEntryMap.
          if (fcpEntryManager._softNavigationEntryMap && entry.navigationId) {
            storeSoftNavEntry(fcpEntryManager._softNavigationEntryMap, entry);
          }

          // Clamp FCP at 0. It should never be less, but better safe than sorry.
          const FCPTime = Math.max(
            (entry.presentationTime || entry.paintTime || 0) - entry.startTime,
            0,
          );
          metric = initMetric(
            'FCP',
            FCPTime,
            entry.interactionId,
            'soft-navigation',
            entry.navigationId,
            entry.name,
            entry.startTime,
          );
          report = bindReporter(
            onReport,
            metric,
            FCPThresholds,
            opts!.reportAllChanges,
          );
          report(true);
        });
      };
      observe(['soft-navigation'], handleSoftNavEntries, opts);
    }
  });
};
