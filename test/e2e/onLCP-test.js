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
import {firstContentfulPaint} from '../utils/firstContentfulPaint.js';
import {imagesPainted} from '../utils/imagesPainted.js';
import {navigateTo} from '../utils/navigateTo.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';
import {webVitalsLoaded} from '../utils/webVitalsLoaded.js';

describe('onLCP()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsLCP;
  let browserSupportsVisibilityState;
  let browserSupportsPrerender;
  before(async function () {
    browserSupportsLCP = await browserSupportsEntry('largest-contentful-paint');
    browserSupportsVisibilityState =
      await browserSupportsEntry('visibility-state');
    browserSupportsPrerender = await browser.execute(() => {
      return 'onprerenderingchange' in document;
    });
  });

  beforeEach(async function () {
    await navigateTo('about:blank');
    await clearBeacons();
  });

  it('reports the correct value on hidden (reportAllChanges === false)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await navigateTo('about:blank');

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on hidden (reportAllChanges === true)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await navigateTo('about:blank');

    await beaconCountIs(2);
    assertFullReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on input (reportAllChanges === false)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on input (reportAllChanges === true)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(2);
    assertFullReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value when loaded late (reportAllChanges === false)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?lazyLoad=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await navigateTo('about:blank');

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value when loaded late (reportAllChanges === true)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?lazyLoad=1&reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    await beaconCountIs(2);
    const beacons = await getBeacons();
    // Firefox sometimes sents <p>, then <h1>
    // so grab last two
    await browser.pause(500);
    assert(beacons.length >= 2);
    const lcp1 = beacons.at(-2);
    const lcp2 = beacons.at(-1);

    assert(lcp1.value > 0);
    assert(lcp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'good');
    assert.strictEqual(lcp1.entries.length, 1);
    assert.strictEqual(lcp1.navigationType, 'navigate');

    assert(lcp2.value > 500); // Greater than the image load delay.
    assert(lcp2.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp2.name, 'LCP');
    assert(lcp2.value > lcp2.delta);
    assert.strictEqual(lcp2.rating, 'good');
    assert.strictEqual(lcp2.entries.length, 1);
    assert.strictEqual(lcp2.navigationType, 'navigate');
  });

  it('accounts for time prerendering the page', async function () {
    if (!browserSupportsLCP) this.skip();
    if (!browserSupportsPrerender) this.skip();

    await navigateTo('/test/lcp?prerender=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Wait until web-vitals is loaded
    await webVitalsLoaded();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);
    await clearBeacons();

    // Wait a bit to allow the prerender to happen
    await browser.pause(1000);

    const prerenderLink = await $('#prerender-link');
    await prerenderLink.click();

    // Wait a bit for the navigation to start
    await browser.pause(500);

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    const activationStart = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].activationStart;
    });

    // Load a new page to trigger the hidden state.
    await navigateTo('about:blank');

    await beaconCountIs(1);

    const [lcp] = await getBeacons();
    assert.strictEqual(lcp.rating, 'good');
    assert.strictEqual(lcp.entries[0].startTime - activationStart, lcp.value);
    assert.strictEqual(lcp.navigationType, 'prerender');
    await clearBeacons();
  });

  it('does not report if the browser does not support LCP (including bfcache restores)', async function () {
    if (browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // New tab switch and switch back, which triggers reporting in
    // browsers that support the API.
    await switchToNewTabAndBack();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    assert.strictEqual((await getBeacons()).length, 0);

    await clearBeacons();
    await stubForwardBack();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    assert.strictEqual((await getBeacons()).length, 0);
  });

  it('does not report if the document was hidden at page load time', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?hidden=1', {readyState: 'interactive'});

    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if hidden before library loaded and visibility-state supported', async function () {
    if (!browserSupportsLCP) this.skip();
    if (!browserSupportsVisibilityState) this.skip();

    // Don't load the library until we click
    await navigateTo('/test/lcp?loadAfterInput=1&renderBlocking=400');

    // Immediately switch tab
    await switchToNewTabAndBack();

    // Click on the h1 to load the library
    const h1 = await $('h1');
    await h1.click();

    // Wait until web-vitals is loaded
    await webVitalsLoaded();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    // Click on the h1 again now it's loaded to trigger LCP
    await h1.click();

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does report if hidden before library loaded and visibility-state not supported', async function () {
    if (!browserSupportsLCP) this.skip();
    if (browserSupportsVisibilityState) this.skip();

    // Don't load the library until we click
    await navigateTo('/test/lcp?loadAfterInput=1&renderBlocking=400');
    await switchToNewTabAndBack();

    // Click on the h1 to load the library
    const h1 = await $('h1');
    await h1.click();

    // Wait until web-vitals is loaded
    await webVitalsLoaded();

    // Click on the h1 again now it's loaded to trigger LCP
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('does not report if the document changes to hidden before the first render', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?renderBlocking=1000');

    await switchToNewTabAndBack();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports after a render delay before the page changes to hidden', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?renderBlocking=3000');

    // Change to hidden after the first render.
    await browser.pause(3500);
    await switchToNewTabAndBack();

    const [lcp1] = await getBeacons();

    assert(lcp1.value > 3000);
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'needs-improvement');
    assert.strictEqual(lcp1.entries.length, 1);
    assert.strictEqual(lcp1.entries[0].element, '[object HTMLImageElement]');
    assert.match(lcp1.navigationType, /navigate|reload/);
  });

  it('stops reporting after the document changes to hidden (reportAllChanges === false)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?imgDelay=0&imgHidden=1', {
      readyState: 'interactive',
    });

    // Wait until the library is loaded and the first paint occurs to ensure
    // that an LCP entry can be dispatched prior to the document changing to
    // hidden.
    await webVitalsLoaded();
    await firstContentfulPaint();

    await switchToNewTabAndBack();

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
    assert.strictEqual(lcp1.entries[0].element, '[object HTMLHeadingElement]');
    assert.match(lcp1.navigationType, /navigate|reload/);
  });

  it('stops reporting after the document changes to hidden (reportAllChanges === true)', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?reportAllChanges=1&imgDelay=0&imgHidden=1');

    await beaconCountIs(1);
    // Firefox sometimes sends a <p> and then <h1> beacon, so grab last one
    await browser.pause(1000);
    let beacons = await getBeacons();
    const lcp = beacons.at(-1);

    assert(lcp.value > 0);
    assert.strictEqual(lcp.name, 'LCP');
    assert.strictEqual(lcp.value, lcp.delta);
    assert.strictEqual(lcp.rating, 'good');
    assert.strictEqual(lcp.entries.length, 1);
    assert.strictEqual(lcp.entries[0].element, '[object HTMLHeadingElement]');
    assert.match(lcp.navigationType, /navigate|reload/);

    await clearBeacons();
    await switchToNewTabAndBack();

    await browser.execute(() => {
      document.querySelector('img').hidden = false;
    });

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports if the page is restored from bfcache', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp');

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

    assert(lcp1.value > 0);
    assert(lcp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'good');
    assert.strictEqual(lcp1.entries.length, 0);
    assert.strictEqual(lcp1.navigationType, 'back-forward-cache');

    await clearBeacons();
    await stubForwardBack();
    await beaconCountIs(1);

    const [lcp2] = await getBeacons();

    assert(lcp2.value > 0);
    assert(lcp2.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp2.name, 'LCP');
    assert.strictEqual(lcp2.value, lcp2.delta);
    assert.strictEqual(lcp2.rating, 'good');
    assert.strictEqual(lcp2.entries.length, 0);
    assert.strictEqual(lcp2.navigationType, 'back-forward-cache');
  });

  it('reports if the page is restored from bfcache even when the document was hidden at page load time', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?hidden=1', {readyState: 'interactive'});

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

    assert(lcp1.value > 0);
    assert(lcp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.rating, 'good');
    assert.strictEqual(lcp1.entries.length, 0);
    assert.strictEqual(lcp1.navigationType, 'back-forward-cache');

    await clearBeacons();
    await stubForwardBack();
    await beaconCountIs(1);

    const [lcp2] = await getBeacons();

    assert(lcp2.value > 0);
    assert(lcp2.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp2.name, 'LCP');
    assert.strictEqual(lcp2.value, lcp2.delta);
    assert.strictEqual(lcp2.rating, 'good');
    assert.strictEqual(lcp2.entries.length, 0);
    assert.strictEqual(lcp2.navigationType, 'back-forward-cache');
  });

  it('reports restore as nav type for wasDiscarded', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?wasDiscarded=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await navigateTo('about:blank');

    await beaconCountIs(1);

    const [lcp] = await getBeacons();

    assert(lcp.value > 0);
    assert(lcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(lcp.name, 'LCP');
    assert.strictEqual(lcp.value, lcp.delta);
    assert.strictEqual(lcp.rating, 'good');
    assert.strictEqual(lcp.entries.length, 1);
    assert.strictEqual(lcp.navigationType, 'restore');
  });

  it('works when calling the function twice with different options', async function () {
    if (!browserSupportsLCP) this.skip();

    await navigateTo('/test/lcp?doubleCall=1&reportAllChanges2=1');

    await beaconCountIs(2, {instance: 2});

    const beacons2 = await getBeacons({instance: 2});
    assertFullReportsAreCorrect(beacons2);

    assert.strictEqual((await getBeacons({instance: 1})).length, 0);

    // Load a new page to trigger the hidden state.
    await navigateTo('about:blank');

    await beaconCountIs(1, {instance: 1});

    const beacons1 = await getBeacons({instance: 1});
    assertStandardReportsAreCorrect(beacons1);

    assert(beacons1[0].id !== beacons2[0].id);
    assert(beacons1[0].id !== beacons2[1].id);
    assert.deepEqual(beacons1[0].entries, beacons2[1].entries);
  });

  describe('attribution', function () {
    it('includes attribution data on the metric object', async function () {
      if (!browserSupportsLCP) this.skip();

      await navigateTo('/test/lcp?attribution=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return __toSafeObject(performance.getEntriesByType('navigation')[0]);
      });

      const lcpResEntry = await browser.execute(() => {
        return performance
          .getEntriesByType('resource')
          .find((e) => e.name.includes('square.png'))
          .toJSON();
      });

      // Load a new page to trigger the hidden state.
      await navigateTo('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();
      assertStandardReportsAreCorrect([lcp]);

      assert(lcp.attribution.url.endsWith('/test/img/square.png?delay=500'));
      assert.equal(lcp.attribution.target, 'html>body>main>p>img.bar.foo');
      assert.equal(
        lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadDuration +
          lcp.attribution.elementRenderDelay,
        lcp.value,
      );

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.deepEqual(lcp.attribution.lcpResourceEntry, lcpResEntry);
      assert.deepEqual(lcp.attribution.lcpEntry, lcp.entries.slice(-1)[0]);
    });

    it('supports generating a custom target', async function () {
      if (!browserSupportsLCP) this.skip();

      await navigateTo('/test/lcp?attribution=1&generateTarget=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      // Load a new page to trigger the hidden state.
      await navigateTo('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();
      assertStandardReportsAreCorrect([lcp]);

      assert.equal(lcp.attribution.target, 'main-image');
    });

    it('supports multiple calls with different custom target generation functions', async function () {
      if (!browserSupportsLCP) this.skip();

      await navigateTo(
        '/test/lcp?attribution=1&doubleCall=1&generateTarget2=1',
      );

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      // Load a new page to trigger the hidden state.
      await navigateTo('about:blank');

      await beaconCountIs(1, {instance: 1});
      await beaconCountIs(1, {instance: 2});

      const [lcp1] = await getBeacons({instance: 1});
      assertStandardReportsAreCorrect([lcp1]);

      assert.equal(lcp1.attribution.target, 'html>body>main>p>img.bar.foo');

      const [lcp2] = await getBeacons({instance: 2});
      assertStandardReportsAreCorrect([lcp2]);

      assert.equal(lcp2.attribution.target, 'main-image');
    });

    it('handles image resources with incomplete timing data', async function () {
      if (!browserSupportsLCP) this.skip();

      await navigateTo('/test/lcp?attribution=1');

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return __toSafeObject(performance.getEntriesByType('navigation')[0]);
      });

      const lcpResEntry = await browser.execute(() => {
        const entry = performance
          .getEntriesByType('resource')
          .find((e) => e.name.includes('square.png'));

        // Stub an entry with no `requestStart` data.
        Object.defineProperty(entry, 'requestStart', {
          value: 0,
          enumerable: true,
        });

        return __toSafeObject(entry);
      });

      // Load a new page to trigger the hidden state.
      await navigateTo('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();

      assertStandardReportsAreCorrect([lcp]);

      assert(lcp.attribution.url.endsWith('/test/img/square.png?delay=500'));
      assert.equal(lcp.attribution.target, 'html>body>main>p>img.bar.foo');

      // Specifically check that resourceLoadDelay falls back to `startTime`.
      assert.equal(
        lcp.attribution.resourceLoadDelay,
        lcpResEntry.startTime - navEntry.responseStart,
      );

      assert.equal(
        lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadDuration +
          lcp.attribution.elementRenderDelay,
        lcp.value,
      );

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.deepEqual(lcp.attribution.lcpResourceEntry, lcpResEntry);
      assert.deepEqual(lcp.attribution.lcpEntry, lcp.entries.slice(-1)[0]);
    });

    it('accounts for time prerendering the page', async function () {
      if (!browserSupportsLCP) this.skip();
      if (!browserSupportsPrerender) this.skip();

      await navigateTo('/test/lcp?attribution=1&prerender=1');

      // Wait until web-vitals is loaded
      await webVitalsLoaded();

      // Click on the h1.
      const h1 = await $('h1');
      await h1.click();

      await beaconCountIs(1);
      await clearBeacons();

      // Wait a bit to allow the prerender to happen
      await browser.pause(1000);

      const prerenderLink = await $('#prerender-link');
      await prerenderLink.click();

      // Wait a bit for the navigation to start
      await browser.pause(500);

      // Wait until all images are loaded and fully rendered.
      await imagesPainted();

      const navEntry = await browser.execute(() => {
        return __toSafeObject(performance.getEntriesByType('navigation')[0]);
      });

      const lcpResEntry = await browser.execute(() => {
        return __toSafeObject(
          performance
            .getEntriesByType('resource')
            .find((e) => e.name.includes('square.png')),
        );
      });

      // Load a new page to trigger the hidden state.
      await navigateTo('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();

      assert(lcp.attribution.url.endsWith('/test/img/square.png?delay=500'));
      assert.equal(lcp.navigationType, 'prerender');
      assert.equal(lcp.attribution.target, 'html>body>main>p>img.bar.foo');

      // Assert each individual LCP subpart accounts for `activationStart`
      assert.equal(
        lcp.attribution.timeToFirstByte,
        Math.max(0, navEntry.responseStart - navEntry.activationStart),
      );

      assert.equal(
        lcp.attribution.resourceLoadDelay,
        Math.max(0, lcpResEntry.requestStart - navEntry.activationStart) -
          Math.max(0, navEntry.responseStart - navEntry.activationStart),
      );

      assert.equal(
        lcp.attribution.resourceLoadDuration,
        Math.max(0, lcpResEntry.responseEnd - navEntry.activationStart) -
          Math.max(0, lcpResEntry.requestStart - navEntry.activationStart),
      );

      assert.equal(
        lcp.attribution.elementRenderDelay,
        Math.max(0, lcp.entries[0].startTime - navEntry.activationStart) -
          Math.max(0, lcpResEntry.responseEnd - navEntry.activationStart),
      );

      // Assert that they combine to equal LCP.
      assert.equal(
        lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadDuration +
          lcp.attribution.elementRenderDelay,
        lcp.value,
      );

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.deepEqual(lcp.attribution.lcpResourceEntry, lcpResEntry);
      assert.deepEqual(lcp.attribution.lcpEntry, lcp.entries.at(-1));
    });

    it('handles cases where there is no LCP resource', async function () {
      if (!browserSupportsLCP) this.skip();

      await navigateTo('/test/lcp?attribution=1&imgHidden=1', {
        readyState: 'complete',
      });

      const navEntry = await browser.execute(() => {
        return __toSafeObject(performance.getEntriesByType('navigation')[0]);
      });

      // Load a new page to trigger the hidden state.
      await navigateTo('about:blank');

      await beaconCountIs(1);

      const [lcp] = await getBeacons();

      assert.equal(lcp.attribution.url, undefined);
      assert.equal(lcp.attribution.target, 'html>body>main>h1');
      assert.equal(lcp.attribution.resourceLoadDelay, 0);
      assert.equal(lcp.attribution.resourceLoadDuration, 0);
      assert.equal(
        lcp.attribution.timeToFirstByte +
          lcp.attribution.resourceLoadDelay +
          lcp.attribution.resourceLoadDuration +
          lcp.attribution.elementRenderDelay,
        lcp.value,
      );

      assert.deepEqual(lcp.attribution.navigationEntry, navEntry);
      assert.equal(lcp.attribution.lcpResourceEntry, undefined);

      // Deep equal won't work since some of the properties are removed before
      // sending to /collect, so just compare some.
      const lcpEntry = lcp.entries.slice(-1)[0];
      assert.equal(lcp.attribution.lcpEntry.element, lcpEntry.element);
      assert.equal(lcp.attribution.lcpEntry.size, lcpEntry.size);
      assert.equal(lcp.attribution.lcpEntry.startTime, lcpEntry.startTime);
    });

    it('reports after a bfcache restore', async function () {
      if (!browserSupportsLCP) this.skip();

      await navigateTo('/test/lcp?attribution=1');

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

      assert(lcp2.value > 0);
      assert(lcp2.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(lcp2.name, 'LCP');
      assert.strictEqual(lcp2.value, lcp2.delta);
      assert.strictEqual(lcp2.entries.length, 0);
      assert.strictEqual(lcp2.navigationType, 'back-forward-cache');

      assert.equal(lcp2.attribution.target, undefined);
      assert.equal(lcp2.attribution.timeToFirstByte, 0);
      assert.equal(lcp2.attribution.resourceLoadDelay, 0);
      assert.equal(lcp2.attribution.resourceLoadDuration, 0);
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
  assert(lcp.id.match(/^v5-\d+-\d+$/));
  assert.strictEqual(lcp.name, 'LCP');
  assert.strictEqual(lcp.value, lcp.delta);
  assert.strictEqual(lcp.rating, 'good');
  assert.strictEqual(lcp.entries.length, 1);
  assert.match(lcp.navigationType, /navigate|reload/);
};

const assertFullReportsAreCorrect = (beacons) => {
  // Firefox sometimes sends <p>, then <h1>
  // so grab last two
  assert(beacons.length >= 2);
  const lcp1 = beacons.at(-2);
  const lcp2 = beacons.at(-1);

  assert(lcp1.value < 500); // Less than the image load delay.
  assert(lcp1.id.match(/^v5-\d+-\d+$/));
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

const switchToNewTabAndBack = async () => {
  // Switch to a blank tab and back
  const handle1 = await browser.getWindowHandle();
  await browser.newWindow('https://example.com');
  await browser.pause(500);
  await browser.closeWindow();
  await browser.switchToWindow(handle1);
};
