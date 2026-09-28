# Bioresonance.club

Official static website for **Bioresonance: Frequency Sounds** by Boris Douarre.
Published on GitHub Pages at https://bioresonance.club.

## Pages

- `/`: English
- `/fr.html`: French
- `/de.html`: German
- `/es.html`: Spanish
- `/it.html`: Italian
- `/pt.html`: Portuguese
- `/privacy.html` and `/terms.html`: existing English legal documents

All language pages link to the iOS app, expose reciprocal `hreflang` links,
use self-referencing canonical URLs, and include descriptive JSON-LD.
The mobile app's verified App Store ID is `6807718780`.

## Editing and checking

Update `content-<language>.json` for copy and `template.html.in` for structure.
Python 3.9+ and its standard library are sufficient:

```sh
python3 build_site.py
python3 build_site.py --check
python3 verify_site.py
python3 -m http.server 8876 --bind 127.0.0.1
```

Commit both source and generated files. GitHub Pages serves the checked-in HTML;
there is no client-side translation, mandatory language redirect or JavaScript
needed to read the product information, follow links or open the FAQ.

The language picker is a native `details` disclosure in the header;
`language-menu.js` adds Escape, outside-click and focus dismissal. The build
fingerprints stylesheet and script URLs so browsers load assets matching the
current HTML. Its three Lucide icons ship locally with `lucide-LICENSE.txt`.

Each locale has three optimized WebP images in `assets/landing`:
`bioresonance-hero-<language>.webp`, `local-ai-<language>.webp` and
`immersive-player-<language>.webp`. They use the existing localized App Store
artwork, including translated UI. The hero is also the locale's social sharing
and structured-data screenshot. Keep the 680×1478 hero and 520×1130 secondary
dimensions when replacing artwork.

`robots.txt` permits public indexing, including Googlebot, Bingbot and
OAI-SearchBot. `sitemap.xml` lists the six canonical landing pages and two legal
pages. Submit it in Google Search Console and Bing Webmaster Tools with an
account that controls the domain. These tools are needed to observe actual
indexing, impressions, clicks and AI citations; source changes alone do not
prove that indexing or ranking has improved.

## Product facts and structured data

Content and compatibility were checked against the public Apple listing on
2026-09-28. Keep them updated when the product changes. Android retains its
existing coming-soon status until a public release URL is supplied and verified.

The `MobileApplication`, `WebPage`, `WebSite` and publisher JSON-LD describes
visible facts. No reviews, ratings, medical benefits or subscription prices
are invented. This is not a claim of eligibility for Google's software-app rich
result, which requires additional genuine review/offer data. The visible FAQ
is for users, without a promise of a FAQ rich result.

## Official reference material

- https://developers.google.com/search/docs/essentials
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/software-app
- https://developers.google.com/search/docs/fundamentals/ai-features
- https://developers.openai.com/api/docs/bots

SEO and AI search visibility depend on content quality, crawling, indexing,
relevance and external signals; no ranking or citation is guaranteed.
