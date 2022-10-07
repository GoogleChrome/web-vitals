export declare type FirstInputPolyfillEntry = Omit<PerformanceEventTiming, 'processingEnd'>;
export interface FirstInputPolyfillCallback {
    (entry: FirstInputPolyfillEntry): void;
}
export declare type NavigationTimingPolyfillEntry = Omit<PerformanceNavigationTiming, 'initiatorType' | 'nextHopProtocol' | 'redirectCount' | 'transferSize' | 'encodedBodySize' | 'decodedBodySize' | 'type'> & {
    type: PerformanceNavigationTiming['type'];
};
