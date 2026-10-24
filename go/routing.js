/* Bioresonance smart link: pure routing functions shared by the page and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BioGo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt'];
  const STORES = Object.freeze({
    ios: 'https://apps.apple.com/app/id6807718780',
    android: 'https://play.google.com/store/apps/details?id=com.altoboreal.bioresonance'
  });
  const NETWORKS = Object.freeze({
    tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube',
    snapchat: 'Snapchat', facebook: 'Facebook', messenger: 'Messenger'
  });
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function locale(value) {
    const code = String(value || '').toLowerCase().split(/[-_]/)[0];
    return LANGUAGES.includes(code) ? code : null;
  }
  function language(params, languages) {
    return locale(params.get('lang')) || (languages || []).map(locale).find(Boolean) || 'en';
  }
  function device(ua, touchPoints) {
    if (/Windows Phone|Windows NT/i.test(ua)) return 'desktop';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return 'ios';
    return 'desktop';
  }
  function inspect(options) {
    const ua = String(options.ua || '');
    const params = new URLSearchParams(options.search || '');
    let platform = device(ua, Number(options.touchPoints) || 0);
    const bot = /bot\b|crawler|spider|facebookexternalhit|Facebot|WhatsApp\/|Slackbot|Discordbot|SkypeUriPreview|Pinterestbot|Google-InspectionTool/i.test(ua);
    const detectors = [
      ['tiktok', /TikTok|musical_ly|BytedanceWebview|\btrill\b|\bAweme\b/i],
      ['instagram', /Instagram/i],
      ['youtube', /YouTube|com\.google\.ios\.youtube/i],
      ['snapchat', /Snapchat/i],
      ['messenger', /Messenger/i],
      ['facebook', /FBAN|FBAV|FB_IAB|FBIOS|Facebook/i]
    ];
    const matched = detectors.find((entry) => entry[1].test(ua));
    const spy = options.spy || {};
    let network = matched ? matched[0] : has(NETWORKS, spy.appKey) ? spy.appKey : null;
    // Generic WebViews also need instructions, even when their host app is unknown.
    const webview = /;\s*wv\)|\bwv\b/i.test(ua) ||
      (platform === 'ios' && /AppleWebKit/i.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua));
    let embedded = !!(network || spy.isInApp || webview);
    const preview = params.has('preview');
    if (preview) {
      const requested = params.get('preview');
      if (has(NETWORKS, requested)) { network = requested; embedded = true; }
      if (requested === 'browser' || requested === 'desktop') { network = null; embedded = false; }
      const requestedPlatform = params.get('platform');
      if (['ios', 'android', 'desktop'].includes(requestedPlatform)) platform = requestedPlatform;
      if (requested === 'desktop') platform = 'desktop';
    }
    const knownBrowser = /Safari|Chrome|CriOS|Firefox|FxiOS|Edg|SamsungBrowser|OPR|OPiOS|DuckDuckGo/i.test(ua);
    const manual = params.get('manual') === '1';
    const target = STORES[platform] || null;
    const shouldRedirect = !!(target && knownBrowser && !embedded && !bot && !preview && !manual);
    return {
      platform, embedded: embedded && !bot, network, appName: NETWORKS[network] || '',
      bot, preview, manual, target, shouldRedirect,
      language: language(params, options.languages)
    };
  }
  function shareURL(search, selectedLanguage) {
    // Canonical fixed host/path; incoming destinations, fragments and debug flags are ignored.
    const url = new URL('https://bioresonance.club/go/');
    const params = new URLSearchParams(search || '');
    const code = locale(selectedLanguage);
    if (code) url.searchParams.set('lang', code);
    for (const key of ['src', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = params.get(key);
      if (value && /^[a-zA-Z0-9 ._~-]{1,128}$/.test(value)) url.searchParams.set(key, value);
    }
    return url.href;
  }
  function chromeIntent(search, selectedLanguage) {
    const url = new URL(shareURL(search, selectedLanguage));
    const fallback = new URL(url);
    fallback.searchParams.set('manual', '1');
    return 'intent://' + url.host + url.pathname + url.search +
      '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;' +
      'package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(fallback.href) + ';end';
  }
  return Object.freeze({ LANGUAGES, STORES, NETWORKS, locale, language, device, inspect, shareURL, chromeIntent });
});
