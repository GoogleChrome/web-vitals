/*
 * Copyright 2026 Google LLC
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

// Performance entry types used by the library, exported as named types so
// they can be imported without the global augmentations in `src/types.ts`.

// https://wicg.github.io/event-timing/#sec-performance-event-timing
export interface PerformanceEventTiming
  extends globalThis.PerformanceEventTiming {
  readonly interactionId: number;
  readonly targetSelector: string;
}

// https://wicg.github.io/layout-instability/#sec-layout-shift-attribution
export interface LayoutShiftAttribution {
  node: Node | null;
  previousRect: DOMRectReadOnly;
  currentRect: DOMRectReadOnly;
}

// https://wicg.github.io/layout-instability/#sec-layout-shift
export interface LayoutShift extends PerformanceEntry {
  value: number;
  sources: LayoutShiftAttribution[];
  hadRecentInput: boolean;
}

// https://w3c.github.io/largest-contentful-paint/#sec-largest-contentful-paint-interface
export interface LargestContentfulPaint extends PerformanceEntry {
  readonly renderTime: DOMHighResTimeStamp;
  readonly loadTime: DOMHighResTimeStamp;
  readonly size: number;
  readonly id: string;
  readonly url: string;
  readonly element: Element | null;
  // https://w3c.github.io/paint-timing/#painttimingmixin
  readonly paintTime: DOMHighResTimeStamp;
  readonly presentationTime: DOMHighResTimeStamp | null;
}

// https://github.com/WICG/soft-navigations
export interface InteractionContentfulPaint extends PerformanceEntry {
  readonly interactionId: number;
  readonly largestContentfulPaint?: LargestContentfulPaint;
}

// https://html.spec.whatwg.org/multipage/nav-history-apis.html#navigationtype
// Inlined because `NavigationType` is only in TypeScript's DOM lib from 5.8.
export type SoftNavigationType = 'push' | 'reload' | 'replace' | 'traverse';

// https://github.com/WICG/soft-navigations
export interface PerformanceSoftNavigation extends PerformanceEntry {
  readonly interactionId: number;
  readonly navigationType?: SoftNavigationType;
  readonly paintTime?: number;
  readonly presentationTime?: number;
  readonly getLargestInteractionContentfulPaint?: () => InteractionContentfulPaint | null;
}

// https://w3c.github.io/long-animation-frame/#sec-PerformanceLongAnimationFrameTiming
export type ScriptInvokerType =
  | 'classic-script'
  | 'module-script'
  | 'event-listener'
  | 'user-callback'
  | 'resolve-promise'
  | 'reject-promise';

// https://w3c.github.io/long-animation-frame/#sec-PerformanceLongAnimationFrameTiming
export type ScriptWindowAttribution =
  'self' | 'descendant' | 'ancestor' | 'same-page' | 'other';

// https://w3c.github.io/long-animation-frame/#sec-PerformanceLongAnimationFrameTiming
export interface PerformanceScriptTiming extends PerformanceEntry {
  /* Overloading PerformanceEntry */
  readonly startTime: DOMHighResTimeStamp;
  readonly duration: DOMHighResTimeStamp;
  readonly name: string;
  readonly entryType: string;

  readonly invokerType: ScriptInvokerType;
  readonly invoker: string;
  readonly executionStart: DOMHighResTimeStamp;
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
  readonly sourceCharPosition: number;
  readonly pauseDuration: DOMHighResTimeStamp;
  readonly forcedStyleAndLayoutDuration: DOMHighResTimeStamp;
  readonly window?: Window;
  readonly windowAttribution: ScriptWindowAttribution;
}

// https://w3c.github.io/long-animation-frame/#sec-PerformanceLongAnimationFrameTiming
export interface PerformanceLongAnimationFrameTiming extends PerformanceEntry {
  readonly startTime: DOMHighResTimeStamp;
  readonly duration: DOMHighResTimeStamp;
  readonly name: string;
  readonly entryType: string;
  readonly renderStart: DOMHighResTimeStamp;
  readonly styleAndLayoutStart: DOMHighResTimeStamp;
  readonly blockingDuration: DOMHighResTimeStamp;
  readonly firstUIEventTimestamp: DOMHighResTimeStamp;
  readonly scripts: PerformanceScriptTiming[];
}
