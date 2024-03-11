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
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {
  getInteractionCount,
  initInteractionCountPolyfill,
} from './lib/polyfills/interactionCountPolyfill.js';
import {whenActivated} from './lib/whenActivated.js';
import {
  INPMetric,
  INPReportCallback,
  MetricRatingThresholds,
  ReportOpts,
} from './types.js';

interface Interaction {
  id: number;
  latency: number;
  entries: PerformanceEventTiming[];
  renderTime: number;
}

interface PendingEntriesGroup {
  interactionId?: number;
  entries: PerformanceEventTiming[];
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
// store at most 10 of the longest interactions to consider as INP candidates.
const MAX_INTERACTIONS_TO_CONSIDER = 10;

// A list of longest interactions on the page (by latency) sorted so the
// longest one is first. The list is at most MAX_INTERACTIONS_TO_CONSIDER long.
let longestInteractionList: Interaction[] = [];

// A mapping of longest interactions by their interaction ID.
// This is used for faster lookup.
const longestInteractionMap: {[interactionId: string]: Interaction} =
  Object.create(null);

// A mapping between a particular frame's render time and all of the
// event timing entries that occurred within that frame. Since event timing
// entries round their duration to the nearest 8sm, this ends up being
// a best-effort guess, but but debugging and attribution practices it's
// useful to see all events the occurred within the same frame as a particular
// interaction, so it's worth doing the best-effort guess.
// const pendingEntriesGroupMap: Map<number, PendingEntriesGroup> = new Map();
const pendingEntriesGroupMap: {[renderTime: string]: PendingEntriesGroup} =
  Object.create(null);

/**
 * Gets the "frame-normalized" render time for the given entry.
 * In other words, all entries passed to this function that were processed
 * within the same frame should return the same render time. This allows you
 * to group by this render time value.
 * This function works by referencing `pendingEntriesGroupMap` and using
 * an existing render time if one is found (otherwise creating a new one).
 */
const groupEntryByRenderTime = (entry: PerformanceEventTiming) => {
  // Since event timing entry `duration` values are rounded to the nearest
  // 8ms, it's possible that `startTime + duration` could be less than the
  // `processingEnd` time, so we cap the render time there since render times
  // must be after processing.
  const renderTime = Math.max(
    entry.startTime + entry.duration,
    entry.processingEnd,
  );

  let matchingRenderTime;

  for (const key in pendingEntriesGroupMap) {
    const prevRenderTime = Number(key);
    const entriesGroup = pendingEntriesGroupMap[prevRenderTime];

    // If a previous render time is within 8ms of the current render time,
    // assume they were part of the same frame and re-use the previous time.
    // Also break out of the loop because all subsequent times will be newer.
    if (Math.abs(renderTime - prevRenderTime) <= 8) {
      matchingRenderTime = prevRenderTime;
      entriesGroup.entries.push(entry);
      break;
    }

    // If a previous render time is more than 2 seconds before the current
    // render time, assume all entries within that frame have been fully
    // processed and remove it from the pending frames map (to free up space).
    // NOTE: this is not a perfect heuristic, but if it's wrong, the worst
    // thing that will happen is some entries may not get reported along
    // with INP (but that is extremely unlikely). It will not impact
    // the accuracy of the INP value that is reported.
    if (prevRenderTime + 2000 < renderTime) {
      delete pendingEntriesGroupMap[key];
    }
  }

  // If there was no matching render time, assume this is a new frame
  // and add the render time to the pending list.
  if (!matchingRenderTime) {
    pendingEntriesGroupMap[renderTime] = {
      interactionId: entry.interactionId,
      entries: [entry],
    };
  }

  return matchingRenderTime || renderTime;
};

/**
 * Takes a performance entry and adds it to the list of worst interactions
 * if its duration is long enough to make it among the worst. If the
 * entry is part of an existing interaction, it is merged and the latency
 * and entries list is updated as needed.
 */
const processEntry = (entry: PerformanceEventTiming, renderTime: number) => {
  // The least-long of the 10 longest interactions.
  const minLongestInteraction =
    longestInteractionList[longestInteractionList.length - 1];

  const existingInteraction = longestInteractionMap[entry.interactionId!];

  // Only process the entry if it's possibly one of the ten longest,
  // or if it's part of an existing interaction.
  if (
    existingInteraction ||
    longestInteractionList.length < MAX_INTERACTIONS_TO_CONSIDER ||
    entry.duration > minLongestInteraction.latency
  ) {
    const entriesGroup = pendingEntriesGroupMap[renderTime];

    // If the interaction already exists, update it. Otherwise create one.
    if (existingInteraction) {
      if (entry.duration > existingInteraction.latency) {
        existingInteraction.latency = entry.duration;
        if (existingInteraction.renderTime !== renderTime) {
          existingInteraction.renderTime = renderTime;
          existingInteraction.entries = entriesGroup!.entries;
        }
      }
    } else {
      const interaction = {
        id: entry.interactionId!,
        latency: entry.duration,
        entries: entriesGroup!.entries,
        renderTime,
      };
      longestInteractionMap[interaction.id] = interaction;
      longestInteractionList.push(interaction);
    }

    // Sort the entries by latency (descending) and keep only the top ten.
    longestInteractionList.sort((a, b) => b.latency - a.latency);
    if (longestInteractionList.length > MAX_INTERACTIONS_TO_CONSIDER) {
      longestInteractionList
        .splice(MAX_INTERACTIONS_TO_CONSIDER)
        .forEach((i) => {
          delete longestInteractionMap[i.id];
        });
    }
  }
};

/**
 * Returns the estimated p98 longest interaction based on the stored
 * interaction candidates and the interaction count for the current page.
 */
const estimateP98LongestInteraction = () => {
  const candidateInteractionIndex = Math.min(
    longestInteractionList.length - 1,
    Math.floor(getInteractionCountForNavigation() / 50),
  );

  return longestInteractionList[candidateInteractionIndex];
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

  whenActivated(() => {
    // TODO(philipwalton): remove once the polyfill is no longer needed.
    initInteractionCountPolyfill();

    let metric = initMetric('INP');
    let report: ReturnType<typeof bindReporter>;

    const handleEntries = (entries: INPMetric['entries']) => {
      entries.forEach((entry) => {
        // Skip `first-input` entries if any `event` entries have already
        // been processed.
        if (
          entry.entryType === 'first-input' &&
          longestInteractionList.length
        ) {
          return;
        }

        // Group this entry with other entries in the same frame,
        // and get the render time.
        const renderTime = groupEntryByRenderTime(entry);

        if (entry.interactionId || entry.entryType === 'first-input') {
          processEntry(entry, renderTime);
        }
      });

      const inp = estimateP98LongestInteraction();

      if (inp && inp.latency !== metric.value) {
        metric.value = inp.latency;
        metric.entries = inp.entries;
        report();
      }
    };

    const po = observe('event', handleEntries, {
      // Event Timing entries have their durations rounded to the nearest 8ms,
      // so a duration of 40ms would be any event that spans 2.5 or more frames
      // at 60Hz. This threshold is chosen to strike a balance between usefulness
      // and performance. Running this callback for any interaction that spans
      // just one or two frames is likely not worth the insight that could be
      // gained.
      durationThreshold: opts!.durationThreshold ?? 40,
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
        po.observe({type: 'first-input', buffered: true});
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
        longestInteractionList = [];
        // Important, we want the count for the full page here,
        // not just for the current navigation.
        prevInteractionCount = getInteractionCount();

        metric = initMetric('INP');
        report = bindReporter(
          onReport,
          metric,
          INPThresholds,
          opts!.reportAllChanges,
        );
      });
    }
  });
};
