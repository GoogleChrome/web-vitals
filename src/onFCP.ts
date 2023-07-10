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
import {getNavigationEntry} from './lib/getNavigationEntry.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {getSoftNavigationEntry, softNavs} from './lib/softNavs.js';
import {whenActivated} from './lib/whenActivated.js';
import {
  FCPMetric,
  FCPReportCallback,
  Metric,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

/** Thresholds for FCP. See https://web.dev/fcp/#what-is-a-good-fcp-score */
export const FCPThresholds: MetricRatingThresholds = [1800, 3000];

const hardNavEntry = getNavigationEntry();

/**
 * Calculates the [FCP](https://web.dev/fcp/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `paint` performance entry used to determine the value. The reported
 * value is a `DOMHighResTimeStamp`.
 */
export const onFCP = (onReport: FCPReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};
  const softNavsEnabled = softNavs(opts);

  whenActivated(() => {
    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('FCP');
    let report: ReturnType<typeof bindReporter>;

    const initNewFCPMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: string
    ) => {
      metric = initMetric('FCP', 0, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        FCPThresholds,
        opts!.reportAllChanges
      );
    };

    const handleEntries = (entries: FCPMetric['entries']) => {
      (entries as PerformancePaintTiming[]).forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          if (!softNavsEnabled) {
            po!.disconnect();
          } else if (
            (entry.navigationId || '1') !== hardNavEntry?.navigationId
          ) {
            initNewFCPMetric('soft-navigation', entry.navigationId);
          }

          let value = 0;

          if (
            !entry.navigationId ||
            entry.navigationId === hardNavEntry?.navigationId
          ) {
            // Only report if the page wasn't hidden prior to the first paint.
            // The activationStart reference is used because FCP should be
            // relative to page activation rather than navigation start if the
            // page was prerendered. But in cases where `activationStart` occurs
            // after the FCP, this time should be clamped at 0.
            value = Math.max(
              entry.startTime - getActivationStart(hardNavEntry),
              0
            );
          } else {
            const navEntry = getSoftNavigationEntry(entry.navigationId);
            const navStartTime = navEntry?.startTime || 0;
            // As a soft nav needs an interaction, it should never be before
            // getActivationStart so can just cap to 0
            value = Math.max(entry.startTime - navStartTime, 0);
          }

          // Only report if the page wasn't hidden prior to FCP.
          if (
            entry.startTime < visibilityWatcher.firstHiddenTime ||
            (softNavsEnabled &&
              entry.navigationId &&
              entry.navigationId !== metric.navigationId &&
              entry.navigationId !== (hardNavEntry?.navigationId || '1') &&
              (getSoftNavigationEntry(entry.navigationId)?.startTime || 0) >
                (getSoftNavigationEntry(metric.navigationId)?.startTime || 0))
          ) {
            metric.value = value;
            metric.entries.push(entry);
            metric.navigationId = entry.navigationId || '1';
            // FCP should only be reported once so can report right
            report(true);
          }
        }
      });
    };

    const po = observe('paint', handleEntries, opts);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        FCPThresholds,
        opts!.reportAllChanges
      );

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered or the `paint` entry exists.
      onBFCacheRestore((event) => {
        metric = initMetric(
          'FCP',
          0,
          'back-forward-cache',
          metric.navigationId
        );
        report = bindReporter(
          onReport,
          metric,
          FCPThresholds,
          opts!.reportAllChanges
        );

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          report(true);
        });
      });
    }
  });
};
