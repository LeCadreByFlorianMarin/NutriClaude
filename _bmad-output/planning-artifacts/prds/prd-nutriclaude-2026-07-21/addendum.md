# Addendum — NutriClaude

Ce document conserve la matière issue de `architecture-nutriclaude.html` (v2.0, avril 2026) et de l'analyse du code qui **n'a pas sa place dans le PRD** : décisions techniques, alternatives rejetées, stratégie commerciale hors périmètre. Destiné aux documents aval (architecture, solution design, UX) et à la mémoire du projet.

---

## 1. Décisions techniques (→ document d'architecture)

### Principe directeur

> « **Supabase est un détail, pas l'architecture.** Le modèle de données et le MCP server sont conçus pour être indépendants du provider. Si demain tu migres vers un Postgres auto-hébergé, seul le layer de connexion change. »

Inversion de dépendance explicite, avec scénario de sortie nommé (Postgres auto-hébergé). C'est la phrase la plus structurante du doc d'origine.

### Découpage en bounded contexts (4)

`User Profiles` (comptes, auth, profils nutritionnels) · `Recipe Management` (recettes, ingrédients, macros calculées) · `Product Catalog` (catalogue OFF + mapping rayon) · `Grocery List` (liste partagée triée par rayon, statuts). Approche DDD revendiquée : « chaque table est un aggregate ou une value table claire. Les références entre aggregates se font par ID. »

### Choix de socle

| Décision | Rationale d'origine |
|---|---|
| PostgreSQL via Supabase | Relations complexes recettes/produits/rayons ; RLS pour le multi-utilisateur ; API REST auto-générée |
| REST auto-générée + Edge Functions (Deno) | « Zéro serveur à maintenir » ; les Shortcuts appellent directement REST ; Edge Functions pour la logique métier |
| Auth par magic link, sans mot de passe | « Pas de mot de passe. Magic link par email = simple pour l'utilisateur. » **Non suivi : le code implémente email + mot de passe.** L'intention UX d'origine — ne rien avoir à retenir — reste valable et mérite d'être retranchée ou assumée explicitement |
| Interface iOS Shortcuts | « Natif, gratuit, partageable. » Écarte le développement d'une app native |
| MCP en TypeScript, transport `stdio` | « Permet à Claude d'interagir directement avec la DB. **Standard Anthropic.** » |
| Vue SQL `grocery_list_by_aisle` comme contrat | Tri et présentation poussés dans la base, « prête à afficher » pour les Shortcuts |
| Stockage de la réponse OFF brute (`off_data` jsonb) | « Pour ne rien perdre » |
| Cache-aside sur les produits, péremption 30 jours | Recherche locale d'abord, appel OFF si absent ou périmé, upsert, réponse depuis le cache |
| Double mapping rayon : `product_id` **ou** `keyword` | Le mot-clé permet de classer un ingrédient sans fiche produit — dégradation gracieuse |

Frontière REST / Edge Functions : REST pour le CRUD simple, Edge Functions pour matching rayon, calcul macros, appel Claude. Cinq fonctions nommées : `add-grocery-item`, `generate-recipe`, `sync-product`, `clear-grocery-list`, `weekly-menu`.

Neuf tools MCP prévus : `get_profiles`, `update_profile`, `search_product`, `create_recipe`, `list_recipes`, `add_to_grocery_list`, `get_grocery_list`, `manage_aisles`, `plan_weekly_menu`.

Open Food Facts : API v2, `https://world.openfoodfacts.org/api/v2`, en-tête `User-Agent` requis par OFF, sélection de champs à l'appel. Argument : « 3M+ produits, gratuit, open source ».

### Tensions non résolues dans le doc d'origine

À trancher en phase architecture, elles ne sont pas décrites comme des problèmes dans la source :

- **Le serveur MCP utilise `SUPABASE_SERVICE_KEY`**, ce qui contourne le RLS — or le RLS est le *seul* mécanisme d'isolation entre foyers. C'est exactement la surface visée par FR-39 du PRD. Le doc ne discute pas cette tension.
- **Transport MCP `stdio`** suppose une exécution locale sur la machine de l'utilisateur, en tension avec l'ambition d'un hébergement partagé.
- **Le jeton stocké dans le Shortcut** : ni expiration ni renouvellement traités.

### État technique du code actuel (hors périmètre PRD)

- **L'app ne compile pas — vérifié, pas supposé.** `next build` échoue d'abord sur le greffon PostCSS de Tailwind 4 (`app/globals.css` est en syntaxe Tailwind 3) ; `tsc` confirme ensuite `cookies()` non attendu (`lib/supabase/server.ts`) et `params`/`searchParams` typés en objets plutôt qu'en Promises (`app/(app)/menu/page.tsx`, `app/(app)/recipes/[id]/page.tsx`) ; `npm run typecheck` échoue encore en amont sur `baseUrl` avec TypeScript 6. Enfin, `middleware.ts` — qui porte **tout** le contrôle d'accès — est déprécié dans la version de Next déclarée. `package.json` cible Next 16 / React 19 / Tailwind 4 quand le README annonce Next 14. **Prérequis du lot 0.**
- Dark mode imposé en dur (`color-scheme: dark`, fond `#0f1117`), pas de thème clair.
- Fragment sans clé dans le `.map` de la grille du menu.
- `metadata.title` annonce « NutriCloud — Le Cadre » alors que tout le reste dit « NutriClaude ».
- Aucun test, pas de `error.tsx` / `not-found.tsx`.
- `products` : lecture, écriture et update ouverts à tout utilisateur authentifié — cache mondial partagé, assumé comme tel.
- `product_aisle_map.product_id` n'a aucune interface (seuls les mots-clés sont exposés).

---

## 2. Stratégie Le Cadre — hors périmètre PRD (décision du 2026-07-22)

Conservé intégralement : le PRD v1 est cadré « outil perso/famille », mais cette matière est la raison d'être commerciale du produit dans le doc d'origine et ne doit pas être perdue.

### La thèse

NutriClaude et Le Cadre visent le même ICP : « des pères cadres tech, 32-42 ans, avec un enfant en bas âge, qui veulent reprendre le contrôle sur leur santé ».

> « Un père tech qui galère à organiser la bouffe de la semaine pour sa famille est le même qui n'a plus de temps pour le sport. NutriClaude résout la friction nutrition. Le Cadre résout la friction temps. **Même personne, même douleur, deux angles complémentaires.** »

Distinction structurante : **NutriClaude résout un symptôme, Le Cadre résout la cause.**

Jeu de mots porteur à préserver dans toute reformulation : *cadre* au sens de manager (l'ICP) et *cadre* au sens de structure (« le cadre nutrition est posé en même temps que le cadre temporel »).

### L'escalier d'offres

| Offre | Prix | Durée | Rôle de NutriClaude |
|---|---|---|---|
| NutriClaude | 0 € | — | Lead magnet : attire l'ICP, capture les emails |
| Le Cadre Sprint | 200 € → 500 € | 14 jours | Absent volontairement |
| Le Cadre Endurance | 2 500 € | 12 semaines | Bonus premium : instance configurée pour le foyer du client |
| Le Cadre Mensuel | 80 €/mois | récurrent | Maintenance : macros, nouvelles recettes, support |
| NutriClaude SaaS | 5-10 €/mois | récurrent | Phase 2, conditionnel à un signal de demande |

### Le funnel en 4 temps

1. **Attraction** — contenu « papa tech + nutrition automatisée ». Titres : « Comment j'ai automatisé la nutrition de ma famille avec l'IA », « Fini les prises de tête du dimanche soir », « L'app que j'ai construite pour que ma femme et moi mangions bien sans y penser ».
2. **Capture** — landing `florianmarin.me/nutriclaude`, promesse « Reprends le contrôle de la nutrition de ta famille en 2 minutes par jour ». Email contre Shortcuts pré-configurés + guide de setup.
3. **Nurture** — 5 emails / 2 semaines : E1 setup · E2 personnaliser les rayons · **E3 le pivot** (« Et si le problème n'était pas la bouffe, mais le temps ? ») · E4 témoignage Mathieu D. · E5 CTA Sprint. Mécanisme verbatim : « Tu vois, quand on automatise un truc, ça tient. Et si on faisait pareil pour tes 6h par semaine ? »
4. **Conversion** — entrée Sprint 200 €, upsell Endurance avec NutriClaude en bonus.

### Métriques de funnel

| Étape | Métrique | Objectif |
|---|---|---|
| Landing | visiteur → email | > 25 % |
| NutriClaude | activation (premier Shortcut utilisé) | > 40 % |
| Email | ouverture E3 (pivot) | > 50 % |
| Sprint | email → Sprint | > 3 % |
| Endurance | Sprint → Endurance | > 20 % |

Plus : 50 inscrits dans les 2 semaines suivant le lancement · setup client ramené de 2h à 30 min · valeur perçue du bonus 500 €+ pour ~1h de coût réel · répertoire cible 10-15 recettes.

**Lacune notée** : aucune métrique de rétention produit dans ce tableau, alors que le contre-modèle assumé est « les apps de meal planning ne tiennent jamais plus de 2 semaines ». C'est pourquoi le PRD en fait sa métrique n°1.

### Parcours Endurance 12 semaines

S1-2 setup profils (« le cadre nutrition est posé en même temps que le cadre temporel ») · S3-6 construction de 10-15 recettes, « le dimanche soir n'est plus un casse-tête » · S7-10 autonomie du client sur les Shortcuts · S12 livraison d'une instance fonctionnelle.

Livrables de reproductibilité prévus : script de création de foyer, questionnaire nutritionnel, template de profils, checklist d'installation des Shortcuts.

### Roadmap d'origine

Phase 1 Build (S1-6, dogfooding dès J1) → Phase 2 Launch lead magnet (S7-10) → Phase 3 Intégration Endurance (S10-12) → Phase 4 Scale & micro-SaaS (mois 4+, conditionnel).

---

## 3. Alternatives explicitement rejetées ou différées

- **NutriClaude en SaaS payant** — différé, pas rejeté. « Version standalone si la demande émerge organiquement. **Non prioritaire au lancement.** » Déclencheur nommé : des utilisateurs gratuits qui disent « je ne veux pas Le Cadre, mais je paierais pour un hébergement clé en main ». Règle : « **Pas avant d'avoir le signal.** »
- **Monétiser l'outil directement** — rejeté. « L'objectif n'est pas de monétiser l'outil directement mais d'attirer le même ICP que Le Cadre. »
- **Inclure NutriClaude dans Le Cadre Sprint** — rejeté délibérément. « Focus pur sur le cadre temporel. Mais le client connaît déjà l'outil nutrition. »
- **Le build in public technique comme angle principal** — rétrogradé en « angle secondaire pour la crédibilité ».
- **Le jargon technique dans le marketing** — rejeté. « On parle "temps gagné" et "repas équilibré", pas "MCP server". »
- **Le mot de passe** — rejeté au profit du magic link.
- **Une app native** — écartée au profit des iOS Shortcuts.
- **Le lock-in provider** — rejeté par principe.
- **Les développeurs comme audience** — non-cible explicite. « Tu publies du contenu qui parle à ton ICP, pas aux devs. »

---

## 4. Matière qualitative à ne pas perdre (→ UX, ton, copy)

- **Le produit vise la disparition de la décision, pas son optimisation.** « Pour que ma femme et moi mangions bien sans y penser » — *sans y penser* est la promesse réelle.
- **Le couple est l'unité de valeur, pas l'individu.**
- **L'ambition est la fiabilité, pas la fonctionnalité.** Benchmark implicite négatif : ne pas être une app de meal planning de plus qui meurt à deux semaines. « Quand on automatise un truc, ça tient. »
- **Ton résolument non technique.** « Pas de code. Que le résultat. » La sophistication (MCP, RLS, cache) est délibérément invisible.
- **Registre familier, tutoiement.** Vocabulaire d'origine : « la bouffe », « galèrent », « prises de tête », « casse-tête du dimanche soir ». La promesse est émotionnelle avant d'être fonctionnelle : supprimer une charge mentale récurrente et **datée**.
- **Frugalité opérationnelle comme fierté** : « Zéro serveur à maintenir », « coût marginal quasi nul ».
- **Le personnel comme méthode.** Dogfooding dès J1 avec sa femme, avant toute diffusion. La crédibilité repose sur le fait que l'auteur est le premier utilisateur.
- **Discipline anti-prématurée assumée.** Posture de retenue, pas roadmap d'expansion.

---

## 5. Questions techniques nées des arbitrages du 2026-07-22 (→ architecture)

Ces sujets n'existaient dans aucune source : ils découlent des décisions prises pendant la rédaction du PRD.

### Hors-ligne sur iPhone 15 Pro (NFR-1, NFR-2)

L'app actuelle est l'exact opposé : toutes les pages en `force-dynamic`, chaque action est une Server Action synchrone vers Supabase. Le hors-ligne impose un stockage local, un rendu depuis ce stockage, et une file d'actions rejouées au retour du réseau — c'est une réécriture de la façon dont la liste charge et écrit ses données, pas une option à activer.

Points à trancher : stratégie de résolution des conflits (une bascule *acheté* est idempotente, une suppression et une modification de quantité ne le sont pas) · éviction du stockage local par iOS quand l'app n'est pas utilisée pendant plusieurs semaines · absence de Background Sync sur iOS, donc resynchronisation seulement à la réouverture · le hors-ligne est-il limité à la liste ou couvre-t-il aussi recettes et menu (le PRD ne l'exige que pour la liste).

### Identité d'appareil (FR-21, FR-28, NFR-6)

Le modèle actuel n'a qu'une notion d'identité : un utilisateur authentifié dont le profil désigne un foyer (`current_household_id()`). Le dashboard mural n'a pas d'utilisateur, et les raccourcis vocaux rejouent un jeton indéfiniment.

Il faut une identité rattachée au foyer et non à une personne, avec un périmètre restreint aux opérations de la liste, révocable unitairement — sans réintroduire la clé de service qui court-circuiterait le RLS. À rapprocher de la tension MCP / `SUPABASE_SERVICE_KEY` déjà notée en §1.

### L'API comme contrat public (FR-19 à FR-23)

Le dashboard maison est un consommateur externe développé séparément : la logique métier ne peut plus vivre dans des Server Actions Next.js. Agrégation des doublons, résolution du rayon et mise à l'échelle des quantités doivent s'exécuter au même endroit pour toutes les surfaces — sinon chaque surface réimplémente ses propres règles et diverge.

Le doc d'origine plaçait déjà cette logique dans les Edge Functions, et posait la vue `grocery_list_by_aisle` comme contrat de lecture : les deux restent des pistes cohérentes. Versionnement à prévoir (FR-23).

### Étude de faisabilité vocale — 2026-07-22 (a conduit au retrait de FR-34, puis, après une seconde étude, à la réhabilitation de FR-31)

Le doc d'origine misait toute son interface sur les iOS Shortcuts. L'étude conclut que **cette hypothèse fondatrice n'est plus tenable pour une application web**, et qu'aucun assistant grand public n'est atteignable par un développeur indépendant sans binaire natif publié.

**Côté Google — toutes les portes sont fermées :**

| Option | Statut juillet 2026 | App native ? | Ouvert à un indé ? |
|---|---|---|---|
| Conversational Actions / Actions on Google | Éteint le 13 juin 2023, sans remplaçant conversationnel | — | Non |
| App Actions / BIIs (`UPDATE_ITEM_LIST` couvre exactement le besoin) | Doc encore maintenue, mais adossée à Assistant que Gemini remplace en 2026 ; signalements de non-déclenchement sous Gemini | Oui, publiée Play Store + revue Google | Théoriquement, mais pari perdant |
| AppFunctions (successeur, « MCP on-device ») | Preview expérimentale, Android 16+, Gemini en accès anticipé sur formulaire | Oui | Non — gated EAP |
| Gemini « Connected Apps » | Vivant, **partenaires uniquement**, aucun portail public | n/a | Non |
| Gemini Spark + serveur MCP custom | Ouvert, l'utilisateur colle l'URL du serveur | **Non** | Oui, mais Ultra + US + anglais |
| Google Home APIs / Gemini for Home | Vivant mais **domotique uniquement** (Matter, appareils physiques) | n/a | Non |

**Enceintes et écrans Nest : aucun chemin tiers, à aucun prix.** Ni App Actions, ni AppFunctions (Android only), ni MCP. Le Speaker Reference Design s'adresse aux fabricants de matériel. C'est ce constat qui a d'abord fait basculer la voix sur le dashboard maison — piste ensuite abandonnée (FR-45 retirée) au profit du pont Keep décrit plus bas.

**Côté Apple :** SiriKit est déprécié depuis iOS 26 ; App Intents est le seul chemin vers les capacités Siri. Un `AppIntent` + `AppShortcut` custom suffisent, sans validation Apple particulière — **mais une PWA n'y a aucun accès**. Il faut un binaire natif signé et publié (wrapper `WKWebView`/Capacitor, ~1-2 semaines, 99 $/an, revue App Store, releases à perpétuité), et l'intent doit appeler l'API HTTP directement — pas la WebView — sinon Siri ne peut pas répondre application fermée.

**Deux réserves de confiance signalées par l'étude**, à retester avant toute décision d'investissement :
- Que les App Actions soient cassées sous Gemini vient de fils de support développeurs ; **Google n'a ni confirmé ni démenti**. Un test terrain sur un appareil Gemini-only trancherait.
- L'exclusion des PWA du framework App Intents est une **déduction cohérente** (framework Swift lié à un bundle signé) appuyée par des sources secondaires concordantes, mais **sans doc Apple l'énonçant explicitement**.

**Conséquence produit, après la seconde étude** : l'ajout par la parole passe par le pont vers la liste que l'assistant Google alimente déjà (FR-31), avec la dictée système + partage en repli (FR-46, FR-33). Le dashboard n'a finalement pas de capacité vocale. Le serveur MCP (FR-36 à FR-39) reste le seul chemin *officiel* par lequel un assistant grand public pourrait un jour toucher la liste.

### Seconde étude — le pont Google Keep (a conduit à réhabiliter FR-31)

Florian ayant maintenu l'exigence, une seconde étude a porté uniquement sur les **chemins détournés**, le nœud du problème étant la capture d'un **paramètre en texte libre** (« poivrons ») — une phrase déclencheuse fixe ne sert à rien ici.

**Le mécanisme retenu** : la reconnaissance vocale n'est pas la nôtre. « Ok Google, ajoute des poivrons à la liste de courses » fonctionne nativement, en français, sur enceinte, et Google dépose l'article dans une note **Google Keep**. NutriClaude ne construit qu'un **pont** : compte Google dédié ajouté comme collaborateur sur la note, récupération périodique via `gkeepapi` (bibliothèque non officielle, authentification par *master token*), insertion dans la liste, puis marquage de l'item côté Keep pour éviter les doublons. Latence dictée par la fréquence de récupération ; ~60 s est raisonnable.

**Chemins écartés, et pourquoi :**

| Chemin | Verdict |
|---|---|
| **IFTTT** — trigger « Say a phrase with a text ingredient » | **Mort le 31/08/2022.** Ne subsiste que « Activate scene », phrase exacte. **Piège documentaire majeur** : les dizaines de tutoriels encore en ligne décrivent tous l'état antérieur |
| Zapier / Make / n8n | Pages Assistant zombies, héritées du même canal coupé en 2022 |
| **Programme « fournisseur de liste tiers »** (AnyList, Bring!, Any.do) | **Fermé le 20/06/2023**, confirmé par AnyList et Bring! eux-mêmes. Keep est le seul fournisseur restant |
| Bring! / AnyList comme pont | Leurs API non officielles vivent, mais **Google ne peut plus y écrire par la voix** → pont sans entrée |
| Google Home — automatisations / script editor | Starter `OkGoogleEvent` en **comparaison exacte**, aucune action HTTP. Pas de texte libre |
| Home Assistant | L'intégration HA↔Google est **smart-home only**. Le texte libre ne passe que par *Assist*, l'assistant de HA, pas par « Ok Google » |
| API Keep **officielle** | Réservée à Google Workspace Business/Enterprise/Education, activation par admin de domaine. Inaccessible à un compte `@gmail.com` |
| Google Tasks | Chemin officiel et stable, mais la phrase devient « rappelle-moi d'acheter… ». Substitut dégradé ; ratés Gemini/Tasks rapportés depuis février 2026 |

**Fragilités connues, à l'origine de FR-47 à FR-49 et NFR-12 :**
- Le *master token* a une **portée totale et non configurable** sur le compte → compte dédié obligatoire, jamais un compte personnel du foyer. C'est aussi ce qui contient le risque de suspension pour usage automatisé d'une API interne.
- Il peut mourir sans prévenir : changement de mot de passe, révocation OAuth, challenge de sécurité, IP serveur inhabituelle. **Point de casse n°1.**
- `gkeepapi` n'est ni supporté ni endossé par Google — c'est de la rétro-ingénierie d'une API interne. Google a déjà cassé IFTTT (2022) et les fournisseurs tiers (2023).
- **Migration Assistant → Gemini for Home en cours en France** : les listes continuent d'être écrites dans Keep, mais le parsing français peut bouger (nom de la note, pluriels, « des poivrons » vs « poivrons »). Prévoir normalisation et recherche souple du nom de note — ne rien coder en dur.

**À tester avant de construire** (non vérifiable depuis la documentation) : nom exact de la note créée en français par l'enceinte de Florian · comportement de la bibliothèque sur une note *partagée* plutôt que possédée · survie du token sur plusieurs semaines depuis une IP de serveur.

**Sources secondes étude** : [IFTTT — changements Google Assistant](https://ifttt.com/explore/google-assistant-changes) · [AnyList — fin de l'intégration](https://help.anylist.com/articles/google-assistant-overview/) · [Bring! — fin du support tiers](https://www.getbring.com/blog-posts/google-assistant-no-more-support-for-third-party-list-apps) · [Google — listes de courses (FR)](https://support.google.com/assistant/answer/14171370?hl=fr) · [API Keep — restrictions Workspace](https://developers.google.com/workspace/keep/api/guides) · [gkeepapi](https://github.com/kiwiz/gkeepapi) · [OkGoogleEvent — Home APIs](https://developers.home.google.com/automations/schema/reference/entity/assistant/ok_google_event)

**Sources principales** : [sunset Conversational Actions](https://developers.google.com/assistant/ca-sunset) · [BII reference Productivity](https://developer.android.com/reference/app-actions/built-in-intents/productivity) · [AppFunctions](https://developer.android.com/ai/appfunctions) · [Gemini Spark custom apps](https://support.google.com/gemini/answer/17209137) · [Google Home APIs](https://developers.home.google.com/apis) · [App Intents — WWDC26](https://developer.apple.com/videos/play/wwdc2026/343/) · [Web Share Target](https://developer.chrome.com/docs/android/trusted-web-activity/web-share-target)

## 6. Sujets non traités par la source d'origine

Vie privée / RGPD / statut des données de santé · rétention et suppression des données · fonctionnement hors-ligne (pourtant critique en supermarché) · objectifs de performance ou de volumétrie chiffrés · coûts d'infrastructure et d'API Claude · gestion des erreurs, pannes OFF, quotas · accessibilité · Android / web · internationalisation (le français est câblé jusque dans l'index full-text Postgres) · onboarding d'un second membre · profil enfant et allergies · métriques de rétention produit · « why now » explicite · analyse concurrentielle nommée.
