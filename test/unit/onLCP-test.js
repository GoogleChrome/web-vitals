import {it} from 'node:test';
import assert from 'node:assert/strict';

it('reports queued LCP entries before disconnecting on hide', async () => {
  const listeners = new Map();
  const calls = [];
  const entry = {
    entryType: 'largest-contentful-paint',
    startTime: 250,
    renderTime: 250,
    size: 100,
  };
  globalThis.document = {visibilityState: 'visible', prerendering: false};
  globalThis.addEventListener = (type, callback) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
  };
  globalThis.removeEventListener = (type, callback) => {
    listeners.get(type)?.delete(callback);
  };
  globalThis.performance = {
    now: () => 500,
    getEntriesByType: (type) =>
      type === 'navigation'
        ? [{type: 'navigate', activationStart: 0, responseStart: 0}]
        : [],
  };
  globalThis.PerformanceObserver = class {
    static supportedEntryTypes = ['largest-contentful-paint'];
    observe() {}
    takeRecords() {
      calls.push('takeRecords');
      return [entry];
    }
    disconnect() {
      calls.push('disconnect');
    }
  };

  const {onLCP} = await import('../../dist/modules/onLCP.js');
  const reports = [];
  onLCP((metric) => reports.push(structuredClone(metric)));
  document.visibilityState = 'hidden';
  for (const callback of [...listeners.get('visibilitychange')]) {
    callback({type: 'visibilitychange', isTrusted: true, timeStamp: 500});
  }

  assert.deepEqual(calls, ['takeRecords', 'disconnect']);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].value, 250);
  assert.deepEqual(reports[0].entries, [entry]);
});
