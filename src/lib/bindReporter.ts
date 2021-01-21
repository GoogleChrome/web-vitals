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
  const m = Array.isArray(metrics) ? metrics : [metrics];
  const prevValues: number[] = [...Array(m.length)];
  return () => {
    const shouldReport = m.map((metric: Metric, i: number) => {
        if (metric.value >= 0) {
          if (reportAllChanges ||
              finalMetrics.has(m[i]) ||
              document.visibilityState === 'hidden') {
            metric.delta = metric.value - (prevValues[i] || 0);

            // Report the metric if there's a non-zero delta, if the metric is
            // final, or if no previous value exists (which can happen in the case
            // of the document becoming hidden when the metric value is 0).
            // See: https://github.com/GoogleChrome/web-vitals/issues/14
            if (metric.delta || prevValues[i] === undefined) {
              prevValues[i] = metric.value;
              return true;
            }
          }
        }
        return false;
      }).includes(true);

    // Since metrics can be an array, we only want to report once if anything has changed.
    if (shouldReport) {
      //console.log('wasChanged!', callback, metrics);
      if (Array.isArray(metrics)) {
        callback(metrics.reduce((o, metric, i) => ({...o, [metric.name]: metrics[i]}), {} as Record<Metric['name'], Metric>));
      } else {
        callback(metrics);
      }
    }
  }
}
