// No real timer may outlive the test file that started it.
//
// Components like Toast start real timers (a 2.6s auto-dismiss). If a test file
// finishes first, Jest tears its environment down while the timer is still
// queued; when it fires, the callback runs against a dead environment and the
// error is reported against whichever test that worker is running by then.
// That made an unrelated test (SplashScreen) fail at random on CI. Tracking
// every timer and clearing the leftovers before teardown removes the whole
// class of failure.
const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;
const pending = new Set();

global.setTimeout = function trackedSetTimeout(fn, ms, ...args) {
  const id = realSetTimeout(function () {
    pending.delete(id);
    if (typeof fn === 'function') fn(...args);
  }, ms);
  pending.add(id);
  return id;
};

global.clearTimeout = function trackedClearTimeout(id) {
  pending.delete(id);
  return realClearTimeout(id);
};

afterAll(() => {
  for (const id of pending) realClearTimeout(id);
  pending.clear();
});
