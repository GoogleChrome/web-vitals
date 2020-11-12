# `web-vitals`

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic usage](#basic-usage)
  - [Report the value on every change](#report-the-value-on-every-change)
  - [Report only the delta of changes](#report-only-the-delta-of-changes)
  - [Send the results to an analytics endpoint](#send-the-results-to-an-analytics-endpoint)
  - [Send the results to Google Analytics](#send-the-results-to-google-analytics)
  - [Send the results to Google Tag Manager](#send-the-results-to-google-tag-manager)
  - [Load `web-vitals` from a CDN](#load-web-vitals-from-a-cdn)
- [Bundle options](#bundle-options)
  - [Which bundle is right for you?](#which-bundle-is-right-for-you)
  - [How to use the polyfill](#how-to-use-the-polyfill)
- [API](#api)
  - [Types](#types)
  - [Functions](#functions)
- [Development](#development)
- [Browser Support](#browser-support)

## Overview

The `web-vitals` library is a tiny (~1K), modular library for measuring all the [Web Vitals](https://web.dev/vitals/) metrics on real users, in a way that accurately matches how they're measured by Chrome and reported to other Google tools (e.g. [Chrome User Experience Report](https://developers.google.com/web/tools/chrome-user-experience-report), [Page Speed Insights](https://developers.google.com/speed/pagespeed/insights/), [Search Console's Speed Report](https://webmasters.googleblog.com/2019/11/search-console-speed-report.html)).

The library supports all of the [Core Web Vitals](https://web.dev/vitals/#core-web-vitals) as well as all of the [other Web Vitals](https://web.dev/vitals/#other-web-vitals) that can be measured [in the field](https://web.dev/user-centric-performance-metrics/#how-metrics-are-measured):

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

_**Note:** If you're not using npm, you can still load `web-vitals` via `<script>` tags from a CDN like [unpkg.com](https://unpkg.com). See the [load `web-vitals` from a CDN](#load-web-vitals-from-a-cdn) usage example below for details._

## Usage

Each of the Web Vitals metrics is exposed as a single function that takes an `onReport` callback. This callback will be called any time the metric value is available and ready to be reported.

### Basic usage

The following example measures each of the Core Web Vitals metrics and logs the result to the console once its value is ready to report.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getLCP(console.log);
```

Note that some of these metrics will not report until the user has interacted with the page, switched tabs, or the page starts to unload. If you don't see the values logged to the console immediately, try reloading the page (with [preserve log](https://developers.google.com/web/tools/chrome-devtools/console/reference#persist) enabled) or switching tabs and then switching back.

Also, in some cases a metric callback may never be called:

- FID is not reported if the user never interacts with the page.
- FCP, FID, and LCP are not reported if the page was loaded in the background.

In other cases, a metric callback may be called more than once:

- CLS should be reported any time the [a page's `visibilityState` changes to hidden](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#advice-hidden).
- CLS, FCP, FID, and LCP are reported again after a page is restored from the [back/forward cache](https://web.dev/bfcache/).

### Report the value on every change

In most cases, you only want `onReport` to be called when the metric is ready to be reported. However, it is possible to report every change (e.g. each layout shift as it happens) by setting the optional, second argument (`reportAllChanges`) to `true`.

This can be useful when debugging, but in general using `reportAllChanges` is not needed (or recommended).

```js
import {getCLS} from 'web-vitals';

// Logs CLS as the value changes.
getCLS(console.log, true);
```

### Report only the delta of changes

Some analytics providers allow you to update the value of a metric, even after you've already sent it to their servers (overwriting the previously-sent value with the same `id`).

Other analytics providers, however, do not allow this, so instead of reporting the new value, you need to report only the delta (the difference between the current value and the last-reported value). You can then compute the total value by summing all metric deltas sent with the same ID.

The following example shows how to use the `id` and `delta` properties:

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function logDelta({name, id, delta}) {
  console.log(`${name} matching ID ${id} changed by ${delta}`);
}

getCLS(logDelta);
getFID(logDelta);
getLCP(logDelta);
```

_**Note:** the first time the `onReport` function is called, its `value` and `delta` properties will be the same._

In addition to using the `id` field to group multiple deltas for the same metric, it can also be used to differentiate different metrics reported on the same page. For example, after a back/forward cache restore, a new metric object is created with a new `id` (since back/forward cache restores are considered separate page visits).

### Send the results to an analytics endpoint

The following example measures each of the Core Web Vitals metrics and reports them to a hypothetical `/analytics` endpoint, as soon as each is ready to be sent.

The `sendToAnalytics()` function uses the [`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) method (if available), but falls back to the [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) API when not.

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({[metric.name]: metric.value});
  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
      fetch('/analytics', {body, method: 'POST', keepalive: true});
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getLCP(sendToAnalytics);
```

### Send the results to Google Analytics

Google Analytics does not support reporting metric distributions in any of its built-in reports; however, if you set a unique dimension value (in this case, the metric `id`) on every metric instance that you send to Google Analytics, including that dimension in a custom report will allow you to construct a distribution manually.

Using the [Google Analytics Reporting API](https://developers.google.com/analytics/devguides/reporting) and a tool like [Data Studio](https://datastudio.google.com/) (or your own visualization library), you can create dashboards with histograms reporting quantile data (the 75th percentile is recommended) for all of the Web Vitals metrics.

The following code examples show how to send your metrics to Google Analytics in order to enable reporting quantile data:

#### Using `analytics.js`

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function sendToGoogleAnalytics({name, delta, id}) {
  // Assumes the global `ga()` function exists, see:
  // https://developers.google.com/analytics/devguides/collection/analyticsjs
  ga('send', 'event', {
    eventCategory: 'Web Vitals',
    eventAction: name,
    // Google Analytics metrics must be integers, so the value is rounded.
    // For CLS the value is first multiplied by 1000 for greater precision
    // (note: increase the multiplier for greater precision if needed).
    eventValue: Math.round(name === 'CLS' ? delta * 1000 : delta),
    // The `id` value will be unique to the current page load. When sending
    // multiple values from the same page (e.g. for CLS), Google Analytics can
    // compute a total by grouping on this ID (note: requires `eventLabel` to
    // be a dimension in your report).
    eventLabel: id,
    // Use a non-interaction event to avoid affecting bounce rate.
    nonInteraction: true,
    // Use `sendBeacon()` if the browser supports it.
    transport: 'beacon',
  });
}

getCLS(sendToGoogleAnalytics);
getFID(sendToGoogleAnalytics);
getLCP(sendToGoogleAnalytics);
```

#### Using `gtag.js`

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function sendToGoogleAnalytics({name, delta, id}) {
  // Assumes the global `gtag()` function exists, see:
  // https://developers.google.com/analytics/devguides/collection/gtagjs
  gtag('event', name, {
    event_category: 'Web Vitals',
    // Google Analytics metrics must be integers, so the value is rounded.
    // For CLS the value is first multiplied by 1000 for greater precision
    // (note: increase the multiplier for greater precision if needed).
    value: Math.round(name === 'CLS' ? delta * 1000 : delta),
    // The `id` value will be unique to the current page load. When sending
    // multiple values from the same page (e.g. for CLS), Google Analytics can
    // compute a total by grouping on this ID (note: requires `eventLabel` to
    // be a dimension in your report).
    event_label: id,
    // Use a non-interaction event to avoid affecting bounce rate.
    non_interaction: true,
  });
}

getCLS(sendToGoogleAnalytics);
getFID(sendToGoogleAnalytics);
getLCP(sendToGoogleAnalytics);
```

### Send the results to Google Tag Manager

The following example measures each of the Core Web Vitals metrics and sends them as separate `dataLayer-events` to be used by Google Tag Manager. With the `web-vitals` trigger you send the metrics to any tag inside your account (see [this comment](https://github.com/GoogleChrome/web-vitals/pull/28#discussion_r422701126) for implementation details).

```js
import {getCLS, getFID, getLCP} from 'web-vitals';

function sendToGTM({name, delta, id}) {
  // Assumes the global `dataLayer` array exists, see:
  // https://developers.google.com/tag-manager/devguide
  dataLayer.push({
    event: 'web-vitals',
    event_category: 'Web Vitals',
    event_action: name,
    // Google Analytics metrics must be integers, so the value is rounded.
    // For CLS the value is first multiplied by 1000 for greater precision
    // (note: increase the multiplier for greater precision if needed).
    event_value: Math.round(name === 'CLS' ? delta * 1000 : delta),
    // The `id` value will be unique to the current page load. When sending
    // multiple values from the same page (e.g. for CLS), Google Analytics can
    // compute a total by grouping on this ID (note: requires `eventLabel` to
    // be a dimension in your report).
    event_label: id,
  });
}

getCLS(sendToGTM);
getFID(sendToGTM);
getLCP(sendToGTM);
```

### Load `web-vitals` from a CDN

The recommended way to use the `web-vitals` package is to install it from npm and integrate it into your build process. However, if you're not using npm, it's still possible to use `web-vitals` by requesting it from a CDN that serves npm package files.

The following examples show how to load `web-vitals` from [unpkg.com](https://unpkg.com) using either classic or module scripts:

```html
<!-- Load `web-vitals` using a classic script that sets the global `webVitals` object. -->
<script defer src="https://unpkg.com/web-vitals"></script>
<script>
addEventListener('DOMContentLoaded', function() {
  webVitals.getCLS(console.log);
  webVitals.getFID(console.log);
  webVitals.getLCP(console.log);
});
</script>
```

```html
<!-- Load `web-vitals` using a module script. -->
<script type="module">
  import {getCLS, getFID, getLCP} from 'https://unpkg.com/web-vitals?module';

  getCLS(console.log);
  getFID(console.log);
  getLCP(console.log);
</script>
```

_**Note:** it's safe to use module scripts in legacy browsers because unknown script types are ignored._

## Bundle options

The `web-vitals` library includes a base set of libraries as well as a polyfill script to improve [browser support](#browser-support) for some of the metrics (where possible).

The library is released as several different build versions, allowing developers to chose the version that best meets their needs or integrates with their architecture.

<table>
  <tr>
    <td width="35%">
      <strong>Filename</strong> <em>(all within <code>dist/*</code>)</em>
    </td>
    <td><strong>Export</strong></td>
    <td><strong>Description</strong></td>
  </tr>
  <tr>
    <td><code>web-vitals.full.js</code></td>
    <td><code>pkg.module</code></td>
    <td>
      <p>An ES module bundle of all metric functions, including a minimal polyfill to support back/forward cache restores.</p>
      Using the "full" bundle is the simplest way to consume this library out of the box.
    </td>
  </tr>
  <tr>
    <td><code>web-vitals.full.umd.js</code></td>
    <td><code>pgk.main</code></td>
    <td>
      A UMD version of <code>web-vitals.full.js</code> (exposed on the <code>window.webVitals.*</code> namespace).
    </td>
  </tr>
  <tr>
    <td><code>web-vitals.base.js</code></td>
    <td>--</td>
    <td>
      <p>An ES module bundle of the <code>web-vitals</code> library without any polyfills included.</p>
      Use this bundle if (and only if) you've also added the <code>polyfill.js</code> script to the <code>&lt;head&gt;</code> of your pages. See <a href="#how-to-use-the-polyfill">how to use the polyfill</a> for more details.
    </td>
  </tr>
  <tr>
    <td><code>polyfill.js</code></td>
    <td>--</td>
    <td>
      A set of small polyfills that expands browser supports (including back/forward cache restores) and fills in some measurements gaps. See <a href="#how-to-use-the-polyfill">how to use the polyfill</a> for more details.
    </td>
  </tr>
</table>

### Which bundle is right for you?

Most developers will generally want to use the "full" bundle (either the ES module or UMD version, depending on your build system), as it's the easiest to use out of the box and integrate into existing build tools.

However, there are a few good reasons to consider using the "base" version along with the `polyfill.js` script. For example:

- FID can be measured in all browsers.
- FCP, FID, and LCP will be more accurate in some cases (since the polyfill detects the page's initial `visibilityState` earlier).

Also, the minimal polyfill to support back/forward cache restores that is found in the "full" version is largely the same as the code used in the `polyfill.js` script—just split out. This means that using the polyfill gets you wider browser support and more accurate results with almost no increased code cost (just increased implementation complexity).

### How to use the polyfill

Using the polyfill is a two step process:

**1. Inline the code from `polyfill.js` into the `<head>` of your pages.**

For the polyfill to work, it must be added to the `<head>`. The polyfill adds event listeners and records initial page visibility state, and that must happen before any other code runs or the page is rendered.

The polyfill is quite small (~0.5 KiB, gzipped), so it can be inlined to avoid a blocking request.

**2) Import the "base" build of the library**

In your application code, import the "base" build rather than the "full" build. To do this, change any `import` statements to reference `web-vitals/base` rather than `web-vitals`:

```diff
- import {getLCP, getFID, getCLS} from 'web-vitals';
+ import {getLCP, getFID, getCLS} from 'web-vitals/base';
```

All other usage instructions (as well as the public API) are the same in both versions.

_**Note:** while it's certainly possible to copy and paste the code in `polyfill.js` directly into your templates (for step #1 above), it's better to automate this within your build process—otherwise you risk the polyfill and base scripts getting out of sync when new versions are released._

## API

### Types:

#### `Metric`

```ts
interface Metric {
  // The name of the metric (in acronym form).
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB';

  // The current value of the metric.
  value: number;

  // The delta between the current value and the last-reported value.
  // On the first report, `delta` and `value` will always be the same.
  delta: number;

  // A unique ID representing this particular metric that's specific to the
  // current page. This ID can be used by an analytics tool to dedupe
  // multiple values sent for the same metric, or to group multiple deltas
  // together and calculate a total.
  id: string;

  // Any performance entries used in the metric value calculation.
  // Note, entries will be added to the array as the value changes.
  entries: PerformanceEntry[];
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

Calculates the [CLS](https://web.dev/cls/) value for the current page and calls the `onReport` function once the value is ready to be reported, along with all `layout-shift` performance entries that were used in the metric value calculation. The reported value is a [double](https://heycam.github.io/webidl/#idl-double) (corresponding to a [layout shift value](https://wicg.github.io/layout-instability/#layout-shift-value)).

If the `reportAllChanges` param is `true`, the `onReport` function will be called any time a new `layout-shift` performance entry is dispatched, or once the final value of the metric has been determined.

_**Important:** unlike other metrics, CLS continues to monitor changes for the entire lifespan of the page&mdash;including if the user returns to the page after it's been hidden/backgrounded. However, since browsers often [will not fire additional callbacks once the user has backgrounded a page](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#advice-hidden), `onReport` is always called when the page's visibility state changes to hidden. As a result, the `onReport` function might be called multiple times during the same page load (see [Reporting only the delta of changes](#report-only-the-delta-of-changes) for how to manage this)._

#### `getFCP()`

```ts
type getFCP = (onReport: ReportHandler, reportAllChanges?: boolean) => void
```

Calculates the [FCP](https://web.dev/fcp/) value for the current page and calls the `onReport` function once the value is ready, along with the relevant `paint` performance entry used to determine the value. The reported value is a `DOMHighResTimeStamp`.

#### `getFID()`

```ts
type getFID = (onReport: ReportHandler, reportAllChanges?: boolean) => void
```

Calculates the [FID](https://web.dev/fid/) value for the current page and calls the `onReport` function once the value is ready, along with the relevant `first-input` performance entry used to determine the value (and optionally the input event if using the [FID polyfill](#fid-polyfill)). The reported value is a `DOMHighResTimeStamp`.

_**Important:** since FID is only reported after the user interacts with the page, it's possible that it will not be reported for some page loads._

#### `getLCP()`

```ts
type getLCP = (onReport: ReportHandler, reportAllChanges?: boolean) => void
```

Calculates the [LCP](https://web.dev/lcp/) value for the current page and calls the `onReport` function once the value is ready (along with the relevant `largest-contentful-paint` performance entries used to determine the value). The reported value is a `DOMHighResTimeStamp`.

If the `reportAllChanges` param is `true`, the `onReport` function will be called any time a new `largest-contentful-paint` performance entry is dispatched, or once the final value of the metric has been determined.

#### `getTTFB()`

```ts
type getTTFB = (onReport: ReportHandler, reportAllChanges?: boolean) => void
```

Calculates the [TTFB](https://web.dev/time-to-first-byte/) value for the current page and calls the `onReport` function once the page has loaded, along with the relevant `navigation` performance entry used to determine the value. The reported value is a `DOMHighResTimeStamp`.

Note, this function waits until after the page is loaded to call `onReport` in order to ensure all properties of the `navigation` entry are populated. This is useful if you want to report on other metrics exposed by the [Navigation Timing API](https://w3c.github.io/navigation-timing/).

For example, the TTFB metric starts from the page's [time origin](https://www.w3.org/TR/hr-time-2/#sec-time-origin), which means it [includes](https://developers.google.com/web/fundamentals/performance/navigation-and-resource-timing#the_life_and_timings_of_a_network_request) time spent on DNS lookup, connection negotiation, network latency, and unloading the previous document. If, in addition to TTFB, you want a metric that excludes these timings and _just_ captures the time spent making the request and receiving the first byte of the response, you could compute that from data found on the performance entry:

```js
import {getTTFB} from 'web-vitals';

getTTFB((metric) => {
  // Calculate the request time by subtracting from TTFB
  // everything that happened prior to the request starting.
  const requestTime = metric.value - metric.entries[0].requestStart;
  console.log('Request time:', requestTime);
});
```

_**Note:** browsers that do not support `navigation` entries will fall back to
using `performance.timing` (with the timestamps converted from epoch time to `DOMHighResTimeStamp`). This ensures code referencing these values (like in the example above) will work the same in all browsers._

## Browser Support

The `web-vitals` code has been tested and will run without error in all major browsers as well as Internet Explorer back to version 9. However, some of the APIs required to capture these metrics are currently only available in Chromium-based browsers (e.g. Chrome, Edge, Opera, Samsung Internet).

Browser support for each function is as follows:

- `getCLS()`: Chromium,
- `getFCP()`: Chromium, Safari Technology Preview
- `getFID()`: Chromium, Firefox, Safari, Internet Explorer (with the [polyfill](#how-to-use-the-polyfill))
- `getLCP()`: Chromium
- `getTTFB()`: Chromium, Firefox, Safari, Internet Explorer

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
