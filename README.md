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
- `/website-privacy.html`: website advertising consent and privacy notice

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

Commit both source and generated files. GitHub Pages serves the checked-in HTML.
There is no client-side translation, and JavaScript is not needed to read the
product information, follow links or open the FAQ.

## Automatic language selection

At `/` and `/index.html`, `language-menu.js` selects the first supported language
from `navigator.languages` (including regional variants such as `fr-CA` and
`pt-BR`). A language chosen in the menu is saved in local storage and takes
priority on future visits to the entry point. English is the fallback.

Explicit locale URLs such as `/fr.html` keep their language, so shared links and
search results remain predictable. Legal pages do not redirect. The English
menu link uses `/?lang=en` so it also works when storage is blocked. A valid
`lang` parameter overrides detection at the entry point. Redirects preserve
other query parameters and section anchors, and use `location.replace` to avoid
a back-button loop. Without JavaScript, the static English entry page and all
six language links remain available.

Run the routing and menu behavior checks with `node --test language-menu.test.cjs`.

The language picker is a native `details` disclosure in the header;
`language-menu.js` runs early for detection, then adds preference storage,
Escape, outside-click and focus dismissal once the page is ready. The build
fingerprints stylesheet and script URLs so browsers load assets matching the
current HTML. Its three Lucide icons ship locally with `lucide-LICENSE.txt`.

Each locale has three optimized WebP images in `assets/landing`:
`bioresonance-hero-<language>.webp`, `local-ai-<language>.webp` and
`immersive-player-<language>.webp`. They use the existing localized App Store
artwork, including translated UI. The hero is also the locale's social sharing
and structured-data screenshot. Keep the 680×1478 hero and 520×1130 secondary
dimensions when replacing artwork.

`robots.txt` permits public indexing, including Googlebot, Bingbot and
OAI-SearchBot. `sitemap.xml` lists the six canonical landing pages and three legal
pages. Submit it in Google Search Console and Bing Webmaster Tools with an
account that controls the domain. These tools are needed to observe actual
indexing, impressions, clicks and AI citations; source changes alone do not
prove that indexing or ranking has improved.

## Optional Google Ads audience collection

`ads-consent.js` configures the verified Google Ads destination `AW-799867999`
for account `723-025-9227`. It uses Basic Consent Mode v2: no Google script or
advertising request before acceptance, and no Google loading after refusal.
The six landing pages offer equally prominent accept/refuse buttons and a
footer control to change the choice. The English website privacy notice also
provides that control; the existing app legal documents are unchanged.

The choice expires after 180 days. Accepting enables only advertising consent;
analytics consent remains denied. The tag is restricted to HTTPS on
`bioresonance.club` or `www.bioresonance.club` and the six landing pages (plus
the `/index.html` alias). Localhost, previews and legal pages never load Google.
The configuration excludes URL queries, fragments and page referrers, and
does not add conversion, click, form or app-data events.

Withdrawal clears accessible first-party `_gcl_*` cookies and reloads the page
to unload the tag. A final consent-status request can occur during withdrawal;
previously transmitted data and cookies on Google's domains cannot be deleted
by the site. Storage failures fall back to session storage, then a local
`ads_consent=denied` URL marker if a stale acceptance cannot be removed.

Run the behavioral checks with `node --test ads-consent.test.cjs` and rebuild
after editing the script so generated pages receive its updated fingerprint.
These checks verify local behavior, not successful receipt by Google. After
deployment, check the destination's diagnostics and audience population in
Google Ads; reporting can lag and acceptance does not guarantee eligibility.

YouTube audiences were already open in the linked account on 2026-10-08. Site
tracking does not recover visitors from before its installation. Health-related
personalised advertising restrictions still apply to future campaigns even
when the audience manager displays a segment as eligible:
https://support.google.com/adspolicy/answer/16701855

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
