import { FCPReportCallback, ReportOpts } from './types.js';
/**
 * Calculates the [FCP](https://web.dev/fcp/) value for the current page and
 * calls the `callback` function once the value is ready, along with the
 * relevant `paint` performance entry used to determine the value. The reported
 * value is a `DOMHighResTimeStamp`.
 */
export declare const onFCP: (onReport: FCPReportCallback, opts?: ReportOpts) => void;
