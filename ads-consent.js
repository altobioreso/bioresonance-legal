(() => {
  'use strict';

  // Basic Consent Mode: this local file never contacts Google until opt-in.
  // Consent API: https://developers.google.com/tag-platform/security/guides/consent
  const banner = document.getElementById('ads-consent-banner');
  const accept = document.querySelector('[data-ads-consent="accept"]');
  const reject = document.querySelector('[data-ads-consent="reject"]');
  const settings = document.querySelector('[data-ads-consent="settings"]');
  if (!banner || !accept || !reject || !settings || window.__bioresonanceAdsConsent) return;
  window.__bioresonanceAdsConsent = true;

  const storageKey = 'bioresonance.ads-consent.v1';
  const withdrawalKey = storageKey + '.withdrawn';
  const withdrawalParameter = 'ads_consent';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const tagId = 'AW-799867999';
  const productionHosts = ['bioresonance.club', 'www.bioresonance.club'];
  const trackedPaths = ['/', '/index.html', '/fr.html', '/de.html', '/es.html', '/it.html', '/pt.html'];
  const canLoadTag = location.protocol === 'https:'
    && productionHosts.includes(location.hostname)
    && trackedPaths.includes(location.pathname);
  const denied = {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied',
  };
  let tag = null;
  let stopped = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    if (!stopped) window.dataLayer.push(arguments);
  };
  window.gtag('consent', 'default', { ...denied });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);

  function parseChoice(raw) {
    try {
      const value = JSON.parse(raw);
      if (value && value.version === 1
        && ['accepted', 'rejected'].includes(value.choice)
        && Number.isFinite(value.timestamp) && value.timestamp > 0
        && value.timestamp <= Date.now() && Date.now() - value.timestamp < lifetime) {
        return value.choice;
      }
    } catch { /* Missing or invalid consent is not consent. */ }
    return null;
  }

  function readChoice() {
    // Last-resort withdrawal survives reload even if both storage APIs reject
    // all writes/deletes but an old acceptance remains readable.
    if (new URL(location.href).searchParams.get(withdrawalParameter) === 'denied') return 'rejected';
    // A same-tab fallback prevents a failed withdrawal write from restoring an
    // older acceptance on reload (e.g. storage quota or restricted storage).
    try {
      if (parseChoice(sessionStorage.getItem(withdrawalKey)) === 'rejected') return 'rejected';
    } catch { /* The local preference can still be read independently. */ }
    try { return parseChoice(localStorage.getItem(storageKey)); }
    catch { return null; }
  }

  function saveChoice(choice) {
    const value = JSON.stringify({ choice, timestamp: Date.now(), version: 1 });
    try {
      localStorage.setItem(storageKey, value);
      try { sessionStorage.removeItem(withdrawalKey); } catch { /* Fail closed on next load. */ }
      return true;
    } catch {
      // Remove any stale acceptance if overwriting it is blocked.
      let removed = false;
      try { localStorage.removeItem(storageKey); removed = true; } catch { /* Storage may be entirely blocked. */ }
      if (choice === 'rejected') {
        try { sessionStorage.setItem(withdrawalKey, value); return true; } catch { /* Use URL fallback if needed. */ }
      } else {
        try { sessionStorage.removeItem(withdrawalKey); } catch { /* Fail closed on next load. */ }
      }
      return removed;
    }
  }

  function showBanner(focus) {
    banner.hidden = false;
    if (focus) reject.focus();
  }

  function hideBanner() {
    const restoreFocus = banner.contains(document.activeElement);
    banner.hidden = true;
    if (restoreFocus) settings.focus();
  }

  function updateWithdrawalLinks(withdrawn) {
    for (const link of document.querySelectorAll('a[href]')) {
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || !['http:', 'https:'].includes(destination.protocol)) continue;
      if (withdrawn) destination.searchParams.set(withdrawalParameter, 'denied');
      else destination.searchParams.delete(withdrawalParameter);
      link.href = destination.href;
    }
  }

  function loadTag() {
    if (!canLoadTag || tag || stopped) return;
    window.gtag('consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'granted', analytics_storage: 'denied',
    });
    // Do not include query strings, fragments or the referring page. There are
    // no conversion, click, wellbeing-content or user-data events in this file.
    const page = { page_location: location.origin + location.pathname, page_referrer: '' };
    window.gtag('set', page);
    window.gtag('js', new Date());
    window.gtag('config', tagId, page);
    tag = document.createElement('script');
    tag.async = true;
    tag.referrerPolicy = 'no-referrer';
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId;
    document.head.appendChild(tag);
  }

  function clearAdvertisingCookies() {
    let names;
    try {
      names = document.cookie.split(';').map((cookie) => cookie.trim().split('=')[0])
        .filter((name) => /^_gcl_/.test(name));
    } catch { return; }
    const domains = ['']; // Host-only cookies have no Domain attribute.
    const labels = location.hostname.split('.');
    for (let i = 0; i < labels.length - 1; i += 1) {
      const domain = labels.slice(i).join('.');
      domains.push(domain, '.' + domain);
    }
    const paths = new Set(['/']);
    const parts = location.pathname.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      const path = parts.slice(0, i).join('/') || '/';
      paths.add(path);
      paths.add(path.endsWith('/') ? path : path + '/');
    }
    for (const name of names) {
      for (const domain of domains) {
        for (const path of paths) {
          try {
            document.cookie = name + '=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
              + '; Path=' + path + (domain ? '; Domain=' + domain : '') + '; SameSite=Lax';
          } catch { /* Some browser policies can prohibit cookie access. */ }
        }
      }
    }
  }

  function stopTag(persistenceSafe = true) {
    if (stopped) return;
    window.gtag('consent', 'update', { ...denied });
    clearAdvertisingCookies();
    const destination = new URL(location.href);
    if (!persistenceSafe) destination.searchParams.set(withdrawalParameter, 'denied');
    if (!tag) {
      if (!persistenceSafe) {
        updateWithdrawalLinks(true);
        try { window.history.replaceState(window.history.state, '', destination.href); }
        catch { location.replace(destination.href); }
      }
      return;
    }
    stopped = true;
    window.gtag = function () {};
    tag.remove();
    // Removing a script does not unload code already executed. Reload promptly
    // with the saved refusal. Google may send a final consent-status update;
    // requests/data already sent and Google's third-party cookies cannot be
    // recalled/deleted by this first-party page.
    if (persistenceSafe) location.reload();
    else location.replace(destination.href);
  }

  accept.addEventListener('click', () => {
    if (stopped) return;
    saveChoice('accepted');
    if (new URL(location.href).searchParams.has(withdrawalParameter)) {
      const destination = new URL(location.href);
      destination.searchParams.delete(withdrawalParameter);
      try { window.history.replaceState(window.history.state, '', destination.href); }
      catch { /* The fallback will keep the next load denied if removal fails. */ }
    }
    updateWithdrawalLinks(false);
    hideBanner();
    loadTag();
  });
  reject.addEventListener('click', () => {
    const persistenceSafe = saveChoice('rejected');
    hideBanner();
    stopTag(persistenceSafe);
  });
  settings.addEventListener('click', () => showBanner(true));
  settings.hidden = false;

  const choice = readChoice();
  if (new URL(location.href).searchParams.get(withdrawalParameter) === 'denied') updateWithdrawalLinks(true);
  if (choice) {
    hideBanner();
    if (choice === 'accepted') loadTag();
    else clearAdvertisingCookies();
  } else {
    clearAdvertisingCookies();
    showBanner(false);
  }

  // Respect withdrawal/expiry from another tab and re-check restored pages.
  function recheckChoice() {
    const current = readChoice();
    if (current !== 'accepted') {
      if (tag) stopTag();
      else if (current === null) showBanner(false);
      else hideBanner();
    }
  }
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) recheckChoice();
  });
  window.addEventListener('pageshow', recheckChoice);
})();
