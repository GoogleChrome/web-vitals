import {describe, it} from 'node:test';
import assert from 'assert';
import {getMetricRatingThresholds} from 'web-vitals';

describe('getMetricRatingThresholds()', () => {
  it('gets Web Vitals metric rating thresholds', () => {
    // Metric rating threshold values duplicated here are a little repetitive,
    // but they're not expected to change often, and it's worth verifying
    // they're being exported correctly.
    const expectedRatingThresholds = {
      'CLS': {
        good: 0.1,
        needsImprovement: 0.25,
      },
      'FCP': {
        good: 1800,
        needsImprovement: 3000,
      },
      'FID': {
        good: 100,
        needsImprovement: 300,
      },
      'INP': {
        good: 200,
        needsImprovement: 500,
      },
      'LCP': {
        good: 2500,
        needsImprovement: 4000,
      },
      'TTFB': {
        good: 800,
        needsImprovement: 1800,
      },
    };

    const actualRatingThresholds = {};
    Object.keys(expectedRatingThresholds).forEach((metric) => {
      actualRatingThresholds[metric] = getMetricRatingThresholds(metric);
    });

    assert.deepEqual(actualRatingThresholds, expectedRatingThresholds);
  });

  it('returns `null` if metric name is invalid', () => {
    assert(getMetricRatingThresholds('Invalid metric name') === null);
  });
});
