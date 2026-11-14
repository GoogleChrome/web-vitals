import {it} from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

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

// Fresh imports isolate the shared `firstHiddenTime` state between tests.
const importFreshOnLCP = async (t) => {
  const moduleDir = await mkdtemp(join(tmpdir(), 'web-vitals-lcp-'));
  t.after(async () => {
    assert.equal(dirname(moduleDir), resolve(tmpdir()));
    assert(basename(moduleDir).startsWith('web-vitals-lcp-'));
    await rm(moduleDir, {recursive: true, force: true});
  });
  await cp(new URL('../../dist/modules/', import.meta.url), moduleDir, {
    recursive: true,
  });
  await writeFile(join(moduleDir, 'package.json'), '{"type":"module"}');
  return import(pathToFileURL(join(moduleDir, 'onLCP.js')).href);
};

for (const reportAllChanges of [false, true]) {
  it(`ignores entries after the page was hidden when loaded late (reportAllChanges === ${reportAllChanges})`, async (t) => {
    const listeners = new Map();
    let observerCallback;
    // Painted while the page was visible.
    const entryBeforeHidden = {
      entryType: 'largest-contentful-paint',
      startTime: 1000,
      renderTime: 1000,
      size: 100,
    };
    // Painted after the page was hidden and then shown again.
    const entryAfterHidden = {
      entryType: 'largest-contentful-paint',
      startTime: 5100,
      renderTime: 5100,
      size: 500,
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
      now: () => 6000,
      getEntriesByType: (type) =>
        type === 'navigation'
          ? [{type: 'navigate', activationStart: 0, responseStart: 100}]
          : type === 'visibility-state'
            ? [
                {name: 'visible', startTime: 0},
                {name: 'hidden', startTime: 2000},
                {name: 'visible', startTime: 5000},
              ]
            : [],
    };
    globalThis.PerformanceObserver = class {
      static supportedEntryTypes = ['largest-contentful-paint'];
      constructor(callback) {
        observerCallback = callback;
      }
      observe() {}
      takeRecords() {
        return [];
      }
      disconnect() {}
    };

    const {onLCP} = await importFreshOnLCP(t);
    const reports = [];
    onLCP((metric) => reports.push(structuredClone(metric)), {
      reportAllChanges,
    });

    // The library was loaded late, so both buffered entries arrive together.
    observerCallback({getEntries: () => [entryBeforeHidden, entryAfterHidden]});
    await new Promise((resolve) => setTimeout(resolve));

    document.visibilityState = 'hidden';
    for (const callback of [...listeners.get('visibilitychange')]) {
      callback({type: 'visibilitychange', isTrusted: true, timeStamp: 7000});
    }

    assert.equal(reports.length, 1);
    assert.equal(reports[0].value, 1000);
    assert.deepEqual(reports[0].entries, [entryBeforeHidden]);
  });
}
