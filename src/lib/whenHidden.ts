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


interface EventCallback {
  (event: Event): void;
}

const onHidden = (type: string, callback: EventCallback) => {
  const f = (event: Event) => {
    if (document.visibilityState === 'hidden') {
      removeEventListener(type, f, true);
      callback(event);
    }
  };
  addEventListener(type, f, true);
};

// Unload is needed to fix this bug:
// https://bugs.chromium.org/p/chromium/issues/detail?id=987409
export const whenHidden: Promise<Event> = new Promise((r) => {
  return ['visibilitychange', 'unload'].map((type) => onHidden(type, r));
});
