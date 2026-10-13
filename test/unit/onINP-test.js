import {describe, it} from 'node:test';
import assert from 'node:assert';
import {cp, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const setup = async (t, attribution, {idleAPI = true} = {}) => {
  // Fresh copies isolate the lifecycle state in the imported helper modules.
  const moduleDir = await mkdtemp(join(tmpdir(), 'web-vitals-inp-'));
  t.after(async () => {
    assert.strictEqual(dirname(moduleDir), resolve(tmpdir()));
    assert(basename(moduleDir).startsWith('web-vitals-inp-'));
    await rm(moduleDir, {recursive: true, force: true});
  });
  await cp(new URL('../../dist/modules/', import.meta.url), moduleDir, {
    recursive: true,
  });
  await writeFile(join(moduleDir, 'package.json'), '{"type":"module"}');
  const listeners = [];
  const observers = [];
  const idleCallbacks = new Map();
  const originalGlobals = new Map();
  let idleId = 0;

  const stub = (name, value) => {
    originalGlobals.set(
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    );
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };
  t.after(() => {
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });

  const capture = (options) =>
    typeof options === 'boolean' ? options : !!options?.capture;
  const addListener = (target, type, callback, options) => {
    if (
      !listeners.some(
        (l) =>
          l.target === target &&
          l.type === type &&
          l.callback === callback &&
          l.capture === capture(options),
      )
    ) {
      listeners.push({
        target,
        type,
        callback,
        capture: capture(options),
        once: !!options?.once,
      });
    }
  };
  const removeListener = (target, type, callback, options) => {
    const index = listeners.findIndex(
      (l) =>
        l.target === target &&
        l.type === type &&
        l.callback === callback &&
        l.capture === capture(options),
    );
    if (index >= 0) listeners.splice(index, 1);
  };
  const dispatch = (type, props = {}) => {
    const event = {type, timeStamp: 1500, ...props};
    const phases =
      type === 'visibilitychange' || type === 'prerenderingchange'
        ? [
            ['window', true],
            ['document', true],
            ['document', false],
            ['window', false],
          ]
        : [
            ['window', true],
            ['window', false],
          ];
    for (const [target, capture] of phases) {
      for (const listener of [...listeners]) {
        if (
          listener.target === target &&
          listener.type === type &&
          listener.capture === capture &&
          listeners.includes(listener)
        ) {
          if (listener.once) listeners.splice(listeners.indexOf(listener), 1);
          listener.callback(event);
        }
      }
    }
  };

  class PerformanceEventTiming {}
  Object.defineProperty(PerformanceEventTiming.prototype, 'interactionId', {
    value: 0,
    writable: true,
  });
  class PerformanceSoftNavigation {
    getLargestInteractionContentfulPaint() {}
  }
  stub('PerformanceEventTiming', PerformanceEventTiming);
  stub('PerformanceSoftNavigation', PerformanceSoftNavigation);
  stub(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = ['event', 'first-input', 'soft-navigation'];
      constructor(cb) {
        this.cb = cb;
        this.types = [];
        this.records = [];
        observers.push(this);
      }
      observe({type}) {
        this.types.push(type);
      }
      takeRecords() {
        return this.records.splice(0);
      }
      disconnect() {}
    },
  );
  stub('performance', {
    now: () => 3000,
    interactionCount: 0,
    getEntriesByType: (type) =>
      type === 'navigation'
        ? [
            {
              name: 'https://example.com/',
              entryType: 'navigation',
              type: 'navigate',
              navigationId: 1,
              activationStart: 0,
              responseStart: 10,
              domInteractive: 20,
              domContentLoadedEventStart: 30,
              domComplete: 40,
            },
          ]
        : [],
  });
  stub('document', {
    visibilityState: 'visible',
    prerendering: false,
    addEventListener: (...args) => addListener('document', ...args),
    removeEventListener: (...args) => removeListener('document', ...args),
  });
  stub('addEventListener', (...args) => addListener('window', ...args));
  stub('removeEventListener', (...args) => removeListener('window', ...args));

  const requestIdle = (cb) => {
    idleCallbacks.set(++idleId, cb);
    return idleId;
  };
  // Retain canceled callbacks to test callbacks already queued for execution.
  const cancelIdle = () => {};
  if (idleAPI) {
    stub('requestIdleCallback', requestIdle);
    stub('cancelIdleCallback', cancelIdle);
  } else {
    stub('requestIdleCallback', undefined);
    stub('cancelIdleCallback', undefined);
    delete globalThis.requestIdleCallback;
    delete globalThis.cancelIdleCallback;
    stub('setTimeout', requestIdle);
    stub('clearTimeout', cancelIdle);
  }

  const file = attribution ? 'attribution/onINP.js' : 'onINP.js';
  const {onINP} = await import(pathToFileURL(join(moduleDir, file)).href);
  const reports = [];
  const start = (opts = {}) => {
    onINP((metric) => {
      reports.push({...metric, entries: [...metric.entries]});
    }, opts);
    return observers.find((o) => o.types.includes('event'));
  };
  const deliver = async (observer, entries) => {
    observer.cb({getEntries: () => [...entries]});
    await Promise.resolve();
  };
  const runIdle = () => {
    for (const [id, callback] of [...idleCallbacks]) {
      idleCallbacks.delete(id);
      callback({});
    }
  };
  const setVisibility = (state) => {
    document.visibilityState = state;
    dispatch('visibilitychange');
  };
  const entry = (props = {}) => {
    const startTime = props.startTime ?? 1000;
    const duration = props.duration ?? 200;
    return Object.assign(Object.create(PerformanceEventTiming.prototype), {
      name: 'pointerdown',
      entryType: 'event',
      startTime,
      duration,
      processingStart: startTime + Math.min(16, duration / 4),
      processingEnd: startTime + Math.min(80, duration / 2),
      interactionId: 1,
      target: null,
      cancelable: true,
      ...props,
    });
  };

  return {start, reports, deliver, runIdle, setVisibility, dispatch, entry};
};

for (const attribution of [false, true]) {
  describe(
    'onINP pending entries (' +
      (attribution ? 'attribution' : 'standard') +
      ')',
    () => {
      it('reports the first interaction when hidden before idle runs', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start();
        const entry = h.entry();
        await h.deliver(observer, [entry]);
        assert.strictEqual(h.reports.length, 0);

        h.setVisibility('hidden');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [200],
        );
        assert.deepStrictEqual(h.reports[0].entries, [entry]);

        h.runIdle();
        h.dispatch('pagehide');
        h.setVisibility('hidden');
        assert.strictEqual(h.reports.length, 1);
      });

      it('reports the updated value after returning to a visible page', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start();
        await h.deliver(observer, [h.entry({duration: 120})]);
        h.runIdle();
        h.setVisibility('hidden');
        h.setVisibility('visible');
        await h.deliver(observer, [
          h.entry({interactionId: 2, startTime: 2000, duration: 320}),
        ]);

        h.setVisibility('hidden');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [120, 320],
        );
        assert.deepStrictEqual(
          h.reports.map((m) => m.delta),
          [120, 200],
        );
        h.runIdle();
        h.setVisibility('hidden');
        assert.strictEqual(h.reports.length, 2);
      });

      it('combines pending entries with observer records before reporting', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start();
        const pending = h.entry();
        const record = h.entry({name: 'pointerup'});
        await h.deliver(observer, [pending]);
        observer.records.push(record);

        h.setVisibility('hidden');
        assert.strictEqual(h.reports.length, 1);
        assert.deepStrictEqual(h.reports[0].entries, [pending, record]);
        assert.strictEqual(observer.records.length, 0);
        h.runIdle();
        assert.deepStrictEqual(h.reports[0].entries, [pending, record]);
        assert.strictEqual(h.reports.length, 1);
      });

      it('defers visible batches and reports their final candidate together', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start({reportAllChanges: true});
        await h.deliver(observer, [h.entry()]);
        await h.deliver(observer, [h.entry({interactionId: 2, duration: 320})]);
        assert.strictEqual(h.reports.length, 0);

        h.runIdle();
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [320],
        );
        h.setVisibility('hidden');
        assert.strictEqual(h.reports.length, 1);
      });

      it('reports all changes once when several batches are pending at hide', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start({reportAllChanges: true});
        await h.deliver(observer, [h.entry()]);
        await h.deliver(observer, [h.entry({interactionId: 2, duration: 320})]);

        h.setVisibility('hidden');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [320],
        );
        h.runIdle();
        h.dispatch('pagehide');
        assert.strictEqual(h.reports.length, 1);
      });

      it('drains on pagehide even while visibility remains visible', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start();
        await h.deliver(observer, [h.entry()]);
        observer.records.push(h.entry({interactionId: 2, duration: 320}));

        h.dispatch('pagehide');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [320],
        );
        assert.strictEqual(document.visibilityState, 'visible');
        h.runIdle();
        h.dispatch('pagehide');
        h.setVisibility('hidden');
        assert.strictEqual(h.reports.length, 1);
      });

      it('processes entries synchronously when the page is already hidden', async (t) => {
        const h = await setup(t, attribution);
        document.visibilityState = 'hidden';
        const observer = h.start({reportAllChanges: true});
        await h.deliver(observer, [h.entry()]);

        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [200],
        );
        h.setVisibility('hidden');
        h.runIdle();
        assert.strictEqual(h.reports.length, 1);
      });

      it('drains first-input entries with the timeout fallback', async (t) => {
        const h = await setup(t, attribution, {idleAPI: false});
        const observer = h.start();
        const entry = h.entry({entryType: 'first-input', duration: 16});
        await h.deliver(observer, [entry]);

        h.setVisibility('hidden');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [16],
        );
        assert.deepStrictEqual(h.reports[0].entries, [entry]);
        h.runIdle();
        assert.strictEqual(h.reports.length, 1);
      });

      it('preserves soft navigation boundaries across pending entries and records', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start({reportSoftNavs: true});
        await h.deliver(observer, [
          h.entry(),
          {
            entryType: 'soft-navigation',
            name: 'https://example.com/next',
            startTime: 1250,
            duration: 0,
            navigationId: 2,
            interactionId: 2,
          },
        ]);
        observer.records.push(
          h.entry({interactionId: 3, startTime: 1280, duration: 96}),
        );

        h.setVisibility('hidden');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [200, 96],
        );
        assert.deepStrictEqual(
          h.reports.map((m) => m.navigationType),
          ['navigate', 'soft-navigation'],
        );
        assert.strictEqual(h.reports[1].navigationId, 2);
        assert.strictEqual(h.reports[1].navigationStartTime, 1250);
        h.runIdle();
        assert.strictEqual(h.reports.length, 2);
      });

      it('does not replay drained entries into a metric after bfcache restore', async (t) => {
        const h = await setup(t, attribution);
        const observer = h.start();
        await h.deliver(observer, [h.entry({duration: 320})]);
        h.dispatch('pagehide', {persisted: true});
        h.dispatch('pageshow', {persisted: true, timeStamp: 2000});
        h.runIdle();
        await h.deliver(observer, [
          h.entry({interactionId: 2, startTime: 2100, duration: 80}),
        ]);

        h.setVisibility('hidden');
        assert.deepStrictEqual(
          h.reports.map((m) => m.value),
          [320, 80],
        );
        assert.deepStrictEqual(
          h.reports.map((m) => m.navigationType),
          ['navigate', 'back-forward-cache'],
        );
        assert.strictEqual(h.reports[1].navigationStartTime, 2000);
        h.runIdle();
        assert.strictEqual(h.reports.length, 2);
      });
    },
  );
}
