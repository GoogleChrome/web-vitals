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
import {onINP as unattributedOnINP} from '../onINP.js';
import {INPMetric, INPMetricWithAttribution, INPReportCallback, INPReportCallbackWithAttribution, ReportOpts} from '../types.js';


const attributeINP = (metric: INPMetric): void => {
  if (metric.entries.length) {
    const longestEntry = metric.entries.sort((a, b) => {
      // Sort by: 1) duration (DESC), then 2) processing time (DESC)
      return b.duration - a.duration || (b.processingEnd - b.processingStart) -
      (a.processingEnd - a.processingStart);
    })[0];

    (metric as INPMetricWithAttribution).attribution = {
      eventTarget: getSelector(longestEntry.target),
      eventType: longestEntry.name,
      eventTime: longestEntry.startTime,
      eventEntry: longestEntry,
      loadState: getLoadState(longestEntry.startTime),
    };
    return;
  }
  // Set an empty object if no other attribution has been set.
  (metric as INPMetricWithAttribution).attribution = {};
};

/**
 * Calculates the [INP](https://web.dev/responsiveness/) value for the current
 * page and calls the `callback` function once the value is ready, along with
 * the `event` performance entries reported for that interaction. The reported
 * value is a `DOMHighResTimeStamp`.
 *
 * A custom `durationThreshold` configuration option can optionally be passed to
 * control what `event-timing` entries are considered for INP reporting. The
 * default threshold is `40`, which means INP scores of less than 40 are
 * reported as 0. Note that this will not affect your 75th percentile INP value
 * unless that value is also less than 40 (well below the recommended
 * [good](https://web.dev/inp/#what-is-a-good-inp-score) threshold).
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
export const onINP = (onReport: INPReportCallbackWithAttribution, opts?: ReportOpts) => {
  unattributedOnINP(((metric: INPMetricWithAttribution) => {
    attributeINP(metric);
    onReport(metric);
  }) as INPReportCallback, opts);
};
