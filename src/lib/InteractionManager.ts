/*
 * Copyright 2024 Google LLC
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

import {getInteractionCount} from './polyfills/interactionCountPolyfill.js';

export interface Interaction {
  id: number;
  entries: PerformanceEventTiming[];
  $latency: number;
}

// To prevent unnecessary memory usage on pages with lots of interactions,
// store at most 10 of the longest interactions to consider as INP candidates.
const MAX_INTERACTIONS_TO_CONSIDER = 10;

// Used to store the interaction count after a bfcache restore, since p98
// interaction latencies should only consider the current navigation.
let prevInteractionCount = 0;

/**
 * Returns the interaction count since the last bfcache restore (or for the
 * full page lifecycle if there were no bfcache restores).
 */
const getInteractionCountForNavigation = () => {
  return getInteractionCount() - prevInteractionCount;
};

export class InteractionManager {
  /**
   * A list of longest interactions on the page (by latency) sorted so the
   * longest one is first. The list is at most MAX_INTERACTIONS_TO_CONSIDER
   * long.
   */
  $longestInteractionList: Interaction[] = [];

  /**
   * A mapping of longest interactions by their interaction ID.
   * This is used for faster lookup.
   */
  $longestInteractionMap: Map<number, Interaction> = new Map();

  $onBeforeProcessingEntry?: (entry: PerformanceEventTiming) => void;

  $onAfterProcessingInteraction?: (interaction: Interaction) => void;

  $resetInteractions() {
    prevInteractionCount = getInteractionCount();
    this.$longestInteractionList.length = 0;
    this.$longestInteractionMap.clear();
  }

  /**
   * Returns the estimated p98 longest interaction based on the stored
   * interaction candidates and the interaction count for the current page.
   */
  $estimateP98LongestInteraction() {
    const candidateInteractionIndex = Math.min(
      this.$longestInteractionList.length - 1,
      Math.floor(getInteractionCountForNavigation() / 50),
    );

    return this.$longestInteractionList[candidateInteractionIndex];
  }

  /**
   * Takes a performance entry and adds it to the list of worst interactions
   * if its duration is long enough to make it among the worst. If the
   * entry is part of an existing interaction, it is merged and the latency
   * and entries list is updated as needed.
   */
  $processEntry(entry: PerformanceEventTiming) {
    this.$onBeforeProcessingEntry?.(entry);

    // Skip further processing for entries that cannot be INP candidates.
    if (!(entry.interactionId || entry.entryType === 'first-input')) return;

    // The least-long of the 10 longest interactions.
    const minLongestInteraction = this.$longestInteractionList.at(-1);

    let interaction = this.$longestInteractionMap.get(entry.interactionId!);

    // Only process the entry if it's possibly one of the ten longest,
    // or if it's part of an existing interaction.
    if (
      interaction ||
      this.$longestInteractionList.length < MAX_INTERACTIONS_TO_CONSIDER ||
      // If the above conditions are false, `minLongestInteraction` will be set.
      entry.duration > minLongestInteraction!.$latency
    ) {
      // If the interaction already exists, update it. Otherwise create one.
      if (interaction) {
        // If the new entry has a longer duration, replace the old entries,
        // otherwise add to the array.
        if (entry.duration > interaction.$latency) {
          interaction.entries = [entry];
          interaction.$latency = entry.duration;
        } else if (
          entry.duration === interaction.$latency &&
          entry.startTime === interaction.entries[0].startTime
        ) {
          interaction.entries.push(entry);
        }
      } else {
        interaction = {
          id: entry.interactionId!,
          entries: [entry],
          $latency: entry.duration,
        };
        this.$longestInteractionMap.set(interaction.id, interaction);
        this.$longestInteractionList.push(interaction);
      }

      // Sort the entries by latency (descending) and keep only the top ten.
      this.$longestInteractionList.sort((a, b) => b.$latency - a.$latency);
      if (this.$longestInteractionList.length > MAX_INTERACTIONS_TO_CONSIDER) {
        const removedInteractions = this.$longestInteractionList.splice(
          MAX_INTERACTIONS_TO_CONSIDER,
        );

        for (const interaction of removedInteractions) {
          this.$longestInteractionMap.delete(interaction.id);
        }
      }
    }

    this.$onAfterProcessingInteraction?.(interaction!);
  }
}
