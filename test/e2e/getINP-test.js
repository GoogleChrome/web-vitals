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

const assert = require('assert');
const {beaconCountIs, clearBeacons, getBeacons} = require('../utils/beacons.js');
const {browserSupportsEntry} = require('../utils/browserSupportsEntry.js');
const {stubForwardBack} = require('../utils/stubForwardBack.js');
const {stubVisibilityChange} = require('../utils/stubVisibilityChange.js');


describe('getINP()', async function() {
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
    assert(inp.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
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
    assert(inp.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
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
    assert(inp.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
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
    assert(inp.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
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
    assert(inp1.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(inp1.name, 'INP');
    assert.strictEqual(inp1.value, inp1.delta);
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
    assert(inp2.id.match(/^v2-\d+-\d+$/));
    assert(inp1.id !== inp2.id);
    assert.strictEqual(inp2.name, 'INP');
    assert.strictEqual(inp2.value, inp2.delta);
    assert(containsEntry(inp2.entries, 'keydown', 'textarea'));
    assert(interactionIDsMatch(inp2.entries));
    assert(inp2.entries[0].interactionId > inp1.entries[0].interactionId);
    assert.strictEqual(inp2.navigationType, 'back_forward_cache');

    await stubForwardBack();

    await setBlockingTime('keydown', 0);
    await setBlockingTime('pointerdown', 200);

    const button = await $('button');
    await button.click();

    // Pause to ensure the interaction finishes (test is flakey without this).
    await browser.pause(500);

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [inp3] = await getBeacons();
    assert(inp3.value >= 0);
    assert(inp3.id.match(/^v2-\d+-\d+$/));
    assert(inp1.id !== inp3.id);
    assert.strictEqual(inp3.name, 'INP');
    assert.strictEqual(inp3.value, inp3.delta);
    assert(containsEntry(inp3.entries, 'pointerdown', 'button'));
    assert(interactionIDsMatch(inp3.entries));
    assert(inp3.entries[0].interactionId > inp2.entries[0].interactionId);
    assert.strictEqual(inp3.navigationType, 'back_forward_cache');
  });

  it('does not reports if there were no interactions', async function() {
    if (!browserSupportsINP) this.skip();

    await browser.url('/test/inp');

    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
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
