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
 * Returns a promise that resolves once the browser window has loaded and all
 * the images in the document have decoded and rendered.
 * @return {Promise<void>}
 */
export function imagesPainted() {
  return browser.executeAsync(async (done) => {
    // Await `DOMContentLoaded` to ensure all elements are in the DOM.
    await new Promise((resolve) => {
      if (document.readyState === 'loading') {
        addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });

    if (PerformanceObserver.supportedEntryTypes.includes('element')) {
      const nodes = new Set([
        ...document.querySelectorAll('[elementtiming]:not([hidden])'),
      ]);

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (nodes.has(entry.element)) {
            nodes.delete(entry.element);
          }
        }
        if (nodes.size === 0) {
          // Queue a task so this resolves after other callbacks have run.
          setTimeout(() => done(nodes), 0);
        }
      }).observe({type: 'element', buffered: true});
    } else {
      done();
    }
  });
}
