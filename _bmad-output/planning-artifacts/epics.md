---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-nutriclaude-2026-07-21/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-nutriclaude-2026-07-23/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md
---

# NutriClaude - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for NutriClaude, decomposing the requirements from the PRD, the UX Design contract (DESIGN.md + EXPERIENCE.md) and the Architecture Spine into implementable stories.

> **Cadrage produit.** La liste de courses *est* le produit : une donnée avec cinq surfaces de rang égal (dashboard cuisine, assistant Google, téléphone PWA, Claude/MCP, web). Les deux écarts structurants sont le **hors-ligne** et **l'API-contrat** — ils ne s'ajoutent pas à l'existant, ils en changent la construction. L'ordre d'arrivée du PRD (§9) est en Lots 0→4 ; il servira de squelette au découpage en epics.

## Requirements Inventory

### Functional Requirements

**A. La liste de courses**

- **FR-1** — Le foyer dispose d'une liste de courses unique et partagée : toute surface voit et modifie la même liste.
- **FR-2** — La liste s'affiche groupée par rayon, les groupes ordonnés selon le parcours physique du magasin, chaque groupe identifié par son nom et son icône.
- **FR-3** — Un article a deux états (*à acheter* / *acheté*) ; basculer se fait en une seule action, **dans les deux sens**. Les articles achetés restent consultables et récupérables.
- **FR-4** — Un article peut être ajouté avec un nom, une quantité et une unité ; le rayon est déterminé automatiquement et reste corrigeable.
- **FR-5** — Ajouter un article déjà présent (même nom, même unité) **additionne les quantités** au lieu de créer un doublon — **quelle que soit la surface d'ajout**, pas seulement à la génération.
- **FR-6** — Un article peut être supprimé, distinctement du fait de le cocher.
- **FR-7** — Chaque article conserve sa provenance : recette d'origine ou ajout manuel, surface d'arrivée, membre qui l'a ajouté.
- **FR-8** — Les articles achetés peuvent être archivés d'un geste, et la liste entièrement vidée, avec confirmation.
- **FR-9** — Les articles au rayon indéterminé sont regroupés dans un groupe « À classer » visible, jamais silencieusement masqué.
- **FR-10** — Une modification faite depuis une surface apparaît sur les autres sans action de l'utilisateur.
- **FR-52** — Les quantités s'expriment dans un **vocabulaire d'unités fermé** (g, kg, ml, L, pièce, cs, cc, pincée). Deux unités différentes ne sont jamais additionnées ni converties. Les quantités mises à l'échelle sont arrondies à une valeur achetable.

**B. Le classement par rayon**

- **FR-11** — Chaque foyer définit ses propres rayons (nom, icône, position) ; un jeu par défaut est créé à l'initialisation du foyer.
- **FR-12** — Le parcours se réordonne **par manipulation directe** (glisser / monter-descendre), pas par saisie d'un numéro d'ordre.
- **FR-13** — Le foyer définit des règles mot-clé → rayon ; le classement résout la règle dont le mot-clé est le plus spécifique.
- **FR-14** — Corriger le rayon d'un article propose de mémoriser la correction comme règle (boucle d'apprentissage du produit).

**C. Alimenter la liste depuis le menu**

- **FR-15** — Le foyer planifie un menu hebdomadaire en assignant des recettes à une grille jour × repas, avec le nombre de personnes prévues.
- **FR-16** — La liste se génère depuis le menu d'une semaine : ingrédients non optionnels, quantités mises à l'échelle, doublons agrégés, rayons résolus.
- **FR-17** — La génération n'écrase pas les ajouts manuels ni les articles achetés ; elle indique combien d'articles ont été ajoutés.
- **FR-18** — Le foyer tient un répertoire de recettes (titre, description, portions, temps, instructions en lecture, ingrédients éditables et réordonnables).
- **FR-51** — Les recettes portent des **étiquettes libres** éditables ; le répertoire se filtre par étiquette et se cherche par titre.

**D. L'API — le contrat commun**

- **FR-19** — Une interface programmatique stable expose les opérations de la liste (lire groupée par rayon, ajouter, cocher, décocher, supprimer, archiver, vider).
- **FR-20** — Cette interface applique les mêmes règles métier que l'écran (agrégation, résolution rayon, isolation foyer). Aucune surface ne peut produire un état que les autres jugeraient invalide.
- **FR-21** — Chaque appareil/client s'authentifie avec une identité propre, révocable individuellement.
- **FR-22** — Un consommateur peut être notifié des changements sans interroger en boucle.
- **FR-23** — Le contrat est versionné : une évolution ne casse pas un consommateur existant sans préavis.

**E. Le dashboard maison**

- **FR-24** — Le dashboard affiche la liste à acheter, groupée par rayon, **lisible à distance** sur un écran fixe.
- **FR-25** — Un article peut être coché comme acheté d'un geste depuis le dashboard.
- **FR-26** — Un article peut être supprimé depuis le dashboard.
- **FR-27** — Le dashboard reflète les changements survenus ailleurs sans intervention ni rechargement.
- **FR-28** — Le dashboard est rattaché au foyer une fois pour toutes et **ne demande jamais de connexion**.
- **FR-44** — Le dashboard affiche également les repas planifiés du jour, à côté de la liste.

**F. La voix**

- **FR-29** — Un membre peut ajouter un article **en parlant**, sans clavier (assistant Google FR-31 + dictée système FR-46).
- **FR-31** — Un membre dit à l'assistant Google « Ok Google, ajoute des poivrons à la liste de courses » et l'article arrive dans NutriClaude, classé par rayon (pont non officiel).
- **FR-32** — Aucune surface ne demande de se connecter au moment de parler ; le rattachement au foyer est fait en amont.
- **FR-46** — Sur téléphone, l'ajout par la parole passe par la dictée système + partage vers NutriClaude — identiquement iPhone et Android.
- **FR-47** — Le pont est **idempotent** ; il **marque sans supprimer** côté Google et purge périodiquement les items marqués.
- **FR-48** — **Dégradation gracieuse** : si le pont est rompu, la commande vocale continue, les articles s'accumulent côté Google et sont récupérés au rétablissement, sans perte.
- **FR-49** — **Le foyer est prévenu** quand le pont est rompu, sans le constater au supermarché ; le rétablissement est documenté, sans redéploiement.
- **FR-50** — **Le pont est unidirectionnel** (Google → NutriClaude) ; la lecture native Google n'est pas fiable et n'est pas utilisée.

**G. Les surfaces mobiles**

- **FR-33** — NutriClaude est une **cible de partage système** : partager un texte l'ajoute à la liste, avec résolution du rayon.
- **FR-35** — La liste s'installe comme une application (PWA) sur iPhone et Android, lançable depuis l'écran d'accueil et fonctionnant hors ligne.

**H. Le pilotage conversationnel**

- **FR-36** — Depuis Claude : consulter la liste, ajouter, cocher, supprimer.
- **FR-37** — Depuis Claude : consulter/créer des recettes, consulter/modifier le menu.
- **FR-38** — Depuis Claude : consulter/modifier les rayons et les règles de classement.
- **FR-39** — Les actions Claude s'exercent dans le périmètre du foyer, jamais au-delà (exigence de sécurité).

**I. Le foyer**

- **FR-40** — À l'inscription, un utilisateur crée un foyer ou rejoint un foyer existant via un code d'invitation.
- **FR-41** — Un membre peut **générer un code d'invitation depuis l'application** ; le code a une durée et un nombre d'usages limités.
- **FR-42** — Un membre dispose d'un écran pour son prénom affiché, les autres membres, et les appareils rattachés.
- **FR-43** — Recettes, rayons, menu et liste sont partagés entre tous les membres du foyer.

**Exigences retirées (identifiants non réattribués, à ne PAS traiter en story) :**

- ~~**FR-30**~~ — Consulter la liste à voix haute. *Retirée : non réalisable et trompeuse (le pont vide la liste Google au fur et à mesure).*
- ~~**FR-34**~~ — Widget écran d'accueil/verrouillé. *Retirée : exige un binaire natif publié (hors NFR-11).*
- ~~**FR-45**~~ — Voix sur le dashboard maison. *Retirée : l'assistant Google couvre déjà l'ajout vocal dans la maison.*

### NonFunctional Requirements

- **NFR-1** — **Hors-ligne = mode nominal.** Au supermarché : consultation, coche, décoche, ajout **sans réseau**, sans erreur ni attente ; resync au retour du réseau ; action non synchronisée visuellement distincte, sans jamais bloquer le geste suivant. Appareil de référence : **iPhone 15 Pro**.
- **NFR-2** — **Convergence entre surfaces.** Deux surfaces agissant simultanément ou hors ligne convergent vers le même état sans perte ni arbitrage demandé. Cocher/supprimer un article déjà traité ailleurs n'est pas une erreur.
- **NFR-3** — **Le magasin est le contexte de référence.** L'écran liste se conçoit pour un téléphone à une main ; **aucun défilement horizontal** sur la liste. Menu et recettes peuvent respirer au grand écran.
- **NFR-4** — **L'ajout vocal est confirmé à la voix mais arrive en différé** (< 1 min, structurel : le pont récupère par cycles). Aucune surface ne fait croire qu'un article dicté est déjà arrivé.
- **NFR-5** — **Isolation des foyers** appliquée au niveau de la donnée, jamais seulement de l'interface.
- **NFR-6** — **Un appareil n'est pas une personne** : identités d'appareil à périmètre restreint, révocables une par une, sans accès admin foyer.
- **NFR-7** — **Données personnelles** : consulter, exporter, supprimer ses données et son compte. *(Dette de conformité : aucun lot ne l'appelle en v1 — cf. §9 PRD.)*
- **NFR-8** — **Français** : interface, libellés, rayons par défaut, reconnaissance vocale. Messages techniques jamais montrés bruts.
- **NFR-9** — **Ton** : aucun jargon visible. On parle de repas, rayons, courses — jamais de synchronisation, jeton ou API. Mots bannis à l'écran : synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache.
- **NFR-10** — **Coût de possession** : l'outil tient sans entretien régulier ; toute capacité exigeant une maintenance hebdomadaire est candidate à la suppression.
- **NFR-11** — **Aucun binaire natif, aucun store en v1** : application web installable uniquement.
- **NFR-12** — **Moindre privilège pour le pont Google** : compte tiers dédié, chiffré, révocable, accès à la seule liste partagée.

### Additional Requirements

*(Exigences techniques issues de l'Architecture Spine — invariants AD-x, stack, préalables — qui structurent les epics et surtout l'Epic de socle.)*

**Nature du projet — base brownfield, application greenfield.** Le projet est mixte, et la distinction structure tout l'Epic 1 : la **base Supabase est déployée et gelée** (migration `initial_schema` jouée : 10 tables, RLS, `current_household_id()`, fonctions de résolution et de génération) — elle est conservée et n'évolue qu'en migrations additives (AR-MIGRATIONS). L'**application**, en revanche, repart d'un scaffold Next 16 neuf : le prototype généré le 2026-05-02 ne compilait pas et ~92 % de ses surfaces étaient condamnées par AD-11, AD-13 et UX-DR1. Il reste consultable dans l'historique git (`7e1a249`). Poser le socle est un *préalable*, pas un invariant → **Epic 1, Story 1**.

- **AR-SOCLE (Lot 0, bloquant tout)** — Poser un socle applicatif Next 16 neuf, correctement configuré dès l'origine plutôt que migré : Tailwind 4 natif (`@tailwindcss/postcss`, `@import "tailwindcss"`, tokens en `@theme`), `tsconfig` sans `baseUrl` (TS 6), `lib/supabase/{client,server,proxy}.ts` écrits selon les patterns courants (`await cookies()`, en-têtes anti-cache de `setAll` appliqués), contrôle d'accès en `proxy.ts` (convention Next 16), titre « NutriClaude ». **Aucun fichier `middleware.ts`, aucun résidu de configuration v3.** La base déployée n'est pas touchée.
- **AD-1** — Contrat Postgres partagé : toute règle métier vit en Postgres (RLS + contraintes + fonctions SQL). API stable = PostgREST (dont la vue `grocery_list_by_aisle`) + Realtime, versionnée. Chaque surface est un adaptateur mince.
- **AD-2** — Postgres seule autorité ; **RLS non contournable, jamais de `SUPABASE_SERVICE_KEY`** (MCP, pont, dashboard inclus). Isolation ancrée sur `current_household_id()` sur les 10 tables.
- **AD-3** — Ligne canonique unique par `(household_id, nom normalisé, unité)` ; convergence **LWW par champ** arbitrée par **horodatage d'intention client** ; suppression = tombstone `deleted_at`, jamais de DELETE dur.
- **AD-4** — Toggle `status` **idempotent** (valeur posée, pas un basculement relatif) — un basculement relatif bloque un article acheté dans son état.
- **AD-5** — **Outbox locale ordonnée** (IndexedDB), rejouée au retour réseau **et au premier plan** ; pas de Background Sync iOS ; cache de lecture jetable, repull à la réouverture.
- **AD-6** — Résolution rayon, agrégation et mise à l'échelle **autoritaires côté serveur** (fonctions SQL) ; **agrégation = UPSERT-incrémente** sur la clé canonique ; **génération non destructive**.
- **AD-7** — **Vocabulaire d'unités fermé** (g/kg/ml/L/pièce/cs/cc/pincée), sans conversion.
- **AD-8** — Propagation par **Supabase Realtime par foyer**, jamais de polling ni de reload manuel.
- **AD-9** — **Identité d'appareil scopée foyer** (`device_credentials`), révocable à l'unité (`revoked_at IS NULL` en RLS → révocation instantanée) ; périmètre restreint à la liste.
- **AD-10** — **Appairage dashboard sans login** : jeton d'appareil émis une fois par Florian, persisté sur l'écran mural, révocable depuis le web.
- **AD-11** — **Auth humaine = magic link sans mot de passe** ; construite ainsi dès l'origine, aucun chemin mot de passe n'est introduit.
- **AD-12** — **Pont Google** : ingestion unidirectionnelle, idempotente (colonne `source_ref`), device-credentialed, normalisée vers le vocabulaire fermé ; latence ~60 s structurelle ; secrets en Vault.
- **AD-13** — Client PWA en **client-direct Supabase (RLS) + outbox** ; Next 16 = **coquille PWA** (service worker, manifeste, cible de partage). Server Actions réduites à l'irréductible (callback magic-link, émission jetons/invitations).
- **AD-14** — **Shortcuts iOS = surface HTTP à identité d'appareil** (chemin « Dis Siri, ajoute X » mains-libres, indépendant de Google, sans binaire).
- **AD-15** — **Enveloppe ops** : Supabase + Vercel ; pont en Edge Function **invoquée par `pg_cron` + `pg_net`** (~60 s), jeton en **Supabase Vault** ; aucun moteur de sync tiers ; aucun outil d'observabilité en plus.
- **AD-16** — **Foyer = unité d'isolation** : un humain crée ou rejoint via magic-link + code d'invitation (durée/usages limités), émis depuis le **web** ; écran profil/membres/appareils = web ; un appareil n'est jamais promu membre.
- **AD-17** — **Posture de vérification** : (1) **tests de RLS** (isolation foyer, jeton révoqué inactif) ; (2) **tests de convergence** (LWW par champ, toggle idempotent, dédup pont par `source_ref`, UPSERT-incrément). À défaut, **déférés explicitement**.
- **AR-MIGRATIONS** — La migration initiale est **déployée en production** (projet lié, Postgres 17.6) : le schéma est gelé et n'évolue plus qu'en **migrations additives**. Discipline à établir avant le schéma du Lot 1.
- **AR-STACK** — Stack cible, réalignée sur les versions courantes au 2026-07-26 (le scaffold neuf du Lot 0 les installe nativement ; l'ancien gel sur les versions du prototype n'a plus lieu d'être) : Next.js 16.2.12, React 19.2.8, Tailwind 4.3 (via `@tailwindcss/postcss` en version identique), TypeScript 6.0.3, `@supabase/ssr` 0.12.3, `@supabase/supabase-js` 2.110.8, hébergement Vercel + Supabase.
  - **TypeScript reste en ligne 6.x** — 6.0.3 en est la dernière version. TS 7 (portage Go) demeure **volontairement non adopté** (arbitrage du 2026-07-23).
  - ⚠️ **`@supabase/ssr` 0.10.2 → 0.12.3 est un bond de deux versions mineures**, pas un patch (la ligne 0.11 n'a jamais été publiée), et il impose `supabase-js ^2.110.5` par peer dependency. À valider au scaffold : vérifier que la signature `setAll(cookies, headers)` et le pattern `getAll`/`setAll` sont inchangés avant de figer.

### UX Design Requirements

*(Éléments actionnables extraits de DESIGN.md + EXPERIENCE.md, chacun assez précis pour générer une story à critères testables. Ces exigences alimentent surtout les surfaces liste, dashboard et le socle a11y.)*

- **UX-DR1 — Système de tokens & double thème.** Implémenter les tokens (couleurs, typo, espacement, arrondis, composants) de DESIGN.md ; **deux thèmes complets clair/sombre suivant le réglage système**, remplaçant le dark `#0f1117` câblé en dur. Palette **monochrome chaude + accent abricot unique** ; toute seconde couleur chromatique et le rouge d'erreur sont bannis.
- **UX-DR2 — Discipline de l'accent abricot.** L'abricot est **réservé à l'action courses** (compteur, coche cochée, provenance active, tuile Courses, pastille « arrive… », bouton d'ajout, anneau de focus). Variante `accent-strong` #F5912B pour les **aplats** clair ; texte accent sur clair = `accent-text-light` #C2410C (AA). Jamais décoratif.
- **UX-DR3 — Composant Coche (contrôle réel + contraste).** `role="checkbox"` / `<input type="checkbox">` stylé (jamais un `<span>`) annonçant état et changement d'état ; contour vide **≥ 3:1 contre la carte** dans les deux thèmes (#83887B clair / #828AA3 sombre), **≥ 2px + fond interne** ; taille 25/26px ; zone de tap = toute la ligne (≥ 44px).
- **UX-DR4 — Carte-rayon.** En-tête : emoji du rayon (hérité `aisles.icon`, `aria-hidden`) + nom en eyebrow capitales + ratio `n/total` aligné à droite. Ordre des cartes = parcours magasin. La carte « À classer » suit les mêmes règles et n'est jamais repliée par défaut (FR-9).
- **UX-DR5 — Ligne-article & état acheté.** Coche / libellé / pastille « arrive… » / quantité (muted) / icône provenance ; **un seul hit-target par ligne**. État acheté = **barré + coche pleine** (signaux primaires, jamais la seule couleur), libellé barré en muted (reste lisible pour récupération).
- **UX-DR6 — Provenance à 4 canaux (double signal).** 🎙 vocal Google · 🗒 dictée/partage iOS · ＋ manuel · 🍴 recette. Chaque canal = **icône + équivalent texte / `aria-label`** (« ajouté à la voix », « dicté / partagé », « ajout manuel », « issu d'une recette ») ; icône ≥ 3:1, **sans opacité réductrice** ; jamais mono-canal.
- **UX-DR7 — États hors-ligne & différé.** **Bandeau hors-ligne** teinte ambre/neutre (jamais rouge, jamais alerte) sous l'en-tête ; **pastille « arrive… »** avec label texte sur toute action non synchronisée ; aucune UI ne prétend qu'un article dicté est déjà là (NFR-4).
- **UX-DR8 — Tuile Courses (dashboard).** Verre + bordure abricot + halo ; compteur géant abricot ; *peek* des derniers ajouts (≥ 18px) + horodatage de provenance (≥ 15px) ; tap → détail liste ; jamais présentée comme « à jour à la seconde ».
- **UX-DR9 — Plancher lisibilité dashboard (1 m, FR-24).** Corps dashboard **≥ 18px**, méta **≥ 15px** ; 12px **interdit** pour un texte porteur sur le dashboard.
- **UX-DR10 — Grille du menu (web).** Grille jour × repas (FR-15) **sans défilement horizontal forcé** (corrige NFR-3) ; inclut le repas « collation » aujourd'hui absent de l'écran.
- **UX-DR11 — Plancher d'accessibilité (décision ferme).** Cibles tactiles ≥ 44px ; contraste AA **sur les fonds réels** (verre/carte, jamais la base pleine) ; **anneau de focus visible** (2px + offset) sur tout élément focusable, jamais `outline:none`/`tap-highlight:transparent` sans remplacement ; `prefers-reduced-motion` (couper transitions non essentielles, garder le retour de coche immédiat) ; **compteur annoncé en entier** (« 12 articles à prendre ») ; colonne unique tenant jusqu'à 200 % de zoom sans scroll horizontal.
- **UX-DR12 — Microcopy française (voix & ton).** Tutoiement, registre familier (« la bouffe », « un truc », « Ta liste est prête ») ; **mots bannis à l'écran, toutes surfaces Claude comprise** : synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache ; `tabular-nums` sur tout chiffre.

### FR Coverage Map

**Fonctionnelles**

| FR | Epic | Note |
|---|---|---|
| FR-1 | Epic 4 | Liste unique partagée (portée au modèle canonique) |
| FR-2 | Epic 4 | Affichage groupé par rayon (vue `grocery_list_by_aisle`) |
| FR-3 | Epic 4 | Bascule acheté/à acheter idempotente (AD-4) — valeur posée, jamais un basculement relatif |
| FR-4 | Epic 2 | Résolution auto du rayon à l'ajout (moteur `resolve_aisle_id`) |
| FR-5 | Epic 4 | Agrégation UPSERT-incrémente sur clé canonique, toute surface |
| FR-6 | Epic 4 | Suppression = tombstone, distincte du cochage |
| FR-7 | Epic 4 | Provenance polymorphe (acteur + surface + recette) |
| FR-8 | Epic 4 | Archivage/vidage avec confirmation |
| FR-9 | Epic 2 | Groupe « À classer » (dépend de la résolution rayon) |
| FR-10 | Epic 4 | Propagation Realtime inter-surfaces |
| FR-11 | Epic 2 | Rayons custom + jeu par défaut à l'init foyer |
| FR-12 | Epic 2 | Réordonnancement par manipulation directe |
| FR-13 | Epic 2 | Règles mot-clé → rayon (plus spécifique gagne) |
| FR-14 | Epic 2 | Correction apprenante en silence |
| FR-15 | Epic 3 | Grille menu jour × repas + nb personnes (dont collation) |
| FR-16 | Epic 4 | Génération liste depuis menu (échelle, agrégation, rayons) |
| FR-17 | Epic 4 | Génération non destructive + compte-rendu |
| FR-18 | Epic 3 | Répertoire recettes (édition ingrédients, lecture instructions) |
| FR-19 | Epic 4 | API stable des opérations liste (PostgREST + vue) |
| FR-20 | Epic 4 | Mêmes règles métier appliquées côté serveur |
| FR-21 | Epic 5 | Identité d'appareil propre & révocable (`device_credentials`) |
| FR-22 | Epic 4 | Notification des changements sans polling (Realtime) |
| FR-23 | Epic 4 | Contrat versionné |
| FR-24 | Epic 5 | Dashboard lisible à distance |
| FR-25 | Epic 5 | Cocher depuis le dashboard |
| FR-26 | Epic 5 | Supprimer depuis le dashboard |
| FR-27 | Epic 5 | Dashboard reflète les changements sans reload |
| FR-28 | Epic 5 | Dashboard rattaché au foyer, jamais de login |
| FR-29 | Epic 6 | Ajout par la parole (Google + dictée) |
| FR-31 | Epic 6 | Pont assistant Google → liste |
| FR-32 | Epic 6 | Aucun login au moment de parler |
| FR-33 | Epic 6 | Cible de partage système |
| FR-35 | Epic 6 | PWA installable iPhone + Android, hors ligne |
| FR-36 | Epic 7 | Claude : piloter la liste |
| FR-37 | Epic 7 | Claude : recettes + menu |
| FR-38 | Epic 7 | Claude : rayons + règles |
| FR-39 | Epic 7 | Claude : périmètre strict au foyer (sécurité) |
| FR-40 | Epic 1 | Créer / rejoindre un foyer via code |
| FR-41 | Epic 1 | Générer un code d'invitation depuis l'app |
| FR-42 | Epic 1 (+ Epic 5) | Écran profil/membres (Epic 1) ; gestion appareils (Epic 5) |
| FR-43 | Epic 1 | Partage recettes/rayons/menu/liste entre membres |
| FR-44 | Epic 5 | Repas du jour sur le dashboard |
| FR-46 | Epic 6 | Dictée système + partage (iPhone/Android) |
| FR-47 | Epic 6 | Pont idempotent, marque-sans-supprimer |
| FR-48 | Epic 6 | Dégradation gracieuse du pont |
| FR-49 | Epic 6 | Foyer prévenu si le pont est rompu |
| FR-50 | Epic 6 | Pont unidirectionnel |
| FR-51 | Epic 3 | Étiquettes + filtre/recherche des recettes |
| FR-52 | Epic 4 | Vocabulaire d'unités fermé |

*Retirées (aucune story) : FR-30, FR-34, FR-45.*

**Non-fonctionnelles**

| NFR | Epic | Note |
|---|---|---|
| NFR-1 | Epic 4 (+ Epic 6) | Hors-ligne mode nominal (socle E4 ; livraison PWA E6) |
| NFR-2 | Epic 4 | Convergence sans arbitrage |
| NFR-3 | Epic 3 (+ Epic 4) | Pas de scroll horizontal : grille menu (E3), écran liste (E4) |
| NFR-4 | Epic 4 (+ Epic 6) | Différé vocal : états « arrive… » (E4) ; cycles pont (E6) |
| NFR-5 | Epic 4 (+ Epic 1) | Isolation RLS complète (E4) ; `current_household_id()` posé (E1) |
| NFR-6 | Epic 5 | Appareil ≠ personne |
| NFR-7 | — | Dette de conformité, non planifiée en v1 (décision PRD §9) |
| NFR-8 | Epic 1 | Français (transverse, cadré dès E1) |
| NFR-9 | Epic 1 | Ton / mots bannis (transverse, cadré dès E1) |
| NFR-10 | Transverse | Coût de possession (contrainte de toutes les stories) |
| NFR-11 | Epic 1 (+ Epic 6) | Posture PWA-only (E1) ; installation effective (E6) |
| NFR-12 | Epic 6 | Moindre privilège du pont Google |

## Epic List

### Epic 1 : Socle technique & foyer partageable
Poser un socle applicatif sain et transformer le « foyer » d'une intention en une réalité à deux. La base porte déjà tout le nécessaire — tables, isolation par foyer, fonction d'invitation — mais aucune surface ne l'exploite : le produit n'a physiquement qu'un seul utilisateur possible. À la fin de cet epic, l'application est construite sur un socle Next 16 neuf, l'authentification est en magic link sans mot de passe, un utilisateur crée ou rejoint un foyer via un code d'invitation cliquable, l'écran profil/membres existe, et les fondations de thème (clair/sombre) et de ton français sont posées.
**FRs covered:** FR-40, FR-41, FR-42 (profil/membres), FR-43 ; NFR-8, NFR-9, NFR-11 (posture)
**Additional:** AR-SOCLE, AR-STACK, AR-MIGRATIONS, AD-11, AD-16, AD-2 (`current_household_id()`) ; UX-DR1, UX-DR12

### Epic 2 : Le classement par rayon qui apprend
Donner au foyer un tri de liste qui suit *son* magasin et s'améliore chaque semaine sans configuration. Rayons personnalisables (nom, icône, position) avec un jeu par défaut à l'initialisation, réordonnancement par manipulation directe, moteur de résolution du rayon, règles mot-clé → rayon, correction apprenante en silence, et groupe « À classer » toujours visible. C'est la boucle d'apprentissage (FR-14) que le PRD veut voir arriver tôt.
**FRs covered:** FR-11, FR-12, FR-13, FR-14, FR-9, FR-4
**Additional:** AD-6 (`resolve_aisle_id`), AD-1 ; UX-DR4

### Epic 3 : Recettes & menu — les affluents de la liste
Constituer le répertoire qui alimente la liste. Répertoire de recettes (titre, description, portions, temps, instructions consultables en lecture, ingrédients éditables et réordonnables), étiquettes libres avec filtre et recherche, et grille de menu hebdomadaire (jour × repas + nombre de personnes, collation comprise) sans défilement horizontal. Valeur autonome : Florian construit et planifie sur le web avant même que la génération soit refondue.
**FRs covered:** FR-18, FR-51, FR-15 ; NFR-3 (grille menu)
**Additional:** AD-1 ; UX-DR10

### Epic 4 : La liste qui ne lâche jamais — hors-ligne, convergence & contrat
Le socle : le plus coûteux, le moins visible, et celui qui débloque toutes les surfaces. La liste se consulte, se coche, se décoche et s'enrichit **sans réseau**, et deux appareils convergent sans arbitrage. Modèle canonique (ligne unique par foyer+nom+unité, LWW par champ sur intention, tombstone), agrégation et génération autoritaires côté serveur et non destructives, vocabulaire d'unités fermé, provenance polymorphe, propagation Realtime — le tout exposé comme un **contrat stable versionné** consommable par les surfaces à venir.
**FRs covered:** FR-1, FR-2, FR-3, FR-5, FR-6, FR-7, FR-8, FR-10, FR-16, FR-17, FR-52, FR-19, FR-20, FR-22, FR-23 ; NFR-1, NFR-2, NFR-4, NFR-5
**Additional:** AD-2, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8, AD-13, AD-15, AD-17 ; UX-DR2, UX-DR3, UX-DR5, UX-DR6, UX-DR7, UX-DR11

### Epic 5 : Le dashboard de la cuisine
L'écran mural qui affiche la liste et le menu du jour en permanence, lisible à un mètre, sur lequel on coche et supprime — et qui **ne demande jamais de connexion**. Introduit la première identité non-humaine : un jeton d'appareil scopé au foyer, à périmètre restreint, révocable à l'unité, appairé une fois par Florian. Complète l'écran profil avec la gestion des appareils.
**FRs covered:** FR-24, FR-25, FR-26, FR-27, FR-28, FR-44, FR-21, FR-42 (appareils) ; NFR-6
**Additional:** AD-8, AD-9, AD-10 ; UX-DR8, UX-DR9

### Epic 6 : Les surfaces mobiles & l'ajout à la voix
Mettre la liste dans la poche et rendre l'ajout mains-libres. PWA installable sur iPhone et Android fonctionnant hors ligne, cible de partage système, dictée + partage. Puis le pont Google Keep : « Ok Google, ajoute des poivrons à la liste » arrive dans NutriClaude, classé par rayon — pont unidirectionnel, idempotent, à dégradation gracieuse, moindre privilège, et qui prévient le foyer quand il casse. Le seul élément dont on sait qu'il finira par casser : il arrive après le socle et ne tient jamais le produit debout.
**FRs covered:** FR-35, FR-33, FR-46, FR-29, FR-31, FR-32, FR-47, FR-48, FR-49, FR-50 ; NFR-12, NFR-1 (livraison), NFR-11 (installation)
**Additional:** AD-12, AD-13, AD-14, AD-15

### Epic 7 : Le pilotage conversationnel (Claude / MCP)
Piloter la liste, les recettes, le menu, les rayons et les règles depuis une conversation avec Claude, strictement dans le périmètre du foyer — sans jamais contourner l'isolation (pas de clé de service). Le seul chemin *officiel* par lequel un assistant grand public pourra un jour toucher la liste.
**FRs covered:** FR-36, FR-37, FR-38, FR-39
**Additional:** AD-1, AD-2, AD-9

---

## Epic 1: Socle technique & foyer partageable

Poser un socle applicatif sain et transformer le « foyer » d'une intention en une réalité à deux. La base porte déjà tout le nécessaire — tables, isolation par foyer, fonction d'invitation — mais aucune surface ne l'exploite : le produit n'a physiquement qu'un seul utilisateur possible. À la fin de cet epic, l'application est construite sur un socle Next 16 neuf, l'authentification est en magic link sans mot de passe, un utilisateur crée ou rejoint un foyer via un code d'invitation cliquable, l'écran profil/membres existe, et les fondations de thème (clair/sombre) et de ton français sont posées.

### Story 1.1 : Poser le socle applicatif Next 16

As a développeur du produit (Florian),
I want un socle applicatif neuf qui compile et passe le typage sur la stack cible (Next 16 / React 19 / Tailwind 4 / TS 6) et parle à la base déployée,
So that toute autre story se construise sur une fondation saine, sans dette de configuration héritée.

**Acceptance Criteria:**

**Given** le prototype généré le 2026-05-02, qui ne compile pas et dont ~92 % des surfaces sont condamnées par AD-11, AD-13 et UX-DR1
**When** l'application est réinitialisée depuis un scaffold Next 16 propre, le prototype restant consultable dans l'historique git
**Then** `next build` et `npm run typecheck` réussissent tous deux sans erreur ni avertissement de configuration

**Given** la base Supabase déployée et son schéma gelé (migration `initial_schema` jouée)
**When** le socle est posé
**Then** aucune migration n'est créée ni rejouée, et le schéma déployé reste l'unique source de vérité (AR-MIGRATIONS, AD-1)

**Given** le besoin de contrôle d'accès avant toute surface authentifiée
**When** un `proxy.ts` (convention Next 16) est écrit avec `/login`, `/auth/callback` et `/auth/bascule` comme seules routes publiques
**Then** un utilisateur non authentifié est redirigé vers `/login` en conservant sa destination, un utilisateur authentifié visitant une page d'authentification est renvoyé à l'accueil, et `/auth/callback` reste toujours accessible pour l'échange de code

**Given** `cookies()` asynchrone en Next 16 et les en-têtes anti-cache exigés par `@supabase/ssr`
**When** `lib/supabase/{client,server,proxy}.ts` sont écrits selon les patterns Supabase courants
**Then** le client serveur attend (`await`) `cookies()`, et les en-têtes fournis par `setAll` sont appliqués sur la réponse — **aucun cookie de session ne peut être mis en cache par un CDN** (NFR-5)

**Given** le socle posé
**When** l'application démarre
**Then** elle affiche « NutriClaude », Tailwind 4 est configuré nativement (`@tailwindcss/postcss`, `@import "tailwindcss"`), le `tsconfig` est sans `baseUrl`, et **il ne subsiste aucun fichier `middleware.ts` ni aucun résidu de configuration Tailwind v3**

### Story 1.2 : Authentification par magic link sans mot de passe

As a membre du foyer,
I want me connecter par un simple lien envoyé par email, sans mot de passe,
So that je n'aie rien à retenir ni à configurer — le test d'acceptation « elle ne configure rien ».

**Acceptance Criteria:**

**Given** un socle applicatif sans authentification
**When** l'authentification est réalignée sur Supabase Auth en magic link (AD-11) et le chemin mot de passe retiré
**Then** aucun écran ne demande ni ne crée de mot de passe

**Given** un utilisateur qui saisit son email sur l'écran de connexion
**When** il valide
**Then** un email contenant un lien de connexion lui est envoyé, et un message français lui indique d'aller consulter sa boîte (sans jargon technique, NFR-8/NFR-9)

**Given** un lien de connexion valide reçu par email
**When** l'utilisateur l'ouvre et que `auth/callback` traite le retour
**Then** il est authentifié et redirigé vers l'application ; un lien expiré ou déjà utilisé affiche un message clair et propose d'en redemander un

**Given** un utilisateur authentifié
**When** sa session est active
**Then** `current_household_id()` résout son foyer depuis son profil (`profiles.id = auth.uid()`), fondation de l'isolation (AD-2)

### Story 1.3 : Créer un foyer à l'inscription

As a nouvel utilisateur sans foyer,
I want créer mon foyer au moment de mon inscription,
So that je dispose d'un espace partagé où vivront la liste, les recettes, les rayons et le menu.

**Acceptance Criteria:**

**Given** un utilisateur authentifié dont le profil n'est rattaché à aucun foyer
**When** il choisit « créer un foyer » et confirme
**Then** un foyer est créé et son profil y est rattaché en une seule opération atomique (`create_household_with_profile`), via une migration additive respectant la discipline de migrations établie ici (AR-MIGRATIONS)

**Given** un foyer fraîchement créé
**When** l'utilisateur accède à l'application
**Then** il est reconnu comme membre de ce foyer et l'isolation RLS s'applique (aucune donnée d'un autre foyer n'est lisible — NFR-5)

**Given** un utilisateur qui a déjà un foyer
**When** il se reconnecte
**Then** aucun nouvel appel de création n'est déclenché et il retrouve son foyer existant

*Note : l'amorçage du jeu de rayons par défaut (FR-11) est traité en Epic 2, pour les foyers créés ici comme pour les existants.*

### Story 1.4 : Générer un code d'invitation

As a membre d'un foyer (Florian),
I want générer un code d'invitation depuis l'application et le partager,
So that ma conjointe puisse rejoindre le foyer — aujourd'hui la fonction existe en base mais aucun bouton ne l'appelle.

**Acceptance Criteria:**

**Given** un membre d'un foyer sur la surface web
**When** il demande « inviter quelqu'un »
**Then** un code d'invitation est généré (`generate_household_invite`) avec une durée de validité et un nombre d'usages limités, et affiché de façon partageable

**Given** un code généré
**When** le membre consulte l'invitation
**Then** le code, sa date d'expiration et son nombre d'usages restants sont lisibles, sans aucun jargon technique

**Given** un membre non autorisé ou une identité d'appareil (non-humaine)
**When** une génération de code est tentée
**Then** elle est refusée — seul un membre humain du foyer peut émettre une invitation (AD-9/AD-16)

### Story 1.5 : Rejoindre un foyer via un code d'invitation

As a nouvel utilisateur invité (la conjointe),
I want rejoindre un foyer existant en saisissant le code reçu,
So that je partage la liste et tout le reste sans rien avoir à configurer.

**Acceptance Criteria:**

**Given** un utilisateur authentifié sans foyer et un code d'invitation valide
**When** il saisit le code et confirme
**Then** son profil est rattaché au foyer correspondant (`redeem_household_invite`) et il accède immédiatement aux données partagées du foyer (FR-43)

**Given** un code expiré, épuisé (usages atteints) ou inexistant
**When** l'utilisateur le saisit
**Then** un message clair en français explique que le code n'est plus valable et invite à en redemander un, sans exposer d'erreur technique

**Given** un code valablement utilisé jusqu'à sa limite d'usages
**When** un usage supplémentaire est tenté
**Then** il est refusé et le compteur d'usages ne devient jamais négatif

### Story 1.6 : Écran profil & membres du foyer

As a membre du foyer,
I want consulter et modifier mon prénom affiché et voir les autres membres,
So that le foyer soit lisible comme un espace partagé à plusieurs personnes.

**Acceptance Criteria:**

**Given** un membre authentifié rattaché à un foyer
**When** il ouvre l'écran profil
**Then** il voit son prénom affiché, modifiable, et la liste des autres membres du foyer (FR-42, FR-43)

**Given** un membre qui modifie son prénom affiché
**When** il enregistre
**Then** le nouveau prénom est persisté et visible par les autres membres

**Given** l'écran profil
**When** il est affiché en v1
**Then** la zone « appareils rattachés » est présente mais annoncée comme à venir (sa gestion réelle arrive avec les identités d'appareil de l'Epic 5) — aucune fonctionnalité d'appareil n'est promise ici

**Given** n'importe quel libellé de cet écran
**When** il est rendu
**Then** il respecte le ton français familier et n'affiche aucun mot banni (synchronisation, jeton, API, etc. — NFR-9)

### Story 1.7 : Fondations de thème clair/sombre & de ton

As a membre du foyer,
I want que l'application suive le thème clair ou sombre de mon système et parle un français chaleureux sans jargon,
So that elle soit lisible en plein soleil comme le soir, et jamais intimidante.

**Acceptance Criteria:**

**Given** un socle applicatif sans système de thème
**When** le système de tokens de DESIGN.md (couleurs, typo, espacement, arrondis) est mis en place avec deux thèmes complets clair et sombre
**Then** l'application suit automatiquement le réglage clair/sombre du système, sans thème unique câblé en dur (UX-DR1)

**Given** la palette du produit
**When** les tokens sont appliqués
**Then** l'accent abricot est disponible comme couleur unique réservée à l'action courses, aucune seconde couleur chromatique ni rouge d'erreur n'est introduite, et `tabular-nums` est la règle pour les chiffres (UX-DR2/UX-DR12)

**Given** l'absence actuelle de `error.tsx` / `not-found.tsx`
**When** ces fichiers sont ajoutés
**Then** une erreur ou une page introuvable affiche un message français sans jargon, jamais un message technique brut (NFR-8)

**Given** la contrainte NFR-11 (aucun binaire natif, aucun store)
**When** les fondations sont posées
**Then** aucune dépendance native n'est introduite ; l'installation PWA effective reste du ressort de l'Epic 6

---

## Epic 2: Le classement par rayon qui apprend

Donner au foyer un tri de liste qui suit *son* magasin et s'améliore chaque semaine sans configuration. Rayons personnalisables (nom, icône, position) avec un jeu par défaut à l'initialisation, réordonnancement par manipulation directe, moteur de résolution du rayon côté serveur, règles mot-clé → rayon, correction apprenante en silence, et groupe « À classer » toujours visible. C'est la boucle d'apprentissage (FR-14) que le PRD veut voir arriver tôt. Le moteur (fonctions SQL) est bâti une fois et réutilisé par la liste hors-ligne de l'Epic 4.

### Story 2.1 : Amorcer un jeu de rayons par défaut

As a membre d'un foyer,
I want que mon foyer dispose dès le départ d'un jeu de rayons français prêt à l'emploi,
So that la liste soit triée par rayon sans que personne n'ait à tout configurer d'abord.

**Acceptance Criteria:**

**Given** un foyer nouvellement créé (Epic 1) sans aucun rayon
**When** le foyer est initialisé
**Then** un jeu de rayons par défaut en français (nom, icône emoji, position dans le parcours) est créé pour ce foyer (FR-11), via une migration/fonction additive

**Given** un foyer existant antérieur à cette story et dépourvu de rayons
**When** l'amorçage est appliqué
**Then** il reçoit le même jeu par défaut sans dupliquer des rayons déjà présents

**Given** les rayons par défaut
**When** ils sont créés
**Then** chacun a une position d'ordre distincte reflétant un parcours de magasin plausible, et l'ensemble est rattaché au seul foyer concerné (isolation RLS, NFR-5)

### Story 2.2 : Gérer ses rayons

As a membre configurant le foyer (Florian),
I want créer, renommer, ré-iconifier et supprimer des rayons,
So that la liste reflète les rayons réels de mon magasin.

**Acceptance Criteria:**

**Given** l'écran des rayons sur la surface web
**When** Florian ajoute un rayon avec un nom et une icône emoji
**Then** le rayon est créé, rattaché au foyer, et placé en fin de parcours par défaut

**Given** un rayon existant
**When** Florian modifie son nom ou son icône
**Then** la modification est persistée et se reflète partout où le rayon apparaît

**Given** un rayon que Florian supprime
**When** il confirme la suppression
**Then** le rayon est retiré et les articles qui y étaient rattachés basculent vers « À classer » (FR-9) plutôt que de disparaître ou de casser l'affichage

**Given** un foyer dont tous les rayons ont été supprimés
**When** l'écran des rayons s'affiche
**Then** il montre un état vide lisible en français invitant à créer un rayon, jamais une page blanche ni un message technique (NFR-8)

### Story 2.3 : Réordonner le parcours par manipulation directe

As a membre configurant le foyer (Florian),
I want réordonner mes rayons en les manipulant directement,
So that l'ordre des rayons corresponde à l'ordre où je traverse physiquement le magasin — sans saisir de numéro.

**Acceptance Criteria:**

**Given** la liste des rayons du foyer
**When** Florian déplace un rayon par glisser ou par un contrôle monter/descendre
**Then** le nouvel ordre est persisté, **sans jamais demander la saisie d'un numéro d'ordre** (FR-12)

**Given** un parcours réordonné
**When** la liste de courses est affichée par rayon
**Then** les groupes apparaissent dans l'ordre du parcours défini (FR-2), pas par ordre alphabétique

**Given** une réorganisation en cours
**When** Florian relâche un rayon à une nouvelle position
**Then** l'ordre reste cohérent (positions uniques, aucun rayon perdu ou dupliqué)

### Story 2.4 : Définir des règles mot-clé → rayon

As a membre configurant le foyer (Florian),
I want associer des mots-clés à des rayons (« poulet » → Boucherie),
So that les articles soient classés automatiquement selon leur nom.

**Acceptance Criteria:**

**Given** l'écran des règles sur la surface web (surface de Florian)
**When** Florian crée une règle associant un mot-clé à un rayon
**Then** la règle est persistée et rattachée au foyer

**Given** plusieurs règles dont les mots-clés sont contenus dans le nom d'un article
**When** le classement s'applique
**Then** c'est la règle dont le mot-clé est **le plus spécifique** qui l'emporte (FR-13)

**Given** les règles apprises ou saisies
**When** Florian consulte l'écran des règles
**Then** il peut les voir et les révoquer ; cette gestion reste une surface de Florian et n'est jamais exposée à la conjointe (test d'acceptation, NFR-9)

### Story 2.5 : Résoudre automatiquement le rayon d'un article ajouté

As a membre qui ajoute un article,
I want que son rayon soit déterminé automatiquement à partir de son nom,
So that je n'aie pas à ranger manuellement chaque article — tout en gardant la main pour corriger.

**Acceptance Criteria:**

**Given** un article ajouté à la liste avec un nom
**When** la résolution de rayon s'exécute (fonction serveur `resolve_aisle_id`, autoritaire — AD-6)
**Then** le rayon est déterminé à partir des règles du foyer et posé sur l'article (FR-4) — **tout** chemin d'ajout passe par la résolution, y compris l'ajout manuel

**Given** un article dont aucun mot-clé ne correspond à une règle
**When** la résolution s'exécute
**Then** l'article reste sans rayon (`aisle_id` nul) et sera regroupé dans « À classer » (FR-9), jamais rattaché arbitrairement

**Given** la fonction de résolution
**When** elle est appelée par n'importe quelle surface (ajout manuel, génération, plus tard le pont)
**Then** elle produit le même résultat, car elle est unique et côté serveur (AD-1/AD-6) — aucune surface ne réimplémente sa propre résolution

### Story 2.6 : Groupe « À classer » toujours visible

As a membre consultant la liste,
I want voir un groupe « À classer » pour les articles au rayon indéterminé,
So that aucun article ne soit silencieusement masqué et que je puisse le ranger.

**Acceptance Criteria:**

**Given** un ou plusieurs articles sans rayon résolu
**When** la liste s'affiche groupée par rayon
**Then** ces articles apparaissent dans un groupe « À classer » visible, en tant que groupe de première classe (FR-9), jamais replié par défaut ni masqué

**Given** un groupe « À classer » vide
**When** la liste s'affiche
**Then** le groupe n'occupe pas d'espace inutile, mais il réapparaît dès qu'un article non résolu existe

**Given** le composant carte-rayon
**When** un rayon (y compris « À classer ») est rendu
**Then** il présente son icône emoji (`aria-hidden`), son nom en eyebrow et le ratio `n/total` (UX-DR4) — ce composant est réutilisable par la liste hors-ligne de l'Epic 4

### Story 2.7 : Correction de rayon apprenante en silence

As a membre qui déplace un article vers le bon rayon,
I want que cette correction s'applique et se mémorise pour l'avenir,
So that la même erreur ne se reproduise plus — sans que j'aie à comprendre la notion de « règle ».

**Acceptance Criteria:**

**Given** un article rangé dans un rayon incorrect (ou dans « À classer »)
**When** un membre le déplace vers un autre rayon
**Then** l'article change de rayon immédiatement (FR-4 corrigeable) et une règle mot-clé → rayon correspondante est mémorisée **en silence** (FR-14), sans question posée

**Given** une correction qui a créé une règle
**When** un futur article contenant le même mot-clé est ajouté
**Then** il est classé directement dans le bon rayon, sans nouvelle correction

**Given** la conjointe qui corrige un rayon au supermarché
**When** la correction s'applique
**Then** aucune notion de « règle » ni aucun réglage n'est montré — l'apprentissage est invisible pour elle ; seule la surface web de Florian expose et permet de révoquer les règles apprises (FR-14, test d'acceptation)

---

## Epic 3: Recettes & menu — les affluents de la liste

Constituer le répertoire qui alimente la liste. Répertoire de recettes (titre, description, portions, temps, instructions consultables en lecture, ingrédients éditables et réordonnables), étiquettes libres avec filtre et recherche, et grille de menu hebdomadaire (jour × repas + nombre de personnes, collation comprise) sans défilement horizontal. Valeur autonome : Florian construit et planifie sur le web avant même que la génération soit refondue. La transformation menu → liste (FR-16/FR-17) appartient au socle (Epic 4).

### Story 3.1 : Créer et éditer une recette

As a membre configurant le foyer (Florian),
I want créer une recette avec son titre, sa description, ses portions, son temps et ses instructions,
So that j'alimente un répertoire réutilisable pour planifier les repas.

**Acceptance Criteria:**

**Given** l'écran des recettes sur la surface web
**When** Florian crée une recette en renseignant titre, description, nombre de portions, temps et instructions
**Then** la recette est persistée, rattachée au foyer (partagée entre membres — FR-43), et apparaît dans le répertoire

**Given** une recette existante
**When** Florian modifie l'un de ses champs (titre, description, portions, temps, instructions)
**Then** la modification est enregistrée sans avoir à recréer la recette

**Given** le champ « portions »
**When** il est renseigné
**Then** il porte une valeur numérique exploitable plus tard pour la mise à l'échelle des quantités (FR-16, consommée en Epic 4)

**Given** un foyer dont le répertoire de recettes est vide
**When** l'écran des recettes s'affiche
**Then** il montre un état vide lisible invitant à créer une première recette, et pendant le chargement un squelette plutôt qu'un écran blanc ou un message d'erreur

### Story 3.2 : Gérer les ingrédients d'une recette

As a membre configurant le foyer (Florian),
I want ajouter, modifier, réordonner et retirer les ingrédients d'une recette,
So that la liste d'ingrédients soit juste sans devoir tout supprimer et recréer.

**Acceptance Criteria:**

**Given** une recette
**When** Florian ajoute un ingrédient avec quantité, unité, nom, mot-clé de rayon et caractère optionnel
**Then** l'ingrédient est rattaché à la recette avec tous ces attributs

**Given** un ingrédient existant
**When** Florian édite l'un de ses attributs
**Then** la modification est appliquée en place, sans suppression-recréation (FR-18)

**Given** une unité d'ingrédient
**When** Florian la choisit
**Then** elle provient du **vocabulaire d'unités fermé** (g, kg, ml, L, pièce, cs, cc, pincée — FR-52/AD-7), pour que la génération puisse agréger correctement plus tard

**Given** plusieurs ingrédients dans une recette
**When** Florian les réordonne
**Then** le nouvel ordre est persisté et respecté à l'affichage (FR-18)

### Story 3.3 : Consulter une recette en lecture

As a membre du foyer,
I want lire une recette avec ses instructions rendues proprement,
So that je puisse la suivre en cuisinant, sans avoir à ouvrir un écran d'édition.

**Acceptance Criteria:**

**Given** une recette du répertoire
**When** un membre l'ouvre en lecture
**Then** son titre, sa description, ses portions, son temps, sa liste d'ingrédients et ses **instructions sont rendus lisiblement** (FR-18), pas dans une zone d'édition

**Given** les instructions d'une recette
**When** elles sont affichées
**Then** leur mise en forme est préservée à la lecture (retours à la ligne / étapes), sans exposer de balisage brut

**Given** une recette sans description ou sans instructions
**When** elle est consultée
**Then** l'affichage reste propre, sans champ vide disgracieux ni erreur

### Story 3.4 : Étiquettes, filtre et recherche du répertoire

As a membre configurant le foyer (Florian),
I want étiqueter mes recettes et filtrer/chercher dans le répertoire,
So that assigner une recette au menu ne devienne pas un défilement dans une liste qui grossit chaque semaine.

**Acceptance Criteria:**

**Given** une recette
**When** Florian lui ajoute, modifie ou retire des étiquettes libres (« rapide », « batch-cooking », « végé »…)
**Then** les étiquettes sont persistées et éditables (FR-51)

**Given** un répertoire de recettes étiquetées
**When** Florian filtre par étiquette
**Then** seules les recettes portant l'étiquette choisie sont affichées

**Given** un répertoire de recettes
**When** Florian cherche par titre
**Then** les recettes dont le titre correspond sont affichées (FR-51), la recherche restant en français (NFR-8)

**Given** un filtre ou une recherche qui ne renvoie aucune recette
**When** le résultat s'affiche
**Then** il l'annonce en français simple et propose de réinitialiser le filtre, sans laisser croire que le répertoire est vide

### Story 3.5 : Planifier le menu de la semaine sans défilement horizontal

As a membre configurant le foyer (Florian),
I want une grille de menu jour × repas lisible et confortable,
So that je planifie la semaine sans me battre avec un défilement horizontal forcé.

**Acceptance Criteria:**

**Given** l'écran du menu
**When** il s'affiche
**Then** il présente une grille jour × repas incluant le repas **collation** — déjà admis par la base (`meal_type` accepte `snack`) et donc rendu à l'écran (FR-15)

**Given** la grille du menu affichée sur un écran contraint
**When** elle est rendue
**Then** elle **n'impose aucun défilement horizontal forcé** (NFR-3/UX-DR10), quelle que soit la largeur d'écran

**Given** une semaine donnée
**When** Florian navigue entre les semaines
**Then** la grille reflète le menu de la semaine sélectionnée sans perdre les autres semaines

**Given** une semaine sans aucun repas planifié
**When** la grille du menu s'affiche
**Then** les cases vides sont lisibles et directement actionnables, sans message d'erreur ni zone ambiguë

### Story 3.6 : Assigner recettes et nombre de personnes aux cases du menu

As a membre configurant le foyer (Florian),
I want assigner des recettes aux cases de la grille avec un nombre de personnes,
So that le menu soit prêt à générer la liste (en Epic 4).

**Acceptance Criteria:**

**Given** une case (jour × repas) de la grille et un répertoire de recettes
**When** Florian y assigne une recette et indique le nombre de personnes prévues
**Then** l'assignation est persistée dans `meal_plan_entries` avec le nombre de personnes (FR-15)

**Given** une même recette déjà assignée à la même case (jour × repas)
**When** une assignation identique est retentée
**Then** elle est empêchée par la contrainte `unique(household_id, meal_date, meal_type, recipe_id)` — pas de doublon d'assignation (AD-6)

**Given** une case assignée
**When** Florian retire la recette ou change le nombre de personnes
**Then** la modification est persistée et la case reflète l'état à jour

**Given** un menu assigné
**When** Florian consulte la grille
**Then** chaque case montre la recette assignée et son nombre de personnes, prête à alimenter la génération de la liste de l'Epic 4

---

## Epic 4: La liste qui ne lâche jamais — hors-ligne, convergence & contrat

Le socle : le plus coûteux, le moins visible, et celui qui débloque toutes les surfaces. La liste se consulte, se coche, se décoche et s'enrichit **sans réseau**, et deux appareils convergent sans arbitrage. Modèle canonique (ligne unique par foyer+nom+unité, LWW par champ sur intention, tombstone), agrégation et génération autoritaires côté serveur et non destructives, vocabulaire d'unités fermé, provenance polymorphe, propagation Realtime — le tout exposé comme un **contrat stable versionné** consommable par les surfaces à venir. À la fin, l'utilisateur ne voit *aucune fonctionnalité nouvelle* — juste une liste qui ne le lâche plus au supermarché.

### Story 4.1 : Modèle canonique de la ligne d'article & isolation RLS

As a foyer,
I want que chaque article de la liste soit une ligne unique et isolée à mon foyer,
So that il n'existe jamais de doublon à fusionner et qu'aucun autre foyer ne puisse voir ma liste.

**Acceptance Criteria:**

**Given** le schéma actuel de `grocery_list_items`
**When** il est migré vers le modèle canonique (AD-3) via une migration additive
**Then** la table porte les champs `name` (normalisé), `unit`, `quantity`, `status`, `aisle_id`, `recipe_id`, `actor_kind`, `actor_id`, `source_ref`, `intent_at`, `updated_at`, `deleted_at`, avec une contrainte **`unique(household_id, name normalisé, unit)`**

**Given** un article et une tentative d'insérer un second article de même nom normalisé et même unité dans le foyer
**When** l'insertion est tentée
**Then** la contrainte d'unicité l'empêche (base d'agrégation FR-5, aucune ligne à fusionner)

**Given** les politiques RLS ancrées sur `current_household_id()` (AD-2)
**When** un utilisateur d'un autre foyer tente de lire ou modifier ces lignes
**Then** l'accès est refusé au niveau de la donnée (NFR-5), jamais seulement à l'interface

**Given** la suppression d'un article
**When** elle est appliquée
**Then** elle se fait par tombstone (`deleted_at`), **jamais** par DELETE dur (AD-3)

### Story 4.2 : Lecture client-direct de la liste groupée par rayon

As a membre du foyer,
I want voir la liste partagée groupée par rayon, dans l'ordre du parcours,
So that je retrouve ma liste unique et triée sur n'importe quelle surface.

**Acceptance Criteria:**

**Given** la vue `grocery_list_by_aisle` et le client Supabase du navigateur (RLS-enforced)
**When** la liste est lue
**Then** elle est chargée en **client-direct** (AD-13), plus via des Server Actions `force-dynamic`, et affiche la liste unique du foyer (FR-1) groupée par rayon dans l'ordre du parcours (FR-2)

**Given** les articles non supprimés (tombstone nul)
**When** la liste est rendue
**Then** seuls les articles vivants apparaissent, groupés par rayon, « À classer » compris (réutilise le composant carte-rayon de l'Epic 2)

**Given** la lecture via le contrat
**When** une surface lit la liste
**Then** elle obtient le même état que toute autre surface (FR-20), aucune surface ne calculant son propre regroupement

### Story 4.3 : Cocher et décocher, idempotent et réversible

As a membre au supermarché,
I want cocher un article acheté et le décocher d'un geste, dans les deux sens,
So that l'état reflète mes achats sans jamais se bloquer.

**Acceptance Criteria:**

**Given** qu'une bascule relative bloquerait un article acheté dans son état
**When** `status` devient une **valeur posée** (pending/bought) sur la ligne canonique (AD-4)
**Then** cocher puis décocher fonctionne dans les deux sens (FR-3), en un seul geste

**Given** un article déjà coché sur une autre surface
**When** un membre le coche à nouveau
**Then** l'opération est **idempotente** : convergence sans conflit ni erreur (NFR-2)

**Given** un article acheté
**When** la liste est consultée
**Then** il reste consultable et récupérable (repoussé « dans le panier », pas effacé — FR-3)

### Story 4.4 : Ajouter un article avec agrégation et unités fermées

As a membre du foyer,
I want qu'ajouter un article déjà présent additionne les quantités au lieu de créer un doublon,
So that la liste reste propre quelle que soit la surface d'ajout.

**Acceptance Criteria:**

**Given** un article de même nom normalisé et même unité déjà présent
**When** un ajout survient depuis n'importe quelle surface
**Then** l'opération est un **UPSERT-incrémente** sur la clé canonique (AD-6) qui additionne les quantités (FR-5), **jamais** un INSERT nu — sur tout chemin d'ajout, manuel compris

**Given** un ajout avec une unité
**When** il est traité
**Then** l'unité provient du **vocabulaire fermé** (g, kg, ml, L, pièce, cs, cc, pincée — AD-7/FR-52) ; deux unités différentes ne sont jamais additionnées ni converties (deux lignes)

**Given** un article ajouté sans rayon explicite
**When** l'ajout est traité
**Then** le rayon est résolu par `resolve_aisle_id` (fonction serveur de l'Epic 2), et une quantité mise à l'échelle est arrondie à une valeur achetable (jamais « 1,67 oignon »)

### Story 4.5 : Supprimer, archiver les achetés, vider la liste

As a membre du foyer,
I want retirer un article, archiver les achetés et vider la liste,
So that je gère la liste sans confondre « supprimer » et « cocher ».

**Acceptance Criteria:**

**Given** un article de la liste
**When** un membre le supprime
**Then** la suppression (tombstone `deleted_at`, AD-3) est **distincte du cochage** (FR-6) et l'article disparaît de la liste vivante

**Given** des articles achetés
**When** un membre les archive d'un geste
**Then** ils sont retirés de la liste active tout en restant traçables (FR-8)

**Given** une demande de vidage complet de la liste
**When** le membre la déclenche
**Then** une **confirmation** est exigée avant que la liste soit vidée (FR-8), sans DELETE dur

### Story 4.6 : Provenance de chaque article

As a membre du foyer,
I want savoir d'où vient chaque article et qui l'a ajouté,
So that je comprenne ma liste et que la répartition par surface soit mesurable.

**Acceptance Criteria:**

**Given** un article ajouté
**When** il est créé
**Then** sa provenance est enregistrée de façon **polymorphe** : `actor_kind ∈ {profile, device}` + `actor_id`, la surface d'arrivée, et `recipe_id` s'il vient d'une recette (FR-7) — un appareil n'est jamais une FK `profiles` (AD-9)

**Given** la provenance d'un article
**When** la ligne est affichée
**Then** elle montre une icône de provenance **doublée d'un équivalent texte / `aria-label`** (＋ « ajout manuel », 🍴 « issu d'une recette » ; les canaux 🎙 vocal et 🗒 dictée se peupleront en Epic 6) — jamais mono-canal (UX-DR6), icône ≥ 3:1 sans opacité réductrice

**Given** un article issu de la génération depuis le menu
**When** il est créé
**Then** sa provenance porte la recette d'origine (`recipe_id`), corrigeant l'omission actuelle à la génération

### Story 4.7 : Générer la liste depuis le menu, sans rien écraser

As a membre planifiant la semaine,
I want générer la liste complète depuis le menu en une action,
So that le dimanche soir dure quatre minutes — sans perdre mes ajouts manuels ni mes achats.

**Acceptance Criteria:**

**Given** un menu de semaine assigné (Epic 3)
**When** la génération s'exécute
**Then** elle agrège les ingrédients non optionnels de toutes les recettes planifiées, met à l'échelle selon les personnes prévues rapportées aux portions, résout les rayons et **UPSERT-incrémente sur la clé canonique** (AD-6/FR-16)

**Given** des articles ajoutés à la main ou déjà achetés dans la liste
**When** la génération s'exécute
**Then** elle ne les **écrase jamais** (corrige le DELETE destructeur actuel) et **annonce combien d'articles ont été ajoutés** (FR-17)

**Given** un article précédemment supprimé (tombstoné) que la génération réclame
**When** la génération s'exécute
**Then** il n'est **ressuscité que si l'intention de génération est plus récente que l'intention de suppression** (LWW sur `deleted_at`, AD-3)

### Story 4.8 : Consulter la liste hors ligne

As a membre au fond du magasin sans réseau,
I want continuer à voir ma liste instantanément,
So that l'absence de réseau ne m'arrête jamais — le hors-ligne est un mode nominal.

**Acceptance Criteria:**

**Given** une liste déjà consultée et un réseau qui disparaît
**When** le membre rouvre ou consulte la liste
**Then** la dernière liste connue s'affiche **immédiatement depuis le cache local** (IndexedDB via service worker, AD-5/AD-13), sans écran blanc ni spinner plein écran (NFR-1)

**Given** aucun cache disponible
**When** la liste est ouverte hors ligne
**Then** un squelette de rayons est montré, jamais un message d'erreur

**Given** le retour au premier plan de l'app ou du réseau
**When** l'app se réveille
**Then** un repull rafraîchit le cache jetable depuis Supabase (magasin durable, AD-5)

### Story 4.9 : Écrire hors ligne via une outbox rejouée

As a membre au supermarché sans réseau,
I want cocher, décocher, ajouter et supprimer sans attendre,
So that mes gestes ne soient jamais bloqués et repartent au retour du réseau.

**Acceptance Criteria:**

**Given** une action d'écriture hors ligne (coche, ajout, suppression)
**When** elle est déclenchée
**Then** elle est appliquée en **optimiste local** et empilée dans une **outbox ordonnée** (IndexedDB, AD-5) portant un **horodatage d'intention** (heure du geste) et le champ visé, sans jamais bloquer le geste suivant (NFR-1)

**Given** des intentions en attente dans l'outbox
**When** le réseau revient ou l'app repasse au premier plan
**Then** l'outbox est **rejouée dans l'ordre** vers le contrat Postgres (pas de Background Sync iOS — resync à la réouverture assumée)

**Given** une écriture rejouée avec succès
**When** le serveur l'a acceptée
**Then** l'entrée correspondante quitte l'outbox et l'article n'est plus marqué « en attente »

### Story 4.10 : Convergence LWW par champ entre appareils

As a foyer avec deux téléphones,
I want que des modifications simultanées ou hors ligne convergent sans que personne n'arbitre,
So that la liste soit toujours cohérente sans perte ni conflit demandé.

**Acceptance Criteria:**

**Given** plusieurs intentions portant sur des champs différents d'un même article (ex. une coche de 09:00 flushée à 09:30 et une modif de quantité de 09:05)
**When** elles arrivent au serveur
**Then** le serveur garde, **par champ mutable** (`status`, `quantity`, `name`, `aisle_id`, `deleted_at`), la valeur dont l'**intention** est la plus récente — pas l'heure d'arrivée (AD-3) : la coche n'écrase pas la modif de quantité

**Given** deux surfaces qui cochent le même article, ou l'une qui supprime un article coché ailleurs
**When** les intentions convergent
**Then** aucune erreur ni arbitrage n'est demandé (NFR-2) : `status` idempotent, suppression par tombstone

**Given** un article supprimé sur un appareil et modifié sur un autre
**When** les intentions convergent
**Then** le résultat suit le champ à l'intention la plus récente (`deleted_at` vs autres champs), sans résurrection non voulue ni perte silencieuse

### Story 4.11 : Propagation temps réel entre surfaces

As a membre du foyer,
I want qu'une modification faite ailleurs apparaisse chez moi sans rien faire,
So that toutes les surfaces montrent la même liste vivante.

**Acceptance Criteria:**

**Given** une souscription **Realtime par foyer** (AD-8)
**When** un article est ajouté, coché ou supprimé sur une surface
**Then** les autres surfaces reflètent le changement **sans action ni rechargement manuel** (FR-10, FR-27), et **jamais par polling** (FR-22)

**Given** une surface hors ligne
**When** elle ne peut pas recevoir le temps réel
**Then** elle affiche le dernier état local + les actions en attente (pastille « arrive… »), et se resynchronise au retour

**Given** le retour du réseau
**When** la souscription se rétablit
**Then** l'état converge avec le serveur sans doublon d'événement visible

### Story 4.12 : Contrat de liste stable et versionné

As a consommateur externe (le dashboard, plus tard le pont et Claude),
I want une interface stable et versionnée des opérations de la liste,
So that une évolution de NutriClaude ne me casse pas silencieusement.

**Acceptance Criteria:**

**Given** les opérations de la liste (lire groupée par rayon, ajouter, cocher, décocher, supprimer, archiver, vider)
**When** elles sont exposées
**Then** elles le sont via une **interface programmatique stable** (PostgREST + vue + Realtime, AD-1) appliquant les **mêmes règles métier** que l'écran (FR-19, FR-20)

**Given** le contrat exposé
**When** une évolution est publiée
**Then** elle est **versionnée** et ne casse pas un consommateur existant sans préavis (FR-23)

**Given** un consommateur externe authentifié
**When** il appelle le contrat
**Then** l'isolation foyer et les règles s'appliquent identiquement, sans clé de service ni bypass RLS (AD-2)

### Story 4.13 : Coche réelle & plancher d'accessibilité de la liste

As a membre utilisant la liste (y compris au lecteur d'écran ou en plein soleil),
I want une coche qui est un vrai contrôle et une liste conforme au plancher d'accessibilité,
So that l'écran le plus utilisé reste utilisable par tous, partout.

**Acceptance Criteria:**

**Given** la ligne-article et sa coche
**When** elles sont rendues
**Then** la coche est un **vrai contrôle** (`role="checkbox"` / `<input type="checkbox">` stylé, jamais un `<span>`) qui annonce son état et son changement d'état ; la zone de tap est **toute la ligne** (un seul hit-target, ≥ 44px) ; l'état acheté = **barré + coche pleine** (jamais la seule couleur) — UX-DR3/UX-DR5

**Given** les deux thèmes
**When** la coche vide et les gris porteurs sont rendus
**Then** le contour de coche est **≥ 3:1 contre la carte** (≥ 2px + fond interne), les textes porteurs sont en `muted` (AA sur fond réel), et l'accent respecte sa discipline (abricot réservé aux courses, `tabular-nums`) — UX-DR11/UX-DR2

**Given** un utilisateur au clavier ou en `prefers-reduced-motion`
**When** il parcourt la liste
**Then** un **anneau de focus visible** (2px + offset) apparaît sur tout élément focusable (jamais `outline:none` sans remplacement), les transitions non essentielles sont coupées mais le **retour de coche reste immédiat**, et le compteur est annoncé en entier (« 12 articles à prendre ») — UX-DR11

**Given** la contrainte magasin
**When** la liste s'affiche
**Then** elle est en **colonne unique sans défilement horizontal** (NFR-3), tenant jusqu'à 200 % de zoom texte

### Story 4.14 : États hors-ligne et différé à l'écran

As a membre du foyer,
I want distinguer clairement une action non encore partie et l'état hors ligne,
So that je garde confiance sans jamais croire la liste à jour quand elle ne l'est pas.

**Acceptance Criteria:**

**Given** l'absence de réseau
**When** la liste est affichée
**Then** un **bandeau hors-ligne** en teinte ambre/neutre apparaît sous l'en-tête (jamais rouge, jamais une alerte — NFR-1/UX-DR7), informe sans bloquer, et disparaît au retour du réseau

**Given** une action locale non encore synchronisée
**When** elle est appliquée
**Then** l'article porte une **pastille « arrive… »** avec son label texte, **visuellement distincte** d'une action confirmée, sans bloquer le geste suivant (NFR-1)

**Given** la contrainte du différé vocal (préparée ici, pleinement réalisée en Epic 6)
**When** un article est en attente d'arrivée
**Then** **aucune surface ne laisse croire qu'il est déjà là** (NFR-4) ; les mots bannis (synchronisation, jeton, API…) n'apparaissent jamais (NFR-9)

### Story 4.15 : Filet de vérification — tests d'isolation & de convergence

As a mainteneur du produit,
I want des tests nommés d'isolation foyer et de convergence,
So that une régression sur les deux propriétés les plus fragiles ne parte jamais sans filet.

**Acceptance Criteria:**

**Given** la posture de vérification (AD-17)
**When** la suite de **tests de RLS** s'exécute
**Then** elle prouve que l'isolation foyer est non contournable et qu'un jeton révoqué est inactif (NFR-5, AD-2/AD-9)

**Given** la même posture
**When** la suite de **tests de convergence** s'exécute
**Then** elle couvre le LWW par champ sur intention, la bascule `status` idempotente, et l'UPSERT-incrément sur clé canonique (NFR-2, AD-3/AD-4/AD-6)

**Given** ces tests
**When** ils sont intégrés au dépôt
**Then** ils tournent sans outil d'observabilité supplémentaire (NFR-10) et échouent en cas de régression d'isolation ou de convergence

---

## Epic 5: Le dashboard de la cuisine

L'écran mural qui affiche la liste et le menu du jour en permanence, lisible à un mètre, sur lequel on coche et supprime — et qui **ne demande jamais de connexion**. Introduit la première identité non-humaine : un jeton d'appareil scopé au foyer, à périmètre restreint, révocable à l'unité, appairé une fois par Florian. Complète l'écran profil avec la gestion des appareils.

### Story 5.1 : Identité d'appareil scopée foyer & révocable

As a foyer,
I want que les surfaces non-humaines s'authentifient avec une identité d'appareil propre et révocable,
So that un écran ou un raccourci ne soit jamais traité comme une personne et puisse être coupé sans affecter les autres.

**Acceptance Criteria:**

**Given** le besoin d'une surface non-humaine (dashboard, plus tard pont/MCP/shortcut)
**When** une identité d'appareil est émise
**Then** une ligne `device_credentials` est créée (`household_id`, `kind`, périmètre restreint, `created_by`, `revoked_at`) et un jeton portant le claim `household_id` est délivré (AD-9)

**Given** un jeton d'appareil présenté
**When** une opération est tentée
**Then** `current_household_id()` résout le foyer depuis le claim du jeton, et le périmètre est **restreint aux opérations de la liste** — jamais d'accès admin foyer (NFR-6)

**Given** un appareil dont `revoked_at` est renseigné
**When** son jeton, même non expiré, tente d'agir
**Then** les politiques RLS (qui exigent `revoked_at IS NULL`) le rejettent — **révocation instantanée**, à l'unité, sans affecter les autres appareils (FR-21)

### Story 5.2 : Appairer le dashboard sans login

As a Florian,
I want appairer l'écran mural au foyer une fois pour toutes,
So that l'écran affiche la liste en permanence sans jamais demander à quiconque de se connecter.

**Acceptance Criteria:**

**Given** Florian connecté au web
**When** il émet une identité d'appareil « dashboard » (URL/jeton) et l'ouvre une fois sur l'écran mural
**Then** l'écran **persiste le jeton** et **ne redemande jamais de login** (FR-28/AD-10) — c'est un écran partagé sans utilisateur courant

**Given** un dashboard appairé
**When** la conjointe ou quiconque s'en sert
**Then** aucune manipulation ni connexion ne lui est demandée (FR-28)

**Given** un dashboard à retirer
**When** Florian le révoque depuis le web
**Then** l'écran perd immédiatement l'accès (révocation instantanée, Story 5.1), sans toucher aux autres surfaces

### Story 5.3 : Afficher la liste lisible à un mètre & tuile Courses

As a membre dans la cuisine,
I want voir d'un mètre ce qu'il reste à acheter,
So that je sache l'état des courses sans rien ouvrir ni déverrouiller.

**Acceptance Criteria:**

**Given** le dashboard appairé
**When** il affiche la liste
**Then** elle est groupée par rayon et **lisible à distance** (FR-24) : corps ≥ 18px, méta ≥ 15px, le 12px porteur est interdit sur cette surface (UX-DR9)

**Given** la tuile Courses
**When** elle est rendue
**Then** elle porte un **compteur géant** abricot, un *peek* des derniers ajouts (≥ 18px) et l'horodatage de provenance (« maj vocale il y a 2 min », ≥ 15px), avec verre + bordure + halo abricot (UX-DR8) ; un tap ouvre le détail de la liste

**Given** la tuile Courses
**When** elle affiche l'état
**Then** elle ne prétend jamais être « à jour à la seconde » — c'est un reflet, pas un miroir temps réel (NFR-4)

### Story 5.4 : Cocher et supprimer depuis le dashboard

As a membre dans la cuisine,
I want cocher un article acheté et en supprimer un directement sur l'écran,
So that je finisse les courses en rentrant, sur l'écran mural.

**Acceptance Criteria:**

**Given** un article affiché sur le dashboard
**When** un membre le coche d'un geste
**Then** il passe à l'état acheté (FR-25) via le contrat commun (mêmes règles que les autres surfaces, idempotent)

**Given** un article affiché sur le dashboard
**When** un membre le supprime
**Then** il est retiré (tombstone, FR-26), distinctement du cochage

**Given** une action faite sur le dashboard
**When** elle est appliquée
**Then** elle passe par le même contrat que le téléphone et le web — aucune règle métier propre au dashboard (FR-20)

### Story 5.5 : Reflet temps réel sans rechargement

As a foyer,
I want que le dashboard reflète tout changement fait ailleurs, tout seul,
So that l'écran allumé en permanence reste juste sans qu'on y touche.

**Acceptance Criteria:**

**Given** un dashboard affichant la liste
**When** un article est ajouté, coché ou supprimé depuis une autre surface
**Then** le dashboard se met à jour **sans intervention ni rechargement manuel** (FR-27), via la souscription Realtime par foyer (AD-8)

**Given** une coupure réseau temporaire du dashboard
**When** le réseau revient
**Then** l'affichage converge avec l'état serveur sans doublon visible et sans reload manuel

**Given** l'écran mural allumé en continu
**When** il tourne longtemps
**Then** il ne dérive pas de l'état réel (pas de cache figé exigeant un rafraîchissement humain)

### Story 5.6 : Menu du jour sur le dashboard

As a membre dans la cuisine,
I want voir les repas planifiés du jour à côté de la liste,
So that je sache quoi cuisiner sans ouvrir le menu.

**Acceptance Criteria:**

**Given** un menu de la semaine planifié (Epic 3)
**When** le dashboard s'affiche
**Then** il montre **les repas planifiés du jour** à côté de la liste (FR-44), en lecture seule

**Given** l'affichage du menu du jour
**When** il est rendu
**Then** il respecte le plancher de lisibilité à un mètre (corps ≥ 18px, UX-DR9)

**Given** un jour sans repas planifié
**When** le dashboard s'affiche
**Then** la zone menu du jour reste propre (état vide lisible), sans erreur ni champ cassé

### Story 5.7 : Gérer les appareils depuis l'écran profil

As a Florian,
I want voir et révoquer les appareils rattachés au foyer,
So that je garde le contrôle des identités non-humaines et complète l'écran profil ébauché en Epic 1.

**Acceptance Criteria:**

**Given** l'écran profil (Epic 1) où la zone « appareils » était annoncée à venir
**When** des identités d'appareil existent
**Then** l'écran liste les appareils rattachés au foyer (type, date de rattachement) — complétant FR-42

**Given** un appareil listé
**When** Florian le révoque
**Then** il est révoqué à l'unité (révocation instantanée, Story 5.1), sans affecter les autres appareils ni les membres humains (NFR-6)

**Given** cet écran
**When** il est rendu
**Then** il reste une surface de Florian, en français sans jargon (NFR-9), et ne promet aucune capacité d'appareil non encore disponible

---

## Epic 6: Les surfaces mobiles & l'ajout à la voix

Mettre la liste dans la poche et rendre l'ajout mains-libres. PWA installable sur iPhone et Android fonctionnant hors ligne, cible de partage système, dictée + partage, raccourci iOS mains-libres indépendant de Google. Puis le pont Google Keep : « Ok Google, ajoute des poivrons à la liste » arrive dans NutriClaude, classé par rayon — pont unidirectionnel, idempotent, à dégradation gracieuse, moindre privilège, et qui prévient le foyer quand il casse. Le seul élément dont on sait qu'il finira par casser : il arrive après le socle et ne tient jamais le produit debout.

### Story 6.1 : PWA installable sur iPhone et Android

As a membre du foyer,
I want installer la liste comme une application depuis mon écran d'accueil,
So that je l'ouvre en un geste et qu'elle fonctionne hors ligne — sans passer par un store.

**Acceptance Criteria:**

**Given** la coquille Next 16
**When** un manifeste PWA, des icônes et un service worker (precache de l'app-shell) sont ajoutés (AD-13)
**Then** la liste s'**installe comme une application** sur iPhone et Android, lançable depuis l'écran d'accueil (FR-35)

**Given** l'application installée
**When** elle est ouverte sans réseau
**Then** elle démarre et affiche la liste depuis le cache local (hors-ligne de l'Epic 4), sans écran blanc

**Given** la contrainte NFR-11
**When** l'installation est réalisée
**Then** elle se fait **sans binaire natif ni store** — application web installable uniquement

### Story 6.2 : Cible de partage système

As a membre du foyer,
I want partager un texte depuis n'importe quelle application vers NutriClaude,
So that j'ajoute un article sans ouvrir l'app ni taper au clavier.

**Acceptance Criteria:**

**Given** la PWA installée déclarée comme **cible de partage** (Web Share Target, AD-13)
**When** un membre partage un texte depuis une autre application vers NutriClaude
**Then** le texte est ajouté à la liste avec **résolution du rayon** (FR-33), en passant par le contrat commun (agrégation FR-5 comprise)

**Given** l'asymétrie de plateforme assumée
**When** la cible de partage est utilisée
**Then** elle est **fiable sur Android** ; la limitation connue de la PWA iOS est assumée, le chemin mains-libres iOS passant par le raccourci (Story 6.4)

**Given** un texte partagé ambigu ou vide
**When** il est reçu
**Then** l'article n'est créé que s'il porte un nom exploitable, sinon un message clair invite à réessayer, sans erreur technique

### Story 6.3 : Ajout par dictée + partage sur téléphone

As a membre au supermarché (la conjointe),
I want dicter un article et le partager vers NutriClaude,
So that j'ajoute à la voix sans clavier, de la même façon sur iPhone et Android.

**Acceptance Criteria:**

**Given** la dictée système du téléphone
**When** un membre dicte un texte puis le partage vers NutriClaude
**Then** l'article est ajouté à la liste avec résolution du rayon (FR-46/FR-29), **identiquement sur iPhone et Android**, sans application native

**Given** ce chemin de repli vocal
**When** il est utilisé
**Then** il tient en **deux gestes** (dicter, partager), sans clavier

**Given** un membre déjà rattaché à son foyer
**When** il dicte-partage
**Then** aucune connexion n'est demandée au moment de l'ajout (FR-32) — le rattachement est fait en amont

### Story 6.4 : Raccourci iOS mains-libres à identité d'appareil

As a membre iPhone,
I want dire « Dis Siri, ajoute X à la liste » sans passer par Google,
So that le foyer dispose d'un chemin vocal indépendant de tout tiers sur iOS.

**Acceptance Criteria:**

**Given** un Raccourci iOS configuré avec une **identité d'appareil** (jeton scopé foyer, Epic 5.1)
**When** le membre déclenche le raccourci par la voix
**Then** il appelle l'**API PostgREST en HTTP** (AD-14) et ajoute l'article à la liste avec résolution du rayon, **sans binaire ni store** (NFR-11)

**Given** le jeton d'appareil du raccourci
**When** il agit
**Then** son périmètre est restreint à la liste (NFR-6) et il est révocable à l'unité depuis le web (Epic 5.7)

**Given** l'asymétrie assumée
**When** on considère Android
**Then** l'équivalent Android du raccourci n'est **pas porté en v1** (déféré explicitement, AD-14) — l'ajout vocal Android passe par le pont Google et la dictée-partage

### Story 6.5 : Pont Google Keep — ingestion unidirectionnelle et idempotente

As a membre dans la maison,
I want dire « Ok Google, ajoute des poivrons à la liste de courses » et le voir arriver dans NutriClaude,
So that l'ajout vocal marche sur l'enceinte, sans que je fasse quoi que ce soit d'autre.

**Acceptance Criteria:**

**Given** trois inconnues à lever avant construction (nom exact de la note créée en français par l'enceinte, comportement sur une note *partagée*, survie du token sur plusieurs semaines depuis une IP serveur)
**When** elles sont vérifiées sur le terrain
**Then** leurs réponses sont actées avant de figer l'implémentation du pont (aucune valeur codée en dur, recherche souple du nom de note)

**Given** un article dicté à l'assistant Google (déposé dans une note Keep)
**When** le pont s'exécute en **Edge Function invoquée par `pg_cron` + `pg_net`** (~60s, AD-12/AD-15)
**Then** l'article arrive dans NutriClaude classé par rayon (FR-31), **normalisé vers le vocabulaire d'unités fermé** avec une unité par défaut (« lait » fusionne avec la ligne canonique)

**Given** des cycles de récupération répétés (rejeu pg_cron)
**When** un article a déjà été ingéré
**Then** la colonne **`source_ref`** empêche une double insertion (idempotence, FR-47) ; le pont **marque l'item côté Google sans le supprimer**, et purge périodiquement les items marqués

**Given** le sens du pont
**When** il fonctionne
**Then** il est **strictement unidirectionnel** (Google → NutriClaude, FR-50) ; NutriClaude ne se fie jamais à Google comme source de lecture ; le compte Google est **dédié, chiffré (Vault), révocable, à moindre privilège** (NFR-12)

**Given** le différé structurel (~60s, cycles, pas de notification)
**When** un article vient d'être dicté
**Then** aucune surface ne le montre « déjà là » avant qu'il n'arrive (NFR-4)

### Story 6.6 : Dégradation gracieuse & alerte du pont

As a foyer,
I want que l'ajout vocal survive à une panne du pont et que je sois prévenu,
So that je ne découvre jamais le problème au supermarché et ne perde aucun article dicté.

**Acceptance Criteria:**

**Given** un pont rompu (token mort, révocation, challenge de sécurité…)
**When** un membre continue de dicter à l'assistant Google
**Then** la commande vocale **continue de fonctionner** : les articles s'accumulent côté Google et sont **récupérés sans perte au rétablissement** (FR-48)

**Given** un pont rompu
**When** l'état est détecté
**Then** le **foyer est prévenu** sans avoir à le constater au supermarché (FR-49) — proposé en bandeau discret sur les surfaces de Florian (web + Claude), **jamais une alerte anxiogène côté conjointe** [hypothèse EXPERIENCE.md, à confirmer]

**Given** un pont rompu à réparer
**When** Florian intervient
**Then** le rétablissement est une **procédure documentée, réalisable sans redéploiement** (FR-49)

**Given** le message d'alerte
**When** il est affiché
**Then** il reste en langage familier (« On dirait que la voix ne passe plus. ») sans aucun mot banni (jeton, pont, API… — NFR-9)

---

## Epic 7: Le pilotage conversationnel (Claude / MCP)

Piloter la liste, les recettes, le menu, les rayons et les règles depuis une conversation avec Claude, strictement dans le périmètre du foyer — sans jamais contourner l'isolation (pas de clé de service). Le seul chemin *officiel* par lequel un assistant grand public pourra un jour toucher la liste.

### Story 7.1 : Accès conversationnel scopé foyer, sans contournement de l'isolation

As a foyer,
I want que Claude n'agisse que dans le périmètre de mon foyer, jamais au-delà,
So that le pilotage conversationnel n'ouvre aucune brèche dans l'isolation entre foyers.

**Acceptance Criteria:**

**Given** la tension connue (un serveur MCP tenté d'utiliser la clé de service, qui court-circuiterait le RLS)
**When** la surface MCP est construite
**Then** elle s'authentifie avec une **identité d'appareil** scopée foyer (Epic 5.1), **sans jamais `SUPABASE_SERVICE_KEY`** ni aucun chemin bypass RLS (AD-2/AD-9) — la tension FR-39 est dénouée structurellement

**Given** une action déclenchée depuis une conversation
**When** elle s'exécute
**Then** elle s'applique **dans le seul périmètre du foyer de l'utilisateur** (FR-39), l'isolation étant appliquée au niveau de la donnée (NFR-5)

**Given** l'identité d'appareil du client MCP
**When** elle doit être coupée
**Then** elle est révocable à l'unité depuis le web (Epic 5.7), sans affecter les autres surfaces

### Story 7.2 : Piloter la liste depuis Claude

As a Florian au bureau le dimanche soir,
I want consulter et modifier la liste en conversation avec Claude,
So that je pilote les courses sans ouvrir d'écran.

**Acceptance Criteria:**

**Given** une conversation avec Claude relié au foyer
**When** Florian demande de consulter la liste, d'ajouter un article, de cocher ou de supprimer
**Then** l'action s'exécute via le contrat commun (FR-36), avec les mêmes règles métier (agrégation, résolution de rayon, idempotence) que les autres surfaces (FR-20)

**Given** un ajout depuis Claude
**When** il est traité
**Then** sa provenance est enregistrée comme venant de cette surface (FR-7), et l'article se propage aux autres surfaces en temps réel (FR-10)

**Given** les réponses de Claude
**When** elles sont formulées
**Then** elles parlent de repas, de rayons et de courses — **jamais** de synchronisation, jeton, API, MCP ou pont (NFR-9)

### Story 7.3 : Consulter et façonner recettes & menu depuis Claude

As a Florian,
I want consulter et créer des recettes et modifier le menu de la semaine en conversation,
So that je prépare la semaine avec Claude et déclenche la génération de la liste.

**Acceptance Criteria:**

**Given** une conversation avec Claude
**When** Florian consulte ou crée une recette (titre, ingrédients, etc.)
**Then** la recette est lue ou créée dans le répertoire du foyer (FR-37), cohérente avec les règles de l'Epic 3 (unités fermées comprises)

**Given** une conversation avec Claude
**When** Florian consulte ou modifie le menu de la semaine (assignations, nombre de personnes)
**Then** le menu est mis à jour (FR-37), et Florian peut déclencher la **génération non destructive** de la liste (FR-16/FR-17, Epic 4) qui annonce combien d'articles ont été ajoutés

**Given** une opération sur recettes ou menu
**When** elle s'exécute
**Then** elle reste dans le périmètre du foyer (FR-39) et n'expose aucun jargon technique (NFR-9)

### Story 7.4 : Consulter et modifier rayons & règles depuis Claude

As a Florian,
I want gérer les rayons et les règles de classement en conversation,
So that j'affine le parcours et l'apprentissage sans passer par l'écran web.

**Acceptance Criteria:**

**Given** une conversation avec Claude
**When** Florian consulte ou modifie les rayons (nom, icône, ordre du parcours)
**Then** les rayons sont lus ou mis à jour dans le foyer (FR-38), cohérents avec l'Epic 2

**Given** une conversation avec Claude
**When** Florian consulte ou modifie les règles mot-clé → rayon (y compris révoquer une règle apprise)
**Then** les règles sont lues ou modifiées (FR-38), la gestion des règles restant une surface de Florian (jamais exposée à la conjointe)

**Given** une modification de rayon ou de règle depuis Claude
**When** elle est appliquée
**Then** elle reste dans le périmètre du foyer (FR-39) et se reflète immédiatement sur les autres surfaces (FR-10)
