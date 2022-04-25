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

import {bindReporter} from './lib/bindReporter.js';
import {initMetric} from './lib/initMetric.js';
import {onBFCacheRestore} from './lib/bfcache.js';
import {getNavigationEntry} from './lib/getNavigationEntry.js';
import {ReportHandler} from './types.js';


const afterLoad = (callback: () => void) => {
  if (document.readyState === 'complete') {
    // Queue a task so the callback runs after `loadEventEnd`.
    setTimeout(callback, 0);
  } else {
    // Queue a task so the callback runs after `loadEventEnd`.
    addEventListener('load', () => setTimeout(callback, 0));
  }
}

export const onTTFB = (onReport: ReportHandler, reportAllChanges?: boolean) => {
  let metric = initMetric('TTFB');
  let report = bindReporter(onReport, metric, reportAllChanges);

  afterLoad(() => {
    const navigationEntry = getNavigationEntry();

    if (navigationEntry) {
      metric.value = navigationEntry.responseStart;

      // In some cases the value reported is negative or is larger
      // than the current page time. Ignore these cases:
      // https://github.com/GoogleChrome/web-vitals/issues/137
      // https://github.com/GoogleChrome/web-vitals/issues/162
      if (metric.value < 0 || metric.value > performance.now()) return;

      metric.entries = [navigationEntry];

      report(true);
    }
  });

  onBFCacheRestore((event) => {
    metric = initMetric('TTFB');
    report = bindReporter(onReport, metric, reportAllChanges);
    metric.value = performance.now() - event.timeStamp;
    report(true);
  });
};
