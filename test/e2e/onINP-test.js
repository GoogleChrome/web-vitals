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
import {nextFrame} from '../utils/nextFrame.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';


const ROUNDING_ERROR = 8;


describe('onINP()', async function() {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsINP;
  before(async function() {
    browserSupportsINP = await browserSupportsEntry('event');
  });

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value on visibility hidden after interactions (reportAllChanges === false)', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=100');

    const h1 = await $('h1');
    await h1.click();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp.entries));
    assert(inp.entries[0].interactionId > 0);
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value on visibility hidden after interactions (reportAllChanges === true)', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=100&reportAllChanges=1');

    const h1 = await $('h1');
    await h1.click();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp.entries));
    assert(inp.entries[0].interactionId > 0);
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value on page unload after interactions (reportAllChanges === false)', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=100');

    const h1 = await $('h1');
    await h1.click();

    await browser.url('about:blank');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp.entries));
    assert(inp.entries[0].interactionId > 0);
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports the correct value on page unload after interactions (reportAllChanges === true)', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=100&reportAllChanges=1');

    const h1 = await $('h1');
    await h1.click();

    await browser.url('about:blank');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp.entries));
    assert(inp.entries[0].interactionId > 0);
    assert.match(inp.navigationType, /navigate|reload/);
  });

  it('reports approx p98 interaction when 50+ interactions (reportAllChanges === false)', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=60&pointerdown=600');

    const h1 = await $('h1');
    await h1.click();

    await setBlockingTime('pointerdown', 400);
    await h1.click();

    await setBlockingTime('pointerdown', 200);
    await h1.click();

    await setBlockingTime('pointerdown', 0);

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp1] = await getBeacons();
    assert(inp1.value >= 600); // Initial pointerdown blocking time.
    assert.strictEqual(inp1.rating, 'poor');

    await clearBeacons();
    await stubVisibilityChange('visible');

    let count = 3;
    while (count < 50) {
      await h1.click();
      count++;
    }

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp2] = await getBeacons();
    assert(inp2.value >= 400); // Initial pointerdown blocking time.
    assert(inp2.value < inp1.value); // Should have gone down.
    assert.strictEqual(inp2.rating, 'needs-improvement');

    await clearBeacons();
    await stubVisibilityChange('visible');

    while (count < 100) {
      await h1.click();
      count++;
    }

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp3] = await getBeacons();
    assert(inp3.value >= 200); // 2nd-highest pointerdown blocking time.
    assert(inp3.value < inp2.value); // Should have gone down.
    assert.strictEqual(inp3.rating, 'needs-improvement');
  });

  it('reports approx p98 interaction when 50+ interactions (reportAllChanges === true)', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=60&pointerdown=600&reportAllChanges=1');

    const h1 = await $('h1');
    await h1.click();

    await setBlockingTime('pointerdown', 400);
    await h1.click();

    await setBlockingTime('pointerdown', 200);
    await h1.click();

    await setBlockingTime('pointerdown', 0);

    let count = 3;
    while (count < 100) {
      await h1.click();
      count++;
    }

    await beaconCountIs(3);

    const [inp1, inp2, inp3] = await getBeacons();
    assert(inp1.value >= 600); // Initial pointerdown blocking time.
    assert(inp2.value >= 400); // Initial pointerdown blocking time.
    assert(inp2.value < inp1.value); // Should have gone down.
    assert(inp3.value >= 200); // 2nd-highest pointerdown blocking time.
    assert(inp3.value < inp2.value); // Should have gone down.

    assert.strictEqual(inp1.rating, 'poor');
    assert.strictEqual(inp2.rating, 'needs-improvement');
    assert.strictEqual(inp3.rating, 'needs-improvement');
  });

  it('reports a new interaction after bfcache restore', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp');

    await setBlockingTime('click', 100);

    const h1 = await $('h1');
    await h1.click();

    await stubForwardBack();
    await beaconCountIs(1);

    const [inp1] = await getBeacons();
    assert(inp1.value >= 0);
    assert(inp1.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp1.name, 'INP');
    assert.strictEqual(inp1.value, inp1.delta);
    assert.strictEqual(inp1.rating, 'good');
    assert(containsEntry(inp1.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp1.entries));
    assert.match(inp1.navigationType, /navigate|reload/);

    await clearBeacons();

    await setBlockingTime('click', 0);
    await setBlockingTime('keydown', 50);

    const textarea = await $('#textarea');
    await textarea.click();

    await browser.keys(['a', 'b', 'c']);

    await stubForwardBack();
    await beaconCountIs(1);

    const [inp2] = await getBeacons();
    assert(inp2.value >= 0);
    assert(inp2.id.match(/^v3-\d+-\d+$/));
    assert(inp1.id !== inp2.id);
    assert.strictEqual(inp2.name, 'INP');
    assert.strictEqual(inp2.value, inp2.delta);
    assert.strictEqual(inp2.rating, 'good');
    assert(containsEntry(inp2.entries, 'keydown', '#textarea'));
    assert(interactionIDsMatch(inp2.entries));
    assert(inp2.entries[0].interactionId > inp1.entries[0].interactionId);
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
    assert(inp3.id.match(/^v3-\d+-\d+$/));
    assert(inp1.id !== inp3.id);
    assert.strictEqual(inp3.name, 'INP');
    assert.strictEqual(inp3.value, inp3.delta);
    assert.strictEqual(inp3.rating, 'needs-improvement');
    assert(containsEntry(inp3.entries, 'pointerdown', '#reset'));
    assert(interactionIDsMatch(inp3.entries));
    assert(inp3.entries[0].interactionId > inp2.entries[0].interactionId);
    assert.strictEqual(inp3.navigationType, 'back-forward-cache');
  });

  it('does not report if there were no interactions', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp');

    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports prerender as nav type for prerender', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=100&prerender=1');


    const h1 = await $('h1');
    await h1.click();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp.entries));
    assert(inp.entries[0].interactionId > 0);
    assert.strictEqual(inp.navigationType, 'prerender');
  });

  it('reports restore as nav type for wasDiscarded', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp?click=100&wasDiscarded=1');

    const h1 = await $('h1');
    await h1.click();

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
    assert(containsEntry(inp.entries, 'click', 'h1'));
    assert(interactionIDsMatch(inp.entries));
    assert(inp.entries[0].interactionId > 0);
    assert.strictEqual(inp.navigationType, 'restore');
  });

  describe('attribution', function() {
    it('includes attribution data on the metric object', async function() {
      if (!browserSupportsINP) this.skip();

      await browser.url('/test/inp?click=100&attribution=1');

      const h1 = await $('h1');
      await h1.click();

      // Ensure the interaction completes.
      await nextFrame();

      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [inp1] = await getBeacons();

      assert(inp1.value >= 100 - ROUNDING_ERROR);
      assert(inp1.id.match(/^v3-\d+-\d+$/));
      assert.strictEqual(inp1.name, 'INP');
      assert.strictEqual(inp1.value, inp1.delta);
      assert.strictEqual(inp1.rating, 'good');
      assert(containsEntry(inp1.entries, 'click', 'h1'));
      assert(interactionIDsMatch(inp1.entries));
      assert(inp1.entries[0].interactionId > 0);
      assert.match(inp1.navigationType, /navigate|reload/);

      const clickEntry = inp1.entries.find((e) => e.name === 'click');
      assert.equal(inp1.attribution.eventTarget, 'html>body>main>h1');
      assert.equal(inp1.attribution.eventType, clickEntry.name);
      assert.equal(inp1.attribution.eventTime, clickEntry.startTime);
      assert.equal(inp1.attribution.loadState, 'complete');

      // Deep equal won't work since some of the properties are removed before
      // sending to /collect, so just compare some.
      const eventEntry1 = inp1.attribution.eventEntry;
      assert.equal(eventEntry1.startTime, clickEntry.startTime);
      assert.equal(eventEntry1.duration, clickEntry.duration);
      assert.equal(eventEntry1.name, clickEntry.name);
      assert.equal(eventEntry1.processingStart, clickEntry.processingStart);

      await clearBeacons();
      await setBlockingTime('pointerup', 200);

      await stubVisibilityChange('visible');
      const reset = await $('#reset');
      await reset.click();

      // Ensure the interaction completes.
      await nextFrame();

      await stubVisibilityChange('hidden');
      await beaconCountIs(1);

      const [inp2] = await getBeacons();

      assert(inp2.value >= 300 - ROUNDING_ERROR);
      assert(inp2.id.match(/^v3-\d+-\d+$/));
      assert.strictEqual(inp2.name, 'INP');
      assert.strictEqual(inp2.value, inp1.value + inp2.delta);
      assert.strictEqual(inp2.rating, 'needs-improvement');
      assert(containsEntry(inp2.entries, 'pointerup', '#reset'));
      assert(interactionIDsMatch(inp2.entries));
      assert(inp2.entries[0].interactionId > 0);
      assert.match(inp2.navigationType, /navigate|reload/);

      const pointerupEntry = inp2.entries.find((e) => e.name === 'pointerup');
      assert.equal(inp2.attribution.eventTarget, '#reset');
      assert.equal(inp2.attribution.eventType, pointerupEntry.name);
      assert.equal(inp2.attribution.eventTime, pointerupEntry.startTime);
      assert.equal(inp2.attribution.loadState, 'complete');

      // Deep equal won't work since some of the properties are removed before
      // sending to /collect, so just compare some.
      const eventEntry2 = inp2.attribution.eventEntry;
      assert.equal(eventEntry2.startTime, pointerupEntry.startTime);
      assert.equal(eventEntry2.duration, pointerupEntry.duration);
      assert.equal(eventEntry2.name, pointerupEntry.name);
      assert.equal(eventEntry2.processingStart, pointerupEntry.processingStart);
    });

    it('reports the domReadyState when input occurred', async function() {
      if (!browserSupportsINP) this.skip();

      await browser.url('/test/inp?' +
          'attribution=1&reportAllChanges=1&click=100&delayDCL=1000');

      // Click on the <h1>.
      const h1 = await $('h1');
      await h1.click();

      await stubVisibilityChange('visible');
      await beaconCountIs(1);

      const [inp1] = await getBeacons();
      assert.equal(inp1.attribution.loadState, 'dom-interactive');

      await clearBeacons();

      await browser.url('/test/inp?' +
          'attribution=1&reportAllChanges=1&click=100&delayResponse=1000');

      // Click on the <button>.
      const reset = await $('#reset');
      await reset.click();

      await beaconCountIs(1);

      const [inp2] = await getBeacons();
      assert.equal(inp2.attribution.loadState, 'loading');
    });
  });
});


const containsEntry = (entries, name, target) => {
  return entries.findIndex((e) => e.name === name && e.target === target) > -1;
};

const interactionIDsMatch = (entries) => {
  return entries.every((e) => e.interactionId === entries[0].interactionId);
};

const setBlockingTime = (event, value) => {
  return browser.execute((event, value) => {
    document.getElementById(`${event}-blocking-time`).value = value;
  }, event, value);
};
