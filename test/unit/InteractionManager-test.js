import {describe, it, beforeEach} from 'node:test';
import assert from 'node:assert';
import {InteractionManager} from '../../dist/modules/lib/InteractionManager.js';

// `getInteractionCount()` reads `performance.interactionCount`, so the count can be driven from
// the tests by stubbing it.
const setInteractionCount = (count) => {
  globalThis.performance = {interactionCount: count};
};

const entry = (interactionId, duration) => ({
  interactionId,
  duration,
  startTime: 0,
  entryType: 'event',
  name: 'pointerdown',
});

describe('InteractionManager', () => {
  beforeEach(() => setInteractionCount(0));

  it('tracks the interaction count for a navigation per instance', () => {
    const a = new InteractionManager();
    const b = new InteractionManager();

    setInteractionCount(3);
    // Resetting one manager must not make the other think no interactions happened, otherwise
    // whichever `onINP()` instance resets first silently starves the rest.
    a._resetInteractions();

    assert.strictEqual(a._getInteractionCountForNavigation(), 0);
    assert.strictEqual(b._getInteractionCountForNavigation(), 3);
  });

  it('reports the dummy interaction to every instance after a soft navigation', () => {
    const a = new InteractionManager();
    const b = new InteractionManager();

    // Both start the same navigation.
    setInteractionCount(1);
    a._resetInteractions();
    b._resetInteractions();

    // An interaction below the Event Timing threshold: counted, but no entry is observed.
    setInteractionCount(2);

    // The next soft navigation reaches each instance in turn. `a` reports and starts the new
    // navigation before `b` has reported for the old one, which used to leave `b` seeing no
    // interactions at all.
    assert.strictEqual(
      a._estimateP98LongestInteraction('soft-navigation')._latency,
      8,
    );
    a._resetInteractions();

    assert.strictEqual(
      b._estimateP98LongestInteraction('soft-navigation')._latency,
      8,
    );
  });

  it('keeps its own interaction candidates', () => {
    const a = new InteractionManager();
    const b = new InteractionManager();

    setInteractionCount(1);
    a._processEntry(entry(1, 200));

    assert.strictEqual(
      a._estimateP98LongestInteraction('navigate')._latency,
      200,
    );
    assert.strictEqual(b._estimateP98LongestInteraction('navigate'), undefined);
  });
});
