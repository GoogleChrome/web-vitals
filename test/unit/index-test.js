import {describe, it} from 'node:test';
import assert from 'assert';
import {
  onCLS,
  onFCP,
  onFID,
  onINP,
  onLCP,
  onTTFB,
  getMetricRatingThresholds,
} from 'web-vitals';

describe('index', () => {
  it('exports expected public functions', () => {
    [
      onCLS,
      onFCP,
      onFID,
      onINP,
      onLCP,
      onTTFB,
      getMetricRatingThresholds,
    ].forEach((onFn) => assert(typeof onFn === 'function'));
  });
});
