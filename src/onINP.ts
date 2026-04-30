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
import {initUnique} from './lib/initUnique.js';
import {InteractionManager} from './lib/InteractionManager.js';
import {observe} from './lib/observe.js';
import {initInteractionCountPolyfill} from './lib/polyfills/interactionCountPolyfill.js';
import {whenActivated} from './lib/whenActivated.js';
import {getVisibilityWatcher} from './lib/getVisibilityWatcher.js';
import {whenIdleOrHidden} from './lib/whenIdleOrHidden.js';

import {
  INPMetric,
  Metric,
  MetricRatingThresholds,
  INPReportOpts,
} from './types.js';

/** Thresholds for INP. See https://web.dev/articles/inp#what_is_a_good_inp_score */
export const INPThresholds: MetricRatingThresholds = [200, 500];

// The default `durationThreshold` used across this library for observing
// `event` entries via PerformanceObserver.
// Event Timing entries have their durations rounded to the nearest 8ms,
// so a duration of 40ms would be any event that spans 2.5 or more frames
// at 60Hz. This threshold is chosen to strike a balance between usefulness
// and performance. Running this callback for any interaction that spans
// just one or two frames is likely not worth the insight that could be
// gained.
const DEFAULT_DURATION_THRESHOLD = 40;

/**
 * Calculates the [INP](https://web.dev/articles/inp) value for the current
 * page and calls the `callback` function once the value is ready, along with
 * the `event` performance entries reported for that interaction. The reported
 * value is a `DOMHighResTimeStamp`.
 *
 * A custom `durationThreshold` configuration option can optionally be passed
 * to control what `event-timing` entries are considered for INP reporting. The
 * default threshold is `40`, which means INP scores of less than 40 will not
 * be reported. To avoid reporting no interactions in these cases, the library
 * will fall back to the input delay of the first interaction. Note that this
 * will not affect your 75th percentile INP value unless that value is also
 * less than 40 (well below the recommended
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
export const onINP = (
  onReport: (metric: INPMetric) => void,
  opts: INPReportOpts = {},
) => {
  // Return if the browser doesn't support all APIs needed to measure INP.
  if (
    !(
      globalThis.PerformanceEventTiming &&
      'interactionId' in PerformanceEventTiming.prototype
    )
  ) {
    return;
  }

  const visibilityWatcher = getVisibilityWatcher();

  whenActivated(() => {
    // TODO(philipwalton): remove once the polyfill is no longer needed.
    initInteractionCountPolyfill();

    let metric = initMetric('INP');
    let report: ReturnType<typeof bindReporter>;

    const interactionManager = initUnique(opts, InteractionManager);

    const initNewINPMetric = (
      navigation?: Metric['navigationType'],
      navigationId?: number,
    ) => {
      interactionManager._resetInteractions();
      metric = initMetric('INP', -1, navigation, navigationId);
      report = bindReporter(
        onReport,
        metric,
        INPThresholds,
        opts!.reportAllChanges,
      );
    };

    const updateINPMetric = () => {
      const inp = interactionManager._estimateP98LongestInteraction(
        metric.navigationType,
      );

      if (inp && inp._latency !== metric.value) {
        metric.value = inp._latency;
        metric.entries = inp.entries;
        report();
      }
    };

    const handleSoftNavEntry = (entry: SoftNavigationEntry) => {
      handleEntries(po?.takeRecords() as INPMetric['entries']);
      updateINPMetric();
      report(true);
      initNewINPMetric('soft-navigation', entry.navigationId);
    };

    const handleEntries = (
      entries: (PerformanceEventTiming | SoftNavigationEntry)[],
    ) => {
      // Queue the `handleEntries()` callback in the next idle task.
      // This is needed to increase the chances that all event entries that
      // occurred between the user interaction and the next paint
      // have been dispatched. Note: there is currently an experiment
      // running in Chrome (EventTimingKeypressAndCompositionInteractionId)
      // 123+ that if rolled out fully may make this no longer necessary.
      whenIdleOrHidden(() => {
        // Only process entries, if at least some of them have interaction ids
        // (otherwise run into lots of errors later for empty INP entries)
        if (entries.filter((entry) => entry.interactionId).length === 0) return;
        for (const entry of entries) {
          if ('largestInteractionContentfulPaint' in entry) {
            handleSoftNavEntry(entry);
            continue;
          }
          interactionManager._processEntry(entry);
        }

        updateINPMetric();
      });
    };

    const po = observe('event', handleEntries, {
      ...opts,
      durationThreshold: opts.durationThreshold ?? DEFAULT_DURATION_THRESHOLD,
    } as PerformanceObserverInit);

    report = bindReporter(
      onReport,
      metric,
      INPThresholds,
      opts.reportAllChanges,
    );

    if (po) {
      visibilityWatcher.onHidden(() => {
        handleEntries(po.takeRecords() as INPMetric['entries']);
        // For soft navigations we may also need to report on hidden, even
        // if there are no entries if the only interactions are < 16ms.
        if (metric.navigationType === 'soft-navigation') {
          updateINPMetric();
        }
        report(true);
      });

      // Only report after a bfcache restore if the `PerformanceObserver`
      // successfully registered.
      onBFCacheRestore(() => {
        initNewINPMetric('back-forward-cache', metric.navigationId);
        doubleRAF(report);
      });
    }
  });
};
