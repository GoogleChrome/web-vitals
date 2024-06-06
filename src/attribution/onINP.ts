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

import {getLoadState} from '../lib/getLoadState.js';
import {getSelector} from '../lib/getSelector.js';
import {
  longestInteractionList,
  entryPreProcessingCallbacks,
  longestInteractionMap,
} from '../lib/interactions.js';
import {observe} from '../lib/observe.js';
import {whenIdle} from '../lib/whenIdle.js';
import {onINP as unattributedOnINP} from '../onINP.js';
import {
  INPAttribution,
  INPMetric,
  INPMetricWithAttribution,
  ReportOpts,
} from '../types.js';

interface pendingEntriesGroup {
  startTime: DOMHighResTimeStamp;
  processingStart: DOMHighResTimeStamp;
  processingEnd: DOMHighResTimeStamp;
  entries: PerformanceEventTiming[];
}

// The maximum number of previous frames for which data is kept in regards to.
// Storing data about previous frames is necessary to handle cases where event
// and LoAF entries are dispatched out or order, and so a buffer of previous
// frame data is needed to determine various bits of INP attribution once all
// the frame-related data has come in.
// In most cases this out-of-order data is only off by a frame or two, so
// keeping the most recent 50 should be more than sufficient.
const MAX_PREVIOUS_FRAMES = 50;

// A PerformanceObserver, observing new `long-animation-frame` entries.
// If this variable is defined it means the browser supports LoAF.
let loafObserver: PerformanceObserver | undefined;

// A list of LoAF entries that have been dispatched and could potentially
// intersect with the INP candidate interaction. Note that periodically this
// list is cleaned up and entries that are known to not match INP are removed.
let pendingLoAFs: PerformanceLongAnimationFrameTiming[] = [];

// A mapping between a particular frame's render time and all of the
// event timing entries that occurred within that frame. Note that periodically
// this map is cleaned up and entries that are known to not match INP are
// removed.
const pendingEntriesGroupMap: Map<number, pendingEntriesGroup> = new Map();

// A list of recent render times. This corresponds to the keys in
// `pendingEntriesGroupMap` but as an array so it can be iterated on in
// reverse. Note that this list is periodically clean up and old render times
// are removed.
let previousRenderTimes: number[] = [];

// The `processingEnd` time of most recently-processed event, chronologically.
let latestProcessingEnd: number;

// A WeakMap so you can look up the `renderTime` of a given entry and the
// value returned will be the same value used by `pendingEntriesGroupMap`.
const entryToRenderTimeMap: WeakMap<
  PerformanceEventTiming,
  DOMHighResTimeStamp
> = new WeakMap();

// A mapping of interactions to the target selector
export const interactionTargetMap: Map<number, Node> = new Map();

// A reference to the idle task used to clean up entries from the above
// variables. If the value is -1 it means no task is queue, and if it's
// greater than -1 the value corresponds to the idle callback handle.
let idleHandle: number = -1;

/**
 * Adds new LoAF entries to the `pendingLoAFs` list.
 */
const handleLoAFEntries = (entries: PerformanceLongAnimationFrameTiming[]) => {
  pendingLoAFs = pendingLoAFs.concat(entries);
  queueCleanup();
};

// Get a reference to the interaction target element in case it's removed
// from the DOM later.
const saveInteractionTarget = (entry: PerformanceEventTiming) => {
  if (
    entry.interactionId &&
    entry.target &&
    !interactionTargetMap.has(entry.interactionId)
  ) {
    interactionTargetMap.set(entry.interactionId, entry.target);
  }
};

/**
 * Groups entries that were presented within the same animation frame by
 * a common `renderTime`. This function works by referencing
 * `pendingEntriesGroupMap` and using an existing render time if one is found
 * (otherwise creating a new one). This function also adds all interaction
 * entries to an `entryToRenderTimeMap` WeakMap so that the "grouped" render
 * times can be looked up later.
 */
const groupEntriesByRenderTime = (entry: PerformanceEventTiming) => {
  let renderTime = entry.startTime + entry.duration;
  let previousRenderTime;

  latestProcessingEnd = Math.max(latestProcessingEnd, entry.processingEnd);

  // Iterate of all previous render times in reverse order to find a match.
  // Go in reverse since the most likely match will be at the end.
  for (let i = previousRenderTimes.length - 1; i >= 0; i--) {
    previousRenderTime = previousRenderTimes[i];

    // If a previous render time is within 8ms of the current render time,
    // assume they were part of the same frame and re-use the previous time.
    // Also break out of the loop because all subsequent times will be newer.
    if (Math.abs(renderTime - previousRenderTime) <= 8) {
      const group = pendingEntriesGroupMap.get(previousRenderTime)!;
      group.startTime = Math.min(entry.startTime, group.startTime);
      group.processingStart = Math.min(
        entry.processingStart,
        group.processingStart,
      );
      group.processingEnd = Math.max(entry.processingEnd, group.processingEnd);
      group.entries.push(entry);

      renderTime = previousRenderTime;
      break;
    }
  }

  // If there was no matching render time, assume this is a new frame.
  if (renderTime !== previousRenderTime) {
    previousRenderTimes.push(renderTime);
    pendingEntriesGroupMap.set(renderTime, {
      startTime: entry.startTime,
      processingStart: entry.processingStart,
      processingEnd: entry.processingEnd,
      entries: [entry],
    });
  }

  // Store the grouped render time for this entry for reference later.
  if (entry.interactionId || entry.entryType === 'first-input') {
    entryToRenderTimeMap.set(entry, renderTime);
  }

  queueCleanup();
};

const queueCleanup = () => {
  // Queue cleanup of entries that are not part of any INP candidates.
  if (idleHandle < 0) {
    idleHandle = whenIdle(cleanupEntries);
  }
};

const cleanupEntries = () => {
  // Delete any stored interaction target elements if they're not part of one
  // of the 10 longest interactions.
  if (interactionTargetMap.size > 10) {
    interactionTargetMap.forEach((_, key) => {
      if (!longestInteractionMap.has(key)) {
        interactionTargetMap.delete(key);
      }
    });
  }

  // The list of previous render times is used to handle cases where
  // events are dispatched out of order. When this happens they're generally
  // only off by a frame or two, so keeping the most recent 50 should be
  // more than sufficient.
  previousRenderTimes = previousRenderTimes.slice(-1 * MAX_PREVIOUS_FRAMES);

  // Keep all render times that are part of a pending INP candidate or
  // that occurred within the 50 most recently-dispatched animation frames.
  const renderTimesToKeep = new Set(
    (previousRenderTimes as (number | undefined)[]).concat(
      longestInteractionList.map((i) => entryToRenderTimeMap.get(i.entries[0])),
    ),
  );

  pendingEntriesGroupMap.forEach((_, key) => {
    if (!renderTimesToKeep.has(key)) pendingEntriesGroupMap.delete(key);
  });

  // Keep all pending LoAF entries that either:
  // 1) intersect with entries in the newly cleaned up `pendingEntriesGroupMap`
  // 2) occur after the most recently-processed event entry.
  const loafsToKeep: Set<PerformanceLongAnimationFrameTiming> = new Set();
  pendingEntriesGroupMap.forEach((group) => {
    getIntersectingLoAFs(group.startTime, group.processingEnd).forEach(
      (loaf) => {
        loafsToKeep.add(loaf);
      },
    );
  });
  for (let i = 0; i < MAX_PREVIOUS_FRAMES; i++) {
    // Look at pending LoAF in reverse order so the most recent are first.
    const loaf = pendingLoAFs[pendingLoAFs.length - 1];

    // If we reach LoAFs that overlap with event processing,
    // we can assume all previous ones have already been handled.
    if (!loaf || loaf.startTime < latestProcessingEnd) break;

    loafsToKeep.add(loaf);
  }

  pendingLoAFs = Array.from(loafsToKeep);

  // Reset the idle callback handle so it can be queued again.
  idleHandle = -1;
};

entryPreProcessingCallbacks.push(
  saveInteractionTarget,
  groupEntriesByRenderTime,
);

const getIntersectingLoAFs = (
  start: DOMHighResTimeStamp,
  end: DOMHighResTimeStamp,
) => {
  const intersectingLoAFs = [];

  for (let i = 0, loaf; (loaf = pendingLoAFs[i]); i++) {
    // If the LoAF ends before the given start time, ignore it.
    if (loaf.startTime + loaf.duration < start) continue;

    // If the LoAF starts after the given end time, ignore it and all
    // subsequent pending LoAFs (because they're in time order).
    if (loaf.startTime > end) break;

    // Still here? If so this LoAF intersects with the interaction.
    intersectingLoAFs.push(loaf);
  }
  return intersectingLoAFs;
};

const attributeINP = (metric: INPMetric): INPMetricWithAttribution => {
  const firstEntry = metric.entries[0];
  const renderTime = entryToRenderTimeMap.get(firstEntry)!;
  const group = pendingEntriesGroupMap.get(renderTime)!;

  const processingStart = firstEntry.processingStart;
  const processingEnd = group.processingEnd;

  // Sort the entries in processing time order.
  const processedEventEntries = group.entries.sort((a, b) => {
    return a.processingStart - b.processingStart;
  });

  const longAnimationFrameEntries: PerformanceLongAnimationFrameTiming[] =
    getIntersectingLoAFs(firstEntry.startTime, processingEnd);

  // The first interaction entry may not have a target defined, so use the
  // first one found in the entry list.
  // TODO: when the following bug is fixed just use `firstInteractionEntry`.
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1367329
  // As a fallback, also check the interactionTargetMap (to account for
  // cases where the element is removed from the DOM before reporting happens).
  const firstEntryWithTarget = metric.entries.find((entry) => entry.target);
  const interactionTargetElement =
    (firstEntryWithTarget && firstEntryWithTarget.target) ||
    interactionTargetMap.get(firstEntry.interactionId);

  // Since entry durations are rounded to the nearest 8ms, we need to clamp
  // the `nextPaintTime` value to be higher than the `processingEnd` or
  // end time of any LoAF entry.
  const nextPaintTimeCandidates = [
    firstEntry.startTime + firstEntry.duration,
    processingEnd,
  ].concat(
    longAnimationFrameEntries.map((loaf) => loaf.startTime + loaf.duration),
  );

  const nextPaintTime = Math.max.apply(Math, nextPaintTimeCandidates);

  const attribution: INPAttribution = {
    interactionTarget: getSelector(interactionTargetElement),
    interactionTargetElement: interactionTargetElement,
    interactionType: firstEntry.name.startsWith('key') ? 'keyboard' : 'pointer',
    interactionTime: firstEntry.startTime,
    nextPaintTime: nextPaintTime,
    processedEventEntries: processedEventEntries,
    longAnimationFrameEntries: longAnimationFrameEntries,
    inputDelay: processingStart - firstEntry.startTime,
    processingDuration: processingEnd - processingStart,
    presentationDelay: Math.max(nextPaintTime - processingEnd, 0),
    loadState: getLoadState(firstEntry.startTime),
  };

  // Use Object.assign to set property to keep tsc happy.
  const metricWithAttribution: INPMetricWithAttribution = Object.assign(
    metric,
    {attribution},
  );
  return metricWithAttribution;
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
export const onINP = (
  onReport: (metric: INPMetricWithAttribution) => void,
  opts?: ReportOpts,
) => {
  if (!loafObserver) {
    loafObserver = observe('long-animation-frame', handleLoAFEntries);
  }
  unattributedOnINP((metric: INPMetric) => {
    const metricWithAttribution = attributeINP(metric);
    onReport(metricWithAttribution);
  }, opts);
};
