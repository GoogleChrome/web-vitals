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

export interface PerformanceEntryHandler {
  (entry: PerformanceEntry): void;
}

type PerformanceObserverType = PerformanceObserver;

/**
 * Takes a performance entry type and a callback function, and creates a
 * `PerformanceObserver` instance that will observe the specified entry type
 * with buffering enabled and call the callback _for each entry_.
 *
 * This function also feature-detects entry support and wraps the logic in a
 * try/catch to avoid errors in unsupporting browsers.
 */
export const observe = (
    type: string,
    callback: PerformanceEntryHandler,
    win = window
): PerformanceObserverType | undefined => {
  const {PerformanceObserver} = win;
  try {
    if (PerformanceObserver.supportedEntryTypes.includes(type)) {
      // More extensive feature detect needed for Firefox due to:
      // https://github.com/GoogleChrome/web-vitals/issues/142
      if (type === 'first-input' && !('PerformanceEventTiming' in self)) {
        return;
      }

      const po: PerformanceObserverType =
          new PerformanceObserver((l) => l.getEntries().map(callback));

      po.observe({type, buffered: true});
      return po;
    }
  } catch (e) {
    // Do nothing.
  }
  return;
};
