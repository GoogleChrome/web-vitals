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

import {promisifyObserver} from './lib/promisifyObserver.js';
import {bindResolver} from './lib/bindResolver.js';
import {observe} from './lib/observe.js';
import {whenHidden} from './lib/whenHidden.js';
import {whenInput} from './lib/whenInput.js';


export const getLCP = promisifyObserver((metric, resolve) => {
  const entryHandler = (entry: PerformanceEntry) => {
    metric.value = entry.startTime;
    metric.entries.push(entry);
  };
  const po = observe('largest-contentful-paint', entryHandler);
  const resolver = bindResolver(resolve, metric, po, entryHandler);
  whenHidden.then(resolver);
  whenInput.then(resolver);
});
