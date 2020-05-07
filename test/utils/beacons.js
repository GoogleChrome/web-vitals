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

const fs = require('fs-extra');


const BEACON_FILE = './test/beacons.log';

/**
 * @param {Object} count
 * @return {Promise<boolean>} True if the beacon count matches.
 */
async function beaconCountIs(count) {
  await browser.waitUntil(async () => {
    const beacons = await getBeacons();
    return beacons.length === count;
  });
}

/**
 * Gets the array of beacons sent for the current page load (i.e. the
 * most recently sent beacons with the same metric ID).
 * @return {Promise<Array>}
 */
async function getBeacons(id = undefined) {
  const json = await fs.readFile(BEACON_FILE, 'utf-8');
  const allBeacons = json.trim().split('\n').filter(Boolean).map(JSON.parse);

  if (allBeacons.length) {
    const lastBeaconID = allBeacons[allBeacons.length - 1].id;
    return allBeacons.filter((beacon) => beacon.id === lastBeaconID);
  }
  return [];
}

/**
 * Clears the array of beacons on the page.
 * @return {Promise<void>}
 */
async function clearBeacons() {
  await fs.truncate(BEACON_FILE);
}

module.exports = {
  beaconCountIs,
  getBeacons,
  clearBeacons,
};
