# Bioresonance — lien unique `/go`

Lien à placer dans les profils, publications ou descriptions de **TikTok, Instagram, YouTube, Snapchat et Facebook** :

**https://bioresonance.club/go**

La page est statique, hébergée sur le GitHub Pages existant de `altobioreso/bioresonance-legal`. Elle ne nécessite aucun serveur supplémentaire, abonnement ni hébergement payant. Le domaine existant conserve son propre renouvellement.

## Fonctionnement

- Dans un navigateur mobile reconnu : redirection vers la boutique correspondant à l’appareil.
- Dans un navigateur intégré détecté : un titre et deux instructions pour ouvrir le navigateur externe. Une flèche et un halo bleus attirent l’attention vers le menu en haut à droite ; les boutons des boutiques, Chrome et la copie du lien sont regroupés sous « Autres options ».
- Sur ordinateur : choix entre les deux boutiques.
- Sans JavaScript : les liens des deux boutiques et une aide restent disponibles, avec les six langues dans un volet dépliable.

Les destinations sont fixes :

| Appareil | Destination |
|---|---|
| iPhone, iPad | https://apps.apple.com/app/id6807718780 |
| Android | https://play.google.com/store/apps/details?id=com.altoboreal.bioresonance |

La page n’accepte pas de destination de redirection fournie dans l’URL. Elle ouvre la fiche de la boutique ; elle ne détecte pas si l’app est déjà installée.

L’animation boucle en continu par cycles de 2,3 secondes. Elle est désactivée avec `prefers-reduced-motion`. Le sélecteur de langue et la signature Bioresonance restent en bas de page. Les options utilisent un volet natif accessible au clavier ; sans JavaScript, il reste ouvert.

## Langues et paramètres

Les six langues sont **anglais, français, allemand, espagnol, italien et portugais** (`en`, `fr`, `de`, `es`, `it`, `pt`). La première langue compatible du navigateur est sélectionnée, avec l’anglais comme repli. Les variantes régionales telles que `fr-CA` et `pt-BR` sont reconnues. Le portugais affiché est celui du Portugal.

`?lang=fr` impose le français. Le sélecteur permet de changer de langue et inscrit ce choix dans l’URL, sans stockage local. Ces paramètres concernent cette page ; la boutique applique ses propres réglages de langue et de pays.

| Usage | Exemple |
|---|---|
| Lien courant, langue automatique | `/go/` |
| Français | `/go/?lang=fr` |
| Afficher l’aide sans redirection automatique | `/go/?manual=1&lang=fr` |
| Aperçu TikTok sur iPhone | `/go/?preview=tiktok&platform=ios&lang=fr` |
| Aperçu Instagram sur Android | `/go/?preview=instagram&platform=android&lang=de` |
| Aperçu du choix sur ordinateur | `/go/?preview=desktop&lang=es` |
| Aperçu dans un navigateur mobile | `/go/?preview=browser&platform=ios&lang=it` |

Les valeurs de réseau disponibles pour `preview` sont `tiktok`, `instagram`, `youtube`, `snapchat`, `facebook` et `messenger`. `platform` accepte `ios`, `android` ou `desktop`, uniquement en mode aperçu. Tout paramètre `preview` désactive les redirections automatiques. Les boutons de boutique restent actifs : ne pas publier ces liens de test à la place du lien courant.

## Limites et confidentialité

La détection utilise les informations publiques du navigateur. Certaines versions des apps masquent leur identité : un navigateur intégré de YouTube peut notamment être indiscernable de Safari. Les menus et leurs libellés varient selon l’app, sa version et le téléphone. Il n’existe donc aucune garantie d’ouvrir automatiquement un navigateur externe ou de contourner une restriction du réseau social.

Sur Android, « Essayer d’ouvrir Chrome » utilise un intent déclenché par un **clic explicite**. Son succès dépend de Chrome, d’Android et de l’app d’origine. Si cela échoue, l’utilisateur peut passer par le menu ou copier le lien. Aucune tentative automatique équivalente ne force Safari sur iOS.

Le code de `/go` n’ajoute **aucun suivi, cookie, stockage local, compte ou backend**. Il ne charge aucun outil publicitaire ni CDN ; les scripts sont servis localement. Cela ne supprime pas les traitements ordinaires des requêtes par GitHub Pages ou par les boutiques après navigation.

La copie et le lien d’ouverture de Chrome conservent `lang`, ainsi que les paramètres autorisés `src`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` et `utm_term` lorsqu’ils sont valides. Les valeurs de source acceptent de 1 à 128 caractères ASCII : lettres, chiffres, espace et `._~-`. Les paramètres de test, fragments et destinations arbitraires sont retirés. Ces paramètres de source **ne mesurent rien** : aucun clic ni téléchargement n’est enregistré et ils ne sont pas transmis aux liens des boutiques.

## Maintenance et vérification

- `routing.js` : détection, choix de langue, destinations fixes et URL de copie.
- `app.js` : affichage, boutons, presse-papiers et redirection.
- `locales.js` : textes des six langues.
- `index.html`, `style.css` : structure et présentation.
- `vendor/` : dépendance figée et licence.

Depuis la racine du dépôt :

```sh
node --test go/*.test.cjs
python3 -m http.server 8876 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8876/go/?preview=tiktok&platform=ios&lang=fr` pour inspecter la page sans redirection. Les tests automatisés vérifient la logique et les scénarios simulés ; ils ne prouvent pas le comportement des apps tierces.

Avant une campagne, essayer le lien public depuis les cinq réseaux sur un vrai iPhone et un vrai Android : ouverture de la boutique correcte, menu externe, copie du lien, Chrome présent ou absent, puis navigation dans Safari et Chrome. Contrôler aussi les six langues et le retour arrière.

Commiter les fichiers de `go/` puis les publier sur `main` déclenche le déploiement GitHub Pages existant. Vérifier son succès dans les Actions du dépôt et tester le lien public après déploiement.

### Dépendance locale

`inapp-spy` **5.0.10** est figé dans `vendor/inapp-spy-5.0.10.js`. Seul son détecteur synchrone est utilisé ; la détection expérimentale de Safari View Controller n’est pas appelée.

- Source : [`inapp-spy-5.0.10.tgz`](https://registry.npmjs.org/inapp-spy/-/inapp-spy-5.0.10.tgz), fichier `dist/index.global.js` extrait sans modification.
- Documentation : [tag `v5.0.10`](https://github.com/shalanah/inapp-spy/tree/v5.0.10), commit `bd32bfd9291c083b7c41b3c09dc8b1c33b5f0b7e`.
- Licence : MIT, © 2024 Shalanah Dawson ; texte conservé dans `vendor/LICENSE-inapp-spy.txt`.
- SHA-256 du fichier JavaScript : `de24950342017f37e6e5f94c5f1a11726c8987afda46b101078de849800352c7`.
- SHA-256 de l’archive source : `0f3e106d1cd8377ee469e412c50523f152375d2088de3864648aed8d8672e7e3`.

Vérification de l’intégrité :

```sh
shasum -a 256 go/vendor/inapp-spy-5.0.10.js
```
