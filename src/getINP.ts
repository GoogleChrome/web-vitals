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

import {onBFCacheRestore} from './lib/bfcache.js';
import {bindReporter} from './lib/bindReporter.js';
import {initMetric} from './lib/initMetric.js';
import {observe} from './lib/observe.js';
import {onHidden} from './lib/onHidden.js';
import {getInteractionCount, initInteractionCountPolyfill} from './lib/polyfills/interactionCountPolyfill.js';
import {Metric, PerformanceEventTiming, ReportHandler} from './types.js';

interface Interaction {
  id: number;
  latency: number;
  entries: PerformanceEventTiming[];
}

// Used to store the interaction count after a bfcache restore, since p98
// interaction latencies should only consider the current navigation.
let prevInteractionCount = 0;

// To prevent unnecessary memory usage on pages with lots of interactions,
// store at most 10 of the longest interactions to consider as INP candidates.
const MAX_INTERACTIONS_TO_CONSIDER = 10;

// A list of longest interactions on the page (by latency) sorted so the
// longest one is first. The list is as most MAX_INTERACTIONS_TO_CONSIDER long.
let longestInteractions: Interaction[] = [];

/**
 * Takes a performance entry and adds it to the list of worst interactions
 * if its duration is long enough to make it among the worst. If the
 * entry is part of an existing interaction, it is merged and the latency
 * and entries list is updated as needed.
 */
const processEntry = (entry: PerformanceEventTiming) => {
  // Only process the entry if it's possibly one of the ten longest.
  if (longestInteractions.length < MAX_INTERACTIONS_TO_CONSIDER ||
      entry.duration > longestInteractions[longestInteractions.length - 1].latency) {

    const existingInteractionIndex =
        longestInteractions.findIndex((i) => entry.interactionId == i.id);

    // If the interaction already exists, update it. Otherwise create one.
    if (existingInteractionIndex >= 0) {
      const interaction = longestInteractions[existingInteractionIndex];
      interaction.latency = Math.max(interaction.latency, entry.duration);
      interaction.entries.push(entry);
    } else {
      longestInteractions.push({
        id: entry.interactionId!,
        latency: entry.duration,
        entries: [entry],
      });
    }

    // Sort the entries by latency (descending) and keep only the top ten.
    longestInteractions.sort((a, b) => b.latency - a.latency);
    longestInteractions.splice(MAX_INTERACTIONS_TO_CONSIDER);
  }
}

/**
 * Returns the estimated p98 longest interaction based on the stored
 * interaction candidates and the interaction count for the current page.
 */
const estimateP98LongestInteraction = () => {
	const candidateInteractionIndex = Math.min(longestInteractions.length - 1,
      Math.floor((getInteractionCount() - prevInteractionCount) / 50));

	return longestInteractions[candidateInteractionIndex];
}

export const getINP = (onReport: ReportHandler, reportAllChanges?: boolean) => {
  // TODO(philipwalton): remove once the polyfill is no longer needed.
  initInteractionCountPolyfill();

  let metric = initMetric('INP');
  let report: ReturnType<typeof bindReporter>;

  const handleEntries = (entries: Metric['entries']) => {
    (entries as PerformanceEventTiming[]).forEach((entry) => {
      if (entry.interactionId) {
        processEntry(entry);
      }
    });

    const inp = estimateP98LongestInteraction();

    if (inp && inp.latency !== metric.value) {
      metric.value = inp.latency;
      metric.entries = inp.entries;
      report();
    }
  };

  const po = observe('event', handleEntries, {
    // The use of 50 here as a balance between not wanting the callback to
    // run for too many already fast events (one frame or less), but also
    // get enough fidelity below the recommended "good" threshold of 200.
    durationThreshold: 50,
  } as PerformanceObserverInit);

  report = bindReporter(onReport, metric, reportAllChanges);

  if (po) {
    onHidden(() => {
      handleEntries(po.takeRecords());

      // If the interaction count shows that there were interactions but
      // none were captured by the PerformanceObserver, report a latency of 0.
      if (metric.value < 0 &&
          getInteractionCount() - prevInteractionCount > 0) {
        metric.value = 0;
        metric.entries = [];
      }

      report(true);
    });

    onBFCacheRestore(() => {
      longestInteractions = [];
      prevInteractionCount = getInteractionCount();

      metric = initMetric('INP');
      report = bindReporter(onReport, metric, reportAllChanges);
    });
  }
};
