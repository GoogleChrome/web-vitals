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


describe('getFID()', async function() {
  let browserSupportsFID;
  before(async function() {
    browserSupportsFID = await browserSupportsEntry('first-input');
  });

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value after input', async function() {
    if (!browserSupportsFID) this.skip();

    await browser.url('/test/fid');

    // Click on the <h1>.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);

    const [{fid}] = await getBeacons();
    assert(fid.value >= 0);
    assert.strictEqual(fid.value, fid.delta);
    assert.strictEqual(fid.entries[0].name, 'mousedown');
    assert.strictEqual(fid.isFinal, true);
  });

  it('falls back to the polyfill in non-supporting browsers', async function() {
    await browser.url('/test/fid-polyfill');

    // Click on the <h1>.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);

    const [{fid}] = await getBeacons();

    assert(fid.value >= 0);
    assert.strictEqual(fid.value, fid.delta);
    assert.strictEqual(fid.isFinal, true);
    if (browserSupportsFID) {
      assert.strictEqual(fid.entries[0].name, 'mousedown');
    } else {
      assert.strictEqual(fid.event.type, 'mousedown');
    }
  });
});


