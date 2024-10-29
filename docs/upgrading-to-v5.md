# Upgrading to v5

This document lists the full set of changes between version 4 and version 5 that are relevant to anyone wanting to upgrade to the new version. These update documents groups changes into "breaking changes", "new features", and "deprecations" across both the "standard" and "attribution" builds (see [build options](/#build-options) for details).

## ❌ Breaking changes

There are three breaking changes in v5:

1. [Removal of First Input Delay (FID) support and `onFID()`](#removal-of-first-input-delay-fid-support-and-onfid)
2. [Change browser support policy to Baseline Widely Available](#change-in-the-browser-support-policy-to-baseline-widely-available)
3. [Sort the classes that appear in attribution selectors to reduce cardinality](#sort-the-classes-that-appear-in-attribution-selectors-to-reduce-cardinality)

### Removal of First Input Delay (FID) support and `onFID()`

This version removes support of First Input Delay (FID) support and the `onFID()` [as deprecated in v4](./upgrading-to-v4.md#%EF%B8%8F-deprecations). FID has been replaced by INP and this [removal was previously advertised in that announcement post](https://web.dev/blog/inp-cwv-launch#fid_deprecation_timeline).

### Change in the browser support policy to Baseline Widely Available

From this version the `web-vitals` library will be developed and coded according to [Baseline Widely Available](https://web.dev/baseline) browser support. ([#525](https://github.com/GoogleChrome/web-vitals/pull/525))

Syntax and features available in the [Baseline core browser set](https://web-platform-dx.github.io/web-features/#how-do-features-become-part-of-baseline%3F) (at the time of writing this is Chrome, Edge, Firefox, and Safari on desktop and mobile) are assumed to be safe to use without fallback.

The pre-built [packages of the `web-vitals` library available on CDNs](/README#load-web-vitals-from-a-cdn) will be compiled with this support in mind.

#### What this means in practice

v5.0.0 makes use of the following syntax that we have avoided in v4 and prior versions:

- [`for...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of#browser_compatibility), widely supported since 2015
- [Optional Chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining), widely supported since 2020.
- [Nullish coalescing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing), widely supported since 2020.
- [Spread syntax (`...`)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax), widely available since 2020.
- [`Array.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at), widely supported since 2022.

This list of new syntax will be expanded upon in the future in line with this new policy and is only presented here as an example of syntax the library now uses.

This should not be an issue for modern browsers released in the last few years, which are usually required in order to measure the metrics this library is designed for. However, this may cause issues for older browsers. For example:

- Older browsers that do not support `for...of`, optional chaining, nullish coalescing, or spread syntax will error on importing this module. This is primarily browsers released in 2020 or before like Chrome 80, Firefox 82, and Safari 13.1.
- Chromium-based browsers between 60 and 91 (released in May 2021 or before) will show errors when measuring FCP, LCP, CLS (first supported in v60) when those methods attempt to use `Array.at()` syntax (not added until v92), but will continue to measure TTFB without issue. Other browsers should be unaffected by the use of `Array.at()` since they do not support the metrics using this syntax.

#### Recommendations to handle this new browser support policy.

For basic use of the library we recommend loading the `web-vitals` library in its own `<script type="module">` tag, regardless of whether loading this library [from a CDN](README.md#from-a-cdn) or locally. This will not only avoid issues for really old browsers (that ignore `type="module"` scripts), but also allow this library to fail without affecting other code if unsupported syntax or features are used.

For those sites wishing to bundle the `web-vitals` library code within their own code, developers should ensure the `web-vitals` code included via `npm` in the `node_modules` directory is transpiled to the support requirements of their user base. See this article on [The State of ES5 on the Web](https://philipwalton.com/articles/the-state-of-es5-on-the-web/#for-website-developers) for more information. Note that most of the metrics will still not be available to older browsers, but by taking these steps developers can ensure their code is unaffected by the `web-vitals` libraries use of modern syntax. Developers may notice a small increase in bundle size when transpiling to older syntax.

### Sort the classes that appear in attribution selectors to reduce cardinality

The library nows sorts the classes that appear in attribution selectors ([#518](https://github.com/GoogleChrome/web-vitals/pull/518)). For example, `<img class="foo bar">` and `<img class="bar foo"` may result into two selectors in v4 but will now result in a single selector ( of `html>body>main>p>img.bar.foo'` for example)

While not a breaking change in the API, this may result in a short term difference in reports based on the selector during the change over from v4 to v5, but longer term should result in few selectors that are more easily grouped in reporting.

## ⚠️ Deprecations

There are no deprecations in v5.
