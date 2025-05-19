# Changelog

### v5.0.0-rc.0 (2024-10-03)

- **[BREAKING]** Remove the deprecated `onFID()` function ([#519](https://github.com/GoogleChrome/web-vitals/pull/519))
- **[BREAKING]** Change browser support policy to Baseline Widely Available ([#525](https://github.com/GoogleChrome/web-vitals/pull/525))
- **[BREAKING]** Sort the classes that appear in attribution selectors to reduce cardinality ([#518](https://github.com/GoogleChrome/web-vitals/pull/518))
- Cap INP breakdowns to INP duration ([#528](https://github.com/GoogleChrome/web-vitals/pull/528))
- Cap LCP load duration to LCP time ([#527](https://github.com/GoogleChrome/web-vitals/pull/527))

### v4.2.4 (2024-10-22)

- Fix memory leak in registering new event listeners on every keydown and click ([#554](https://github.com/GoogleChrome/web-vitals/pull/554))

### v4.2.3 (2024-08-06)

- Fix missing LoAF entries in INP attribution ([#512](https://github.com/GoogleChrome/web-vitals/pull/512))

### v4.2.2 (2024-07-17)

- Fix interaction count after bfcache restore ([#505](https://github.com/GoogleChrome/web-vitals/pull/505))

### v4.2.1 (2024-06-30)

- Fix compatibility issues with TypeScript v5.5 ([#497](https://github.com/GoogleChrome/web-vitals/pull/497))

### v4.2.0 (2024-06-20)

- Refactor INP attribution code to fix errors on Windows 10 ([#495](https://github.com/GoogleChrome/web-vitals/pull/495))

### v4.1.1 (2024-06-10)

- Fix pending LoAF cleanup logic ([#493](https://github.com/GoogleChrome/web-vitals/pull/493))

### v4.1.0 (2024-06-06)

- Move the support check to the top of the onINP() function ([#490](https://github.com/GoogleChrome/web-vitals/pull/490))
- Fix missing LoAF attribution when entries are dispatched before event entries ([#487](https://github.com/GoogleChrome/web-vitals/pull/487))

### v4.0.1 (2024-05-21)

- Add the `ReportCallback` type back but deprecate it ([#483](https://github.com/GoogleChrome/web-vitals/pull/483))

### v4.0.0 (2024-05-13)

[!NOTE]
See the [upgrading to v4](/docs/upgrading-to-v4.md) guide for a complete list of all API changes in version 4.

- **[BREAKING]** Update types to support more generic usage ([#471](https://github.com/GoogleChrome/web-vitals/pull/471))
- **[BREAKING]** Split `waitingDuration` to make it easier to understand redirect delays ([#458](https://github.com/GoogleChrome/web-vitals/pull/458))
- **[BREAKING]** Rename `TTFBAttribution` fields from `*Time` to `*Duration` ([#453](https://github.com/GoogleChrome/web-vitals/pull/453))
- **[BREAKING]** Rename `resourceLoadTime` to `resourceLoadDuration` in LCP attribution ([#450](https://github.com/GoogleChrome/web-vitals/pull/450))
- **[BREAKING]** Add INP breakdown timings and LoAF attribution ([#442](https://github.com/GoogleChrome/web-vitals/pull/442))
- **[BREAKING]** Deprecate `onFID()` and remove previously deprecated APIs ([#435](https://github.com/GoogleChrome/web-vitals/pull/435))
- Expose the target element in INP attribution ([#479](https://github.com/GoogleChrome/web-vitals/pull/479))
- Save INP target after interactions to reduce null values when removed from the DOM ([#477](https://github.com/GoogleChrome/web-vitals/pull/477))
- Cap TTFB in attribution ([#440](https://github.com/GoogleChrome/web-vitals/pull/440))
- Fix `reportAllChanges` behavior for LCP when library is loaded late ([#468](https://github.com/GoogleChrome/web-vitals/pull/468))

### v3.5.2 (2024-01-25)

- Pick the first non-null `target` for INP attribution ([#421](https://github.com/GoogleChrome/web-vitals/pull/421))

### v3.5.1 (2023-12-27)

- Add extra guard for `PerformanceEventTiming` not existing ([#403](https://github.com/GoogleChrome/web-vitals/pull/403))

### v3.5.0 (2023-09-28)

- Run `onLCP` callback in separate task ([#386](https://github.com/GoogleChrome/web-vitals/pull/386))
- Fix INP durationThreshold bug when set to 0 ([#372](https://github.com/GoogleChrome/web-vitals/pull/372))
- Prevent FID entries being emitted as INP for non-supporting browsers ([#368](https://github.com/GoogleChrome/web-vitals/pull/368))

### v3.4.0 (2023-07-11)

- Make `bindReporter` generic over metric type ([#359](https://github.com/GoogleChrome/web-vitals/pull/359))
- Update INP status in README ([#362](https://github.com/GoogleChrome/web-vitals/pull/362))
- Fix Metric types for better TypeScript support ([#356](https://github.com/GoogleChrome/web-vitals/pull/356))
- Fix selector for SVGs for attribution build ([#354](https://github.com/GoogleChrome/web-vitals/pull/354))

### v3.3.2 (2023-05-29)

- Fix attribution types ([#348](https://github.com/GoogleChrome/web-vitals/pull/348))
- Safe access navigation entry type ([#290](https://github.com/GoogleChrome/web-vitals/pull/290))

### v3.3.1 (2023-04-04)

- Export metric rating thresholds in attribution build as well.

### v3.3.0 (2023-03-09)

- Export metric rating thresholds, add explicit `MetricRatingThresholds` type ([#323](https://github.com/GoogleChrome/web-vitals/pull/323))
- Trim classname selector ([#328](https://github.com/GoogleChrome/web-vitals/pull/328))
- Add link to CrUX versus RUM blog post ([#327](https://github.com/GoogleChrome/web-vitals/pull/327))
- Prevent LCP being reported for hidden prerendered pages ([#326](https://github.com/GoogleChrome/web-vitals/pull/326))
- Add Server Timing information to docs ([#324](https://github.com/GoogleChrome/web-vitals/pull/324))
- Fix link in `onINP()` thresholds comment ([#318](https://github.com/GoogleChrome/web-vitals/pull/318))
- Update web.dev link for `onINP()` ([#307](https://github.com/GoogleChrome/web-vitals/pull/307))
- Add a note about when to load the library ([#305](https://github.com/GoogleChrome/web-vitals/pull/305))

### v3.2.0

- Version number skipped

### v3.1.1 (2023-01-10)

- Defer CLS logic until after `onFCP()` callback ([#297](https://github.com/GoogleChrome/web-vitals/pull/297))

### v3.1.0 (2022-11-15)

- Add support for `'restore'` as a `navigationType` ([#284](https://github.com/GoogleChrome/web-vitals/pull/284))
- Report initial CLS value when `reportAllChanges` is true ([#283](https://github.com/GoogleChrome/web-vitals/pull/283))
- Defer all observers until after activation ([#282](https://github.com/GoogleChrome/web-vitals/pull/282))
- Ignore TTFB for loads where responseStart is zero ([#281](https://github.com/GoogleChrome/web-vitals/pull/281))
- Defer execution of observer callbacks ([#278](https://github.com/GoogleChrome/web-vitals/pull/278))

### v3.0.4 (2022-10-18)

- Clamp LCP and FCP to 0 for prerendered pages ([#270](https://github.com/GoogleChrome/web-vitals/pull/270))

### v3.0.3 (2022-10-04)

- Ensure `attribution` object is always present in attribution build ([#265](https://github.com/GoogleChrome/web-vitals/pull/265))

### v3.0.2 (2022-09-14)

- Set an explicit unpkg dist file ([#261](https://github.com/GoogleChrome/web-vitals/pull/261))

### v3.0.1 (2022-08-31)

- Use the cjs extension for all UMD builds ([#257](https://github.com/GoogleChrome/web-vitals/pull/257))

### v3.0.0 (2022-08-24)

- **[BREAKING]** Add a config object param to all metric functions ([#225](https://github.com/GoogleChrome/web-vitals/pull/225))
- **[BREAKING]** Report TTFB after a bfcache restore ([#220](https://github.com/GoogleChrome/web-vitals/pull/220))
- **[BREAKING]** Only include last LCP entry in metric entries ([#218](https://github.com/GoogleChrome/web-vitals/pull/218))
- Update the metric ID prefix for v3 ([#251](https://github.com/GoogleChrome/web-vitals/pull/251))
- Move the Navigation Timing API polyfill to the base+polyfill build ([#248](https://github.com/GoogleChrome/web-vitals/pull/248))
- Add a metric rating property ([#246](https://github.com/GoogleChrome/web-vitals/pull/246))
- Add deprecation notices for base+polyfill builds ([#242](https://github.com/GoogleChrome/web-vitals/pull/242))
- Add a new attribution build for debugging issues in the field ([#237](https://github.com/GoogleChrome/web-vitals/pull/237), [#244](https://github.com/GoogleChrome/web-vitals/pull/244))
- Add support for prerendered pages ([#233](https://github.com/GoogleChrome/web-vitals/pull/233))
- Rename the `ReportHandler` type to `ReportCallback`, with alias for back-compat ([#225](https://github.com/GoogleChrome/web-vitals/pull/225), [#227](https://github.com/GoogleChrome/web-vitals/pull/227))
- Add support for the new INP metric ([#221](https://github.com/GoogleChrome/web-vitals/pull/221), [#232](https://github.com/GoogleChrome/web-vitals/pull/232))
- Rename `getXXX()` functions to `onXXX()` ([#222](https://github.com/GoogleChrome/web-vitals/pull/222))
- Add a `navigationType` property to the Metric object ([#219](https://github.com/GoogleChrome/web-vitals/pull/219))

### v2.1.4 (2022-01-20)

- Prevent TTFB from reporting after bfcache restore ([#201](https://github.com/GoogleChrome/web-vitals/pull/201))

### v2.1.3 (2022-01-06)

- Only call report if LCP occurs before first hidden ([#197](https://github.com/GoogleChrome/web-vitals/pull/197))

### v2.1.2 (2021-10-11)

- Ensure reported TTFB values are less than the current page time ([#187](https://github.com/GoogleChrome/web-vitals/pull/187))

### v2.1.1 (2021-10-06)

- Add feature detects to support Opera mini in extreme data saver mode ([#186](https://github.com/GoogleChrome/web-vitals/pull/186))

### v2.1.0 (2021-07-01)

- Add batch reporting support and guidance ([#166](https://github.com/GoogleChrome/web-vitals/pull/166))

### v2.0.1 (2021-06-02)

- Detect getEntriesByName support before calling ([#158](https://github.com/GoogleChrome/web-vitals/pull/158))

### v2.0.0 (2021-06-01)

- **[BREAKING]** Update CLS to max session window 5s cap 1s gap ([#148](https://github.com/GoogleChrome/web-vitals/pull/148))
- Ensure CLS is only reported if page was visible ([#149](https://github.com/GoogleChrome/web-vitals/pull/149))
- Only report CLS when FCP is reported ([#154](https://github.com/GoogleChrome/web-vitals/pull/154))
- Update the unique ID version prefix ([#157](https://github.com/GoogleChrome/web-vitals/pull/157))

### v1.1.2 (2021-05-05)

- Ignore negative TTFB values in Firefox ([#147](https://github.com/GoogleChrome/web-vitals/pull/147))
- Add workaround for Safari FCP bug ([#145](https://github.com/GoogleChrome/web-vitals/pull/145))
- Add more extensive FID feature detect ([#143](https://github.com/GoogleChrome/web-vitals/pull/143))

### v1.1.1 (2021-03-13)

- Remove use of legacy API to detect Firefox ([#128](https://github.com/GoogleChrome/web-vitals/pull/128))

### v1.1.0 (2021-01-13)

- Fix incorrect UMD config for base+polyfill script ([#117](https://github.com/GoogleChrome/web-vitals/pull/117))
- Fix missing getter in polyfill ([#114](https://github.com/GoogleChrome/web-vitals/pull/114))
- Add support for Set in place of WeakSet for IE11 compat ([#110](https://github.com/GoogleChrome/web-vitals/pull/110))

### v1.0.1 (2020-11-16)

- Fix missing `typings` declaration ([#90](https://github.com/GoogleChrome/web-vitals/pull/90))

### v1.0.0 (2020-11-16)

- **[BREAKING]** Add support for reporting metrics on back/forward cache restore ([#87](https://github.com/GoogleChrome/web-vitals/pull/87))
- **[BREAKING]** Remove the `isFinal` flag from the Metric interface ([#86](https://github.com/GoogleChrome/web-vitals/pull/86))
- Remove the scroll listener to stop LCP observing ([#85](https://github.com/GoogleChrome/web-vitals/pull/85))

### v0.2.4 (2020-07-23)

- Remove the unload listener ([#68](https://github.com/GoogleChrome/web-vitals/pull/68))

### v0.2.3 (2020-06-26)

- Ensure reports only occur if a PO was created ([#58](https://github.com/GoogleChrome/web-vitals/pull/58))

### v0.2.2 (2020-05-12)

- Remove package `type` field ([#35](https://github.com/GoogleChrome/web-vitals/pull/35))

### v0.2.1 (2020-05-06)

- Ensure all modules are pure modules ([#23](https://github.com/GoogleChrome/web-vitals/pull/23))
- Ensure proper TypeScript exports and config ([#22](https://github.com/GoogleChrome/web-vitals/pull/22))

### v0.2.0 (2020-05-03)

- Initial public release

### v0.1.0 (2020-04-24)

- Initial pre-release
