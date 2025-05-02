# Upgrading to v5

This document lists the full set of changes between version 4 and version 5 that are relevant to anyone wanting to upgrade to the new version. This document groups changes into "breaking changes", "new features", and "deprecations" across both the "standard" and "attribution" builds (see [build options](/#build-options) for details).

## ❌ Breaking changes

### Standard build

#### General

- **Removed** First Input Delay (FID) support and `onFID()` [as deprecated in v4](./upgrading-to-v4.md#%EF%B8%8F-deprecations). FID has been replaced by INP and this [removal was previously advertised in that announcement post](https://web.dev/blog/inp-cwv-launch#fid_deprecation_timeline). ([#519](https://github.com/GoogleChrome/web-vitals/pull/519))
- **Changed** the browser support policy to [Baseline Widely available](https://web.dev/baseline) browser support. ([#525](https://github.com/GoogleChrome/web-vitals/pull/525))

##### More details on the Baseline Widely available change:

All of the [builds](README#build-options) in `web-vitals` v5 use only [Baseline Widely available](https://web.dev/baseline) APIs, which means they should run without error in all browsers released in the last few years. Note that the Core Web Vitals metrics are only available in modern browsers, so legacy browser support is unnecessary for this library.

If your site needs to support legacy browsers, you can still use the `web-vitals` library without causing errors in those browsers by adhering to the following recommendations:

We recommend loading the `web-vitals` library in a separate script file from your site's main application bundle(s), either via `<script type="module">` and `import` statements or via your bundler's code splitting feature (for example, [rollup](https://rollupjs.org/tutorial/#code-splitting), [escbuild](https://esbuild.github.io/api/#splitting), and [webpack](https://webpack.js.org/guides/code-splitting/)). This ensures that any errors encountered while loading the library do not impact other code on your site.

If you do choose to include the `web-vitals` library code in your main application bundle—and you also need to support very old browsers—it's critical that you configure your bundler to transpile the `web-vitals` code along with the rest of you application JavaScript. This is important because most bundlers do not transpile `node_modules` by default.

### Attribution build

#### `INPAttribution`, `LCPAttribution`, and `CLSAttribution`

- **Changed** to sort the classes that appear in attribution selectors to reduce cardinality. While not a breaking change in the API, this may result in a short term difference in reports based on the selector during the change over from v4 to v5, but longer term should result in few selectors that are more easily grouped in reporting. ([#518](https://github.com/GoogleChrome/web-vitals/pull/518))

## 🚀 New features

- **Added** support for generating custom targets in the attribution build ([#585](https://github.com/GoogleChrome/web-vitals/pull/585))
- **Added** extended INP attribution with extra LoAF information: longest script and buckets ([#592](https://github.com/GoogleChrome/web-vitals/pull/592))

## ⚠️ Deprecations

There were no deprecations in v5.
