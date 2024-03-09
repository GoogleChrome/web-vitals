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

import type {LoadState, Metric} from './base.js';

/**
 * An INP-specific version of the Metric object.
 */
export interface INPMetric extends Metric {
  name: 'INP';
  entries: PerformanceEventTiming[];
}

/**
 * An object containing potentially-helpful debugging information that
 * can be sent along with the INP value for the current page visit in order
 * to help identify issues happening to real-users in the field.
 */
export interface INPAttribution {
  /**
   * A selector identifying the element that the user first interacted with
   * as part of the frame where the INP candidate interaction occurred.
   * If `interactionTarget` is an empty string, that generally means the
   * element was removed from the DOM as part of the interaction.
   */
  interactionTarget: string;
  /**
   * The time when the user first interacted during the frame where the INP
   * candidate interaction occurred (if more than one interaction occurred
   * within the frame, only the first time is reported).
   */
  interactionTime: number;
  /**
   * The type of interaction. This will be either 'pointer' or 'keyboard'
   * since those are the only types of interactions considered for INP.
   */
  interactionType: 'pointer' | 'keyboard';

  /**
   * If the browser supports the Long Animation Frame API and a
   * `long-animation-frame` entry is detected that corresponds to the INP
   * frame, it will be reported here.
   */
  longAnimationFrameEntry?: PerformanceLongAnimationFrameTiming;

  /**
   * The time from when the user interacted with the page until when the
   * browser was first able to start processing event listeners for that
   * interaction. This time captures the delay in processing an interaction
   * due to the main thread being busy with other work.
   */
  inputDelay: number;

  /**
   * The time from when the first event listener started running in response to
   * a user interaction until when all processing code has finished running,
   * and the browser is able to start rendering the next frame. If the user
   * interacts again before processing has finished (which is common if event
   * processing takes a long time), then any event processing time from
   * subsequent interactions could get included in this processing time value
   * since that delays the next paint for this interaction. If multiple
   * interactions occur within the same frame, only the first interaction is
   * considered for INP since it will be the longest.
   *
   * Note: if a `long-animation-frame` entry was detected for this frame
   * its `renderStart` property will be used to mark the `processingTime`
   * end, otherwise the `processingEnd` time of the last `event` entry in the
   * frame before the next paint will be used. Usually, these times are the
   * same. However, the `long-animation-frame` time provides a more accurate
   * measurement in rare cases where an event entry is missed or a
   * `setTimeout()` or other task is prioritized before rendering starts.
   */
  processingTime: number;

  /**
   * The time from when the browser finished processing all event listeners
   * and started rendering the next frame until when that frame is actually
   * presented on the screen and visible to the user. This time includes
   * work on the main thread (such as `requestAnimationFrame()` callbacks,
   * `ResizeObserver` and `IntersectionObserver` callbacks, and style/layout
   * calculation) as well as off-main-thread work (such as compositor, GPU, and
   * raster work).
   *
   * Note: if a `long-animation-frame` entry was detected for this frame
   * its `renderStart` property will be used to mark the `presentationDelay`
   * start, otherwise the `processingEnd` time of the last `event` entry in the
   * frame before the next paint will be used. Usually, these times are the
   * same. However, the `long-animation-frame` time provides a more accurate
   * measurement in rare cases where an event entry is missed or a
   * `setTimeout()` or other task is prioritized before rendering starts.
   */
  presentationDelay: number;

  /**
   * The loading state of the document at the time when the interaction
   * corresponding to INP occurred (see `LoadState` for details). If the
   * interaction occurred while the document was loading and executing script
   * (e.g. usually in the `dom-interactive` phase) it can result in long delays.
   */
  loadState: LoadState;
}

/**
 * An INP-specific version of the Metric object with attribution.
 */
export interface INPMetricWithAttribution extends INPMetric {
  attribution: INPAttribution;
}

/**
 * An INP-specific version of the ReportCallback function.
 */
export interface INPReportCallback {
  (metric: INPMetric): void;
}

/**
 * An INP-specific version of the ReportCallback function with attribution.
 */
export interface INPReportCallbackWithAttribution {
  (metric: INPMetricWithAttribution): void;
}
