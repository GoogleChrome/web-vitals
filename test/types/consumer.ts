import * as webVitals from 'web-vitals';
import * as attribution from 'web-vitals/attribution';
import * as legacyAttribution from 'web-vitals/attribution.js';
import {onCLS} from 'web-vitals/onCLS.js';
import {onFCP} from 'web-vitals/onFCP.js';
import {onINP} from 'web-vitals/onINP.js';
import {onLCP} from 'web-vitals/onLCP.js';
import {onTTFB} from 'web-vitals/onTTFB.js';
import {onCLS as onCLSWithAttribution} from 'web-vitals/attribution/onCLS.js';
import {onFCP as onFCPWithAttribution} from 'web-vitals/attribution/onFCP.js';
import {onINP as onINPWithAttribution} from 'web-vitals/attribution/onINP.js';
import {onLCP as onLCPWithAttribution} from 'web-vitals/attribution/onLCP.js';
import {onTTFB as onTTFBWithAttribution} from 'web-vitals/attribution/onTTFB.js';

// This fixture is type-checked against the built package, not executed.
function expectType<T>(_value: T): void {}

webVitals.onCLS((metric) => expectType<webVitals.CLSMetric>(metric));
webVitals.onFCP((metric) => expectType<webVitals.FCPMetric>(metric));
webVitals.onINP((metric) => expectType<webVitals.INPMetric>(metric));
webVitals.onLCP((metric) => expectType<webVitals.LCPMetric>(metric));
webVitals.onTTFB((metric) => expectType<webVitals.TTFBMetric>(metric));

attribution.onCLS((metric) =>
  expectType<attribution.CLSMetricWithAttribution>(metric),
);
attribution.onFCP((metric) =>
  expectType<attribution.FCPMetricWithAttribution>(metric),
);
attribution.onINP((metric) =>
  expectType<attribution.INPMetricWithAttribution>(metric),
);
attribution.onLCP((metric) =>
  expectType<attribution.LCPMetricWithAttribution>(metric),
);
attribution.onTTFB((metric) =>
  expectType<attribution.TTFBMetricWithAttribution>(metric),
);

expectType<typeof attribution>(legacyAttribution);
expectType<typeof webVitals.onCLS>(onCLS);
expectType<typeof webVitals.onFCP>(onFCP);
expectType<typeof webVitals.onINP>(onINP);
expectType<typeof webVitals.onLCP>(onLCP);
expectType<typeof webVitals.onTTFB>(onTTFB);
expectType<typeof attribution.onCLS>(onCLSWithAttribution);
expectType<typeof attribution.onFCP>(onFCPWithAttribution);
expectType<typeof attribution.onINP>(onINPWithAttribution);
expectType<typeof attribution.onLCP>(onLCPWithAttribution);
expectType<typeof attribution.onTTFB>(onTTFBWithAttribution);
