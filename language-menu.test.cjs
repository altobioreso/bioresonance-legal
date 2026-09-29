const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const script = readFileSync(join(__dirname, 'language-menu.js'), 'utf8');
const preferenceKey = 'bioresonance-language';
const destinations = {
  en: '/', fr: '/fr.html', de: '/de.html', es: '/es.html', it: '/it.html', pt: '/pt.html',
};

// Small event and DOM doubles: native navigation and <details> toggling stay the
// browser's responsibility; these tests exercise the script's observable effects.
class Element {
  constructor(parent = null) {
    this.parent = parent;
    this.listeners = new Map();
  }

  addEventListener(type, callback, options = {}) {
    const listeners = this.listeners.get(type) || [];
    listeners.push({ callback, once: Boolean(options.once) });
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(event.type) || [])]) {
      if (listener.once) {
        this.listeners.set(event.type, this.listeners.get(event.type).filter((item) => item !== listener));
      }
      listener.callback(event);
    }
    if (event.bubbles !== false && this.parent) this.parent.dispatchEvent(event);
  }

  contains(target) {
    for (let current = target; current; current = current.parent) {
      if (current === this) return true;
    }
    return false;
  }
}

function run({
  pathname = '/', search = '', hash = '',
  languages = ['en-US'], language = 'en-US', saved = null, omitLanguages = false,
  rejectRead = false, rejectWrite = false,
  readyState = 'complete', hasMenu = true,
} = {}) {
  const redirects = [];
  const writes = [];
  const storage = new Map(saved === null ? [] : [[preferenceKey, saved]]);
  const document = new Element();
  document.readyState = readyState;
  document.activeElement = null;
  const menu = new Element(document);
  menu.open = false;
  const trigger = new Element(menu);
  trigger.focusCount = 0;
  trigger.focus = () => {
    trigger.focusCount += 1;
    document.activeElement = trigger;
    trigger.dispatchEvent({ type: 'focusin' });
  };
  const links = Object.fromEntries(Object.keys(destinations).map((code) => {
    const link = new Element(menu);
    link.getAttribute = (name) => name === 'hreflang' ? code : null;
    link.icon = new Element(link);
    return [code, link];
  }));
  const outside = new Element(document);
  document.querySelector = (selector) => selector === '.language-switcher' && hasMenu ? menu : null;
  menu.querySelector = (selector) => selector === 'summary' ? trigger : null;
  menu.querySelectorAll = (selector) => selector === '.language-menu a[hreflang]' ? Object.values(links) : [];
  const context = {
    URLSearchParams,
    location: { pathname, search, hash, replace: (url) => redirects.push(url) },
    navigator: { ...(omitLanguages ? {} : { languages }), language },
    localStorage: {
      getItem(key) {
        if (rejectRead) throw new Error('Storage access denied');
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        if (rejectWrite) throw new Error('Storage access denied');
        storage.set(key, value);
        writes.push([key, value]);
      },
    },
    document,
  };
  vm.runInNewContext(script, context, { filename: 'language-menu.js' });
  return { redirects, writes, storage, document, menu, trigger, links, outside };
}

for (const pathname of ['/', '/index.html']) {
  for (const [code, variants] of Object.entries({
    en: ['en', 'en-US', 'en_GB'],
    fr: ['fr', 'fr-CA', 'FR_fr'],
    de: ['de', 'de-AT', 'DE_de'],
    es: ['es', 'es-MX', 'ES_es'],
    it: ['it', 'it-CH', 'IT_it'],
    pt: ['pt', 'pt-BR', 'PT_pt'],
  })) {
    for (const variant of variants) {
      test(`${pathname}: browser preference ${variant} selects ${code}`, () => {
        const result = run({ pathname, languages: [variant] });
        assert.deepEqual(result.redirects, code === 'en' ? [] : [destinations[code]]);
        assert.deepEqual(result.writes, [], 'automatic detection must not become a saved manual choice');
      });
    }
  }
}

test('uses the first compatible browser preference in order', () => {
  assert.deepEqual(run({ languages: ['ja-JP', 'pt-BR', 'fr-FR', 'en'] }).redirects, ['/pt.html']);
  assert.deepEqual(run({ languages: ['en-GB', 'fr-FR'] }).redirects, []);
});

test('uses navigator.language when the languages list is absent or empty', () => {
  assert.deepEqual(run({ omitLanguages: true, language: 'fr-CA' }).redirects, ['/fr.html']);
  assert.deepEqual(run({ languages: [], language: 'de-CH' }).redirects, ['/de.html']);
});

test('falls back to English when no browser language is supported', () => {
  for (const languages of [['ja-JP', 'zh-Hant'], [], [null, '', 'xx']]) {
    const result = run({ languages, language: 'ja' });
    assert.deepEqual(result.redirects, []);
    assert.deepEqual(result.writes, []);
  }
});

test('a saved manual preference overrides browser preferences for every language', () => {
  for (const code of Object.keys(destinations)) {
    const result = run({ saved: code, languages: ['fr-CA', 'de'] });
    assert.deepEqual(result.redirects, code === 'en' ? [] : [destinations[code]]);
    assert.deepEqual(result.writes, [], 'reading a preference must not rewrite it');
  }
});

test('ignores invalid saved values, including object property names', () => {
  for (const saved of ['', 'xx', 'fr-CA', '__proto__', 'constructor', 'https://example.com']) {
    const result = run({ saved, languages: ['it-IT'] });
    assert.deepEqual(result.redirects, ['/it.html']);
    assert.deepEqual(result.writes, []);
  }
});

test('a valid query selection overrides and updates a saved preference', () => {
  for (const code of Object.keys(destinations)) {
    const result = run({ search: `?lang=${code}`, saved: 'pt', languages: ['fr'] });
    assert.deepEqual(result.redirects, code === 'en' ? [] : [destinations[code]]);
    assert.deepEqual(result.writes, [[preferenceKey, code]]);
  }
});

test('invalid query selections are ignored safely', () => {
  for (const value of ['xx', '', '__proto__', 'constructor', '//example.com']) {
    const result = run({ search: `?lang=${encodeURIComponent(value)}`, saved: 'de', languages: ['fr'] });
    assert.deepEqual(result.redirects, ['/de.html']);
    assert.deepEqual(result.writes, []);
  }
});

test('browser selection works when reading or writing storage is denied', () => {
  const result = run({ languages: ['es-MX'], rejectRead: true, rejectWrite: true });
  assert.deepEqual(result.redirects, ['/es.html']);
});

test('explicit English remains reachable with storage denied', () => {
  for (const pathname of ['/', '/index.html']) {
    const result = run({ pathname, search: '?lang=en', languages: ['fr'], rejectRead: true, rejectWrite: true });
    assert.deepEqual(result.redirects, []);
    assert.deepEqual(result.writes, []);
  }
});

test('a non-English query selection still redirects when storage cannot save it', () => {
  const result = run({ search: '?lang=it', saved: 'de', languages: ['fr'], rejectWrite: true });
  assert.deepEqual(result.redirects, ['/it.html']);
});

test('direct language, legal and other paths never redirect or change the preference', () => {
  for (const pathname of ['/fr.html', '/de.html', '/es.html', '/it.html', '/pt.html', '/privacy.html', '/terms.html', '/other/']) {
    const result = run({ pathname, search: '?lang=es', saved: 'it', languages: ['pt'] });
    assert.deepEqual(result.redirects, [], pathname);
    assert.deepEqual(result.writes, [], pathname);
    assert.equal(result.storage.get(preferenceKey), 'it');
  }
});

test('redirects preserve campaign parameters, duplicate values and the fragment', () => {
  const result = run({
    pathname: '/index.html',
    search: '?utm_source=newsletter&utm_campaign=calm%20now&tag=one&tag=two&lang=de',
    hash: '#download', languages: ['fr'],
  });
  assert.equal(result.redirects.length, 1);
  const target = new URL(result.redirects[0], 'https://bioresonance.club');
  assert.equal(target.pathname, '/de.html');
  assert.equal(target.searchParams.get('utm_source'), 'newsletter');
  assert.equal(target.searchParams.get('utm_campaign'), 'calm now');
  assert.deepEqual(target.searchParams.getAll('tag'), ['one', 'two']);
  assert.equal(target.searchParams.has('lang'), false);
  assert.equal(target.hash, '#download');
});

test('arriving at an automatically selected URL cannot start a redirect loop', () => {
  const entry = run({ languages: ['fr-CA'] });
  assert.deepEqual(entry.redirects, ['/fr.html']);
  const destination = run({ pathname: entry.redirects[0], languages: ['de'], saved: 'pt' });
  assert.deepEqual(destination.redirects, []);
});

for (const code of Object.keys(destinations)) {
  test(`a normal click on a nested label saves the manual ${code} choice`, () => {
    const result = run({ pathname: '/fr.html' });
    result.links[code].icon.dispatchEvent({ type: 'click', button: 0, detail: 1 });
    assert.deepEqual(result.writes, [[preferenceKey, code]]);
    assert.deepEqual(result.redirects, [], 'the real anchor retains native navigation');
  });
}

test('a keyboard-generated anchor click saves the choice', () => {
  const result = run();
  result.links.fr.dispatchEvent({ type: 'click', button: 0, detail: 0 });
  assert.deepEqual(result.writes, [[preferenceKey, 'fr']]);
});

test('middle-click and modified click also save the chosen language', () => {
  const middle = run();
  middle.links.en.icon.dispatchEvent({ type: 'auxclick', button: 1 });
  assert.deepEqual(middle.writes, [[preferenceKey, 'en']]);
  const modified = run();
  modified.links.de.dispatchEvent({ type: 'click', button: 0, metaKey: true });
  assert.deepEqual(modified.writes, [[preferenceKey, 'de']]);
});

test('right-click does not save a language preference', () => {
  const result = run();
  result.links.it.dispatchEvent({ type: 'auxclick', button: 2 });
  assert.deepEqual(result.writes, []);
});

test('manual selection remains usable when storage is denied', () => {
  const result = run({ pathname: '/fr.html', rejectRead: true, rejectWrite: true });
  assert.doesNotThrow(() => result.links.en.dispatchEvent({ type: 'click', button: 0 }));
  assert.deepEqual(result.redirects, []);
});

test('clicking outside closes the menu without moving focus', () => {
  const result = run();
  result.menu.open = true;
  result.document.activeElement = result.outside;
  result.outside.dispatchEvent({ type: 'click', button: 0 });
  assert.equal(result.menu.open, false);
  assert.equal(result.document.activeElement, result.outside);
  assert.equal(result.trigger.focusCount, 0);
});

test('clicking inside the menu does not close it prematurely', () => {
  const result = run();
  result.menu.open = true;
  result.links.fr.icon.dispatchEvent({ type: 'click', button: 0 });
  assert.equal(result.menu.open, true);
});

test('Escape closes the open menu and restores focus to its trigger', () => {
  const result = run();
  result.menu.open = true;
  result.links.fr.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(result.menu.open, false);
  assert.equal(result.document.activeElement, result.trigger);
  assert.equal(result.trigger.focusCount, 1);
});

test('Escape on a closed menu and other keys do not move focus or close it', () => {
  const result = run();
  result.document.activeElement = result.outside;
  result.outside.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(result.document.activeElement, result.outside);
  assert.equal(result.trigger.focusCount, 0);
  result.menu.open = true;
  result.links.fr.dispatchEvent({ type: 'keydown', key: 'Tab' });
  assert.equal(result.menu.open, true);
});

test('moving focus outside closes the menu; focusing inside does not', () => {
  const result = run();
  result.menu.open = true;
  result.links.fr.dispatchEvent({ type: 'focusin' });
  assert.equal(result.menu.open, true);
  result.outside.dispatchEvent({ type: 'focusin' });
  assert.equal(result.menu.open, false);
  assert.equal(result.trigger.focusCount, 0);
});

test('menu setup waits for the DOM when parsing has not finished', () => {
  const result = run({ readyState: 'loading' });
  result.document.readyState = 'interactive';
  result.document.dispatchEvent({ type: 'DOMContentLoaded', bubbles: false });
  result.links.it.dispatchEvent({ type: 'click', button: 0 });
  assert.deepEqual(result.writes, [[preferenceKey, 'it']]);
  result.menu.open = true;
  result.outside.dispatchEvent({ type: 'click', button: 0 });
  assert.equal(result.menu.open, false);
});

test('pages without a language menu remain safe', () => {
  assert.doesNotThrow(() => run({ pathname: '/privacy.html', hasMenu: false }));
  assert.doesNotThrow(() => run({ hasMenu: false }));
});
