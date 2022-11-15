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
import {browserSupportsEntry} from '../utils/browserSupportsEntry.js';
import {domReadyState} from '../utils/domReadyState.js';
import {imagesPainted} from '../utils/imagesPainted.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';


describe('onLCP()', async function() {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsLCP;
  before(async function() {
    browserSupportsLCP = await browserSupportsEntry('largest-contentful-paint');
  });

  beforeEach(async function() {
    await clearBeacons();

    // TODO(philipwalton): not sure why this is needed, but it may be related
    // to: https://bugs.chromium.org/p/chromium/issues/detail?id=1034080
    await browser.url('about:blank');
  });

  it('reports the correct value on hidden (reportAllChanges === false)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on hidden (reportAllChanges === true)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(2);
    assertFullReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on input (reportAllChanges === false)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on input (reportAllChanges === true)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(2);
    assertFullReportsAreCorrect(await getBeacons());
  });

  it('accounts for time prerendering the page', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?prerender=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    const activationStart = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].activationStart;
    });

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [lcp] = await getBeacons();
    assert.strictEqual(lcp.rating, 'good');
    assert.strictEqual(lcp.entries[0].startTime - activationStart, lcp.value);
    assert.strictEqual(lcp.navigationType, 'prerender');
  });

  it('does not report if the browser does not support LCP (including bfcache restores)', async function() {
    if (browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Scroll down
    const footer = await $('footer');
    await footer.scrollIntoView();

    // Simulate a tab switch and switch back, which triggers reporting in
    // browsers that support the API.
    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    assert.strictEqual((await getBeacons()).length, 0);

    await clearBeacons();
    await stubForwardBack();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    assert.strictEqual((await getBeacons()).length, 0);
  });

  it('does not report if the document was hidden at page load time', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?hidden=1');
    await domReadyState('interactive');

    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document changes to hidden before the first render', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?renderBlocking=1000');

    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports after a render delay before the page changes to hidden', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?renderBlocking=3000');

    // Change to hidden after the first render.
    await browser.pause(3500);
    await stubVisibilityChange('hidden');

    const [lcp1] = await getBeacons();

    assert(lcp1.value > 3000);
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'needs-improvement');
    assert.strictEqual(lcp1.entries.length, 1);
    assert.strictEqual(lcp1.entries[0].element, 'img');
    assert.match(lcp1.navigationType, /navigate|reload/);
  });

  it('stops reporting after the document changes to hidden (reportAllChanges === false)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?imgDelay=0&imgHidden=1');

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    await browser.execute(() => {
      document.querySelector('img').hidden = false;
    });

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no additional beacons were sent.
    await browser.pause(1000);

    await beaconCountIs(1);

    const [lcp1] = await getBeacons();

    assert(lcp1.value > 0);
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'good');
    assert.strictEqual(lcp1.entries.length, 1);
    assert.strictEqual(lcp1.entries[0].element, 'h1');
    assert.match(lcp1.navigationType, /navigate|reload/);
  });

  it('stops reporting after the document changes to hidden (reportAllChanges === true)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?reportAllChanges=1&imgDelay=0&imgHidden=1');

    await beaconCountIs(1);
    const [lcp] = await getBeacons();

    assert(lcp.value > 0);
    assert.strictEqual(lcp.name, 'LCP');
    assert.strictEqual(lcp.value, lcp.delta);
    assert.strictEqual(lcp.rating, 'good');
    assert.strictEqual(lcp.entries.length, 1);
    assert.strictEqual(lcp.entries[0].element, 'h1');
    assert.match(lcp.navigationType, /navigate|reload/);

    await clearBeacons();
    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    await browser.execute(() => {
      document.querySelector('img').hidden = false;
    });

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports if the page is restored from bfcache', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    const h1 = await $('h1');
    await h1.click();
    await beaconCountIs(1);

    assertStandardReportsAreCorrect(await getBeacons());
    await clearBeacons();

    await stubForwardBack();
    await beaconCountIs(1);

    const [lcp1] = await getBeacons();

    assert(lcp1.value > 0); // Greater than the image load delay.
    assert(lcp1.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'good');
    assert.strictEqual(lcp1.entries.length, 0);
    assert.strictEqual(lcp1.navigationType, 'back-forward-cache');

    await clearBeacons();
    await stubForwardBack();
    await beaconCountIs(1);

    const [lcp2] = await getBeacons();

    assert(lcp2.value > 0); // Greater than the image load delay.
    assert(lcp2.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(lcp2.name, 'LCP');
    assert.strictEqual(lcp2.value, lcp2.delta);
    assert.strictEqual(lcp2.rating, 'good');
    assert.strictEqual(lcp2.entries.length, 0);
    assert.strictEqual(lcp2.navigationType, 'back-forward-cache');
  });

  it('reports if the page is restored from bfcache even when the document was hidden at page load time', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?hidden=1');
    await domReadyState('interactive');

    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);

    await stubForwardBack();
    await beaconCountIs(1);

    const [lcp1] = await getBeacons();

    assert(lcp1.value > 0); // Greater than the image load delay.
    assert(lcp1.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'good');
    assert.strictEqual(lcp1.entries.length, 0);
    assert.strictEqual(lcp1.navigationType, 'back-forward-cache');

    await clearBeacons();
    await stubForwardBack();
    await beaconCountIs(1);

    const [lcp2] = await getBeacons();

    assert(lcp2.value > 0); // Greater than the image load delay.
    assert(lcp2.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(lcp2.name, 'LCP');
    assert.strictEqual(lcp2.value, lcp2.delta);
    assert.strictEqual(lcp2.rating, 'good');
    assert.strictEqual(lcp2.entries.length, 0);
    assert.strictEqual(lcp2.navigationType, 'back-forward-cache');
  });

  it('reports restore as nav type for wasDiscarded', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?wasDiscarded=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [lcp] = await getBeacons();

    assert(lcp.value > 0); // Greater than the image load delay.
    assert(lcp.id.match(/^v3-\d+-\d+$/));
    assert.strictEqual(lcp.name, 'LCP');
    assert.strictEqual(lcp.value, lcp.delta);
    assert.strictEqual(lcp.rating, 'good');
    assert.strictEqual(lcp.entries.length, 1);
    assert.strictEqual(lcp.navigationType, 'restore');
  });

  describe('attribution', function() {
    it('includes attribution data on the metric object', async function() {
      if (!browserSupportsLCP) this.skip();

      await browser.url('/test/lcp?attribution=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].toJSON();
      });

      const lcpResEntry = await browser.execute(() => {
        return performance.getEntriesByType('resource')
            .find((e) => e.name.includes('square.png')).toJSON();
      });

      // Load a new page to trigger the hidden state.
      await browser.url('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();
      assertStandardReportsAreCorrect([lcp]);

      assert(lcp.attribution.url.endsWith('/test/img/square.png?delay=500'));
      assert.equal(lcp.attribution.element, 'html>body>main>p>img');
      assert.equal(lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadTime +
          lcp.attribution.elementRenderDelay, lcp.value);

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.deepEqual(lcp.attribution.lcpResourceEntry, lcpResEntry);
      assert.deepEqual(lcp.attribution.lcpEntry, lcp.entries.slice(-1)[0]);
    });

    it('handles image resources with incomplete timing data', async function() {
      if (!browserSupportsLCP) this.skip();

      await browser.url('/test/lcp?attribution=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].toJSON();
      });

      const lcpResEntry = await browser.execute(() => {
        const entry = performance.getEntriesByType('resource')
            .find((e) => e.name.includes('square.png'));

        // Stub an entry with no `requestStart` data.
        Object.defineProperty(entry, 'requestStart', {value: 0});

        return entry.toJSON();
      });

      // Load a new page to trigger the hidden state.
      await browser.url('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();

      assertStandardReportsAreCorrect([lcp]);

      assert(lcp.attribution.url.endsWith('/test/img/square.png?delay=500'));
      assert.equal(lcp.attribution.element, 'html>body>main>p>img');

      // Specifically check that resourceLoadDelay falls back to `startTime`.
      assert.equal(lcp.attribution.resourceLoadDelay,
          lcpResEntry.startTime - navEntry.responseStart);

      assert.equal(lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadTime +
          lcp.attribution.elementRenderDelay, lcp.value);

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.deepEqual(lcp.attribution.lcpResourceEntry, lcpResEntry);
      assert.deepEqual(lcp.attribution.lcpEntry, lcp.entries.slice(-1)[0]);
    });

    it('accounts for time prerendering the page', async function() {
      if (!browserSupportsLCP) this.skip();

      await browser.url('/test/lcp?attribution=1&prerender=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].toJSON();
      });

      // Since this value is stubbed in the browser, get it separately.
      const activationStart = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].activationStart;
      });

      const lcpResEntry = await browser.execute(() => {
        return performance.getEntriesByType('resource')
            .find((e) => e.name.includes('square.png')).toJSON();
      });

      // Load a new page to trigger the hidden state.
      await browser.url('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();

      assert(lcp.attribution.url.endsWith('/test/img/square.png?delay=500'));
      assert.equal(lcp.navigationType, 'prerender');
      assert.equal(lcp.attribution.element, 'html>body>main>p>img');

      // Assert each individual LCP sub-part accounts for `activationStart`
      assert.equal(lcp.attribution.timeToFirstByte,
          Math.max(0, navEntry.responseStart - activationStart));

      assert.equal(lcp.attribution.resourceLoadDelay,
          Math.max(0, lcpResEntry.requestStart - activationStart) -
          Math.max(0, navEntry.responseStart - activationStart));

      assert.equal(lcp.attribution.resourceLoadTime,
          Math.max(0, lcpResEntry.responseEnd - activationStart) -
          Math.max(0, lcpResEntry.requestStart - activationStart));

      assert.equal(lcp.attribution.elementRenderDelay,
          Math.max(0, lcp.entries[0].startTime - activationStart) -
          Math.max(0, lcpResEntry.responseEnd - activationStart));

      // Assert that they combine to equal LCP.
      assert.equal(lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadTime +
          lcp.attribution.elementRenderDelay, lcp.value);

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.deepEqual(lcp.attribution.lcpResourceEntry, lcpResEntry);
      assert.deepEqual(lcp.attribution.lcpEntry, lcp.entries.slice(-1)[0]);
    });

    it('handles cases where there is no LCP resource', async function() {
      if (!browserSupportsLCP) this.skip();

      await browser.url('/test/lcp?attribution=1&imgHidden=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].toJSON();
      });

      // Load a new page to trigger the hidden state.
      await browser.url('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();

      assert.equal(lcp.attribution.url, undefined);
      assert.equal(lcp.attribution.element, 'html>body>main>h1');
      assert.equal(lcp.attribution.resourceLoadDelay, 0);
      assert.equal(lcp.attribution.resourceLoadTime, 0);
      assert.equal(lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadTime +
          lcp.attribution.elementRenderDelay, lcp.value);

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.equal(lcp.attribution.lcpResourceEntry, undefined);

      // Deep equal won't work since some of the properties are removed before
      // sending to /collect, so just compare some.
      const lcpEntry = lcp.entries.slice(-1)[0];
      assert.equal(lcp.attribution.lcpEntry.element, lcpEntry.element);
      assert.equal(lcp.attribution.lcpEntry.size, lcpEntry.size);
      assert.equal(lcp.attribution.lcpEntry.startTime, lcpEntry.startTime);
    });

    it('reports after a bfcache restore', async function() {
      if (!browserSupportsLCP) this.skip();

      await browser.url('/test/lcp?attribution=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const h1 = await $('h1');
      await h1.click();
      await beaconCountIs(1);

      assertStandardReportsAreCorrect(await getBeacons());
      await clearBeacons();

      await stubForwardBack();
      await beaconCountIs(1);

      const [lcp2] = await getBeacons();

      assert(lcp2.value > 0); // Greater than the image load delay.
      assert(lcp2.id.match(/^v3-\d+-\d+$/));
      assert.strictEqual(lcp2.name, 'LCP');
      assert.strictEqual(lcp2.value, lcp2.delta);
      assert.strictEqual(lcp2.entries.length, 0);
      assert.strictEqual(lcp2.navigationType, 'back-forward-cache');

      assert.equal(lcp2.attribution.element, undefined);
      assert.equal(lcp2.attribution.timeToFirstByte, 0);
      assert.equal(lcp2.attribution.resourceLoadDelay, 0);
      assert.equal(lcp2.attribution.resourceLoadTime, 0);
      assert.equal(lcp2.attribution.elementRenderDelay, lcp2.value);
      assert.equal(lcp2.attribution.navigationEntry, undefined);
      assert.equal(lcp2.attribution.lcpResourceEntry, undefined);
      assert.equal(lcp2.attribution.lcpEntry, undefined);
    });
  });
});

const assertStandardReportsAreCorrect = (beacons) => {
  const [lcp] = beacons;

  assert(lcp.value > 500); // Greater than the image load delay.
  assert(lcp.id.match(/^v3-\d+-\d+$/));
  assert.strictEqual(lcp.name, 'LCP');
  assert.strictEqual(lcp.value, lcp.delta);
  assert.strictEqual(lcp.rating, 'good');
  assert.strictEqual(lcp.entries.length, 1);
  assert.match(lcp.navigationType, /navigate|reload/);
};

const assertFullReportsAreCorrect = (beacons) => {
  const [lcp1, lcp2] = beacons;

  assert(lcp1.value < 500); // Less than the image load delay.
  assert(lcp1.id.match(/^v3-\d+-\d+$/));
  assert.strictEqual(lcp1.name, 'LCP');
  assert.strictEqual(lcp1.value, lcp1.delta);
  assert.strictEqual(lcp1.rating, 'good');
  assert.strictEqual(lcp1.entries.length, 1);
  assert.match(lcp1.navigationType, /navigate|reload/);

  assert(lcp2.value > 500); // Greater than the image load delay.
  assert.strictEqual(lcp2.value, lcp1.value + lcp2.delta);
  assert.strictEqual(lcp2.name, 'LCP');
  assert.strictEqual(lcp2.id, lcp1.id);
  assert.strictEqual(lcp2.rating, 'good');
  assert.strictEqual(lcp2.entries.length, 1);
  assert(lcp2.entries[0].startTime > lcp1.entries[0].startTime);
  assert.match(lcp2.navigationType, /navigate|reload/);
};
