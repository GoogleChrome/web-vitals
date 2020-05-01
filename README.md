# `web-vitals`

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [Types](#types)
  - [Functions](#functions)
- [Development](#development)
- [Browser Support](#browser-support)

## Overview

The `web-vitals` library is a small (<1K), modular library for measuring all the [Web Vitals](https://web.dev/metrics/) metrics on real users, in a way that accurately matches how they're measured by Chrome and reported to other Google tools (e.g. [Chrome User Experience Report](https://developers.google.com/web/tools/chrome-user-experience-report), [Page Speed Insights](https://developers.google.com/speed/pagespeed/insights/), [Search Console](https://search.google.com/search-console/about)).

The library supports all of the [Core Web Vitals](https://web.dev/vitals/#core-web-vitals) and [Other Web Vitals](https://web.dev/vitals/#other-web-vitals) that can be measured [in the field](https://web.dev/user-centric-performance-metrics/#how-metrics-are-measured):

### Core Web Vitals

- [Cumulative Layout Shift (CLS)](https://web.dev/cls/)
- [First Input Delay (FID)](https://web.dev/fid/)
- [Largest Contentful Paint (LCP)](https://web.dev/lcp/)

### Other Web Vitals

- [First Contentful Paint (FCP)](https://web.dev/fcp/)
- [Time to First Byte (TTFB)](https://web.dev/time-to-first-byte/)

## Installation

You can install this library from npm by running:

```sh
npm install web-vitals
```

## Usage

Each of the Web Vitals metrics are exposed as a single function that takes an `onReport` callback. This callback will fire any time either:

- The final value of the metric has been determined.
- The current metric value needs to be [reported right away](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#advice-hidden) (due to the page being unloaded or backgrounded).

### Logging the metrics to the console

The following example logs the result of each metric to the console once its value is ready to report.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getLCP(console.log);
```

_**Note:** some of these metrics will not report until the user has interacted with the page, switches tabs, or the page starts to unload. If you don't see the values logged to the console immediately, try switching tabs and then switching back._

### Sending the metric to an analytics endpoint

The following example measures each of the Core Web Vitals metrics and reports them to a local `/analytics` endpoint once known.

This code uses the [`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) method (if available), but falls back to the [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) API when not.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function reportToAnalytics(data) {
  const body = JSON.stringify(data);
  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
      fetch('/analytics', {body, method: 'POST', keepalive: true});
}

getCLS((metric) => reportToAnalytics({cls: metric.value}));
getFID((metric) => reportToAnalytics({fid: metric.value}));
getLCP((metric) => reportToAnalytics({lcp: metric.value}));
```

### Reporting the metric on every change

In most cases, you only want to call `onReport` when the metric is ready. However, for metrics like LCP and CLS (where the value may change over time) you can pass an optional, second argument (`reportAllChanges`). If `true` then `onReport` will be called any time the value of the metric changes, or once the final value has been determined.

This could be useful if, for example, you want to report the current LCP candidate as the page is loading, or you want to report layout shifts (and the current CLS value) as users are interacting with the page.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

getCLS(console.log, true);
getFID(console.log); // Does not take a `reportAllChanges` param.
getLCP(console.log, true);
```

_**Note:** when using the `reportAllChanges` option, pay attention to the `isFinal` property of the reported metric, which will indicate whether or not the value might change in the future. See the [API](#api) reference below for more details._

### Reporting only the delta of changes

Some analytics providers allow you to update the value of a metric, even after you've already sent it to their servers. Other analytics providers, however, do not allow this, so instead of reporting the updated value, you need to report only the delta (the difference between the current value and the last-reported value).

The following example modifies the [analytics code above](#sending-the-metric-to-an-analytics-endpoint) to only report the delta of the changes:

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function reportToAnalytics(data) {
  const body = JSON.stringify(data);
  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
      fetch('/analytics', {body, method: 'POST', keepalive: true});
}

getCLS((metric) => reportToAnalytics({cls: metric.delta}));
getFID((metric) => reportToAnalytics({fid: metric.delta}));
getLCP((metric) => reportToAnalytics({lcp: metric.delta}));
```

_**Note:** the first time the `onReport` function is called, its `value` and `delta` property will be the same._

## API

### Types:

#### `Metric`

```ts
interface Metric {
  // The value of the metric.
  value: number;

  // The delta between the current value and the last-reported value.
  // On the first report, `delta` and `value` will always be the same.
  delta: number;

  // `false` if the value of the metric may change in the future,
  // for the current page.
  isFinal: boolean;

  // Any performance entries used in the metric value calculation.
  // Note, entries will be added to the array as the value changes.
  entries: PerformanceEntry[];

  // Only present using the FID polyfill.
  event?: Event
}
```

#### `ReportHandler`

```ts
interface ReportHandler {
  (metric: Metric): void;
}
```

### Functions:

#### `getCLS()`

```ts
type getCLS = (onReport: ReportHandler, reportAllChanges?: boolean) => void
```

Calculates the [CLS](https://web.dev/cls/) value for the current page and calls the `onReport` function once the value is ready to be reported, along with all `layout-shift` performance entries that were used in the metric value calculation.

If the `reportAllChanges` param is `true`, the `onReport` function will be called any time a new `layout-shift` performance entry is dispatched, or once the final value of the metric has been determined.

_**Important:** unlike other metrics, CLS continues to monitor changes for the entire lifespan of the page&mdash;including if the user returns to the page after it's been hidden/backgrounded or put in the [Page Navigation Cache](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#page-navigation-cache). However, since browsers often [will not fire additional callbacks once the user has backgrounded a page](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#advice-hidden), `onReport` is always called when the page's visibility state changes to hidden. As a result, the `onReport` function might be called multiple times during the same page load (see [Reporting only the delta of changes](#reporting-only-the-delta-of-changes) for how to manage this)._

#### `getFCP()`

```ts
type getFCP = (onReport: ReportHandler) => void
```

Calculates the [FCP](https://web.dev/fcp/) value for the current page and calls the `onReport` function once the value is ready, along with the relevant `paint` performance entry used to determine the value.

#### `getFID()`

```ts
type getFID = (onReport: ReportHandler) => void
```

Calculates the [FID](https://web.dev/fid/) value for the current page and calls the `onReport` function once the value is ready, along with the relevant `first-input` performance entry used to determine the value (and optionally the input event if using the [FID polyfill](#fid-polyfill)).

_**Important:** since FID is only reported after the user interacts with the page, it's possible that it will not be reported for some page loads._

#### `getLCP()`

```ts
type getLCP = (onReport: ReportHandler, reportAllChanges?: boolean) => void
```

Calculates the [LCP](https://web.dev/lcp/) value for the current page and calls the `onReport` function once the value is ready (along with the relevant `largest-contentful-paint` performance entries used to determine the value).

If passed an `onReport` function, that function will be invoked any time a new `largest-contentful-paint` performance entry is dispatched, or once the final value of the metric has been determined.

#### `getTTFB()`

```ts
type getTTFB = (onReport: ReportHandler) => void
```

Calculates the [TTFB](https://web.dev/time-to-first-byte/) value for the current page and calls the `onReport` function once the page has loaded, along with the relevant `navigation` performance entry used to determine the value.

This function waits until after the page is loaded to call `onReport` in order to ensure all properties of the `navigation` entry are populated.

_**Note:** browsers that do not support `navigation` entries will fall back to
using `performance.timing` (with the timestamps converted from epoch time to `DOMHighResTimeStamp`)._

## Browser Support

This code has been tested and will run without error in all major browsers as well as Internet Explorer back to version 9 (when transpiled to ES5). However, some of the APIs required to capture these metrics are only available in Chromium-based browsers (e.g. Chrome, Edge, Opera, Samsung Internet).

Browser support for each function is as follows:

- `getCLS()`: Chromium
- `getFCP()`: Chromium
- `getFID()`: Chromium, Firefox, Safari, Internet Explorer (with polyfill, [see below](#fid-polyfill))
- `getLCP()`: Chromium
- `getTTFB()`: Chromium, Firefox, Safari, Internet Explorer

### FID Polyfill

The `getFID()` function will work in all browsers if the page has included the [FID polyfill](https://github.com/GoogleChromeLabs/first-input-delay).

Browsers that support the native [Event Timing API](https://wicg.github.io/event-timing/) will use that and report the metric value from the `first-input` performance entry.

Browsers that **do not** support the native Event Timing API will report the value reported by the polyfill, including the `Event` object of the first input.

For example:

```js
import {getFID} from 'web-vitals';

getFID((metric) => {
  // When using the polyfill, the `event` property will be present.
  // The  `entries` property will also be present, but it will be empty.
  console.log(metric.event); // Event
  console.log(metric.entries);  // []
});
```

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

## License

[Apache 2.0](/LICENSE)
