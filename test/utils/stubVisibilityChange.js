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


/**
 * Overrides the document's `visibilityState` property, sets the body's hidden
 * attribute (to prevent painting) and dispatches a `visibilitychange` event.
 * @return {Promise<void>}
 */
function stubVisibilityChange(value) {
  return browser.execute((value) => {
    if (value === 'hidden') {
      Object.defineProperty(document, 'visibilityState', {
        value: value,
        configurable: true,
      });
      document.body.hidden = true;
    } else {
      delete document.visibilityState;
      document.body.hidden = false;
    }
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

module.exports = {
  stubVisibilityChange,
};
