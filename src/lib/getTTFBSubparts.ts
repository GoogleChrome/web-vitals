/*
 * Copyright 2022 Google LLC
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

import type {TTFBAttribution} from '../types.js';

export const getTTFBSubparts = (
  navigationEntry:
    PerformanceNavigationTiming | PerformanceSoftNavigation | undefined,
  value: number,
): Omit<TTFBAttribution, 'navigationEntry'> => {
  if (
    navigationEntry &&
    navigationEntry instanceof PerformanceNavigationTiming
  ) {
    const activationStart = navigationEntry.activationStart || 0;

    // Include service worker startup time in cacheDuration.
    const waitEnd = Math.max(
      (navigationEntry.workerStart || navigationEntry.fetchStart || 0) -
        activationStart,
      0,
    );
    const dnsStart = Math.max(
      navigationEntry.domainLookupStart - activationStart,
      0,
    );
    const connectStart = Math.max(
      navigationEntry.connectStart - activationStart,
      0,
    );
    const connectEnd = Math.max(
      navigationEntry.connectEnd - activationStart,
      0,
    );

    return {
      waitingDuration: waitEnd,
      cacheDuration: dnsStart - waitEnd,
      // Include any gap between DNS lookup and connection start.
      dnsDuration: connectStart - dnsStart,
      connectionDuration: connectEnd - connectStart,
      // Include the gap before requestStart so connectionDuration stays zero
      // for service worker controlled requests.
      requestDuration: value - connectEnd,
    };
  }

  return {
    waitingDuration: 0,
    cacheDuration: 0,
    dnsDuration: 0,
    connectionDuration: 0,
    requestDuration: 0,
  };
};
