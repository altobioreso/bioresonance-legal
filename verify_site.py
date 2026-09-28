#!/usr/bin/env python3
"""Check crawlability, international links, structured data and local assets."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit, unquote
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET
from build_site import ROOT, SITE, LANGUAGES, PATHS, APP_STORE, render_all

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
    def nodes(self, tag):
        return [a for t, a in self.tags if t == tag]

checks = 0

def check(condition, message):
    global checks
    checks += 1
    assert condition, message

expected = render_all()
base = json.loads((ROOT / 'content-en.json').read_text())
for lang in LANGUAGES:
    filename = 'index.html' if lang == 'en' else f'{lang}.html'
    text = (ROOT / filename).read_text()
    page = Page(text)
    content = json.loads((ROOT / f'content-{lang}.json').read_text())
    check(text == expected[filename], f'{lang}: generated content stale')
    check(content.keys() == base.keys(), f'{lang}: missing content fields')
    check(all(type(v) is type(base[k]) for k,v in content.items()), f'{lang}: content types')
    check(page.nodes('html')[0]['lang'] == lang, f'{lang}: html lang')
    check(len(page.nodes('h1')) == 1, f'{lang}: one H1 required')
    check(len(content['faq']) == 6, f'{lang}: complete FAQ')
    check(len(content['title']) <= 70 and len(content['description']) <= 180, f'{lang}: metadata too long')
    canonical = [a['href'] for a in page.nodes('link') if a.get('rel') == 'canonical']
    check(canonical == [SITE + PATHS[lang]], f'{lang}: self canonical')
    alternates = {a['hreflang']: a['href'] for a in page.nodes('link') if a.get('rel') == 'alternate'}
    check(alternates == {**{l: SITE+p for l,p in PATHS.items()}, 'x-default': SITE+'/'}, f'{lang}: reciprocal hreflang')
    check(not any('noindex' in a.get('content', '') or 'nosnippet' in a.get('content', '') for a in page.nodes('meta')), f'{lang}: robots blocking')
    badges = [a for a in page.nodes('a') if a.get('class') == 'store-badge']
    check(len(badges) == 2 and all(a.get('href') == APP_STORE and not a.get('aria-disabled') for a in badges), f'{lang}: iOS calls to action')
    check(not any(a.get('aria-disabled') for a in page.nodes('div')), f'{lang}: disabled old badges')
    for image in page.nodes('img'):
        check(all(k in image for k in ('alt','width','height')), f'{lang}: image dimensions/accessibility')
    ids = [a['id'] for _,a in page.tags if 'id' in a]
    check(len(ids) == len(set(ids)), f'{lang}: duplicate IDs')
    for tag, attrs in page.tags:
        for attr in ('src','href'):
            value = attrs.get(attr,'')
            if not value or urlsplit(value).scheme or value.startswith('//'):
                continue
            path, fragment = urlsplit(value).path, urlsplit(value).fragment
            if path:
                local = ROOT / unquote(path.lstrip('/'))
                if local.is_dir(): local = local / 'index.html'
                check(local.is_file(), f'{lang}: missing target {value}')
            elif fragment:
                check(fragment in ids, f'{lang}: missing fragment {fragment}')
    schema_text = re.search(r'<script type="application/ld\+json">(.*?)</script>',text,re.S).group(1)
    graph = json.loads(schema_text)['@graph']
    app = next(node for node in graph if node['@type'] == 'MobileApplication')
    check(app['installUrl'] == APP_STORE and app['name'] == 'Bioresonance: Frequency Sounds', f'{lang}: app schema')
    check(not any('aggregateRating' in node or 'review' in node for node in graph), f'{lang}: unsupported ratings')
    check(next(node for node in graph if node['@type'] == 'WebPage')['url'] == canonical[0], f'{lang}: schema canonical')
    check(all(l in text for l in ('Boris Douarre','bioresonance528hz (at) gmail.com')), f'{lang}: publisher and contact')

sitemap = ET.fromstring((ROOT / 'sitemap.xml').read_text())
urls = [loc.text for loc in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
check(set(urls) == {SITE+p for p in PATHS.values()} | {SITE+'/privacy.html',SITE+'/terms.html'}, 'Sitemap canonical URLs')
check(len(urls) == len(set(urls)), 'Sitemap duplicates')
robot = RobotFileParser();robot.parse((ROOT / 'robots.txt').read_text().splitlines())
for bot in ('Googlebot','Bingbot','OAI-SearchBot'):
    for url in urls: check(robot.can_fetch(bot,url), f'Blocked: {bot}, {url}')
for name in ('privacy.html','terms.html'):
    text = (ROOT / name).read_text()
    old = subprocess.check_output(['git','show',f'4aa35eb:{name}'], cwd=ROOT, text=True)
    check(text.split('<body>',1)[1] == old.split('<body>',1)[1], f'Legal content modified: {name}')
    check(SITE+'/'+name in text, f'Legal canonical: {name}')
check((ROOT/'CNAME').read_text().strip()=='bioresonance.club', 'Custom domain')
print(f'PASS: {checks} checks, six locales, 12 download badges, 8 sitemap URLs, legal content preserved.')
