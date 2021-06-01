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
const {stubVisibilityChange} = require('../utils/stubVisibilityChange.js');


describe('getLCP()', async function() {
  // Retry all tests in this suite up to 2 times.
  this.retries(2);

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

  it('reports the correct value on hidden (reportAllChanges === false)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on hidden (reportAllChanges === true)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    await beaconCountIs(2);
    assertFullReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on input (reportAllChanges === false)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(1);
    assertStandardReportsAreCorrect(await getBeacons());
  });

  it('reports the correct value on input (reportAllChanges === true)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?reportAllChanges=1');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    await beaconCountIs(2);
    assertFullReportsAreCorrect(await getBeacons());
  });

  it('does not report if the browser does not support LCP', async function() {
    if (browserSupportsLCP) this.skip();

    await browser.url('/test/lcp');

    // Wait until all images are loaded and fully rendered.
    await imagesPainted();

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Scroll down
    const footer = await $('footer');
    await footer.scrollIntoView();

    // Load a new page to trigger the hidden state.
    await browser.url('about:blank');

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document was hidden at page load time', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?hidden=1');

    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('does not report if the document changes to hidden before the first render', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?invisible=1');

    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });

  it('stops reporting after the document changes to hidden (reportAllChanges === false)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?imgDelay=0&imgHidden=1');

    // Wait for a frame to be painted.
    await browser.executeAsync((done) => requestAnimationFrame(done));

    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    await browser.execute(() => {
      document.querySelector('img').hidden = false;
    });

    // Click on the h1.
    const h1 = await $('h1');
    await h1.click();

    // Wait a bit to ensure no additional beacons were sent.
    await browser.pause(1000);

    await beaconCountIs(1);

    const [lcp1] = await getBeacons();

    assert(lcp1.value > 0);
    assert.strictEqual(lcp1.name, 'LCP');
    assert.strictEqual(lcp1.value, lcp1.delta);
    assert.strictEqual(lcp1.entries.length, 1);
    assert.strictEqual(lcp1.entries[0].element, 'h1');
  });

  it('stops reporting after the document changes to hidden (reportAllChanges === true)', async function() {
    if (!browserSupportsLCP) this.skip();

    await browser.url('/test/lcp?reportAllChanges=1&imgDelay=0&imgHidden=1');

    await beaconCountIs(1);
    const [lcp] = await getBeacons();

    assert(lcp.value > 0);
    assert.strictEqual(lcp.name, 'LCP');
    assert.strictEqual(lcp.value, lcp.delta);
    assert.strictEqual(lcp.entries.length, 1);
    assert.strictEqual(lcp.entries[0].element, 'h1');

    await clearBeacons();
    await stubVisibilityChange('hidden');
    await stubVisibilityChange('visible');

    await browser.execute(() => {
      document.querySelector('img').hidden = false;
    });

    // Wait a bit to ensure no beacons were sent.
    await browser.pause(1000);

    const beacons = await getBeacons();
    assert.strictEqual(beacons.length, 0);
  });
});

const assertStandardReportsAreCorrect = (beacons) => {
  const [lcp] = beacons;

  assert(lcp.value > 500); // Greater than the image load delay.
  assert(lcp.id.match(/^v2-\d+-\d+$/));
  assert.strictEqual(lcp.name, 'LCP');
  assert.strictEqual(lcp.value, lcp.delta);
  assert.strictEqual(lcp.entries.length, 2);
};

const assertFullReportsAreCorrect = (beacons) => {
  const [lcp1, lcp2] = beacons;

  assert(lcp1.value < 500); // Less than the image load delay.
  assert(lcp1.id.match(/^v2-\d+-\d+$/));
  assert.strictEqual(lcp1.name, 'LCP');
  assert.strictEqual(lcp1.value, lcp1.delta);
  assert.strictEqual(lcp1.entries.length, 1);

  assert(lcp2.value > 500); // Greater than the image load delay.
  assert.strictEqual(lcp2.value, lcp1.value + lcp2.delta);
  assert.strictEqual(lcp2.name, 'LCP');
  assert.strictEqual(lcp2.id, lcp1.id);
  assert.strictEqual(lcp2.entries.length, 2);
};
