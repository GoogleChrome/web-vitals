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

import assert from 'assert';
import {beaconCountIs, clearBeacons, getBeacons} from '../utils/beacons.js';
import {browserSupportsEntry} from '../utils/browserSupportsEntry.js';
import {firstContentfulPaint} from '../utils/firstContentfulPaint.js';
import {navigateTo} from '../utils/navigateTo.js';
import {nextFrame} from '../utils/nextFrame.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';
import {webVitalsLoaded} from '../utils/webVitalsLoaded.js';

const ROUNDING_ERROR = 8;

describe('onINP()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsINP;
  let browserSupportsLoAF;
  before(async function () {
    browserSupportsINP = await browserSupportsEntry('event');
    browserSupportsLoAF = await browserSupportsEntry('long-animation-frame');
  });

  beforeEach(async function () {
    await navigateTo('about:blank');
    await clearBeacons();
  });

  it('reports the correct value on visibility hidden after interactions (reportAllChanges === false)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=100', {readyState: 'interactive'});

    // Wait until the library is loaded
    await webVitalsLoaded();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value on visibility hidden after interactions (reportAllChanges === true)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=100&reportAllChanges=1', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value when script is loaded late (reportAllChanges === false)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=150&loadAfterInput=1');

    // Wait until the first contentful paint to make sure the
    // heading is there.
    await firstContentfulPaint();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value when loaded late (reportAllChanges === true)', async function () {
    if (!browserSupportsINP) this.skip();

    // Don't await the `interactive` ready state because DCL is delayed until
    // after user input.
    await navigateTo('/test/inp?click=150&reportAllChanges=1&loadAfterInput=1');

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value on page unload after interactions (reportAllChanges === false)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=100', {readyState: 'interactive'});

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    await navigateTo('about:blank', {readyState: 'interactive'});

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value on page unload after interactions (reportAllChanges === true)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=100&reportAllChanges=1', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    await navigateTo('about:blank');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports approx p98 interaction when 50+ interactions (reportAllChanges === false)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=60&pointerdown=600', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    await setBlockingTime('pointerdown', 400);
    await simulateUserLikeClick(h1);

    await setBlockingTime('pointerdown', 100);
    await simulateUserLikeClick(h1);

    await setBlockingTime('pointerdown', 0);

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp1] = await getBeacons();
    assert(inp1.value >= 600); // Initial pointerdown blocking time.
    assert(allEntriesPresentTogether(inp1.entries));
    assert.strictEqual(inp1.rating, 'poor');

    await clearBeacons();
    await stubVisibilityChange('visible');

    let count = 3;
    while (count < 50) {
      await h1.click(); // Use .click() because it's faster.
      count++;
    }

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp2] = await getBeacons();
    assert(inp2.value >= 400); // 2nd-highest pointerdown blocking time.
    assert(inp2.value < inp1.value); // Should have gone down.
    assert(allEntriesPresentTogether(inp2.entries));
    assert.strictEqual(inp2.rating, 'needs-improvement');

    await clearBeacons();
    await stubVisibilityChange('visible');

    while (count < 100) {
      await h1.click(); // Use .click() because it's faster.
      count++;
    }

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp3] = await getBeacons();
    assert(inp3.value >= 100); // 2nd-highest pointerdown blocking time.
    assert(inp3.value < inp2.value); // Should have gone down.
    assert(allEntriesPresentTogether(inp3.entries));
    assert.strictEqual(inp3.rating, 'good');
  });

  it('reports approx p98 interaction when 50+ interactions (reportAllChanges === true)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=60&pointerdown=600&reportAllChanges=1', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    await setBlockingTime('pointerdown', 400);
    await simulateUserLikeClick(h1);

    await setBlockingTime('pointerdown', 100);
    await simulateUserLikeClick(h1);

    await setBlockingTime('pointerdown', 0);

    let count = 3;
    while (count < 100) {
      await h1.click(); // Use .click() because it's faster.
      count++;
    }

    await beaconCountIs(3);

    const [inp1, inp2, inp3] = await getBeacons();
    assert(inp1.value >= 600); // Initial pointerdown blocking time.
    assert(inp2.value >= 400); // Initial pointerdown blocking time.
    assert(inp2.value < inp1.value); // Should have gone down.
    assert(inp3.value >= 100); // 2nd-highest pointerdown blocking time.
    assert(inp3.value < inp2.value); // Should have gone down.
    assert(allEntriesPresentTogether(inp1.entries));
    assert(allEntriesPresentTogether(inp2.entries));
    assert(allEntriesPresentTogether(inp3.entries));
    assert.strictEqual(inp1.rating, 'poor');
    assert.strictEqual(inp2.rating, 'needs-improvement');
    assert.strictEqual(inp3.rating, 'good');
  });

  it('reports a new interaction after bfcache restore', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=150');

    // Wait until the library is loaded and the first paint occurs
    await webVitalsLoaded();
    await firstContentfulPaint();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    await stubForwardBack();

    const logs = await browser.execute(() => window._logMessages || []);
    console.log('Browser logs:');
    logs.forEach((log) => {
      console.log(`[${log.level}] ${log.message}`);
    });

    await beaconCountIs(1);

    const [inp1] = await getBeacons();
    assert(inp1.value >= 0);
    assert(inp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp1.name, 'INP');
    assert.strictEqual(inp1.value, inp1.delta);
    assert.strictEqual(inp1.rating, 'good');
    assert(containsEntry(inp1.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp1.entries));
    assert.match(inp1.navigationType, /navigate|reload/);

    await clearBeacons();

    await setBlockingTime('click', 0);
    await setBlockingTime('keydown', 50);

    const textarea = await $('#textarea');
    await textarea.click();

    await browser.keys(['a', 'b', 'c']);

    // Ensure the interaction completes.
    await nextFrame();

    await stubForwardBack();
    await beaconCountIs(1);

    const [inp2] = await getBeacons();

    assert(inp2.value >= 0);
    assert(inp2.id.match(/^v5-\d+-\d+$/));
    assert(inp1.id !== inp2.id);
    assert.strictEqual(inp2.name, 'INP');
    assert.strictEqual(inp2.value, inp2.delta);
    assert.strictEqual(inp2.rating, 'good');
    assert(
      containsEntry(inp2.entries, 'keydown', '[object HTMLTextAreaElement]'),
    );
    assert(allEntriesPresentTogether(inp1.entries));
    assert(inp2.entries[0].startTime > inp1.entries[0].startTime);
    assert.strictEqual(inp2.navigationType, 'back-forward-cache');

    await stubForwardBack();

    await setBlockingTime('keydown', 0);
    await setBlockingTime('pointerdown', 300);

    const button = await $('button');
    await button.click();

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp3] = await getBeacons();
    assert(inp3.value >= 0);
    assert(inp3.id.match(/^v5-\d+-\d+$/));
    assert(inp1.id !== inp3.id);
    assert.strictEqual(inp3.name, 'INP');
    assert.strictEqual(inp3.value, inp3.delta);
    assert.strictEqual(inp3.rating, 'needs-improvement');
    assert(
      containsEntry(inp3.entries, 'pointerdown', '[object HTMLButtonElement]'),
    );
    assert(allEntriesPresentTogether(inp3.entries));
    assert(inp3.entries[0].startTime > inp2.entries[0].startTime);
    assert.strictEqual(inp3.navigationType, 'back-forward-cache');
  });

  it('does not report if there were no interactions', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp', {readyState: 'interactive'});

    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports prerender as nav type for prerender', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=150&prerender=1', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.strictEqual(inp.navigationType, 'prerender');
  });

  it('reports restore as nav type for wasDiscarded', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=100&wasDiscarded=1', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.strictEqual(inp.navigationType, 'restore');
  });

  it('works when calling the function twice with different options', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo(
      '/test/inp?click=100&keydown=200&doubleCall=1&reportAllChanges2=1',
      {readyState: 'interactive'},
    );

    const textarea = await $('#textarea');
    simulateUserLikeClick(textarea);

    await beaconCountIs(1, {instance: 2});

    const [inp2_1] = await getBeacons({instance: 2});

    assert(inp2_1.value > 100 - 8);
    assert(inp2_1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp2_1.name, 'INP');
    assert.strictEqual(inp2_1.value, inp2_1.delta);
    assert.strictEqual(inp2_1.rating, 'good');
    assert(
      containsEntry(inp2_1.entries, 'click', '[object HTMLTextAreaElement]'),
    );
    assert(allEntriesValid(inp2_1.entries));
    assert.match(inp2_1.navigationType, /navigate|reload/);

    // Assert no beacons for instance 1 were received.
    assert.strictEqual((await getBeacons({instance: 1})).length, 0);

    await browser.keys(['a']);

    await beaconCountIs(2, {instance: 2});

    const [, inp2_2] = await getBeacons({instance: 2});

    assert.strictEqual(inp2_2.id, inp2_1.id);
    assert.strictEqual(inp2_2.name, 'INP');
    assert.strictEqual(inp2_2.value, inp2_2.delta + inp2_1.delta);
    assert.strictEqual(inp2_2.delta, inp2_2.value - inp2_1.delta);
    assert.strictEqual(inp2_2.rating, 'needs-improvement');
    assert(
      containsEntry(inp2_2.entries, 'keydown', '[object HTMLTextAreaElement]'),
    );
    assert(allEntriesValid(inp2_2.entries));
    assert.match(inp2_2.navigationType, /navigate|reload/);

    await stubVisibilityChange('hidden');
    await beaconCountIs(1, {instance: 1});

    const [inp1] = await getBeacons({instance: 1});
    assert(inp1.id.match(/^v5-\d+-\d+$/));
    assert(inp1.id !== inp2_1.id);

    assert(inp1.id.match(/^v5-\d+-\d+$/));
    assert(inp1.id !== inp2_2.id);
    assert.strictEqual(inp1.value, inp2_2.value);
    assert.strictEqual(inp1.delta, inp2_2.value);
    assert.strictEqual(inp1.name, inp2_2.name);
    assert.strictEqual(inp1.rating, inp2_2.rating);
    assert.deepEqual(inp1.entries, inp2_2.entries);
    assert.strictEqual(inp1.navigationType, inp2_2.navigationType);
  });

  describe('attribution', function () {
    it('includes attribution data on the metric object', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?click=100&attribution=1', {
        readyState: 'complete',
      });

      // Wait until the library is loaded and the first paint occurs to ensure
      // The 40ms event duration is set
      await webVitalsLoaded();
      await firstContentfulPaint();

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Wait until a frame so INP can be counted.
      await nextFrame();

      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp1] = await getBeacons();

      assert(inp1.value >= 100 - ROUNDING_ERROR);
      assert(inp1.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(inp1.name, 'INP');
      assert.strictEqual(inp1.value, inp1.delta);
      assert.strictEqual(inp1.rating, 'good');
      assert(
        containsEntry(inp1.entries, 'click', '[object HTMLHeadingElement]'),
      );
      assert(allEntriesPresentTogether(inp1.entries));
      assert.match(inp1.navigationType, /navigate|reload/);

      assert.equal(inp1.attribution.interactionTarget, 'html>body>main>h1');
      assert.equal(inp1.attribution.interactionType, 'pointer');
      assert.equal(inp1.attribution.interactionTime, inp1.entries[0].startTime);
      assert.equal(inp1.attribution.loadState, 'complete');
      assert(allEntriesPresentTogether(inp1.attribution.processedEventEntries));

      // Assert that the reported `nextPaintTime` estimate is not more than 8ms
      // different from `startTime+duration` in the Event Timing API.
      assert(
        inp1.attribution.nextPaintTime -
          (inp1.entries[0].startTime + inp1.entries[0].duration) <=
          8,
      );
      // Assert that `nextPaintTime` is after processing ends.
      assert(
        inp1.attribution.nextPaintTime >=
          inp1.attribution.interactionTime +
            (inp1.attribution.inputDelay + inp1.attribution.processingDuration),
      );
      // Assert that the INP subpart durations adds up to the total duration
      // with a tolerance of 1 for rounding error issues
      assert.ok(
        Math.abs(
          inp1.attribution.nextPaintTime -
            inp1.attribution.interactionTime -
            (inp1.attribution.inputDelay +
              inp1.attribution.processingDuration +
              inp1.attribution.presentationDelay),
        ) <= 1,
      );

      // Assert that the INP subparts timestamps match the values in
      // the `processedEventEntries` array
      // with a tolerance of 1 for rounding error issues
      const sortedEntries1 = inp1.attribution.processedEventEntries.sort(
        (a, b) => {
          return a.processingStart - b.processingStart;
        },
      );
      assert.ok(
        Math.abs(
          inp1.attribution.interactionTime +
            inp1.attribution.inputDelay -
            sortedEntries1[0].processingStart,
        ) <= 1,
      );
      assert.ok(
        Math.abs(
          inp1.attribution.interactionTime +
            inp1.attribution.inputDelay +
            inp1.attribution.processingDuration -
            sortedEntries1.at(-1).processingEnd,
        ) <= 1,
      );
      assert.ok(
        Math.abs(
          inp1.attribution.nextPaintTime -
            inp1.attribution.presentationDelay -
            sortedEntries1.at(-1).processingEnd,
        ) <= 1,
      );

      await clearBeacons();

      await stubVisibilityChange('visible');
      await setBlockingTime('keydown', 300);

      const textarea = await $('#textarea');
      await textarea.click();
      await browser.keys(['x']);

      // Wait a bit to ensure the click event has time to dispatch.
      await nextFrame();

      const logs = await browser.execute(() => window._logMessages || []);
      console.log('Browser logs:');
      logs.forEach((log) => {
        console.log(`[${log.level}] ${log.message}`);
      });

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp2] = await getBeacons();

      assert(inp2.value >= 300 - ROUNDING_ERROR);
      assert(inp2.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(inp2.name, 'INP');
      assert.strictEqual(inp2.value, inp1.value + inp2.delta);
      assert.strictEqual(inp2.rating, 'needs-improvement');
      assert(allEntriesPresentTogether(inp2.entries));
      assert.match(inp2.navigationType, /navigate|reload/);

      assert.equal(inp2.attribution.interactionTarget, '#textarea');
      assert.equal(inp2.attribution.interactionType, 'keyboard');
      assert.equal(inp2.attribution.interactionTime, inp2.entries[0].startTime);
      assert.equal(inp2.attribution.loadState, 'complete');
      assert(allEntriesPresentTogether(inp2.attribution.processedEventEntries));
      assert(
        containsEntry(
          inp2.attribution.processedEventEntries,
          'keydown',
          '[object HTMLTextAreaElement]',
        ),
      );

      // Assert that the reported `nextPaintTime` estimate is not more than 8ms
      // different from `startTime+duration` in the Event Timing API.
      assert(
        inp2.attribution.nextPaintTime -
          (inp2.entries[0].startTime + inp2.entries[0].duration) <=
          8,
      );
      // Assert that `nextPaintTime` is after processing ends.
      assert(
        inp2.attribution.nextPaintTime >=
          inp2.attribution.interactionTime +
            (inp2.attribution.inputDelay + inp2.attribution.processingDuration),
      );
      // Assert that the INP subpart durations adds up to the total duration.
      assert.equal(
        inp2.attribution.nextPaintTime - inp2.attribution.interactionTime,
        inp2.attribution.inputDelay +
          inp2.attribution.processingDuration +
          inp2.attribution.presentationDelay,
      );

      // Assert that the INP subparts timestamps match the values in
      // the `processedEventEntries` array.
      const sortedEntries2 = inp2.attribution.processedEventEntries.sort(
        (a, b) => {
          return a.processingStart - b.processingStart;
        },
      );
      assert.equal(
        inp2.attribution.interactionTime + inp2.attribution.inputDelay,
        sortedEntries2[0].processingStart,
      );
      assert.equal(
        inp2.attribution.interactionTime +
          inp2.attribution.inputDelay +
          inp2.attribution.processingDuration,
        sortedEntries2.at(-1).processingEnd,
      );
      assert.equal(
        inp2.attribution.nextPaintTime - inp2.attribution.presentationDelay,
        sortedEntries2.at(-1).processingEnd,
      );
    });

    it('supports generating a custom target', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?click=100&attribution=1&generateTarget=1', {
        readyState: 'complete',
      });

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Ensure the interaction completes.
      await nextFrame();

      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp1] = await getBeacons();

      assert(inp1.value >= 100 - ROUNDING_ERROR);
      assert(inp1.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(inp1.name, 'INP');
      assert.strictEqual(inp1.value, inp1.delta);
      assert.strictEqual(inp1.rating, 'good');
      assert(
        containsEntry(inp1.entries, 'click', '[object HTMLHeadingElement]'),
      );
      assert(allEntriesPresentTogether(inp1.entries));
      assert.match(inp1.navigationType, /navigate|reload/);

      assert.equal(inp1.attribution.interactionTarget, 'main-heading');
    });

    it('supports multiple calls with different custom target generation functions', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo(
        '/test/inp?click=150&attribution=1&doubleCall=1&generateTarget2=1' +
          '&reportAllChanges=1&reportAllChanges2=1',
      );

      // Wait until the library is loaded and the first paint occurs to ensure
      // The 40ms event duration is set
      await webVitalsLoaded();
      await firstContentfulPaint();

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      await beaconCountIs(1, {instance: 1});
      await beaconCountIs(1, {instance: 2});

      const [inp1] = await getBeacons({instance: 1});

      assert(inp1.value >= 100 - ROUNDING_ERROR);
      assert(inp1.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(inp1.name, 'INP');
      assert.strictEqual(inp1.value, inp1.delta);
      assert.strictEqual(inp1.rating, 'good');
      assert(
        containsEntry(inp1.entries, 'click', '[object HTMLHeadingElement]'),
      );
      assert(allEntriesPresentTogether(inp1.entries));
      assert.match(inp1.navigationType, /navigate|reload/);

      assert.equal(inp1.attribution.interactionTarget, 'html>body>main>h1');

      const [inp2] = await getBeacons({instance: 2});

      assert.strictEqual(inp2.name, inp1.name);
      assert.strictEqual(inp2.value, inp1.value);
      assert.strictEqual(inp2.delta, inp1.delta);
      assert.strictEqual(inp2.rating, inp1.rating);
      assert.strictEqual(inp2.navigationType, inp1.navigationType);
      assert.deepEqual(inp2.entries, inp1.entries);
      assert(inp2.id !== inp1.id);

      assert.equal(inp2.attribution.interactionTarget, 'main-heading');
    });

    it('reports the domReadyState when input occurred', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo(
        '/test/inp?attribution=1&reportAllChanges=1&click=150&delayDCL=1000',
      );

      // Click on the <h1>.
      const h1 = await $('h1');
      await h1.click();

      await webVitalsLoaded();

      await stubVisibilityChange('visible');
      await beaconCountIs(1);

      const [inp1] = await getBeacons();
      assert.equal(inp1.attribution.loadState, 'dom-interactive');

      await clearBeacons();

      await navigateTo(
        '/test/inp' +
          '?attribution=1&reportAllChanges=1&click=150&delayResponse=2000',
      );

      // Wait a bit to ensure the page elements are available.
      await browser.pause(1000);

      // Click on the <button>.
      const reset = await $('#reset');
      await reset.click();

      await beaconCountIs(1);

      const [inp2] = await getBeacons();
      assert.equal(inp2.attribution.loadState, 'loading');
    });

    // TODO: remove this test once the following bug is fixed:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1367329
    it('reports the interaction target from any entry where target is defined', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?attribution=1&mouseup=100&click=50', {
        readyState: 'interactive',
      });

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Ensure the interaction completes.
      await nextFrame();

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp1] = await getBeacons();

      assert.equal(inp1.attribution.interactionType, 'pointer');
      // The event target should match the h1, even if the `pointerup`
      // entry doesn't contain a target.
      // See: https://bugs.chromium.org/p/chromium/issues/detail?id=1367329
      assert.equal(inp1.attribution.interactionTarget, 'html>body>main>h1');
    });

    it('reports the interaction target when target is removed from the DOM', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?attribution=1&mouseup=100&click=50', {
        readyState: 'interactive',
      });

      const button = await $('#reset');
      await simulateUserLikeClick(button);

      await nextFrame();

      // Remove the element after the interaction.
      await browser.execute('document.querySelector("#reset").remove()');

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp] = await getBeacons();

      assert.equal(inp.attribution.interactionType, 'pointer');
      assert.equal(inp.attribution.interactionTarget, '#reset');
    });

    it('includes LoAF entries if the browser supports it', async function () {
      if (!browserSupportsLoAF) this.skip();

      await navigateTo('/test/inp?attribution=1&pointerdown=100', {
        readyState: 'interactive',
      });

      // Click on the <textarea>.
      const textarea = await $('#textarea');
      await textarea.click();

      await nextFrame();

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp1] = await getBeacons();
      assert(inp1.attribution.longAnimationFrameEntries.length > 0);
      assert.equal(
        inp1.attribution.longestScript.entry.invokerType,
        'event-listener',
      );
      assert.equal(
        inp1.attribution.longestScript.entry.invoker,
        'DOMWindow.onpointerdown',
      );
      assert.equal(
        inp1.attribution.longestScript.subpart,
        'processing-duration',
      );
      assert.equal(inp1.attribution.longestScript.intersectingDuration, 100);
      assert(inp1.attribution.totalScriptDuration > 0);
      assert(inp1.attribution.totalStyleAndLayoutDuration >= 0);
      assert(inp1.attribution.totalPaintDuration >= 0);
      assert(inp1.attribution.totalUnattributedDuration >= 0);
      assert(
        Math.abs(
          inp1.value -
            (inp1.attribution.totalScriptDuration +
              inp1.attribution.totalStyleAndLayoutDuration +
              inp1.attribution.totalPaintDuration +
              inp1.attribution.totalUnattributedDuration),
        ) < 0.1,
      );
    });
  });
});

const containsEntry = (entries, name, target) => {
  return entries.findIndex((e) => e.name === name && e.target === target) > -1;
};

const allEntriesValid = (entries) => {
  const renderTimes = entries
    .map((e) => e.startTime + e.duration)
    .sort((a, b) => a - b);

  const allEntriesHaveSameRenderTimes =
    renderTimes.at(-1) - renderTimes.at(0) === 0;

  const entryData = entries.map((e) => JSON.stringify(e));

  const allEntriesAreUnique = entryData.length === new Set(entryData).size;

  return allEntriesHaveSameRenderTimes && allEntriesAreUnique;
};

const allEntriesPresentTogether = (entries) => {
  const renderTimes = entries
    .map((e) => e.startTime + e.duration)
    .sort((a, b) => a - b);

  return renderTimes.at(-1) - renderTimes.at(0) <= 8;
};

const setBlockingTime = async (event, value) => {
  const input = await $(`#${event}-blocking-time`);
  await input.setValue(value);
};

const simulateUserLikeClick = async (element) => {
  await browser
    .action('pointer')
    .move({x: 0, y: 0, origin: element})
    .down({button: 0}) // left button
    .pause(50)
    .up({button: 0})
    .perform();
};
