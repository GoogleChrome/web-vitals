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
import {onFID as unattributedOnFID} from '../onFID.js';
import {
  FIDMetric,
  FIDMetricWithAttribution,
  FIDReportCallback,
  FIDReportCallbackWithAttribution,
  ReportOpts,
} from '../types.js';

const attributeFID = (metric: FIDMetric): void => {
  const fidEntry = metric.entries[0];
  (metric as FIDMetricWithAttribution).attribution = {
    eventTarget: getSelector(fidEntry.target),
    eventType: fidEntry.name,
    eventTime: fidEntry.startTime,
    eventEntry: fidEntry,
    loadState: getLoadState(fidEntry.startTime),
  };
};

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
  onReport: FIDReportCallbackWithAttribution,
  opts?: ReportOpts,
) => {
  unattributedOnFID(
    ((metric: FIDMetricWithAttribution) => {
      attributeFID(metric);
      onReport(metric);
    }) as FIDReportCallback,
    opts,
  );
};
