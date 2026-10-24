const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const router = require('./routing.js');

// Exercise the real controller with a small DOM adapter and deterministic timers.
// Browser rendering is checked separately; these tests cover navigation lifecycle.
function page({ hidden = false, prerendering = false, search = '', clipboard = true } = {}) {
  const nodes = new Map();
  const documentEvents = {}, windowEvents = {}, timers = new Map();
  const navigations = [], copies = [];
  let nextTimer = 0;
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: false, value: '', textContent: '', events: {}, attributes: {},
      classList: { toggle() {} }, setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(key, callback) { this.events[key] = callback; },
      focus() { this.focused = true; }, select() { this.selected = true; }, setSelectionRange() {}
    });
    return nodes.get(id);
  }
  const document = {
    hidden, prerendering, documentElement: {}, title: '',
    getElementById: node, querySelectorAll: () => [], execCommand: () => false,
    addEventListener: (key, callback) => { documentEvents[key] = callback; }
  };
  const location = {
    href: 'https://bioresonance.club/go/' + search, search,
    replace: (url) => navigations.push(url)
  };
  const window = { BioGo: router, addEventListener: (key, callback) => { windowEvents[key] = callback; } };
  const context = vm.createContext({
    window, document, location, URL,
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      languages: ['fr-FR'], maxTouchPoints: 5,
      clipboard: { writeText: async (text) => { if (!clipboard) throw Error('denied'); copies.push(text); } }
    },
    history: { replaceState: (_, __, url) => { location.href = url.href; location.search = url.search; } },
    setTimeout: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id)
  });
  vm.runInContext(fs.readFileSync(__dirname + '/locales.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync(__dirname + '/app.js', 'utf8'), context);
  return {
    node, document, location, navigations, copies,
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); },
    visibility(visible) { document.hidden = !visible; documentEvents.visibilitychange(); },
    restore() { windowEvents.pageshow({ persisted: true }); },
    activatePrerender() { document.prerendering = false; documentEvents.prerenderingchange(); }
  };
}

test('normal iPhone opens the fixed App Store once and leaves a usable fallback', () => {
  const p = page(); p.flush(); p.visibility(false); p.visibility(true); p.flush();
  assert.deepEqual(p.navigations, [router.STORES.ios]);
  assert.equal(p.node('store-ios').href, router.STORES.ios);
  assert.equal(p.node('store-android').href, router.STORES.android);
  assert.doesNotMatch(p.node('title').textContent, /Ouverture/);
});
test('a background tab waits until visible without duplicating navigation', () => {
  const p = page({ hidden: true }); p.flush(); assert.equal(p.navigations.length, 0);
  p.visibility(true); p.flush(); assert.equal(p.navigations.length, 1);
});
test('prerender does not open the store until activated', () => {
  const p = page({ prerendering: true }); p.flush(); assert.equal(p.navigations.length, 0);
  p.activatePrerender(); p.flush(); assert.equal(p.navigations.length, 1);
});
test('restoring history never starts a redirect loop', () => {
  const p = page(); p.restore(); p.visibility(false); p.visibility(true); p.flush();
  assert.equal(p.navigations.length, 0);
});
test('manual language selection cancels automatic navigation and updates the copied URL', () => {
  const p = page(); p.node('language').events.change({ target: { value: 'de' } });
  p.visibility(false); p.visibility(true); p.flush();
  assert.equal(p.document.documentElement.lang, 'de');
  assert.equal(p.navigations.length, 0);
  assert.equal(new URL(p.node('share-url').value).searchParams.get('lang'), 'de');
  assert.match(p.node('title').textContent, /Bioresonance/);
});
test('clipboard denial exposes a selectable canonical URL and manual instructions', async () => {
  const p = page({ clipboard: false, search: '?manual=1&src=tiktok&redirect=https://bad.example' });
  await p.node('copy-link').events.click(); p.flush();
  assert.equal(p.node('copy-fallback').hidden, false);
  assert.equal(p.node('share-url').selected, true);
  assert.equal(p.node('share-url').value, 'https://bioresonance.club/go/?lang=fr&src=tiktok');
  assert.ok(p.node('copy-status').textContent);
  assert.equal(p.navigations.length, 0);
});
test('successful copy keeps the language and never copies preview controls', async () => {
  const p = page({ search: '?preview=tiktok&platform=ios&lang=it&utm_source=instagram' });
  await p.node('copy-link').events.click(); p.flush();
  assert.deepEqual(p.copies, ['https://bioresonance.club/go/?lang=it&utm_source=instagram']);
  assert.equal(p.navigations.length, 0);
});
