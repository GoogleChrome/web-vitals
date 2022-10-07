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
const getNavigationEntryFromPerformanceTiming = () => {
    const timing = performance.timing;
    const type = performance.navigation.type;
    const navigationEntry = {
        entryType: 'navigation',
        startTime: 0,
        type: type == 2 ? 'back_forward' : (type === 1 ? 'reload' : 'navigate'),
    };
    for (const key in timing) {
        if (key !== 'navigationStart' && key !== 'toJSON') {
            navigationEntry[key] = Math.max(timing[key] -
                timing.navigationStart, 0);
        }
    }
    return navigationEntry;
};
export const getNavigationEntry = () => {
    if (window.__WEB_VITALS_POLYFILL__) {
        return window.performance && (performance.getEntriesByType &&
            performance.getEntriesByType('navigation')[0] ||
            getNavigationEntryFromPerformanceTiming());
    }
    else {
        return window.performance && (performance.getEntriesByType &&
            performance.getEntriesByType('navigation')[0]);
    }
};
