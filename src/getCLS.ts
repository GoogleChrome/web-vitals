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

import {bindResolver} from './lib/bindResolver.js';
import {observe, PerformanceEntryHandler} from './lib/observe.js';
import {promisifyObserver} from './lib/promisifyObserver.js';
import {whenHidden} from './lib/whenHidden.js';

import {Metric} from './types.js';



// https://wicg.github.io/layout-instability/#sec-layout-shift
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

type getCLS = (onChange?: Metric) => Promise<Metric>;


export const getCLS = promisifyObserver((metric, resolve, onChange) => {
  metric.value = 0;
  const entryHandler = (entry: LayoutShift) => {
    // Only count layout shifts without recent user input.
    if (!entry.hadRecentInput) {
      (metric.value as number) += entry.value;
      metric.entries.push(entry);
      if (onChange) {
        onChange(metric);
      }
    }
  };
  const po = observe('layout-shift', entryHandler as PerformanceEntryHandler);
  const resolver = bindResolver(
      resolve, metric, po, entryHandler as PerformanceEntryHandler, onChange);

  whenHidden.then(resolver);
});
