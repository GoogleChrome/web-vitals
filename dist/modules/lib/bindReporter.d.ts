import { Metric, ReportCallback } from '../types.js';
export declare const bindReporter: (callback: ReportCallback, metric: Metric, thresholds: number[], reportAllChanges?: boolean) => (forceReport?: boolean) => void;
