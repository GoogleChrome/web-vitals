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

import {bindReporter} from './lib/bindReporter.js';
import {initMetric} from './lib/initMetric.js';
import {observe, PerformanceEntryHandler} from './lib/observe.js';
import {onBFCacheRestore} from './lib/onBFCacheRestore.js';
import {onHidden} from './lib/onHidden.js';
import {PerformanceEventTiming, ReportHandler} from './types.js';

/*
 * In order to compute a High Percentile (p98-p100) Interaction for INP,
 * we need to store a list of the worst interactions measured.
 * 
 * EVERY_N is the number of interactions before moving to the next-highest (i.e. p98)
 * NUM_ENTRIES_TO_STORE is the max size of the list of entries
 * 
 * EVERY_N * NUM_ENTRIES_TO_STORE becomes, effectively, the max number of interactions
 * per page load for which getINP() works well.  Adjust as needed.
 */
const EVERY_N = 50;
const NUM_ENTRIES_TO_STORE = 10;
const largestINPEntries: PerformanceEventTiming[] = [];
let minKnownInteractionId = Number.POSITIVE_INFINITY;
let maxKnownInteractionId = 0;

function updateInteractionIds(interactionId: number): void {
	minKnownInteractionId = Math.min(minKnownInteractionId, interactionId);
	maxKnownInteractionId = Math.max(maxKnownInteractionId, interactionId);
}

function estimateInteractionCount(): number {
  return (maxKnownInteractionId > 0) ? ((maxKnownInteractionId - minKnownInteractionId) / 7) + 1 : 0;
}

function addInteractionEntryToINPList(entry: PerformanceEventTiming): void {
	// Optional: Skip this entry early if we know it won't be needed.
	if (largestINPEntries.length >= NUM_ENTRIES_TO_STORE && entry.duration < largestINPEntries[largestINPEntries.length-1].duration) {
    return;
	}

  // If we already have an interaction with this same ID, merge with it.
  const existing = largestINPEntries.findIndex((other) => entry.interactionId == other.interactionId);
  if (existing >= 0) {
    // Only replace if this one is actually longer
    if (entry.duration > largestINPEntries[existing].duration) {
      largestINPEntries[existing] = entry;
    }
  } else {
    largestINPEntries.push(entry);
  }

  largestINPEntries.sort((a,b) => b.duration - a.duration);
  largestINPEntries.splice(NUM_ENTRIES_TO_STORE);
}

function getCurrentINPEntry(): PerformanceEventTiming {
	const interactionCount = estimateInteractionCount();
	const which = Math.min(largestINPEntries.length-1, Math.floor(interactionCount / EVERY_N));
	return largestINPEntries[which];
}

export const getINP = (onReport: ReportHandler, reportAllChanges?: boolean) => {
  let metric = initMetric('INP');
  let report: ReturnType<typeof bindReporter>;

  const entryHandler = (entry: PerformanceEventTiming) => {
    // TODO: Perhaps ignore values before FCP
    if (!entry.interactionId) return;
    
    updateInteractionIds(entry.interactionId);
    addInteractionEntryToINPList(entry);

    const inpEntry = getCurrentINPEntry();

    // Only report when the IMP value changes.  However:
    // * When we cross a %-ile boundary, pushing `which` up, or
    // * A new long value is added to the top, moving the current INP entry down
    // ...then the inpEntry will change, but `duration` value of the new entry may still be the same.
    // While technically the INP metric.value doesn't change, we still report since metric.entries changes.
    //
    // Potentially, we may even want to compare the whole metric.entries range for equality, because:
    // * We can have cases where a middle value updates due to new-longest value with same interactionId.
    // * When we are already at MAX_ENTRIES and `which` stops changing, but the current smallest can get popped off.
    const which = largestINPEntries.indexOf(inpEntry);
    if (which >= metric.entries.length || metric.value != inpEntry.duration) {
      metric.value = inpEntry.duration;
      // We attach all the longest responsiveness entries, not just the HighP value.
      // While technically the INP score is exactly the entry.duration of one specific HighP-ile entry...
      // the entry would not have been picked (and IMP would be lower) if *any* of the worst entries were not so high.
      // Improving any of them will improve score.
      metric.entries.length = 0;
      metric.entries.push(...largestINPEntries.slice(0, which + 1));
    }

    // Perhaps Event Timing is the first API that can have multiple entries in a single PO callback
    // That means that we would ideally report() only after the whole list of entries is processed, not one per entry.
    // If we were lucky, the entries would be in timestamp order so the first is the longest... but I've found they
    // are ordered in other ways... by type, I think?
    // Alternatively: sort entries in the observe() wrapper.
    report();
  };

  const po = observe('event', entryHandler as PerformanceEntryHandler);
  report = bindReporter(onReport, metric, reportAllChanges);

  if (po) {
    onHidden(() => {
      po.takeRecords().map(entryHandler as PerformanceEntryHandler);
      report(true);
    }, true);
    
    // TODO: Test this
    onBFCacheRestore(() => {
      largestINPEntries.length = 0;
      metric = initMetric('INP');
      report = bindReporter(onReport, metric, reportAllChanges);
    });
  }
};
