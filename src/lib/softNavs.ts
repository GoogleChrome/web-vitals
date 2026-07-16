/*
 * Copyright 2023 Google LLC
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

import {ReportOpts} from '../types.js';

export const checkSoftNavsEnabled = (opts?: ReportOpts) => {
  return (
    PerformanceObserver.supportedEntryTypes.includes('soft-navigation') &&
    opts &&
    opts.reportSoftNavs
  );
};

// Stores a soft navigation entry keyed by its navigationId, keeping only
// the 2 most recent entries so the map cannot grow unbounded.
export const storeSoftNavEntry = (
  map: Map<number, PerformanceSoftNavigation>,
  entry: PerformanceSoftNavigation,
) => {
  map.set(entry.navigationId!, entry);

  // Clean up older entries to prevent memory leaks, keeping only
  // the 2 most recent entries.
  if (map.size > 2) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) {
      map.delete(firstKey);
    }
  }
};
