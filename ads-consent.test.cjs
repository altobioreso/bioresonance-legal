const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, 'ads-consent.js'), 'utf8');
const key = 'bioresonance.ads-consent.v1';
const lifetime = 180 * 24 * 60 * 60 * 1000;
const now = 1791468000000;
const savedChoice = (choice, timestamp = now) => JSON.stringify({ choice, timestamp, version: 1 });

function run({
  url = 'https://bioresonance.club/fr.html?condition=private#gclid-private',
  saved = null, sessionSaved = null, cookies = '',
  blockedRead = false, blockedWrite = false, blockedRemove = false, blockedSession = false,
  missingBanner = false, linkUrls = [],
} = {}) {
  const listeners = new Map();
  const scripts = [];
  const cookieWrites = [];
  const replacements = [];
  const stored = new Map(saved === null ? [] : [[key, saved]]);
  const sessionStored = new Map(sessionSaved === null ? [] : [[key + '.withdrawn', sessionSaved]]);
  let reloads = 0;
  let clock = now;
  const document = { activeElement: null };
  const links = linkUrls.map((href) => ({ href }));
  function control() {
    return {
      hidden: true,
      addEventListener(type, fn) { this[type] = fn; },
      focus() { document.activeElement = this; },
    };
  }
  const accept = control();
  const reject = control();
  const settings = control();
  const banner = control();
  banner.contains = (element) => [accept, reject].includes(element);
  document.getElementById = (id) => id === 'ads-consent-banner' && !missingBanner ? banner : null;
  document.querySelector = (selector) => ({
    '[data-ads-consent="accept"]': accept,
    '[data-ads-consent="reject"]': reject,
    '[data-ads-consent="settings"]': settings,
  })[selector] || null;
  document.querySelectorAll = (selector) => selector === 'a[href]' ? links : [];
  document.createElement = (name) => {
    assert.equal(name, 'script');
    return { removed: false, remove() { this.removed = true; } };
  };
  document.head = { appendChild(script) { scripts.push(script); } };
  Object.defineProperty(document, 'cookie', {
    get() { return cookies; },
    set(value) { cookieWrites.push(value); },
  });
  const location = new URL(url);
  location.reload = () => { reloads += 1; };
  location.replace = (destination) => { replacements.push(destination); };
  class FakeDate extends Date { static now() { return clock; } }
  const context = {
    document, location, Date: FakeDate, URL,
    history: { state: null, replaceState(state, title, destination) { location.href = destination; } },
    localStorage: {
      getItem(k) { if (blockedRead) throw Error('blocked'); return stored.get(k) ?? null; },
      setItem(k, v) { if (blockedWrite) throw Error('blocked'); stored.set(k, v); },
      removeItem(k) { if (blockedRemove) throw Error('blocked'); stored.delete(k); },
    },
    sessionStorage: {
      getItem(k) { if (blockedSession) throw Error('blocked'); return sessionStored.get(k) ?? null; },
      setItem(k, v) { if (blockedSession) throw Error('blocked'); sessionStored.set(k, v); },
      removeItem(k) { if (blockedSession) throw Error('blocked'); sessionStored.delete(k); },
    },
    addEventListener(type, fn) { listeners.set(type, fn); },
  };
  context.window = context;
  vm.createContext(context);
  const execute = () => vm.runInContext(source, context, { filename: 'ads-consent.js' });
  execute();
  const commands = () => JSON.parse(JSON.stringify((context.dataLayer || []).map((args) => Array.from(args))));
  return {
    context, scripts, stored, sessionStored, cookieWrites, replacements, document, links,
    accept, reject, settings, banner, commands, execute,
    reloads: () => reloads, advance(ms) { clock += ms; },
    dispatch(type, event = {}) { listeners.get(type)?.(event); },
  };
}

function assertNoTracking(result) {
  assert.equal(result.scripts.length, 0);
  assert.equal(result.commands().some(([command]) => ['js', 'config', 'event'].includes(command)), false);
}

test('default is all denied, with no remote script or measurement before a choice', () => {
  const r = run();
  assertNoTracking(r);
  assert.equal(r.banner.hidden, false);
  assert.equal(r.settings.hidden, false);
  assert.deepEqual(r.commands()[0], ['consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
  }]);
  assert.equal(r.stored.size, 0);
});

test('refusal persists, hides the banner and does not load Google or reload', () => {
  const r = run();
  r.reject.click();
  assertNoTracking(r);
  assert.deepEqual(JSON.parse(r.stored.get(key)), { choice: 'rejected', timestamp: now, version: 1 });
  assert.equal(r.banner.hidden, true);
  assert.equal(r.reloads(), 0);
  const reload = run({ saved: r.stored.get(key) });
  assertNoTracking(reload);
  assert.equal(reload.banner.hidden, true);
});

test('acceptance grants advertising only and configures sanitized location exactly once', () => {
  const r = run();
  r.accept.focus();
  r.accept.click();
  r.settings.click();
  r.accept.click();
  r.execute();
  assert.equal(r.scripts.length, 1);
  assert.equal(r.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=AW-799867999');
  assert.equal(r.scripts[0].async, true);
  assert.equal(r.scripts[0].referrerPolicy, 'no-referrer');
  const commands = r.commands();
  assert.deepEqual(commands.find(([command, action]) => command === 'consent' && action === 'update'), [
    'consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied',
    },
  ]);
  assert.deepEqual(commands.filter(([command]) => command === 'config'), [
    ['config', 'AW-799867999', { page_location: 'https://bioresonance.club/fr.html', page_referrer: '' }],
  ]);
  assert.equal(JSON.stringify(commands).includes('private'), false);
  assert.equal(commands.some(([command]) => command === 'event'), false);
  assert.equal(r.document.activeElement, r.settings);
  assert.equal(r.banner.hidden, true);
});

test('saved acceptance loads on a fresh page after a denied default', () => {
  const first = run();
  first.accept.click();
  const r = run({ saved: first.stored.get(key) });
  assert.equal(r.scripts.length, 1);
  assert.equal(r.banner.hidden, true);
  assert.equal(r.commands()[0][1], 'default');
  assert.equal(r.commands()[0][2].ad_storage, 'denied');
});

test('each production landing page may load after opt-in', () => {
  for (const hostname of ['bioresonance.club', 'www.bioresonance.club']) {
    for (const pathname of ['/', '/index.html', '/fr.html', '/de.html', '/es.html', '/it.html', '/pt.html']) {
      const r = run({ url: 'https://' + hostname + pathname, saved: savedChoice('accepted') });
      assert.equal(r.scripts.length, 1, hostname + pathname);
    }
  }
});

test('preview, unknown hosts, HTTP and legal paths never load Google even after opt-in', () => {
  for (const url of [
    'http://localhost:8876/fr.html', 'http://127.0.0.1:8876/', 'file:///tmp/fr.html',
    'https://preview.example/fr.html', 'https://bioresonance.club.evil.example/',
    'http://bioresonance.club/', 'https://bioresonance.club/website-privacy.html',
    'https://bioresonance.club/privacy.html', 'https://bioresonance.club/terms.html',
    'https://bioresonance.club/unknown.html',
  ]) {
    const r = run({ url, saved: savedChoice('accepted') });
    r.settings.click();
    r.accept.click();
    assertNoTracking(r);
  }
});

test('invalid, expired and future preferences do not grant consent', () => {
  for (const saved of [
    '', 'invalid', 'null', '{}', 'true', '[]',
    savedChoice('accepted', now - lifetime), savedChoice('rejected', now - lifetime - 1),
    savedChoice('accepted', now + 1), savedChoice('accepted', 0),
    JSON.stringify({ choice: 'accepted', timestamp: String(now), version: 1 }),
    JSON.stringify({ choice: 'accepted', timestamp: now, version: 2 }),
    savedChoice('unknown'),
  ]) {
    const r = run({ saved });
    assertNoTracking(r);
    assert.equal(r.banner.hidden, false, saved);
  }
  assert.equal(run({ saved: savedChoice('accepted', now - lifetime + 1) }).scripts.length, 1);
});

test('blocked storage stays fail-closed until explicit acceptance, which applies in memory', () => {
  const r = run({ blockedRead: true, blockedWrite: true, blockedRemove: true, blockedSession: true });
  assertNoTracking(r);
  r.reject.click();
  assertNoTracking(r);
  r.settings.click();
  r.accept.click();
  assert.equal(r.scripts.length, 1);
  assert.equal(r.stored.size, 0);
  const reload = run({ blockedRead: true, blockedWrite: true, blockedRemove: true, blockedSession: true });
  assertNoTracking(reload);
  assert.equal(reload.banner.hidden, false);
});

test('withdrawal denies, removes first-party advertising cookies and reloads to unload Google', () => {
  const r = run({
    url: 'https://www.bioresonance.club/fr.html', saved: savedChoice('accepted'),
    cookies: '_gcl_aw=secret; _gcl_au=secret2; necessary=keep; language=fr',
  });
  r.settings.click();
  assert.equal(r.banner.hidden, false);
  assert.equal(r.document.activeElement, r.reject);
  r.reject.click();
  assert.equal(JSON.parse(r.stored.get(key)).choice, 'rejected');
  assert.equal(r.reloads(), 1);
  assert.equal(r.scripts[0].removed, true);
  assert.equal(r.commands().at(-1)[2].ad_storage, 'denied');
  for (const name of ['_gcl_aw', '_gcl_au']) {
    assert.ok(r.cookieWrites.some((cookie) => cookie.startsWith(name + '=;') && !cookie.includes('Domain=')));
    for (const domain of ['www.bioresonance.club', '.www.bioresonance.club', 'bioresonance.club', '.bioresonance.club']) {
      assert.ok(r.cookieWrites.some((cookie) => cookie.startsWith(name + '=;') && cookie.includes('Domain=' + domain + ';')));
    }
  }
  assert.equal(r.cookieWrites.some((cookie) => /^(necessary|language)=/.test(cookie)), false);
  const count = r.commands().length;
  r.context.gtag('event', 'must-not-send');
  r.accept.click();
  assert.equal(r.commands().length, count);
  assert.equal(r.scripts.length, 1);
  assertNoTracking(run({ saved: r.stored.get(key) }));
});

test('withdrawal remains effective on reload even when overwriting local storage fails', () => {
  const r = run({ saved: savedChoice('accepted'), blockedWrite: true, blockedRemove: true });
  r.reject.click();
  const fallback = r.sessionStored.get(key + '.withdrawn');
  assert.equal(JSON.parse(fallback).choice, 'rejected');
  assertNoTracking(run({ saved: r.stored.get(key), sessionSaved: fallback }));
});

test('withdrawal uses a URL refusal if every persistence fallback fails but old consent remains readable', () => {
  const options = {
    saved: savedChoice('accepted'), blockedWrite: true, blockedRemove: true, blockedSession: true,
  };
  const r = run(options);
  r.reject.click();
  assert.equal(r.scripts[0].removed, true);
  assert.equal(r.reloads(), 0);
  assert.equal(r.replacements.length, 1);
  const destination = new URL(r.replacements[0]);
  assert.equal(destination.searchParams.get('ads_consent'), 'denied');
  assert.equal(destination.searchParams.get('condition'), 'private');
  assert.equal(destination.hash, '#gclid-private');
  const next = run({ ...options, url: destination.href });
  assertNoTracking(next);
  assert.equal(next.banner.hidden, true);
  next.settings.click();
  next.accept.click();
  assert.equal(next.scripts.length, 1);
  assert.equal(next.context.location.searchParams.has('ads_consent'), false);
});

test('blocked-storage withdrawal on a legal page stays denied across internal links', () => {
  const options = {
    saved: savedChoice('accepted'), blockedWrite: true, blockedRemove: true, blockedSession: true,
  };
  const r = run({
    ...options, url: 'https://bioresonance.club/website-privacy.html',
    linkUrls: ['/fr.html?lang=fr#download', 'https://external.example/', 'mailto:privacy@example.com'],
  });
  r.reject.click();
  assertNoTracking(r);
  assert.equal(r.context.location.searchParams.get('ads_consent'), 'denied');
  const target = new URL(r.links[0].href);
  assert.equal(target.searchParams.get('ads_consent'), 'denied');
  assert.equal(target.searchParams.get('lang'), 'fr');
  assert.equal(target.hash, '#download');
  assert.equal(r.links[1].href, 'https://external.example/');
  assert.equal(r.links[2].href, 'mailto:privacy@example.com');
  const next = run({ ...options, url: target.href, linkUrls: ['/en.html'] });
  assertNoTracking(next);
  assert.equal(new URL(next.links[0].href).searchParams.get('ads_consent'), 'denied');
  next.accept.click();
  assert.equal(new URL(next.links[0].href).searchParams.has('ads_consent'), false);
});

test('saved refusal and expired consent remove leftover first-party advertising cookies', () => {
  for (const saved of [savedChoice('rejected'), savedChoice('accepted', now - lifetime)]) {
    const r = run({ saved, cookies: '_gcl_au=leftover; essential=keep' });
    assertNoTracking(r);
    assert.ok(r.cookieWrites.length > 0);
    assert.equal(r.cookieWrites.some((cookie) => cookie.startsWith('essential=')), false);
  }
});

test('withdrawal on the legal page changes consent without loading Google or reloading', () => {
  const r = run({ url: 'https://bioresonance.club/website-privacy.html', saved: savedChoice('accepted') });
  r.settings.click();
  r.reject.click();
  assertNoTracking(r);
  assert.equal(r.reloads(), 0);
  assert.equal(JSON.parse(r.stored.get(key)).choice, 'rejected');
});

test('cross-tab withdrawal and expired pages restored from cache stop an active tag', () => {
  const r = run({ saved: savedChoice('accepted') });
  r.stored.set(key, savedChoice('rejected'));
  r.dispatch('storage', { key });
  assert.equal(r.reloads(), 1);
  const restored = run({ saved: savedChoice('accepted') });
  restored.advance(lifetime);
  restored.dispatch('pageshow');
  assert.equal(restored.reloads(), 1);
});

test('missing consent UI cannot initialize or load the tag', () => {
  const r = run({ missingBanner: true, saved: savedChoice('accepted') });
  assertNoTracking(r);
  assert.equal(r.context.gtag, undefined);
});
