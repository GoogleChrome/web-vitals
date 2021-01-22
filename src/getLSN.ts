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
import {ReportHandler} from './types.js';


// https://wicg.github.io/layout-instability/#sec-layout-shift
interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

class SessionWindow {
  constructor(gap: number, limit: number = Number.POSITIVE_INFINITY) {
    this.gap_ = gap;
    this.limit_ = limit;
  }

  addShift(shift: LayoutShift): { isNew: boolean; score: number  } {
    const ret = { isNew: false, score: 0 };
    if (shift.startTime - this.prevTs_ > this.gap_ || shift.startTime - this.firstTs_ > this.limit_) {
      this.firstTs_ = shift.startTime;
      this.score_ = 0;
      ret.isNew = true;
    }
    this.prevTs_ = shift.startTime;
    this.score_ += shift.value;
    ret.score = this.score_;

    return ret;
  }

  private gap_: number;
  private limit_: number;

  private firstTs_ = Number.NEGATIVE_INFINITY;
  private prevTs_ = Number.NEGATIVE_INFINITY;
  private score_ = 0.0;
}

class SlidingWindow {
  constructor(limit = Number.POSITIVE_INFINITY) {
    this.limit_ = limit;
  }

  addShift(shifts: LayoutShift[]): number {
    let score = 0;
    const end = shifts[shifts.length-1].startTime;
    for (let i = shifts.length - 1; i >= 0; i--) {
      if (end - shifts[i].startTime  > this.limit_) {
        return score;
      }
      score += shifts[i].value;
    }
    return score;
  }

  private limit_: number;
}

export const getLSN = (onReport: ReportHandler, reportAllChanges?: boolean) => {
  const session_gap5s = new SessionWindow(5000);
  const session_gap1s = new SessionWindow(1000);
  const session_gap1s_limit5s = new SessionWindow(1000, 5000);
  const sliding_limit1s = new SlidingWindow(1000);
  const sliding_limit300ms = new SlidingWindow(300);

  let session_gap5s_total = 0, session_gap5s_count = 0;
  let metric_avg_session_gap5s = initMetric('LSN-avg-session-gap5s', 0);
  let metric_max_session_gap1s = initMetric('LSN-max-session-gap1s', 0);
  let metric_max_session_gap1s_limit5s = initMetric('LSN-max-session-gap1s-limit5s', 0);
  let metric_max_sliding1s = initMetric('LSN-max-sliding1s', 0);
  let metric_max_sliding300ms = initMetric('LSN-max-sliding-300ms', 0);

  let report: ReturnType<typeof bindReporter>;

  const entryHandler = (entry: LayoutShift) => {
    // Only count layout shifts without recent user input.
    if (!entry.hadRecentInput) {
      metric_avg_session_gap5s.entries.push(entry);
      metric_max_session_gap1s.entries.push(entry);
      metric_max_session_gap1s_limit5s.entries.push(entry);
      metric_max_sliding1s.entries.push(entry);
      metric_max_sliding300ms.entries.push(entry);

      const { isNew } = session_gap5s.addShift(entry);
      session_gap5s_total += entry.value;
      if (isNew) {
        session_gap5s_count++;
      }
      metric_avg_session_gap5s.value = (session_gap5s_total) / (session_gap5s_count);

      metric_max_session_gap1s.value = Math.max(metric_max_session_gap1s.value, session_gap1s.addShift(entry).score);
      metric_max_session_gap1s_limit5s.value = Math.max(metric_max_session_gap1s_limit5s.value, session_gap1s_limit5s.addShift(entry).score);
      metric_max_sliding1s.value = Math.max(metric_max_sliding1s.value, sliding_limit1s.addShift(metric_max_sliding1s.entries as LayoutShift[]));
      metric_max_sliding300ms.value = Math.max(metric_max_sliding300ms.value, sliding_limit300ms.addShift(metric_max_sliding300ms.entries as LayoutShift[]));

      report();
    }
  };

  const po = observe('layout-shift', entryHandler as PerformanceEntryHandler);
  if (po) {
    report = bindReporter(onReport, [
        metric_avg_session_gap5s, metric_max_session_gap1s, metric_max_session_gap1s_limit5s, metric_max_sliding1s, metric_max_sliding300ms
      ], reportAllChanges);

    onHidden(() => {
      po.takeRecords().map(entryHandler as PerformanceEntryHandler);
      report();
    });

    onBFCacheRestore(() => {
      metric_avg_session_gap5s = initMetric('LSN-avg-session-gap5s', 0);
      metric_max_session_gap1s = initMetric('LSN-max-session-gap1s', 0);
      metric_max_session_gap1s_limit5s = initMetric('LSN-max-session-gap1s-limit5s', 0);
      metric_max_sliding1s = initMetric('LSN-max-sliding1s', 0);
      metric_max_sliding300ms = initMetric('LSN-max-sliding-300ms', 0);
      report = bindReporter(onReport, [
          metric_avg_session_gap5s, metric_max_session_gap1s, metric_max_session_gap1s_limit5s, metric_max_sliding1s, metric_max_sliding300ms
        ], reportAllChanges);
      });
  }
};
