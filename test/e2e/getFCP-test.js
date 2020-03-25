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


describe('getFCP()', async function() {
  let browserSupportsFCP;
  before(async function() {
    browserSupportsFCP = await browserSupportsEntry('paint');
  });

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value after the first paint', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    await beaconCountIs(1);

    const [{fcp}] = await getBeacons();
    assert.strictEqual(typeof fcp.value, 'number');
    assert.strictEqual(fcp.entries.length, 1);
  });

  it('does not report if the document was hidden at page load time', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp-hidden');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document changes to hidden before the first entry', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp-visibilitychange-before');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });
});
