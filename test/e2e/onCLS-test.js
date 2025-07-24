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
import {nextFrame} from '../utils/nextFrame.js';
import {stubForwardBack} from '../utils/stubForwardBack.js';
import {stubVisibilityChange} from '../utils/stubVisibilityChange.js';

describe('onCLS()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

  let browserSupportsCLS;
  let browserSupportsPrerender;
  before(async function () {
    browserSupportsCLS = await browserSupportsEntry('layout-shift');
    browserSupportsPrerender = await browser.execute(() => {
      return 'onprerenderingchange' in document;
    });

    // Set a standard screen size so thresholds are the same
    browser.setWindowSize(1280, 1024);
  });

  beforeEach(async function () {
    await navigateTo('about:blank');
    await clearBeacons();
  });

  it('reports the correct value on visibility hidden after shifts (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 2);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('reports the correct value on visibility hidden after shifts (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?reportAllChanges=1');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(3);

    const [cls1, cls2, cls3] = await getBeacons();

    assert.strictEqual(cls1.value, 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 0);
    assert.match(cls1.navigationType, /navigate|reload/);

    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.rating, 'good');
    assert.strictEqual(cls2.entries.length, 1);
    assert.match(cls2.navigationType, /navigate|reload/);

    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.id, cls2.id);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.rating, 'good');
    assert.strictEqual(cls3.entries.length, 2);
    assert.match(cls3.navigationType, /navigate|reload/);
  });

  it('reports the correct value on page unload after shifts (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await navigateTo('about:blank');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 2);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('reports the correct value even if loaded late (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls?lazyLoad=1`, {readyState: 'complete'});

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 2);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('reports the correct value even if loaded late (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls?lazyLoad=1&reportAllChanges=1`, {
      readyState: 'complete',
    });

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    // Two shifts should have happened, but since the library loads after
    // the shifts are done, there should only be a single report.
    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 2);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('resets the session after timeout or gap elapses', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls');

    // Wait until all images are loaded and rendered.
    await imagesPainted();
    await browser.pause(1000);

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [cls1] = await getBeacons();

    assert(cls1.value > 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 2);
    assert.match(cls1.navigationType, /navigate|reload/);

    await browser.pause(1000);
    await stubVisibilityChange('visible');
    await clearBeacons();

    // Force 2 layout shifts, totaling 0.5.
    await browser.executeAsync((done) => {
      document.body.style.overflow = 'hidden'; // Prevent scroll bars.
      document.querySelector('main').style.left = '25vmax';
      setTimeout(() => {
        document.querySelector('main').style.left = '0px';
        done();
      }, 50);
    });

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [cls2] = await getBeacons();

    // The value should be exactly 0.5, but round just in case.
    assert.strictEqual(Math.round(cls2.value * 100) / 100, 0.5);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.rating, 'poor');
    assert.strictEqual(cls2.entries.length, 2);
    assert.match(cls2.navigationType, /navigate|reload/);
    assert.match(cls2.id, /^v5-\d+-\d+$/);

    await browser.pause(1000);
    await stubVisibilityChange('visible');
    await clearBeacons();

    // Force 4 separate layout shifts, totaling 1.5.
    await browser.executeAsync((done) => {
      document.querySelector('main').style.left = '25vmax';
      setTimeout(() => {
        document.querySelector('main').style.left = '0px';
        setTimeout(() => {
          document.querySelector('main').style.left = '50vmax';
          setTimeout(() => {
            document.querySelector('main').style.left = '0px';
            done();
          }, 50);
        }, 50);
      }, 50);
    });

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [cls3] = await getBeacons();

    // The value should be exactly 1.5, but round just in case.
    assert.strictEqual(Math.round(cls3.value * 100) / 100, 1.5);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.rating, 'poor');
    assert.strictEqual(cls3.entries.length, 4);
    assert.match(cls3.navigationType, /navigate|reload/);
    assert.match(cls3.id, /^v5-\d+-\d+$/);

    await browser.pause(1000);
    await stubVisibilityChange('visible');
    await clearBeacons();

    // Force 2 layout shifts, totalling 1.0 (less than the previous max).
    await browser.executeAsync((done) => {
      document.querySelector('main').style.left = '50vmax';
      setTimeout(() => {
        document.querySelector('main').style.left = '0px';
        done();
      }, 50);
    });

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the browser does not support CLS', async function () {
    if (browserSupportsCLS) this.skip();

    await navigateTo('/test/cls');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    await navigateTo('about:blank');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports no new values on visibility hidden after shifts (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?reportAllChanges=1');

    // Beacons should be sent as soon as layout shifts occur, wait for them.
    await beaconCountIs(3);

    const [cls1, cls2, cls3] = await getBeacons();

    assert.strictEqual(cls1.value, 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 0);
    assert.match(cls1.navigationType, /navigate|reload/);

    assert(cls2.value > 0);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.delta + cls2.delta);
    assert.strictEqual(cls2.rating, 'good');
    assert.strictEqual(cls2.entries.length, 1);
    assert.match(cls2.navigationType, /navigate|reload/);

    assert(cls3.value >= cls2.value);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.id, cls2.id);
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.rating, 'good');
    assert.strictEqual(cls3.entries.length, 2);
    assert.match(cls3.navigationType, /navigate|reload/);

    await clearBeacons();
    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the value has not changed (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?reportAllChanges=1');

    // Beacons should be sent as soon as layout shifts occur, wait for them.
    await beaconCountIs(3);

    const [cls1, cls2, cls3] = await getBeacons();

    assert.strictEqual(cls1.value, 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 0);
    assert.match(cls1.navigationType, /navigate|reload/);

    assert(cls2.value > 0);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.delta + cls2.delta);
    assert.strictEqual(cls2.rating, 'good');
    assert.strictEqual(cls2.entries.length, 1);
    assert.match(cls2.navigationType, /navigate|reload/);

    assert(cls3.value >= cls2.value);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.id, cls2.id);
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.rating, 'good');
    assert.strictEqual(cls3.entries.length, 2);
    assert.match(cls3.navigationType, /navigate|reload/);

    // Unload the page after no new shifts have occurred.
    await clearBeacons();
    await navigateTo('about:blank');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('continues reporting after visibilitychange (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls`);

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls1] = await getBeacons();

    assert(cls1.value > 0);
    assert(cls1.delta > 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 2);
    assert.match(cls1.navigationType, /navigate|reload/);

    await clearBeacons();
    await stubVisibilityChange('visible');

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await triggerLayoutShift();

    await clearBeacons();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls2] = await getBeacons();
    assert(cls2.value >= cls1.value);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.entries.length, 3);
    assert.match(cls2.navigationType, /navigate|reload/);
  });

  it('continues reporting after visibilitychange (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls?reportAllChanges=1`);
    await beaconCountIs(3);

    const [cls1, cls2, cls3] = await getBeacons();

    assert.strictEqual(cls1.value, 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 0);
    assert.match(cls1.navigationType, /navigate|reload/);

    assert(cls2.value > 0);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.delta + cls2.delta);
    assert.strictEqual(cls2.rating, 'good');
    assert.strictEqual(cls2.entries.length, 1);
    assert.match(cls2.navigationType, /navigate|reload/);

    assert(cls3.value >= cls2.value);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.id, cls2.id);
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.rating, 'good');
    assert.strictEqual(cls3.entries.length, 2);
    assert.match(cls3.navigationType, /navigate|reload/);

    // Unload the page after no new shifts have occurred.
    await clearBeacons();
    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await triggerLayoutShift();

    await beaconCountIs(1);
    const [cls4] = await getBeacons();

    assert(cls4.value > cls3.value);
    assert.strictEqual(cls4.name, 'CLS');
    assert.strictEqual(cls4.id, cls3.id);
    assert.strictEqual(cls4.value, cls3.value + cls4.delta);
    assert.strictEqual(cls4.rating, 'good');
    assert.strictEqual(cls4.entries.length, 3);
    assert.match(cls4.navigationType, /navigate|reload/);
  });

  it('continues reporting after bfcache restore (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls`);

    // Wait until all images are loaded and rendered, then go forward & back.
    await imagesPainted();

    await stubForwardBack();
    await beaconCountIs(1);

    const [cls1] = await getBeacons();

    assert(cls1.value > 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.delta, cls1.value);
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 2);
    assert.match(cls1.navigationType, /navigate|reload/);

    await clearBeacons();
    await triggerLayoutShift();

    await stubForwardBack();
    await beaconCountIs(1);

    const [cls2] = await getBeacons();

    assert(cls2.value > 0);
    assert(cls2.id.match(/^v5-\d+-\d+$/));
    assert(cls2.id !== cls1.id);

    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.value, cls2.delta);
    assert.strictEqual(cls2.rating, 'good');
    assert.strictEqual(cls2.entries.length, 1);
    assert.strictEqual(cls2.navigationType, 'back-forward-cache');

    await clearBeacons();
    await triggerLayoutShift();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [cls3] = await getBeacons();

    assert(cls3.value > 0);
    assert(cls3.id.match(/^v5-\d+-\d+$/));
    assert(cls3.id !== cls2.id);

    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.value, cls3.delta);
    assert.strictEqual(cls3.rating, 'good');
    assert.strictEqual(cls3.entries.length, 1);
    assert.strictEqual(cls3.navigationType, 'back-forward-cache');
  });

  it('continues reporting after bfcache restore (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls?reportAllChanges=1`);
    await beaconCountIs(3);

    const [cls1, cls2, cls3] = await getBeacons();

    assert.strictEqual(cls1.value, 0);
    assert(cls1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.rating, 'good');
    assert.strictEqual(cls1.entries.length, 0);
    assert.match(cls1.navigationType, /navigate|reload/);

    assert(cls2.value > 0);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.delta + cls2.delta);
    assert.strictEqual(cls2.rating, 'good');
    assert.strictEqual(cls2.entries.length, 1);
    assert.match(cls2.navigationType, /navigate|reload/);

    assert(cls3.value >= cls2.value);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.id, cls2.id);
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.rating, 'good');
    assert.strictEqual(cls3.entries.length, 2);
    assert.match(cls3.navigationType, /navigate|reload/);

    await clearBeacons();
    await stubForwardBack();

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await triggerLayoutShift();

    await beaconCountIs(2);
    const [cls4, cls5] = await getBeacons();

    assert.strictEqual(cls4.value, 0);
    assert(cls4.id.match(/^v5-\d+-\d+$/));
    assert(cls4.id !== cls3.id);
    assert.strictEqual(cls4.name, 'CLS');
    assert.strictEqual(cls4.value, cls4.delta);
    assert.strictEqual(cls4.rating, 'good');
    assert.strictEqual(cls4.entries.length, 0);
    assert.strictEqual(cls4.navigationType, 'back-forward-cache');

    assert(cls5.value > 0);
    assert.strictEqual(cls5.id, cls4.id);
    assert.strictEqual(cls5.name, 'CLS');
    assert.strictEqual(cls5.value, cls4.delta + cls5.delta);
    assert.strictEqual(cls5.rating, 'good');
    assert.strictEqual(cls5.entries.length, 1);
    assert.strictEqual(cls5.navigationType, 'back-forward-cache');
  });

  it('reports zero if no layout shifts occurred on first visibility hidden (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls?noLayoutShifts=1`, {readyState: 'complete'});

    // Wait until the page is loaded and content is visible before hiding.
    await firstContentfulPaint();
    await stubVisibilityChange('hidden');

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 0);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('reports zero if no layout shifts occurred on first visibility hidden (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo(`/test/cls?reportAllChanges=1&noLayoutShifts=1`, {
      readyState: 'complete',
    });

    // Wait until the page is loaded and content is visible before hiding.
    await firstContentfulPaint();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 0);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('reports zero if no layout shifts occurred on page unload (reportAllChanges === false)', async function () {
    if (!browserSupportsCLS) this.skip();

    // Wait until the page is loaded before navigating away.
    await navigateTo(`/test/cls?noLayoutShifts=1`, {readyState: 'complete'});

    await navigateTo('about:blank');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 0);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('reports zero if no layout shifts occurred on page unload (reportAllChanges === true)', async function () {
    if (!browserSupportsCLS) this.skip();

    // Wait until the page is loaded before navigating away.
    await navigateTo(`/test/cls?noLayoutShifts=1&reportAllChanges=1`, {
      readyState: 'complete',
    });

    // Wait until the page is loaded and content is visible before leaving.
    await firstContentfulPaint();
    await navigateTo('about:blank');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 0);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  it('does not report if the document was hidden at page load time', async function () {
    await navigateTo('/test/cls?hidden=1');

    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports if the page is restored from bfcache even when the document was hidden at page load time', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?hidden=1', {readyState: 'complete'});

    await stubForwardBack();

    // Give it time for beacons to come in
    await browser.pause(2000);

    // clear any beacons from page load.
    await clearBeacons();

    await triggerLayoutShift();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [cls] = await getBeacons();

    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.delta, cls.value);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 1);
    assert.strictEqual(cls.navigationType, 'back-forward-cache');
  });

  it('reports prerender as nav type and excludes shifts that happen in prerender state', async function () {
    if (!browserSupportsCLS) this.skip();
    if (!browserSupportsPrerender) this.skip();

    await navigateTo('/test/cls?prerender=1');

    // Wait a bit to allow the prerender to happen
    // and all loading shifts to complete
    await browser.pause(2000);

    const prerenderLink = await $('#prerender-link');
    await prerenderLink.click();

    await beaconCountIs(1);
    await clearBeacons();

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);
    const [cls] = await getBeacons();

    assert.strictEqual(cls.value, 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 0);
    assert.strictEqual(cls.navigationType, 'prerender');
  });

  it('reports restore as nav type for wasDiscarded', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?wasDiscarded=1');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);
    const [cls] = await getBeacons();

    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 2);
    assert.strictEqual(cls.navigationType, 'restore');
  });

  it('works when calling the function twice with different options', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?doubleCall=1&reportAllChanges2=1');

    // Wait until all images are loaded and rendered.
    await imagesPainted();

    await beaconCountIs(3, {instance: 2});

    const [cls2_1, cls2_2, cls2_3] = await getBeacons();

    assert.strictEqual(cls2_1.value, 0);
    assert(cls2_1.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls2_1.name, 'CLS');
    assert.strictEqual(cls2_1.value, cls2_1.delta);
    assert.strictEqual(cls2_1.rating, 'good');
    assert.strictEqual(cls2_1.entries.length, 0);
    assert.match(cls2_1.navigationType, /navigate|reload/);

    assert.strictEqual(cls2_2.value, cls2_1.value + cls2_2.delta);
    assert.strictEqual(cls2_2.id, cls2_1.id);
    assert.strictEqual(cls2_2.name, 'CLS');
    assert.strictEqual(cls2_2.rating, 'good');
    assert.strictEqual(cls2_2.entries.length, 1);
    assert.match(cls2_2.navigationType, /navigate|reload/);

    assert.strictEqual(cls2_3.value, cls2_2.value + cls2_3.delta);
    assert.strictEqual(cls2_3.id, cls2_2.id);
    assert.strictEqual(cls2_3.name, 'CLS');
    assert.strictEqual(cls2_3.rating, 'good');
    assert.strictEqual(cls2_3.entries.length, 2);
    assert.match(cls2_3.navigationType, /navigate|reload/);

    assert.strictEqual((await getBeacons({instance: 1})).length, 0);

    await stubVisibilityChange('hidden');

    await beaconCountIs(1, {instance: 1});

    const [cls1_1] = await getBeacons();

    assert(cls1_1.id.match(/^v5-\d+-\d+$/));
    assert(cls1_1.id !== cls2_3.id);
    assert.strictEqual(cls1_1.value, cls2_3.value);
    assert.strictEqual(cls1_1.delta, cls2_3.value);
    assert.strictEqual(cls1_1.name, cls2_3.name);
    assert.strictEqual(cls1_1.rating, cls2_3.rating);
    assert.deepEqual(cls1_1.entries, cls2_3.entries);
    assert.strictEqual(cls1_1.navigationType, cls2_3.navigationType);
  });

  it('reports on document visibility change handling', async function () {
    if (!browserSupportsCLS) this.skip();

    await navigateTo('/test/cls?documentVisibilityChangeHandling=1');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await hideAndReshowPage();

    // The test sends a beacon on both document visibility changes
    await beaconCountIs(1);
    const [cls] = await getBeacons();

    assert(cls.value > 0);
    assert(cls.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.rating, 'good');
    assert.strictEqual(cls.entries.length, 2);
    assert.match(cls.navigationType, /navigate|reload/);
  });

  describe('attribution', function () {
    it('includes attribution data on the metric object', async function () {
      if (!browserSupportsCLS) this.skip();

      await navigateTo('/test/cls?attribution=1&delayDCL=2000');

      // Wait until all images are loaded and rendered, then change to hidden.
      await imagesPainted();
      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [cls] = await getBeacons();
      assert(cls.value > 0);
      assert(cls.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(cls.name, 'CLS');
      assert.strictEqual(cls.value, cls.delta);
      assert.strictEqual(cls.rating, 'good');
      assert.strictEqual(cls.entries.length, 2);
      assert.match(cls.navigationType, /navigate|reload/);

      const {largestShiftEntry, largestShiftSource} = getAttribution(
        cls.entries,
      );

      assert.deepEqual(cls.attribution.largestShiftEntry, largestShiftEntry);
      assert.deepEqual(cls.attribution.largestShiftSource, largestShiftSource);

      assert.equal(cls.attribution.largestShiftValue, largestShiftEntry.value);
      assert.equal(cls.attribution.largestShiftTarget, '#p3');
      assert.equal(
        cls.attribution.largestShiftTime,
        largestShiftEntry.startTime,
      );

      // The first shift (before the second image loads) is the largest.
      assert.match(
        cls.attribution.loadState,
        /^dom-(interactive|content-loaded)$/,
      );
    });

    it('supports generating a custom target', async function () {
      if (!browserSupportsCLS) this.skip();

      await navigateTo('/test/cls?attribution=1&generateTarget=1');

      // Wait until all images are loaded and rendered, then change to hidden.
      await imagesPainted();
      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [cls] = await getBeacons();
      assert(cls.value > 0);
      assert(cls.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(cls.name, 'CLS');
      assert.strictEqual(cls.value, cls.delta);
      assert.strictEqual(cls.rating, 'good');
      assert.strictEqual(cls.entries.length, 2);
      assert.match(cls.navigationType, /navigate|reload/);

      assert.equal(
        cls.attribution.largestShiftTarget,
        'secondary-image-wrapper',
      );
    });

    it('supports generating a custom target with default fallback', async function () {
      if (!browserSupportsCLS) this.skip();

      await navigateTo('/test/cls?attribution=1&img2Hidden=1&generateTarget=1');

      // Wait until all images are loaded and rendered, then change to hidden.
      await imagesPainted();
      await stubVisibilityChange('hidden');

      await beaconCountIs(1);

      const [cls] = await getBeacons();
      assert(cls.value > 0);
      assert(cls.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(cls.name, 'CLS');
      assert.strictEqual(cls.value, cls.delta);
      assert.strictEqual(cls.rating, 'good');
      assert.strictEqual(cls.entries.length, 1);
      assert.match(cls.navigationType, /navigate|reload/);

      assert.equal(cls.attribution.largestShiftTarget, '#p4');
    });

    it('supports multiple calls with different custom target generation functions', async function () {
      if (!browserSupportsCLS) this.skip();

      await navigateTo(
        '/test/cls?attribution=1&doubleCall=1&generateTarget2=1',
      );

      // Wait until all images are loaded and rendered, then change to hidden.
      await imagesPainted();
      await stubVisibilityChange('hidden');

      await beaconCountIs(1, {instance: 1});
      await beaconCountIs(1, {instance: 2});

      const [cls1] = await getBeacons({instance: 1});
      assert(cls1.value > 0);
      assert(cls1.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(cls1.name, 'CLS');
      assert.strictEqual(cls1.value, cls1.delta);
      assert.strictEqual(cls1.rating, 'good');
      assert.strictEqual(cls1.entries.length, 2);
      assert.match(cls1.navigationType, /navigate|reload/);

      assert.equal(cls1.attribution.largestShiftTarget, '#p3');

      const [cls2] = await getBeacons({instance: 2});
      assert.strictEqual(cls2.name, cls1.name);
      assert.strictEqual(cls2.value, cls1.value);
      assert.strictEqual(cls2.delta, cls1.delta);
      assert.strictEqual(cls2.rating, cls1.rating);
      assert.deepEqual(cls2.entries, cls1.entries);
      assert(cls2.id !== cls1.id);

      assert.equal(
        cls2.attribution.largestShiftTarget,
        'secondary-image-wrapper',
      );
    });

    it('reports whether the largest shift was before or after load', async function () {
      if (!browserSupportsCLS) this.skip();

      await navigateTo(`/test/cls?attribution=1&noLayoutShifts=1`, {
        readyState: 'complete',
      });

      // Wait until the page is loaded and content is visible before triggering
      // a layout shift.
      await firstContentfulPaint();

      await triggerLayoutShift();
      await stubVisibilityChange('hidden');

      await beaconCountIs(1);
      const [cls] = await getBeacons();

      assert(cls.value > 0);
      assert(cls.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(cls.name, 'CLS');
      assert.strictEqual(cls.value, cls.delta);
      assert.strictEqual(cls.rating, 'good');
      assert.strictEqual(cls.entries.length, 1);
      assert.match(cls.navigationType, /navigate|reload/);

      const {largestShiftEntry, largestShiftSource} = getAttribution(
        cls.entries,
      );

      assert.deepEqual(cls.attribution.largestShiftEntry, largestShiftEntry);
      assert.deepEqual(cls.attribution.largestShiftSource, largestShiftSource);

      assert.equal(cls.attribution.largestShiftValue, largestShiftEntry.value);
      assert.equal(cls.attribution.largestShiftTarget, 'html>body>main>h1');
      assert.equal(
        cls.attribution.largestShiftTime,
        largestShiftEntry.startTime,
      );

      // The first shift (before the second image loads) is the largest.
      assert.equal(cls.attribution.loadState, 'complete');
    });

    it('reports an empty object when no shifts', async function () {
      if (!browserSupportsCLS) this.skip();

      await navigateTo(`/test/cls?attribution=1&noLayoutShifts=1`, {
        readyState: 'complete',
      });

      // Wait until the page is loaded and content is visible hiding.
      await firstContentfulPaint();
      await stubVisibilityChange('hidden');

      await beaconCountIs(1);
      const [cls] = await getBeacons();

      assert.strictEqual(cls.value, 0);
      assert(cls.id.match(/^v5-\d+-\d+$/));
      assert.strictEqual(cls.name, 'CLS');
      assert.strictEqual(cls.value, cls.delta);
      assert.strictEqual(cls.rating, 'good');
      assert.strictEqual(cls.entries.length, 0);
      assert.match(cls.navigationType, /navigate|reload/);

      assert.deepEqual(cls.attribution, {});
    });
  });
});

let marginTop = 0;

/**
 * Adds
 * @return {void}
 */
async function triggerLayoutShift() {
  await browser.execute((marginTop) => {
    document.querySelector('h1').style.marginTop = marginTop + 'em';
  }, ++marginTop);
  // Wait for a frame to be painted to ensure shifts are finished painting.
  await nextFrame();
}

/**
 *
 * @param {Array} entries
 * @return {Object}
 */
function getAttribution(entries) {
  let largestShiftEntry;
  for (const entry of entries) {
    if (!largestShiftEntry || entry.value > largestShiftEntry.value) {
      largestShiftEntry = entry;
    }
  }

  const largestShiftSource = largestShiftEntry.sources.find((source) => {
    return source.node !== '[object Text]';
  });

  return {largestShiftEntry, largestShiftSource};
}

const hideAndReshowPage = async () => {
  // Switch to new tab and back to change visibility state.
  // New tabs on Safari in webdriver.io are flakey, so minimize/maximize
  // instead, but it's kind of distracting so use tab switch for others.
  if (browser.capabilities.browserName !== 'safari') {
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
