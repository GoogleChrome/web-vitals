import {describe, it} from 'node:test';
import assert from 'assert';
import {bindReporter} from '../../dist/modules/lib/bindReporter.js';

describe('bindReporter', () => {
  describe('rating classification', () => {
    const thresholds = [0.1, 0.25]; // CLS thresholds as example

    it('should return "good" for values below first threshold', () => {
      const metric = {
        name: 'CLS',
        value: 0.05,
        entries: [],
      };

      const reporter = bindReporter(() => {}, metric, thresholds, true);

      reporter(true);
      assert.equal(metric.rating, 'good');
    });

    it('should return "needs-improvement" for values between thresholds', () => {
      const metric = {
        name: 'CLS',
        value: 0.15,
        entries: [],
      };

      const reporter = bindReporter(() => {}, metric, thresholds, true);

      reporter(true);
      assert.equal(metric.rating, 'needs-improvement');
    });

    it('should return "poor" for values above second threshold', () => {
      const metric = {
        name: 'CLS',
        value: 0.3,
        entries: [],
      };

      const reporter = bindReporter(() => {}, metric, thresholds, true);

      reporter(true);
      assert.equal(metric.rating, 'poor');
    });

    it('should handle boundary values correctly', () => {
      const metricAt1stThreshold = {
        name: 'CLS',
        value: 0.101,
        entries: [],
      };

      const reporter1 = bindReporter(
        () => {},
        metricAt1stThreshold,
        thresholds,
        true,
      );

      reporter1(true);
      assert.equal(metricAt1stThreshold.rating, 'needs-improvement');

      const metricAt2ndThreshold = {
        name: 'CLS',
        value: 0.251,
        entries: [],
      };

      const reporter2 = bindReporter(
        () => {},
        metricAt2ndThreshold,
        thresholds,
        true,
      );

      reporter2(true);
      assert.equal(metricAt2ndThreshold.rating, 'poor');
    });
  });

  describe('state management', () => {
    it('should calculate delta correctly between reports', () => {
      const metric = {
        name: 'CLS',
        value: 0.1,
        entries: [],
      };
      const reports = [];

      const reporter = bindReporter(
        (m) => reports.push({...m}),
        metric,
        [0.1, 0.25],
        true,
      );

      reporter(true);
      assert.equal(reports[0].delta, 0.1);

      metric.value = 0.15;
      reporter(true);
      assert.equal(reports[1].delta, 0.05);
    });

    describe('reportAllChanges behavior', () => {
      it('should report all changes when reportAllChanges is true', () => {
        const metric = {
          name: 'CLS',
          value: 0.1,
          entries: [],
        };
        const reports = [];

        const reporter = bindReporter(
          (m) => reports.push({...m}),
          metric,
          [0.1, 0.25],
          true,
        );

        reporter();
        metric.value = 0.15;
        reporter();
        metric.value = 0.2;
        reporter();

        assert.equal(reports.length, 3);
        assert.equal(reports[0].value, 0.1);
        assert.equal(reports[1].value, 0.15);
        assert.equal(reports[2].value, 0.2);
      });

      it('should not report when value does not change', () => {
        const metric = {
          name: 'CLS',
          value: 0.1,
          entries: [],
        };
        const reports = [];

        const reporter = bindReporter(
          (m) => reports.push({...m}),
          metric,
          [0.1, 0.25],
          true,
        );

        reporter();
        reporter();
        reporter();

        assert.equal(reports.length, 1);
        assert.equal(reports[0].value, 0.1);
      });

      it('should only report on forceReport when reportAllChanges is false', () => {
        const metric = {
          name: 'CLS',
          value: 0.1,
          entries: [],
        };
        const reports = [];

        const reporter = bindReporter(
          (m) => reports.push({...m}),
          metric,
          [0.1, 0.25],
          false,
        );

        reporter();
        metric.value = 0.15;
        reporter();
        reporter(true);

        assert.equal(reports.length, 1);
        assert.equal(reports[0].value, 0.15);
      });
    });
  });

  describe('special values handling', () => {
    it('should not report negative values', () => {
      const metric = {
        name: 'CLS',
        value: -1,
        entries: [],
      };
      const reports = [];

      const reporter = bindReporter(
        (m) => reports.push({...m}),
        metric,
        [0.1, 0.25],
        true,
      );

      reporter(true);
      assert.equal(reports.length, 0);
    });

    it('should handle zero values correctly', () => {
      const metric = {
        name: 'CLS',
        value: 0,
        entries: [],
      };
      const reports = [];

      const reporter = bindReporter(
        (m) => reports.push({...m}),
        metric,
        [0.1, 0.25],
        true,
      );

      reporter(true);
      assert.equal(reports.length, 1);
      assert.equal(reports[0].value, 0);
      assert.equal(reports[0].delta, 0);
      assert.equal(reports[0].rating, 'good');
    });

    describe('first report behavior', () => {
      it('should always report first value even with zero delta', () => {
        const metric = {
          name: 'CLS',
          value: 0,
          entries: [],
        };
        const reports = [];

        const reporter = bindReporter(
          (m) => reports.push({...m}),
          metric,
          [0.1, 0.25],
          false,
        );

        reporter(true);
        assert.equal(reports.length, 1);
        assert.equal(reports[0].delta, 0);
      });

      it('should calculate correct delta for first non-zero value', () => {
        const metric = {
          name: 'CLS',
          value: 0.1,
          entries: [],
        };
        const reports = [];

        const reporter = bindReporter(
          (m) => reports.push({...m}),
          metric,
          [0.1, 0.25],
          true,
        );

        reporter(true);
        assert.equal(reports[0].delta, 0.1);
      });
    });
  });
});
