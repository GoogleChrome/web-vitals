import {describe, it, before, beforeEach} from 'node:test';
import assert from 'node:assert';

class PerformanceEventTiming {}
Object.defineProperty(PerformanceEventTiming.prototype, 'interactionId', {
  value: 0,
  writable: true,
});

const observers = [];

const stubGlobals = () => {
  observers.length = 0;
  globalThis.PerformanceEventTiming = PerformanceEventTiming;
  globalThis.PerformanceObserver = class {
    static supportedEntryTypes = ['event', 'first-input'];
    constructor(cb) {
      this.cb = cb;
      this.types = [];
      observers.push(this);
    }
    observe(o) {
      this.types.push(o.type);
    }
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  globalThis.performance = {
    now: () => 1300,
    interactionCount: 0,
    getEntriesByType: (t) =>
      t === 'navigation'
        ? [{entryType: 'navigation', type: 'navigate', activationStart: 0}]
        : [],
  };
  globalThis.document = {
    visibilityState: 'visible',
    prerendering: false,
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(1300), 0);
  globalThis.requestIdleCallback = (cb) => setTimeout(() => cb({}), 0);
  globalThis.cancelIdleCallback = () => {};
};

const eventEntry = (props) =>
  Object.assign(Object.create(PerformanceEventTiming.prototype), {
    entryType: 'event',
    cancelable: true,
    target: null,
    ...props,
  });

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('INP attribution subparts', () => {
  let onINP;

  before(async () => {
    stubGlobals();
    ({onINP} = await import('../../dist/modules/attribution/onINP.js'));
  });

  beforeEach(() => stubGlobals());

  it('never reports a negative inputDelay when a non-interaction event in the same frame started processing first', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    observers
      .find((o) => o.types.includes('event'))
      .cb({
        getEntries: () => [
          eventEntry({
            name: 'pointerover',
            startTime: 1000,
            duration: 208,
            processingStart: 1002,
            processingEnd: 1160,
            interactionId: 0,
          }),
          eventEntry({
            name: 'pointerdown',
            startTime: 1100,
            duration: 104,
            processingStart: 1160,
            processingEnd: 1175,
            interactionId: 4001,
          }),
        ],
      });

    await flush();

    const {attribution: a} = reports.at(-1);

    assert.strictEqual(a.inputDelay, 0);
    assert.strictEqual(a.processingDuration, 75);
    assert.strictEqual(a.presentationDelay, 29);
    assert.strictEqual(
      a.inputDelay + a.processingDuration + a.presentationDelay,
      reports.at(-1).value,
    );
  });

  it('uses the earliest processing start among the entries of a single interaction', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    observers
      .find((o) => o.types.includes('event'))
      .cb({
        getEntries: () => [
          eventEntry({
            name: 'pointerdown',
            startTime: 1090,
            duration: 110,
            processingStart: 1120,
            processingEnd: 1150,
            interactionId: 4001,
          }),
          eventEntry({
            name: 'pointerup',
            startTime: 1100,
            duration: 104,
            processingStart: 1160,
            processingEnd: 1175,
            interactionId: 4001,
          }),
        ],
      });

    await flush();

    const {attribution: a} = reports.at(-1);

    assert.strictEqual(a.inputDelay, 30);
    assert.strictEqual(a.processingDuration, 55);
    assert.strictEqual(a.presentationDelay, 25);
  });
});
