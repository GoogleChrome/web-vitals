# Upgrading to v5

This document lists the full set of changes between version 4 and version 5 that are relevant to anyone wanting to upgrade to the new version. These update documents groups changes into "breaking changes", "new features", and "deprecations" across both the "standard" and "attribution" builds (see [build options](/#build-options) for details).

## ❌ Breaking changes

### Standard build

#### General

- **Removed** First Input Delay (FID) support and `onFID()` [as deprecated in v4](./upgrading-to-v4.md#%EF%B8%8F-deprecations). FID has been replaced by INP and this [removal was previously advertised in that announcement post](https://web.dev/blog/inp-cwv-launch#fid_deprecation_timeline). ([#519](https://github.com/GoogleChrome/web-vitals/pull/519))
- **Changed** the browser support policy to [Baseline Widely available](https://web.dev/baseline) browser support. ([#525](https://github.com/GoogleChrome/web-vitals/pull/525))

##### More details on the Baseline Widely available change:

The pre-built [packages of the `web-vitals` library available on CDNs](/README#load-web-vitals-from-a-cdn) are built with this Baseline Widely available support in mind. This should not be an issue for modern browsers released in the last few years, which are usually required in order to measure the metrics this library is designed for.

For basic use of the library we recommend loading the `web-vitals` library in its own `<script type="module">` tag, regardless of whether loading this library [from a CDN](README.md#from-a-cdn) or hosted locally on your site. This will allow this library to fail without affecting other code if unsupported syntax or features are used on very old browsers.

For those sites wishing to bundle the `web-vitals` library code within their own code, developers should ensure the `web-vitals` code is transpiled to the support requirements of their user base. Note that most of the metrics will still not be available to older browsers. Developers may notice a small increase in bundle size when transpiling to older syntax.

### Attribution build

#### `INPAttribution`, `LCPAttribution`, and `CLSAttribution`

- **Changed** to sort the classes that appear in attribution selectors to reduce cardinality. While not a breaking change in the API, this may result in a short term difference in reports based on the selector during the change over from v4 to v5, but longer term should result in few selectors that are more easily grouped in reporting. ([#518](https://github.com/GoogleChrome/web-vitals/pull/518))

## 🚀 New features

- **Added** additional cappings have been added to LCP ([#527](https://github.com/GoogleChrome/web-vitals/pull/527)) and INP ([#528](https://github.com/GoogleChrome/web-vitals/pull/528)) breakdowns to handle edge cases.
- **Added** support for generating custom targets in the attribution build ([#585](https://github.com/GoogleChrome/web-vitals/pull/585))
- **Added** extended INP attribution with extra LoAF information: longest script and buckets ([#592](https://github.com/GoogleChrome/web-vitals/pull/592))
- **Changed** event listeners to run less often ([#538](https://github.com/GoogleChrome/web-vitals/pull/538))

## ⚠️ Deprecations

There are no deprecations in v5.
