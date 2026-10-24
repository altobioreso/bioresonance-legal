'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const router = require('./routing.js');
const source = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

// UA samples include upstream InAppSpy fixtures and deliberately constructed
// variants. These tests verify routing, not a live social app's escape policy.
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/22G100 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const WEBVIEW = ANDROID.replace('Pixel 8a)', 'Pixel 8a; wv)').replace('Chrome/', 'Version/4.0 Chrome/');
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const social = {
  tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 musical_ly_41.9.0',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 393.1.0.36.70 (iPhone15,3; iOS 18_5; en_US; en; scale=3.00; 1290x2796; IABMV/1; 776538208) Safari/604.1)',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G100 Safari/604.1 MetaIAB Facebook',
  snapchat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Snapchat/12.72.0.39 (like Safari/8617.2.4.10.8, panda)',
  youtube: IOS + ' YouTube/19.0'
};
function detected(ua) {
  const context = vm.createContext({ window: { navigator: { userAgent: ua } } });
  vm.runInContext(source('vendor/inapp-spy-5.0.10.js'), context);
  return context.window.InAppSpy();
}
function inspect(ua = IOS, options = {}) {
  return router.inspect({ ua, languages: ['en-US'], spy: detected(ua), ...options });
}

for (const [name, ua, touchPoints, platform, redirect] of [
  ['iPhone Safari', IOS, 5, 'ios', true],
  ['iPhone Chrome', IOS.replace('Version/18.6', 'CriOS/130.0'), 5, 'ios', true],
  ['iPad desktop UA', MAC, 5, 'ios', true],
  ['Mac Safari', MAC, 0, 'desktop', false],
  ['Pixel Chrome', ANDROID, 5, 'android', true],
  ['Samsung Internet', ANDROID + ' SamsungBrowser/27.0', 5, 'android', true],
  ['Android Firefox', ANDROID.replace('Chrome/130.0.0.0 Mobile Safari/537.36', 'Firefox/132.0'), 5, 'android', true],
  ['Windows Phone spoofing Android', 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1) Chrome/52.0', 5, 'desktop', false],
  ['Unknown client', 'UnknownClient/1.0', 0, 'desktop', false],
  ['No UA', '', 0, 'desktop', false]
]) test(name + ' selects a safe store policy', () => {
  const result = inspect(ua, { touchPoints, spy: ua ? detected(ua) : {} });
  assert.equal(result.platform, platform);
  assert.equal(result.shouldRedirect, redirect);
  assert.equal(result.target, router.STORES[platform] || null);
});

for (const [network, ua] of Object.entries(social)) {
  test(network + ' displays help even when Safari occurs in its UA', () => {
    const result = inspect(ua);
    assert.equal(result.network, network);
    assert.equal(result.embedded, true);
    assert.equal(result.shouldRedirect, false);
  });
  test(network + ' remains safe if the optional detector fails to load', () => {
    const result = inspect(ua, { spy: {} });
    assert.equal(result.embedded, true);
    assert.equal(result.shouldRedirect, false);
  });
}
test('Messenger is named correctly instead of Facebook', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Mobile/14D27 {useragents: [FBAN/MessengerForiOS;FBAV/117.0.0.36.70;FBDV/iPhone7,2;FBSN/iOS;FBLC/en_US;FBOP/5]';
  assert.equal(inspect(ua).network, 'messenger');
});
test('Unknown Android and iOS WebViews get generic help', () => {
  for (const ua of [WEBVIEW, IOS.replace(' Safari/604.1', '')]) {
    const result = inspect(ua);
    assert.equal(result.embedded, true);
    assert.equal(result.shouldRedirect, false);
  }
});
test('Unidentifiable YouTube Safari-view-controller has the documented limitation', () => {
  // An identical Safari UA cannot be distinguished without experimental APIs.
  const result = inspect(IOS, { search: '?src=youtube&utm_source=youtube' });
  assert.equal(result.embedded, false);
  assert.equal(result.shouldRedirect, true);
});
test('Campaign/source names do not misclassify an external browser', () => {
  for (const network of Object.keys(social)) {
    const result = inspect(ANDROID, { search: '?src=' + network });
    assert.equal(result.embedded, false);
    assert.equal(result.network, null);
    assert.equal(result.shouldRedirect, true);
  }
});

for (const locale of ['en-US', 'fr-CA', 'de-DE', 'es-MX', 'it-IT', 'pt-BR']) {
  test(locale + ' uses the supported base language', () => {
    assert.equal(inspect(IOS, { languages: [locale] }).language, locale.slice(0, 2));
  });
}
test('Explicit language wins; unsupported language falls back safely', () => {
  assert.equal(inspect(IOS, { search: '?lang=PT_br', languages: ['fr'] }).language, 'pt');
  assert.equal(inspect(IOS, { search: '?lang=invalid', languages: ['ja', 'de-DE'] }).language, 'de');
  assert.equal(inspect(IOS, { search: '?lang=__proto__', languages: ['ja'] }).language, 'en');
});
for (const bot of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'Twitterbot/1.0', 'Discordbot/2.0', 'WhatsApp/2.24.0']) {
  test(bot + ' does not follow an automatic store redirect', () => {
    const result = inspect(IOS + ' ' + bot);
    assert.equal(result.bot, true);
    assert.equal(result.embedded, false);
    assert.equal(result.shouldRedirect, false);
  });
}
test('All preview modes and manual mode suppress redirects', () => {
  for (const search of ['?preview', '?preview=tiktok&platform=android', '?preview=browser&platform=ios', '?preview=desktop', '?preview=garbage', '?manual=1']) {
    assert.equal(inspect(IOS, { search }).shouldRedirect, false, search);
  }
  assert.equal(inspect(IOS, { search: '?preview=tiktok&platform=android' }).platform, 'android');
  assert.equal(inspect(IOS, { search: '?preview=desktop' }).platform, 'desktop');
  assert.equal(inspect(IOS, { search: '?platform=android' }).platform, 'ios');
});
test('Share links keep only bounded attribution and language on the fixed domain', () => {
  const url = new URL(router.shareURL('?src=tiktok&utm_campaign=launch%20FR&redirect=https%3A%2F%2Fevil.example&preview=tiktok&manual=1&platform=android&lang=de', 'fr'));
  assert.equal(url.origin, 'https://bioresonance.club');
  assert.equal(url.pathname, '/go/');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['lang', 'src', 'utm_campaign']);
  assert.equal(url.searchParams.get('lang'), 'fr');
  assert.equal(url.searchParams.get('utm_campaign'), 'launch FR');
  const malicious = new URL(router.shareURL('?src=x%3Bpackage%3Devil&utm_source=%3Cscript%3E&utm_term=' + 'x'.repeat(129), 'javascript:alert(1)'));
  assert.equal(malicious.search, '');
});
test('Arbitrary destinations never alter the store selected by device', () => {
  const malicious = '?url=https://evil.example&redirect=javascript:alert(1)&target=//evil.example&store=evil';
  assert.equal(inspect(IOS, { search: malicious }).target, router.STORES.ios);
  assert.equal(inspect(ANDROID, { search: malicious }).target, router.STORES.android);
});
test('Chrome intent preserves safe attribution and falls back without redirect loops', () => {
  const intent = router.chromeIntent('?src=instagram&preview=tiktok&manual=1&redirect=https://evil.example', 'fr');
  assert.match(intent, /^intent:\/\/bioresonance\.club\/go\/\?lang=fr&src=instagram#Intent;/);
  assert.match(intent, /package=com\.android\.chrome;/);
  assert.doesNotMatch(intent, /evil|preview/);
  const fallback = new URL(decodeURIComponent(intent.match(/S\.browser_fallback_url=([^;]+);/)[1]));
  assert.equal(fallback.origin, 'https://bioresonance.club');
  assert.equal(fallback.searchParams.get('manual'), '1');
  assert.equal(inspect(ANDROID, { search: fallback.search }).shouldRedirect, false);
});

// Small browser model: exercise app.js event behavior without replacing the
// routing decisions or starting network navigations.
function boot({ ua = IOS, search = '', clipboardReject = false, prerendering = false, hidden = false, spyFails = false } = {}) {
  const nodes = new Map();
  const timers = new Map();
  const navigation = [];
  const documentEvents = new Map();
  const windowEvents = new Map();
  let sequence = 0;
  function element(id) {
    if (!nodes.has(id)) nodes.set(id, {
      id, hidden: false, textContent: '', value: '', dataset: {}, listeners: new Map(),
      classList: { toggle() {} }, setAttribute(name, value) { this[name] = value; },
      addEventListener(name, fn) { this.listeners.set(name, fn); },
      focus() { this.focused = true; }, select() { this.selected = true; }, setSelectionRange() { this.selected = true; }
    });
    return nodes.get(id);
  }
  const location = { search, href: 'https://bioresonance.club/go/' + search, replace: (url) => navigation.push(url) };
  const document = {
    hidden, prerendering, documentElement: {}, title: '',
    getElementById: element, querySelectorAll: () => [], execCommand: () => false,
    addEventListener: (name, fn) => documentEvents.set(name, fn)
  };
  const window = { BioGo: router, InAppSpy: () => { if (spyFails) throw new Error('detector unavailable'); return detected(ua); }, addEventListener: (name, fn) => windowEvents.set(name, fn) };
  const context = vm.createContext({
    window, document, location, URL, URLSearchParams,
    navigator: { userAgent: ua, maxTouchPoints: 5, languages: ['en-US'], clipboard: { writeText: async () => { if (clipboardReject) throw new Error('denied'); } } },
    history: { replaceState: (_state, _title, url) => { location.href = String(url); location.search = new URL(url).search; } },
    setTimeout: (fn) => { const id = ++sequence; timers.set(id, fn); return id; }, clearTimeout: (id) => timers.delete(id)
  });
  vm.runInContext(source('locales.js'), context);
  vm.runInContext(source('app.js'), context);
  return {
    nodes, timers, navigation, document, documentEvents, windowEvents, translations: window.BIO_GO_LOCALES,
    event: async (id, name, value) => element(id).listeners.get(name)?.({ target: { value } }),
    flush: () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } }
  };
}
test('Embedded UI gives the named app help and never automatically launches an intent', () => {
  const page = boot({ ua: social.tiktok });
  assert.equal(page.nodes.get('guide').hidden, false);
  assert.match(page.nodes.get('intro').textContent, /TikTok/);
  assert.equal(page.timers.size, 0);
  assert.equal(page.nodes.get('browser-action').hidden, true);
  page.flush();
  assert.deepEqual(page.navigation, []);
});
test('Android embedded UI exposes a user-activated Chrome intent with a manual fallback', () => {
  const page = boot({ ua: WEBVIEW + ' Instagram 393.0' });
  assert.equal(page.nodes.get('browser-action').hidden, false);
  assert.match(page.nodes.get('open-browser').href, /^intent:/);
  assert.equal(page.timers.size, 0);
});
test('Clipboard denial leaves a selected, readable canonical URL for manual copying', async () => {
  const page = boot({ ua: social.tiktok, search: '?lang=fr&src=tiktok', clipboardReject: true });
  await page.event('copy-link', 'click');
  assert.equal(page.nodes.get('copy-fallback').hidden, false);
  assert.equal(page.nodes.get('share-url').selected, true);
  assert.equal(page.nodes.get('share-url').value, 'https://bioresonance.club/go/?lang=fr&src=tiktok');
  assert.equal(page.nodes.get('copy-status').textContent, page.translations.fr.manualCopy);
});
test('Language selection cancels navigation and displays a stable manual store choice', async () => {
  const page = boot();
  assert.equal(page.timers.size, 1);
  await page.event('language', 'change', 'de');
  assert.equal(page.timers.size, 0);
  assert.equal(page.document.documentElement.lang, 'de');
  assert.equal(page.nodes.get('title').textContent, page.translations.de.chooseTitle);
  assert.equal(page.nodes.get('intro').textContent, page.translations.de.chooseBody);
  page.flush();
  assert.deepEqual(page.navigation, []);
});
test('Redirect uses replace exactly once and never runs while hidden', () => {
  const page = boot(); page.flush(); page.flush();
  assert.deepEqual(page.navigation, [router.STORES.ios]);
  const hidden = boot({ hidden: true }); hidden.flush();
  assert.deepEqual(hidden.navigation, []);
});
test('Backgrounding and back/forward cache restore cancel pending redirects', () => {
  const hidden = boot(); hidden.document.hidden = true; hidden.documentEvents.get('visibilitychange')(); hidden.flush();
  assert.deepEqual(hidden.navigation, []);
  const restored = boot(); restored.windowEvents.get('pageshow')({ persisted: true }); restored.flush();
  assert.deepEqual(restored.navigation, []);
});
test('Prerender does not redirect until activated', () => {
  const page = boot({ prerendering: true }); page.flush();
  assert.deepEqual(page.navigation, []);
  page.document.prerendering = false; page.documentEvents.get('prerenderingchange')(); page.flush();
  assert.deepEqual(page.navigation, [router.STORES.ios]);
});
