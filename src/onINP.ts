/*
 * Copyright 2022 Google LLC
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
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {
  getInteractionCount,
  initInteractionCountPolyfill,
} from './lib/polyfills/interactionCountPolyfill.js';
import {getSoftNavigationEntry, softNavs} from './lib/softNavs.js';
import {whenActivated} from './lib/whenActivated.js';
import {
  INPMetric,
  INPReportCallback,
  Metric,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

interface Interaction {
  id: number;
  latency: number;
  entries: PerformanceEventTiming[];
  startTime: DOMHighResTimeStamp;
}

/** Thresholds for INP. See https://web.dev/articles/inp#what_is_a_good_inp_score */
export const INPThresholds: MetricRatingThresholds = [200, 500];

// Used to store the interaction count after a bfcache restore, since p98
// interaction latencies should only consider the current navigation.
let prevInteractionCount = 0;

/**
 * Returns the interaction count since the last bfcache restore (or for the
 * full page lifecycle if there were no bfcache restores).
 */
const getInteractionCountForNavigation = () => {
  return getInteractionCount() - prevInteractionCount;
};

// To prevent unnecessary memory usage on pages with lots of interactions,
// store 10 interactions to consider as INP candidates.
const MAX_INTERACTIONS_TO_CONSIDER = 10;

// A list of interactions on the page (the list is as most
// MAX_INTERACTIONS_TO_CONSIDER long).
let interactionList: Interaction[] = [];

// A mapping of longest interactions by their interaction ID.
// This is used for faster lookup.
const longestInteractionMap: {[interactionId: string]: Interaction} = {};

/**
 * Takes a performance entry and adds it to the list of worst interactions
 * if its duration is long enough to make it among the worst. If the
 * entry is part of an existing interaction, it is merged and the latency
 * and entries list is updated as needed.
 */
const processEntry = (
  entry: PerformanceEventTiming,
  reportAllChanges?: boolean,
) => {
  // The least-long of the 10 longest interactions.
  const minLongestInteraction = interactionList[interactionList.length - 1];

  const existingInteraction = longestInteractionMap[entry.interactionId!];

  // Only process the entry if it's possibly one of the ten longest,
  // or if it's part of an existing interaction or if all changes
  // should be reported.
  if (
    existingInteraction ||
    interactionList.length < MAX_INTERACTIONS_TO_CONSIDER ||
    entry.duration > minLongestInteraction.latency ||
    reportAllChanges
  ) {
    // If the interaction already exists, update it. Otherwise create one.
    if (existingInteraction) {
      existingInteraction.entries.push(entry);
      existingInteraction.latency = Math.max(
        existingInteraction.latency,
        entry.duration,
      );
    } else {
      const interaction = {
        id: entry.interactionId!,
        latency: entry.duration,
        startTime: entry.startTime,
        entries: [entry],
      };
      longestInteractionMap[interaction.id] = interaction;
      interactionList.push(interaction);
    }

    if (reportAllChanges) {
      // Sort the entries by startTime
      interactionList.sort((a, b) => a.startTime - b.startTime);
    } else {
      // Sort the entries by latency (descending)
      interactionList.sort((a, b) => b.latency - a.latency);
    }

    // To prevent unnecessary memory usage on pages with lots of interactions,
    // keep the top 10 of the interactions.
    interactionList.splice(MAX_INTERACTIONS_TO_CONSIDER).forEach((i) => {
      delete longestInteractionMap[i.id];
    });
  }
};

/**
 * Returns the estimated p98 longest interaction based on the stored
 * interaction candidates and the interaction count for the current page.
 */
const estimateP98LongestInteraction = () => {
  const candidateInteractionIndex = Math.min(
    interactionList.length - 1,
    Math.floor(getInteractionCountForNavigation() / 50),
  );

  return interactionList[candidateInteractionIndex];
};

/**
 * Calculates the [INP](https://web.dev/articles/inp) value for the current
 * page and calls the `callback` function once the value is ready, along with
 * the `event` performance entries reported for that interaction. The reported
 * value is a `DOMHighResTimeStamp`.
 *
 * A custom `durationThreshold` configuration option can optionally be passed to
 * control what `event-timing` entries are considered for INP reporting. The
 * default threshold is `40`, which means INP scores of less than 40 are
 * reported as 0. Note that this will not affect your 75th percentile INP value
 * unless that value is also less than 40 (well below the recommended
 * [good](https://web.dev/articles/inp#what_is_a_good_inp_score) threshold).
 *
 * If the `reportAllChanges` configuration option is set to `true`, the
 * `callback` function will be called as soon as the value is initially
 * determined as well as any time the value changes throughout the page
 * lifespan.
 *
 * _**Important:** INP should be continually monitored for changes throughout
 * the entire lifespan of a page—including if the user returns to the page after
 * it's been hidden/backgrounded. However, since browsers often [will not fire
 * additional callbacks once the user has backgrounded a
 * page](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden),
 * `callback` is always called when the page's visibility state changes to
 * hidden. As a result, the `callback` function might be called multiple times
 * during the same page load._
 */
export const onINP = (onReport: INPReportCallback, opts?: ReportOpts) => {
  // Set defaults
  opts = opts || {};
  const softNavsEnabled = softNavs(opts);
  let reportedMetric = false;
  let metricNavStartTime = 0;

  whenActivated(() => {
    // TODO(philipwalton): remove once the polyfill is no longer needed.
    initInteractionCountPolyfill(softNavsEnabled);

    let metric = initMetric('INP');
    let report: ReturnType<typeof bindReporter>;

    const initNewINPMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: string,
    ) => {
      interactionList = [];
      // Important, we want the count for the full page here,
      // not just for the current navigation.
      prevInteractionCount =
        navigation === 'soft-navigation' ? 0 : getInteractionCount();
      metric = initMetric('INP', 0, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        INPThresholds,
        opts!.reportAllChanges,
      );
      reportedMetric = false;
      if (navigation === 'soft-navigation') {
        const softNavEntry = getSoftNavigationEntry(navigationId);
        metricNavStartTime =
          softNavEntry && softNavEntry.startTime ? softNavEntry.startTime : 0;
      }
    };

    const updateINPMetric = () => {
      if (opts?.reportAllChanges) {
        const latestInteraction = interactionList.at(-1);

        if (latestInteraction) {
          metric.value = latestInteraction.latency;
          metric.entries = latestInteraction.entries;
          return;
        }
      }

      const inp = estimateP98LongestInteraction();

      if (inp && inp.latency !== metric.value) {
        metric.value = inp.latency;
        metric.entries = inp.entries;
      }
    };

    const handleEntries = (entries: INPMetric['entries']) => {
      entries.forEach((entry) => {
        if (
          softNavsEnabled &&
          entry.navigationId &&
          entry.navigationId !== metric.navigationId
        ) {
          // If the entry is for a new navigationId than previous, then we have
          // entered a new soft nav, so emit the final INP and reinitialize the
          // metric.
          if (!reportedMetric) {
            updateINPMetric();
            if (metric.value > 0) report(true);
          }
          initNewINPMetric('soft-navigation', entry.navigationId);
        }
        if (entry.interactionId) {
          processEntry(entry, opts?.reportAllChanges);
        }

        // Entries of type `first-input` don't currently have an `interactionId`,
        // so to consider them in INP we have to first check that an existing
        // entry doesn't match the `duration` and `startTime`.
        // Note that this logic assumes that `event` entries are dispatched
        // before `first-input` entries. This is true in Chrome (the only browser
        // that currently supports INP).
        // TODO(philipwalton): remove once crbug.com/1325826 is fixed.
        if (entry.entryType === 'first-input') {
          const noMatchingEntry = !interactionList.some((interaction) => {
            return interaction.entries.some((prevEntry) => {
              return (
                entry.duration === prevEntry.duration &&
                entry.startTime === prevEntry.startTime
              );
            });
          });
          if (noMatchingEntry) {
            processEntry(entry, opts?.reportAllChanges);
          }
        }
      });

      updateINPMetric();
      report(true);
    };

    const po = observe('event', handleEntries, {
      // Event Timing entries have their durations rounded to the nearest 8ms,
      // so a duration of 40ms would be any event that spans 2.5 or more frames
      // at 60Hz. This threshold is chosen to strike a balance between usefulness
      // and performance. Running this callback for any interaction that spans
      // just one or two frames is likely not worth the insight that could be
      // gained.
      durationThreshold: opts!.durationThreshold ?? 40,
      opts,
    } as PerformanceObserverInit);

    report = bindReporter(
      onReport,
      metric,
      INPThresholds,
      opts!.reportAllChanges,
    );

    if (po) {
      // If browser supports interactionId (and so supports INP), also
      // observe entries of type `first-input`. This is useful in cases
      // where the first interaction is less than the `durationThreshold`.
      if (
        'PerformanceEventTiming' in window &&
        'interactionId' in PerformanceEventTiming.prototype
      ) {
        po.observe({
          type: 'first-input',
          buffered: true,
          includeSoftNavigationObservations: softNavsEnabled,
        });
      }

      onHidden(() => {
        handleEntries(po.takeRecords() as INPMetric['entries']);

        // If the interaction count shows that there were interactions but
        // none were captured by the PerformanceObserver, report a latency of 0.
        if (metric.value < 0 && getInteractionCountForNavigation() > 0) {
          metric.value = 0;
          metric.entries = [];
        }

        report(true);
      });

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered.
      onBFCacheRestore(() => {
        initNewINPMetric('back-forward-cache', metric.navigationId);

        doubleRAF(() => report());
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
          const softNavEntry = getSoftNavigationEntry(entry.navigationId);
          const softNavEntryStartTime =
            softNavEntry && softNavEntry.startTime ? softNavEntry.startTime : 0;
          if (
            entry.navigationId &&
            entry.navigationId !== metric.navigationId &&
            softNavEntryStartTime > metricNavStartTime
          ) {
            if (!reportedMetric && metric.value > 0) report(true);
            initNewINPMetric('soft-navigation', entry.navigationId);
            report = bindReporter(
              onReport,
              metric,
              INPThresholds,
              opts!.reportAllChanges,
            );
          }
        });
      };

      if (softNavsEnabled) {
        observe('soft-navigation', handleSoftNavEntries, opts);
      }
    }
  });
};
