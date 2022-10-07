import { FirstInputPolyfillCallback } from './types/polyfills.js';
export * from './types/base.js';
export * from './types/polyfills.js';
export * from './types/cls.js';
export * from './types/fcp.js';
export * from './types/fid.js';
export * from './types/inp.js';
export * from './types/lcp.js';
export * from './types/ttfb.js';
export interface WebVitalsGlobal {
    firstInputPolyfill: (onFirstInput: FirstInputPolyfillCallback) => void;
    resetFirstInputPolyfill: () => void;
    firstHiddenTime: number;
}
declare global {
    interface Window {
        webVitals: WebVitalsGlobal;
        __WEB_VITALS_POLYFILL__: boolean;
    }
}
interface PerformanceEntryMap {
    'navigation': PerformanceNavigationTiming;
    'resource': PerformanceResourceTiming;
    'paint': PerformancePaintTiming;
}
declare global {
    interface Document {
        prerendering?: boolean;
    }
    interface Performance {
        getEntriesByType<K extends keyof PerformanceEntryMap>(type: K): PerformanceEntryMap[K][];
    }
    interface PerformanceObserverInit {
        durationThreshold?: number;
    }
    interface PerformanceNavigationTiming {
        activationStart?: number;
    }
    interface PerformanceEventTiming extends PerformanceEntry {
        duration: DOMHighResTimeStamp;
        interactionId?: number;
    }
    interface LayoutShiftAttribution {
        node?: Node;
        previousRect: DOMRectReadOnly;
        currentRect: DOMRectReadOnly;
    }
    interface LayoutShift extends PerformanceEntry {
        value: number;
        sources: LayoutShiftAttribution[];
        hadRecentInput: boolean;
    }
    interface LargestContentfulPaint extends PerformanceEntry {
        renderTime: DOMHighResTimeStamp;
        loadTime: DOMHighResTimeStamp;
        size: number;
        id: string;
        url: string;
        element?: Element;
    }
}
