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
import {getSoftNavigationEntry, checkSoftNavsEnabled} from './lib/softNavs.js';
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
  // As InteractionContentfulPaint entries used by soft navs can emit after
  // LCP is finalized, we need a flag to know to ignore them.
  let isFinalized = false;
  const softNavsEnabled = checkSoftNavsEnabled(opts);

  whenActivated(() => {
    let visibilityWatcher = getVisibilityWatcher();
    let metric = initMetric('LCP');
    let report: ReturnType<typeof bindReporter>;

    const lcpEntryManager = initUnique(opts, LCPEntryManager);

    const initNewLCPMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: number,
    ) => {
      metric = initMetric('LCP', 0, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        LCPThresholds,
        opts!.reportAllChanges,
      );
      // Reset the finalized flag
      isFinalized = false;
      // If it's a soft nav, then need to reset the visibilitywatcher
      if (navigation === 'soft-navigation') {
        visibilityWatcher = getVisibilityWatcher(true);
      }
    };

    const handleSoftNavEntry = (entry: SoftNavigationEntry) => {
      handleEntries(po!.takeRecords() as LCPMetric['entries']);
      if (!isFinalized) report(true);
      initNewLCPMetric('soft-navigation', entry.navigationId);
      // Soft Navs contain the largest paint until now, so handle that as
      // if it just happened, then listen for more.
      // The largestInteractionContentfulPaint will have the old
      // navigationId in this case, so pass the new one
      handleEntries([entry.largestInteractionContentfulPaint]);
    };

    const handleEntries = (
      entries: (
        | LargestContentfulPaint
        | InteractionContentfulPaint
        | SoftNavigationEntry
      )[],
    ) => {
      // If reportAllChanges is set then call this function for each entry,
      // otherwise only consider the last one, unless soft navs are enabled.
      if (!opts!.reportAllChanges && !softNavsEnabled) {
        entries = entries.slice(-1);
      }

      for (const entry of entries) {
        if ('largestInteractionContentfulPaint' in entry) {
          handleSoftNavEntry(entry);
          continue;
        }

        if (entry) {
          let value = 0;
          if (entry instanceof LargestContentfulPaint) {
            // The startTime attribute returns the value of the renderTime if it is
            // not 0, and the value of the loadTime otherwise. The activationStart
            // reference is used because LCP should be relative to page activation
            // rather than navigation start if the page was prerendered. But in cases
            // where `activationStart` occurs after the LCP, this time should be
            // clamped at 0.
            value = Math.max(entry.startTime - getActivationStart(), 0);
          } else {
            // InteractionContentfulPaints should only happen after a
            // SoftNavigationEntry so the metric should have been set
            // with a non-zero navigationId mapping to a soft nav.
            if (!metric.navigationId) continue;
            const softNavEntry = getSoftNavigationEntry(metric.navigationId);
            if (!softNavEntry) continue;

            // Ignore interactions not for this soft nav
            // (either paints that have bled into this interaction or paints when
            // we should have already finalized)
            if (
              'interactionId' in entry &&
              entry.interactionId != softNavEntry.interactionId
            ) {
              continue;
            }

            // Paints should never be less than 0 but add cap just in case
            value = Math.max(entry.renderTime - softNavEntry.startTime, 0);
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

    const po = observe('largest-contentful-paint', handleEntries, opts);

    if (po) {
      report = bindReporter(
        onReport,
        metric,
        LCPThresholds,
        opts!.reportAllChanges,
      );

      const finalizeLCP = (event: Event) => {
        if (event.isTrusted && !isFinalized) {
          // Wrap the listener in an idle callback so it's run in a separate
          // task to reduce potential INP impact.
          // https://github.com/GoogleChrome/web-vitals/issues/383
          whenIdleOrHidden(() => {
            if (!isFinalized) {
              handleEntries(po!.takeRecords() as LCPMetric['entries']);
              if (!softNavsEnabled) {
                po!.disconnect();
                removeEventListener(event.type, finalizeLCP);
              }
              isFinalized = true;
              report(true);
            }
          });
        }
      };

      // Stop listening after input or visibilitychange.
      // Note: while scrolling is an input that stops LCP observation, it's
      // unreliable since it can be programmatically generated.
      // See: https://github.com/GoogleChrome/web-vitals/issues/75
      for (const type of ['keydown', 'click', 'visibilitychange']) {
        addEventListener(type, finalizeLCP, {
          capture: true,
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
          isFinalized = true;
          report(true);
        });
      });
    }
  });
};
