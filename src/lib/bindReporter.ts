/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Metric} from '../types.js';


export const bindReporter = (
  callback: Function,
  metric: Metric,
  po: PerformanceObserver | undefined,
  observeAllUpdates?: boolean,
) => {
  let prevValue: number;
  return () => {
    if (po && metric.isFinal) {
      po.disconnect();
    }
    if (metric.value >= 0) {
      if (observeAllUpdates ||
          metric.isFinal ||
          document.visibilityState === 'hidden') {
        metric.delta = metric.value - (prevValue || 0);

        if (metric.delta || metric.isFinal) {
          callback(metric);
          prevValue = metric.value;
        }
      }
    }
  }
}
