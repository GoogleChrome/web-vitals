# WebVitals.js

A simple, light-weight (~0.7K) library for measuring all the [Web Vitals](https://web.dev/metrics/) metrics on real users, in a way that accurately matches how they're reported by other Google tools (e.g. [Chrome User Experience Report](https://developers.google.com/web/tools/chrome-user-experience-report), [Page Speed Insights](https://developers.google.com/speed/pagespeed/insights/), [Lighthouse](https://developers.google.com/web/tools/lighthouse)).

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Development](#development)
- [Browser Support](#browser-support)

## Installation

You can install this library from npm by running:

```sh
npm install web-vitals
```

## Usage


Each of the Web Vitals metrics are exposed as a single function that returns a `Promise` that will resolve with the metric value, once known, as well as any performance entries involved in the metric value calculation.

### Logging the metrics to the console

The following code example logs the result of each metric promise to the console once it's resolved.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

getCLS().then(console.log);
getFID().then(console.log);
getLCP().then(console.log);
```

_**Note:** some of these metrics will not resolve until the user has interacted with the page, the user switches tabs, or the page starts to unload. If you don't see the values logged to the console immediately, try switching tabs and then switching back._

### Sending the metric to an analytics endpoint

The following code example measures each of the core Web Vitals metrics and reports them to a local `/analytics` endpoint once known.

This code uses the [`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) method (if available), but falls back to the the [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) API when not.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function reportMetric(body) {
  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
      fetch('/analytics', {body, method: 'POST', keepalive: true});
}

getCLS().then(({value}) => {
  reportMetric(JSON.stringify({cls: value}));
});

getFID().then(({value}) => {
  reportMetric(JSON.stringify({fid: value}));
});

getLCP().then(({value}) => {
  reportMetric(JSON.stringify({lcp: value}));
});
```

## API

### Functions

<table>
  <tr valign="top">
    <th align="left">Name</th>
    <th align="left">Description</th>
  </tr>
  <tr valign="top" id="api-getCLS">
    <td><code>getCLS()</code></td>
    <td>
      <p>
        <strong>Returns:</strong>
        <code>Promise<{value: number, entries: PerformanceEntry[]}></code>
      </p>
      <p>Calculates the <a href="https://web.dev/cls/">CLS</a> value for the current page and resolves once the value is known, along with all <code>layout-shift</code> performance entries that were used in the metric value calculation.</p>
    </td>
  </tr>
    <tr valign="top" id="api-getFCP">
    <td><code>getFCP()</code></td>
    <td>
      <p>
        <strong>Returns:</strong>
        <code>Promise<{value: number, entries: PerformanceEntry[]}></code>
      </p>
      <p>Calculates the <a href="https://web.dev/fcp/">FCP</a> value for the current page and resolves once the value is known, along with the relevant <code>paint</code> performance entry used to determine the value.</p>
    </td>
  </tr>
  </tr>
    <tr valign="top" id="api-getFID">
    <td><code>getFID()</code></td>
    <td>
      <p>
        <strong>Returns:</strong>
        <code>Promise<{value: number, entries: PerformanceEntry[], event?: Event}></code>
      </p>
      <p>Calculates the <a href="https://web.dev/fid/">FID</a> value for the current page and resolves once the value is known, along with the relevant <code>first-input</code> performance entry used to determine the value (and optionally the input event if using the <a href="#fid-polyfill">FID polyfill</a>).</p>
  </tr>
  </tr>
    <tr valign="top" id="api-getLCP">
    <td><code>getLCP()</code></td>
    <td>
      <p>
        <strong>Returns:</strong>
        <code>Promise<{value: number, entries: PerformanceEntry[]}></code>
      </p>
      <p>Calculates the <a href="https://web.dev/lcp/">LCP</a> value for the current page and resolves once the value is known (along with the relevant <code>largest-contentful-paint</code> performance entries used to determine the value).</p>
    </td>
  </tr>
</table>

## Development

### Building the code

The `web-vitals` source code is written in TypeScript. To transpile the code and build the production bundles, run the following command.

```sh
npm run build
```

To build the code and watch for changes, run:

```sh
npm run watch
```

### Running the tests

The `web-vitals` code is tested in real browsers using [webdriver.io](https://webdriver.io/). Use the following command to run the tests:

```sh
npm test
```

To test any of the APIs manually, you can start the test server

```sh
npm run test:server
```

Then navigate to `http://localhost:9090/test/<view>`, where `<view>` is the basename of one the templates under [/test/views/](/test/views/).

You'll likely want to combine this with `npm run watch` to ensure any changes you make are transpiled and rebuilt.

## Browser Support

This code has been tested and will run without error in all major browsers as well as Internet Explorer back to version 9.

However, the APIs required to capture these metrics are currently only available in Chromium-based browsers (e.g. Chrome, Edge, Opera, Samsung Internet).

### FID Polyfill

One exception to the above is that `getFID()` will work in all browsers if the page has included the [FID polyfill](https://github.com/GoogleChromeLabs/first-input-delay).

Browsers that support the native [Event Timing API](https://wicg.github.io/event-timing/) will use that and report the metric value from the `first-input` performance entry.

Browsers that **do not** support the native Event Timing API will report the value reported by the polyfill, including the `Event` object of the first input.

For example:

```js
import {getFID} from 'web-vitals';

getFID().then((metric) => {
  // When using the polyfill, the `event` property will be present.
  // The  `entries` property will also be present, but it will be empty.
  console.log(metric.event); // Event
  console.log(metric.entries);  // []
});
```

## License

[Apache 2.0](/LICENSE)
