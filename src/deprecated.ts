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

export {
  /**
   * @deprecated Use `onCLS()` instead.
   */
  onCLS as getCLS,
} from './onCLS.js';

export {
  /**
   * @deprecated Use `onFCP()` instead.
   */
  onFCP as getFCP,
} from './onFCP.js';

export {
  /**
   * @deprecated Use `onFID()` instead.
   */
  onFID as getFID,
} from './onFID.js';

export {
  /**
   * @deprecated Use `onINP()` instead.
   */
  onINP as getINP,
} from './onINP.js';

export {
  /**
   * @deprecated Use `onLCP()` instead.
   */
  onLCP as getLCP,
} from './onLCP.js';

export {
  /**
   * @deprecated Use `onTTFB()` instead.
   */
  onTTFB as getTTFB,
} from './onTTFB.js';

export {
  /**
   * @deprecated Use `ReportCallback` instead.
   */
  ReportCallback as ReportHandler,
} from './types.js';
