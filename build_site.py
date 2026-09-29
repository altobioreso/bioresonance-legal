#!/usr/bin/env python3
"""Build the static, multilingual website using Python's standard library."""
import argparse
import hashlib
import html
import json
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent
SITE = 'https://bioresonance.club'
APP_STORE = 'https://apps.apple.com/us/app/bioresonance-frequency-sounds/id6807718780'
LANGUAGES = ('en', 'fr', 'de', 'es', 'it', 'pt')
PATHS = {lang: '/' if lang == 'en' else f'/{lang}.html' for lang in LANGUAGES}
CHOICE_PATHS = {**PATHS, 'en': '/?lang=en'}
APPLE_ICON = '<svg class="store-icon apple-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.7 19.5c-.8 1.2-1.7 2.4-3 2.5-1.4 0-1.8-.8-3.3-.8s-2 .8-3.3.8c-1.3.1-2.3-1.3-3.1-2.5-1.7-2.5-3-7-.3-10.1.9-1.5 2.4-2.5 4.1-2.5 1.3 0 2.5.9 3.3.9.8 0 2.2-1.1 3.7-.9.7 0 2.4.3 3.6 1.9-3.1 1.8-2.6 5.9.5 7.1-.7 1.6-1.5 3.3-2.2 3.6ZM14.4 5.2c.7-.8 1.9-1.5 2.9-1.5.1 1.2-.3 2.4-1 3.2-.7.9-1.8 1.5-2.9 1.5-.1-1.2.4-2.4 1-3.2Z"/></svg>'


def render_all():
    data = {lang: json.loads((ROOT / f'content-{lang}.json').read_text()) for lang in LANGUAGES}
    template = Template((ROOT / 'template.html.in').read_text())
    output = {}
    # A new URL ensures returning visitors load the assets matching the HTML.
    assets = {name: '/' + name + '?v=' + hashlib.sha256((ROOT / name).read_bytes()).hexdigest()[:12]
              for name in ('styles.css', 'language-menu.js')}
    for lang, content in data.items():
        if content.keys() != data['en'].keys() or content['lang'] != lang:
            raise ValueError(f'Locale schema mismatch: {lang}')
        canonical = SITE + PATHS[lang]
        values = {key: html.escape(value, quote=True) for key, value in content.items() if isinstance(value, str)}
        values.update(canonical=canonical, page_path=CHOICE_PATHS[lang], app_store=APP_STORE, language_code=lang.upper())
        values.update(stylesheet_path=assets['styles.css'], language_script_path=assets['language-menu.js'])
        image_suffix = '-' + lang
        values.update(hero_image_path=f'/assets/landing/bioresonance-hero{image_suffix}.webp',
                      ai_image_path=f'/assets/landing/local-ai{image_suffix}.webp',
                      player_image_path=f'/assets/landing/immersive-player{image_suffix}.webp')
        values['hero_image_url'] = SITE + values['hero_image_path']
        separator = ',' if lang == 'en' else ('\u202f' if lang in ('fr', 'pt') else '.')
        values.update(metric1_value='10' + separator + '000+', metric2_value='1' + separator + '500')
        values['alternates'] = '\n'.join(f'  <link rel="alternate" hreflang="{code}" href="{SITE}{path}">' for code, path in PATHS.items()) + f'\n  <link rel="alternate" hreflang="x-default" href="{SITE}/">'
        values['og_alternates'] = '\n'.join(f'  <meta property="og:locale:alternate" content="{item["locale"]}">' for code, item in data.items() if code != lang)
        values['language_links'] = '\n'.join(
            f'<a href="{CHOICE_PATHS[code]}" lang="{code}" hreflang="{code}"'
            + (' aria-current="page"' if code == lang else '')
            + f'><span class="language-option-code" aria-hidden="true">{code.upper()}</span>'
            + f'<span>{html.escape(item["language_name"])}</span>'
            + '<span class="language-icon icon-check" aria-hidden="true"></span></a>'
            for code, item in data.items()
        )
        values['store_badge'] = f'<a class="store-badge" href="{APP_STORE}" aria-label="{values["store_accessible"]}">{APPLE_ICON}<span><small>{values["store_small"]}</small><strong>App Store</strong></span></a>'
        values['faq_html'] = '\n'.join(f'<details><summary>{html.escape(faq["q"])}</summary><p>{html.escape(faq["a"])}</p></details>' for faq in content['faq'])
        schema = {'@context': 'https://schema.org', '@graph': [
            {'@type': 'Person', '@id': SITE + '/#developer', 'name': 'Boris Douarre'},
            {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': 'Bioresonance', 'inLanguage': list(LANGUAGES), 'publisher': {'@id': SITE + '/#developer'}},
            {'@type': 'WebPage', '@id': canonical + '#webpage', 'url': canonical, 'name': content['title'], 'description': content['description'], 'inLanguage': lang, 'isPartOf': {'@id': SITE + '/#website'}, 'mainEntity': {'@id': SITE + '/#app'}},
            {'@type': 'MobileApplication', '@id': SITE + '/#app', 'name': 'Bioresonance: Frequency Sounds', 'url': SITE + '/', 'description': content['hero_lead'], 'applicationCategory': 'LifestyleApplication', 'operatingSystem': 'iOS 16.6 or later; iPadOS 16.6 or later', 'availableOnDevice': ['iPhone', 'iPad'], 'inLanguage': list(LANGUAGES), 'installUrl': APP_STORE, 'sameAs': APP_STORE, 'image': SITE + '/assets/landing/bioresonance-logo.webp', 'screenshot': values['hero_image_url'], 'author': {'@id': SITE + '/#developer'}}
        ]}
        values['schema'] = json.dumps(schema, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
        output['index.html' if lang == 'en' else f'{lang}.html'] = template.substitute(values)
    urls = [SITE + path for path in PATHS.values()] + [SITE + '/privacy.html', SITE + '/terms.html']
    output['sitemap.xml'] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{url}</loc></url>\n' for url in urls) + '</urlset>\n'
    output['robots.txt'] = '# Public pages are available to search engines, including Googlebot, Bingbot and OAI-SearchBot.\nUser-agent: *\nAllow: /\n\nSitemap: https://bioresonance.club/sitemap.xml\n'
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if generated files are stale')
    args = parser.parse_args()
    for name, content in render_all().items():
        path = ROOT / name
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit(f'Stale generated file: {name}')
        else:
            path.write_text(content)
    print('Static pages and crawl files are current.' if args.check else 'Built six language pages, sitemap.xml and robots.txt.')

if __name__ == '__main__':
    main()
