# Sprint Change Proposal — Repartir d'un socle applicatif neuf

**Date :** 2026-07-26
**Projet :** nutriclaude
**Déclencheur :** Story 1.1 « Débloquer la construction de l'application »
**Mode :** Batch
**Profondeur :** Réécriture des stories touchées
**Statut :** ✅ **Approuvé et appliqué le 2026-07-26**

> **Décisions prises à l'approbation**
> 1. **Toutes les éditions appliquées**, y compris les 4 AC d'états vides (§4.15).
> 2. **AR-STACK réactualisé sur les versions courantes** (§Annexe, point 2) — édition supplémentaire §4.17.
> 3. **`ARCHITECTURE-SPINE.md` non édité**, conformément à la recommandation §4.4 : c'est un registre de décisions daté.
>
> Deux références orphelines non listées dans la proposition initiale ont été détectées à la vérification finale et corrigées : la ligne `FR-3` de la FR Coverage Map (« corrige le bug actuel ») et la mention `AR-BUILD` dans les `Additional` de l'Epic 1.

---

## 1. Résumé de la problématique

### Ce qui a déclenché la remise en question

La Story 1.1 a été rédigée le 2026-07-25 comme une story de réparation : remettre en état de compiler un dépôt cassé par un bump de dépendances (Next 14→16, TS 5→6, Tailwind 3→4 sans migration des configurations). L'analyse préparatoire de cette story a mesuré l'état réel du dépôt et fait apparaître un fait que les documents de planification n'avaient pas quantifié.

### Le fait mesuré

**L'application entière a été générée en 13 minutes** le 2026-05-02 (17h27 → 17h40) : un commit de 49 fichiers, immédiatement suivi d'un bump de dépendances qui l'a cassée. Elle n'a **jamais été retouchée** depuis, et **n'a jamais tourné** — elle ne compile pas. La planification (PRD, architecture, UX, epics) a commencé 2,5 mois plus tard, en juillet.

Ce n'est pas du code qui a mûri par l'usage. C'est un prototype généré une fois, dont la valeur informative a déjà été entièrement extraite dans `reconcile-code.md`.

### Ce que le code vaut, mesuré contre les décisions d'architecture

2 626 lignes applicatives. Ventilation par verdict :

| Code | Lignes | Verdict | Condamné par |
|---|---|---|---|
| 4 × `actions.ts` | 334 | Réécrit | AD-13 — écritures liste via client navigateur + outbox, pas Server Actions |
| login + signup + onboarding | 325 | Réécrit | AD-11 — magic link, plus de mot de passe |
| 14 composants clients | ~1 100 | Réécrits | UX-DR1 (palette entièrement bannie) + AD-13 (chemin d'écriture inversé) |
| `menu/page.tsx` + `grocery/page.tsx` | 296 | Réécrits | AD-13 — `force-dynamic` serveur → client-direct + hors-ligne |
| `globals.css` | 44 | Réécrit | UX-DR1 — double thème, tokens DESIGN.md |
| `lib/dates.ts`, `types.ts`, `client.ts` | ~195 | **Survivent** | — |

**≈ 92 % du code applicatif est déjà programmé pour être réécrit par les epics 2, 3, 4 et 6.** La Story 1.1 dépensait donc de l'effort à réparer — et son AC5 à protéger contre la régression — des fonctionnalités que les epics suivants démolissent.

### Catégorie d'enjeu

**Approche défaillante nécessitant une solution différente.** Pas une limitation technique (le build est réparable, la story 1.1 le prouvait en détail), pas un changement de besoin : une inefficacité de séquencement révélée par la mesure.

---

## 2. Analyse d'impact

### 2.1 Périmètre préservé — la base de données

**La base Supabase est déployée et gelée.** La migration `initial_schema` a été jouée sur le projet lié (`ywoubvebmlhtomwgouci`, eu-west-1, Postgres 17.6). Le schéma déployé a été confirmé : 10 tables, `current_household_id()`, RLS, `resolve_aisle_id`, `generate_grocery_list_from_menu`, fonctions d'onboarding.

**Conséquence directe : la base n'est pas concernée par ce changement.** Elle reste l'unique source de vérité, conformément à AD-1 (« toute règle métier vit en Postgres »), et toute évolution passe en migrations additives conformément à AR-MIGRATIONS. C'est précisément ce qui rend la décision peu coûteuse : la valeur du projet est dans le schéma, pas dans les écrans.

### 2.2 Impact epic par epic

| Epic | Impact | Détail |
|---|---|---|
| **Epic 1** | **Fort** | Story 1.1 entièrement redéfinie. Cadrages des stories 1.2 et 1.7 à corriger. Description de l'epic à reformuler |
| **Epic 2** | **Faible** | Aucune AC invalidée. Deux cadrages (2.5) et un manque d'état vide à combler |
| **Epic 3** | **Faible** | Aucune AC invalidée. Quatre cadrages (3.2, 3.3, 3.5) et un manque d'état vide à combler |
| **Epic 4** | **Très faible** | Deux cadrages (4.3, 4.4). **Les clauses SQL restent intégralement valides** |
| **Epics 5, 6, 7** | **Nul** | Ces surfaces n'existaient pas dans le prototype |

### 2.3 La découverte structurante : les epics sont robustes au changement

Les epics décrivent des **états cibles**, pas des diffs. Dans chaque cas affecté, c'est le **« Given »** (cadrage motivationnel : « aujourd'hui X est cassé ») qui perd son référent. Les **« Then »** — les critères d'acceptation réels — sont intacts. Un scaffold neuf les satisfait aussi bien qu'une réparation.

**8 clauses perdent leur référent**, toutes applicatives :

| Story | Clause | Ligne |
|---|---|---|
| 1.1 | Story entière | 281-307 |
| 1.2 | *« Given le code actuel dérivé vers email + mot de passe »* | 317 |
| 1.7 | *« Given le dark `#0f1117` câblé en dur du code actuel »* | 427 |
| 2.5 | *« corrigeant le trou actuel où l'ajout manuel n'était pas résolu »* | 539 |
| 3.2 | *« (aujourd'hui modifiable seulement par suppression + recréation) »* | 627 |
| 3.3 | *« aujourd'hui les instructions n'existent que dans une zone d'édition »* | 643 |
| 3.5 | *« absent de l'écran »* + *« corrigeant le comportement actuel »* | 689, 693 |
| 4.3 | *« le bug actuel du décochage »* + *« Given le bug actuel (bascule relative codée en dur) »* | 777, 780 |
| 4.4 | *« corrige le trou actuel de l'ajout manuel »* | 803 |

**6 clauses restent parfaitement valides** — elles pointent vers la base déployée, pas vers l'app :

| Story | Clause | Pourquoi elle tient |
|---|---|---|
| 4.7 | *« corrige le DELETE destructeur actuel »* | `generate_grocery_list_from_menu` fait bien `delete … where status='pending'` **en production** |
| 4.6 | *« corrigeant l'omission actuelle à la génération »* | Le `recipe_id` est bien absent de la fonction SQL déployée |
| 1.4 | *« la fonction existe en base mais aucun bouton ne l'appelle »* | `generate_household_invite` est déployée — devient **plus** vraie qu'avant |
| 2.1 | *« un foyer existant antérieur à cette story »* | Clause portant sur des données |
| 1.3 | *« il retrouve son foyer existant »* | Clause portant sur des données |
| 3.5 | *« collation aujourd'hui présent en base »* | Le `CHECK` sur `meal_type` inclut bien `'snack'` |

### 2.4 Résultat de la revue profonde des 6 stories « construites au lieu d'ajustées »

L'option retenue supposait que les stories 2.2, 2.4, 3.1, 3.2, 3.5 et 3.6 devaient être rouvertes. **La revue conclut que 4 d'entre elles n'ont besoin d'aucune modification.**

| Story | Verdict de la revue |
|---|---|
| 2.2 Gérer ses rayons | **Aucun changement.** Déjà en état cible |
| 2.4 Règles mot-clé → rayon | **Aucun changement.** Déjà en état cible |
| 3.1 Créer et éditer une recette | **Aucun changement.** Déjà en état cible |
| 3.6 Assigner recettes au menu | **Aucun changement.** Déjà en état cible |
| 3.2 Gérer les ingrédients | Une parenthèse à retirer |
| 3.5 Planifier le menu | Deux cadrages à corriger |

Ces stories ont été rédigées en « Given un état / When une action / Then un résultat » sans présupposer l'existence d'un écran. Les réécrire serait fabriquer du changement pour honorer une étiquette.

### 2.5 Ce que la revue profonde a réellement trouvé — un trou de spécification

**Les epics 2 et 3 ne spécifient aucun état vide ni état de chargement.**

C'est invisible tant qu'on ajuste un écran qui en possède déjà un implicitement ; c'est béant quand on construit de zéro — quelqu'un doit décider ce que voit Florian devant un répertoire de recettes vide, ou pendant que la grille du menu charge.

Couverture actuelle : uniquement l'Epic 4 (`squelette de rayons, jamais un message d'erreur`, L887) et le dashboard (`état vide lisible`, L1161). Rien pour rayons, recettes, répertoire, menu.

`EXPERIENCE.md` §State Patterns et `DESIGN.md` portent la matière ; les epics ne la consomment pas. **C'est le seul ajout de fond que ce changement justifie.**

### 2.6 Conflits d'artefacts

| Artefact | Impact | Action |
|---|---|---|
| **PRD** | Aucun conflit | Le MVP, les FR et les NFR sont inchangés. §7 « Écart avec l'existant » devient historique, sans conséquence |
| **ARCHITECTURE-SPINE.md** | Deux formulations | AD-4 (« corrige le bug actuel ») et AD-11 (« le code a dérivé → à réaligner en Lot 0 ») ; section `Deferred` « Débloquage Lot 0 ». **Édition optionnelle** — voir §4.4 |
| **DESIGN.md / EXPERIENCE.md** | Aucun conflit | Ces documents décrivent une cible qui n'a jamais été implémentée. Ils gagnent en pertinence |
| **`reconcile-code.md`** | Devient historique | Document d'analyse daté. À **conserver tel quel** : il justifie la décision |
| **Migrations Supabase** | Aucun | Schéma gelé, migrations additives (AR-MIGRATIONS) |
| **CI/CD, IaC, observabilité** | Aucun | Rien n'existe encore |

### 2.7 Le coût réel, non minimisé

Les stories 2.2, 2.4, 3.1, 3.2, 3.5 et 3.6 perdent environ **800 lignes de CRUD** comme point de départ.

L'essentiel était déjà condamné : UX-DR1 rhabille tout, AD-13 réécrit le chemin d'écriture. Le surcoût net réel — l'échafaudage de formulaires — est estimé entre **300 et 500 lignes de React sans difficulté**.

En contrepartie, on n'a plus à faire : la réparation de la Story 1.1 (6 tâches, dont la migration `@apply`/`@utility`, la propagation de `await` sur 19 sites d'appel, la migration `middleware`→`proxy` avec ses pièges E900/E903), ni la traque du résidu de configuration v3.

**Bilan estimé : neutre à légèrement favorable, avec une base nettement plus saine.**

---

## 3. Approche recommandée

### Option retenue : ajustement direct (Option 1), avec un périmètre restreint

| Option | Évaluation | Verdict |
|---|---|---|
| **1 — Ajustement direct** | Modifier la Story 1.1, corriger 8 cadrages, ajouter les états vides. Effort **faible**, risque **faible** | ✅ **Retenue** |
| **2 — Rollback** | Sans objet : aucune story n'a été implémentée. Le « rollback » *est* la décision elle-même (abandon du prototype), et git le rend gratuit | N/A |
| **3 — Révision du MVP** | Non nécessaire. Le périmètre MVP, les FR et les NFR sont intacts. Aucun objectif produit n'est remis en cause | ❌ Écartée |

### Justification

Le corpus de planification a été rédigé **en connaissance** de l'état du code — c'est précisément pourquoi on peut jeter le prototype sans le fragiliser. Les epics décrivent des états cibles, l'architecture est indépendante de l'implémentation, la base est déployée et gelée. Le changement touche **le point de départ de l'implémentation, pas la définition du produit**.

Le risque principal — perdre une référence de travail — est neutralisé par git : `git show 7e1a249:app/(app)/recipes/[id]/EditRecipeForm.tsx` reste consultable quand l'Epic 3 voudra un exemple. Le prototype n'est pas supprimé, il est **rangé dans l'historique**.

### Séquencement

Aucune resequencing d'epic. L'ordre 1→7 reste valide et se trouve même renforcé : l'Epic 1 pose désormais un socle propre au lieu de rafistoler, et les epics 2/3/4 construisent sur cette base sans hériter de dette.

---

## 4. Propositions d'édition détaillées

### 4.1 — `epics.md` : nature du projet (ligne 123)

**OLD**
> **Nature du projet — brownfield, pas de starter template.** Il n'y a PAS de template/greenfield à installer : le dépôt existe déjà (Next 16 App Router + Supabase) **mais ne compile pas**. Le déblocage build est un *préalable*, pas un invariant → **Epic 1, Story 1**.

**NEW**
> **Nature du projet — base brownfield, application greenfield.** Le projet est mixte, et la distinction structure tout l'Epic 1 : la **base Supabase est déployée et gelée** (migration `initial_schema` jouée : 10 tables, RLS, `current_household_id()`, fonctions de résolution et de génération) — elle est conservée et n'évolue qu'en migrations additives (AR-MIGRATIONS). L'**application**, en revanche, repart d'un scaffold Next 16 neuf : le prototype généré le 2026-05-02 ne compilait pas et ~92 % de ses surfaces étaient condamnées par AD-11, AD-13 et UX-DR1. Il reste consultable dans l'historique git (`7e1a249`). Poser le socle est un *préalable*, pas un invariant → **Epic 1, Story 1**.

**Rationale :** le cadrage « brownfield » sans nuance induisait en erreur sur la nature du travail. La distinction base/application est le fait structurant du projet.

---

### 4.2 — `epics.md` : AR-BUILD → AR-SOCLE (ligne 125)

**OLD**
> - **AR-BUILD (Lot 0, bloquant tout)** — Remettre l'app en état de compiler : greffon `@tailwindcss/postcss` + `globals.css` en syntaxe Tailwind 4 ; `await cookies()` (Next 16) dans `lib/supabase/server.ts` ; `params`/`searchParams` typés en `Promise` (`app/(app)/menu/page.tsx`, `app/(app)/recipes/[id]/page.tsx`) ; `middleware.ts` → convention `proxy` (Next 16) **en préservant tout le gating d'accès** ; retrait de `baseUrl` (TS 6). Corriger aussi `metadata.title` (« NutriCloud » → « NutriClaude »).

**NEW**
> - **AR-SOCLE (Lot 0, bloquant tout)** — Poser un socle applicatif Next 16 neuf, correctement configuré dès l'origine plutôt que migré : Tailwind 4 natif (`@tailwindcss/postcss`, `@import "tailwindcss"`, tokens en `@theme`), `tsconfig` sans `baseUrl` (TS 6), `lib/supabase/{client,server,proxy}.ts` écrits selon les patterns courants (`await cookies()`, en-têtes anti-cache de `setAll` appliqués), contrôle d'accès en `proxy.ts` (convention Next 16), titre « NutriClaude ». **Aucun fichier `middleware.ts`, aucun résidu de configuration v3.** La base déployée n'est pas touchée.

**Rationale :** AR-BUILD décrivait une liste de réparations fichier par fichier qui n'a plus d'objet. AR-SOCLE décrit le même état cible en termes de construction. La faille de cache `setAll` de `@supabase/ssr` 0.10 (découverte pendant l'analyse de la Story 1.1) est intégrée à l'exigence plutôt que traitée en correctif.

---

### 4.3 — `epics.md` : AD-11, mention du code dérivé (ligne 136)

**OLD**
> - **AD-11** — **Auth humaine = magic link sans mot de passe** ; le code a dérivé (email+mdp) → **à réaligner en Lot 0**.

**NEW**
> - **AD-11** — **Auth humaine = magic link sans mot de passe** ; construite ainsi dès l'origine, aucun chemin mot de passe n'est introduit.

---

### 4.4 — `epics.md` : AD-4, mention du bug actuel (ligne 129)

**OLD**
> - **AD-4** — Toggle `status` **idempotent** (valeur posée, pas un basculement relatif) — corrige le bug actuel.

**NEW**
> - **AD-4** — Toggle `status` **idempotent** (valeur posée, pas un basculement relatif) — un basculement relatif bloque un article acheté dans son état.

**Note :** `ARCHITECTURE-SPINE.md` porte les mêmes formulations pour AD-4 et AD-11, ainsi qu'une entrée `Deferred` « Débloquage Lot 0 ». **Je recommande de ne PAS les éditer** : le spine est un registre de décisions daté, et ces mentions documentent fidèlement le contexte dans lequel les invariants ont été posés. Les corriger réécrirait l'histoire sans bénéfice. À arbitrer.

---

### 4.5 — `epics.md` : description de l'Epic 1 (lignes 241 et 279)

**OLD**
> Remettre l'application en état de marche et transformer le « foyer » d'une intention en une réalité à deux. Aujourd'hui l'app ne compile pas et aucun bouton n'appelle l'invitation : le produit n'a physiquement qu'un seul utilisateur possible. À la fin de cet epic, l'app se construit, l'authentification est en magic link sans mot de passe, un utilisateur crée ou rejoint un foyer via un code d'invitation cliquable, l'écran profil/membres existe, et les fondations de thème (clair/sombre) et de ton français sont posées.

**NEW**
> Poser un socle applicatif sain et transformer le « foyer » d'une intention en une réalité à deux. La base porte déjà tout le nécessaire — tables, isolation par foyer, fonction d'invitation — mais aucune surface ne l'exploite : le produit n'a physiquement qu'un seul utilisateur possible. À la fin de cet epic, l'application est construite sur un socle Next 16 neuf, l'authentification est en magic link sans mot de passe, un utilisateur crée ou rejoint un foyer via un code d'invitation cliquable, l'écran profil/membres existe, et les fondations de thème (clair/sombre) et de ton français sont posées.

**Rationale :** « l'app ne compile pas » cesse d'être le point de départ. Le vrai constat — la base est prête, rien ne s'en sert — est plus juste et plus motivant.

---

### 4.6 — `epics.md` : Story 1.1, réécriture complète (lignes 281-307)

**OLD** — `### Story 1.1 : Débloquer la construction de l'application`, avec 5 AC portant sur : greffon PostCSS, `await cookies()` + `params`/`searchParams`, migration `middleware`→`proxy`, retrait de `baseUrl` + titre, et non-régression des fonctionnalités acquises.

**NEW**

> ### Story 1.1 : Poser le socle applicatif Next 16
>
> As a développeur du produit (Florian),
> I want un socle applicatif neuf qui compile et passe le typage sur la stack cible (Next 16 / React 19 / Tailwind 4 / TS 6) et parle à la base déployée,
> So that toute autre story se construise sur une fondation saine, sans dette de configuration héritée.
>
> **Acceptance Criteria:**
>
> **Given** le prototype généré le 2026-05-02, qui ne compile pas et dont ~92 % des surfaces sont condamnées par AD-11, AD-13 et UX-DR1
> **When** l'application est réinitialisée depuis un scaffold Next 16 propre, le prototype restant consultable dans l'historique git
> **Then** `next build` et `npm run typecheck` réussissent tous deux sans erreur ni avertissement de configuration
>
> **Given** la base Supabase déployée et son schéma gelé (migration `initial_schema` jouée)
> **When** le socle est posé
> **Then** aucune migration n'est créée ni rejouée, et le schéma déployé reste l'unique source de vérité (AR-MIGRATIONS, AD-1)
>
> **Given** le besoin de contrôle d'accès avant toute surface authentifiée
> **When** un `proxy.ts` (convention Next 16) est écrit avec `/login`, `/signup` et `/auth/callback` comme seules routes publiques
> **Then** un utilisateur non authentifié est redirigé vers `/login` en conservant sa destination, un utilisateur authentifié visitant une page d'authentification est renvoyé à l'accueil, et `/auth/callback` reste toujours accessible pour l'échange de code
>
> **Given** `cookies()` asynchrone en Next 16 et les en-têtes anti-cache exigés par `@supabase/ssr` 0.10
> **When** `lib/supabase/{client,server,proxy}.ts` sont écrits selon les patterns Supabase courants
> **Then** le client serveur attend (`await`) `cookies()`, et les en-têtes fournis par `setAll` sont appliqués sur la réponse — **aucun cookie de session ne peut être mis en cache par un CDN** (NFR-5)
>
> **Given** le socle posé
> **When** l'application démarre
> **Then** elle affiche « NutriClaude », Tailwind 4 est configuré nativement (`@tailwindcss/postcss`, `@import "tailwindcss"`), le `tsconfig` est sans `baseUrl`, et **il ne subsiste aucun fichier `middleware.ts` ni aucun résidu de configuration Tailwind v3**

**Rationale :** l'AC de non-régression est remplacée par une AC d'absence de résidu — c'est l'équivalent significatif quand il n'y a plus d'acquis à protéger. La faille de cache `setAll` devient une exigence de construction au lieu d'un correctif à greffer.

---

### 4.7 — `epics.md` : Story 1.2, cadrage (ligne 317)

**OLD**
> **Given** le code actuel dérivé vers email + mot de passe

**NEW**
> **Given** un socle applicatif sans authentification

*(« When » et « Then » inchangés.)*

---

### 4.8 — `epics.md` : Story 1.7, cadrage (ligne 427)

**OLD**
> **Given** le dark `#0f1117` câblé en dur du code actuel

**NEW**
> **Given** un socle applicatif sans système de thème

*(« When » et « Then » inchangés.)*

---

### 4.9 — `epics.md` : Story 2.5, cadrage (ligne 539)

**OLD**
> **Then** le rayon est déterminé à partir des règles du foyer et posé sur l'article (FR-4), corrigeant le trou actuel où l'ajout manuel n'était pas résolu

**NEW**
> **Then** le rayon est déterminé à partir des règles du foyer et posé sur l'article (FR-4) — **tout** chemin d'ajout passe par la résolution, y compris l'ajout manuel

---

### 4.10 — `epics.md` : Story 3.2, parenthèse (ligne 627)

**OLD**
> **Given** un ingrédient existant (aujourd'hui modifiable seulement par suppression + recréation)

**NEW**
> **Given** un ingrédient existant

---

### 4.11 — `epics.md` : Story 3.3, clause « So that » (ligne 643)

**OLD**
> So that je puisse la suivre — aujourd'hui les instructions n'existent que dans une zone d'édition, jamais rendues.

**NEW**
> So that je puisse la suivre en cuisinant, sans avoir à ouvrir un écran d'édition.

---

### 4.12 — `epics.md` : Story 3.5, deux cadrages (lignes 689 et 693)

**OLD**
> **Then** il présente une grille jour × repas incluant le repas **collation** (aujourd'hui présent en base mais absent de l'écran — FR-15)

**NEW**
> **Then** il présente une grille jour × repas incluant le repas **collation** — déjà admis par la base (`meal_type` accepte `snack`) et donc rendu à l'écran (FR-15)

**OLD**
> **Then** elle **n'impose aucun défilement horizontal forcé** (NFR-3/UX-DR10), corrigeant le comportement actuel

**NEW**
> **Then** elle **n'impose aucun défilement horizontal forcé** (NFR-3/UX-DR10), quelle que soit la largeur d'écran

---

### 4.13 — `epics.md` : Story 4.3, deux cadrages (lignes 777 et 780)

**OLD**
> So that l'état reflète mes achats sans jamais se bloquer — le bug actuel du décochage est corrigé.

**NEW**
> So that l'état reflète mes achats sans jamais se bloquer.

**OLD**
> **Given** le bug actuel (bascule relative codée en dur, un article acheté ne revient pas)

**NEW**
> **Given** qu'une bascule relative bloquerait un article acheté dans son état

---

### 4.14 — `epics.md` : Story 4.4, cadrage (ligne 803)

**OLD**
> **Then** l'opération est un **UPSERT-incrémente** sur la clé canonique (AD-6) qui additionne les quantités (FR-5), **jamais** un INSERT nu — corrige le trou actuel de l'ajout manuel

**NEW**
> **Then** l'opération est un **UPSERT-incrémente** sur la clé canonique (AD-6) qui additionne les quantités (FR-5), **jamais** un INSERT nu — sur tout chemin d'ajout, manuel compris

---

### 4.15 — AJOUT : états vides sur les surfaces construites de zéro

**Justification :** trou de spécification révélé par la décision (§2.5). Un écran construit de zéro n'hérite d'aucun état vide implicite. `EXPERIENCE.md` §State Patterns et `DESIGN.md` portent la matière ; les epics ne la consommaient pas. Formulation alignée sur le précédent de l'Epic 4 (L887 : *« un squelette de rayons est montré, jamais un message d'erreur »*) et sur NFR-8/NFR-9 (français, sans jargon).

**Story 2.2 — AC ajoutée**
> **Given** un foyer dont tous les rayons ont été supprimés
> **When** l'écran des rayons s'affiche
> **Then** il montre un état vide lisible en français invitant à créer un rayon, jamais une page blanche ni un message technique (NFR-8)

**Story 3.1 — AC ajoutée**
> **Given** un foyer dont le répertoire de recettes est vide
> **When** l'écran des recettes s'affiche
> **Then** il montre un état vide lisible invitant à créer une première recette, et pendant le chargement un squelette plutôt qu'un écran blanc ou un message d'erreur

**Story 3.4 — AC ajoutée**
> **Given** un filtre ou une recherche qui ne renvoie aucune recette
> **When** le résultat s'affiche
> **Then** il l'annonce en français simple et propose de réinitialiser le filtre, sans laisser croire que le répertoire est vide

**Story 3.5 — AC ajoutée**
> **Given** une semaine sans aucun repas planifié
> **When** la grille du menu s'affiche
> **Then** les cases vides sont lisibles et directement actionnables, sans message d'erreur ni zone ambiguë

---

### 4.16 — `_bmad-output/implementation-artifacts/1-1-*.md` : story de développement

Le fichier de story rédigé le 2026-07-25 est aligné sur l'ancienne Story 1.1 (réparation). **Il est réécrit intégralement** contre la nouvelle définition.

Ce qui **disparaît** : migration `@apply`→`@utility`, propagation de `await` sur 19 sites d'appel, migration `middleware`→`proxy` et ses pièges E900/E903, retrait de `baseUrl`, correction des modificateurs `!important` v3→v4, tableau de gating à préserver à l'identique.

Ce qui **est conservé** (durement acquis, toujours pertinent) : la recette Tailwind 4 vérifiée (`@theme`, `@utility`, `@apply`), les faits vérifiés sur la convention `proxy` de Next 16, la faille de cache `setAll`, le piège `strictRouteTypes`, les contraintes de version d'AR-STACK, la frontière de périmètre 1.1 / 1.7, et le fait que `npm run lint` est cassé.

Le fichier renommé : `1-1-poser-le-socle-applicatif-next-16.md`. Entrée `sprint-status.yaml` mise à jour en conséquence (statut `ready-for-dev` conservé).

---

### 4.17 — `epics.md` : AR-STACK et AR-MIGRATIONS réactualisés (ligne 144)

**Décision prise à l'approbation.** Un scaffold neuf installe les versions courantes ; maintenir le gel sur celles du prototype imposerait un downgrade délibéré et laisserait de côté un correctif de sécurité Next.

**OLD**
> - **AR-MIGRATIONS** — Une seule migration initiale existe : établir la **discipline de migrations additives** avant le schéma du Lot 1.
> - **AR-STACK** — Stack cible confirmée : Next.js 16.2, React 19.2, Tailwind 4.2, TypeScript 6, `@supabase/ssr` 0.10.2, `@supabase/supabase-js` 2.105.1, hébergement Vercel + Supabase.

**NEW** — versions vérifiées sur npm le 2026-07-26 :

| Paquet | Avant | Après |
|---|---|---|
| `next` | 16.2 (16.2.4) | **16.2.12** — inclut un correctif de sécurité |
| `react` / `react-dom` | 19.2 (19.2.5) | **19.2.8** |
| `tailwindcss` + `@tailwindcss/postcss` | 4.2 (4.2.4) | **4.3.3** |
| `typescript` | 6 (6.0.3) | **6.0.3** — inchangé, dernière de la ligne 6.x |
| `@supabase/ssr` | 0.10.2 | **0.12.3** ⚠️ |
| `@supabase/supabase-js` | 2.105.1 | **2.110.8** — imposé par peer dependency |

Deux réserves inscrites dans l'exigence elle-même :

- **TypeScript reste en ligne 6.x.** TS 7 (portage Go) est publié (7.0.2) mais demeure **volontairement non adopté** — arbitrage du 2026-07-23, inchangé.
- ⚠️ **`@supabase/ssr` 0.10.2 → 0.12.3 est un bond de deux versions mineures**, pas un patch (la ligne 0.11 n'a jamais été publiée). C'est le seul saut non trivial de cette réactualisation. La Story 1.1 porte l'obligation de vérifier, **avant** d'écrire les clients, que `getAll`/`setAll` et la signature `setAll(cookies, headers)` sont inchangés.

**AR-MIGRATIONS** est par ailleurs corrigé pour refléter le fait que la migration initiale est **déployée en production**, et non simplement « existante ».

---

## 5. Handoff d'implémentation

### Classification du périmètre : **Modérée**

Réorganisation du backlog nécessaire (une story redéfinie, 12 clauses corrigées, 4 AC ajoutées), mais **aucun replanning fondamental** : périmètre MVP inchangé, aucune exigence PRD touchée, aucun epic ajouté, supprimé ou resequencé.

### Destinataires

| Rôle | Livrable | Responsabilité |
|---|---|---|
| **Product Owner / Dev** | Ce document | Approuver les éditions, appliquer à `epics.md` |
| **Dev** | Story 1.1 réécrite | Implémenter le socle |
| **Architecte** *(optionnel)* | §4.4 | Arbitrer l'édition ou non de `ARCHITECTURE-SPINE.md` |

### Critères de succès

1. `epics.md` ne contient plus aucune référence au prototype abandonné — hors les mentions historiques assumées
2. Les 6 clauses portant sur la base déployée sont **inchangées** et restent vérifiables contre le schéma en production
3. La Story 1.1 réécrite est implémentable sans consulter le code du prototype
4. Les epics 2 et 3 portent des états vides pour chaque surface construite de zéro
5. `sprint-status.yaml` reste cohérent : 7 epics, 52 stories, `epic-1` en `in-progress`

### Étapes suivantes après approbation

1. Appliquer les éditions 4.1 → 4.15 à `epics.md`
2. Réécrire le fichier de story, mettre à jour `sprint-status.yaml`
3. Arbitrer §4.4 (édition ou non du spine)
4. Lancer `bmad-dev-story` sur la Story 1.1 réécrite

---

## Annexe — Points d'attention hérités de l'analyse de la Story 1.1

Trois constats, **hors périmètre de ce changement**, qui restent valables :

1. **`npm run lint` est doublement cassé** — `next lint` a disparu de la CLI Next 16, et aucune configuration ESLint n'existe alors qu'ESLint 10 exige le flat config. Aucun document ne prescrit de lint. Le scaffold neuf est l'occasion naturelle de trancher.
2. **La stack est en retard de quelques patches** — `next 16.2.4` → `16.2.11` (dont un correctif de sécurité), `react 19.2.5` → `19.2.8`, `@supabase/ssr 0.10.2` → `0.10.3`. AR-STACK gèle les versions actuelles. Un scaffold neuf installe naturellement des versions courantes : **il faudra décider si l'on gèle à nouveau sur AR-STACK ou si l'on met AR-STACK à jour.** C'est le seul point où le changement force un arbitrage de version.
3. **Aucun framework de test** — planifié en Story 4.15, conformément à AD-17 et NFR-10. Inchangé.
