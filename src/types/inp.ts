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

import type {
  LoadState,
  Metric,
  ReportOpts,
  AttributionReportOpts,
} from './base.js';

export interface INPReportOpts extends ReportOpts {
  durationThreshold?: number;
}

export interface INPAttributionReportOpts extends AttributionReportOpts {
  durationThreshold?: number;
}

/**
 * An INP-specific version of the Metric object.
 */
export interface INPMetric extends Metric {
  name: 'INP';
  entries: PerformanceEventTiming[];
}

export type INPSubpart =
  | 'inputDelay'
  | 'processingDuration'
  | 'presentationDelay';

/**
 * Summary information about the slowest script intersecting the INP duration
 * as provided by the Long Animation Frame API.
 *
 * NOTE: Only scripts above 5 milliseconds are included in long animation
 * frames.
 */
export interface SlowestScriptSummary {
  /**
   * The slowest Long Animation Frame script that intersects the INP
   * interaction.
   */
  entry: PerformanceScriptTiming;
  /**
   * The INP sub-part where the longest script ran.
   */
  subpart: INPSubpart; //'inputDelay' | 'processingDuration' | 'presentationDelay';
  /**
   * The amount of time the slowest script intersected the INP duration.
   */
  intersectingDuration: number;
  /**
   * The total duration time of the slowest script (compile and execution,
   * including forced style and layout). Note this may be longer than the
   * intersectingScriptDuration if the INP interaction happened mid-script.
   */
  totalDuration: number;
  /**
   * The compile duration of the slowest script. Note this may be longer
   * than the intersectingScriptDuration if the INP interaction happened
   * mid-script.
   */
  compileDuration: number;
  /**
   * The execution duration of the slowest script. Note this may be longer
   * than the intersectingScriptDuration if the INP interaction happened
   * mid-script.
   */
  executionDuration: number;
  /**
  /**
   * The forced style and layoult duration of the slowest script. Note this
   * may be longer than the intersectingScriptDuration if the INP interaction
   * happened mid-script.
   */
  forcedStyleAndLayoutDuration: number;
  /**
   * The pause duration of the slowest script. Note this may be longer
   * than the intersectingScriptDuration if the INP interaction happened
   * mid-script.
   */
  pauseDuration: number;
  /**
   * The invokerType of the slowest script.
   */
  invokerType: ScriptInvokerType;
  /**
   * The invoker of the slowest script.
   */
  invoker?: string;
  /**
   * The sourceURL of the slowest script.
   */
  sourceURL?: string;
  /**
   * The sourceFunctionName of the slowest script.
   */
  sourceFunctionName?: string;
  /**
   * The sourceCharPosition of the slowest script.
   */
  sourceCharPosition?: number;
}

/**
 * An object containing potentially-helpful debugging information summarized
 * from the LongAnimationFrames intersecting the INP interaction.
 *
 * NOTE: Long Animation Frames below 50 milliseconds are not reported, and
 * so their scripts cannot be included. For Long Animation Frames that are
 * reported, only scripts above 5 milliseconds are included.
 */
export interface LongAnimationFrameSummary {
  /**
   * The number of Long Animation Frame scripts that intersect the INP
   * interaction.
   * NOTE: This may be be less than the total count of scripts in the Long
   * Animation Frames as some scripts may occur before the interaction.
   */
  numIntersectingScripts: number;
  /**
   * The number of Long Animation Frames intersecting the INP interaction.
   */
  numLongAnimationFrames: number;
  /**
   * The slowest Long Animation Frame script that intersects the INP
   * interaction.
   */
  slowestScript: SlowestScriptSummary;
  /**
   * The total intersecting durations in each sub-part by invoker for
   * scripts that intersect the INP interaction.
   * For example:
   * {
   *    'inputDelay': { 'event-listener': 185, 'user-callback': 28},
   *    'processingDuration': { 'event-listener': 144},
   * }
   */
  totalDurationsPerSubpart: Partial<
    Record<INPSubpart, Partial<Record<ScriptInvokerType, number>>>
  >;
  /**
   * The total forced style and layout durations as provided by Long Animation
   * Frame scripts intersecting the INP interaction.
   */
  totalForcedStyleAndLayoutDuration: number;
  /**
   * The total non-force (i.e. end-of-frame) style and layout duration from any
   * Long Animation Frames intersecting INP interaction.
   */
  totalNonForcedStyleAndLayoutDuration: number;
  /**
   * The total duration of Long Animation Frame scripts that intersect the INP
   * duration. Note, this includes forced style and layout within those
   * scriptsn and is limited to scripts > 5 milliseconds.
   */
  totalIntersectingScriptsDuration: number;
}

/**
 * An object containing potentially-helpful debugging information that
 * can be sent along with the INP value for the current page visit in order
 * to help identify issues happening to real-users in the field.
 */
export interface INPAttribution {
  /**
   * By default, a selector identifying the element that the user first
   * interacted with as part of the frame where the INP candidate interaction
   * occurred. If this value is an empty string, that generally means the
   * element was removed from the DOM after the interaction. If the
   * `generateTarget` configuration option was passed, then this will instead
   * be the return value of that function.
   */
  interactionTarget: string;
  /**
   * The time when the user first interacted during the frame where the INP
   * candidate interaction occurred (if more than one interaction occurred
   * within the frame, only the first time is reported).
   */
  interactionTime: DOMHighResTimeStamp;
  /**
   * The best-guess timestamp of the next paint after the interaction.
   * In general, this timestamp is the same as the `startTime + duration` of
   * the event timing entry. However, since duration values are rounded to the
   * nearest 8ms (and can be rounded down), this value is clamped to always be
   * reported after the processing times.
   */
  nextPaintTime: DOMHighResTimeStamp;
  /**
   * The type of interaction, based on the event type of the `event` entry
   * that corresponds to the interaction (i.e. the first `event` entry
   * containing an `interactionId` dispatched in a given animation frame).
   * For "pointerdown", "pointerup", or "click" events this will be "pointer",
   * and for "keydown" or "keyup" events this will be "keyboard".
   */
  interactionType: 'pointer' | 'keyboard';
  /**
   * An array of Event Timing entries that were processed within the same
   * animation frame as the INP candidate interaction.
   */
  processedEventEntries: PerformanceEventTiming[];
  /**
   * If the browser supports the Long Animation Frame API, this array will
   * include any `long-animation-frame` entries that intersect with the INP
   * candidate interaction's `startTime` and the `processingEnd` time of the
   * last event processed within that animation frame. If the browser does not
   * support the Long Animation Frame API or no `long-animation-frame` entries
   * are detect, this array will be empty.
   */
  longAnimationFrameEntries: PerformanceLongAnimationFrameTiming[];
  /**
   * If the browser supports the Long Animation Frame API, this object
   * summarises information relevant to INP across the long animation frames
   * intersecting the INP interaction. See the LongAnimationFrameSummary
   * definition for an explanation of what is included.
   */
  longAnimationFrameSummary?: LongAnimationFrameSummary;
  /**
   * The time from when the user interacted with the page until when the
   * browser was first able to start processing event listeners for that
   * interaction. This time captures the delay before event processing can
   * begin due to the main thread being busy with other work.
   */
  inputDelay: number;
  /**
   * The time from when the first event listener started running in response to
   * the user interaction until when all event listener processing has finished.
   */
  processingDuration: number;
  /**
   * The time from when the browser finished processing all event listeners for
   * the user interaction until the next frame is presented on the screen and
   * visible to the user. This time includes work on the main thread (such as
   * `requestAnimationFrame()` callbacks, `ResizeObserver` and
   * `IntersectionObserver` callbacks, and style/layout calculation) as well
   * as off-main-thread work (such as compositor, GPU, and raster work).
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
