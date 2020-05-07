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


/**
 * Returns a promise that resolves once the browser window has loaded and all
 * the images in the document have decoded and rendered.
 * @return {Promise<void>}
 */
function imagesPainted() {
  return browser.executeAsync((done) => {
    const windowLoaded = new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        addEventListener('load', resolve);
      }
    });

    const imagesDecoded = [...document.querySelectorAll('img')]
        .map((i) => i.decode());

    Promise.all([windowLoaded, ...imagesDecoded]).then(() => {
      // A bit of a hack, but since multiple frames can occur between an
      // image being decoded and it painting to the screen, we wait 100ms just
      // to avoid flakiness.
      setTimeout(done, 100);
    });
  });
}

module.exports = {
  imagesPainted,
};
