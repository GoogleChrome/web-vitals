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
import {navigateTo} from '../utils/navigateTo.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';
import {webVitalsLoaded} from '../utils/webVitalsLoaded.js';

describe('onFCP()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsFCP;
  let browserSupportsPrerender;
  let browserSupportsSoftNavs;
  before(async function () {
    browserSupportsFCP = await browserSupportsEntry('paint');
    browserSupportsPrerender = await browser.execute(() => {
      return 'onprerenderingchange' in document;
    });
    browserSupportsSoftNavs = await browser.execute(() => {
      return PerformanceObserver.supportedEntryTypes.includes(
        'soft-navigation',
      );
    });
  });

  beforeEach(async function () {
    await navigateTo('about:blank');
    await clearBeacons();
  });

  it('reports the correct value after the first paint', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp');

    await beaconCountIs(1);

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.match(fcp.navigationType, /navigate|reload/);
  });

  it('reports the correct value when loaded late', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?lazyLoad=1');

    await beaconCountIs(1);

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.match(fcp.navigationType, /navigate|reload/);
  });

  it('accounts for time prerendering the page', async function () {
    if (!browserSupportsFCP) this.skip();
    if (!browserSupportsPrerender) this.skip();

    await navigateTo('/test/fcp?prerender=1');

    await beaconCountIs(1);
    await clearBeacons();

    // Wait a bit to allow the prerender to happen
    await browser.pause(1000);

    const prerenderLink = await $('#prerender-link');
    await prerenderLink.click();

    await beaconCountIs(1);
    const [fcp] = await getBeacons();

    const activationStart = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].activationStart;
    });

    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.strictEqual(fcp.entries[0].startTime - activationStart, fcp.value);
    assert.strictEqual(fcp.navigationType, 'prerender');
  });

  it('does not report if the browser does not support FCP (including bfcache restores)', async function () {
    if (browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const loadBeacons = await getBeacons();
    assert.strictEqual(loadBeacons.length, 0);

    await clearBeacons();
    await stubForwardBack();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const bfcacheRestoreBeacons = await getBeacons();
    assert.strictEqual(bfcacheRestoreBeacons.length, 0);
  });

  it('does not report if the document was hidden at page load time', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?hidden=1', {readyState: 'complete'});

    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document changes to hidden before the first entry', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?invisible=1', {readyState: 'interactive'});

    await stubVisibilityChange('hidden');
    await webVitalsLoaded();
    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports after a render delay before the page changes to hidden', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?renderBlocking=2000');

    // Change to hidden after the first render.
    await browser.pause(2500);
    await stubVisibilityChange('hidden');

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'needs-improvement');
    assert.strictEqual(fcp.entries.length, 1);
    assert.match(fcp.navigationType, /navigate|reload/);
  });

  it('reports if the page is restored from bfcache', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp');

    await beaconCountIs(1);

    const [fcp1] = await getBeacons();
    assert(fcp1.value >= 0);
    assert(fcp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp1.name, 'FCP');
    assert.strictEqual(fcp1.value, fcp1.delta);
    assert.strictEqual(fcp1.rating, 'good');
    assert.strictEqual(fcp1.entries.length, 1);
    assert.match(fcp1.navigationType, /navigate|reload/);

    await clearBeacons();
    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp2] = await getBeacons();
    assert(fcp2.value >= 0);
    assert(fcp2.id.match(/^v5-\d+-\d+$/));
    assert(fcp2.id !== fcp1.id);
    assert.strictEqual(fcp2.name, 'FCP');
    assert.strictEqual(fcp2.value, fcp2.delta);
    assert.strictEqual(fcp2.rating, 'good');
    assert.strictEqual(fcp2.entries.length, 0);
    assert.strictEqual(fcp2.navigationType, 'back-forward-cache');

    await clearBeacons();
    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp3] = await getBeacons();
    assert(fcp3.value >= 0);
    assert(fcp3.id.match(/^v5-\d+-\d+$/));
    assert(fcp3.id !== fcp2.id);
    assert.strictEqual(fcp3.name, 'FCP');
    assert.strictEqual(fcp3.value, fcp3.delta);
    assert.strictEqual(fcp3.rating, 'good');
    assert.strictEqual(fcp3.entries.length, 0);
    assert.strictEqual(fcp3.navigationType, 'back-forward-cache');
  });

  it('reports if the page is restored from bfcache even when the document was hidden at page load time', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?hidden=1', {readyState: 'interactive'});

    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);

    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp1] = await getBeacons();
    assert(fcp1.value >= 0);
    assert(fcp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp1.name, 'FCP');
    assert.strictEqual(fcp1.value, fcp1.delta);
    assert.strictEqual(fcp1.rating, 'good');
    assert.strictEqual(fcp1.entries.length, 0);
    assert.strictEqual(fcp1.navigationType, 'back-forward-cache');

    await clearBeacons();
    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp2] = await getBeacons();
    assert(fcp2.value >= 0);
    assert(fcp2.id.match(/^v5-\d+-\d+$/));
    assert(fcp2.id !== fcp1.id);
    assert.strictEqual(fcp2.name, 'FCP');
    assert.strictEqual(fcp2.value, fcp2.delta);
    assert.strictEqual(fcp2.rating, 'good');
    assert.strictEqual(fcp2.entries.length, 0);
    assert.strictEqual(fcp2.navigationType, 'back-forward-cache');
  });

  it('reports restore as nav type for wasDiscarded', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?wasDiscarded=1');

    await beaconCountIs(1);

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.strictEqual(fcp.navigationType, 'restore');
  });

  it('works when calling the function twice with different options', async function () {
    if (!browserSupportsFCP) this.skip();

    await navigateTo('/test/fcp?doubleCall=1&reportAllChanges2=1');

    await beaconCountIs(1, {instance: 1});
    await beaconCountIs(1, {instance: 2});

    const [fcp1] = await getBeacons({instance: 1});
    const [fcp2] = await getBeacons({instance: 2});

    assert(fcp1.value >= 0);
    assert(fcp1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp1.name, 'FCP');
    assert.strictEqual(fcp1.value, fcp1.delta);
    assert.strictEqual(fcp1.rating, 'good');
    assert.strictEqual(fcp1.entries.length, 1);
    assert.match(fcp1.navigationType, /navigate|reload/);

    assert(fcp2.id.match(/^v5-\d+-\d+$/));
    assert(fcp2.id !== fcp1.id);
    assert.strictEqual(fcp2.value, fcp1.value);
    assert.strictEqual(fcp2.delta, fcp1.delta);
    assert.strictEqual(fcp2.name, fcp1.name);
    assert.strictEqual(fcp2.rating, fcp1.rating);
    assert.deepEqual(fcp2.entries, fcp1.entries);
    assert.strictEqual(fcp2.navigationType, fcp1.navigationType);
  });

  it('reports hard nav FCP and soft navs (reportAllChanges === false)', async function () {
    if (!browserSupportsFCP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/fcp?reportSoftNavs=1');

    await beaconCountIs(1);

    const hardNavId = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].navigationId;
    });

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.match(fcp.navigationType, /navigate|reload/);
    assert.strictEqual(fcp.navigationId, hardNavId);

    // clear the beacons
    await clearBeacons();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await simulateUserLikeClick(softNavButton);

    await beaconCountIs(1);

    const [softFcp] = await getBeacons();
    assert(softFcp.value >= 0);
    assert(softFcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softFcp.name, 'FCP');
    assert.strictEqual(softFcp.value, softFcp.delta);
    assert.strictEqual(softFcp.rating, 'good');
    assert.strictEqual(softFcp.entries.length, 0);
    assert.strictEqual(softFcp.navigationType, 'soft-navigation');
    assert(softFcp.navigationId > hardNavId);
  });

  it('reports hard nav FCP and soft navs (reportAllChanges === true)', async function () {
    if (!browserSupportsFCP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/fcp?reportSoftNavs=1&reportAllChanges=1');

    await beaconCountIs(1);

    const hardNavId = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].navigationId;
    });

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.match(fcp.navigationType, /navigate|reload/);
    assert.strictEqual(fcp.navigationId, hardNavId);

    // clear the beacons
    await clearBeacons();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await simulateUserLikeClick(softNavButton);

    await beaconCountIs(1);

    const [softFcp] = await getBeacons();
    assert(softFcp.value >= 0);
    assert(softFcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softFcp.name, 'FCP');
    assert.strictEqual(softFcp.value, softFcp.delta);
    assert.strictEqual(softFcp.rating, 'good');
    assert.strictEqual(softFcp.entries.length, 0);
    assert.strictEqual(softFcp.navigationType, 'soft-navigation');
    assert(softFcp.navigationId > hardNavId);
  });

  it('reports soft navs when loaded late (reportAllChanges === false)', async function () {
    if (!browserSupportsFCP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/fcp?reportSoftNavs=1&loadAfterInput=1');

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await simulateUserLikeClick(softNavButton);

    await beaconCountIs(2, {instance: 'All'});

    const hardNavId = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].navigationId;
    });

    const [fcp, softFcp] = await getBeacons({instance: 'All'});
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.rating, 'good');
    assert.strictEqual(fcp.entries.length, 1);
    assert.match(fcp.navigationType, /navigate|reload/);

    assert(softFcp.value >= 0);
    assert(softFcp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(softFcp.name, 'FCP');
    assert.strictEqual(softFcp.value, softFcp.delta);
    assert.strictEqual(softFcp.rating, 'good');
    assert.strictEqual(softFcp.entries.length, 0);
    assert.strictEqual(softFcp.navigationType, 'soft-navigation');
    assert(softFcp.navigationId > hardNavId);
  });

  it('works when calling the function twice with reportSoftNavs=1 and reportSoftNavs2=0', async function () {
    if (!browserSupportsFCP || !browserSupportsSoftNavs) this.skip();

    await navigateTo(
      '/test/fcp?doubleCall=1&reportSoftNavs=1&reportSoftNavs2=0',
    );

    await beaconCountIs(1, {instance: 1});
    await beaconCountIs(1, {instance: 2});

    const [fcp1] = await getBeacons({instance: 1});
    const [fcp2] = await getBeacons({instance: 2});

    assert(fcp1.value >= 0);
    assert.strictEqual(fcp1.name, 'FCP');
    assert(fcp2.value >= 0);
    assert.strictEqual(fcp2.name, 'FCP');

    await clearBeacons();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await simulateUserLikeClick(softNavButton);

    // Instance 1 should report, but instance 2 should not.
    await beaconCountIs(1, {instance: 1});

    const [softFcp1] = await getBeacons({instance: 1});
    assert(softFcp1.value >= 0);
    assert.strictEqual(softFcp1.name, 'FCP');
    assert.strictEqual(softFcp1.navigationType, 'soft-navigation');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);
    const beacons = await getBeacons({instance: 2});
    assert.strictEqual(beacons.length, 0);
  });

  it('works when calling the function twice with reportSoftNavs=1 and default for 2', async function () {
    if (!browserSupportsFCP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/fcp?doubleCall=1&reportSoftNavs=1');

    await beaconCountIs(1, {instance: 1});
    await beaconCountIs(1, {instance: 2});

    const [fcp1] = await getBeacons({instance: 1});
    const [fcp2] = await getBeacons({instance: 2});

    assert(fcp1.value >= 0);
    assert.strictEqual(fcp1.name, 'FCP');
    assert(fcp2.value >= 0);
    assert.strictEqual(fcp2.name, 'FCP');

    await clearBeacons();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await simulateUserLikeClick(softNavButton);

    // Instance 1 should report, but instance 2 should not.
    await beaconCountIs(1, {instance: 1});

    const [softFcp1] = await getBeacons({instance: 1});
    assert(softFcp1.value >= 0);
    assert.strictEqual(softFcp1.name, 'FCP');
    assert.strictEqual(softFcp1.navigationType, 'soft-navigation');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);
    const beacons = await getBeacons({instance: 2});
    assert.strictEqual(beacons.length, 0);
  });

  describe('attribution', function () {
    it('includes attribution data on the metric object', async function () {
      if (!browserSupportsFCP) this.skip();

      await navigateTo('/test/fcp?attribution=1', {readyState: 'complete'});

      await beaconCountIs(1);

      const navEntry = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].toJSON();
      });
      const fcpEntry = await browser.execute(() => {
        return performance
          .getEntriesByName('first-contentful-paint')[0]
          .toJSON();
      });

      const [fcp] = await getBeacons();

      assert(fcp.value >= 0);
      assert(fcp.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(fcp.name, 'FCP');
      assert.strictEqual(fcp.value, fcp.delta);
      assert.strictEqual(fcp.rating, 'good');
      assert.strictEqual(fcp.entries.length, 1);
      assert.match(fcp.navigationType, /navigate|reload/);

      assert.equal(fcp.attribution.timeToFirstByte, navEntry.responseStart);
      assert.equal(
        fcp.attribution.firstByteToFCP,
        fcp.value - navEntry.responseStart,
      );
      assert.match(
        fcp.attribution.loadState,
        /^(loading|dom-(interactive|content-loaded)|complete)$/,
      );

      assert.deepEqual(fcp.attribution.fcpEntry, fcpEntry);

      // When FCP is reported, not all values on the NavigationTiming entry
      // are finalized, so just check some keys that should be set before FCP.
      const {navigationEntry: attributionNavEntry} = fcp.attribution;
      assert.equal(attributionNavEntry.startTime, navEntry.startTime);
      assert.equal(attributionNavEntry.fetchStart, navEntry.fetchStart);
      assert.equal(attributionNavEntry.requestStart, navEntry.requestStart);
      assert.equal(attributionNavEntry.responseStart, navEntry.responseStart);
    });

    it('accounts for time prerendering the page', async function () {
      if (!browserSupportsFCP) this.skip();
      if (!browserSupportsPrerender) this.skip();

      await navigateTo(`/test/fcp?attribution=1&prerender=1`, {
        readyState: 'complete',
      });

      await beaconCountIs(1);
      await clearBeacons();

      // Wait a bit to allow the prerender to happen
      await browser.pause(1000);

      const prerenderLink = await $('#prerender-link');
      await prerenderLink.click();

      await beaconCountIs(1);

      const navEntry = await browser.execute(() => {
        return __toSafeObject(performance.getEntriesByType('navigation')[0]);
      });
      const fcpEntry = await browser.execute(() => {
        return __toSafeObject(
          performance.getEntriesByName('first-contentful-paint')[0],
        );
      });

      const [fcp] = await getBeacons();
      assert(fcp.value >= 0);
      assert(fcp.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(fcp.name, 'FCP');
      assert.strictEqual(fcp.value, fcp.delta);
      assert.strictEqual(fcp.rating, 'good');
      assert.strictEqual(fcp.entries.length, 1);
      assert.strictEqual(fcp.navigationType, 'prerender');

      assert.equal(
        fcp.attribution.timeToFirstByte,
        Math.max(0, navEntry.responseStart - navEntry.activationStart),
      );
      assert.equal(
        fcp.attribution.firstByteToFCP,
        fcp.value -
          Math.max(0, navEntry.responseStart - navEntry.activationStart),
      );

      assert.deepEqual(fcp.attribution.fcpEntry, fcpEntry);

      // When FCP is reported, not all values on the NavigationTiming entry
      // are finalized, so just check some keys that should be set before FCP.
      const {navigationEntry: attributionNavEntry} = fcp.attribution;
      assert.equal(attributionNavEntry.startTime, navEntry.startTime);
      assert.equal(attributionNavEntry.fetchStart, navEntry.fetchStart);
      assert.equal(attributionNavEntry.requestStart, navEntry.requestStart);
      assert.equal(attributionNavEntry.responseStart, navEntry.responseStart);
    });

    it('reports after a bfcache restore', async function () {
      if (!browserSupportsFCP) this.skip();

      await navigateTo('/test/fcp?attribution=1', {readyState: 'complete'});

      await beaconCountIs(1);

      await clearBeacons();

      await stubForwardBack();

      await beaconCountIs(1);

      const [fcp] = await getBeacons();
      assert(fcp.value >= 0);
      assert(fcp.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(fcp.name, 'FCP');
      assert.strictEqual(fcp.value, fcp.delta);
      assert.strictEqual(fcp.rating, 'good');
      assert.strictEqual(fcp.entries.length, 0);
      assert.strictEqual(fcp.navigationType, 'back-forward-cache');

      assert.equal(fcp.attribution.timeToFirstByte, 0);
      assert.equal(fcp.attribution.firstByteToFCP, fcp.value);
      assert.equal(fcp.attribution.loadState, 'complete');
      assert.equal(fcp.attribution.navigationEntry, undefined);
    });

    it('reports soft navigation FCP attribution', async function () {
      if (!browserSupportsFCP || !browserSupportsSoftNavs) this.skip();

      await navigateTo('/test/fcp?attribution=1&reportSoftNavs=1');

      await beaconCountIs(1);
      const [fcp] = await getBeacons();
      const hardNavId = await browser.execute(() => {
        return performance.getEntriesByType('navigation')[0].navigationId;
      });
      assert.strictEqual(fcp.navigationId, hardNavId);

      await clearBeacons();

      // Click on the soft nav button to start new soft nav.
      const softNavButton = await $('#soft-nav');
      await simulateUserLikeClick(softNavButton);

      await beaconCountIs(1);

      const [softFcp] = await getBeacons();

      assert(softFcp.value >= 0);
      assert.strictEqual(softFcp.name, 'FCP');
      assert.strictEqual(softFcp.value, softFcp.delta);
      assert.strictEqual(softFcp.rating, 'good');
      assert.strictEqual(softFcp.entries.length, 0);
      assert.match(softFcp.navigationType, /soft-navigation/);

      const softNavEntry = await browser.execute(() => {
        return performance.getEntriesByType('soft-navigation')[0].toJSON();
      });
      assert.notEqual(softFcp.navigationId, fcp.navigationId);
      assert.strictEqual(softFcp.navigationId, softNavEntry.navigationId);

      assert.equal(softFcp.attribution.timeToFirstByte, 0);
      assert.equal(softFcp.attribution.firstByteToFCP, softFcp.value);
      assert.equal(softFcp.attribution.loadState, 'complete');

      const navEntry = softFcp.attribution.navigationEntry;
      assert.deepEqual(navEntry, softNavEntry);
    });
  });
});

const simulateUserLikeClick = async (element) => {
  await browser
    .action('pointer')
    .move({x: 0, y: 0, origin: element})
    .down({button: 0}) // left button
    .pause(50)
    .up({button: 0})
    .perform();
};
