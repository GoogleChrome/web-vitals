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

import {domReadyState} from './domReadyState.js';

let uid = 0;

/**
 * Returns a promise that resolves once the browser has navigated to the
 * passed URL path, optionally waiting until a specific DOM ready state.
 * @return {Promise<void>}
 */
export async function navigateTo(urlPath, opts) {
  await browser.url(urlPath);

  // In Firefox and Safari, if the global PageLoadStrategy is set to "none", then
  // it's possible that `browser.url()` will return before the navigation
  // has started and the old page will still be around, so we have to
  // manually wait until the URL matches the passed URL. Note that this can
  // still fail if the prior test navigated to a page with the same URL.
  // if (browser.capabilities.browserName !== 'chrome') {
  await browser.waitUntil(
    async () => {
      const url = await browser.getUrl();
      const url2 = await browser.execute(() => location.href);

      if (!String(url2).endsWith(urlPath)) {
        console.log('url', url);
        console.log('url2', url2);
      }

      return url2.endsWith(urlPath);
    },
    {interval: 50, timeout: 2000},
  );


  if (opts?.readyState) {
    return await domReadyState(opts.readyState);
  }
}
