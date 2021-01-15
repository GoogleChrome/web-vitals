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

import {finalMetrics} from './finalMetrics.js';
import {Metric, ReportHandler} from '../types.js';


export const bindReporter = (
  callback: ReportHandler,
  metrics: Metric | Metric[],
  reportAllChanges?: boolean,
) => {
  let prevValues: number[] = [];
  let wasChanged = false;
  const m = Array.isArray(metrics) ? metrics : [metrics];
  return () => {
    for (let i = 0; i < m.length; i++ ) {
      if (m[i].value >= 0) {
        if (reportAllChanges ||
            finalMetrics.has(m[i]) ||
            document.visibilityState === 'hidden') {
          m[i].delta = m[i].value - (prevValues[i] || 0);

          // Report the metric if there's a non-zero delta, if the metric is
          // final, or if no previous value exists (which can happen in the case
          // of the document becoming hidden when the metric value is 0).
          // See: https://github.com/GoogleChrome/web-vitals/issues/14
          if (m[i].delta || prevValues[i] === undefined) {
            wasChanged = true;
          }
        }
      }
    }

    prevValues = m.map((metric) => metric.value);
    if (wasChanged) {
      if (Array.isArray(metrics)) {
        callback(metrics.reduce((o, metric) => ({...o, [metric.name]: metrics}), {} as Record<Metric['name'], Metric>));
      } else {
        callback(metrics);
      }
    }
  }
}
