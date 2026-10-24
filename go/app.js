(() => {
  'use strict';
  const router = window.BioGo;
  const translations = window.BIO_GO_LOCALES;
  if (!router || !translations) return; // The HTML store links are still usable.
  let spy = {};
  try { if (typeof window.InAppSpy === 'function') spy = window.InAppSpy(); } catch { /* Use local UA rules. */ }
  const state = router.inspect({
    ua: navigator.userAgent, touchPoints: navigator.maxTouchPoints,
    languages: navigator.languages?.length ? navigator.languages : [navigator.language],
    search: location.search, spy
  });
  let selectedLanguage = state.language;
  let redirectTimer;
  let redirectAttempted = false;
  let firstRender = true;
  const $ = (id) => document.getElementById(id);
  const show = (id, visible) => { $(id).hidden = !visible; };
  function render() {
    const copy = translations[selectedLanguage];
    document.documentElement.lang = selectedLanguage;
    document.title = copy.pageTitle;
    document.querySelectorAll('[data-copy]').forEach((node) => {
      const key = node.dataset.copy;
      if (typeof copy[key] === 'string') node.textContent = copy[key];
    });
    $('language').value = selectedLanguage;
    $('language').setAttribute('aria-label', copy.languageLabel);
    const help = state.embedded || state.manual;
    $('page').classList.toggle('needs-help', help);
    show('intro', !help);
    show('guide', help);
    show('menu-pointer', help);
    show('options-toggle', help);
    // Keep fallback choices open after a visitor expands them, including while copying.
    if (firstRender || !help) $('options').open = !help;
    firstRender = false;
    show('browser-action', help && state.platform === 'android');
    show('preview-note', state.preview);
    $('title').textContent = help ? copy.inAppTitle : state.shouldRedirect ? copy.redirectTitle : copy.chooseTitle;
    $('intro').textContent = help
      ? (state.appName ? copy.namedAppBody.replace('{app}', state.appName) : copy.inAppBody)
      : state.shouldRedirect ? copy.redirectBody : copy.chooseBody;
    $('step-two').textContent = state.platform === 'android' ? copy.androidStepTwo : copy.stepTwo;
    $('store-ios').href = router.STORES.ios;
    $('store-android').href = router.STORES.android;
    $('store-ios').classList.toggle('recommended', state.platform === 'ios');
    $('store-android').classList.toggle('recommended', state.platform === 'android');
    $('stores').classList.toggle('android-first', state.platform === 'android');
    $('share-url').value = router.shareURL(location.search, selectedLanguage);
    $('share-url').setAttribute('aria-label', copy.copyButton);
    $('open-browser').href = router.chromeIntent(location.search, selectedLanguage);
    $('website').href = selectedLanguage === 'en' ? '/?lang=en' : '/' + selectedLanguage + '.html';
    $('copy-status').textContent = '';
  }
  $('language').addEventListener('change', (event) => {
    if (!router.LANGUAGES.includes(event.target.value)) return;
    clearTimeout(redirectTimer);
    state.shouldRedirect = false;
    selectedLanguage = event.target.value;
    // Explicit selection survives “Open in browser” without cookies or local storage.
    const url = new URL(location.href);
    url.searchParams.set('lang', selectedLanguage);
    try { history.replaceState(null, '', url); } catch { /* Copied link still carries the language. */ }
    render();
  });
  $('copy-link').addEventListener('click', async () => {
    clearTimeout(redirectTimer);
    state.shouldRedirect = false;
    render();
    const copy = translations[selectedLanguage];
    const value = router.shareURL(location.search, selectedLanguage);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch { /* Embedded browsers may deny clipboard access. */ }
    show('copy-fallback', true);
    if (!copied) {
      const field = $('share-url');
      field.focus(); field.select(); field.setSelectionRange(0, field.value.length);
      try { copied = document.execCommand('copy'); } catch { /* Manual selection remains. */ }
    }
    $('copy-status').textContent = copied ? copy.copied + '. ' + copy.copyHelp : copy.manualCopy;
  });
  $('share-url').addEventListener('click', () => $('share-url').select());
  $('open-browser').addEventListener('click', () => {
    // A real anchor click provides the required user gesture; never launch intents from a timer.
    $('browser-status').textContent = translations[selectedLanguage].browserHelp;
  });
  $('stores').addEventListener('click', () => {
    clearTimeout(redirectTimer);
    state.shouldRedirect = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(redirectTimer);
    else redirect();
  });
  render();
  // Replace removes /go from history and avoids a back-button redirect loop.
  // Never redirect while prerendering or after restoring this document from the back/forward cache.
  function redirect() {
    if (!state.shouldRedirect || redirectAttempted || document.hidden || document.prerendering) return;
    clearTimeout(redirectTimer);
    redirectTimer = setTimeout(() => {
      if (!document.hidden && state.shouldRedirect) {
        redirectAttempted = true;
        state.shouldRedirect = false;
        render(); // If navigation is blocked, the page still offers a clear manual choice.
        try { location.replace(state.target); } catch { /* Store buttons stay available. */ }
      }
    }, 120);
  }
  if (document.prerendering) document.addEventListener('prerenderingchange', redirect, { once: true });
  else redirect();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearTimeout(redirectTimer);
      state.shouldRedirect = false;
      render();
    }
  });
})();
