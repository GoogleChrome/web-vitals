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


describe('getCLS()', async function() {
  let browserSupportsCLS;
  before(async function() {
    browserSupportsCLS = await browserSupportsEntry('layout-shift');
  });

  beforeEach(async function() {
    await clearBeacons();
  });

  it('reports the correct value on visibility hidden (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url('/test/cls');

    // Wait until all images are loaded and rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls}] = await getBeacons();
    assert(cls.value >= 0);
    assert.strictEqual(cls.value, cls.delta);
    assert.strictEqual(cls.entries.length, 2);
    assert.strictEqual(cls.isFinal, true);
  });

  it('reports the correct value on visibility hidden (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url('/test/cls?reportAllChanges=1');

    // Wait until all images are loaded and rendered.
    await beaconCountIs(2);

    const [{cls: cls1}, {cls: cls2}] = await getBeacons();

    assert(cls1.value >= 0);
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.isFinal, false);
    assert.strictEqual(cls1.entries.length, 1);

    assert(cls2.value >= cls1.value);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.isFinal, false);
    assert.strictEqual(cls2.entries.length, 2);

    // Load a new page to trigger the hidden state.
    await clearBeacons();
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls}] = await getBeacons();
    assert(cls.value >= 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.isFinal, true);
    assert.strictEqual(cls.entries.length, 2);
  });

  it('continues reporting after visibilitychange (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls-visibilitychange-after`);

    // Wait until all images are loaded and rendered.
    await beaconCountIs(1);

    const [{cls: cls1}] = await getBeacons();

    assert(cls1.value >= 0);
    assert(cls1.delta >= 0);
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.isFinal, false);
    assert.strictEqual(cls1.entries.length, 2);

    // Load a new page to trigger the unload state.
    await clearBeacons();
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls: cls2}] = await getBeacons();
    assert(cls2.value >= cls1.value);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.isFinal, true);
    assert.strictEqual(cls2.entries.length, 3);
  });

  it('continues reporting after visibilitychange (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls-visibilitychange-after?reportAllChanges=1`);

    // Wait until all images are loaded and rendered.
    await beaconCountIs(3);

    const [{cls: cls1}, {cls: cls2}, {cls: cls3}] = await getBeacons();

    assert(cls1.value > 0);
    assert.strictEqual(cls1.value, cls1.delta);
    assert.strictEqual(cls1.isFinal, false);
    assert.strictEqual(cls1.entries.length, 1);

    assert(cls2.value > cls1.value);
    assert.strictEqual(cls2.value, cls1.value + cls2.delta);
    assert.strictEqual(cls2.isFinal, false);
    assert.strictEqual(cls2.entries.length, 2);

    assert(cls3.value > cls2.value);
    assert.strictEqual(cls3.value, cls2.value + cls3.delta);
    assert.strictEqual(cls3.isFinal, false);
    assert.strictEqual(cls3.entries.length, 3);

    // Load a new page to trigger the unload state.
    await clearBeacons();
    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls: cls4}] = await getBeacons();
    assert.strictEqual(cls4.value, cls3.value);
    assert(cls4.delta === 0);
    assert.strictEqual(cls4.isFinal, true);
    assert.strictEqual(cls4.entries.length, 3);
  });

  it('reports zero if no layout shifts occurred (reportAllChanges === false)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls-no-layout-shifts`);

    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls}] = await getBeacons();
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.isFinal, true);
    assert.strictEqual(cls.entries.length, 0);
  });

  it('reports zero if no layout shifts occurred (reportAllChanges === true)', async function() {
    if (!browserSupportsCLS) this.skip();

    await browser.url(`/test/cls-no-layout-shifts?reportAllChanges=1`);

    await browser.url('about:blank');

    await beaconCountIs(1);

    const [{cls}] = await getBeacons();
    assert.strictEqual(cls.value, 0);
    assert.strictEqual(cls.delta, 0);
    assert.strictEqual(cls.isFinal, true);
    assert.strictEqual(cls.entries.length, 0);
  });
});
