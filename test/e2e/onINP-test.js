/*
 * Copyright 2022 Google LLC
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
import {navigateTo} from '../utils/navigateTo.js';
import {nextFrame} from '../utils/nextFrame.js';
import {waitUntilIdle} from '../utils/waitUntilIdle.js';
import {webVitalsLoaded} from '../utils/webVitalsLoaded.js';

describe('onINP()', async function () {
  // Retry all tests in this suite up to 2 times.
  this.retries(0);

  let browserSupportsINP;
  let browserSupportsSoftNavs;
  before(async function () {
    browserSupportsINP = await browserSupportsEntry('event');
    browserSupportsSoftNavs = await browser.execute(() => {
      return PerformanceObserver.supportedEntryTypes.includes(
        'soft-navigation',
      );
    });
    // Set a standard screen size so soft nav paints show
    browser.setWindowSize(1280, 1024);
  });

  beforeEach(async function () {
    await navigateTo('about:blank');
    await clearBeacons();
  });

  it('reports hard nav INP and soft navs (reportAllChanges === false)', async function () {
    if (!browserSupportsINP || !browserSupportsSoftNavs) this.skip();

    await navigateTo('/test/inp?reportSoftNavs=1', {readyState: 'complete'});

    // Wait a bit to ensure page is fully loaded and console debug is logged.
    await browser.pause(1000);

    // Wait until the library is loaded
    await webVitalsLoaded();

    const hardNavId = await browser.execute(() => {
      return performance.getEntriesByType('navigation')[0].navigationId;
    });
    await browser.execute(() => {
      window.events = [];
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.interactionId) {
            window.events.push(entry.toJSON());
          }
        });
      });
      observer.observe({type: 'event', durationThreshold: 16, buffered: true});
      window.softNavs = [];
      const observer2 = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          window.softNavs.push(entry.toJSON());
        });
      });
      observer2.observe({type: 'soft-navigation', buffered: true});
    });
    const currentUrl = await browser.execute(() => {
      return document.location.href;
    });
    console.log(currentUrl);

    const h1 = await $('h1');
    await simulateUserLikeClick(h1);

    // Ensure the interaction completes.
    await nextFrame();
    // Give INP a chance to report
    await waitUntilIdle();

    // Click on the soft nav button to start new soft nav.
    const softNavButton = await $('#soft-nav');
    await simulateUserLikeClick(softNavButton);

    // Wait a bit to allow the entries to report
    await browser.pause(1000);
    console.log(`hardNavId: ${hardNavId}`);
    const events = await browser.execute(() => {
      return window.events;
    });
    console.log(events);
    const softNavs = await browser.execute(() => {
      return window.softNavs;
    });
    console.log(softNavs);

    // Wait a bit to allow the entries to report
    await browser.pause(1000);
    const logs = await browser.getLogs('browser');
    logs.forEach((log) => {
      console.log(log);
    });

    await beaconCountIs(1);

    const [inp] = await getBeacons();
    assert(inp.value >= 0);
    assert(inp.id.match(/^v5-\d+-\d+$/));
    assert.strictEqual(inp.name, 'INP');
    assert.strictEqual(inp.value, inp.delta);
    assert.strictEqual(inp.rating, 'good');
  });
});

const simulateUserLikeClick = async (element) => {
  await browser
    .action('pointer')
    .move({x: 0, y: 0, origin: element})
    .down({button: 0}) // left button
    .pause(50)
    .up({button: 0})
    .perform();
};
