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

import {checkSoftNavsEnabled} from './softNavs.js';

interface PerformanceEntryMap {
  'event': PerformanceEventTiming[];
  'first-input': PerformanceEventTiming[];
  'interaction-contentful-paint': InteractionContentfulPaint[];
  'layout-shift': LayoutShift[];
  'largest-contentful-paint': LargestContentfulPaint[];
  'long-animation-frame': PerformanceLongAnimationFrameTiming[];
  'paint': PerformancePaintTiming[];
  'navigation': PerformanceNavigationTiming[];
  'resource': PerformanceResourceTiming[];
  'soft-navigation': SoftNavigationEntry[];
}

/**
 * Takes a performance entry type and a callback function, and creates a
 * `PerformanceObserver` instance that will observe the specified entry type
 * with buffering enabled and call the callback _for each entry_.
 *
 * This function also feature-detects entry support and wraps the logic in a
 * try/catch to avoid errors in unsupporting browsers.
 */
export const observe = <K extends keyof PerformanceEntryMap>(
  type: K,
  callback: (entries: PerformanceEntryMap[K]) => void,
  opts: PerformanceObserverInit = {},
): PerformanceObserver | undefined => {
  // Observe extra types if using SoftNavs
  const typesToMonitor: (keyof PerformanceEntryMap)[] = [type];
  const reportSoftNavs = checkSoftNavsEnabled(opts);
  if (type === 'event') {
    // Also observe entries of type `first-input`. This is useful in cases
    // where the first interaction is less than the `durationThreshold`.
    typesToMonitor.push('first-input');
  }
  if (reportSoftNavs) {
    if (
      type === 'largest-contentful-paint' ||
      type === 'event' ||
      type === 'layout-shift'
    ) {
      typesToMonitor.push('soft-navigation');
    }

    if (type === 'largest-contentful-paint') {
      typesToMonitor.push('interaction-contentful-paint');
    }
  }
  try {
    if (PerformanceObserver.supportedEntryTypes.includes(type)) {
      const po = new PerformanceObserver((list) => {
        // Delay by a microtask to workaround a bug in Safari where the
        // callback is invoked immediately, rather than in a separate task.
        // See: https://github.com/GoogleChrome/web-vitals/issues/277
        queueMicrotask(() => {
          // sort entries to ensure they're in the right order
          const entries = list.getEntries();
          // Best to sort by end time (startTime + duration)
          // See: https://github.com/w3c/performance-timeline/issues/224
          entries.sort((a, b) => {
            const scoreA = a.startTime + a.duration;
            const scoreB = b.startTime + b.duration;

            return scoreA - scoreB;
          });
          callback(entries as PerformanceEntryMap[K]);
        });
      });

      for (const t of typesToMonitor) {
        po.observe(
          Object.assign(
            {
              type: t,
              buffered: true,
              ...opts,
            },
            opts || {},
          ) as PerformanceObserverInit,
        );
      }
      return po;
    }
  } catch {
    // Do nothing.
  }
  return;
};
