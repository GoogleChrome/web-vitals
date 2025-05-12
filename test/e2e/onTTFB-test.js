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

import assert from 'assert';
import {beaconCountIs, clearBeacons, getBeacons} from '../utils/beacons.js';
import {navigateTo} from '../utils/navigateTo.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';

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
    assert(entry[timingProp] >= 0);
  }
}

describe('onTTFB()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsPrerender;
  before(async function () {
    browserSupportsPrerender = await browser.execute(() => {
      return 'onprerenderingchange' in document;
    });
  });
  beforeEach(async function () {
    // In Safari when navigating to 'about:blank' between tests the
    // Navigation Timing data is consistently negative, so the tests fail.
    if (browser.capabilities.browserName !== 'Safari') {
      await navigateTo('about:blank');
    }
    await clearBeacons();
  });

  it('reports the correct value when run during page load', async function () {
    await navigateTo('/test/ttfb');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.rating, 'good');
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports the correct value event when loaded late', async function () {
    await navigateTo('/test/ttfb?lazyLoad=1');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.rating, 'good');
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports the correct value when the response is delayed', async function () {
    await navigateTo('/test/ttfb?delay=1000');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 1000);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.rating, 'needs-improvement');
    assert.strictEqual(ttfb.navigationType, 'navigate');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('accounts for time prerendering the page', async function () {
    if (!browserSupportsPrerender) this.skip();

    await navigateTo('/test/ttfb?prerender=1');

    await getTTFBBeacon();
    await clearBeacons();

    // Wait a bit to allow the prerender to happen
    await browser.pause(1000);

    const prerenderLink = await $('#prerender-link');
    await prerenderLink.click();

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.rating, 'good');
    assert.strictEqual(ttfb.entries.length, 1);
    assert.strictEqual(ttfb.navigationType, 'prerender');
    assert.strictEqual(
      ttfb.value,
      Math.max(
        0,
        ttfb.entries[0].responseStart - ttfb.entries[0].activationStart,
      ),
    );

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports the correct value when run while prerendering', async function () {
    if (!browserSupportsPrerender) this.skip();

    await navigateTo('/test/ttfb?prerender=1&imgDelay=1000');

    await getTTFBBeacon();
    await clearBeacons();

    // Wait a bit to allow the prerender to happen
    await browser.pause(1000);

    const prerenderLink = await $('#prerender-link');
    await prerenderLink.click();

    const ttfb = await getTTFBBeacon();

    // Assert that prerendering finished after responseStart.
    assert(ttfb.entries[0].activationStart >= ttfb.entries[0].responseStart);

    assert(ttfb.value >= 0);
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.rating, 'good');
    assert.strictEqual(ttfb.entries.length, 1);
    assert.strictEqual(ttfb.navigationType, 'prerender');
    assert.strictEqual(
      ttfb.value,
      Math.max(
        0,
        ttfb.entries[0].responseStart - ttfb.entries[0].activationStart,
      ),
    );

    assertValidEntry(ttfb.entries[0]);
  });

  it('reports after a bfcache restore', async function () {
    await navigateTo('/test/ttfb');

    const ttfb1 = await getTTFBBeacon();

    assert(ttfb1.value >= 0);
    assert(ttfb1.value >= ttfb1.entries[0].requestStart);
    assert(ttfb1.value <= ttfb1.entries[0].loadEventEnd);
    assert(ttfb1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb1.name, 'TTFB');
    assert.strictEqual(ttfb1.rating, 'good');
    assert.strictEqual(ttfb1.value, ttfb1.delta);
    assert.strictEqual(ttfb1.navigationType, 'navigate');
    assert.strictEqual(ttfb1.entries.length, 1);

    assertValidEntry(ttfb1.entries[0]);

    await clearBeacons();
    await stubForwardBack();

    const ttfb2 = await getTTFBBeacon();

    assert(ttfb2.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb2.value, 0);
    assert.strictEqual(ttfb2.name, 'TTFB');
    assert.strictEqual(ttfb2.value, ttfb2.delta);
    assert.strictEqual(ttfb2.rating, 'good');
    assert.strictEqual(ttfb2.navigationType, 'back-forward-cache');
    assert.strictEqual(ttfb2.entries.length, 0);
  });

  it('ignores navigations with invalid responseStart timestamps', async function () {
    for (const rs of [-1, 0, 1e12]) {
      await navigateTo(`/test/ttfb?responseStart=${rs}`, {
        readyState: 'complete',
      });

      // Wait a bit to ensure no beacons were sent.
      await browser.pause(1000);

      const loadBeacons = await getBeacons();
      assert.strictEqual(loadBeacons.length, 0);

      // Test back-forward navigations to ensure they're not sent either
      // in these situations.
      await stubForwardBack();

      // Wait a bit to ensure no beacons were sent.
      await browser.pause(1000);

      const bfcacheBeacons = await getBeacons();
      assert.strictEqual(bfcacheBeacons.length, 0);
    }
  });

  it('reports restore as nav type for wasDiscarded', async function () {
    await navigateTo('/test/ttfb?wasDiscarded=1');

    const ttfb = await getTTFBBeacon();

    assert(ttfb.value >= 0);
    assert(ttfb.value >= ttfb.entries[0].requestStart);
    assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
    assert(ttfb.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb.name, 'TTFB');
    assert.strictEqual(ttfb.value, ttfb.delta);
    assert.strictEqual(ttfb.rating, 'good');
    assert.strictEqual(ttfb.navigationType, 'restore');
    assert.strictEqual(ttfb.entries.length, 1);

    assertValidEntry(ttfb.entries[0]);
  });

  it('works when calling the function twice with different options', async function () {
    await navigateTo('/test/ttfb?doubleCall=1&reportAllChanges2=1');

    await beaconCountIs(1, {instance: 1});
    await beaconCountIs(1, {instance: 2});

    const [ttfb1] = await getBeacons({instance: 1});
    const [ttfb2] = await getBeacons({instance: 2});

    assert(ttfb1.value >= 0);
    assert(ttfb1.value >= ttfb1.entries[0].requestStart);
    assert(ttfb1.value <= ttfb1.entries[0].loadEventEnd);
    assert(ttfb1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(ttfb1.name, 'TTFB');
    assert.strictEqual(ttfb1.value, ttfb1.delta);
    assert.strictEqual(ttfb1.rating, 'good');
    assert.strictEqual(ttfb1.navigationType, 'navigate');
    assert.strictEqual(ttfb1.entries.length, 1);
    assertValidEntry(ttfb1.entries[0]);

    assert(ttfb2.id.match(/^v5-\d+-\d+$/));
    assert(ttfb2.id !== ttfb1.id);
    assert.strictEqual(ttfb2.value, ttfb1.value);
    assert.strictEqual(ttfb2.delta, ttfb1.delta);
    assert.strictEqual(ttfb2.name, ttfb1.name);
    assert.strictEqual(ttfb2.rating, ttfb1.rating);
    assert.deepEqual(ttfb2.entries, ttfb1.entries);
    assert.strictEqual(ttfb2.navigationType, ttfb1.navigationType);
  });

  describe('attribution', function () {
    it('includes attribution data on the metric object', async function () {
      await navigateTo('/test/ttfb?attribution=1');

      const ttfb = await getTTFBBeacon();

      assert(ttfb.value >= 0);
      assert(ttfb.value >= ttfb.entries[0].requestStart);
      assert(ttfb.value <= ttfb.entries[0].loadEventEnd);
      assert(ttfb.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(ttfb.name, 'TTFB');
      assert.strictEqual(ttfb.value, ttfb.delta);
      assert.strictEqual(ttfb.rating, 'good');
      assert.strictEqual(ttfb.navigationType, 'navigate');
      assert.strictEqual(ttfb.entries.length, 1);

      assertValidEntry(ttfb.entries[0]);

      const navEntry = ttfb.entries[0];
      assert.strictEqual(
        ttfb.attribution.waitingDuration,
        navEntry.workerStart || navEntry.fetchStart,
      );
      assert.strictEqual(
        ttfb.attribution.cacheDuration,
        navEntry.domainLookupStart -
          (navEntry.workerStart || navEntry.fetchStart),
      );
      assert.strictEqual(
        ttfb.attribution.dnsDuration,
        navEntry.connectStart - navEntry.domainLookupStart,
      );
      assert.strictEqual(
        ttfb.attribution.connectionDuration,
        navEntry.connectEnd - navEntry.connectStart,
      );
      assert.strictEqual(
        ttfb.attribution.requestDuration,
        navEntry.responseStart - navEntry.connectEnd,
      );

      assert.deepEqual(ttfb.attribution.navigationEntry, navEntry);
    });

    it('accounts for time prerendering the page', async function () {
      if (!browserSupportsPrerender) this.skip();

      await navigateTo('/test/ttfb?prerender=1');

      await getTTFBBeacon();
      await clearBeacons();

      // Wait a bit to allow the prerender to happen
      await browser.pause(1000);

      const prerenderLink = await $('#prerender-link');
      await prerenderLink.click();

      const ttfb = await getTTFBBeacon();

      const activationStart = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].activationStart;
      });

      assert(ttfb.value >= 0);
      assert.strictEqual(ttfb.value, ttfb.delta);
      assert.strictEqual(ttfb.rating, 'good');
      assert.strictEqual(ttfb.entries.length, 1);
      assert.strictEqual(ttfb.navigationType, 'prerender');
      assert.strictEqual(
        ttfb.value,
        Math.max(0, ttfb.entries[0].responseStart - activationStart),
      );

      assertValidEntry(ttfb.entries[0]);

      const navEntry = ttfb.entries[0];
      assert.strictEqual(
        ttfb.attribution.waitingDuration,
        Math.max(
          0,
          (navEntry.workerStart || navEntry.fetchStart) - activationStart,
        ),
      );
      assert.strictEqual(
        ttfb.attribution.cacheDuration,
        Math.max(0, navEntry.domainLookupStart - activationStart) -
          Math.max(
            0,
            (navEntry.workerStart || navEntry.fetchStart) - activationStart,
          ),
      );
      assert.strictEqual(
        ttfb.attribution.dnsDuration,
        Math.max(0, navEntry.connectStart - activationStart) -
          Math.max(0, navEntry.domainLookupStart - activationStart),
      );
      assert.strictEqual(
        ttfb.attribution.connectionDuration,
        Math.max(0, navEntry.connectEnd - activationStart) -
          Math.max(0, navEntry.connectStart - activationStart),
      );
      assert.strictEqual(
        ttfb.attribution.requestDuration,
        Math.max(0, navEntry.responseStart - activationStart) -
          Math.max(0, navEntry.connectEnd - activationStart),
      );

      assert.deepEqual(ttfb.attribution.navigationEntry, navEntry);
    });

    it('reports after a bfcache restore', async function () {
      await navigateTo('/test/ttfb?attribution=1');

      await getTTFBBeacon();

      await clearBeacons();
      await stubForwardBack();

      await beaconCountIs(1);

      const ttfb = await getTTFBBeacon();

      assert(ttfb.value >= 0);
      assert(ttfb.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(ttfb.name, 'TTFB');
      assert.strictEqual(ttfb.value, ttfb.delta);
      assert.strictEqual(ttfb.rating, 'good');
      assert.strictEqual(ttfb.navigationType, 'back-forward-cache');
      assert.strictEqual(ttfb.entries.length, 0);

      assert.strictEqual(ttfb.attribution.waitingDuration, 0);
      assert.strictEqual(ttfb.attribution.cacheDuration, 0);
      assert.strictEqual(ttfb.attribution.dnsDuration, 0);
      assert.strictEqual(ttfb.attribution.connectionDuration, 0);
      assert.strictEqual(ttfb.attribution.requestDuration, 0);
      assert.strictEqual(ttfb.attribution.navigationEntry, undefined);
    });

    it('reports the correct value for Early Hints', async function () {
      await navigateTo('/test/ttfb?earlyHintsDelay=50&attribution=1');

      const ttfb = await getTTFBBeacon();

      if ('finalResponseHeadersStart' in ttfb.attribution.navigationEntry) {
        assert.strictEqual(
          ttfb.value,
          ttfb.attribution.navigationEntry.responseStart,
        );
        assert.strictEqual(
          ttfb.value,
          ttfb.attribution.navigationEntry.firstInterimResponseStart,
        );
        assert(
          ttfb.value <
            ttfb.attribution.navigationEntry.finalResponseHeadersStart,
        );
      } else {
        assert.strictEqual(
          ttfb.value,
          ttfb.attribution.navigationEntry.responseStart,
        );
      }
    });
  });
});

const getTTFBBeacon = async () => {
  await beaconCountIs(1);
  const [ttfb] = await getBeacons();
  return ttfb;
};
