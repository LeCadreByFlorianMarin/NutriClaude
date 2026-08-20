---
baseline_commit: 065ec58
---

<!-- Contextualisée le 2026-08-20, sur `065ec58` — la tête de `main`. Les stories 4.1 à 4.5 sont
     `done`, fusionnées et déployées. Les dix mesures ci-dessous ont été EXÉCUTÉES sur le stack
     local, pas déduites. -->

<!-- ⛔ **LA CHOSE À SAVOIR AVANT TOUT LE RESTE : L'AC1 DEMANDE D'ENREGISTRER UNE DONNÉE QUI N'A
     PAS DE COLONNE.** Il exige « `actor_kind` + `actor_id`, **la surface d'arrivée**, et
     `recipe_id` ». Les trois autres existent ; **la surface d'arrivée, non**. Mesuré — les
     colonnes de `grocery_list_items` sont : `id, household_id, name, quantity, unit, product_id,
     aisle_id, recipe_id, added_by, status, created_at, actor_kind, actor_id, source_ref,
     intent_at, updated_at, deleted_at`.
     ⛔ **Et la colonne vers laquelle le réflexe pousse est déjà prise.** `source_ref` est
     l'idempotence du pont Google (AD-12, mot pour mot : « Idempotence = colonne `source_ref` »),
     l'ERD la décrit « dedup pont/shortcut FR-47 », AD-17 nomme « dédup pont par `source_ref` »
     comme test obligatoire, et la 4.1 a daté son index unique à l'Epic 6. **L'y écrire une
     surface casserait cet index avant qu'il existe.** C'est la décision D1. -->

<!-- ⛔ **L'AC3 N'EST PAS ATTEIGNABLE DANS CETTE STORY, ET POUR DEUX RAISONS INDÉPENDANTES.**
     (1) La fonction qu'il faut corriger — `generate_grocery_list_from_menu` — **fait segfauter
     PostgreSQL** (mesuré le 2026-08-07, un crash par appel) et appartient à la story **4.7**.
     (2) ⚠️ **Plus profond : le modèle ne peut pas porter la réponse.** Mesuré : la génération
     agrège `group by ri.name, ri.unit, ri.product_id, ri.aisle_keyword` **à travers toutes les
     recettes planifiées**. Une ligne de liste vient donc de N recettes, et `recipe_id` est un
     `uuid` unique. « La recette d'origine » n'existe pas au singulier. Voir D3. -->

<!-- ✅ **CE QUI EST DÉJÀ LÀ ET QU'IL NE FAUT PAS RÉINVENTER** : les colonnes `actor_kind`,
     `actor_id`, `source_ref`, `recipe_id` (4.1) et leurs deux contraintes
     (`grocery_list_items_acteur_connu`, `..._acteur_couple`) ; la vue qui projette DÉJÀ les
     quatre ; `ajouter_article` comme unique chemin d'écriture d'un article (AD-6) ; le motif
     `sr-only` + `aria-label` d'`EXPERIENCE.md` ; `.btn-ligne` et la structure de rang posées
     par la 4.5. -->

# Story 4.6: Provenance de chaque article

Status: done

<!-- ✅ **FERMÉE LE 2026-08-20, après revue adversariale à quatre couches.** 2 décisions tranchées
     par Florian, 19 correctifs appliqués et vérifiés, 5 reports écrits dans `deferred-work.md`.
     ⛔ **LA REVUE A TROUVÉ QUE LA STORY ÉTAIT INERTE** : `ajouterArticle` ne transmettait aucune
     surface, donc l'icône ne pouvait jamais s'afficher — et mon parcours à l'écran avait validé
     des lignes que j'avais moi-même plantées en `psql`. Corrigé, et re-prouvé sur une donnée
     produite par le produit.
     ⛔ **RESTE OUVERT** : la décision `intent_at` (avant la 4.10) · l'AC3 (4.7) · la ceinture
     `update` qui demande un trigger (4.10) · `actor_id` sans clé étrangère (Epic 5). -->

<!-- ⛔ **LIVRÉE AVEC UNE FRONTIÈRE ASSUMÉE, DATÉE PLUTÔT QU'EFFACÉE** : **l'AC3 n'est PAS
     implémenté** (D3a). La fonction à corriger segfaute ET le modèle ne peut pas porter la
     réponse — une ligne de liste vient de N recettes pour un `recipe_id` unique. Re-daté vers la
     **4.7**, qui possède le chemin d'écriture. ✅ **Ce que cette story livre quand même** : la
     LECTURE de `recipe_id` (icône 🍴 et son équivalent texte), qui fonctionnera le jour où la 4.7
     le remplira — vérifié par un test. -->

## Story

As a **membre du foyer**,
I want **savoir d'où vient chaque article et qui l'a ajouté**,
so that **je comprenne ma liste et que la répartition par surface soit mesurable**.

## Acceptance Criteria

**AC1 — La provenance est polymorphe et enregistrée à la création**

**Given** un article ajouté
**When** il est créé
**Then** sa provenance est enregistrée de façon **polymorphe** : `actor_kind ∈ {profile, device}` +
`actor_id`, la surface d'arrivée, et `recipe_id` s'il vient d'une recette (FR-7) — un appareil
n'est jamais une FK `profiles` (AD-9)

**AC2 — L'icône n'est jamais seule**

**Given** la provenance d'un article
**When** la ligne est affichée
**Then** elle montre une icône de provenance **doublée d'un équivalent texte / `aria-label`**
(＋ « ajout manuel », 🍴 « issu d'une recette » ; les canaux 🎙 vocal et 🗒 dictée se peupleront en
Epic 6) — jamais mono-canal (UX-DR6), icône ≥ 3:1 sans opacité réductrice

**AC3 — La génération porte la recette d'origine**

**Given** un article issu de la génération depuis le menu
**When** il est créé
**Then** sa provenance porte la recette d'origine (`recipe_id`), corrigeant l'omission actuelle à
la génération

---

## Décisions ouvertes — chacune avec son défaut prescrit

> Le dev agent applique le **défaut prescrit** si Florian n'a pas tranché.

### D1 — Où vit « la surface d'arrivée » ⛔ **la plus structurante : elle n'a pas de colonne**

**Mesuré (M1)** : aucune colonne ne porte la surface. **Mesuré (M2)** : `source_ref` n'a **aucune
contrainte** — elle accepte n'importe quel texte, ce qui la rend tentante. ⛔ **Et c'est le piège** :
AD-12 en fait l'idempotence du pont, l'ERD la légende « dedup pont/shortcut », AD-17 exige un test
de « dédup pont par `source_ref` », et la 4.1 a **daté** son index `unique (household_id,
source_ref) where source_ref is not null` à l'Epic 6.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Une colonne `source` neuve, vocabulaire **fermé** par un `check` | ✅ Sépare deux questions que le schéma confond sinon : *d'où vient la ligne source* (`source_ref`) et *par quelle surface elle est entrée* (`source`). ⚠️ Le vocabulaire se ferme comme celui des unités (AD-7) — `web`, `dashboard`, `voix`, `dictee`, `pont`, `mcp` — **et ce n'est PAS une énumération qui court après une catégorie** (règle §3) : les surfaces sont un ensemble que **nous** contrôlons, contrairement aux points de code Unicode. ⚠️ Migration additive, colonne nullable |
| (b) Réutiliser `source_ref` | ⛔ **Casse l'index unique de l'Epic 6 avant qu'il existe** : deux ajouts web du même foyer porteraient `source_ref = 'web'` et se dédupliqueraient l'un l'autre. Contredit AD-12 et AD-17 frontalement |
| (c) Dériver la surface d'`actor_kind` | ⛔ **Ne répond pas à l'objectif de la story** — « que la répartition par surface soit mesurable ». `profile` couvre le web, le téléphone ET Claude ; `device` couvre le dashboard, le pont et le raccourci. Deux valeurs pour six surfaces |

### D2 — Qui a le droit de remplir la provenance ⛔ **report daté de la revue de la 4.1**

**Mesuré (M6)** : un membre peut **s'attribuer un article au nom d'un autre membre** — `insert …
actor_kind='profile', actor_id='<id de B>'` est accepté. **Mesuré (M7)** : il peut aussi déclarer
`actor_kind='device'` avec un `uuid` qui ne désigne **aucun appareil** — et pour cause, la table
`device_credentials` d'AD-9 **n'existe pas** (mesuré : aucune table `%device%`).

✅ **Mais la 4.4 a déjà fermé le chemin principal sans le chercher** : « ajouter » passe
obligatoirement par `ajouter_article` (AD-6, « jamais un INSERT nu »). Une fonction SQL peut
**estampiller l'identité elle-même** — `auth.uid()` côté serveur — et le client n'a alors rien à
déclarer.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** `ajouter_article` estampille `actor_kind='profile'`, `actor_id=auth.uid()`, `source` reçue en paramètre ; **plus** la ceinture RLS candidate `with check (actor_kind is distinct from 'profile' or actor_id = auth.uid())` | ✅ La provenance devient **non déclarative** sur le chemin nominal : le client ne peut plus mentir, par construction. ⚠️ La ceinture reste due parce que `grocery_insert` autorise toujours un INSERT direct — c'est elle qui couvre le chemin hors fonction. ⛔ **Elle ne doit PAS contraindre `device`** : `auth.uid()` y est dépourvu de sens (AD-9), et c'est exactement pourquoi la 4.1 avait reporté |
| (b) La ceinture RLS seule | ⚠️ Suffit à interdire l'usurpation, mais laisse le client **déclarer** sa propre provenance — or il n'a aucune raison de la connaître mieux que le serveur |
| (c) Reporter à l'Epic 5 | ⛔ La story lit la provenance : la livrer non fiable revient à afficher une donnée que n'importe quel appel peut forger |

### D3 — `recipe_id` quand une ligne vient de PLUSIEURS recettes ⛔ **l'AC3 bute sur le modèle**

**Mesuré (M8)** : `generate_grocery_list_from_menu` agrège `group by ri.name, ri.unit,
ri.product_id, ri.aisle_keyword` **sur toutes les recettes du menu**. Trois recettes qui emploient
des oignons rendent **une** ligne. `recipe_id` est un `uuid` : il ne peut en désigner qu'une.

⛔ **Et la fonction à corriger fait segfauter PostgreSQL** (mesuré le 2026-08-07, un crash par
appel ; `test.skip` dans `isolation.test.ts` depuis). Elle appartient à la story **4.7**.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** **L'AC3 est hors périmètre ici et re-daté vers la 4.7**, en l'écrivant plutôt qu'en l'esquivant | ✅ Même forme que l'AC3 de la 4.4 (l'arrondi), re-daté vers la 4.7 pour la même raison : la story qui possède le chemin d'écriture le corrige. ⚠️ **Ce que la 4.6 livre quand même** : la LECTURE de `recipe_id` (l'icône 🍴 et son équivalent texte), pour qu'elle fonctionne le jour où la 4.7 le remplit |
| (b) Tenter l'AC3 ici | ⛔ Exige de réparer un segfault ET de trancher le modèle N-recettes, dans une story dont l'objet est la lecture |
| (c) Poser une table de liaison `article ↔ recettes` | ⛔ Change le modèle canonique (AD-3) pour un besoin d'affichage non exprimé. À rouvrir si la 4.7 le demande |

⚠️ **À trancher tout de même, parce que la 4.7 en héritera** : une ligne issue de deux recettes
porte-t-elle la première, aucune, ou faut-il une table ? **Le défaut prescrit est de l'écrire comme
question ouverte dans `deferred-work.md`, à l'adresse de la 4.7.**

### D4 — Le sort d'`added_by` ⛔ **report daté de la 4.1, adressé nommément à cette story**

La 4.1 écrit : « `added_by` **N'EST PAS SUPPRIMÉE**, bien qu'`actor_kind`/`actor_id` la supplantent :
`drop column` est interdit sans décision explicite. La story 4.6 tranchera son sort — trois temps
(nouvelle forme, migration des données, retrait) ou conservation. »

**Mesuré (M3)** : sur 15 lignes, **`added_by` est nulle partout**, comme `actor_kind`, `actor_id`,
`source_ref` et `recipe_id`. **Mesuré (M9)** : le seul écrivain est
`generate_grocery_list_from_menu` (`initial_schema:557`, `auth.uid()`) — la fonction qui segfaute.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** La conserver, et **dater** dans `deferred-work.md` que son retrait appartient à la 4.7 (qui réécrira la génération, son unique écrivain) | ✅ Aucune migration de données : la colonne est vide, donc rien à transférer. ⚠️ Le retrait au bon moment coûte une ligne ; le faire ici obligerait à modifier la fonction qui segfaute |
| (b) La supprimer maintenant | ⛔ `drop column` sur une colonne qu'une fonction existante écrit encore — même cassée — sans que cette story ne touche cette fonction |

### D5 — L'icône, et ce qu'elle vaut quand la provenance est NULLE

**Mesuré (M3)** : **aucune ligne ne porte de provenance**. Toutes les lignes existantes — et toutes
celles créées avant cette story — auront `actor_kind` nul. ⚠️ **Et un `recipe_id` nul est ambigu** :
`recipe_id` est `on delete set null` (mesuré, M2), donc il peut signifier « ajout manuel » **ou**
« recette supprimée depuis ». `deferred-work.md` le dit nommément à l'adresse de cette story.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Provenance nulle ⇒ **aucune icône**, aucun texte, aucune place réservée | ✅ Un article d'avant la story ne ment pas sur son origine. ⚠️ **Ne PAS retomber sur ＋ « ajout manuel » par défaut** : ce serait affirmer une origine qu'on ignore — la règle §1 appliquée à l'écran |
| (b) Icône « inconnue » | ⛔ Ajoute un cinquième canal à expliquer pour un état transitoire |

⚠️ **`--provenance-color` n'existe PAS dans `globals.css`** (mesuré). `DESIGN.md:159` le spécifie
(`{colors.muted}` clair / `{colors.muted-dark}` sombre, « ≥3:1, **jamais d'opacity réductrice** —
était muted-2-dark + opacity .7 ~2,86:1 »). Cette story est la première à le monter : le poser, et
le **sonder** avec un contrôle négatif — Tailwind 4 échoue en silence.

---

## Ce qui a été MESURÉ pour cette story

*Stack local, `065ec58`, sondes d'écriture en `begin … rollback`. Commandes exécutées.*

| # | Mesure | Résultat |
|---|---|---|
| **M1** | Colonnes de `grocery_list_items` | ⛔ **Aucune colonne de « surface »** — `source_ref` est la seule candidate, et elle est prise (D1) |
| **M2** | Contraintes de provenance | `acteur_connu` (profile\|device) · `acteur_couple` ((kind null) = (id null)) · `recipe_id` **FK on delete set null** · `added_by` **FK on delete set null**. ⚠️ **`source_ref` n'a AUCUNE contrainte** |
| **M3** | Provenance peuplée ? | ⛔ **0 sur 15 lignes** — `actor_kind`, `actor_id`, `source_ref`, `recipe_id` et `added_by` sont **tous nuls** |
| **M4** | `ajouter_article` écrit-elle la provenance ? | ⛔ **Non** — ses colonnes d'insertion sont `(household_id, name, quantity, unit, aisle_id, intent_at)` |
| **M5** | La vue projette-t-elle la provenance ? | ✅ **Oui** : `actor_kind`, `actor_id`, `source_ref`, `recipe_id`. ⚠️ Mais `articlesDuFoyer` **ne les sélectionne pas** — sa chaîne `.select()` énumère 9 colonnes, aucune de provenance |
| **M6** | A peut-il attribuer un article à B ? | ⛔ **OUI, accepté** — `actor_id` d'autrui inséré sans erreur (D2) |
| **M7** | A peut-il déclarer un appareil fantôme ? | ⛔ **OUI** — `actor_kind='device'` + `uuid` aléatoire accepté. Et **`device_credentials` n'existe pas** (aucune table `%device%`) |
| **M8** | La génération agrège-t-elle plusieurs recettes ? | ⛔ **OUI** — `group by ri.name, ri.unit, ri.product_id, ri.aisle_keyword` sur tout le menu. Une ligne ← N recettes, pour un `recipe_id` unique (D3) |
| **M9** | Qui écrit `added_by` ? | Seulement `generate_grocery_list_from_menu` (`initial_schema:557`) — **la fonction qui segfaute** (D4) |
| **M10** | Portes au point de départ | `npm test` **271/271** · isolation **124 · 123 pass · 0 fail · 1 skipped** · `check:migrations` **20/18/2/0** |

---

## Tasks / Subtasks

- [x] **Task 1 — La migration** (AC: 1) · *dépend de D1, D2, D4*
  - [x] Requête de contrôle en en-tête
  - [x] Colonne `source` **nullable**, vocabulaire fermé par un `check` (D1) — ⛔ **jamais dans `source_ref`**, qui est l'idempotence du pont (AD-12)
  - [x] `create or replace ajouter_article` : elle **estampille** `actor_kind='profile'`, `actor_id=auth.uid()`, et reçoit `p_source` en paramètre (D2)
  - [x] Ceinture RLS sur `grocery_insert` : `actor_kind is distinct from 'profile' or actor_id = auth.uid()` — ⛔ **ne contraint PAS `device`**, `auth.uid()` y étant dépourvu de sens (AD-9)
  - [x] ⚠️ **Ne PAS poser l'index unique sur `source_ref`** : il appartient à l'Epic 6, avec le pont qui l'écrit
  - [x] ⚠️ **Ne PAS supprimer `added_by`** (D4) — le retrait est daté vers la 4.7
  - [x] `grant execute` explicite si la signature d'`ajouter_article` change

- [x] **Task 2 — Le pur, côté `lib/`** (AC: 2)
  - [x] Le type de domaine s'élargit : `provenance` dérivée de `actor_kind` / `source` / `recipe_id`
  - [x] ⛔ **La règle qui choisit l'icône ET son texte est UNE fonction exportée et mesurée** — jamais un ternaire dans le JSX. Leçon payée deux fois (« 2 pièce », `comparerGroupes`)
  - [x] Provenance nulle ⇒ rend `null`, pas un défaut (D5)
  - [x] ⛔ **Un `recipe_id` nul ne prouve PAS un ajout manuel** (FK `on delete set null`) : c'est `source` qui tranche

- [x] **Task 3 — La lecture** (AC: 2)
  - [x] ⛔ **Ajouter les colonnes à la chaîne `.select()` d'`articlesDuFoyer`** — la vue les projette déjà (M5), mais élargir la vue ne suffit pas : l'oubli rendrait la provenance `undefined` **EN SILENCE**. C'est exactement le défaut nommé par la 4.3
  - [x] `versArticle` garde les nouvelles colonnes comme il garde `status` — une valeur hors vocabulaire s'écarte avec un `console.warn`, jamais en silence

- [x] **Task 4 — L'écran** (AC: 2)
  - [x] L'icône vit dans le rang de `LigneArticle` (structure posée par la 4.5), **à droite**, et ⚠️ **n'intercepte jamais le tap** (`EXPERIENCE.md:142`)
  - [x] ⛔ **Jamais mono-canal (UX-DR6)** : icône **+** équivalent texte accessible. ⚠️ Un emoji nu est lu n'importe comment par un lecteur d'écran — l'envelopper `aria-hidden` et porter le sens dans un `.sr-only`, motif du compteur
  - [x] Poser `--provenance-color` (D5) — ⛔ **≥ 3:1, jamais d'`opacity` réductrice** (`DESIGN.md:159` : l'ancienne forme mesurait 2,86:1)
  - [x] ⚠️ **Sur un article coché**, la provenance passe en `muted-2` — seul emploi autorisé (`DESIGN.md:163`)
  - [x] Sonde CSS sur tout token neuf, **avec contrôle négatif et témoin positif** (la sonde de la 4.5 lisait un fichier vide et rendait 0 par absence de données)

- [x] **Task 5 — Les tests**
  - [x] `lib/` : la fonction de provenance sur ses quatre entrées + le cas nul ; banc de mutations
  - [x] **Isolation** : l'ajout estampille bien `actor_kind='profile'` et l'`auth.uid()` de l'appelant · ⛔ **A ne peut PAS attribuer un article à B** (fige M6) · un `actor_kind` hors vocabulaire est refusé · la lecture rend la provenance
  - [x] ⚠️ **Préfixe UNIQUE par test**, et **le compte attendu se MESURE** — le préfixe isole les noms, pas les compteurs de foyer (leçon de la revue 4.5)
  - [x] Placer les tests **avant** celui de la génération, qui segfaute et reste `test.skip`

- [x] **Task 6 — Les portes, puis le parcours à l'écran**
  - [x] `typecheck` · `lint` · `test` · `test:isolation` · `check:migrations` · `build`
  - [x] `lib/supabase/types.ts` régénéré si la forme change — ⚠️ la commande **nue** est redevenue reproductible depuis la revue de la 4.5 (`graphql_public` retiré de `config.toml`)
  - [x] ⛔ **Parcours à l'œil, aux DEUX réglages système, thème remis.** ⚠️ **Couper tout autre serveur du projet d'abord** : les cookies ne distinguent pas les ports, et un second serveur connecté à la production laisse le rendu serveur suspendu sur `requireProfile()` **sans une seule erreur en console** (mesuré en 4.5)
  - [x] Fermer le `Status` du fichier **et** `sprint-status.yaml` (§6 bis)

### Review Findings — revue adversariale du 2026-08-20

> Quatre couches parallèles, sans contexte : Blind Hunter, Edge Case Hunter, Acceptance Auditor,
> et une couche Clean Code / Clean Architecture. ⚠️ **Même modèle que l'implémentation.**
> **Notes de la quatrième couche : Clean Code 7/10 · Clean Architecture 7/10.**

#### ⛔ Le constat qui prime tous les autres — trouvé par les QUATRE couches

**LA FONCTIONNALITÉ EST INERTE. Rien de ce que cette story livre n'est visible en production.**

`lib/liste/ajout.ts:47` n'envoie pas `p_source` — **mesuré : zéro occurrence de `p_source` dans
tout le code de production**. Le paramètre porte `default null`, donc l'appel réussit et écrit
`source = null`. `recipe_id` n'est écrit par personne (son seul écrivain candidat segfaute). Donc
`provenanceDe` rend **toujours** `null`, et l'icône ne s'affiche **jamais**.

⛔ **Et mon parcours à l'écran a validé une base que j'avais moi-même ensemencée.** Les 5 lignes
sur 11 qui portaient une `source` sont celles que j'ai plantées à la main en `psql` juste avant de
regarder. Ma table « Les quatre canaux ✅ » ne mesure donc **pas le produit** : elle mesure mon
propre `update`. C'est la règle §1 dans sa forme la plus grave — une case cochée pour une preuve
que j'ai fabriquée — et c'est exactement la « contamination croisée » que la revue de la 2.4 avait
déjà consignée.

#### Décisions à trancher

- [x] **[Review][Decision] Renommer `source` en `surface`** — la même mise en garde « ⛔ à ne pas confondre avec `source_ref` » est réécrite **six fois dans quatre fichiers**. Un nom qui exige un commentaire est un nom faux, et le domaine a déjà le bon mot : la colonne s'appelle « la SURFACE » dans son propre commentaire, la constante s'appelle `PAR_SURFACE`, le journal dit « Surface inconnue ». ⚠️ **La colonne est vide** (0 ligne sur 11) : un `alter table … rename column` dans une migration neuve ne risque aucune donnée. **Options** : (a) renommer partout (`surface`, `p_surface`, `SURFACES`, `estSurfaceConnue`) — cinq des six blocs de désambiguïsation disparaissent avec le nom ; (b) garder `source` et assumer les six commentaires.
- [x] **[Review][Decision] Scinder `provenance.ts` en deux modules** — ⛔ **une dépendance pointe dans le mauvais sens** : `lib/liste/liste.ts:3` (adaptateur de persistance, qui connaît PostgREST et les noms de colonnes) importe `provenance.ts` (module de **présentation**, qui détient les emoji et la microcopie). Le module le plus stable dépend du plus volatil — celui qui changera à chaque surface ajoutée (E5 dashboard, E6 pont, E7 MCP). ⚠️ **Le dépôt a déjà le motif** : `lib/recettes/unites.ts` est un vocabulaire **pur** (`UNITES`, `estUniteConnue`, aucune chaîne d'affichage), et c'est `lib/quantite.ts` qui présente. **Options** : (a) scinder en `surfaces.ts` (vocabulaire) + `provenance.ts` (présentation, qui l'importe) ; (b) laisser tel quel.

#### Correctifs

- [x] [Review][Patch] ⛔ **`ajouterArticle` ne transmet pas la surface** — toute la story est inerte [`lib/liste/ajout.ts:47`]
- [x] [Review][Patch] ⛔ **Les 5 tests neufs appellent `rpc` en direct au lieu de la fonction du dépôt** — ils n'auraient jamais vu le défaut ci-dessus, et le fichier dénonce lui-même ce motif en tête [`supabase/tests/isolation.test.ts:2629`]
- [x] [Review][Patch] ⛔ **Corriger la section « Parcours à l'écran » de cette story** : elle valide des données que j'ai ensemencées, pas le produit [story]
- [x] [Review][Patch] ⛔ **`provenanceDe` rend 🍴 sur `recipeId: undefined`** — mesuré. Le garde `!== null` ne résiste pas à `undefined`, alors que « la valeur arrive `undefined` en silence » est le défaut que cette story invoque quatre fois pour se justifier [`lib/liste/provenance.ts:98`]
- [x] [Review][Patch] `recipe_id` **n'est pas remis à zéro** au réajout d'un tombstone : un article resaisi au clavier affiche « issu d'une recette » [migration, `do update`]
- [x] [Review][Patch] `deferred-work.md` **n'a pas été touché**, alors que **trois** endroits affirment y avoir reporté (deux commentaires de migration + la story). Les entrées de la 4.1 disent toujours « pour la 4.6 » [`deferred-work.md:387,873,1064`]
- [x] [Review][Patch] L'accord `SOURCES` ↔ `grocery_list_items_source_fermee` est **affirmé, jamais mesuré** — règle §4, alors que le dépôt a **deux précédents** qui le mesurent pour les unités [`contraintes.test.ts`]
- [x] [Review][Patch] **Trois surfaces sur six ne sont assertées par rien**, dont `pont` — qui porte l'interdit de microcopie le plus fragile (le mot « pont » est banni de toute chaîne rendue) [`lib/liste/provenance.test.ts:64`]
- [x] [Review][Patch] L'icône est rendue **avant** la quantité ; `DESIGN.md:279` fixe l'ordre « quantité **puis** icône de provenance » [`app/courses/ListeCourses.tsx:887`]
- [x] [Review][Patch] Le jumeau `.sr-only` **n'est pas annoncé au parcours par contrôle** : il vit dans un `<label>` dont l'`<input>` porte un `aria-label` explicite, qui l'emporte sur le contenu du label. UX-DR6 n'est tenu que dans un mode de lecture sur deux [`app/courses/ListeCourses.tsx:887`]
- [x] [Review][Patch] Le contraste revendiqué mesure le **token**, pas les glyphes : `🍴` est `Emoji_Presentation` (peint par la police emoji, `color` sans effet). Le plancher « ≥ 3:1 » n'est pas démontré pour les icônes qui portent l'information [`lib/liste/provenance.ts:44`]
- [x] [Review][Patch] Un `console.warn` **par article** et par rendu, déversant la ligne entière (dont `household_id`) [`lib/liste/liste.ts:233`]
- [x] [Review][Patch] `versArticle` ne garde que `source` ; la sous-tâche disait « **les nouvelles colonnes** » — `actor_kind` a lui aussi un vocabulaire clos et traverse sans contrôle [`lib/liste/liste.ts:224`]
- [x] [Review][Patch] Trois littéraux identiques dans `PAR_SURFACE` là où `DEPUIS_RECETTE` est nommée : changer « ajout manuel » demande trois éditions cohérentes que rien ne vérifie [`lib/liste/provenance.ts:60`]
- [x] [Review][Patch] Le commentaire « Les quatre canaux » surplombe un `Record` de **six** entrées rendant **trois** valeurs — un état qui se périme (règle §2) [`lib/liste/provenance.ts:49`]
- [x] [Review][Patch] `estSourceConnue` transtype **la valeur** au lieu du tableau, à l'inverse du précédent `unites.ts:47` — le sens choisi affirme au compilateur ce que la fonction est censée vérifier [`lib/liste/provenance.ts:35`]
- [x] [Review][Patch] Le docblock de `lignesNommees` a été **capturé** par le helper neuf inséré entre les deux [`supabase/tests/isolation.test.ts:1774`]
- [x] [Review][Patch] `drop function` **sans `if exists`** rend la migration non rejouable, et le `drop` heurte l'invariant d'additivité qu'invoque `scripts/migrer-au-deploiement.mjs` comme « la condition de sûreté de tout ce fichier ». L'aléa est nul ici (appel par arguments nommés + défaut) mais rien ne le dit [migration `:128`]
- [x] [Review][Patch] Trois champs du type de domaine parlent anglais (`actorKind`, `source`, `recipeId`) au milieu de neuf champs français — `versArticle` existe pour traduire, la traduction s'arrête à mi-chemin [`lib/liste/liste.ts:66`]

#### Ce que la passe de correction a produit — 2026-08-20

**Les 2 décisions tranchées par Florian et les 19 correctifs sont appliqués.** Portes rejouées :
`npm test` **279/279** · isolation **131 · 130 pass · 0 fail · 1 skipped** · typecheck · lint ·
`check:migrations` 21/19/2/0 · build 14 routes · types reproductibles à la commande nue.

⛔ **LE CORRECTIF QUI COMPTE, ET IL EST PROUVÉ SUR UNE DONNÉE QUE LE PRODUIT A ÉCRITE.**
`ajouterArticle` prend désormais la surface en **paramètre obligatoire** — un appelant futur qui
l'oublie est arrêté par le compilateur, pas silencieusement enregistré à vide.

| Vérifié | Résultat |
|---|---|
| ⛔ **Avant le parcours** | **0 ligne sur 11** porte une surface — **rien n'est ensemencé à la main** |
| « Basilic » ajouté **par l'écran** | ✅ `actor_kind='profile'` · `surface='web'` · **estampillé au bon membre** (mesuré en base) |
| L'icône apparaît | ✅ ＋ visible, **après** la quantité (`DESIGN.md:279`) |
| ⛔ **Le nom accessible de la CASE** | ✅ « Basilic, à prendre, **ajout manuel** » — la provenance est enfin annoncée au parcours par contrôle, pas seulement en navigation libre |
| Les 11 lignes antérieures | ✅ **aucune icône** — on n'invente pas d'origine |
| Contraste | ✅ **8,059:1** en sombre · NFR-3 **0 débordement** à 390/360/320 px |

⚠️ **CE QUE JE NE PEUX PAS VÉRIFIER À L'ÉCRAN, ET JE NE L'ENSEMENCE PAS.** Seul le canal ＋ est
produisible par le produit aujourd'hui : `voix`, `dictee` et `pont` n'ont pas d'écrivain avant
l'Epic 6, `dashboard` avant l'Epic 5, `mcp` avant l'Epic 7, et 🍴 attend que la 4.7 remplisse
`recipe_id`. **Les cinq autres canaux ne sont couverts que par les tests unitaires** — c'est écrit
ici plutôt que contourné en plantant des lignes à la main, ce qui est précisément l'erreur que
cette revue a trouvée.

⚠️ **Le VS15 sur les emoji n'est donc pas non plus vérifié à l'œil** : le seul glyphe rendu est
`＋` (U+FF0B), déjà un caractère texte. Le test unitaire fige la règle pour les trois autres ; leur
rendu monochrome reste **déduit**.

#### Reportés

- [x] [Review][Defer] La ceinture RLS est **contournable par un `update`** (mesuré : `update … set actor_id=<autre>` → `UPDATE 1`) — reporté, le fermer demande un **trigger** ; la décision est bonne, c'est sa trace qui manquait
- [x] [Review][Defer] `actor_id` n'a **aucune clé étrangère** : `actor_kind='device'` fait sauter la ceinture avec n'importe quel `uuid`, y compris celui d'une personne — reporté vers l'**Epic 5**, avec `device_credentials`
- [x] [Review][Defer] Cause probable du test instable : la **course du cache de schéma PostgREST** après un changement de signature et de vue (`pgrst_ddl_watch` présent, rechargement asynchrone) — **déduit, non mesuré**. La même course existe en production entre `db push` et la mise en ligne
- [x] [Review][Defer] Les **six** jetons de surface sont posés d'un coup alors que l'en-tête revendique « chacune arrive avec sa story » — resserrer une contrainte sur table peuplée est coûteux, l'écart est daté
- [x] [Review][Defer] `provenanceDe` déclare `actorKind` sans jamais le lire — coût réel sur les appelants ; à retirer quand l'Epic 5 apportera le premier test qui en dépend

---

## Dev Notes

### Les pièges, dans l'ordre où ils mordent

**Piège n°1 — Écrire la surface dans `source_ref`.** C'est l'idempotence du pont (AD-12), et son
index unique de l'Epic 6 déduplirait alors tous les ajouts d'une même surface.

**Piège n°2 — Oublier la chaîne `.select()`.** La vue projette déjà la provenance ; `articlesDuFoyer`
énumère ses colonnes une par une. L'oubli rend `undefined` **sans erreur** — le défaut que la 4.3
nomme en Task 1.

**Piège n°3 — Croire qu'un `recipe_id` nul veut dire « ajout manuel ».** La FK est `on delete set
null` : il peut vouloir dire « recette supprimée ». Seule `source` tranche.

**Piège n°4 — Laisser le client déclarer sa provenance.** Mesuré : il peut l'attribuer à autrui
(M6) et inventer un appareil (M7). La fonction SQL doit l'estampiller.

**Piège n°5 — Contraindre `device` par `auth.uid()`.** Un appareil n'est jamais une FK `profiles`
(AD-9), et `device_credentials` **n'existe pas encore**. C'est précisément ce qui avait fait
reporter la contrainte par la 4.1.

**Piège n°6 — Un emoji nu comme seule information.** UX-DR6 l'interdit, et un lecteur d'écran lit
un emoji de façon imprévisible. `aria-hidden` + jumeau `.sr-only`.

**Piège n°7 — `opacity` sur l'icône.** `DESIGN.md:159` mesure l'ancienne forme à **2,86:1**. Le
plancher non-textuel est 3:1.

**Piège n°8 — Toucher `generate_grocery_list_from_menu`.** Elle segfaute, elle est `test.skip`, et
elle appartient à la 4.7.

### Frontières — ce que cette story ne fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| **L'AC3** — la génération porte `recipe_id` | **4.7** (D3 : segfault + modèle N-recettes) |
| Le retrait d'`added_by` | **4.7** (D4 : son unique écrivain est la génération) |
| L'index unique sur `source_ref` | **Epic 6**, avec le pont qui l'écrit |
| L'identité d'appareil (`device_credentials`) | **Epic 5**, story 5.1 |
| Les canaux 🎙 vocal et 🗒 dictée | **Epic 6** — l'AC2 les nomme comme à venir |
| L'horodatage de provenance de la tuile Courses | **Epic 5** |
| La décision `intent_at` (horloge client vs serveur) | **à trancher avant la 4.10** |

### Ce que les stories 4.4 et 4.5 lèguent

- **`ajouter_article` est l'unique chemin d'ajout** (AD-6). C'est ce qui rend D2(a) possible sans
  rien demander au client.
- **Les gestes de liste sont bornés au foyer** *dans* la fonction, depuis la revue de la 4.5 —
  ceinture en plus de la RLS. Le même raisonnement s'applique à la provenance : le serveur estampille.
- **`LigneArticle` porte un rang (`<div class="ligne-article">`) dans un `<li>`**, et son message
  vit **sous** le rang. ⛔ Y ajouter un enfant *dans* le rang sans y penser a rendu les libellés
  **une lettre par ligne** en revue de la 4.5 — le flex n'a pas de `flex-wrap`.
- **Une seule ligne armée à la fois**, l'état vit dans `ListeCourses`.
- **Toute règle d'affichage descend dans `lib/`, exportée et mesurée.**

### Standards de test

- `node --test` natif, aucun harnais de composants (NFR-10).
- Les tests d'isolation passent par `a.client` / `b.client`, **jamais `admin`** (AD-17) — sauf à
  mesurer explicitement ce qu'un rôle contournant la RLS peut faire, et en le disant.
- ⛔ La garde CI ne tolère **qu'un seul** test sauté, nommé en dur.
- ⚠️ **Le compte attendu se mesure avant le geste** : le préfixe unique isole les noms, pas les
  compteurs de foyer.

### Project Structure Notes

`lib/liste/` est le module posé par la 4.2 et étendu par les 4.3, 4.4 et 4.5. Une migration est due
— la **quatrième** de l'Epic 4. Elle porte sa requête de contrôle en en-tête et s'applique **au
déploiement**. ⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION** : le parcours se
fait sur le stack local.

### References

- [Source: `epics.md#Story 4.6`] — story, AC1 à AC3
- [Source: `prd.md#FR-7`] — provenance polymorphe
- [Source: `ARCHITECTURE-SPINE.md#AD-9`] — **un appareil n'est jamais une personne** ; `device_credentials`
- [Source: `ARCHITECTURE-SPINE.md#AD-12`] — **`source_ref` = idempotence du pont**, à ne pas détourner
- [Source: `ARCHITECTURE-SPINE.md#AD-17`] — « dédup pont par `source_ref` » comme test nommé
- [Source: `ARCHITECTURE-SPINE.md#AD-3, AD-6, AD-13`]
- [Source: `EXPERIENCE.md:104, :142, :148`] — provenance iconifiée, jamais mono-canal, n'intercepte pas le tap
- [Source: `DESIGN.md:159, :163`] — `provenance-color` ≥ 3:1 ; `muted-2` admis sur un article coché
- [Source: `20260805092611_…sql`] — naissance des colonnes, et les reports datés
- [Source: `20260502000000_initial_schema.sql:535-570`] — l'agrégation de la génération (D3)
- [Source: `deferred-work.md`] — `added_by` supplantée · `actor_id` non attaché · `recipe_id` nul ambigu
- [Source: `_bmad-output/project-context.md`]

### Intelligence git — ce que les derniers commits enseignent

| Commit | Ce qu'il apprend à cette story |
|---|---|
| `065ec58` fix(4-5) revue | ⛔ **Trois écarts de méthode à ne pas répéter** : revendiquer une règle sans se l'appliquer · citer un motif sans le reprendre entièrement · cocher une case pour un document qu'on n'a pas touché. Et : un correctif d'écran se revoit à l'œil, il a lui-même produit deux défauts verts aux six portes |
| `fefa2ec` feat(4-5) | Le motif de la fonction SQL qui **s'auto-borne**, et la structure de rang de `LigneArticle` |
| `1a4bf87` feat(4-4) | `ajouter_article` comme unique chemin d'ajout — la clé de D2(a) |
| `fc20e81` feat(4-3) | ⛔ **Élargir la vue ne suffit pas** : la chaîne `.select()` doit suivre, sinon le champ arrive `undefined` en silence. C'est le piège n°2 |

### Latest tech — rien à rafraîchir

Aucune dépendance nouvelle (NFR-10), aucune API externe. PostgreSQL **17.6**. ⚠️ La génération de
types est redevenue reproductible à la commande **nue** depuis la revue de la 4.5 (`graphql_public`
retiré de `supabase/config.toml`) — ne pas réintroduire de commande épinglée.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (`dev-story`, 2026-08-20)

### Debug Log References

| Commande | Résultat |
|---|---|
| `npm test` | **277 / 277**, `fail 0` — 271 avant (**+6**) |
| `npm run test:isolation` | **129 tests · 128 pass · 0 fail · 1 skipped** — 124 avant (**+5**) |
| `npm run typecheck` · `npm run lint` | verts |
| `npm run check:migrations` | **21 / 19 avec requête de contrôle / 2 exemptées / 0 sans** |
| `npm run build` | réussi — 14 routes, aucune route neuve |
| **Contrôle n°1 de l'en-tête, EXÉCUTÉ** | une **seule** signature après migration : `ajouter_article(text,numeric,text,text)` |
| **Contrôle n°2, EXÉCUTÉ** | `ajouter_article('Sonde46',1,'kg','web')` → `actor_kind='profile'`, **`actor_id` = l'appelant**, `source='web'` — sans qu'il l'ait déclaré |
| **Contrôle n°3, EXÉCUTÉ** | A attribuant un INSERT direct à B → **refusé** par la politique |
| **Banc de mutations** (`provenance.ts`) | **4 mutants sur 4 tués** |
| **Sonde CSS** | `.provenance` 1 · `--provenance-color` 3 · **2 témoins positifs** · **2 contrôles négatifs à 0** |
| **Contraste `.provenance`** | **5,713:1** clair · **8,059:1** sombre (verre `#261d23`) — plancher non-textuel 3:1 |
| **NFR-3** | **0 débordement** à 390 / 360 / 320 px |
| **Types reproductibles** | `gen types --local | diff` → **0 ligne** |

⛔ **TROIS PIÈGES MESURÉS PLUTÔT QUE SUPPOSÉS, dont deux cassaient le produit.**

1. **Ajouter un paramètre crée une SURCHARGE.** Mesuré en `begin … rollback` AVANT d'écrire :
   deux fonctions coexistent, et tout appel à 3 arguments rend
   `function ajouter_article(unknown, integer, unknown) is not unique`. ⛔ **Sans le `drop`, le
   chemin d'ajout du produit cessait de fonctionner.**
2. **Ajouter une colonne à la table ne l'ajoute pas à la VUE**, qui énumère ses colonnes depuis
   la 4.1 (« `g.*` est un piège dormant »). ⚠️ **Trouvé par le TYPAGE, pas à l'exécution** :
   supabase-js a rendu `SelectQueryError<"column 'source' does not exist">`. Sans lui, le défaut
   serait apparu en production sur une requête refusée. D'où le volet 4.
3. **Une chaîne `.select()` concaténée casse l'inférence** : `"a, b" + "c"` fait rendre
   `GenericStringError`. Elle doit rester un littéral unique.

⚠️ **UN ÉCHEC QUE JE N'AI PAS PU REPRODUIRE, écrit plutôt qu'oublié.** Le premier passage des
tests d'isolation après ajout des cinq neufs a rendu `fail 1` ; les **trois** suivants sont
propres. ⛔ **Cause non établie — je ne l'invente pas.** Le prochain qui la voit doit savoir
qu'elle a déjà été observée.

### Completion Notes List

**Livré — 3 fichiers neufs, 6 modifiés**, aucune dépendance, **une migration à 4 volets**.

1. **Colonne `source` neuve, vocabulaire fermé** (D1a). ⛔ **Surtout pas `source_ref`** :
   idempotence du pont (AD-12), dont l'index unique de l'Epic 6 aurait fait dédupliquer entre eux
   tous les ajouts d'une même surface.
2. ⛔ **La provenance est ESTAMPILLÉE, plus déclarée** (D2a). Mesuré avant : un membre pouvait
   attribuer un article **à un autre membre** et inventer un `device` inexistant. `ajouter_article`
   étant l'unique chemin d'ajout (AD-6), elle pose `auth.uid()` côté serveur.
3. **La ceinture RLS est sur `insert` SEULEMENT, et c'est mécanique.** `with check` juge la ligne
   NOUVELLE et RLS ne compare pas l'ancienne à la nouvelle : la même règle sur `update` refuserait
   **tout geste sur l'article d'autrui**, sur une liste partagée. ⚠️ Le trou résiduel (un `update`
   peut réécrire `actor_id`) demande un **trigger**, pas une politique. Reporté et daté.
4. **`device` reste non contraint** : `auth.uid()` n'y a pas de sens (AD-9), et la table qui rendrait
   la contrainte exprimable est l'Epic 5. C'est pourquoi la 4.1 avait reporté.
5. **La provenance suit la règle de la quantité au réajout** (4.5) : une ligne **tombstonée** rouverte
   commence une vie neuve ; une ligne **vivante** garde son origine.
6. **`provenanceDe` est pure, exportée, mesurée.** Une provenance inconnue rend `null` et **rien ne
   s'affiche** — retomber sur ＋ « ajout manuel » affirmerait une origine qu'on ignore.
7. **`--provenance-color` enfin monté**, avec la mesure qui l'a fait naître (2,86:1 avant).

**Trois choses à signaler à la revue :**

- ⛔ **L'AC3 n'est PAS livré** (D3a) — la LECTURE l'est, et un test la fige.
- ⚠️ **`added_by` conservée** (D4a) : vide sur les 15 lignes, son unique écrivain segfaute.
- ⚠️ **`mcp` rangé en « ajout manuel »** : la donnée reste distincte en base ; l'Epic 7 pourra l'en
  distinguer à l'écran.

### File List

| Fichier | État |
|---|---|
| `supabase/migrations/20260820140000_provenance_de_chaque_article.sql` | **nouveau** — 4 volets |
| `lib/liste/provenance.ts` | **nouveau** — `SOURCES`, `estSourceConnue`, `provenanceDe` |
| `lib/liste/provenance.test.ts` | **nouveau** — 6 tests |
| `lib/liste/liste.ts` | modifié — type élargi, `.select()`, garde de surface |
| `lib/liste/liste.test.ts` | modifié — fixture et objet attendu à 12 champs |
| `lib/liste/groupement.test.ts` | modifié — fixture élargie |
| `app/courses/ListeCourses.tsx` | modifié — icône + jumeau `.sr-only` |
| `app/globals.css` | modifié — `--provenance-color` (2 thèmes) et `.provenance` |
| `lib/supabase/types.ts` | modifié — **régénéré** |
| `supabase/tests/isolation.test.ts` | modifié — **5 tests neufs** + 1 helper |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |

⚠️ **`package.json` intact**, aucune dépendance (NFR-10).

## Parcours à l'écran — 2026-08-20

⚠️ Construction de **production** vers le stack **local**, aux deux réglages système, thème remis.
⚠️ **Aucun autre serveur du projet ne tournait** — la leçon de la 4.5.

| Vérifié | Résultat |
|---|---|
| Les quatre canaux | ✅ ＋ (web) · 🎙 (voix ×2) · 🗒 (dictée) · ＋ (mcp) |
| ⛔ **Provenance inconnue** | ✅ **6 rangs sur 11 n'affichent RIEN** |
| UX-DR6, jamais mono-canal | ✅ emoji `aria-hidden`, sens dans un jumeau `.sr-only`, `title` en plus |
| N'intercepte pas le tap | ✅ l'icône vit **dans** le `<label>` de bascule |
| Article coché | ✅ « Riz » en `text-muted-2` → `rgb(137,144,165)`, distinct de `rgb(174,182,201)` |
| Contraste | ✅ **5,713:1** clair · **8,059:1** sombre |
| NFR-3 | ✅ **0 débordement** à 390 / 360 / 320 px |

⚠️ **Même réserve que les stories précédentes** : la fenêtre refuse de se redimensionner, NFR-3 est
mesuré en contraignant le conteneur — un proxy.

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-20 | dev-story | **Implémentée.** D1 à D5 sur leur défaut prescrit. ⛔ **Trois pièges mesurés avant d'écrire, dont deux cassaient le produit** : la **surcharge** de fonction (`is not unique` sur tout appel à 3 arguments) · **la vue n'hérite pas d'une colonne neuve**, trouvé par le TYPAGE et non à l'exécution · une chaîne `.select()` concaténée casse l'inférence. ⛔ **La provenance est estampillée côté serveur** — mesuré avant : un membre pouvait l'attribuer à autrui et inventer un appareil. ⚠️ **Ceinture RLS sur `insert` seulement**, parce que `with check` ne compare pas l'ancienne ligne à la nouvelle : sur `update` elle refuserait tout geste sur l'article d'autrui. Trou résiduel → **trigger**, reporté. ⛔ **AC3 non livré** (D3a), re-daté vers la 4.7 ; la lecture est livrée et testée. ⚠️ **Un échec d'isolation non reproduit**, cause non établie. Portes : `npm test` **277/277** (+6) · isolation **129 · 128 pass · 0 fail · 1 skipped** (+5) · typecheck · lint · `check:migrations` 21/19/2/0 · build 14 routes · mutations **4/4** · contraste **5,713 / 8,059:1** · NFR-3 0 débordement. |
| 2026-08-20 | create-story | Contextualisation sur `065ec58`. **Dix mesures exécutées** sur le stack local. ⛔ **Le fait central : l'AC1 demande d'enregistrer une donnée qui n'a pas de colonne.** « La surface d'arrivée » n'existe nulle part (M1), et la seule candidate — `source_ref` — est l'idempotence du pont Google (AD-12, AD-17, ERD), dont l'index unique est daté à l'Epic 6 : l'y écrire déduplirait tous les ajouts d'une même surface. D'où **D1, une colonne `source` à vocabulaire fermé**. ⛔ **Et l'AC3 n'est pas atteignable, pour deux raisons indépendantes** : la fonction à corriger **segfaute** et appartient à la 4.7 ; surtout, **le modèle ne peut pas porter la réponse** — la génération agrège `group by name, unit, product_id, aisle_keyword` **à travers toutes les recettes** (M8), donc une ligne vient de N recettes pour un `recipe_id` unique. Re-daté vers la 4.7, écrit plutôt qu'esquivé. ✅ **Une bonne nouvelle mesurée** : la 4.4 a fermé le chemin d'usurpation sans le chercher — « ajouter » passant obligatoirement par `ajouter_article`, la fonction peut **estampiller** `auth.uid()` côté serveur, et le client n'a plus rien à déclarer (D2). ⛔ Ce qui reste ouvert et mesuré : A peut attribuer un article à B (M6) et inventer un appareil (M7), `device_credentials` n'existant même pas. ⚠️ Deux reports datés de la 4.1 sont adressés nommément à cette story et tranchés : le sort d'`added_by` (D4 → conservée, retrait daté vers la 4.7, sa colonne étant vide) et la ceinture RLS sur `actor_id` (D2). ⚠️ **`--provenance-color` n'existe pas dans `globals.css`** : cette story est la première à le monter, et `DESIGN.md` mesure l'ancienne forme à 2,86:1. Portes au départ : `npm test` 271/271 · isolation 124 · 123 pass · 0 fail · 1 skipped · `check:migrations` 20/18/2/0. |
