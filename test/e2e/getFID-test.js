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
const {stubForwardBack} = require('../utils/stubForwardBack.js');
const {stubVisibilityChange} = require('../utils/stubVisibilityChange.js');


describe('getFID()', async function() {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

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

    const [fid] = await getBeacons();
    assert(fid.value >= 0);
    assert(fid.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(fid.name, 'FID');
    assert.strictEqual(fid.value, fid.delta);
    assert.strictEqual(fid.entries[0].name, 'mousedown');
  });

  it('does not report if the browser does not support FID and the polyfill is not used', async function() {
    if (browserSupportsFID) this.skip();

    await browser.url('/test/fid');

    // Click on the <h1>.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const loadBeacons = await getBeacons();
    assert.strictEqual(loadBeacons.length, 0);

    await stubForwardBack();

    // Assert no entries after bfcache restores either (if the browser does
    // not support native FID and the polyfill is not used).
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const bfcacheRestoreBeacons = await getBeacons();
    assert.strictEqual(bfcacheRestoreBeacons.length, 0);
  });

  it('falls back to the polyfill in non-supporting browsers', async function() {
    // Ignore Safari until this bug is fixed:
    // https://bugs.webkit.org/show_bug.cgi?id=211101
    if (browser.capabilities.browserName === 'Safari') this.skip();

    await browser.url('/test/fid?polyfill=1');

    // Click on the <h1>.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);

    const [fid] = await getBeacons();

    assert(fid.value >= 0);
    assert(fid.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(fid.name, 'FID');
    assert.strictEqual(fid.value, fid.delta);
    assert.strictEqual(fid.entries[0].name, 'mousedown');
    if (browserSupportsFID) {
      assert('duration' in fid.entries[0]);
    } else {
      assert(!('duration' in fid.entries[0]));
    }
  });

  it('does not report if the document was hidden at page load time', async function() {
    // Ignore Safari until this bug is fixed:
    // https://bugs.webkit.org/show_bug.cgi?id=211101
    if (browser.capabilities.browserName === 'Safari') this.skip();

    await browser.url('/test/fid?hidden=1');

    await stubVisibilityChange('visible');

    // Click on the <h1>.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document changes to hidden before the first input', async function() {
    // Ignore Safari until this bug is fixed:
    // https://bugs.webkit.org/show_bug.cgi?id=211101
    if (browser.capabilities.browserName === 'Safari') this.skip();

    await stubVisibilityChange('hidden');

    // Returning to visible will also render the <body>.
    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports the first input delay after bfcache restores', async function() {
    if (!browserSupportsFID) this.skip();

    await browser.url('/test/fid');

    // Click on the <h1>.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);

    const [fid1] = await getBeacons();
    assert(fid1.value >= 0);
    assert(fid1.id.match(/^v2-\d+-\d+$/));
    assert.strictEqual(fid1.name, 'FID');
    assert.strictEqual(fid1.value, fid1.delta);
    assert.strictEqual(fid1.entries[0].name, 'mousedown');

    await clearBeacons();
    await stubForwardBack();

    // Click on the <h1>.
    await h1.click();

    await beaconCountIs(1);

    const [fid2] = await getBeacons();
    assert(fid2.value >= 0);
    assert(fid2.id.match(/^v2-\d+-\d+$/));
    assert(fid1.id !== fid2.id);
    assert.strictEqual(fid2.name, 'FID');
    assert.strictEqual(fid2.value, fid2.delta);
    assert.strictEqual(fid2.entries[0].name, 'mousedown');
  });
});


