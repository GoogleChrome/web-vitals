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


describe('getLCP()', async function() {
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

  it('reports the correct value on hidden', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{lcp}] = await getBeacons();
    assert.strictEqual(typeof lcp.value, 'number');
    assert(lcp.value > 200); // Greater than the image load delay.
    assert(lcp.entries.length > 1);
  });

  it('reports the correct value on scroll', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Scroll down
    const footer = await $('footer');
    await footer.scrollIntoView();

    await beaconCountIs(1);

    const [{lcp}] = await getBeacons();
    assert.strictEqual(typeof lcp.value, 'number');
    assert(lcp.value > 200); // Greater than the image load delay.
    assert(lcp.entries.length > 1);
  });

  it('reports the correct value on input', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();
    await browser.pause(200);

    // Click on the body.
    const body = await $('body');
    await body.click();

    await beaconCountIs(1);

    const [{lcp}] = await getBeacons();
    assert.strictEqual(typeof lcp.value, 'number');
    assert(lcp.value > 200); // Greater than the image load delay.
    assert(lcp.entries.length > 1);
  });
});
