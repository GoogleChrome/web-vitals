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
import { onTTFB as unattributedOnTTFB } from '../onTTFB.js';
const attributeTTFB = (metric) => {
    if (metric.entries.length) {
        const navigationEntry = metric.entries[0];
        const activationStart = navigationEntry.activationStart || 0;
        const dnsStart = Math.max(navigationEntry.domainLookupStart - activationStart, 0);
        const connectStart = Math.max(navigationEntry.connectStart - activationStart, 0);
        const requestStart = Math.max(navigationEntry.requestStart - activationStart, 0);
        metric.attribution = {
            waitingTime: dnsStart,
            dnsTime: connectStart - dnsStart,
            connectionTime: requestStart - connectStart,
            requestTime: metric.value - requestStart,
            navigationEntry: navigationEntry,
        };
        return;
    }
    // Set an empty object if no other attribution has been set.
    metric.attribution = {
        waitingTime: 0,
        dnsTime: 0,
        connectionTime: 0,
        requestTime: 0,
    };
};
/**
 * Calculates the [TTFB](https://web.dev/time-to-first-byte/) value for the
 * current page and calls the `callback` function once the page has loaded,
 * along with the relevant `navigation` performance entry used to determine the
 * value. The reported value is a `DOMHighResTimeStamp`.
 *
 * Note, this function waits until after the page is loaded to call `callback`
 * in order to ensure all properties of the `navigation` entry are populated.
 * This is useful if you want to report on other metrics exposed by the
 * [Navigation Timing API](https://w3c.github.io/navigation-timing/). For
 * example, the TTFB metric starts from the page's [time
 * origin](https://www.w3.org/TR/hr-time-2/#sec-time-origin), which means it
 * includes time spent on DNS lookup, connection negotiation, network latency,
 * and server processing time.
 */
export const onTTFB = (onReport, opts) => {
    unattributedOnTTFB(((metric) => {
        attributeTTFB(metric);
        onReport(metric);
    }), opts);
};
