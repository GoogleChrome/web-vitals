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

import {getBFCacheRestoreTime} from '../lib/bfcache.js';
import {getLoadState} from '../lib/getLoadState.js';
import {getNavigationEntry} from '../lib/getNavigationEntry.js';
import {initUnique} from '../lib/initUnique.js';
import {FCPEntryManager} from '../lib/FCPEntryManager.js';
import {checkSoftNavsEnabled} from '../lib/softNavs.js';
import {onFCP as unattributedOnFCP} from '../onFCP.js';
import type {
  FCPAttribution,
  FCPMetric,
  FCPMetricWithAttribution,
  AttributionReportOpts,
} from '../types.js';

export const onFCP = (
  onReport: (metric: FCPMetricWithAttribution) => void,
  opts: AttributionReportOpts = {},
) => {
  opts = Object.assign({}, opts);

  // Init the fcpEntryManager (which will already be initialised in the
  // unattributed onFCP method if soft navigation reporting is enabled
  // and so will return that fcpEntryManager, rather than a new one)
  const fcpEntryManager = initUnique(opts, FCPEntryManager);
  if (checkSoftNavsEnabled(opts)) {
    fcpEntryManager._softNavigationEntryMap = new Map();
  }

  const attributeFCP = (metric: FCPMetric): FCPMetricWithAttribution => {
    // Use a default object if no other attribution has been set.
    let attribution: FCPAttribution = {
      timeToFirstByte: 0,
      firstByteToFCP: metric.value,
      loadState: getLoadState(getBFCacheRestoreTime()),
    };

    if (metric.navigationType !== 'soft-navigation') {
      if (metric.entries.length) {
        const navigationEntry = getNavigationEntry();
        const fcpEntry = metric.entries.at(-1);
        if (navigationEntry) {
          const responseStart = navigationEntry.responseStart;
          const activationStart = navigationEntry.activationStart || 0;
          const ttfb = Math.max(0, responseStart - activationStart);

          attribution = {
            timeToFirstByte: ttfb,
            firstByteToFCP: metric.value - ttfb,
            loadState: getLoadState(metric.entries[0].startTime),
            navigationEntry,
            fcpEntry,
          };
        }
      }
    } else {
      // Lookup the soft navigation entry. Do not use getEntriesByType since
      // that is limited to the first 50 navigation entries due to buffer size.
      const navigationEntry = fcpEntryManager._softNavigationEntryMap?.get(
        metric.navigationId,
      );
      if (navigationEntry) {
        attribution = {
          timeToFirstByte: 0,
          firstByteToFCP: metric.value,
          loadState: 'complete',
          navigationEntry,
        };
      }
    }

    // Use `Object.assign()` to ensure the original metric object is returned.
    const metricWithAttribution: FCPMetricWithAttribution = Object.assign(
      metric,
      {attribution},
    );
    return metricWithAttribution;
  };

  unattributedOnFCP((metric: FCPMetric) => {
    onReport(attributeFCP(metric));
  }, opts);
};
