(() => {
  const paths = { en: '/', fr: '/fr.html', de: '/de.html', es: '/es.html', it: '/it.html', pt: '/pt.html' };
  const preferenceKey = 'bioresonance-language';
  const supported = (language) => Object.prototype.hasOwnProperty.call(paths, language);
  const remember = (language) => {
    try { localStorage.setItem(preferenceKey, language); } catch { /* Storage can be disabled. */ }
  };

  // Only the neutral entry point negotiates a language. Shared locale URLs stay stable.
  if (location.pathname === '/' || location.pathname === '/index.html') {
    const params = new URLSearchParams(location.search);
    const explicit = params.get('lang');
    let preferred;
    try { preferred = localStorage.getItem(preferenceKey); } catch { /* Use browser languages. */ }
    const browserLanguages = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language];
    const detected = browserLanguages
      .map((language) => String(language || '').toLowerCase().split(/[-_]/)[0])
      .find(supported);
    const language = supported(explicit) ? explicit
      : supported(preferred) ? preferred : detected || 'en';

    if (supported(explicit)) remember(explicit);
    if (language !== 'en') {
      // Preserve campaign parameters and deep links, but consume the language override.
      params.delete('lang');
      const query = params.toString();
      location.replace(paths[language] + (query ? '?' + query : '') + location.hash);
      return;
    }
  }

  function setupMenu() {
    // Native <details> and real links remain usable when JavaScript is unavailable.
    const languageSwitcher = document.querySelector('.language-switcher');
    if (!languageSwitcher) return;
    const trigger = languageSwitcher.querySelector('summary');
    languageSwitcher.querySelectorAll('.language-menu a[hreflang]').forEach((link) => {
      const saveChoice = () => {
        const language = link.getAttribute('hreflang');
        if (supported(language)) remember(language);
      };
      link.addEventListener('click', saveChoice);
      link.addEventListener('auxclick', (event) => {
        if (event.button === 1) saveChoice();
      });
    });
    document.addEventListener('click', (event) => {
      if (!languageSwitcher.contains(event.target)) languageSwitcher.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && languageSwitcher.open) {
        languageSwitcher.open = false;
        trigger.focus();
      }
    });
    document.addEventListener('focusin', (event) => {
      if (!languageSwitcher.contains(event.target)) languageSwitcher.open = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMenu, { once: true });
  } else {
    setupMenu();
  }
})();
