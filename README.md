# `web-vitals`

- [Overview](#overview)
- [Install and load the library](#installation)
  - [From npm](#import-web-vitals-from-npm)
  - [From a CDN](#load-web-vitals-from-a-cdn)
- [Usage](#usage)
  - [Basic usage](#basic-usage)
  - [Report the value on every change](#report-the-value-on-every-change)
  - [Report only the delta of changes](#report-only-the-delta-of-changes)
  - [Send the results to an analytics endpoint](#send-the-results-to-an-analytics-endpoint)
  - [Send the results to Google Analytics](#send-the-results-to-google-analytics)
  - [Send the results to Google Tag Manager](#send-the-results-to-google-tag-manager)
  - [Send attribution data](#send-attribution-data)
  - [Batch multiple reports together](#batch-multiple-reports-together)
- [Build options](#build-options)
  - [Which build is right for you?](#which-build-is-right-for-you)
  - [How the polyfill works](#how-the-polyfill-works)
- [API](#api)
  - [Types](#types)
  - [Functions](#functions)
  - [Rating Thresholds](#rating-thresholds)
  - [Attribution](#attribution)
- [Browser Support](#browser-support)
- [Limitations](#limitations)
- [Development](#development)
- [Integrations](#integrations)
- [License](#license)

## Overview

The `web-vitals` library is a tiny (~1.5K, brotli'd), modular library for measuring all the [Web Vitals](https://web.dev/articles/vitals) metrics on real users, in a way that accurately matches how they're measured by Chrome and reported to other Google tools (e.g. [Chrome User Experience Report](https://developers.google.com/web/tools/chrome-user-experience-report), [Page Speed Insights](https://developers.google.com/speed/pagespeed/insights/), [Search Console's Speed Report](https://webmasters.googleblog.com/2019/11/search-console-speed-report.html)).

The library supports all of the [Core Web Vitals](https://web.dev/articles/vitals#core_web_vitals) as well as a number of other metrics that are useful in diagnosing [real-user](https://web.dev/articles/user-centric-performance-metrics) performance issues.

### Core Web Vitals

- [Cumulative Layout Shift (CLS)](https://web.dev/articles/cls)
- [First Input Delay (FID)](https://web.dev/articles/fid)
- [Largest Contentful Paint (LCP)](https://web.dev/articles/lcp)

### Other metrics

- [Interaction to next Paint (INP)](https://web.dev/articles/inp)
- [First Contentful Paint (FCP)](https://web.dev/articles/fcp)
- [Time to First Byte (TTFB)](https://web.dev/articles/ttfb)

<a name="installation"><a>
<a name="load-the-library"><a>

## Install and load the library

<a name="import-web-vitals-from-npm"><a>

The `web-vitals` library uses the `buffered` flag for [PerformanceObserver](https://developer.mozilla.org/docs/Web/API/PerformanceObserver/observe), allowing it to access performance entries that occurred before the library was loaded.

This means you do not need to load this library early in order to get accurate performance data. In general, this library should be deferred until after other user-impacting code has loaded.

### From npm

You can install this library from npm by running:

```sh
npm install web-vitals
```

_**Note:** If you're not using npm, you can still load `web-vitals` via `<script>` tags from a CDN like [unpkg.com](https://unpkg.com). See the [load `web-vitals` from a CDN](#load-web-vitals-from-a-cdn) usage example below for details._

There are a few different builds of the `web-vitals` library, and how you load the library depends on which build you want to use.

For details on the difference between the builds, see <a href="#which-build-is-right-for-you">which build is right for you</a>.

**1. The "standard" build**

To load the "standard" build, import modules from the `web-vitals` package in your application code (as you would with any npm package and node-based build tool):

```js
import {onLCP, onFID, onCLS} from 'web-vitals';

onCLS(console.log);
onFID(console.log);
onLCP(console.log);
```

_**Note:** in version 2, these functions were named `getXXX()` rather than `onXXX()`. They've [been renamed](https://github.com/GoogleChrome/web-vitals/pull/222) in version 3 to reduce confusion (see [#217](https://github.com/GoogleChrome/web-vitals/pull/217) for details) and will continue to be available using the `getXXX()` until at least version 4. Users are encouraged to switch to the new names, though, for future compatibility._

<a name="attribution-build"><a>

**2. The "attribution" build**

Measuring the Web Vitals scores for your real users is a great first step toward optimizing the user experience. But if your scores aren't _good_, the next step is to understand why they're not good and work to improve them.

The "attribution" build helps you do that by including additional diagnostic information with each metric to help you identify the root cause of poor performance as well as prioritize the most important things to fix.

The "attribution" build is slightly larger than the "standard" build (by about 600 bytes, brotli'd), so while the code size is still small, it's only recommended if you're actually using these features.

To load the "attribution" build, change any `import` statements that reference `web-vitals` to `web-vitals/attribution`:

```diff
- import {onLCP, onFID, onCLS} from 'web-vitals';
+ import {onLCP, onFID, onCLS} from 'web-vitals/attribution';
```

Usage for each of the imported function is identical to the standard build, but when importing from the attribution build, the [`Metric`](#metric) object will contain an additional [`attribution`](#metricwithattribution) property.

See [Send attribution data](#send-attribution-data) for usage examples, and the [`attribution` reference](#attribution) for details on what values are added for each metric.

<a name="how-to-use-the-polyfill"><a>

**3. The "base+polyfill" build**

_**⚠️ Warning ⚠️** the "base+polyfill" build is deprecated. See [#238](https://github.com/GoogleChrome/web-vitals/issues/238) for details._

Loading the "base+polyfill" build is a two-step process:

First, in your application code, import the "base" build rather than the "standard" build. To do this, change any `import` statements that reference `web-vitals` to `web-vitals/base`:

```diff
- import {onLCP, onFID, onCLS} from 'web-vitals';
+ import {onLCP, onFID, onCLS} from 'web-vitals/base';
```

Then, inline the code from `dist/polyfill.js` into the `<head>` of your pages. This step is important since the "base" build will error if the polyfill code has not been added.

```html
<!doctype html>
<html>
  <head>
    <script>
      // Inline code from `dist/polyfill.js` here
    </script>
  </head>
  <body>
    ...
  </body>
</html>
```

It's important that the code is inlined directly into the HTML. _Do not link to an external script file, as that will negatively affect performance:_

```html
<!-- GOOD -->
<script>
  // Inline code from `dist/polyfill.js` here
</script>

<!-- BAD! DO NOT DO! -->
<script src="/path/to/polyfill.js"></script>
```

Also note that the code _must_ go in the `<head>` of your pages in order to work. See [how the polyfill works](#how-the-polyfill-works) for more details.

_**Tip:** while it's certainly possible to inline the code in `dist/polyfill.js` by copy and pasting it directly into your templates, it's better to automate this process in a build step—otherwise you risk the "base" and the "polyfill" scripts getting out of sync when new versions are released._

<a name="load-web-vitals-from-a-cdn"><a>

### From a CDN

The recommended way to use the `web-vitals` package is to install it from npm and integrate it into your build process. However, if you're not using npm, it's still possible to use `web-vitals` by requesting it from a CDN that serves npm package files.

The following examples show how to load `web-vitals` from [unpkg.com](https://unpkg.com):

_**Important!** The [unpkg.com](https://unpkg.com) CDN is shown here for example purposes only. `unpkg.com` is not affiliated with Google, and there are no guarantees that the URLs shown in these examples will continue to work in the future._

**Load the "standard" build** _(using a module script)_

```html
<!-- Append the `?module` param to load the module version of `web-vitals` -->
<script type="module">
  import {onCLS, onFID, onLCP} from 'https://unpkg.com/web-vitals@3?module';

  onCLS(console.log);
  onFID(console.log);
  onLCP(console.log);
</script>
```

**Load the "standard" build** _(using a classic script)_

```html
<script>
  (function () {
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js';
    script.onload = function () {
      // When loading `web-vitals` using a classic script, all the public
      // methods can be found on the `webVitals` global namespace.
      webVitals.onCLS(console.log);
      webVitals.onFID(console.log);
      webVitals.onLCP(console.log);
    };
    document.head.appendChild(script);
  })();
</script>
```

**Load the "attribution" build** _(using a module script)_

```html
<!-- Append the `?module` param to load the module version of `web-vitals` -->
<script type="module">
  import {
    onCLS,
    onFID,
    onLCP,
  } from 'https://unpkg.com/web-vitals@3/dist/web-vitals.attribution.js?module';

  onCLS(console.log);
  onFID(console.log);
  onLCP(console.log);
</script>
```

**Load the "attribution" build** _(using a classic script)_

```html
<script>
  (function () {
    var script = document.createElement('script');
    script.src =
      'https://unpkg.com/web-vitals@3/dist/web-vitals.attribution.iife.js';
    script.onload = function () {
      // When loading `web-vitals` using a classic script, all the public
      // methods can be found on the `webVitals` global namespace.
      webVitals.onCLS(console.log);
      webVitals.onFID(console.log);
      webVitals.onLCP(console.log);
    };
    document.head.appendChild(script);
  })();
</script>
```

## Usage

### Basic usage

Each of the Web Vitals metrics is exposed as a single function that takes a `callback` function that will be called any time the metric value is available and ready to be reported.

The following example measures each of the Core Web Vitals metrics and logs the result to the console once its value is ready to report.

_(The examples below import the "standard" build, but they will work with the "attribution" build as well.)_

```js
import {onCLS, onFID, onLCP} from 'web-vitals';

onCLS(console.log);
onFID(console.log);
onLCP(console.log);
```

Note that some of these metrics will not report until the user has interacted with the page, switched tabs, or the page starts to unload. If you don't see the values logged to the console immediately, try reloading the page (with [preserve log](https://developer.chrome.com/docs/devtools/console/reference/#persist) enabled) or switching tabs and then switching back.

Also, in some cases a metric callback may never be called:

- FID and INP are not reported if the user never interacts with the page.
- CLS, FCP, FID, and LCP are not reported if the page was loaded in the background.

In other cases, a metric callback may be called more than once:

- CLS and INP should be reported any time the [page's `visibilityState` changes to hidden](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden).
- All metrics are reported again (with the above exceptions) after a page is restored from the [back/forward cache](https://web.dev/articles/bfcache).

_**Warning:** do not call any of the Web Vitals functions (e.g. `onCLS()`, `onFID()`, `onLCP()`) more than once per page load. Each of these functions creates a `PerformanceObserver` instance and registers event listeners for the lifetime of the page. While the overhead of calling these functions once is negligible, calling them repeatedly on the same page may eventually result in a memory leak._

### Report the value on every change

In most cases, you only want the `callback` function to be called when the metric is ready to be reported. However, it is possible to report every change (e.g. each larger layout shift as it happens) by setting `reportAllChanges` to `true` in the optional, [configuration object](#reportopts) (second parameter).

_**Important:** `reportAllChanges` only reports when the **metric changes**, not for each **input to the metric**. For example, a new layout shift that does not increase the CLS metric will not be reported even with `reportAllChanges` set to `true` because the CLS metric has not changed. Similarly, for INP, each interaction is not reported even with `reportAllChanges` set to `true`—just when an interaction causes an increase to INP._

This can be useful when debugging, but in general using `reportAllChanges` is not needed (or recommended) for measuring these metrics in production.

```js
import {onCLS} from 'web-vitals';

// Logs CLS as the value changes.
onCLS(console.log, {reportAllChanges: true});
```

### Report only the delta of changes

Some analytics providers allow you to update the value of a metric, even after you've already sent it to their servers (overwriting the previously-sent value with the same `id`).

Other analytics providers, however, do not allow this, so instead of reporting the new value, you need to report only the delta (the difference between the current value and the last-reported value). You can then compute the total value by summing all metric deltas sent with the same ID.

The following example shows how to use the `id` and `delta` properties:

```js
import {onCLS, onFID, onLCP} from 'web-vitals';

function logDelta({name, id, delta}) {
  console.log(`${name} matching ID ${id} changed by ${delta}`);
}

onCLS(logDelta);
onFID(logDelta);
onLCP(logDelta);
```

_**Note:** the first time the `callback` function is called, its `value` and `delta` properties will be the same._

In addition to using the `id` field to group multiple deltas for the same metric, it can also be used to differentiate different metrics reported on the same page. For example, after a back/forward cache restore, a new metric object is created with a new `id` (since back/forward cache restores are considered separate page visits).

### Send the results to an analytics endpoint

The following example measures each of the Core Web Vitals metrics and reports them to a hypothetical `/analytics` endpoint, as soon as each is ready to be sent.

The `sendToAnalytics()` function uses the [`navigator.sendBeacon()`](https://developer.mozilla.org/docs/Web/API/Navigator/sendBeacon) method (if available), but falls back to the [`fetch()`](https://developer.mozilla.org/docs/Web/API/Fetch_API) API when not.

```js
import {onCLS, onFID, onLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  // Replace with whatever serialization method you prefer.
  // Note: JSON.stringify will likely include more data than you need.
  const body = JSON.stringify(metric);

  // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
  (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
    fetch('/analytics', {body, method: 'POST', keepalive: true});
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
```

### Send the results to Google Analytics

Google Analytics does not support reporting metric distributions in any of its built-in reports; however, if you set a unique event parameter value (in this case, the metric_id, as shown in the example below) on every metric instance that you send to Google Analytics, you can create a report yourself by first getting the data via the [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) or via [BigQuery export](https://support.google.com/analytics/answer/9358801) and then visualizing it any charting library you choose.

[Google Analytics 4](https://support.google.com/analytics/answer/10089681) introduces a new Event model allowing custom parameters instead of a fixed category, action, and label. It also supports non-integer values, making it easier to measure Web Vitals metrics compared to previous versions.

```js
import {onCLS, onFID, onLCP} from 'web-vitals';

function sendToGoogleAnalytics({name, delta, value, id}) {
  // Assumes the global `gtag()` function exists, see:
  // https://developers.google.com/analytics/devguides/collection/ga4
  gtag('event', name, {
    // Built-in params:
    value: delta, // Use `delta` so the value can be summed.
    // Custom params:
    metric_id: id, // Needed to aggregate events.
    metric_value: value, // Optional.
    metric_delta: delta, // Optional.

    // OPTIONAL: any additional params or debug info here.
    // See: https://web.dev/articles/debug-performance-in-the-field
    // metric_rating: 'good' | 'needs-improvement' | 'poor',
    // debug_info: '...',
    // ...
  });
}

onCLS(sendToGoogleAnalytics);
onFID(sendToGoogleAnalytics);
onLCP(sendToGoogleAnalytics);
```

For details on how to query this data in [BigQuery](https://cloud.google.com/bigquery), or visualise it in [Looker Studio](https://lookerstudio.google.com/), see [Measure and debug performance with Google Analytics 4 and BigQuery](https://web.dev/articles/vitals-ga4).

### Send the results to Google Tag Manager

The recommended way to measure Web Vitals metrics with Google Tag Manager is using the [Core Web Vitals](https://www.simoahava.com/custom-templates/core-web-vitals/) custom template tag created and maintained by [Simo Ahava](https://www.simoahava.com/).

For full installation and usage instructions, see Simo's post: [Track Core Web Vitals in GA4 with Google Tag Manager](https://www.simoahava.com/analytics/track-core-web-vitals-in-ga4-with-google-tag-manager/).

### Send attribution data

When using the [attribution build](#attribution-build), you can send additional data to help you debug _why_ the metric values are they way they are.

This example sends an additional `debug_target` param to Google Analytics, corresponding to the element most associated with each metric.

```js
import {onCLS, onFID, onLCP} from 'web-vitals/attribution';

function sendToGoogleAnalytics({name, delta, value, id, attribution}) {
  const eventParams = {
    // Built-in params:
    value: delta, // Use `delta` so the value can be summed.
    // Custom params:
    metric_id: id, // Needed to aggregate events.
    metric_value: value, // Optional.
    metric_delta: delta, // Optional.
  };

  switch (name) {
    case 'CLS':
      eventParams.debug_target = attribution.largestShiftTarget;
      break;
    case 'FID':
      eventParams.debug_target = attribution.eventTarget;
      break;
    case 'LCP':
      eventParams.debug_target = attribution.element;
      break;
  }

  // Assumes the global `gtag()` function exists, see:
  // https://developers.google.com/analytics/devguides/collection/ga4
  gtag('event', name, eventParams);
}

onCLS(sendToGoogleAnalytics);
onFID(sendToGoogleAnalytics);
onLCP(sendToGoogleAnalytics);
```

_**Note:** this example relies on custom [event parameters](https://support.google.com/analytics/answer/11396839) in Google Analytics 4._

See [Debug performance in the field](https://web.dev/articles/debug-performance-in-the-field) for more information and examples.

### Batch multiple reports together

Rather than reporting each individual Web Vitals metric separately, you can minimize your network usage by batching multiple metric reports together in a single network request.

However, since not all Web Vitals metrics become available at the same time, and since not all metrics are reported on every page, you cannot simply defer reporting until all metrics are available.

Instead, you should keep a queue of all metrics that were reported and flush the queue whenever the page is backgrounded or unloaded:

```js
import {onCLS, onFID, onLCP} from 'web-vitals';

const queue = new Set();
function addToQueue(metric) {
  queue.add(metric);
}

function flushQueue() {
  if (queue.size > 0) {
    // Replace with whatever serialization method you prefer.
    // Note: JSON.stringify will likely include more data than you need.
    const body = JSON.stringify([...queue]);

    // Use `navigator.sendBeacon()` if available, falling back to `fetch()`.
    (navigator.sendBeacon && navigator.sendBeacon('/analytics', body)) ||
      fetch('/analytics', {body, method: 'POST', keepalive: true});

    queue.clear();
  }
}

onCLS(addToQueue);
onFID(addToQueue);
onLCP(addToQueue);

// Report all available metrics whenever the page is backgrounded or unloaded.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    flushQueue();
  }
});

// NOTE: Safari does not reliably fire the `visibilitychange` event when the
// page is being unloaded. If Safari support is needed, you should also flush
// the queue in the `pagehide` event.
addEventListener('pagehide', flushQueue);
```

_**Note:** see [the Page Lifecycle guide](https://developers.google.com/web/updates/2018/07/page-lifecycle-api#legacy-lifecycle-apis-to-avoid) for an explanation of why `visibilitychange` and `pagehide` are recommended over events like `beforeunload` and `unload`._

<a name="bundle-versions"><a>

## Build options

The `web-vitals` package includes builds for the "standard", "attribution", and "base+polyfill" ([deprecated](https://github.com/GoogleChrome/web-vitals/issues/238)) builds, as well as different formats of each to allow developers to choose the format that best meets their needs or integrates with their architecture.

The following table lists all the builds distributed with the `web-vitals` package on npm.

<table>
  <tr>
    <td width="35%">
      <strong>Filename</strong> <em>(all within <code>dist/*</code>)</em>
    </td>
    <td><strong>Export</strong></td>
    <td><strong>Description</strong></td>
  </tr>
  <tr>
    <td><code>web-vitals.js</code></td>
    <td><code>pkg.module</code></td>
    <td>
      <p>An ES module bundle of all metric functions, without any attribution features.</p>
      This is the "standard" build and is the simplest way to consume this library out of the box.
    </td>
  </tr>
  <tr>
    <td><code>web-vitals.umd.cjs</code></td>
    <td><code>pkg.main</code></td>
    <td>
      A UMD version of the <code>web-vitals.js</code> bundle (exposed on the <code>window.webVitals.*</code> namespace).
    </td>
  </tr>
  <tr>
    <td><code>web-vitals.iife.js</code></td>
    <td>--</td>
    <td>
      An IIFE version of the <code>web-vitals.js</code> bundle (exposed on the <code>window.webVitals.*</code> namespace).
    </td>
  </tr>
  <tr>
    <td><code>web-vitals.attribution.js</code></td>
    <td>--</td>
    <td>
      An ES module version of all metric functions that includes <a href="#attribution-build">attribution</a> features.
    </td>
  </tr>
    <tr>
    <td><code>web-vitals.attribution.umd.cjs</code></td>
    <td>--</td>
    <td>
      A UMD version of the <code>web-vitals.attribution.js</code> build (exposed on the <code>window.webVitals.*</code> namespace).
    </td>
  </tr>
  </tr>
    <tr>
    <td><code>web-vitals.attribution.iife.js</code></td>
    <td>--</td>
    <td>
      An IIFE version of the <code>web-vitals.attribution.js</code> build (exposed on the <code>window.webVitals.*</code> namespace).
    </td>
  </tr>
  <tr>
    <td><code>web-vitals.base.js</code></td>
    <td>--</td>
    <td>
      <p><strong>This build has been <a href="https://github.com/GoogleChrome/web-vitals/issues/238">deprecated</a>.</strong></p>
      <p>An ES module bundle containing just the "base" part of the "base+polyfill" version.</p>
      Use this bundle if (and only if) you've also added the <code>polyfill.js</code> script to the <code>&lt;head&gt;</code> of your pages. See <a href="#how-to-use-the-polyfill">how to use the polyfill</a> for more details.
    </td>
  </tr>
    <tr>
    <td><code>web-vitals.base.umd.cjs</code></td>
    <td>--</td>
    <td>
      <p><strong>This build has been <a href="https://github.com/GoogleChrome/web-vitals/issues/238">deprecated</a>.</strong></p>
      <p>A UMD version of the <code>web-vitals.base.js</code> bundle (exposed on the <code>window.webVitals.*</code> namespace).</p>
    </td>
  </tr>
  </tr>
    <tr>
    <td><code>web-vitals.base.iife.js</code></td>
    <td>--</td>
    <td>
      <p><strong>This build has been <a href="https://github.com/GoogleChrome/web-vitals/issues/238">deprecated</a>.</strong></p>
      <p>An IIFE version of the <code>web-vitals.base.js</code> bundle (exposed on the <code>window.webVitals.*</code> namespace).</p>
    </td>
  </tr>
  <tr>
    <td><code>polyfill.js</code></td>
    <td>--</td>
    <td>
      <p><strong>This build has been <a href="https://github.com/GoogleChrome/web-vitals/issues/238">deprecated</a>.</strong></p>
      <p>The "polyfill" part of the "base+polyfill" version. This script should be used with either <code>web-vitals.base.js</code>, <code>web-vitals.base.umd.cjs</code>, or <code>web-vitals.base.iife.js</code> (it will not work with any script that doesn't have "base" in the filename).</p>
      See <a href="#how-to-use-the-polyfill">how to use the polyfill</a> for more details.
    </td>
  </tr>
</table>

<a name="which-build-is-right-for-you"><a>

### Which build is right for you?

Most developers will generally want to use "standard" build (via either the ES module or UMD version, depending on your bundler/build system), as it's the easiest to use out of the box and integrate into existing tools.

However, if you'd lke to collect additional debug information to help you diagnose performance bottlenecks based on real-user issues, use the ["attribution" build](#attribution-build).

For guidance on how to collect and use real-user data to debug performance issues, see [Debug performance in the field](https://web.dev/debug-performance-in-the-field/).

### How the polyfill works

_**⚠️ Warning ⚠️** the "base+polyfill" build is deprecated. See [#238](https://github.com/GoogleChrome/web-vitals/issues/238) for details._

The `polyfill.js` script adds event listeners (to track FID cross-browser), and it records initial page visibility state as well as the timestamp of the first visibility change to hidden (to improve the accuracy of CLS, FCP, LCP, and FID). It also polyfills the [Navigation Timing API Level 2](https://www.w3.org/TR/navigation-timing-2/) in browsers that only support the original (now deprecated) [Navigation Timing API](https://www.w3.org/TR/navigation-timing/).

In order for the polyfill to work properly, the script must be the first script added to the page, and it must run before the browser renders any content to the screen. This is why it needs to be added to the `<head>` of the document.

The "standard" build of the `web-vitals` library includes some of the same logic found in `polyfill.js`. To avoid duplicating that code when using the "base+polyfill" build, the `web-vitals.base.js` bundle does not include any polyfill logic, instead it coordinates with the code in `polyfill.js`, which is why the two scripts must be used together.

## API

### Types:

#### `Metric`

```ts
interface Metric {
  /**
   * The name of the metric (in acronym form).
   */
  name: 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB';

  /**
   * The current value of the metric.
   */
  value: number;

  /**
   * The rating as to whether the metric value is within the "good",
   * "needs improvement", or "poor" thresholds of the metric.
   */
  rating: 'good' | 'needs-improvement' | 'poor';

  /**
   * The delta between the current value and the last-reported value.
   * On the first report, `delta` and `value` will always be the same.
   */
  delta: number;

  /**
   * A unique ID representing this particular metric instance. This ID can
   * be used by an analytics tool to dedupe multiple values sent for the same
   * metric instance, or to group multiple deltas together and calculate a
   * total. It can also be used to differentiate multiple different metric
   * instances sent from the same page, which can happen if the page is
   * restored from the back/forward cache (in that case new metrics object
   * get created).
   */
  id: string;

  /**
   * Any performance entries relevant to the metric value calculation.
   * The array may also be empty if the metric value was not based on any
   * entries (e.g. a CLS value of 0 given no layout shifts).
   */
  entries: (
    | PerformanceEntry
    | LayoutShift
    | FirstInputPolyfillEntry
    | NavigationTimingPolyfillEntry
  )[];

  /**
   * The type of navigation.
   *
   * This will be the value returned by the Navigation Timing API (or
   * `undefined` if the browser doesn't support that API), with the following
   * exceptions:
   * - 'back-forward-cache': for pages that are restored from the bfcache.
   * - 'prerender': for pages that were prerendered.
   * - 'restore': for pages that were discarded by the browser and then
   * restored by the user.
   */
  navigationType:
    | 'navigate'
    | 'reload'
    | 'back-forward'
    | 'back-forward-cache'
    | 'prerender'
    | 'restore';
}
```

Metric-specific subclasses:

- [`CLSMetric`](/src/types/cls.ts#:~:text=interface%20CLSMetric)
- [`FCPMetric`](/src/types/fcp.ts#:~:text=interface%20FCPMetric)
- [`FIDMetric`](/src/types/fid.ts#:~:text=interface%20FIDMetric)
- [`INPMetric`](/src/types/inp.ts#:~:text=interface%20INPMetric)
- [`LCPMetric`](/src/types/lcp.ts#:~:text=interface%20LCPMetric)
- [`TTFBMetric`](/src/types/ttfb.ts#:~:text=interface%20TTFBMetric)

#### `MetricWithAttribution`

See the [attribution build](#attribution-build) section for details on how to use this feature.

```ts
interface MetricWithAttribution extends Metric {
  /**
   * An object containing potentially-helpful debugging information that
   * can be sent along with the metric value for the current page visit in
   * order to help identify issues happening to real-users in the field.
   */
  attribution: {[key: string]: unknown};
}
```

Metric-specific subclasses:

- [`CLSMetricWithAttribution`](/src/types/cls.ts#:~:text=interface%20CLSMetricWithAttribution)
- [`FCPMetricWithAttribution`](/src/types/fcp.ts#:~:text=interface%20FCPMetricWithAttribution)
- [`FIDMetricWithAttribution`](/src/types/fid.ts#:~:text=interface%20FIDMetricWithAttribution)
- [`INPMetricWithAttribution`](/src/types/inp.ts#:~:text=interface%20INPMetricWithAttribution)
- [`LCPMetricWithAttribution`](/src/types/lcp.ts#:~:text=interface%20LCPMetricWithAttribution)
- [`TTFBMetricWithAttribution`](/src/types/ttfb.ts#:~:text=interface%20TTFBMetricWithAttribution)

#### `MetricRatingThresholds`

The thresholds of metric's "good", "needs improvement", and "poor" ratings.

- Metric values up to and including [0] are rated "good"
- Metric values up to and including [1] are rated "needs improvement"
- Metric values above [1] are "poor"

| Metric value    | Rating              |
| --------------- | ------------------- |
| ≦ [0]           | "good"              |
| > [0] and ≦ [1] | "needs improvement" |
| > [1]           | "poor"              |

```ts
export type MetricRatingThresholds = [number, number];
```

_See also [Rating Thresholds](#rating-thresholds)._

#### `ReportCallback`

```ts
interface ReportCallback {
  (metric: Metric): void;
}
```

Metric-specific subclasses:

- [`CLSReportCallback`](/src/types/cls.ts#:~:text=interface%20CLSReportCallback)
- [`FCPReportCallback`](/src/types/fcp.ts#:~:text=interface%20FCPReportCallback)
- [`FIDReportCallback`](/src/types/fid.ts#:~:text=interface%20FIDReportCallback)
- [`INPReportCallback`](/src/types/inp.ts#:~:text=interface%20INPReportCallback)
- [`LCPReportCallback`](/src/types/lcp.ts#:~:text=interface%20LCPReportCallback)
- [`TTFBReportCallback`](/src/types/ttfb.ts#:~:text=interface%20TTFBReportCallback)

#### `ReportOpts`

```ts
interface ReportOpts {
  reportAllChanges?: boolean;
  durationThreshold?: number;
}
```

#### `LoadState`

The `LoadState` type is used in several of the metric [attribution objects](#attribution).

```ts
/**
 * The loading state of the document. Note: this value is similar to
 * `document.readyState` but it subdivides the "interactive" state into the
 * time before and after the DOMContentLoaded event fires.
 *
 * State descriptions:
 * - `loading`: the initial document response has not yet been fully downloaded
 *   and parsed. This is equivalent to the corresponding `readyState` value.
 * - `dom-interactive`: the document has been fully loaded and parsed, but
 *   scripts may not have yet finished loading and executing.
 * - `dom-content-loaded`: the document is fully loaded and parsed, and all
 *   scripts (except `async` scripts) have loaded and finished executing.
 * - `complete`: the document and all of its sub-resources have finished
 *   loading. This is equivalent to the corresponding `readyState` value.
 */
type LoadState =
  | 'loading'
  | 'dom-interactive'
  | 'dom-content-loaded'
  | 'complete';
```

#### `FirstInputPolyfillEntry`

If using the "base+polyfill" build (and if the browser doesn't natively support the Event Timing API), the `metric.entries` reported by `onFID()` will contain an object that polyfills the `PerformanceEventTiming` entry:

```ts
type FirstInputPolyfillEntry = Omit<
  PerformanceEventTiming,
  'processingEnd' | 'toJSON'
>;
```

#### `FirstInputPolyfillCallback`

```ts
interface FirstInputPolyfillCallback {
  (entry: FirstInputPolyfillEntry): void;
}
```

#### `NavigationTimingPolyfillEntry`

If using the "base+polyfill" build (and if the browser doesn't support the [Navigation Timing API Level 2](https://www.w3.org/TR/navigation-timing-2/) interface), the `metric.entries` reported by `onTTFB()` will contain an object that polyfills the `PerformanceNavigationTiming` entry using timings from the legacy `performance.timing` interface:

```ts
type NavigationTimingPolyfillEntry = Omit<
  PerformanceNavigationTiming,
  | 'initiatorType'
  | 'nextHopProtocol'
  | 'redirectCount'
  | 'transferSize'
  | 'encodedBodySize'
  | 'decodedBodySize'
  | 'type'
> & {
  type: PerformanceNavigationTiming['type'];
};
```

#### `WebVitalsGlobal`

If using the "base+polyfill" build, the `polyfill.js` script creates the global `webVitals` namespace matching the following interface:

```ts
interface WebVitalsGlobal {
  firstInputPolyfill: (onFirstInput: FirstInputPolyfillCallback) => void;
  resetFirstInputPolyfill: () => void;
  firstHiddenTime: number;
}
```

### Functions:

#### `onCLS()`

```ts
type onCLS = (callback: CLSReportCallback, opts?: ReportOpts) => void;
```

Calculates the [CLS](https://web.dev/articles/cls) value for the current page and calls the `callback` function once the value is ready to be reported, along with all `layout-shift` performance entries that were used in the metric value calculation. The reported value is a [double](https://heycam.github.io/webidl/#idl-double) (corresponding to a [layout shift score](https://web.dev/articles/cls#layout_shift_score)).

If the `reportAllChanges` [configuration option](#reportopts) is set to `true`, the `callback` function will be called as soon as the value is initially determined as well as any time the value changes throughout the page lifespan (Note [not necessarily for every layout shift](#report-the-value-on-every-change)).

_**Important:** CLS should be continually monitored for changes throughout the entire lifespan of a page—including if the user returns to the page after it's been hidden/backgrounded. However, since browsers often [will not fire additional callbacks once the user has backgrounded a page](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden), `callback` is always called when the page's visibility state changes to hidden. As a result, the `callback` function might be called multiple times during the same page load (see [Reporting only the delta of changes](#report-only-the-delta-of-changes) for how to manage this)._

#### `onFCP()`

```ts
type onFCP = (callback: FCPReportCallback, opts?: ReportOpts) => void;
```

Calculates the [FCP](https://web.dev/articles/fcp) value for the current page and calls the `callback` function once the value is ready, along with the relevant `paint` performance entry used to determine the value. The reported value is a [`DOMHighResTimeStamp`](https://developer.mozilla.org/docs/Web/API/DOMHighResTimeStamp).

#### `onFID()`

```ts
type onFID = (callback: FIDReportCallback, opts?: ReportOpts) => void;
```

Calculates the [FID](https://web.dev/articles/fid) value for the current page and calls the `callback` function once the value is ready, along with the relevant `first-input` performance entry used to determine the value. The reported value is a [`DOMHighResTimeStamp`](https://developer.mozilla.org/docs/Web/API/DOMHighResTimeStamp).

_**Important:** since FID is only reported after the user interacts with the page, it's possible that it will not be reported for some page loads._

#### `onINP()`

```ts
type onINP = (callback: INPReportCallback, opts?: ReportOpts) => void;
```

Calculates the [INP](https://web.dev/articles/inp) value for the current page and calls the `callback` function once the value is ready, along with the `event` performance entries reported for that interaction. The reported value is a [`DOMHighResTimeStamp`](https://developer.mozilla.org/docs/Web/API/DOMHighResTimeStamp).

A custom `durationThreshold` [configuration option](#reportopts) can optionally be passed to control what `event-timing` entries are considered for INP reporting. The default threshold is `40`, which means INP scores of less than 40 are reported as 0. Note that this will not affect your 75th percentile INP value unless that value is also less than 40 (well below the recommended [good](https://web.dev/articles/inp#what_is_a_good_inp_score) threshold).

If the `reportAllChanges` [configuration option](#reportopts) is set to `true`, the `callback` function will be called as soon as the value is initially determined as well as any time the value changes throughout the page lifespan (Note [not necessarily for every interaction](#report-the-value-on-every-change)).

_**Important:** INP should be continually monitored for changes throughout the entire lifespan of a page—including if the user returns to the page after it's been hidden/backgrounded. However, since browsers often [will not fire additional callbacks once the user has backgrounded a page](https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden), `callback` is always called when the page's visibility state changes to hidden. As a result, the `callback` function might be called multiple times during the same page load (see [Reporting only the delta of changes](#report-only-the-delta-of-changes) for how to manage this)._

#### `onLCP()`

```ts
type onLCP = (callback: LCPReportCallback, opts?: ReportOpts) => void;
```

Calculates the [LCP](https://web.dev/articles/lcp) value for the current page and calls the `callback` function once the value is ready (along with the relevant `largest-contentful-paint` performance entry used to determine the value). The reported value is a [`DOMHighResTimeStamp`](https://developer.mozilla.org/docs/Web/API/DOMHighResTimeStamp).

If the `reportAllChanges` [configuration option](#reportopts) is set to `true`, the `callback` function will be called any time a new `largest-contentful-paint` performance entry is dispatched, or once the final value of the metric has been determined.

#### `onTTFB()`

```ts
type onTTFB = (callback: TTFBReportCallback, opts?: ReportOpts) => void;
```

Calculates the [TTFB](https://web.dev/articles/ttfb) value for the current page and calls the `callback` function once the page has loaded, along with the relevant `navigation` performance entry used to determine the value. The reported value is a [`DOMHighResTimeStamp`](https://developer.mozilla.org/docs/Web/API/DOMHighResTimeStamp).

Note, this function waits until after the page is loaded to call `callback` in order to ensure all properties of the `navigation` entry are populated. This is useful if you want to report on other metrics exposed by the [Navigation Timing API](https://w3c.github.io/navigation-timing/).

For example, the TTFB metric starts from the page's [time origin](https://www.w3.org/TR/hr-time-2/#sec-time-origin), which means it includes time spent on DNS lookup, connection negotiation, network latency, and server processing time.

```js
import {onTTFB} from 'web-vitals';

onTTFB((metric) => {
  // Calculate the request time by subtracting from TTFB
  // everything that happened prior to the request starting.
  const requestTime = metric.value - metric.entries[0].requestStart;
  console.log('Request time:', requestTime);
});
```

_**Note:** browsers that do not support `navigation` entries will fall back to
using `performance.timing` (with the timestamps converted from epoch time to [`DOMHighResTimeStamp`](https://developer.mozilla.org/docs/Web/API/DOMHighResTimeStamp)). This ensures code referencing these values (like in the example above) will work the same in all browsers._

### Rating Thresholds:

The thresholds of each metric's "good", "needs improvement", and "poor" ratings are available as [`MetricRatingThresholds`](#metricratingthresholds).

Example:

```ts
import {CLSThresholds, FIDThresholds, LCPThresholds} from 'web-vitals';

console.log(CLSThresholds); // [ 0.1, 0.25 ]
console.log(FIDThresholds); // [ 100, 300 ]
console.log(LCPThresholds); // [ 2500, 4000 ]
```

_**Note:** It's typically not necessary (or recommended) to manually calculate metric value ratings using these thresholds. Use the [`Metric['rating']`](#metric) supplied by the [`ReportCallback`](#reportcallback) functions instead._

### Attribution:

The following objects contain potentially-helpful debugging information that can be sent along with the metric values for the current page visit in order to help identify issues happening to real-users in the field.

See the [attribution build](#attribution-build) section for details on how to use this feature.

#### CLS `attribution`:

```ts
interface CLSAttribution {
  /**
   * A selector identifying the first element (in document order) that
   * shifted when the single largest layout shift contributing to the page's
   * CLS score occurred.
   */
  largestShiftTarget?: string;
  /**
   * The time when the single largest layout shift contributing to the page's
   * CLS score occurred.
   */
  largestShiftTime?: DOMHighResTimeStamp;
  /**
   * The layout shift score of the single largest layout shift contributing to
   * the page's CLS score.
   */
  largestShiftValue?: number;
  /**
   * The `LayoutShiftEntry` representing the single largest layout shift
   * contributing to the page's CLS score. (Useful when you need more than just
   * `largestShiftTarget`, `largestShiftTime`, and `largestShiftValue`).
   */
  largestShiftEntry?: LayoutShift;
  /**
   * The first element source (in document order) among the `sources` list
   * of the `largestShiftEntry` object. (Also useful when you need more than
   * just `largestShiftTarget`, `largestShiftTime`, and `largestShiftValue`).
   */
  largestShiftSource?: LayoutShiftAttribution;
  /**
   * The loading state of the document at the time when the largest layout
   * shift contribution to the page's CLS score occurred (see `LoadState`
   * for details).
   */
  loadState?: LoadState;
}
```

#### FCP `attribution`:

```ts
interface FCPAttribution {
  /**
   * The time from when the user initiates loading the page until when the
   * browser receives the first byte of the response (a.k.a. TTFB).
   */
  timeToFirstByte: number;
  /**
   * The delta between TTFB and the first contentful paint (FCP).
   */
  firstByteToFCP: number;
  /**
   * The loading state of the document at the time when FCP `occurred (see
   * `LoadState` for details). Ideally, documents can paint before they finish
   * loading (e.g. the `loading` or `dom-interactive` phases).
   */
  loadState: LoadState;
  /**
   * The `PerformancePaintTiming` entry corresponding to FCP.
   */
  fcpEntry?: PerformancePaintTiming;
  /**
   * The `navigation` entry of the current page, which is useful for diagnosing
   * general page load issues. This can be used to access `serverTiming` for example:
   * navigationEntry?.serverTiming
   */
  navigationEntry?: PerformanceNavigationTiming | NavigationTimingPolyfillEntry;
}
```

#### FID `attribution`:

```ts
interface FIDAttribution {
  /**
   * A selector identifying the element that the user interacted with. This
   * element will be the `target` of the `event` dispatched.
   */
  eventTarget: string;
  /**
   * The time when the user interacted. This time will match the `timeStamp`
   * value of the `event` dispatched.
   */
  eventTime: number;
  /**
   * The `type` of the `event` dispatched from the user interaction.
   */
  eventType: string;
  /**
   * The `PerformanceEventTiming` entry corresponding to FID (or the
   * polyfill entry in browsers that don't support Event Timing).
   */
  eventEntry: PerformanceEventTiming | FirstInputPolyfillEntry;
  /**
   * The loading state of the document at the time when the first interaction
   * occurred (see `LoadState` for details). If the first interaction occurred
   * while the document was loading and executing script (e.g. usually in the
   * `dom-interactive` phase) it can result in long input delays.
   */
  loadState: LoadState;
}
```

#### INP `attribution`:

```ts
interface INPAttribution {
  /**
   * A selector identifying the element that the user interacted with for
   * the event corresponding to INP. This element will be the `target` of the
   * `event` dispatched.
   */
  eventTarget?: string;
  /**
   * The time when the user interacted for the event corresponding to INP.
   * This time will match the `timeStamp` value of the `event` dispatched.
   */
  eventTime?: number;
  /**
   * The `type` of the `event` dispatched corresponding to INP.
   */
  eventType?: string;
  /**
   * The `PerformanceEventTiming` entry corresponding to INP.
   */
  eventEntry?: PerformanceEventTiming;
  /**
   * The loading state of the document at the time when the even corresponding
   * to INP occurred (see `LoadState` for details). If the interaction occurred
   * while the document was loading and executing script (e.g. usually in the
   * `dom-interactive` phase) it can result in long delays.
   */
  loadState?: LoadState;
}
```

#### LCP `attribution`:

```ts
interface LCPAttribution {
  /**
   * The element corresponding to the largest contentful paint for the page.
   */
  element?: string;
  /**
   * The URL (if applicable) of the LCP image resource. If the LCP element
   * is a text node, this value will not be set.
   */
  url?: string;
  /**
   * The time from when the user initiates loading the page until when the
   * browser receives the first byte of the response (a.k.a. TTFB). See
   * [Optimize LCP](https://web.dev/articles/optimize-lcp) for details.
   */
  timeToFirstByte: number;
  /**
   * The delta between TTFB and when the browser starts loading the LCP
   * resource (if there is one, otherwise 0). See [Optimize
   * LCP](https://web.dev/articles/optimize-lcp) for details.
   */
  resourceLoadDelay: number;
  /**
   * The total time it takes to load the LCP resource itself (if there is one,
   * otherwise 0). See [Optimize LCP](https://web.dev/articles/optimize-lcp) for
   * details.
   */
  resourceLoadTime: number;
  /**
   * The delta between when the LCP resource finishes loading until the LCP
   * element is fully rendered. See [Optimize
   * LCP](https://web.dev/articles/optimize-lcp) for details.
   */
  elementRenderDelay: number;
  /**
   * The `navigation` entry of the current page, which is useful for diagnosing
   * general page load issues. This can be used to access `serverTiming` for example:
   * navigationEntry?.serverTiming
   */
  navigationEntry?: PerformanceNavigationTiming | NavigationTimingPolyfillEntry;
  /**
   * The `resource` entry for the LCP resource (if applicable), which is useful
   * for diagnosing resource load issues.
   */
  lcpResourceEntry?: PerformanceResourceTiming;
  /**
   * The `LargestContentfulPaint` entry corresponding to LCP.
   */
  lcpEntry?: LargestContentfulPaint;
}
```

#### TTFB `attribution`:

```ts
interface TTFBAttribution {
  /**
   * The total time from when the user initiates loading the page to when the
   * DNS lookup begins. This includes redirects, service worker startup, and
   * HTTP cache lookup times.
   */
  waitingTime: number;
  /**
   * The total time to resolve the DNS for the current request.
   */
  dnsTime: number;
  /**
   * The total time to create the connection to the requested domain.
   */
  connectionTime: number;
  /**
   * The time time from when the request was sent until the first byte of the
   * response was received. This includes network time as well as server
   * processing time.
   */
  requestTime: number;
  /**
   * The `navigation` entry of the current page, which is useful for diagnosing
   * general page load issues. This can be used to access `serverTiming` for example:
   * navigationEntry?.serverTiming
   */
  navigationEntry?: PerformanceNavigationTiming | NavigationTimingPolyfillEntry;
}
```

## Browser Support

The `web-vitals` code has been tested and will run without error in all major browsers as well as Internet Explorer back to version 9. However, some of the APIs required to capture these metrics are currently only available in Chromium-based browsers (e.g. Chrome, Edge, Opera, Samsung Internet).

Browser support for each function is as follows:

- `onCLS()`: Chromium
- `onFCP()`: Chromium, Firefox, Safari 14.1+
- `onFID()`: Chromium, Firefox _(with [polyfill](#how-to-use-the-polyfill): Safari, Internet Explorer)_
- `onINP()`: Chromium
- `onLCP()`: Chromium
- `onTTFB()`: Chromium, Firefox, Safari 15+ _(with [polyfill](#how-to-use-the-polyfill): Safari 8+, Internet Explorer)_

## Limitations

The `web-vitals` library is primarily a wrapper around the Web APIs that measure the Web Vitals metrics, which means the limitations of those APIs will mostly apply to this library as well. More details on these limitations is available in [this blog post](https://web.dev/articles/crux-and-rum-differences).

The primary limitation of these APIs is they have no visibility into `<iframe>` content (not even same-origin iframes), which means pages that make use of iframes will likely see a difference between the data measured by this library and the data available in the Chrome User Experience Report (which does include iframe content).

For same-origin iframes, it's possible to use the `web-vitals` library to measure metrics, but it's tricky because it requires the developer to add the library to every frame and `postMessage()` the results to the parent frame for aggregation.

_**Note:** given the lack of iframe support, the `onCLS()` function technically measures [DCLS](https://github.com/wicg/layout-instability#cumulative-scores) (Document Cumulative Layout Shift) rather than CLS, if the page includes iframes)._

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

## Integrations

- [**Web Vitals Connector**](https://goo.gle/web-vitals-connector): Data Studio connector to create dashboards from [Web Vitals data captured in BiqQuery](https://web.dev/articles/vitals-ga4).
- [**Core Web Vitals Custom Tag template**](https://www.simoahava.com/custom-templates/core-web-vitals/): Custom GTM template tag to [add measurement handlers](https://www.simoahava.com/analytics/track-core-web-vitals-in-ga4-with-google-tag-manager/) for all Core Web Vitals metrics.
- [**`web-vitals-reporter`**](https://github.com/treosh/web-vitals-reporter): JavaScript library to batch `callback` functions and send data with a single request.

## License

[Apache 2.0](/LICENSE)
