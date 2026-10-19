import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/home-analytics.js', import.meta.url), 'utf8');
const metricoolSource = readFileSync(new URL('../scripts/metricool.js', import.meta.url), 'utf8');

function eventTarget(properties = {}) {
  const listeners = new Map();
  return Object.assign(properties, {
    addEventListener(type, callback, options = {}) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ callback, once: options.once });
    },
    removeEventListener(type, callback) {
      listeners.set(type, (listeners.get(type) || []).filter(item => item.callback !== callback));
    },
    fire(type) {
      for (const item of [...(listeners.get(type) || [])]) {
        if (item.once) this.removeEventListener(type, item.callback);
        item.callback();
      }
    },
  });
}

function browser({ readyState = 'interactive', idleSupported = true, framesSupported = true, existingGtag = false } = {}) {
  const scripts = [];
  const timers = new Map();
  const idleCallbacks = new Map();
  const frameCallbacks = new Map();
  let handle = 0;
  const document = eventTarget({
    readyState,
    visibilityState: 'visible',
    title: 'Lisard Bellod',
    referrer: 'https://www.google.com/search?q=lisard',
    head: { appendChild(script) { scripts.push(script); } },
    createElement(tagName) { return eventTarget({ tagName }); },
    getElementById(id) { return scripts.find(script => script.id === id); },
  });
  const window = eventTarget({
    location: { href: 'https://lisardbellod.com/?utm_source=example#contacto' },
    setTimeout(callback, delay) {
      timers.set(++handle, { callback, delay });
      return handle;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  if (idleSupported) {
    window.requestIdleCallback = (callback, options) => {
      idleCallbacks.set(++handle, { callback, options });
      return handle;
    };
    window.cancelIdleCallback = id => idleCallbacks.delete(id);
  }
  if (framesSupported) {
    window.requestAnimationFrame = callback => {
      frameCallbacks.set(++handle, callback);
      return handle;
    };
    window.cancelAnimationFrame = id => frameCallbacks.delete(id);
  }
  if (existingGtag) {
    window.dataLayer = [['event', 'prior_event']];
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  const context = vm.createContext({ window, document });
  return {
    window, document, scripts, timers, idleCallbacks, frameCallbacks,
    paintFrame() {
      for (const [id, callback] of [...frameCallbacks]) {
        frameCallbacks.delete(id);
        callback();
      }
    },
    run() { vm.runInContext(source, context); },
    runMetricool() { vm.runInContext(metricoolSource, context); },
    queue() { return Array.from(window.dataLayer, command => Array.from(command)); },
  };
}

test('queues a normal GA pageview and early events, preserving the initial referral context', () => {
  const b = browser();
  b.run();
  assert.equal(b.scripts.length, 0);
  assert.equal(b.timers.size, 0);
  assert.equal(b.idleCallbacks.size, 0);
  b.window.gtag('event', 'click', { destination: 'shop' });
  b.window.location.href = 'https://lisardbellod.com/#another-section';
  b.document.title = 'Changed title';
  b.document.referrer = '';
  const queue = b.queue();
  assert.equal(queue[0][0], 'js');
  assert.equal(queue[0][1].getTime() <= Date.now(), true);
  assert.equal(queue[1][0], 'config');
  assert.equal(queue[1][1], 'G-PH35Q4YGM6');
  assert.deepEqual(JSON.parse(JSON.stringify(queue[1][2])), {
    page_location: 'https://lisardbellod.com/?utm_source=example#contacto',
    page_referrer: 'https://www.google.com/search?q=lisard',
    page_title: 'Lisard Bellod',
  });
  assert.equal(queue[1][2].send_page_view, undefined);
  assert.deepEqual(queue[2].slice(0, 2), ['event', 'click']);
});

test('gives the page a paint opportunity after load before idle analytics, without duplicate pageviews', () => {
  const b = browser();
  b.run();
  b.window.fire('load');
  assert.equal(b.scripts.length, 0);
  assert.equal(b.idleCallbacks.size, 0);
  assert.equal(b.frameCallbacks.size, 1);
  b.paintFrame();
  assert.equal(b.scripts.length, 0);
  assert.equal(b.idleCallbacks.size, 0);
  assert.equal(b.frameCallbacks.size, 1);
  b.paintFrame();
  assert.equal(b.scripts.length, 0);
  assert.equal(b.frameCallbacks.size, 0);
  const idle = [...b.idleCallbacks.values()][0];
  const fallback = [...b.timers.values()][0];
  assert.equal(idle.options.timeout, 1500);
  assert.equal(fallback.delay, 1500);
  idle.callback();
  assert.deepEqual(b.scripts.map(script => script.src), [
    'https://www.googletagmanager.com/gtag/js?id=G-PH35Q4YGM6',
    '/scripts/metricool.js',
  ]);
  assert.equal(b.scripts.every(script => script.async && script.fetchPriority === 'low'), true);
  assert.equal(b.timers.size, 0);
  assert.equal(b.idleCallbacks.size, 0);
  fallback.callback();
  idle.callback();
  b.window.fire('load');
  b.window.fire('pagehide');
  b.document.visibilityState = 'hidden';
  b.document.fire('visibilitychange');
  b.run();
  assert.equal(b.scripts.length, 2);
  assert.equal(b.queue().filter(command => command[0] === 'config').length, 1);
});

test('a normal visit without interaction still loads analytics without requestIdleCallback', () => {
  const b = browser({ idleSupported: false });
  b.run();
  b.window.fire('load');
  assert.equal(b.scripts.length, 0);
  const fallback = [...b.timers.values()][0];
  assert.equal(fallback.delay, 1500);
  fallback.callback();
  assert.equal(b.scripts.length, 2);
});

test('the timer also starts analytics if an idle callback never runs', () => {
  const b = browser();
  b.run();
  b.window.fire('load');
  b.paintFrame();
  b.paintFrame();
  assert.equal(b.idleCallbacks.size, 1);
  [...b.timers.values()][0].callback();
  assert.equal(b.scripts.length, 2);
  assert.equal(b.idleCallbacks.size, 0);
});

test('the load deadline still starts analytics when animation frames are suspended', () => {
  const b = browser();
  b.run();
  b.window.fire('load');
  const pendingFrame = [...b.frameCallbacks.values()][0];
  const fallback = [...b.timers.values()][0];
  assert.equal(fallback.delay, 1500);
  fallback.callback();
  assert.equal(b.scripts.length, 2);
  assert.equal(b.frameCallbacks.size, 0);
  pendingFrame();
  assert.equal(b.frameCallbacks.size, 0);
  assert.equal(b.idleCallbacks.size, 0);
  assert.equal(b.scripts.length, 2);
});

test('still schedules idle analytics when requestAnimationFrame is unavailable', () => {
  const b = browser({ framesSupported: false });
  b.run();
  b.window.fire('load');
  assert.equal(b.idleCallbacks.size, 1);
  [...b.idleCallbacks.values()][0].callback();
  assert.equal(b.scripts.length, 2);
});

test('a loader added after load still schedules analytics', () => {
  const b = browser({ readyState: 'complete' });
  b.run();
  assert.equal(b.scripts.length, 0);
  assert.equal(b.idleCallbacks.size, 0);
  b.paintFrame();
  b.paintFrame();
  assert.equal(b.idleCallbacks.size, 1);
  [...b.idleCallbacks.values()][0].callback();
  assert.equal(b.scripts.length, 2);
});

test('becoming hidden cancels frames and starts analytics without waiting for another paint', () => {
  const b = browser();
  b.run();
  b.window.fire('load');
  b.paintFrame();
  assert.equal(b.frameCallbacks.size, 1);
  b.document.visibilityState = 'hidden';
  b.document.fire('visibilitychange');
  assert.equal(b.scripts.length, 2);
  assert.equal(b.frameCallbacks.size, 0);
  assert.equal(b.timers.size, 0);
  assert.equal(b.idleCallbacks.size, 0);
});

test('a short visit becoming hidden attempts loading once even before load', () => {
  const b = browser();
  b.run();
  b.document.fire('visibilitychange');
  assert.equal(b.scripts.length, 0);
  b.document.visibilityState = 'hidden';
  b.document.fire('visibilitychange');
  assert.equal(b.scripts.length, 2);
  b.window.fire('load');
  b.window.fire('pagehide');
  assert.equal(b.scripts.length, 2);
  assert.equal(b.timers.size, 0);
  assert.equal(b.queue().filter(command => command[0] === 'config').length, 1);
});

test('pagehide is a best-effort fallback without duplicating a restored pageview', () => {
  const b = browser();
  b.run();
  b.window.fire('pagehide');
  b.window.fire('pageshow');
  b.window.fire('load');
  assert.equal(b.scripts.length, 2);
  assert.equal(b.queue().filter(command => command[0] === 'config').length, 1);
});

test('keeps any existing gtag stub, dataLayer, and queued events usable', () => {
  const b = browser({ existingGtag: true });
  const previousGtag = b.window.gtag;
  const previousDataLayer = b.window.dataLayer;
  b.run();
  assert.equal(b.window.gtag, previousGtag);
  assert.equal(b.window.dataLayer, previousDataLayer);
  b.window.gtag('event', 'later_event');
  assert.deepEqual(b.queue().filter(command => command[0] === 'event'), [
    ['event', 'prior_event'], ['event', 'later_event'],
  ]);
});

test('reuses the existing Metricool tracker with the same account and one tracking call', () => {
  const b = browser();
  const calls = [];
  b.window.beTracker = { t(options) { calls.push(options.hash); } };
  b.run();
  b.window.fire('pagehide');
  b.runMetricool();
  const tracker = b.document.getElementById('metricool-tracker');
  assert.equal(tracker.src, 'https://tracker.metricool.com/resources/be.js');
  tracker.fire('load');
  tracker.fire('load');
  b.runMetricool();
  assert.deepEqual(calls, ['12410878ef0a39b76a3225fac6032d8b']);
  assert.equal(b.scripts.filter(script => script.id === 'metricool-tracker').length, 1);
});

test('does not reload Metricool if the site tracker is already present', () => {
  const b = browser();
  b.runMetricool();
  b.run();
  b.window.fire('pagehide');
  assert.equal(b.scripts.filter(script => script.id === 'metricool-tracker').length, 1);
  assert.equal(b.scripts.some(script => script.id === 'home-metricool-loader'), false);
});
