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
import {assertIsCloseTo} from '../utils/assertIsCloseTo.js';
import {beaconCountIs, clearBeacons, getBeacons} from '../utils/beacons.js';
import {browserSupportsEntry} from '../utils/browserSupportsEntry.js';
import {firstContentfulPaint} from '../utils/firstContentfulPaint.js';
import {navigateTo} from '../utils/navigateTo.js';
import {nextFrame} from '../utils/nextFrame.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';
import {waitUntilIdle} from '../utils/waitUntilIdle.js';
import {webVitalsLoaded} from '../utils/webVitalsLoaded.js';

const ROUNDING_ERROR = 8;

describe('onINP()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsINP;
  let browserSupportsLoAF;
  let browserSupportsPrerender;
  let browserSupportsSoftNavs;
  before(async function () {
    browserSupportsINP = await browserSupportsEntry('event');
    browserSupportsLoAF = await browserSupportsEntry('long-animation-frame');
    browserSupportsPrerender = await browser.execute(() => {
      return 'onprerenderingchange' in document;
    });
    browserSupportsSoftNavs = await browser.execute(() => {
      return (
        PerformanceObserver.supportedEntryTypes.includes('soft-navigation') &&
        typeof globalThis.PerformanceSoftNavigation?.prototype
          ?.getLargestInteractionContentfulPaint === 'function'
      );
    });
    // Set a standard screen size so soft nav paints show
    browser.setWindowSize(1280, 1024);
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
    // Give INP a chance to report
    await waitUntilIdle();

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
    // Give INP a chance to report
    await waitUntilIdle();

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
    // Give INP a chance to report
    await waitUntilIdle();

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
      // Ensure the interaction completes.
      await nextFrame();
    }

    // Give INP a chance to report
    await waitUntilIdle();

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
      // Ensure the interaction completes.
      await nextFrame();
    }

    // Give INP a chance to report
    await waitUntilIdle();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp3] = await getBeacons();
    assert(inp3.value >= 100 - ROUNDING_ERROR); // 2nd-highest blocking time.
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
      // Ensure the interaction completes.
      await nextFrame();
    }

    await beaconCountIs(3);

    const [inp1, inp2, inp3] = await getBeacons();
    assert(inp1.value >= 600); // Initial pointerdown blocking time.
    assert(inp2.value >= 400); // Initial pointerdown blocking time.
    assert(inp2.value < inp1.value); // Should have gone down.
    assert(inp3.value >= 100 - ROUNDING_ERROR); // 2nd-highest blocking time.
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
    // Give INP a chance to report
    await waitUntilIdle();

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

    // Ensure the button click is not in same frame
    // as the next key presses.
    await nextFrame();
    await waitUntilIdle();

    await browser.keys(['a', 'b', 'c']);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    await stubForwardBack();
    await beaconCountIs(1);

    const [inp2] = await getBeacons();

    assert(inp2.value >= 0);
    assert(inp2.id.match(/^v5-\d+-\d+$/));
    assert(inp1.id !== inp2.id);
    assert.strictEqual(inp2.name, 'INP');
    assert.strictEqual(inp2.value, inp2.delta);
    assert.strictEqual(inp2.rating, 'good');
    // Entry name can be keydown or keyup or keypress depending which frame
    // is processed to just use key (the containsEntry does an `includes` so
    // supports this).
    assert(containsEntry(inp2.entries, 'key', '[object HTMLTextAreaElement]'));
    assert(allEntriesPresentTogether(inp1.entries));
    assert(inp2.entries[0].startTime > inp1.entries[0].startTime);
    assert.strictEqual(inp2.navigationType, 'back-forward-cache');

    await stubForwardBack();
    await clearBeacons();

    await setBlockingTime('keydown', 0);
    await setBlockingTime('pointerdown', 300);

    const button = await $('button');
    await button.click();

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

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

  it('reports short <16m bfcache INPs (reportAllChanges === false)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=8');

    // Wait until the library is loaded
    await webVitalsLoaded();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    await stubForwardBack();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);

    await clearBeacons();

    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assertIsCloseTo(softInp.value, 8, 1);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    assert.strictEqual(softInp.entries.length, 0);
    assert.strictEqual(softInp.navigationType, 'back-forward-cache');
  });

  it('reports short <16m bfcache INPs (reportAllChanges === true)', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=8&reportAllChanges=1');

    // Wait until the library is loaded
    await webVitalsLoaded();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    await stubForwardBack();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);

    await clearBeacons();

    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assertIsCloseTo(softInp.value, 8, 1);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    assert.strictEqual(softInp.navigationType, 'back-forward-cache');

    await stubVisibilityChange('visible');
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
    if (!browserSupportsPrerender) this.skip();

    await navigateTo('/test/inp?click=150&prerender=1');

    await webVitalsLoaded();
    await firstContentfulPaint();

    let h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Wait a bit to allow the prerender to happen
    await browser.pause(500);

    const prerenderLink = await $('#prerender-link');
    await prerenderLink.click();

    await beaconCountIs(1);
    await clearBeacons();
    await webVitalsLoaded();

    h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

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
    // Give INP a chance to report
    await waitUntilIdle();

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
      '/test/inp?click=100&keydown=220&doubleCall=1&reportAllChanges2=1',
      {readyState: 'interactive'},
    );

    const textarea = await $('#textarea');
    simulateUserLikeClick(textarea);

    await beaconCountIs(1, {instance: 2});

    const [inp2_1] = await getBeacons({instance: 2});

    assert(inp2_1.value > 100 - ROUNDING_ERROR);
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
    // Entry name can be keydown or keyup or keypress depending which frame
    // is processed to just use key (the containsEntry does an `includes` so
    // supports this).
    assert(
      containsEntry(inp2_2.entries, 'key', '[object HTMLTextAreaElement]'),
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

  it('reports on batch reporting using document.visibilitychange', async function () {
    if (!browserSupportsINP) this.skip();

    await navigateTo('/test/inp?click=100&batchReporting=1', {
      readyState: 'interactive',
    });

    // Wait until the library is loaded
    await webVitalsLoaded();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    await hideAndReshowPage();

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

  it('reports hard nav INP and soft navs (reportAllChanges === false)', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?reportSoftNavs=1&click=150');

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLButtonElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);
    assert(inp.navigationId > 0);

    await clearBeacons();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assert(softInp.value >= 0);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    assert(
      containsEntry(softInp.entries, 'click', '[object HTMLHeadingElement]'),
    );
    assert(allEntriesPresentTogether(softInp.entries));
    assert.strictEqual(softInp.navigationType, 'soft-navigation');
    assert(softInp.navigationId > 0);
    assert(softInp.navigationId > inp.navigationId);
  });

  it('reports hard nav INP and soft navs (reportAllChanges === true)', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?reportSoftNavs=1&reportAllChanges=1&click=150');

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', '[object HTMLButtonElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);

    await clearBeacons();

    // Click on the soft nav button to start new soft nav.
    await softNavButton.click();

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assert(softInp.value >= 0);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    assert(
      containsEntry(softInp.entries, 'click', '[object HTMLButtonElement]'),
    );
    assert(allEntriesPresentTogether(softInp.entries));
    assert.strictEqual(softInp.navigationType, 'soft-navigation');
  });

  it('reports soft navs when loaded late (reportAllChanges === false)', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?reportSoftNavs=1&loadAfterInput=1&click=150');

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    // TODO: This next line seems flakey, not sure why?
    // assert(containsEntry(inp.entries, 'click',
    // '[object HTMLButtonElement]'));
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);

    await clearBeacons();

    await softNavButton.click();

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assert(softInp.value >= 0);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    // TODO: The next lines seems flakey as entries empty, not sure why?
    // assert(containsEntry(softInp.entries, 'click',
    // '[object HTMLHeadingElement]'));
    // assert(allEntriesPresentTogether(softInp.entries));
    assert.strictEqual(softInp.navigationType, 'soft-navigation');
  });

  it('reports INP on multiple consecutive soft navigations with varying latencies', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    // Start with 150ms click blocking on hard nav
    await navigateTo('/test/inp?reportSoftNavs=1&click=150');

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start soft nav 1
    // (finalizing hard nav INP).
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1);
    const [inp] = await getBeacons();
    // INP should be >=150 (with 8 millisecond coarsening)
    assert(inp.value >= 142);
    assert.strictEqual(inp.navigationType, 'navigate');

    await clearBeacons();

    // 1. Soft Nav 1: Set blocking to 200ms
    const clickBlockingInput = await $('#click-blocking-time');
    await clickBlockingInput.setValue(200);

    // Click on soft nav button to start soft nav 2 (finalizing Soft Nav 1 INP).
    await softNavButton.click();

    await beaconCountIs(1);
    const [softInp1] = await getBeacons();
    // INP should be >=200 (with 8 millisecond coarsening)
    assert(softInp1.value >= 192);
    assert.strictEqual(softInp1.navigationType, 'soft-navigation');

    await clearBeacons();

    // 2. Soft Nav 2: Set blocking to 100ms
    await clickBlockingInput.setValue(100);

    // Trigger an interaction on Soft Nav 2
    const h1 = await $('h1');
    await simulateUserLikeClick(h1);
    await nextFrame();
    await waitUntilIdle();

    // Finalize Soft Nav 2 by hiding the page (no click needed to transition).
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);
    const [softInp2] = await getBeacons();
    // INP should be >=200 (with 8 millisecond coarsening)
    assert(softInp2.value >= 92);
    assert(softInp2.value < 150);
    assert.strictEqual(softInp2.navigationType, 'soft-navigation');
  });

  it('reports short <16m soft navs INPs (reportAllChanges === false)', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?reportSoftNavs=1&click=8');

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);

    await clearBeacons();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assertIsCloseTo(softInp.value, 8, 1);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    assert.strictEqual(softInp.entries.length, 0);
    assert.strictEqual(softInp.navigationType, 'soft-navigation');
  });

  it('reports short <16m soft navs INPs (reportAllChanges === true)', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?reportSoftNavs=1&click=8&reportAllChanges=1');

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(allEntriesPresentTogether(inp.entries));
    assert.match(inp.navigationType, /navigate|reload/);

    await clearBeacons();

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [softInp] = await getBeacons();
    assertIsCloseTo(softInp.value, 8, 1);
    assert(softInp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softInp.name, 'INP');
    assert.strictEqual(softInp.value, softInp.delta);
    assert.strictEqual(softInp.rating, 'good');
    assert.strictEqual(softInp.navigationType, 'soft-navigation');

    await stubVisibilityChange('visible');
  });

  it('works when calling the function twice with reportSoftNavs=1 and reportSoftNavs2=0', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo(
      '/test/inp?doubleCall=1&reportSoftNavs=1&reportSoftNavs2=0&click=150',
    );

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start new soft nav.
    // This will finalize and report the hard-nav INP for instance 1.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1, {instance: 1});

    // Instance 2 should NOT report yet.
    assert.strictEqual((await getBeacons({instance: 2})).length, 0);

    const [inp1] = await getBeacons({instance: 1});
    assert(inp1.value >= 150);
    assert.strictEqual(inp1.name, 'INP');
    assert.strictEqual(inp1.navigationType, 'navigate');

    await clearBeacons();

    await setBlockingTime('click', 50);

    // Generate a soft-nav interaction
    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    // Instance 1 should report soft nav INP
    // and instance 2 should report hard nav INP.
    await beaconCountIs(1, {instance: 1});
    await beaconCountIs(1, {instance: 2});

    const [softInp1] = await getBeacons({instance: 1});
    assert(softInp1.value >= 0);
    // Soft nav INP should be ~ 50ms
    assert(softInp1.value < 100);
    assert.strictEqual(softInp1.name, 'INP');
    assert.strictEqual(softInp1.navigationType, 'soft-navigation');

    const [hardInp] = await getBeacons({instance: 2});
    assert(hardInp.value >= 0);
    // Hard nav INP should be > 150ms
    assert(hardInp.value >= 150);
    assert.strictEqual(hardInp.name, 'INP');
    assert.strictEqual(hardInp.navigationType, 'navigate');
  });

  it('works when calling the function twice with reportSoftNavs=1 and default for 2', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?doubleCall=1&reportSoftNavs=1&click=150');

    // Wait until the library is loaded
    await webVitalsLoaded();

    // Click on the soft nav button to start new soft nav.
    // This will finalize and report the hard-nav INP for instance 1.
    const softNavButton = await $('#soft-nav');
    await softNavButton.click();

    await beaconCountIs(1, {instance: 1});

    // Instance 2 should NOT report yet.
    assert.strictEqual((await getBeacons({instance: 2})).length, 0);

    const [inp1] = await getBeacons({instance: 1});
    assert(inp1.value >= 150);
    assert.strictEqual(inp1.name, 'INP');
    assert.strictEqual(inp1.navigationType, 'navigate');

    await clearBeacons();

    await setBlockingTime('click', 50);

    // Generate a soft-nav interaction
    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    // Load a new page to trigger the hidden state.
    await stubVisibilityChange('hidden');

    // Instance 1 should report soft nav INP
    // and instance 2 should report hard nav INP.
    await beaconCountIs(1, {instance: 1});
    await beaconCountIs(1, {instance: 2});

    const [softInp1] = await getBeacons({instance: 1});
    assert(softInp1.value >= 0);
    // Soft nav INP should be ~ 50ms
    assert(softInp1.value < 100);
    assert.strictEqual(softInp1.name, 'INP');
    assert.strictEqual(softInp1.navigationType, 'soft-navigation');

    const [hardInp] = await getBeacons({instance: 2});
    assert(hardInp.value >= 0);
    // Hard nav INP should be > 150ms
    assert(hardInp.value >= 150);
    assert.strictEqual(hardInp.name, 'INP');
    assert.strictEqual(hardInp.navigationType, 'navigate');
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

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

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
      assertIsCloseTo(
        inp1.attribution.nextPaintTime - inp1.attribution.interactionTime,
        inp1.attribution.inputDelay +
          inp1.attribution.processingDuration +
          inp1.attribution.presentationDelay,
        1,
      );

      // Assert that the INP subparts timestamps match the values in
      // the `processedEventEntries` array
      // with a tolerance of 1 for rounding error issues
      const sortedEntries1 = inp1.attribution.processedEventEntries.sort(
        (a, b) => {
          return a.processingStart - b.processingStart;
        },
      );
      assertIsCloseTo(
        inp1.attribution.interactionTime + inp1.attribution.inputDelay,
        sortedEntries1[0].processingStart,
        1,
      );
      // Due to `duration` rounding, it can be up to 4ms out (+1 for rounding)
      // See https://github.com/w3c/event-timing/issues/168
      assertIsCloseTo(
        inp1.attribution.interactionTime +
          inp1.attribution.inputDelay +
          inp1.attribution.processingDuration,
        sortedEntries1.at(-1).processingEnd,
        5,
      );
      assertIsCloseTo(
        inp1.attribution.nextPaintTime - inp1.attribution.presentationDelay,
        sortedEntries1.at(-1).processingEnd,
        5,
      );

      await clearBeacons();

      await stubVisibilityChange('visible');
      await setBlockingTime('keydown', 300);

      const textarea = await $('#textarea');
      await textarea.click();

      // Ensure the button click is not in same frame
      // as the next key presses.
      await nextFrame();
      await waitUntilIdle();

      await browser.keys(['x']);

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

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
      // Entry name can be keydown or keyup or keypress depending which frame
      // is processed to just use key (the containsEntry does an `includes` so
      // supports this).
      assert(
        containsEntry(
          inp2.attribution.processedEventEntries,
          'key',
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
      assertIsCloseTo(
        inp2.attribution.interactionTime + inp2.attribution.inputDelay,
        sortedEntries2[0].processingStart,
        ROUNDING_ERROR,
      );
      assertIsCloseTo(
        inp2.attribution.interactionTime +
          inp2.attribution.inputDelay +
          inp2.attribution.processingDuration,
        sortedEntries2.at(-1).processingEnd,
        ROUNDING_ERROR,
      );
      assertIsCloseTo(
        inp2.attribution.nextPaintTime - inp2.attribution.presentationDelay,
        sortedEntries2.at(-1).processingEnd,
        ROUNDING_ERROR,
      );
    });

    it('supports disabling processedEventEntries', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo(
        '/test/inp?click=100&attribution=1&includeProcessedEventEntries=false',
        {
          readyState: 'complete',
        },
      );

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp] = await getBeacons();

      assert(inp.value >= 0);
      assert(inp.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(inp.name, 'INP');
      assert.strictEqual(inp.value, inp.delta);
      assert(allEntriesPresentTogether(inp.entries));
      assert.equal(inp.attribution.processedEventEntries.length, 0);
    });

    it('supports enabling processedEventEntries', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo(
        '/test/inp?click=100&attribution=1&includeProcessedEventEntries=true',
        {
          readyState: 'complete',
        },
      );

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp] = await getBeacons();

      assert(inp.value >= 0);
      assert(inp.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(inp.name, 'INP');
      assert.strictEqual(inp.value, inp.delta);
      assert(allEntriesPresentTogether(inp.entries));
      assert(inp.attribution.processedEventEntries.length > 0);
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
      // Give INP a chance to report
      await waitUntilIdle();

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

    it('supports generating a custom target with fallback', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?click=100&attribution=1&generateTarget=1', {
        readyState: 'complete',
      });

      const label1 = await $('#label1>code');
      await simulateUserLikeClick(label1);

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp1] = await getBeacons();

      assert.equal(inp1.attribution.interactionTarget, '#label1>code');
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

      // Click on the <button>.
      const reset = await $('#reset');
      await reset.click();

      await beaconCountIs(1);

      const [inp2] = await getBeacons();
      // Test is flakey in Safari as it seems to wait for the full response
      if (browser.capabilities.browserName !== 'Safari') {
        assert.equal(inp2.attribution.loadState, 'loading');
      }
    });

    it('reports the interaction target from any entry where target is defined', async function () {
      if (!browserSupportsINP) this.skip();

      await navigateTo('/test/inp?attribution=1&mouseup=100&click=50', {
        readyState: 'interactive',
      });

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

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

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

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

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

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
      assertIsCloseTo(
        inp1.attribution.longestScript.intersectingDuration,
        100,
        10,
      );
      assert(inp1.attribution.totalScriptDuration > 0);
      assert(inp1.attribution.totalStyleAndLayoutDuration >= 0);
      assert(inp1.attribution.totalPaintDuration >= 0);
      assert(inp1.attribution.totalUnattributedDuration >= 0);
      assertIsCloseTo(
        inp1.value,
        inp1.attribution.totalScriptDuration +
          inp1.attribution.totalStyleAndLayoutDuration +
          inp1.attribution.totalPaintDuration +
          inp1.attribution.totalUnattributedDuration,
        0.1,
      );
    });

    it('reports soft navigation INP attribution', async function () {
      if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

      await navigateTo('/test/inp?attribution=1&reportSoftNavs=1&click=150');

      // Wait until the library is loaded
      await webVitalsLoaded();

      // Click on the soft nav button to start new soft nav.
      const softNavButton = await $('#soft-nav');
      await softNavButton.click();

      await beaconCountIs(1);
      await clearBeacons();

      const h1 = await $('h1');
      await simulateUserLikeClick(h1);

      // Ensure the interaction completes.
      await nextFrame();
      // Give INP a chance to report
      await waitUntilIdle();

      // Load a new page to trigger the hidden state.
      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp] = await getBeacons();

      assert(inp.value >= 150 - ROUNDING_ERROR);
      assert.strictEqual(inp.name, 'INP');
      assert.strictEqual(inp.value, inp.delta);
      assert.strictEqual(inp.rating, 'good');
      assert(
        containsEntry(inp.entries, 'click', '[object HTMLHeadingElement]'),
      );
      assert(allEntriesPresentTogether(inp.entries));
      assert.strictEqual(inp.navigationType, 'soft-navigation');

      assert.equal(inp.attribution.interactionTarget, 'html>body>main>h1');
      assert.equal(inp.attribution.interactionType, 'pointer');
      assert.equal(inp.attribution.interactionTime, inp.entries[0].startTime);
      assert(inp.navigationId > 1);
    });
  });
});

const containsEntry = (entries, name, target) => {
  return (
    entries.findIndex((e) => e.name.includes(name) && e.target === target) > -1
  );
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

const hideAndReshowPage = async () => {
  // Switch to new tab and back to change visibility state.
  // New tabs on Safari in webdriver.io are flakey, so minimize/maximize
  // instead, but it's kind of distracting so use tab switch for others.
  if (browser.capabilities.browserName !== 'Safari') {
    const handle1 = await browser.getWindowHandle();
    await browser.newWindow('https://example.com');
    await browser.pause(500);
    await browser.closeWindow();
    await browser.switchToWindow(handle1);
  } else {
    await browser.minimizeWindow();
    await browser.pause(500);
    await browser.maximizeWindow();
  }
};
