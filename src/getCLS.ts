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

import {initMetric} from './lib/initMetric.js';
import {observe, PerformanceEntryHandler} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {onBFCacheRestore} from './lib/onBFCacheRestore.js';
import {bindReporter} from './lib/bindReporter.js';
import {getFCP} from './getFCP.js';
import {ReportHandler} from './types.js';


// https://wicg.github.io/layout-instability/#sec-layout-shift
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}


let isMonitoringFCP = false;
let fcpValue = -1;

export const getCLS = (onReport: ReportHandler, reportAllChanges?: boolean, win = window) => {
  // Start monitoring FCP so we can only report CLS if FCP is also reported.
  // Note: this is done to match the current behavior of CrUX.
  if (!isMonitoringFCP) {
    getFCP((metric) => {
      fcpValue = metric.value;
    }, false, win);
    isMonitoringFCP = true;
  }

  const onReportWrapped: ReportHandler = (arg) => {
    if (fcpValue > -1) {
      onReport(arg);
    }
  };

  let metric = initMetric('CLS', 0);
  let report: ReturnType<typeof bindReporter>;

  let sessionValue = 0;
  let sessionEntries: PerformanceEntry[] = [];

  const entryHandler = (entry: LayoutShift) => {
    // Only count layout shifts without recent user input.
    if (!entry.hadRecentInput) {
      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // If the entry occurred less than 1 second after the previous entry and
      // less than 5 seconds after the first entry in the session, include the
      // entry in the current session. Otherwise, start a new session.
      if (sessionValue &&
          entry.startTime - lastSessionEntry.startTime < 1000 &&
          entry.startTime - firstSessionEntry.startTime < 5000) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        sessionValue = entry.value;
        sessionEntries = [entry];
      }

      // If the current session value is larger than the current CLS value,
      // update CLS and the entries contributing to it.
      if (sessionValue > metric.value) {
        metric.value = sessionValue;
        metric.entries = sessionEntries;
        report();
      }
    }
  };

  const po = observe('layout-shift', entryHandler as PerformanceEntryHandler, win);
  if (po) {
    report = bindReporter(onReportWrapped, metric, reportAllChanges);

    onHidden(() => {
      po.takeRecords().map(entryHandler as PerformanceEntryHandler);
      report(true);
    }, false, win);

    onBFCacheRestore(() => {
      sessionValue = 0;
      fcpValue = -1;
      metric = initMetric('CLS', 0);
      report = bindReporter(onReportWrapped, metric, reportAllChanges);
    }, win);
  }
};
