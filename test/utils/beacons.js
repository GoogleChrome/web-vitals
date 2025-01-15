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

import fs from 'fs-extra';

const BEACON_FILE = './test/beacons.log';

/**
 * Runs a webdriverio waitUntil command, ending once the specified number of
 * beacons haven been received (optionally matching the passed `opts` object).
 */
export async function beaconCountIs(count, opts = {}) {
  await browser.waitUntil(async () => {
    const beacons = await getBeacons(opts);

    return beacons.length === count;
  });
}

/**
 * Returns an array of beacons matching the passed `opts` object. If no
 * `opts` are specified, the default is to return all beacon matching
 * the most recently-received metric ID.
 */
export async function getBeacons(opts = {}) {
  const json = await fs.readFile(BEACON_FILE, 'utf-8');
  const allBeacons = json.trim().split('\n').filter(Boolean).map(JSON.parse);

  if (allBeacons.length) {
    const lastBeacon = allBeacons.findLast((beacon) => {
      if (opts.instance) {
        return opts.instance === beacon.instance;
      }
      return true;
    });

    if (lastBeacon) {
      return allBeacons.filter((beacon) => {
        if (beacon.id === lastBeacon.id) {
          if (opts.instance) {
            return opts.instance === beacon.instance;
          }
          return true;
        }
        return false;
      });
    }
  }
  return [];
}

/**
 * Clears the array of beacons on the page.
 */
export async function clearBeacons() {
  await fs.truncate(BEACON_FILE);
}
