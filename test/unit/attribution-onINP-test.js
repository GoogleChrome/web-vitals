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
    static supportedEntryTypes = [
      'event',
      'first-input',
      'long-animation-frame',
    ];
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

const loafEntry = (props) => ({
  entryType: 'long-animation-frame',
  scripts: [],
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

  it('excludes non-rendering frames from style and layout totals', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    observers
      .find((o) => o.types.includes('long-animation-frame'))
      .cb({
        getEntries: () => [
          loafEntry({
            startTime: 1000,
            duration: 100,
            renderStart: 0,
            styleAndLayoutStart: 0,
            scripts: [
              {
                startTime: 1010,
                duration: 80,
                forcedStyleAndLayoutDuration: 10,
              },
            ],
          }),
          loafEntry({
            startTime: 1100,
            duration: 100,
            renderStart: 1170,
            styleAndLayoutStart: 1180,
          }),
        ],
      });
    observers
      .find((o) => o.types.includes('event'))
      .cb({
        getEntries: () => [
          eventEntry({
            name: 'pointerdown',
            startTime: 1000,
            duration: 216,
            processingStart: 1100,
            processingEnd: 1150,
            interactionId: 4001,
          }),
        ],
      });

    await flush();

    assert.strictEqual(reports.length, 1);
    const {attribution: a, value} = reports[0];
    assert.strictEqual(a.longAnimationFrameEntries.length, 2);
    assert.strictEqual(a.totalScriptDuration, 70);
    assert.strictEqual(a.totalStyleAndLayoutDuration, 30);
    assert.strictEqual(a.totalPaintDuration, 16);
    assert.strictEqual(a.totalUnattributedDuration, 100);
    assert.strictEqual(
      a.totalScriptDuration +
        a.totalStyleAndLayoutDuration +
        a.totalPaintDuration +
        a.totalUnattributedDuration,
      value,
    );
  });

  it('only counts style and layout time after the interaction started', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    observers
      .find((o) => o.types.includes('long-animation-frame'))
      .cb({
        getEntries: () => [
          // Still in style and layout when the interaction starts at 1000.
          loafEntry({
            startTime: 900,
            duration: 120,
            renderStart: 910,
            styleAndLayoutStart: 920,
          }),
          loafEntry({
            startTime: 1020,
            duration: 80,
            renderStart: 1070,
            styleAndLayoutStart: 1080,
            scripts: [
              {
                startTime: 1025,
                duration: 40,
                forcedStyleAndLayoutDuration: 0,
              },
            ],
          }),
        ],
      });
    observers
      .find((o) => o.types.includes('event'))
      .cb({
        getEntries: () => [
          eventEntry({
            name: 'pointerdown',
            startTime: 1000,
            duration: 104,
            processingStart: 1025,
            processingEnd: 1065,
            interactionId: 4001,
          }),
        ],
      });

    await flush();

    assert.strictEqual(reports.length, 1);
    const {attribution: a, value} = reports[0];
    assert.strictEqual(a.longAnimationFrameEntries.length, 2);
    assert.strictEqual(a.totalScriptDuration, 40);
    assert.strictEqual(a.totalStyleAndLayoutDuration, 40);
    assert.strictEqual(a.totalPaintDuration, 4);
    assert.strictEqual(a.totalUnattributedDuration, 20);
    assert.strictEqual(
      a.totalScriptDuration +
        a.totalStyleAndLayoutDuration +
        a.totalPaintDuration +
        a.totalUnattributedDuration,
      value,
    );
  });

  it('never reports a negative totalPaintDuration when the event duration rounds down', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    observers
      .find((o) => o.types.includes('long-animation-frame'))
      .cb({
        getEntries: () => [
          // Ends at 1098, after the rounded down `nextPaintTime` of 1096.
          loafEntry({
            startTime: 1005,
            duration: 93,
            renderStart: 1065,
            styleAndLayoutStart: 1070,
            scripts: [
              {
                startTime: 1010,
                duration: 50,
                forcedStyleAndLayoutDuration: 0,
              },
            ],
          }),
        ],
      });
    observers
      .find((o) => o.types.includes('event'))
      .cb({
        getEntries: () => [
          eventEntry({
            name: 'pointerdown',
            startTime: 1000,
            duration: 96,
            processingStart: 1010,
            processingEnd: 1060,
            interactionId: 4001,
          }),
        ],
      });

    await flush();

    assert.strictEqual(reports.length, 1);
    const {attribution: a, value} = reports[0];
    assert.strictEqual(a.totalScriptDuration, 50);
    assert.strictEqual(a.totalPaintDuration, 0);
    assert.strictEqual(
      a.totalScriptDuration +
        a.totalStyleAndLayoutDuration +
        a.totalPaintDuration +
        a.totalUnattributedDuration,
      value,
    );
  });

  it('caps pendingLoAFs to MAX_PENDING_FRAMES during periods without interactions', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    const loafObserver = observers.find((o) =>
      o.types.includes('long-animation-frame'),
    );
    assert(loafObserver, 'LoAF observer should be registered');

    // Emit 15 LoAF entries (MAX_PENDING_FRAMES is 10).
    const loafs = Array.from({length: 15}, (_, i) =>
      loafEntry({
        startTime: 1000 + i * 100,
        duration: 80,
      }),
    );

    loafObserver.cb({getEntries: () => loafs});

    // Wait for idle cleanup task to run.
    // It should clear it down to 10 LoAFs
    await flush();

    // Dispatch an interaction event whose time range spans all 15 LoAFs.
    // This is only done to observe the current pending LoAFs, since this
    // is an internal buffer that is not otherwise exposed. In reality an
    // interaction would not span this many LoAFs.
    const eventObserver = observers.find((o) => o.types.includes('event'));
    eventObserver.cb({
      getEntries: () => [
        eventEntry({
          name: 'pointerdown',
          startTime: 900,
          duration: 1600,
          processingStart: 950,
          processingEnd: 2500,
          interactionId: 5001,
        }),
      ],
    });

    await flush();

    assert.strictEqual(reports.length, 1);
    const {attribution: a} = reports[0];
    // Without the cap, all 15 LoAFs would be retained in pendingLoAFs.
    // With the cap, only the 10 most recent LoAFs are kept.
    assert.strictEqual(a.longAnimationFrameEntries.length, 10);
    // The oldest retained LoAF should be the 6th entry (startTime 1500), not the 1st (startTime 1000).
    assert.strictEqual(a.longAnimationFrameEntries[0].startTime, 1500);
  });

  it('caps pendingLoAFs when cleanup runs immediately while document is hidden', async () => {
    document.visibilityState = 'hidden';

    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    const loafObserver = observers.find((o) =>
      o.types.includes('long-animation-frame'),
    );
    assert(loafObserver, 'LoAF observer should be registered');

    // Emit 1 LoAF entry while hidden so queueCleanup runs immediately.
    loafObserver.cb({
      getEntries: () => [
        loafEntry({
          startTime: 500,
          duration: 50,
        }),
      ],
    });

    // Emit 15 more LoAF entries.
    const loafs = Array.from({length: 15}, (_, i) =>
      loafEntry({
        startTime: 1000 + i * 100,
        duration: 80,
      }),
    );

    loafObserver.cb({getEntries: () => loafs});

    await flush();

    // Dispatch an interaction event whose time range spans all 16 LoAFs.
    const eventObserver = observers.find((o) => o.types.includes('event'));
    eventObserver.cb({
      getEntries: () => [
        eventEntry({
          name: 'pointerdown',
          startTime: 400,
          duration: 2100,
          processingStart: 450,
          processingEnd: 2500,
          interactionId: 5001,
        }),
      ],
    });

    await flush();

    assert.strictEqual(reports.length, 1);
    const {attribution: a} = reports[0];
    // If cleanupPending was reset to true after synchronous cleanup,
    // subsequent entries would not be cleaned up and all 16 LoAFs would be retained.
    assert.strictEqual(a.longAnimationFrameEntries.length, 10);
    // The oldest retained LoAF should be the 7th entry (startTime 1500), not the 1st (startTime 500).
    assert.strictEqual(a.longAnimationFrameEntries[0].startTime, 1500);
  });
  it('only counts script, style and layout time up to the next paint when a modal dialog is shown', async () => {
    const reports = [];
    onINP((metric) => reports.push(metric), {reportAllChanges: true});

    // A click handler calls `alert()`, so the event ends when the dialog is
    // shown at 1104 but the handler keeps running until it closes at 3000.
    observers
      .find((o) => o.types.includes('long-animation-frame'))
      .cb({
        getEntries: () => [
          loafEntry({
            startTime: 1005,
            duration: 2010,
            renderStart: 3002,
            styleAndLayoutStart: 3005,
            scripts: [
              {
                startTime: 1010,
                duration: 1990,
                forcedStyleAndLayoutDuration: 0,
              },
              {
                startTime: 3000,
                duration: 2,
                forcedStyleAndLayoutDuration: 0,
              },
            ],
          }),
        ],
      });
    observers
      .find((o) => o.types.includes('event'))
      .cb({
        getEntries: () => [
          eventEntry({
            name: 'click',
            startTime: 1000,
            duration: 104,
            processingStart: 1010,
            processingEnd: 3000,
            interactionId: 6001,
          }),
        ],
      });

    await flush();

    assert.strictEqual(reports.length, 1);
    const {attribution: a, value} = reports[0];
    assert.strictEqual(value, 104);
    assert.strictEqual(a.processingDuration, 94);
    assert.strictEqual(a.totalScriptDuration, 94);
    assert.strictEqual(a.longestScript.intersectingDuration, 94);
    assert.strictEqual(a.longestScript.subpart, 'processing-duration');
    assert.strictEqual(a.totalStyleAndLayoutDuration, 0);
  });
});
