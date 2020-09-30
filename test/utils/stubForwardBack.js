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
 * Overrides the document's `visibilityState` property, sets the body's hidden
 * attribute (to prevent painting) and dispatches a `visibilitychange` event.
 * @return {Promise<void>}
 */
function stubForwardBack(visibilityStateAfterRestore) {
  return browser.executeAsync((visibilityStateAfterRestore, done) => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', {
      persisted: true,
    }));
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.body.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (visibilityStateAfterRestore !== 'hidden') {
          delete document.visibilityState;
          document.body.hidden = false;
        }
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new PageTransitionEvent('pageshow', {
          persisted: true,
        }));
        done();
      });
    });
  }, visibilityStateAfterRestore);
}

module.exports = {
  stubForwardBack,
};
