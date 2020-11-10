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

    await beaconCountIs(1);

    const [fcp] = await getBeacons();
    assert(fcp.value >= 0);
    assert(fcp.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(fcp.name, 'FCP');
    assert.strictEqual(fcp.value, fcp.delta);
    assert.strictEqual(fcp.entries.length, 1);
  });

  it('does not report if the browser does not support FCP (including bfcache restores)', async function() {
    if (browserSupportsFCP) this.skip();

    await browser.url('/test/fcp');

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

  it('does not report if the document was hidden at page load time', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp?hidden=1');

    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document changes to hidden before the first entry', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp?invisible=1');

    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('reports if the page is restored from bfcache', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp');

    await beaconCountIs(1);

    const [fcp1] = await getBeacons();
    assert(fcp1.value >= 0);
    assert(fcp1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(fcp1.name, 'FCP');
    assert.strictEqual(fcp1.value, fcp1.delta);
    assert.strictEqual(fcp1.entries.length, 1);

    await clearBeacons();
    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp2] = await getBeacons();
    assert(fcp2.value >= 0);
    assert(fcp2.id.match(/^v1-\d+-\d+$/));
    assert(fcp2.id !== fcp1.id);
    assert.strictEqual(fcp2.name, 'FCP');
    assert.strictEqual(fcp2.value, fcp2.delta);
    assert.strictEqual(fcp2.entries.length, 0);

    await clearBeacons();
    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp3] = await getBeacons();
    assert(fcp3.value >= 0);
    assert(fcp3.id.match(/^v1-\d+-\d+$/));
    assert(fcp3.id !== fcp2.id);
    assert.strictEqual(fcp3.name, 'FCP');
    assert.strictEqual(fcp3.value, fcp3.delta);
    assert.strictEqual(fcp3.entries.length, 0);
  });

  it('reports if the page is restored from bfcache even when the document was hidden at page load time', async function() {
    if (!browserSupportsFCP) this.skip();

    await browser.url('/test/fcp?hidden=1');

    await stubVisibilityChange('visible');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);

    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp1] = await getBeacons();
    assert(fcp1.value >= 0);
    assert(fcp1.id.match(/^v1-\d+-\d+$/));
    assert.strictEqual(fcp1.name, 'FCP');
    assert.strictEqual(fcp1.value, fcp1.delta);
    assert.strictEqual(fcp1.entries.length, 0);

    await clearBeacons();
    await stubForwardBack();

    await beaconCountIs(1);

    const [fcp2] = await getBeacons();
    assert(fcp2.value >= 0);
    assert(fcp2.id.match(/^v1-\d+-\d+$/));
    assert(fcp2.id !== fcp1.id);
    assert.strictEqual(fcp2.name, 'FCP');
    assert.strictEqual(fcp2.value, fcp2.delta);
    assert.strictEqual(fcp2.entries.length, 0);
  });
});
