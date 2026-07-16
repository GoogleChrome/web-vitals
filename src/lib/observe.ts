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
  'soft-navigation': PerformanceSoftNavigation[];
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
  types: K[],
  callback: (entries: Array<PerformanceEntryMap[K][number]>) => void,
  opts: PerformanceObserverInit = {},
): PerformanceObserver | undefined => {
  try {
    const supportedTypes = types.filter((t) =>
      PerformanceObserver.supportedEntryTypes.includes(t),
    );
    if (supportedTypes.length > 0) {
      const po = new PerformanceObserver((list) => {
        // Delay by a microtask to workaround a bug in Safari where the
        // callback is invoked immediately, rather than in a separate task.
        // See: https://github.com/GoogleChrome/web-vitals/issues/277
        queueMicrotask(() => {
          const entries = list.getEntries();
          // When observing more than one entry type, entries from different
          // types can be delivered out of order, so sort by end time
          // (startTime + duration) to ensure they're in the right order.
          // See: https://github.com/w3c/performance-timeline/issues/224
          if (supportedTypes.length > 1) {
            entries.sort((a, b) => {
              const scoreA = a.startTime + a.duration;
              const scoreB = b.startTime + b.duration;

              return scoreA - scoreB;
            });
          }
          callback(entries as Array<PerformanceEntryMap[K][number]>);
        });
      });

      for (const t of supportedTypes) {
        po.observe({type: t, buffered: true, ...opts});
      }
      return po;
    }
  } catch {
    // Do nothing.
  }
  return;
};
