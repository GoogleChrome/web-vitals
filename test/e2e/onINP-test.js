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
import {navigateTo} from '../utils/navigateTo.js';
import {nextFrame} from '../utils/nextFrame.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';

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

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

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

    // Don't await the `interactive` ready state because DCL is delayed until
    // after user input.
    await navigateTo('/test/inp?click=100&loadAfterInput=1');

    // Wait until
    await nextFrame();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

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
    await navigateTo('/test/inp?click=100&reportAllChanges=1&loadAfterInput=1');

    // Wait until
    await nextFrame();

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

    await navigateTo('/test/inp', {readyState: 'interactive'});

    await setBlockingTime('click', 100);

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    await stubForwardBack();
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

    await navigateTo('/test/inp?click=100&prerender=1', {
      readyState: 'interactive',
    });

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

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

  describe('attribution', function () {
    it('includes attribution data on the metric object', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?click=100&attribution=1', {
        readyState: 'complete',
      });

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

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
      // Assert that the INP phase durations adds up to the total duration.
      assert.equal(
        inp1.attribution.nextPaintTime - inp1.attribution.interactionTime,
        inp1.attribution.inputDelay +
          inp1.attribution.processingDuration +
          inp1.attribution.presentationDelay,
      );

      // Assert that the INP phases timestamps match the values in
      // the `processedEventEntries` array.
      const sortedEntries1 = inp1.attribution.processedEventEntries.sort(
        (a, b) => {
          return a.processingStart - b.processingStart;
        },
      );
      assert.equal(
        inp1.attribution.interactionTime + inp1.attribution.inputDelay,
        sortedEntries1[0].processingStart,
      );
      assert.equal(
        inp1.attribution.interactionTime +
          inp1.attribution.inputDelay +
          inp1.attribution.processingDuration,
        sortedEntries1.at(-1).processingEnd,
      );
      assert.equal(
        inp1.attribution.nextPaintTime - inp1.attribution.presentationDelay,
        sortedEntries1.at(-1).processingEnd,
      );

      await clearBeacons();

      await stubVisibilityChange('visible');
      await setBlockingTime('keydown', 300);

      const textarea = await $('#textarea');
      await textarea.click();
      await browser.keys(['x']);

      // Wait a bit to ensure the click event has time to dispatch.
      await nextFrame();

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
      assert.equal(
        inp2.attribution.interactionTargetElement,
        '[object HTMLTextAreaElement]',
      );
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
      // Assert that the INP phase durations adds up to the total duration.
      assert.equal(
        inp2.attribution.nextPaintTime - inp2.attribution.interactionTime,
        inp2.attribution.inputDelay +
          inp2.attribution.processingDuration +
          inp2.attribution.presentationDelay,
      );

      // Assert that the INP phases timestamps match the values in
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

    it('reports the domReadyState when input occurred', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo(
        '/test/inp?attribution=1&reportAllChanges=1&click=100&delayDCL=1000',
      );

      // Click on the <h1>.
      const h1 = await $('h1');
      await h1.click();

      await stubVisibilityChange('visible');
      await beaconCountIs(1);

      const [inp1] = await getBeacons();
      assert.equal(inp1.attribution.loadState, 'dom-interactive');

      await clearBeacons();

      await navigateTo(
        '/test/inp' +
          '?attribution=1&reportAllChanges=1&click=100&delayResponse=2000',
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

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp1] = await getBeacons();

      assert.equal(inp1.attribution.interactionType, 'pointer');
      // The event target should match the h1, even if the `pointerup`
      // entry doesn't contain a target.
      // See: https://bugs.chromium.org/p/chromium/issues/detail?id=1367329
      assert.equal(inp1.attribution.interactionTarget, 'html>body>main>h1');
      assert.equal(
        inp1.attribution.interactionTargetElement,
        '[object HTMLHeadingElement]',
      );
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
      assert.equal(
        inp.attribution.interactionTargetElement,
        '[object HTMLButtonElement]',
      );
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
    });

    it('includes target even when removed (reportAllChanges === false)', async function () {
      if (!browserSupportsLoAF) this.skip();

      await navigateTo('/test/inp?attribution=1&pointerdown=100', {
        readyState: 'interactive',
      });

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      await browser.execute(() => {
        // Remove target element
        document.querySelector('h1').remove();
      });

      await nextFrame();

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp] = await getBeacons();
      // Note this should be the reduced selector without the full path
      assert.equal(inp.attribution.interactionTarget, 'h1');
    });

    it('includes target (reportAllChanges === true)', async function () {
      // We can't guarantee the order or reporting removed targets with
      // reportAllChanges so don't even try. Just test the target without
      // removal to compare to previous test
      if (!browserSupportsLoAF) this.skip();

      await navigateTo(
        '/test/inp?attribution=1&pointerdown=100&reportAllChanges=1',
        {
          readyState: 'interactive',
        },
      );

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Can't guarantee order so let's wait for beacon
      await beaconCountIs(1);

      await browser.execute(() => {
        // Remove target element
        document.querySelector('h1').remove();
      });

      const [inp] = await getBeacons();
      // Note this should be the full selector with the full path
      assert.equal(inp.attribution.interactionTarget, 'html>body>main>h1');
    });
  });
});

const containsEntry = (entries, name, target) => {
  return entries.findIndex((e) => e.name === name && e.target === target) > -1;
};

const allEntriesPresentTogether = (entries) => {
  const renderTimes = entries
    .map((e) => Math.max(e.startTime + e.duration, e.processingEnd))
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
