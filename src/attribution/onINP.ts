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
import {observe} from '../lib/observe.js';
import {onINP as unattributedOnINP} from '../onINP.js';
import {
  INPMetric,
  INPMetricWithAttribution,
  INPReportCallback,
  INPReportCallbackWithAttribution,
  ReportOpts,
} from '../types.js';

// The maximum number of LoAF entries with interactions to keep in memory.
// 10 is chosen here because it corresponds to the maximum number of
// long interactions needed to compute INP, so no matter which one of those
// interactions ends up being the INP candidate, it should correspond to one
// of the 10 longest LoAF entries containing an interaction.
const MAX_LOAFS_TO_CONSIDER = 10;

// A list of longest LoAFs with interactions on the page sorted so the
// longest one is first. The list is at most MAX_LOAFS_TO_CONSIDER long.
const longestLoAFsList: PerformanceLongAnimationFrameTiming[] = [];

// A PerformanceObserver, observing new `long-animation-frame` entries.
// If this variable is defined it means the browser supports LoAF.
let loafObserver: PerformanceObserver | undefined;

const handleEntries = (entries: PerformanceLongAnimationFrameTiming[]) => {
  entries.forEach((entry) => {
    if (entry.firstUIEventTimestamp > 0) {
      const minLongestLoAF = longestLoAFsList[longestLoAFsList.length - 1];

      if (!longestLoAFsList.length) {
        longestLoAFsList.push(entry);
        return;
      }

      // If the entry is possibly one of the 10 longest, insert it into the
      // list of pending LoAFs at the correct spot (sorted), ensuring the list
      // is not longer than `MAX_LOAFS_TO_CONSIDER`.
      if (
        longestLoAFsList.length < MAX_LOAFS_TO_CONSIDER ||
        entry.duration > minLongestLoAF.duration
      ) {
        for (let i = 0; i < longestLoAFsList.length; i++) {
          if (entry.duration > longestLoAFsList[i].duration) {
            longestLoAFsList.splice(i, 0, entry);
            break;
          }
        }
        if (longestLoAFsList.length > MAX_LOAFS_TO_CONSIDER) {
          longestLoAFsList.splice(MAX_LOAFS_TO_CONSIDER);
        }
      }
    }
  });
};

const attributeINP = (metric: INPMetric): void => {
  const sortedEntries = metric.entries.sort((a, b) => {
    return a.processingStart - b.processingStart;
  });

  const firstEntry = sortedEntries[0];
  const lastEntry = sortedEntries[sortedEntries.length - 1];
  const renderTime = firstEntry.startTime + firstEntry.duration;

  let longAnimationFrameEntry;
  for (const loaf of longestLoAFsList) {
    const loafEnd = loaf.startTime + loaf.duration;
    if (
      firstEntry.startTime === loaf.firstUIEventTimestamp ||
      (loafEnd <= renderTime && loafEnd >= firstEntry.processingStart)
    ) {
      longAnimationFrameEntry = loaf;
      break;
    }
  }

  // If the browser supports the Long Animation Frame API and a
  // `long-animation-frame` entry was found matching this interaction,
  // use that entry's `renderTime` since it could be more accurate (and
  // it accounts for non-event listener work such as timers or other
  // pending tasks that could get run before rendering starts). If not,
  // use the `processingEnd` value of the last entry in the list, which
  // should match the `renderTime` value in most cases.
  const renderStart = longAnimationFrameEntry
    ? longAnimationFrameEntry.renderStart
    : lastEntry.processingEnd;

  // The first entry may not have a target defined, so use the first
  // one found in the entry list.
  const firstEntryWithTarget = metric.entries.find((entry) => entry.target);

  // Determine the type of interaction based on the first entry with
  // a matching keydown/keyup or pointerdown/pointerup entry name.
  const firstEntryWithType = metric.entries.find((entry) =>
    entry.name.match(/^(key|pointer)(down|up)$/),
  );

  (metric as INPMetricWithAttribution).attribution = {
    interactionTarget: getSelector(
      firstEntryWithTarget && firstEntryWithTarget.target,
    ),
    interactionType:
      firstEntryWithType && firstEntryWithType.name.startsWith('key')
        ? 'keyboard'
        : 'pointer',
    interactionTime: sortedEntries[0].startTime,
    longAnimationFrameEntry: longAnimationFrameEntry,
    inputDelay: firstEntry.processingStart - firstEntry.startTime,
    processingTime: renderStart - firstEntry.processingStart,
    presentationDelay: Math.max(renderTime - renderStart, 0),
    loadState: getLoadState(sortedEntries[0].startTime),
  };
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
  onReport: INPReportCallbackWithAttribution,
  opts?: ReportOpts,
) => {
  if (!loafObserver) {
    loafObserver = observe('long-animation-frame', handleEntries);
  }

  unattributedOnINP(
    ((metric: INPMetricWithAttribution) => {
      attributeINP(metric);
      onReport(metric);
    }) as INPReportCallback,
    opts,
  );
};
