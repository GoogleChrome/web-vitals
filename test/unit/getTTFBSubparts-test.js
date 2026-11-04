import {it} from 'node:test';
import assert from 'node:assert/strict';
import {getTTFBSubparts} from '../../dist/modules/lib/getTTFBSubparts.js';

globalThis.PerformanceNavigationTiming = class {};

const navigationEntry = (overrides = {}) =>
  Object.assign(new PerformanceNavigationTiming(), {
    workerStart: 50,
    fetchStart: 60,
    domainLookupStart: 70,
    connectStart: 100,
    connectEnd: 140,
    activationStart: 0,
    ...overrides,
  });

it('splits TTFB into five durations without the navigation entry', () => {
  assert.deepEqual(getTTFBSubparts(navigationEntry(), 200), {
    waitingDuration: 50,
    cacheDuration: 20,
    dnsDuration: 30,
    connectionDuration: 40,
    requestDuration: 60,
  });
});

it('uses fetchStart when no service worker was started', () => {
  assert.deepEqual(getTTFBSubparts(navigationEntry({workerStart: 0}), 200), {
    waitingDuration: 60,
    cacheDuration: 10,
    dnsDuration: 30,
    connectionDuration: 40,
    requestDuration: 60,
  });
});

it('keeps service worker startup and fetch time in the cache subpart', () => {
  const entry = navigationEntry({
    workerStart: 25,
    fetchStart: 80,
    domainLookupStart: 80,
    connectStart: 80,
    connectEnd: 80,
  });
  assert.deepEqual(getTTFBSubparts(entry, 200), {
    waitingDuration: 25,
    cacheDuration: 55,
    dnsDuration: 0,
    connectionDuration: 0,
    requestDuration: 120,
  });
});

it('clamps subparts relative to prerender activation', () => {
  assert.deepEqual(
    getTTFBSubparts(navigationEntry({activationStart: 100}), 100),
    {
      waitingDuration: 0,
      cacheDuration: 0,
      dnsDuration: 0,
      connectionDuration: 40,
      requestDuration: 60,
    },
  );
});

it('reports zero subparts when activation occurs after the first byte', () => {
  assert.deepEqual(
    getTTFBSubparts(navigationEntry({activationStart: 300}), 0),
    {
      waitingDuration: 0,
      cacheDuration: 0,
      dnsDuration: 0,
      connectionDuration: 0,
      requestDuration: 0,
    },
  );
});

it('reports zero subparts for missing and soft navigation entries', () => {
  for (const entry of [
    undefined,
    {entryType: 'soft-navigation', startTime: 500},
  ]) {
    assert.deepEqual(getTTFBSubparts(entry, 0), {
      waitingDuration: 0,
      cacheDuration: 0,
      dnsDuration: 0,
      connectionDuration: 0,
      requestDuration: 0,
    });
  }
});
