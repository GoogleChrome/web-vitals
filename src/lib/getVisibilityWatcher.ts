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

import {onBFCacheRestore} from './bfcache.js';
import {getActivationStart} from './getActivationStart.js';

let firstHiddenTime = -1;
const onHiddenFunctions: Set<() => void> = new Set();

const initHiddenTime = () => {
  // If the document is hidden when this code runs, assume it was always
  // hidden and the page was loaded in the background, with the one exception
  // that visibility state is always 'hidden' during prerendering, so we have
  // to ignore that case until prerendering finishes (see: `prerenderingchange`
  // event logic below).
  return document.visibilityState === 'hidden' && !document.prerendering
    ? 0
    : Infinity;
};

const onVisibilityUpdate = (event: Event) => {
  // Handle changes to hidden state
  // Also include page unloads which can happen while page is backgrounded.
  if (document.visibilityState === 'hidden' || event.type === 'pagehide') {
    if (event.type !== 'prerenderingchange') {
      for (const onHiddenFunction of onHiddenFunctions) {
        onHiddenFunction();
      }
    }

    // Record the first time the page became hidden or unloaded.
    if (!isFinite(firstHiddenTime)) {
      // A prerender activated in the background has always been hidden.
      // Similar for pagehide if the firstHiddenTime has not been set yet
      // (e.g. tab opened in background and closed)
      // Otherwise, use the time the page became hidden or unloaded.
      firstHiddenTime =
        event.type === 'prerenderingchange' || event.type === 'pagehide'
          ? 0
          : event.timeStamp;

      // We no longer need the `prerenderingchange` event listener now we've
      // set an initial init time so remove that
      // (keep visibilitychange and pagehide for onHiddenFunction above)
      removeEventListener('prerenderingchange', onVisibilityUpdate, true);
    }
  }
};

export const getVisibilityWatcher = (reset = false) => {
  if (reset) {
    firstHiddenTime = Infinity;
  }
  if (firstHiddenTime < 0) {
    // Check if we have a previous hidden `visibility-state` performance entry.
    const activationStart = getActivationStart();
    /* eslint-disable indent */
    const firstVisibilityStateHiddenTime = !document.prerendering
      ? globalThis.performance
          .getEntriesByType('visibility-state')
          .find((e) => e.name === 'hidden' && e.startTime >= activationStart)
          ?.startTime
      : undefined;
    /* eslint-enable indent */

    // Prefer that, but if it's not available and the document is hidden when
    // this code runs, assume it was hidden since navigation start. This isn't
    // a perfect heuristic, but it's the best we can do until the
    // `visibility-state` performance entry becomes available in all browsers.
    firstHiddenTime = firstVisibilityStateHiddenTime ?? initHiddenTime();

    // Listen for visibility changes so we can handle things like bfcache
    // restores and/or prerender without having to examine individual
    // timestamps in detail and also for onHidden function calls.
    addEventListener('visibilitychange', onVisibilityUpdate, true);
    // Include pagehide to account for pages closed in the background with queued metrics.
    // See https://github.com/GoogleChrome/web-vitals/issues/805
    addEventListener('pagehide', onVisibilityUpdate, true);
    // IMPORTANT: when a page is prerendering, its `visibilityState` is
    // 'hidden', so in order to account for cases where this module checks for
    // visibility during prerendering, an additional check after prerendering
    // completes is also required.
    addEventListener('prerenderingchange', onVisibilityUpdate, true);

    // Reset the time on bfcache restores.
    onBFCacheRestore(() => {
      // Schedule a task in order to track the `visibilityState` once it's
      // had an opportunity to change to visible in all browsers.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1133363
      setTimeout(() => {
        firstHiddenTime = initHiddenTime();
      });
    });
  }
  return {
    get firstHiddenTime() {
      return firstHiddenTime;
    },
    onHidden(cb: () => void) {
      onHiddenFunctions.add(cb);
    },
  };
};
