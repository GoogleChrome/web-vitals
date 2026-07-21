# Upgrading to v6

This document lists the full set of changes between version 5 and version 6 that are relevant to anyone wanting to upgrade to the new version. This document groups changes into "breaking changes", "new features", and "deprecations" across both the "standard" and "attribution" builds (see [build options](../README.md#build-options) for details).

## ❌ Breaking changes

### Standard build

#### General

- **Changed** Types are now exported as explicit types, which may require the use of `import type` metrics (for example `import type {Metrics} from web-vitals`) for those explicitly importing the types from this library. Not this does not include the functions like `onLCP`. ([#741](https://github.com/GoogleChrome/web-vitals/pull/741)).
- **Changed** Cap `requestIdleCallback` to 1 second to ensure metrics report even when busy. This may result in metrics being reported more often with the `reportAllChanges` option for very busy pages, when previously they were not reported ([#755](https://github.com/GoogleChrome/web-vitals/pull/755)).

### Attribution build

#### `INPAttribution`

- **Changed** the default for `includeProcessedEventEntries` for `onINP()` has changed to `false` to reduce memory and attribution object size for a little-used feature. You must explicitly set `includeProcessedEventEntries=true` in your `onINP()` function if you wish to include these extra attribution details. ([#763](https://github.com/GoogleChrome/web-vitals/pull/763)).

## 🚀 New features

- **Added** support for Soft Navigation reporting of Core Web Vitals metrics for browsers that support the new [Soft Navigations and Interaction Contentful Paint](https://github.com/WICG/soft-navigations) performance entries (Chromium 151+ at the time of writing). More details in the [Measuring soft navigations](https://developer.chrome.com/docs/web-platform/soft-navigations) post ([#308](https://github.com/GoogleChrome/web-vitals/pull/308)).

## ⚠️ Deprecations

There were no deprecations in v6.
