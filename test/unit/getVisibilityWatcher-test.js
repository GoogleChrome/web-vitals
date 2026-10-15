import {describe, it} from 'node:test';
import assert from 'node:assert';
import {cp, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const setup = async (
  t,
  {
    visibilityState = 'visible',
    prerendering = false,
    visibilityEntries = [],
  } = {},
) => {
  // Fresh imports isolate shared visibility and bfcache state between tests.
  const moduleDir = await mkdtemp(join(tmpdir(), 'web-vitals-visibility-'));
  t.after(async () => {
    assert.strictEqual(dirname(moduleDir), resolve(tmpdir()));
    assert(basename(moduleDir).startsWith('web-vitals-visibility-'));
    await rm(moduleDir, {recursive: true, force: true});
  });
  await cp(new URL('../../dist/modules/', import.meta.url), moduleDir, {
    recursive: true,
  });
  await writeFile(join(moduleDir, 'package.json'), '{"type":"module"}');

  const originalGlobals = new Map();
  const listeners = new Map();
  const tasks = [];
  const frames = [];
  const observers = [];
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

  stub('document', {visibilityState, prerendering});
  stub('performance', {
    now: () => 3000,
    getEntriesByType: (type) =>
      type === 'visibility-state'
        ? visibilityEntries
        : type === 'navigation'
          ? [{type: 'navigate', activationStart: 0, responseStart: 10}]
          : [],
  });
  stub('addEventListener', (type, callback) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
  });
  stub('removeEventListener', (type, callback) => {
    listeners.get(type)?.delete(callback);
  });
  stub('setTimeout', (callback) => tasks.push(callback));
  stub('requestAnimationFrame', (callback) => frames.push(callback));
  stub(
    'PerformanceObserver',
    class {
      static supportedEntryTypes = [
        'paint',
        'layout-shift',
        'largest-contentful-paint',
      ];
      constructor(callback) {
        this.callback = callback;
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

  const load = (file) => import(pathToFileURL(join(moduleDir, file)).href);
  const {getVisibilityWatcher} = await load('lib/getVisibilityWatcher.js');
  const dispatch = (type, props = {}) => {
    const event = {type, timeStamp: 1500, ...props};
    for (const callback of [...(listeners.get(type) || [])]) callback(event);
  };
  const runTasks = () => {
    for (const callback of tasks.splice(0)) callback();
  };
  const runFrames = () => {
    for (const callback of frames.splice(0)) callback();
  };
  const deliver = async (observer, entries) => {
    observer.callback({getEntries: () => [...entries]});
    await Promise.resolve();
  };

  return {
    getVisibilityWatcher,
    dispatch,
    runTasks,
    runFrames,
    load,
    observers,
    deliver,
  };
};

describe('getVisibilityWatcher', () => {
  it('notifies on visible pagehide and records its first hidden time', async (t) => {
    const h = await setup(t);
    const watcher = h.getVisibilityWatcher();
    let calls = 0;
    watcher.onHidden(() => calls++);

    h.dispatch('visibilitychange');
    assert.strictEqual(calls, 0);
    assert.strictEqual(watcher.firstHiddenTime, Infinity);

    h.dispatch('pagehide', {timeStamp: 800});
    assert.strictEqual(document.visibilityState, 'visible');
    assert.strictEqual(calls, 1);
    assert.strictEqual(watcher.firstHiddenTime, 800);

    document.visibilityState = 'hidden';
    h.dispatch('visibilitychange', {timeStamp: 900});
    h.dispatch('pagehide', {timeStamp: 1000});
    assert.strictEqual(calls, 3);
    assert.strictEqual(watcher.firstHiddenTime, 800);
  });

  it('notifies on pagehide without replacing a background hidden time', async (t) => {
    const h = await setup(t, {visibilityState: 'hidden'});
    const watcher = h.getVisibilityWatcher();
    let calls = 0;
    watcher.onHidden(() => calls++);

    h.dispatch('pagehide');
    assert.strictEqual(calls, 1);
    assert.strictEqual(watcher.firstHiddenTime, 0);
  });

  it('preserves a recorded visibility-state timestamp on pagehide', async (t) => {
    const h = await setup(t, {
      visibilityEntries: [{name: 'hidden', startTime: 120}],
    });
    const watcher = h.getVisibilityWatcher();

    h.dispatch('pagehide');
    assert.strictEqual(watcher.firstHiddenTime, 120);
  });

  it('keeps background prerender activation at zero without a hidden callback', async (t) => {
    const h = await setup(t, {
      visibilityState: 'hidden',
      prerendering: true,
      visibilityEntries: [{name: 'hidden', startTime: 120}],
    });
    const watcher = h.getVisibilityWatcher();
    let calls = 0;
    watcher.onHidden(() => calls++);
    assert.strictEqual(watcher.firstHiddenTime, Infinity);

    document.prerendering = false;
    h.dispatch('prerenderingchange', {timeStamp: 500});
    assert.strictEqual(watcher.firstHiddenTime, 0);
    assert.strictEqual(calls, 0);
    h.dispatch('pagehide', {timeStamp: 600});
    assert.strictEqual(watcher.firstHiddenTime, 0);
    assert.strictEqual(calls, 1);
  });

  it('records pagehide after prerender activation in the foreground', async (t) => {
    const h = await setup(t, {
      visibilityState: 'hidden',
      prerendering: true,
    });
    const watcher = h.getVisibilityWatcher();

    document.prerendering = false;
    document.visibilityState = 'visible';
    h.dispatch('prerenderingchange', {timeStamp: 500});
    assert.strictEqual(watcher.firstHiddenTime, Infinity);
    h.dispatch('pagehide', {timeStamp: 600});
    assert.strictEqual(watcher.firstHiddenTime, 600);
  });

  for (const restoredVisibility of ['visible', 'hidden']) {
    it(`resets hidden time after bfcache restore to ${restoredVisibility}`, async (t) => {
      const h = await setup(t);
      const watcher = h.getVisibilityWatcher();
      let calls = 0;
      watcher.onHidden(() => calls++);

      h.dispatch('pagehide', {persisted: true, timeStamp: 1500});
      document.visibilityState = 'hidden';
      h.dispatch('pageshow', {persisted: true, timeStamp: 2000});
      assert.strictEqual(watcher.firstHiddenTime, 1500);

      document.visibilityState = restoredVisibility;
      h.runTasks();
      assert.strictEqual(
        watcher.firstHiddenTime,
        restoredVisibility === 'visible' ? Infinity : 0,
      );
      assert.strictEqual(calls, 1);

      h.dispatch('pagehide', {persisted: true, timeStamp: 2500});
      assert.strictEqual(calls, 2);
      assert.strictEqual(
        watcher.firstHiddenTime,
        restoredVisibility === 'visible' ? 2500 : 0,
      );
    });
  }
});

for (const name of ['FCP', 'LCP']) {
  for (const startTime of [1400, 1500, 1600]) {
    it(`on${name} only accepts entries before pagehide (${startTime})`, async (t) => {
      const h = await setup(t);
      const metricModule = await h.load(`on${name}.js`);
      const reports = [];
      metricModule[`on${name}`]((metric) => reports.push({...metric}), {
        reportAllChanges: true,
      });
      h.dispatch('pagehide', {timeStamp: 1500});
      assert.strictEqual(document.visibilityState, 'visible');

      const entryType = name === 'FCP' ? 'paint' : 'largest-contentful-paint';
      const observer = h.observers.find((o) => o.types.includes(entryType));
      await h.deliver(observer, [
        {name: 'first-contentful-paint', entryType, startTime},
      ]);
      assert.deepStrictEqual(
        reports.map((m) => m.value),
        startTime < 1500 ? [startTime] : [],
      );
    });
  }
}

describe('onCLS pagehide', () => {
  it('drains buffered shifts on visible pagehide and reports the value once', async (t) => {
    const h = await setup(t);
    const {onCLS} = await h.load('onCLS.js');
    const reports = [];
    onCLS((metric) => reports.push({...metric, entries: [...metric.entries]}));
    const paintObserver = h.observers.find((o) => o.types.includes('paint'));
    await h.deliver(paintObserver, [
      {name: 'first-contentful-paint', entryType: 'paint', startTime: 100},
    ]);
    const shiftObserver = h.observers.find((o) =>
      o.types.includes('layout-shift'),
    );
    const shifts = [
      {entryType: 'layout-shift', startTime: 1000, value: 0.125},
      {entryType: 'layout-shift', startTime: 1200, value: 0.25},
    ];
    shiftObserver.records.push(...shifts);
    assert.strictEqual(reports.length, 0);

    h.dispatch('pagehide');
    assert.strictEqual(document.visibilityState, 'visible');
    assert.deepStrictEqual(
      reports.map((m) => m.value),
      [0.375],
    );
    assert.deepStrictEqual(reports[0].entries, shifts);
    assert.strictEqual(shiftObserver.records.length, 0);

    document.visibilityState = 'hidden';
    h.dispatch('visibilitychange');
    h.dispatch('pagehide');
    h.runTasks();
    assert.strictEqual(reports.length, 1);
  });

  it('reports fresh shifts after bfcache restore without replaying drained records', async (t) => {
    const h = await setup(t);
    const {onCLS} = await h.load('onCLS.js');
    const reports = [];
    onCLS((metric) => reports.push({...metric, entries: [...metric.entries]}));
    const paintObserver = h.observers.find((o) => o.types.includes('paint'));
    await h.deliver(paintObserver, [
      {name: 'first-contentful-paint', entryType: 'paint', startTime: 100},
    ]);
    const shiftObserver = h.observers.find((o) =>
      o.types.includes('layout-shift'),
    );
    shiftObserver.records.push({
      entryType: 'layout-shift',
      startTime: 1000,
      value: 0.25,
    });
    h.dispatch('pagehide', {persisted: true, timeStamp: 1500});
    h.dispatch('pageshow', {persisted: true, timeStamp: 2000});
    h.runTasks();
    h.runFrames();
    h.runFrames();

    const restoredShift = {
      entryType: 'layout-shift',
      startTime: 2100,
      value: 0.125,
    };
    shiftObserver.records.push(restoredShift);
    h.dispatch('pagehide', {persisted: true, timeStamp: 2500});
    assert.deepStrictEqual(
      reports.map((m) => m.value),
      [0.25, 0.125],
    );
    assert.deepStrictEqual(
      reports.map((m) => m.navigationType),
      ['navigate', 'back-forward-cache'],
    );
    assert.strictEqual(reports[1].navigationStartTime, 2000);
    assert.deepStrictEqual(reports[1].entries, [restoredShift]);
    assert.strictEqual(shiftObserver.records.length, 0);
  });
});
