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

/**
 * Returns true if the browser supports using PerformanceObserver and the
 * passed entry type.
 * @param {string} type The performance entry type.
 * @return {boolean}
 */
function browserSupportsEntry(type) {
  return browser.execute((type) => {
    // More extensive feature detect needed for Firefox due to:
    // https://github.com/GoogleChrome/web-vitals/issues/142
    if (type === 'first-input' && !('PerformanceEventTiming' in window)) {
      return false;
    }

    return window.PerformanceObserver &&
        window.PerformanceObserver.supportedEntryTypes &&
        window.PerformanceObserver.supportedEntryTypes.includes(type);
  }, type);
}

module.exports = {
  browserSupportsEntry,
};
