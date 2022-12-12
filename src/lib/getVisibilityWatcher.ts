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


let firstHiddenTime = -1;

const initHiddenTime = () => {
  // If the document is hidden when this code runs, assume it was always
  // hidden and the page was loaded in the background, with the one exception
  // that visibility state is always 'hidden' during prerendering, so we have
  // to ignore that case until prerendering finishes (see: `prerenderingchange`
  // event logic below).
  return document.visibilityState === 'hidden' &&
      !document.prerendering ? 0 : Infinity;
}

const onVisibilityUpdate = (event: Event) => {
  // If the document is 'hidden' and no previous hidden timestamp has been
  // set, update it based on the current event data.
  if (document.visibilityState === 'hidden' && firstHiddenTime > -1) {
    // If the event is a 'visibilitychange' event, it means the page was
    // visible prior to this change, so the event timestamp is the first
    // hidden time. However, if the event is a 'prerenderingchange' event and
    // the document is 'hidden', assume the tab was activated in a background
    // state and has always been hidden.
    firstHiddenTime = event.type === 'visibilitychange' ? event.timeStamp : 0;

    // Remove all listeners now that a `firstHiddenTime` value has been set.
    removeChangeListeners();
  }
}

const addChangeListeners = () => {
  addEventListener('visibilitychange', onVisibilityUpdate, true);
  // IMPORTANT: when a page is prerendering, its `visibilityState` is
  // 'hidden', so in order to account for cases where this module checks for
  // visibility during prerendering, an additional check after prerendering
  // completes is also required.
  addEventListener('prerenderingchange', onVisibilityUpdate, true);
};

const removeChangeListeners = () => {
  removeEventListener('visibilitychange', onVisibilityUpdate, true);
  removeEventListener('prerenderingchange', onVisibilityUpdate, true);
};


export const getVisibilityWatcher = () => {
  if (firstHiddenTime < 0) {
    // If the document is hidden when this code runs, assume it was hidden
    // since navigation start. This isn't a perfect heuristic, but it's the
    // best we can do until an API is available to support querying past
    // visibilityState.
    if (window.__WEB_VITALS_POLYFILL__) {
      firstHiddenTime = window.webVitals.firstHiddenTime;
      if (firstHiddenTime === Infinity) {
        addChangeListeners();
      }
    } else {
      firstHiddenTime = initHiddenTime();
      addChangeListeners();
    }

    // Reset the time on bfcache restores.
    onBFCacheRestore(() => {
      // Schedule a task in order to track the `visibilityState` once it's
      // had an opportunity to change to visible in all browsers.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1133363
      setTimeout(() => {
        firstHiddenTime = initHiddenTime();
        addChangeListeners();
      }, 0);
    });
  }
  return {
    get firstHiddenTime() {
      return firstHiddenTime;
    }
  }
};
