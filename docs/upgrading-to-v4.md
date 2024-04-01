# Upgrading to v4

This document lists the full set of breaking changes that need to be addressed when upgrading from version 3.x to 4.x, across both the "standard" and "attribution" builds (see [build options](/#build-options) for details).

For a list of all changes see the [CHANGELOG](/CHANGELOG.md).

## Standard build

### General

- The "base+polyfill" build has been removed (see [#435](https://github.com/GoogleChrome/web-vitals/pull/435))
  - This includes the FID polyfill and the Navigation Timing polyfill supporting legacy Safari browsers.
- Previously deprecated `getXXX()` functions have been removed (see [#435](https://github.com/GoogleChrome/web-vitals/pull/435))

### `INPMetric`

- `entries`
  - Updated to only include entries with matching `interactionId` and `duration` values (previously it was only matching `interactionId` values, see [#442](https://github.com/GoogleChrome/web-vitals/pull/442)).

## Attribution build

### `INPAttribution`

- `eventTarget`:
  - Renamed to `interactionTarget` (see [#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- `eventTime`:
  - Renamed to `interactionTime` (see [#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- `eventType`:
  - Renamed to `interactionType` (see [#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
  - Also this property will now always be either "pointer" or "keyboard" (see [#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- `eventEntry`:
  - Removed in favor of an array of entries (`processedEventEntries`) processed during the interaction (see [#442](https://github.com/GoogleChrome/web-vitals/pull/442)).

### `LCPAttribution`

- `resourceLoadTime`:
  - Renamed to `resourceLoadDuration` (see [#450](https://github.com/GoogleChrome/web-vitals/pull/450)).

### `TTFBAttribution`

- `waitingTime`:
  - Renamed to `waitingDuration` (see [#453](https://github.com/GoogleChrome/web-vitals/pull/453)).
- `dnsTime`:
  - Renamed to `dnsDuration` (see [#453](https://github.com/GoogleChrome/web-vitals/pull/453)).
- `connectionTime`:
  - Renamed to `connectionDuration` (see [#453](https://github.com/GoogleChrome/web-vitals/pull/453)).
- `requestTime`:
  - Renamed to `requestDuration` (see [#453](https://github.com/GoogleChrome/web-vitals/pull/453)).
