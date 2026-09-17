import {describe, it, before, beforeEach} from 'node:test';
import assert from 'node:assert';

const observers = [];

const navigationEntry = {
  entryType: 'navigation',
  type: 'navigate',
  name: 'https://example.com/',
  activationStart: 0,
  responseStart: 100,
  domInteractive: 200,
  domContentLoadedEventStart: 210,
  domComplete: 220,
};

let resourceEntries = [];

const stubGlobals = () => {
  observers.length = 0;
  resourceEntries = [];
  globalThis.PerformanceObserver = class {
    static supportedEntryTypes = [
      'largest-contentful-paint',
      'resource',
      'navigation',
      'paint',
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
    now: () => 1000,
    getEntriesByType: (type) => {
      if (type === 'navigation') return [navigationEntry];
      if (type === 'resource') return resourceEntries;
      return [];
    },
  };
  globalThis.document = {
    visibilityState: 'visible',
    prerendering: false,
    wasDiscarded: false,
    readyState: 'complete',
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(1000), 0);
  globalThis.requestIdleCallback = (cb) => setTimeout(() => cb({}), 0);
  globalThis.cancelIdleCallback = () => {};
};

const lcpEntry = (props) => ({
  entryType: 'largest-contentful-paint',
  name: '',
  renderTime: 0,
  loadTime: 0,
  size: 100,
  id: '',
  url: '',
  element: null,
  ...props,
});

const resourceEntry = (props) => ({
  entryType: 'resource',
  initiatorType: 'img',
  ...props,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('LCP attribution resource lookup', () => {
  let onLCP;
  // The module subscribes to `resource` entries when it is first imported, so
  // this observer has to be kept around rather than looked up per test.
  let resourceObserver;

  before(async () => {
    stubGlobals();
    ({onLCP} = await import('../../dist/modules/attribution/onLCP.js'));
    resourceObserver = observers.find((o) => o.types.includes('resource'));
    assert(resourceObserver, 'resource observer should be registered');
  });

  beforeEach(() => stubGlobals());

  // Runs `onLCP()` and reports a single LCP entry, returning its attribution.
  const reportLCP = async (entry) => {
    const reports = [];
    onLCP((metric) => reports.push(metric), {reportAllChanges: true});

    const lcpObserver = observers.find((o) =>
      o.types.includes('largest-contentful-paint'),
    );
    assert(lcpObserver, 'LCP observer should be registered');
    lcpObserver.cb({getEntries: () => [lcpEntry(entry)]});

    await flush();
    return reports.at(-1).attribution;
  };

  it('uses the buffered resource entry to attribute the LCP subparts', async () => {
    // Populate the local resource buffer, as the #775 case where the browser's
    // own entries are not available does.
    resourceObserver.cb({
      getEntries: () => [
        resourceEntry({
          name: 'https://example.com/buffered.jpg',
          requestStart: 210,
          responseEnd: 800,
          startTime: 210,
          duration: 590,
        }),
      ],
    });
    await flush();

    const a = await reportLCP({
      url: 'https://example.com/buffered.jpg',
      startTime: 1000,
      renderTime: 1000,
    });

    assert.strictEqual(a.lcpResourceEntry.requestStart, 210);
    assert.strictEqual(a.timeToFirstByte, 100);
    assert.strictEqual(a.resourceLoadDelay, 110);
    assert.strictEqual(a.resourceLoadDuration, 590);
    assert.strictEqual(a.elementRenderDelay, 200);
  });

  it('ignores a request for the LCP resource that started after the paint', async () => {
    const url = 'https://example.com/hero.jpg';
    resourceEntries = [
      resourceEntry({
        name: url,
        requestStart: 210,
        responseEnd: 800,
        startTime: 210,
        duration: 590,
      }),
      resourceEntry({
        name: url,
        initiatorType: 'fetch',
        requestStart: 1510,
        responseEnd: 1600,
        startTime: 1510,
        duration: 90,
      }),
    ];

    const a = await reportLCP({url, startTime: 1000, renderTime: 1000});

    // The fetch came after the paint so it cannot be the LCP resource.
    assert.strictEqual(a.lcpResourceEntry.initiatorType, 'img');
    assert.strictEqual(a.lcpResourceEntry.requestStart, 210);
    assert.strictEqual(a.resourceLoadDelay, 110);
    assert.strictEqual(a.resourceLoadDuration, 590);
    assert.strictEqual(a.elementRenderDelay, 200);
  });

  it('still matches a resource that keeps downloading past the LCP', async () => {
    const url = 'https://example.com/long.mp4';
    resourceEntries = [
      resourceEntry({
        name: url,
        initiatorType: 'video',
        requestStart: 210,
        responseEnd: 2000,
        startTime: 210,
        duration: 1790,
      }),
    ];

    const a = await reportLCP({url, startTime: 1000, renderTime: 1000});

    assert.strictEqual(a.resourceLoadDelay, 110);
    // Capped at the LCP time rather than the response end.
    assert.strictEqual(a.resourceLoadDuration, 790);
    assert.strictEqual(a.elementRenderDelay, 0);
  });

  it('prefers the later of two requests for the same URL when both are pre-paint', async () => {
    const url = 'https://example.com/soft-nav.jpg';
    resourceEntries = [
      resourceEntry({
        name: url,
        requestStart: 210,
        responseEnd: 400,
        startTime: 210,
        duration: 190,
      }),
      resourceEntry({
        name: url,
        requestStart: 500,
        responseEnd: 800,
        startTime: 500,
        duration: 300,
      }),
    ];

    const a = await reportLCP({url, startTime: 1000, renderTime: 1000});

    assert.strictEqual(a.lcpResourceEntry.requestStart, 500);
    assert.strictEqual(a.resourceLoadDelay, 400);
    assert.strictEqual(a.resourceLoadDuration, 300);
    assert.strictEqual(a.elementRenderDelay, 200);
  });

  it('leaves the subparts at 0 when no pre-paint entry for the URL is left', async () => {
    const url = 'https://example.com/evicted.jpg';
    resourceEntries = [
      resourceEntry({
        name: url,
        initiatorType: 'fetch',
        requestStart: 1510,
        responseEnd: 1600,
        startTime: 1510,
        duration: 90,
      }),
    ];

    const a = await reportLCP({url, startTime: 1000, renderTime: 1000});

    assert.strictEqual(a.lcpResourceEntry, undefined);
    assert.strictEqual(a.timeToFirstByte, 100);
    assert.strictEqual(a.resourceLoadDelay, 0);
    assert.strictEqual(a.resourceLoadDuration, 0);
    assert.strictEqual(a.elementRenderDelay, 900);
  });
});
