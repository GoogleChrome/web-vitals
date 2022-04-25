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

const assert = require('assert');
const {afterLoad} = require('../utils/afterLoad.js');
const {beaconCountIs, clearBeacons, getBeacons} = require('../utils/beacons.js');
const {stubForwardBack} = require('../utils/stubForwardBack.js');

/**
 * Accepts a PerformanceNavigationTimingEntry (or shim) and asserts that it
 * has all the expected properties.
 * @param {Object} entry
 */
function assertValidEntry(entry) {
  const timingProps = [
    'connectEnd',
    'connectStart',
    'domComplete',
    'domContentLoadedEventEnd',
    'domContentLoadedEventStart',
    'domInteractive',
    'domainLookupEnd',
    'domainLookupStart',
    'fetchStart',
    'loadEventEnd',
    'loadEventStart',
    'redirectEnd',
    'redirectStart',
    'requestStart',
    'responseEnd',
    'responseStart',
    'secureConnectionStart',
    'startTime',
    'unloadEventEnd',
    'unloadEventStart',
  ];

  assert.strictEqual(entry.entryType, 'navigation');
  for (const timingProp of timingProps) {
    if (browser.capabilities.browserName === 'firefox' &&
        timingProp === 'fetchStart' &&
        entry[timingProp] === -1) {
      // Firefox sometimes reports the fetchStart value as -1
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1429422
      continue;
    }
    assert(entry[timingProp] >= 0);
  }
}

describe('getTTFB()', async function() {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value when run during page load', async function() {
    await browser.url('/test/ttfb');

    const ttfb = await getTTFBBeacon();

    if (browser.capabilities.browserName === 'firefox' && !ttfb) {
      // Skipping test in Firefox due to entry not reported.
      this.skip();
    }

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports the correct value when run after page load', async function() {
    await browser.url('/test/ttfb?awaitLoad=1');

    const ttfb = await getTTFBBeacon();

    if (browser.capabilities.browserName === 'firefox' && !ttfb) {
      // Skipping test in Firefox due to entry not reported.
      this.skip();
    }

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports after a bfcache restore', async function() {
    await browser.url('/test/ttfb');

    const ttfb1 = await getTTFBBeacon();

    if (browser.capabilities.browserName === 'firefox' && !ttfb1) {
      // Skipping test in Firefox due to entry not reported.
      this.skip();
    }

    assert(ttfb1.value >= 0);
    assert(ttfb1.value >= ttfb1.entries[0].requestStart);
    assert(ttfb1.value <= ttfb1.entries[0].loadEventEnd);
    assert(ttfb1.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb1.name, 'TTFB');
    assert.strictEqual(ttfb1.value, ttfb1.delta);
    assert.strictEqual(ttfb1.navigationType, 'navigate');
    assert.strictEqual(ttfb1.entries.length, 1);

    assertValidEntry(ttfb1.entries[0]);

    await clearBeacons();
    await stubForwardBack();

    const ttfb2 = await getTTFBBeacon();

    assert(ttfb2.value >= 0);
    assert(ttfb2.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(ttfb2.name, 'TTFB');
    assert.strictEqual(ttfb2.value, ttfb2.delta);
    assert.strictEqual(ttfb2.navigationType, 'back_forward_cache');
    assert.strictEqual(ttfb2.entries.length, 0);
  });
});

const getTTFBBeacon = async () => {
  // In Firefox, sometimes no TTFB is reported due to negative values.
  // https://github.com/GoogleChrome/web-vitals/issues/137
  if (browser.capabilities.browserName === 'firefox') {
    // In Firefox, wait 1 second after load.
    await afterLoad();
    await browser.pause(1000);
  } else {
    // Otherwise wait until the beacon is received.
    await beaconCountIs(1);
  }
  const [ttfb] = await getBeacons();
  return ttfb;
};
