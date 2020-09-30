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
const {browserSupportsEntry} = require('../utils/browserSupportsEntry.js');
const {imagesPainted} = require('../utils/imagesPainted.js');
const {stubForwardBack} = require('../utils/stubForwardBack.js');
const {stubVisibilityChange} = require('../utils/stubVisibilityChange.js');


describe('getCLS()', async function() {
  let browserSupportsCLS;
  before(async function() {
    browserSupportsCLS = await browserSupportsEntry('layout-shift');
  });

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value on visibility hidden after shifts (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url('/test/cls');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.value >= 0);
    assert(cls.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.entries.length, 2);

    await browser.url('/test/cls');
  });

  it('reports the correct value on page unload after shifts (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url('/test/cls');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.value >= 0);
    assert(cls.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.entries.length, 2);
  });

  it('does not report if the browser does not support CLS', async function() {
    if (browserSupportsCLS) this.skip();

    await browser.url('/test/cls');

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    await browser.url('about:blank');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports no new values on visibility hidden after shifts (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url('/test/cls?reportAllChanges=1');

    // Beacons should be sent as soon as layout shifts occur, wait for them.
    await beaconCountIs(2);

    const [cls1, cls2] = await getBeacons();

    assert(cls1.value >= 0);
    assert(cls1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.entries.length, 1);

    assert(cls2.value >= cls1.value);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.entries.length, 2);

    await clearBeacons();
    await stubVisibilityChange('hidden');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the value has not changed (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url('/test/cls?reportAllChanges=1');

    // Beacons should be sent as soon as layout shifts occur, wait for them.
    await beaconCountIs(2);

    const [cls1, cls2] = await getBeacons();

    assert(cls1.value >= 0);
    assert(cls1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.entries.length, 1);

    assert(cls2.value >= cls1.value);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.entries.length, 2);

    // Unload the page after no new shifts have occurred.
    await clearBeacons();
    await browser.url('about:blank');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('continues reporting after visibilitychange (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls`);

    // Wait until all images are loaded and rendered, then change to hidden.
    await imagesPainted();
    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls1] = await getBeacons();

    assert(cls1.value >= 0);
    assert(cls1.delta >= 0);
    assert(cls1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.entries.length, 2);

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
  });

  it('continues reporting after visibilitychange (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls?reportAllChanges=1`);
    await beaconCountIs(2);

    const [cls1, cls2] = await getBeacons();

    assert(cls1.value > 0);
    assert(cls1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.entries.length, 1);

    assert(cls2.value > cls1.value);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.entries.length, 2);

    // Unload the page after no new shifts have occurred.
    await clearBeacons();
    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await triggerLayoutShift();

    await beaconCountIs(1);
    const [cls3] = await getBeacons();

    assert(cls3.value > cls2.value);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.id, cls2.id);
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.entries.length, 3);
  });

  it('continues reporting after bfcache restore (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls`);

    // Wait until all images are loaded and rendered, then go forward & back.
    await imagesPainted();

    await stubForwardBack();
    await beaconCountIs(1);

    const [cls1] = await getBeacons();

    assert(cls1.value >= 0);
    assert(cls1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls1.delta, cls1.value);
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.entries.length, 2);

    await clearBeacons();
    await triggerLayoutShift();

    await stubForwardBack();
    await beaconCountIs(1);

    const [cls2] = await getBeacons();

    assert(cls2.value >= 0);
    assert(cls2.id.match(/^v1-\d+-\d+$/));
    assert(cls2.id !== cls1.id);

    assert.strictEqual(cls2.delta, cls2.value);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.value, cls2.delta);
    assert.strictEqual(cls2.entries.length, 1);

    await clearBeacons();
    await triggerLayoutShift();

    await stubVisibilityChange('hidden');
    await beaconCountIs(1);

    const [cls3] = await getBeacons();

    assert(cls3.value >= 0);
    assert(cls3.id.match(/^v1-\d+-\d+$/));
    assert(cls3.id !== cls2.id);

    assert.strictEqual(cls3.delta, cls3.value);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.value, cls3.delta);
    assert.strictEqual(cls3.entries.length, 1);
  });

  it('continues reporting after bfcache restore (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls?reportAllChanges=1`);
    await beaconCountIs(2);

    const [cls1, cls2] = await getBeacons();

    assert(cls1.value > 0);
    assert(cls1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls1.name, 'CLS');
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.entries.length, 1);

    assert(cls2.value > cls1.value);
    assert.strictEqual(cls2.name, 'CLS');
    assert.strictEqual(cls2.id, cls1.id);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.entries.length, 2);

    await clearBeacons();
    await stubForwardBack();

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await triggerLayoutShift();

    await beaconCountIs(1);
    const [cls3] = await getBeacons();

    assert(cls3.value > 0);
    assert(cls3.id.match(/^v1-\d+-\d+$/));
    assert(cls3.id !== cls2.id);
    assert.strictEqual(cls3.name, 'CLS');
    assert.strictEqual(cls3.value, cls3.delta);
    assert.strictEqual(cls3.entries.length, 1);
  });

  it('reports zero if no layout shifts occurred on first visibility hidden (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls?noLayoutShifts=1`);

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.entries.length, 0);
  });

  it('reports zero if no layout shifts occurred on first visibility hidden (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls?reportAllChanges=1&noLayoutShifts=1`);

    await stubVisibilityChange('hidden');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.entries.length, 0);
  });

  it('reports zero if no layout shifts occurred on page unload (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls?noLayoutShifts=1`);

    await browser.url('about:blank');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.entries.length, 0);
  });

  it('reports zero if no layout shifts occurred on page unload (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls?noLayoutShifts=1&reportAllChanges=1`);

    await browser.url('about:blank');

    await beaconCountIs(1);

    const [cls] = await getBeacons();
    assert(cls.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(cls.name, 'CLS');
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.entries.length, 0);
  });
});

let marginTop = 0;

/**
 * Returns a promise that resolves once the browser window has loaded and all
 * the images in the document have decoded and rendered.
 * @return {Promise<void>}
 */
function triggerLayoutShift() {
  return browser.execute((marginTop) => {
    document.querySelector('h1').style.marginTop = marginTop + 'em';
  }, ++marginTop);
}
