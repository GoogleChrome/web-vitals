# Upgrading to v5

This document lists the full set of changes between version 4 and version 5 that are relevant to anyone wanting to upgrade to the new version. These update documents groups changes into "breaking changes", "new features", and "deprecations" across both the "standard" and "attribution" builds (see [build options](/#build-options) for details).

## ❌ Breaking changes

There are three breaking changes in v5:

1. [Removal of First Input Delay (FID) support and `onFID()`](#removal-of-first-input-delay-fid-support-and-onfid)
2. [Change in the browser support policy to Baseline Widely Available](#change-in-the-browser-support-policy-to-baseline-widely-available)
3. [Sort the classes that appear in attribution selectors to reduce cardinality](#sort-the-classes-that-appear-in-attribution-selectors-to-reduce-cardinality)

### Removal of First Input Delay (FID) support and `onFID()`

This version removes support of First Input Delay (FID) support and the `onFID()` [as deprecated in v4](./upgrading-to-v4.md#%EF%B8%8F-deprecations). FID has been replaced by INP and this [removal was previously advertised in that announcement post](https://web.dev/blog/inp-cwv-launch#fid_deprecation_timeline).

### Change in the browser support policy to Baseline Widely Available

From this version the `web-vitals` library is developed and coded according to [Baseline Widely Available](https://web.dev/baseline) browser support. ([#525](https://github.com/GoogleChrome/web-vitals/pull/525)). The pre-built [packages of the `web-vitals` library available on CDNs](/README#load-web-vitals-from-a-cdn) is built with this support in mind.

This should not be an issue for modern browsers released in the last few years, which are usually required in order to measure the metrics this library is designed for.

For basic use of the library we recommend loading the `web-vitals` library in its own `<script type="module">` tag, regardless of whether loading this library [from a CDN](README.md#from-a-cdn) or hosted locally on your site. This will allow this library to fail without affecting other code if unsupported syntax or features are used on very old browsers.

For those sites wishing to bundle the `web-vitals` library code within their own code, developers should ensure the `web-vitals` code is transpiled to the support requirements of their user base. Note that most of the metrics will still not be available to older browser. Developers may notice a small increase in bundle size when transpiling to older syntax.

### Sort the classes that appear in attribution selectors to reduce cardinality

The library nows sorts the classes that appear in attribution selectors ([#518](https://github.com/GoogleChrome/web-vitals/pull/518)). For example, `<img class="foo bar">` and `<img class="bar foo"` may result into two selectors in v4 but will now result in a single selector ( of `html>body>main>p>img.bar.foo'` for example)

While not a breaking change in the API, this may result in a short term difference in reports based on the selector during the change over from v4 to v5, but longer term should result in few selectors that are more easily grouped in reporting.

## 🚀 New features

Additional cappings have been added to LCP ([#527](https://github.com/GoogleChrome/web-vitals/pull/527)) and INP ([#528](https://github.com/GoogleChrome/web-vitals/pull/528)) breakdowns to handle edge cases.

## ⚠️ Deprecations

There are no deprecations in v5.
