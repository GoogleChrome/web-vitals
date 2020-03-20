/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
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


describe('web-vitals', async function() {
  let browserSupportsWebVitals;
  before(async function() {
    browserSupportsWebVitals =
        (await browserSupportsEntry('layout-shift')) &&
        (await browserSupportsEntry('paint')) &&
        (await browserSupportsEntry('first-input')) &&
        (await browserSupportsEntry('largest-contentful-paint'));
  });

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports all values', async function() {
    if (!browserSupportsWebVitals) this.skip();

    await browser.url('/test/web-vitals');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the <h1> to trigger FID and LCP.
    const h1 = await $('h1');
    await h1.click();

    // Wait until the next frame after the click for FID to be dispatched.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls, fcp, fid, lcp}] = await getBeacons();

    assert.strictEqual(typeof cls.value, 'number');
    assert(cls.entries.length > 1);

    assert.strictEqual(typeof fcp.value, 'number');
    assert(fcp.entries.length === 1);

    assert.strictEqual(typeof fid.value, 'number');
    assert(fid.entries.length === 1);

    assert.strictEqual(typeof lcp.value, 'number');
    assert(lcp.value > 200); // Greater than the image load delay.
    assert(lcp.entries.length > 1);
  });
});
