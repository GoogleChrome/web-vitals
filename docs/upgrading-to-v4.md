# Upgrading to v4

This document lists the full set of changes between version 3 and version 4 that are relevant to anyone wanting to upgrade to the new version. This document groups changes into "breaking changes" and "new features" across both the "standard" and "attribution" builds (see [build options](/#build-options) for details).

## ⚠️ Breaking changes

### Standard build

#### General

- **Removed** the "base+polyfill" build, which includes the FID polyfill and the Navigation Timing polyfill supporting legacy Safari browsers ([#435](https://github.com/GoogleChrome/web-vitals/pull/435)).
- **Removed** all `getXXX()` functions that were deprecated in v3 ([#435](https://github.com/GoogleChrome/web-vitals/pull/435)).

#### `INPMetric`

- **Changed** `entries` to only include entries with matching `interactionId` that were processed within the same animation frame. Previously it included all entries with matching `interactionId` values, which could include entries not impacting INP ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).

### Attribution build

#### `INPAttribution`

- **Renamed** `eventTarget` to `interactionTarget` ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Renamed** `eventTime` to `interactionTime` ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Renamed** `eventType` to `interactionType`. Also this property will now always be either "pointer" or "keyboard" ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Removed** `eventEntry` in favor of the new `processedEventEntries` array (see below), which includes all `event` entries processed within the same animation frame as the INP candidate interaction ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).

#### `LCPAttribution`

- **Renamed** `resourceLoadTime` to `resourceLoadDuration` ([#450](https://github.com/GoogleChrome/web-vitals/pull/450)).

#### `TTFBAttribution`

- **Renamed** `waitingTime` to `waitingDuration`, and also split out the portion of this duration spent checking the HTTP cache, see `cacheDuration` in the [new features](#-new-features) section below ([#453](https://github.com/GoogleChrome/web-vitals/pull/453), [#458](https://github.com/GoogleChrome/web-vitals/pull/458)).
- **Renamed** `dnsTime` to `dnsDuration` ([#453](https://github.com/GoogleChrome/web-vitals/pull/453)).
- **Renamed** `connectionTime` to `connectionDuration` ([#453](https://github.com/GoogleChrome/web-vitals/pull/453)).
- **Renamed** `requestTime` to `requestDuration` ([#453](https://github.com/GoogleChrome/web-vitals/pull/453)).

## 🚀 New features

### Standard build

No new features were introduced into the "standard" build, outside of the breaking changes mentioned above.

### Attribution build

#### `INPAttribution`

- **Added** `nextPaintTime`, which marks the timestamp of the next paint after the interaction ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Added** `inputDelay`, which measures the time from when the user interacted with the page until when the browser was first able to start processing event listeners for that interaction. ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Added** `processingDuration`, which measures the time from when the first event listener started running in response to the user interaction until when all event listener processing has finished ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Added** `presentationDelay`, which measures the time from when the browser finished processing all event listeners for the user interaction until the next frame is presented on the screen and visible to the user. ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Added** `processedEventEntries`, an array of `event` entries that were processed within the same animation frame as the INP candidate interaction ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Added** `longAnimationFrameEntries`, which includes any `long-animation-frame` entries that overlap with the INP candidate interaction ([#442](https://github.com/GoogleChrome/web-vitals/pull/442)).
- **Added** `interactionTargetElement` ([#479](https://github.com/GoogleChrome/web-vitals/pull/479)).

#### `TTFBAttribution`

- **Added** `cacheDuration`, which marks the total time spent checking the HTTP cache for a match ([#458](https://github.com/GoogleChrome/web-vitals/pull/458)).
