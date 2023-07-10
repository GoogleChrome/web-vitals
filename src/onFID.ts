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
import {hardNavId} from './lib/getNavigationEntry.js';
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {
  firstInputPolyfill,
  resetFirstInputPolyfill,
} from './lib/polyfills/firstInputPolyfill.js';
import {getSoftNavigationEntry, softNavs} from './lib/softNavs.js';
import {whenActivated} from './lib/whenActivated.js';
import {
  FIDMetric,
  FIDReportCallback,
  FirstInputPolyfillCallback,
  Metric,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

/** Thresholds for FID. See https://web.dev/fid/#what-is-a-good-fid-score */
export const FIDThresholds: MetricRatingThresholds = [100, 300];

/**
 * Calculates the [FID](https://web.dev/fid/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `first-input` performance entry used to determine the value. The
 * reported value is a `DOMHighResTimeStamp`.
 *
 * _**Important:** since FID is only reported after the user interacts with the
 * page, it's possible that it will not be reported for some page loads._
 */
export const onFID = (onReport: FIDReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};
  const softNavsEnabled = softNavs(opts);

  whenActivated(() => {
    const visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('FID');
    let report: ReturnType<typeof bindReporter>;

    const initNewFIDMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: string
    ) => {
      metric = initMetric('FID', 0, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        FIDThresholds,
        opts!.reportAllChanges
      );
    };

    const handleEntries = (entries: FIDMetric['entries']) => {
      entries.forEach((entry) => {
        if (!softNavsEnabled) {
          po!.disconnect();
        } else if (
          softNavsEnabled &&
          entry.navigationId &&
          entry.navigationId !== metric.navigationId &&
          entry.navigationId !== hardNavId &&
          (getSoftNavigationEntry(entry.navigationId)?.startTime || 0) >
            (getSoftNavigationEntry(metric.navigationId)?.startTime || 0)
        ) {
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
      opts!.reportAllChanges
    );

    if (po) {
      onHidden(() => {
        handleEntries(po!.takeRecords() as FIDMetric['entries']);
        if (!softNavsEnabled) po.disconnect();
      });
    }

    if (window.__WEB_VITALS_POLYFILL__) {
      console.warn(
        'The web-vitals "base+polyfill" build is deprecated. See: https://bit.ly/3aqzsGm'
      );

      // Prefer the native implementation if available,
      if (!po) {
        window.webVitals.firstInputPolyfill(
          handleEntries as FirstInputPolyfillCallback
        );
      }
      onBFCacheRestore(() => {
        metric = initMetric(
          'FID',
          0,
          'back-forward-cache',
          metric.navigationId
        );
        report = bindReporter(
          onReport,
          metric,
          FIDThresholds,
          opts!.reportAllChanges
        );

        window.webVitals.resetFirstInputPolyfill();
        window.webVitals.firstInputPolyfill(
          handleEntries as FirstInputPolyfillCallback
        );
      });
    } else {
      // Only monitor bfcache restores if the browser supports FID natively.
      if (po) {
        onBFCacheRestore(() => {
          metric = initMetric(
            'FID',
            0,
            'back-forward-cache',
            metric.navigationId
          );
          report = bindReporter(
            onReport,
            metric,
            FIDThresholds,
            opts!.reportAllChanges
          );

          resetFirstInputPolyfill();
          firstInputPolyfill(handleEntries as FirstInputPolyfillCallback);
        });
      }
    }
  });
};
