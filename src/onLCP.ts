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

import {LCPEntryManager} from './lib/LCPEntryManager.js';
import {onBFCacheRestore} from './lib/bfcache.js';
import {bindReporter} from './lib/bindReporter.js';
import {doubleRAF} from './lib/doubleRAF.js';
import {getActivationStart} from './lib/getActivationStart.js';
import {getNavigationEntry} from './lib/getNavigationEntry.js';
import {getSoftNavigationEntry, softNavs} from './lib/softNavs.js';
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {initMetric} from './lib/initMetric.js';
import {initUnique} from './lib/initUnique.js';
import {observe} from './lib/observe.js';
import {whenActivated} from './lib/whenActivated.js';
import {whenIdleOrHidden} from './lib/whenIdleOrHidden.js';
import {
  LCPMetric,
  Metric,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

/** Thresholds for LCP. See https://web.dev/articles/lcp#what_is_a_good_lcp_score */
export const LCPThresholds: MetricRatingThresholds = [2500, 4000];

/**
 * Calculates the [LCP](https://web.dev/articles/lcp) value for the current page and
 * calls the `callback` function once the value is ready (along with the
 * relevant `largest-contentful-paint` performance entry used to determine the
 * value). The reported value is a `DOMHighResTimeStamp`.
 *
 * If the `reportAllChanges` configuration option is set to `true`, the
 * `callback` function will be called any time a new `largest-contentful-paint`
 * performance entry is dispatched, or once the final value of the metric has
 * been determined.
 */
export const onLCP = (
  onReport: (metric: LCPMetric) => void,
  opts: ReportOpts = {},
) => {
  let reportedMetric = false;
  const softNavsEnabled = softNavs(opts);
  let metricNavStartTime = 0;
  const hardNavId = getNavigationEntry()?.navigationId || '1';
  let finalizeNavId = '';

  whenActivated(() => {
    let visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('LCP');
    let report: ReturnType<typeof bindReporter>;

    const lcpEntryManager = initUnique(opts, LCPEntryManager);

    const initNewLCPMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: string,
    ) => {
      metric = initMetric('LCP', 0, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        LCPThresholds,
        opts!.reportAllChanges,
      );
      reportedMetric = false;
      if (navigation === 'soft-navigation') {
        visibilityWatcher = getVisibilityWatcher(true);
        const softNavEntry = getSoftNavigationEntry(navigationId);
        metricNavStartTime =
          softNavEntry && softNavEntry.startTime ? softNavEntry.startTime : 0;
      }
      addInputListeners();
    };

    const handleEntries = (entries: LCPMetric['entries']) => {
      // If reportAllChanges is set then call this function for each entry,
      // otherwise only consider the last one, unless soft navs are enabled.
      if (!opts!.reportAllChanges && !softNavsEnabled) {
        entries = entries.slice(-1);
      }

      for (const entry of entries) {
        if (entry) {
          if (softNavsEnabled && entry?.navigationId !== metric.navigationId) {
            // If the entry is for a new navigationId than previous, then we have
            // entered a new soft nav, so emit the final LCP and reinitialize the
            // metric.
            if (!reportedMetric) report(true);
            initNewLCPMetric('soft-navigation', entry.navigationId);
          }
          let value = 0;
          if (!entry.navigationId || entry.navigationId === hardNavId) {
            // The startTime attribute returns the value of the renderTime if it is
            // not 0, and the value of the loadTime otherwise. The activationStart
            // reference is used because LCP should be relative to page activation
            // rather than navigation start if the page was prerendered. But in cases
            // where `activationStart` occurs after the LCP, this time should be
            // clamped at 0.
            value = Math.max(entry.startTime - getActivationStart(), 0);
          } else {
            // As a soft nav needs an interaction, it should never be before
            // getActivationStart so can just cap to 0
            const softNavEntry = getSoftNavigationEntry(entry.navigationId);
            const softNavEntryStartTime =
              softNavEntry && softNavEntry.startTime
                ? softNavEntry.startTime
                : 0;
            value = Math.max(entry.startTime - softNavEntryStartTime, 0);
          }

          lcpEntryManager._processEntry(entry);

          // Only report if the page wasn't hidden prior to LCP.
          if (entry.startTime < visibilityWatcher.firstHiddenTime) {
            // The startTime attribute returns the value of the renderTime if it is
            // not 0, and the value of the loadTime otherwise. The activationStart
            // reference is used because LCP should be relative to page activation
            // rather than navigation start if the page was prerendered. But in cases
            // where `activationStart` occurs after the LCP, this time should be
            // clamped at 0.
            metric.value = value;
            metric.entries = [entry];
            report();
          }
        }
      }
    };

    const finalizeLCPs = () => {
      removeInputListeners();
      if (!reportedMetric) {
        handleEntries(po!.takeRecords() as LCPMetric['entries']);
        if (!softNavsEnabled) po!.disconnect();
        // As the clicks are handled when idle, check if the current metric was
        // for the reported NavId and only if so, then report.
        if (metric.navigationId === finalizeNavId) {
          reportedMetric = true;
          report(true);
        }
      }
    };

    const addInputListeners = () => {
      ['keydown', 'click'].forEach((type) => {
        // Stop listening after input. Note: while scrolling is an input that
        // stops LCP observation, it's unreliable since it can be programmatically
        // generated. See: https://github.com/GoogleChrome/web-vitals/issues/75
        addEventListener(type, () => handleInput(), true);
      });
    };

    const removeInputListeners = () => {
      ['keydown', 'click'].forEach((type) => {
        // Remove event listeners as no longer required
        removeEventListener(type, () => handleInput(), true);
      });
    };

    const handleInput = () => {
      // Since we only finalize whenIdle, we only want to finalize the LCPs
      // for the current navigationId at the time of the input and not any
      // others that came after, and before it was idle. So note the current
      // metric.navigationId.
      finalizeNavId = metric.navigationId;
      // Wrap in a setTimeout so the callback is run in a separate task
      // to avoid extending the keyboard/click handler to reduce INP impact
      // https://github.com/GoogleChrome/web-vitals/issues/383
      whenIdleOrHidden(finalizeLCPs);
    };

    const handleHidden = () => {
      // Finalise the current navigationId metric.
      finalizeNavId = metric.navigationId;
      // Wrap in a setTimeout so the callback is run in a separate task
      // to avoid extending the keyboard/click handler to reduce INP impact
      // https://github.com/GoogleChrome/web-vitals/issues/383
      finalizeLCPs();
    };

    const po = observe('largest-contentful-paint', handleEntries, opts);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        LCPThresholds,
        opts!.reportAllChanges,
      );

      addInputListeners();

      // Stop listening after input or visibilitychange.
      // Note: while scrolling is an input that stops LCP observation, it's
      // unreliable since it can be programmatically generated.
      // See: https://github.com/GoogleChrome/web-vitals/issues/75
      for (const type of ['keydown', 'click', 'visibilitychange']) {
        // Wrap the listener in an idle callback so it's run in a separate
        // task to reduce potential INP impact.
        // https://github.com/GoogleChrome/web-vitals/issues/383
        addEventListener(type, () => whenIdleOrHidden(handleHidden), {
          capture: true,
          once: true,
        });
      }

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered.
      onBFCacheRestore((event) => {
        initNewLCPMetric('back-forward-cache', metric.navigationId);
        report = bindReporter(
          onReport,
          metric,
          LCPThresholds,
          opts!.reportAllChanges,
        );

        doubleRAF(() => {
          metric.value = performance.now() - event.timeStamp;
          reportedMetric = true;
          report(true);
        });
      });

      // Soft navs may be detected by navigationId changes in metrics above
      // But where no metric is issued we need to also listen for soft nav
      // entries, then emit the final metric for the previous navigation and
      // reset the metric for the new navigation.
      //
      // As PO is ordered by time, these should not happen before metrics.
      //
      // We add a check on startTime as we may be processing many entries that
      // are already dealt with so just checking navigationId differs from
      // current metric's navigation id, as we did above, is not sufficient.
      const handleSoftNavEntries = (entries: SoftNavigationEntry[]) => {
        entries.forEach((entry) => {
          const softNavEntry = entry.navigationId
            ? getSoftNavigationEntry(entry.navigationId)
            : null;
          if (
            entry?.navigationId !== metric.navigationId &&
            (softNavEntry?.startTime || 0) > metricNavStartTime
          ) {
            if (!reportedMetric) report(true);
            initNewLCPMetric('soft-navigation', entry.navigationId);
          }
        });
      };

      if (softNavsEnabled) {
        observe('soft-navigation', handleSoftNavEntries, opts);
      }
    }
  });
};
