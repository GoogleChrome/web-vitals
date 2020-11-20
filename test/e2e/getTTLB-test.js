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
const {beaconCountIs, clearBeacons, getBeacons} = require('../utils/beacons.js');


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
    if (!(entry[timingProp] >= 0)) {
      console.log(timingProp, entry[timingProp]);
    }

    assert(entry[timingProp] >= 0);
  }
}

describe('getTTLB()', async function() {
  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value when run during page load', async function() {
    await browser.url('/test/ttlb');

    await beaconCountIs(1);

    const [ttlb] = await getBeacons();

    assert(ttlb.value >= 0);
    assert(ttlb.value >= ttlb.entries[0].responseEnd);
    assert(ttlb.value <= ttlb.entries[0].loadEventEnd);
    assert(ttlb.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(ttlb.name, 'TTLB');
    assert.strictEqual(ttlb.value, ttlb.delta);
    assert.strictEqual(ttlb.entries.length, 1);

    assertValidEntry(ttlb.entries[0]);
  });

  it('reports the correct value when run after page load', async function() {
    await browser.url('/test/ttlb?awaitLoad=1');

    await beaconCountIs(1);

    const [ttlb] = await getBeacons();

    assert(ttlb.value >= 0);
    assert(ttlb.value >= ttlb.entries[0].responseEnd);
    assert(ttlb.value <= ttlb.entries[0].loadEventEnd);
    assert(ttlb.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(ttlb.name, 'TTLB');
    assert.strictEqual(ttlb.value, ttlb.delta);
    assert.strictEqual(ttlb.entries.length, 1);

    assertValidEntry(ttlb.entries[0]);
  });
});
