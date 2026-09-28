// Native <details> keeps language links usable without JavaScript.
const languageSwitcher = document.querySelector('.language-switcher');

if (languageSwitcher) {
  const trigger = languageSwitcher.querySelector('summary');
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
