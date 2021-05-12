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

import {onBFCacheRestore} from './onBFCacheRestore.js';


interface TimeStamps {
  hidden?: number;
  visible?: number;
}

interface VisibilityWatcher {
  firstHiddenTime: number;
  firstVisibleTime: number;
}


let timeStamps: TimeStamps;

const initTimeStamps = () => {
  // Assume the visibilityState when this code is run was the visibilityState
  // since page load. This isn't a perfect heuristic, but it's the best we can
  // do until an API is available to support querying past visibilityState.
  timeStamps = {
    'visible': document.visibilityState === 'visible' ? 0 : Infinity,
    'hidden': document.visibilityState === 'hidden' ? 0 : Infinity,
  };
}

const onVisibilityChange = (event: Event) => {
  timeStamps[document.visibilityState] = event.timeStamp;
  if (timeStamps.hidden! + timeStamps.visible! > 0) {
    removeEventListener('visibilitychange', onVisibilityChange, true);
  }
}

const trackChanges = () => {
  addEventListener('visibilitychange', onVisibilityChange, true);
};

export const getVisibilityWatcher = () : VisibilityWatcher => {
  if (!timeStamps) {
    initTimeStamps();
    trackChanges();

    // Reset the time on bfcache restores.
    onBFCacheRestore(() => {
      // Schedule a task in order to track the `visibilityState` once it's
      // had an opportunity to change to visible in all browsers.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1133363
      setTimeout(() => {
        initTimeStamps();
        trackChanges();
      }, 0);
    });
  }
  return {
    get firstHiddenTime() {
      return timeStamps.hidden!;
    },
    get firstVisibleTime() {
      return timeStamps.visible!;
    },
  };
};
