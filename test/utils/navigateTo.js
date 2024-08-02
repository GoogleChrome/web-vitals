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

/**
 * Returns a promise that resolves once the browser has navigated to the
 * passed URL path, optionally waiting until a specific DOM ready state.
 * @return {Promise<void>}
 */
export async function navigateTo(urlPath, opts) {
  await browser.url(urlPath);

  // It's possible that `browser.url()` will return before the navigation
  // has started and the old page will still be around, so we have to
  // manually wait until the URL matches the passed URL. Note that this can
  // still fail if the prior test navigated to a page with the same URL.
  await browser.waitUntil(async () => {
    return (await browser.getUrl()).endsWith(urlPath);
  });
  await browser.waitUntil(async () => {
    return (await browser.execute(() => location.href)).endsWith(urlPath);
  });

  if (opts?.readyState) {
    await domReadyState(opts.readyState);
  }
}
