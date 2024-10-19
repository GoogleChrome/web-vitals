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
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {getNavigationEntry} from './lib/getNavigationEntry.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {
  firstInputPolyfill,
  resetFirstInputPolyfill,
} from './lib/polyfills/firstInputPolyfill.js';
import {softNavs} from './lib/softNavs.js';
import {whenActivated} from './lib/whenActivated.js';
import {
  FIDMetric,
  FirstInputPolyfillCallback,
  Metric,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

/** Thresholds for FID. See https://web.dev/articles/fid#what_is_a_good_fid_score */
export const FIDThresholds: MetricRatingThresholds = [100, 300];

/**
 * Calculates the [FID](https://web.dev/articles/fid) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `first-input` performance entry used to determine the value. The
 * reported value is a `DOMHighResTimeStamp`.
 *
 * _**Important:** since FID is only reported after the user interacts with the
 * page, it's possible that it will not be reported for some page loads._
 */
export const onFID = (
  onReport: (metric: FIDMetric) => void,
  opts?: ReportOpts,
) => {
  // Set defaults
  opts = opts || {};
  const softNavsEnabled = softNavs(opts);
  const hardNavId = getNavigationEntry()?.navigationId || '1';

  whenActivated(() => {
    let visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('FID');
    let report: ReturnType<typeof bindReporter>;

    const initNewFIDMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: string,
    ) => {
      if (navigation === 'soft-navigation') {
        visibilityWatcher = getVisibilityWatcher(true);
      }
      metric = initMetric('FID', 0, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        FIDThresholds,
        opts!.reportAllChanges,
      );
    };

    const handleEntries = (entries: FIDMetric['entries']) => {
      entries.forEach((entry) => {
        if (!softNavsEnabled) {
          po!.disconnect();
        } else if (
          entry.navigationId &&
          entry.navigationId !== metric.navigationId
        ) {
          // If the entry is for a new navigationId than previous, then we have
          // entered a new soft nav, so reinitialize the metric.
          initNewFIDMetric('soft-navigation', entry.navigationId);
        }
        // Only report if the page wasn't hidden prior to the first input.
        if (entry.startTime < visibilityWatcher.firstHiddenTime) {
          metric.value = entry.processingStart - entry.startTime;
          metric.entries.push(entry);
          metric.navigationId = entry.navigationId || hardNavId;
          report(true);
        }
      });
    };
    const po = observe('first-input', handleEntries, opts);

    report = bindReporter(
      onReport,
      metric,
      FIDThresholds,
      opts!.reportAllChanges,
    );

    if (po) {
      onHidden(() => {
        handleEntries(po!.takeRecords() as FIDMetric['entries']);
        if (!softNavsEnabled) po.disconnect();
      });

      onBFCacheRestore(() => {
        metric = initMetric(
          'FID',
          0,
          'back-forward-cache',
          metric.navigationId,
        );
        report = bindReporter(
          onReport,
          metric,
          FIDThresholds,
          opts!.reportAllChanges,
        );

        // Browsers don't re-emit FID on bfcache restore so fake it until you make it
        resetFirstInputPolyfill();
        firstInputPolyfill(handleEntries as FirstInputPolyfillCallback);
      });
    }
  });
};
