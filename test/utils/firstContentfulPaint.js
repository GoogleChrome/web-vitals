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

/**
 * Returns a promise that resolves once the browser window has painted
 * the first frame.
 * @return {Promise<void>}
 */
export function firstContentfulPaint() {
  return browser.executeAsync(async (done) => {
    if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
      new PerformanceObserver(() => {
        done();
      }).observe({
        type: 'paint',
        buffered: true,
      });
    } else {
      done();
    }
  });
}
