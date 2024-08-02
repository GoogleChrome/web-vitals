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

/**
 * Returns a promise that resolves once the browser window has loaded, all
 * load callbacks have finished executing, and any pending `__readyPromises`
 * have settled.
 * @return {Promise<void>}
 */
export function domReadyState(state) {
  return browser.executeAsync(async (state, done) => {
    const logs = [];
    logs.push(['title', document.title, window.location.href]);
    logs.push(['foo', self.wv, document.readyState]);

    await new Promise((resolve) => {
      logs.push(['foo:promise', self.wv, document.readyState]);
      if (document.readyState === 'complete' || document.readyState === state) {
        resolve();
      } else {
        document.addEventListener('readystatechange', () => {
          if (
            document.readyState === state ||
            document.readyState === 'complete'
          ) {
            resolve();
          }
        });
      }
    });
    if (state !== 'loading' && self.__readyPromises) {
      logs.push(['foo2', self.wv, document.readyState]);
      await Promise.all(self.__readyPromises);
    }
    logs.push(['foo3', self.wv, document.readyState]);
    logs.push(['vs', document.visibilityState]);
    logs.push(['title', document.title, window.location.href]);

    // Queue a task so this resolves after any event callbacks run.
    setTimeout(() => {
      logs.push(['foo4', self.wv, document.readyState]);
      done(logs);
    }, 0);
  }, state);
}
