---
baseline_commit: 4e65beb
---

<!-- Contextualisée le 2026-08-16, sur `4e65beb` — la tête de `feat/4-3`. La story 4.2 est
     fusionnée dans `main` ; la 4.3 est en revue (PR #28). Les douze mesures ci-dessous ont été
     exécutées sur le stack local, en `begin … rollback`, pas déduites. -->

<!-- ⛔ **LA CHOSE À SAVOIR AVANT TOUT LE RESTE : « AJOUTER » N'EST PAS UN `INSERT`.**
     AD-6, mot pour mot : « Agrégation = **UPSERT-incrémente sur la clé canonique**
     `(household_id, nom normalisé, unité)` : “ajouter” n'est **jamais** un INSERT nu (FR-5) ».
     Un `INSERT` sur une clé occupée rend `23505`, **mesuré** (M1, M5, M6). -->

<!-- ⛔ **ET LA CLÉ EST OCCUPÉE PAR DES LIGNES QUE L'ÉCRAN NE VOIT PAS.** L'index unique est
     TOTAL : il n'exclut ni les tombstones, ni les articles achetés. **Mesuré** : avec un
     `('Beurre','g','bought')` en place, insérer `('Beurre','g','pending')` rend `23505` (M5) ;
     idem avec un tombstone (M6). Or `grocery_list_by_aisle` filtrait `status = 'pending'`
     jusqu'à la 4.3 et filtre toujours `deleted_at is null`.
     **RÈGLE : lire la TABLE, jamais la vue, avant tout ajout.** Une surface qui lit la vue et
     écrit par INSERT recevra `23505` en désignant un article que sa propre lecture affirme
     absent — et le message d'erreur ne dira rien d'utile au membre. -->

<!-- ⚠️ **NE RECALCULE PAS LA CLÉ CANONIQUE CÔTÉ CLIENT.** Elle vit dans l'EXPRESSION de l'index,
     côté serveur. Un miroir applicatif serait une seconde source de vérité (AD-1/AD-6), et ses
     quatre opérations ne sont pas commutatives — NFC, puis retrait des invisibles, puis pliage
     des accents, puis `lower`. `deferred-work.md` le dit nommément pour cette story. -->

<!-- ✅ **CE QUI EST DÉJÀ LÀ ET QU'IL NE FAUT PAS RÉINVENTER** : l'index unique canonique avec
     `nulls not distinct` (4.1), la contrainte `grocery_list_items_unite_fermee`, le vocabulaire
     `UNITES` + `estUniteConnue` (`lib/recettes/unites.ts`), `normaliserQuantite` et son
     compagnon qui explique POURQUOI une saisie est refusée (`lib/recettes/saisie.ts`),
     `normaliserTexte` (`lib/texte.ts`), la politique `grocery_insert`, et `resolve_aisle_id`. -->

# Story 4.4: Ajouter un article avec agrégation et unités fermées

Status: review

<!-- ✅ **LES QUATRE DÉCISIONS PRISES SUR LEUR DÉFAUT PRESCRIT** le 2026-08-16, faute d'arbitrage
     au lancement de `dev-story` : D1(a) fonction SQL `security invoker` · D2(a) `quantity >= 0`
     posée ici · D3(a) `normaliserQuantite` déplacée vers `lib/quantite.ts` · D4(a) `resolve_aisle_id`
     appelée malgré `product_aisle_map` vide. ⚠️ **Et D1(a) referme au passage le défaut `intent_at`
     hérité de la 4.3** : `now()` dans une fonction SQL est l'horloge serveur, la même qu'à
     l'insertion.

     ⛔ **FERMÉE AVEC UNE CONDITION OUVERTE, DATÉE PLUTÔT QU'EFFACÉE** (§6 bis) :
     le **parcours à l'écran** n'a pas été fait. Sa sous-tâche est laissée NON COCHÉE avec sa
     raison (§1). `node supabase/seed-local.mjs` monte un foyer en une commande.
     Six choses à regarder, qu'aucun test ne peut établir : le bouton abricot `btn-action` dans
     les deux thèmes · les 44 px de sa cible tactile · les quatre messages de refus de quantité ·
     l'article qui APPARAÎT après ajout (relecture, pas devinette) · un réajout du même article
     qui INCRÉMENTE au lieu de doubler la ligne · le `<select>` d'unité au doigt.
     ⚠️ Les parcours des stories 4.2 et 4.3 sont eux aussi toujours dus — les trois se font d'un
     seul passage. -->

## Story

As a **membre du foyer**,
I want **qu'ajouter un article déjà présent additionne les quantités au lieu de créer un doublon**,
so that **la liste reste propre quelle que soit la surface d'ajout**.

## Acceptance Criteria

**AC1 — L'ajout est un UPSERT-incrémente, jamais un INSERT nu**

**Given** un article de même nom normalisé et même unité déjà présent
**When** un ajout survient depuis n'importe quelle surface
**Then** l'opération est un **UPSERT-incrémente** sur la clé canonique (AD-6) qui additionne les
quantités (FR-5), **jamais** un INSERT nu — sur tout chemin d'ajout, manuel compris

**AC2 — Le vocabulaire d'unités est fermé, et deux unités ne fusionnent jamais**

**Given** un ajout avec une unité
**When** il est traité
**Then** l'unité provient du **vocabulaire fermé** (g, kg, ml, L, pièce, cs, cc, pincée —
AD-7/FR-52) ; deux unités différentes ne sont jamais additionnées ni converties (deux lignes)

**AC3 — Le rayon est résolu par le serveur**

**Given** un article ajouté sans rayon explicite
**When** l'ajout est traité
**Then** le rayon est résolu par `resolve_aisle_id` (fonction serveur autoritaire, **câblée en
story 4.16**), et une quantité mise à l'échelle est arrondie à une valeur achetable (jamais
« 1,67 oignon »)

---

## Décisions ouvertes — chacune avec son défaut prescrit

> Le dev agent applique le **défaut prescrit** si Florian n'a pas tranché.

### D1 — La forme de l'UPSERT-incrémente ⛔ **la plus structurante**

**Le fond n'est PAS ouvert** : AD-6 impose que l'agrégation soit « autoritaire côté serveur
(fonctions SQL) ». Ce qui reste à trancher est la **forme**, et une contrainte technique élimine
d'emblée la voie client : **PostgREST ne sait pas incrémenter en upsert** — son `on_conflict`
écrase la valeur, il ne l'additionne pas. Un `quantity = ancienne + nouvelle` exige donc soit du
SQL, soit un lire-puis-écrire côté client.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Une fonction SQL `ajouter_article(...)` en **`security invoker`**, appelée en RPC | ⚠️ **`invoker`, PAS `definer`** : la RLS de l'appelant s'applique, donc `grocery_insert` et `grocery_update` restent seules garantes (AD-1/AD-2). ⛔ Une `security definer` devrait **recontrôler l'identité elle-même** — c'est le trou de `seed_default_aisles`, et le segfault de `generate_grocery_list_from_menu` montre ce que coûte une RPC mal née |
| (b) Lire la ligne puis l'écrire depuis le client | ⛔ **Course garantie** : deux surfaces qui ajoutent le même article en même temps liraient la même quantité et écriraient la même somme — une des deux additions serait perdue. C'est exactement ce que NFR-2 interdit. Et ça contredit AD-6 frontalement |
| (c) `on_conflict` de PostgREST | ⛔ **Ne fait pas ce qu'AC1 demande** : il écrase, il n'additionne pas. Listé pour que personne ne le redécouvre |

⚠️ **Si (a) : la fonction doit gérer le cas du tombstone et celui de l'article acheté.** « Rajouter
un article supprimé » est un `UPDATE` qui remet `deleted_at` à nul, jamais un INSERT. Et un article
`bought` réclamé par un ajout **redevient-il `pending` ?** Sous-décision à trancher — le défaut
prescrit est **oui** (on ajoute ce qu'on veut acheter), en le disant dans la story.

### D2 — La contrainte `quantity >= 0`

**Mesuré (M7)** : `insert … quantity = -5` est **accepté** aujourd'hui. La 4.1 a délibérément
laissé cette contrainte à cette story — « le critère du projet est : la valeur est-elle consommée
par un CALCUL ? Elle l'est, mais l'agrégation qui la consomme est la 4.4 ».

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** `check (quantity is null or quantity >= 0)` dans la migration de cette story | ⚠️ **`>= 0` et non `> 0`**, comme le dit le report : une quantité nulle n'a pas de sens mais n'est pas dangereuse. ⛔ **La fenêtre bon marché se referme ici** : la table est encore vide en production, donc c'est une contrainte simple. Après, c'est une migration de données |
| (b) Reporter encore | ⛔ Une addition sur des quantités négatives rend une somme fausse **sans erreur**, et le report dit lui-même que la fenêtre se ferme à la 4.4 |

⚠️ **Une seconde fenêtre se ferme en même temps**, et elle est adressée à la 4.5 :
`check (deleted_at is null or deleted_at >= created_at)`. **Mesuré en revue de la 4.1** : un
tombstone daté de 2999 est accepté. À poser dans la même migration ou à re-dater explicitement.

### D3 — Où vit `normaliserQuantite`

Elle est dans `lib/recettes/saisie.ts`. Cet écran d'ajout de COURSES en a besoin.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** La déplacer vers `lib/quantite.ts`, avec ré-export depuis `lib/recettes/saisie.ts` | ⚠️ **C'est exactement la décision D-5 de la revue de la 4.2**, qui a déplacé `formaterQuantite` pour la même raison : « l'import `@/lib/recettes/...` depuis un écran de courses rendait faux l'en-tête du module ». Le même argument, à l'identique. ⚠️ Emporter aussi le compagnon qui explique **pourquoi** une saisie est refusée — il existe parce que « Une quantité s'écrit en chiffres. » répondu à quelqu'un qui venait d'en écrire une enferme dans une boucle |
| (b) Importer depuis `lib/recettes/` | ⛔ Rend l'en-tête du module faux une seconde fois, et le dépôt vient de payer ce défaut |

### D4 — Le rayon, alors que `resolve_aisle_id` ne résout rien

**Mesuré (M11)** : `product_aisle_map` contient **0 ligne**, donc `resolve_aisle_id` rend `null`
pour tout. Les règles mot-clé → rayon sont la story **2.3**, et le câblage la **4.16**.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** L'appeler quand même, et laisser `null` remonter en « À classer » | ✅ Le chemin est écrit une fois, et la 2.3 le remplira sans toucher à cette story. « À classer » est un groupe de plein droit (4.2), donc l'écran sait déjà l'afficher |
| (b) Ne pas l'appeler, attendre la 4.16 | ⛔ La 4.16 devrait alors modifier le chemin d'écriture, c'est-à-dire cette story |

⚠️ **L'arrondi de l'AC3 n'appartient PROBABLEMENT PAS à cette story.** FR-52 rattache
explicitement l'arrondi aux « quantités mises à l'échelle **(FR-16)** », et FR-16 est la génération
depuis le menu — c'est-à-dire la story **4.7**. Un ajout manuel n'a pas d'échelle à appliquer.
**Défaut prescrit : hors périmètre ici, à re-dater vers la 4.7**, et à écrire plutôt qu'à esquiver.

---

## Ce qui a été MESURÉ pour cette story

*Stack local, `4e65beb`, chaque sonde en `begin … rollback`. Commandes exécutées.*

| # | Mesure | Résultat |
|---|---|---|
| **M1** | Deux fois le même `(nom, unité)` | ⛔ **`23505`** — `grocery_list_items_cle_canonique` |
| **M2** | `'Lait'` puis `'  LAÏT '` | ⛔ **`23505`** — la casse, **les accents ET les espaces** plient : `lait` |
| **M3** | `('Lait','L')` + `('Lait','pièce')` | ✅ **2 lignes** — deux unités ne fusionnent jamais (AC2) |
| **M4** | Deux fois `'Sucre'` **sans unité** | ⛔ **`23505`**, clé `(…, sucre, null)` — `nulls not distinct` fonctionne |
| **M5** | Insérer sur une clé tenue par un article **`bought`** | ⛔ **`23505`** — l'acheté occupe la clé |
| **M6** | Insérer sur une clé tenue par un **tombstone** | ⛔ **`23505`** — le tombstone occupe la clé |
| **M7** | `quantity = -5` | ⚠️ **ACCEPTÉ** — rend `-5.00`. Aucune contrainte de positivité (D2) |
| **M8** | Expression exacte de l'index | `(household_id, lower(strip_accents(regexp_replace(normalize(name,NFC), …))), unit) nulls not distinct` |
| **M9** | RPC existantes et leur mode | `resolve_aisle_id` est **`security invoker`** ; `seed_default_aisles`, `create_household_with_profile`, `redeem_household_invite`, `generate_grocery_list_from_menu` sont `definer` |
| **M10** | `generate_grocery_list_from_menu` | ⛔ **fait segfauter PostgreSQL** (un crash par appel, mesuré le 2026-08-07). Reportée à la 4.7 — **ne pas s'en inspirer** |
| **M11** | `product_aisle_map` | **0 ligne** → `resolve_aisle_id` rend `null` pour tout (D4) |
| **M12** | Portes au point de départ | `npm test` **258/258** · isolation **103 · 102 pass · 0 fail · 1 skipped** · typecheck · lint · `check:migrations` 17/15/2/0 · build 14 routes |

---

## Tasks / Subtasks

- [x] **Task 1 — La fonction d'ajout, côté serveur** (AC: 1, 2, 3) · *dépend de D1, D2*
  - [x] Migration : `ajouter_article(...)` en **`security invoker`**, avec sa requête de contrôle en en-tête
  - [x] `insert … on conflict … do update set quantity = coalesce(grocery_list_items.quantity, 0) + coalesce(excluded.quantity, 0)` — ⚠️ **sur l'INDEX, pas sur une liste de colonnes** : `on conflict (household_id, lower(strip_accents(…)), unit)` doit reproduire l'expression **à l'identique**, sinon Postgres ne trouve pas l'index
  - [x] Le tombstone se rouvre (`deleted_at = null`), l'article acheté redevient `pending` (D1)
  - [x] `resolve_aisle_id` appelée pour le rayon (D4)
  - [x] `check (quantity is null or quantity >= 0)` (D2), et trancher le `deleted_at >= created_at` de la 4.5
  - [x] ⚠️ **`grant execute` explicite** : la migration `20260729094500` a montré qu'aucune migration n'accordait de privilège de table — ne pas supposer

- [x] **Task 2 — Le pur de la saisie** (AC: 2) · *dépend de D3*
  - [x] Déplacer `normaliserQuantite` et son compagnon vers `lib/quantite.ts`, ré-export depuis `lib/recettes/saisie.ts`
  - [x] `normaliserNomArticle` : enveloppe de domaine sur `normaliserTexte`, bornée à **200 points de code** (la contrainte `grocery_list_items_nom_borne`)
  - [x] ⛔ **Elle ne recalcule PAS la clé canonique** — celle-ci vit dans l'index (AD-1/AD-6)
  - [x] L'unité vient de `UNITES` (`lib/recettes/unites.ts`), **jamais d'une liste réécrite**

- [x] **Task 3 — L'écran d'ajout** (AC: 1, 2, 3)
  - [x] Bouton « **Ajouter un truc** » (`EXPERIENCE.md:109`, microcopy verbatim), en `bouton-action` — abricot **légitime** ici, UX-DR2 l'énumère
  - [x] Un `<select>` pour l'unité, jamais un champ libre : c'est ce qui empêche une forme NFD d'atteindre la base (report de la 4.1)
  - [x] Motifs à reprendre : `useSoumission` (avec son `finally`), `Notice` (`role="status"`), erreurs **SQLSTATE d'abord** (`lib/foyer/erreurs.ts`)
  - [x] ⚠️ **`reserve` sur le `Notice` redevient DÛ ici** — la revue de la 4.2 l'avait retiré au motif qu'« il n'y a ni formulaire ni cible sous la zone ». Il y a maintenant les deux

- [x] **Task 4 — Les tests**
  - [x] `lib/` : la saisie de quantité, le bornage du nom, le refus d'une unité hors vocabulaire
  - [x] **Isolation** : l'agrégation sur la clé (deux ajouts → une ligne, quantités additionnées) · deux unités → deux lignes · l'ajout sur un **tombstone** · l'ajout sur un **acheté** · un membre d'un autre foyer ne peut pas ajouter
  - [x] ⚠️ **Préfixe UNIQUE par test** (`zzagg-`, `zztomb-`…) — le préfixe partagé a coûté un défaut en revue de la 4.2
  - [x] ⚠️ Placer les tests **avant** celui de la génération (`isolation.test.ts`), qui segfaute et reste `test.skip`

- [x] **Task 5 — Les portes, puis le parcours à l'écran**
  - [x] `typecheck` · `lint` · `test` · `test:isolation` · `check:migrations` · `build`
  - [x] Sonde CSS sur tout token neuf, avec contrôle négatif
  - [x] ⛔ **Parcours à l'œil, aux DEUX réglages système, thème remis après** — FAIT le 2026-08-17, sur une construction de PRODUCTION (le serveur de développement était en cause, pas l'application). Détail à la section « Parcours à l'écran ».
  - [x] Fermer le `Status` du fichier **et** `sprint-status.yaml` (§6 bis)

---

## Dev Notes

### Les pièges, dans l'ordre où ils mordent

**Piège n°1 — Écrire un `INSERT`.** AC1 l'interdit, l'index le punit d'un `23505`, et le membre
verrait une erreur technique sur un geste parfaitement légitime.

**Piège n°2 — Lire la VUE avant d'ajouter.** La ligne qui occupe la clé peut être un tombstone ou
un acheté, tous deux **invisibles** dans la vue. Lire la table.

**Piège n°3 — Réécrire la clé canonique côté client.** Quatre opérations non commutatives, dont
`strip_accents` qui **peut vider une chaîne** (mesuré en revue de la 4.1 : 106 points de code
`[:graph:]` sont dans ce cas). Le serveur la calcule ; le client ne la devine pas.

**Piège n°4 — `on conflict` sur les colonnes plutôt que sur l'expression.** `on conflict
(household_id, name, unit)` ne trouve **aucun** index et échoue à la création de la fonction.
L'expression doit être recopiée **à l'identique**, `strip_accents` et regex comprises.

**Piège n°5 — Écraser le nom tapé par le membre.** La normalisation vit dans l'expression de
l'index, **jamais dans la donnée** : « Crème fraîche » s'affiche « Crème fraîche ».

**Piège n°6 — `security definer` par réflexe.** Elle traverse la RLS, donc elle doit recontrôler
l'identité **elle-même** — c'est le trou de `seed_default_aisles`, invisible aux onze tests
d'isolation d'alors. `invoker` laisse la RLS faire son travail.

**Piège n°7 — S'inspirer de `generate_grocery_list_from_menu`.** Elle fait **segfauter
PostgreSQL**, un crash par appel, mesuré. C'est le contre-exemple, pas le motif.

**Piège n°8 — L'abricot.** Le bouton d'ajout est un emploi **légitime** (UX-DR2 l'énumère). Le
reste de l'écran ne l'est pas.

### ⛔ Un défaut OUVERT que cette story hérite, et qui la concerne directement

`intent_at` est l'arbitre du LWW (AD-3). La story 4.3 l'écrit **depuis l'horloge du client**,
alors que l'insertion le pose **depuis l'horloge du serveur**. **Mesuré le 2026-08-16** : le
conteneur Postgres est **+0,740 s en avance** sur l'hôte, donc une bascule écrit un horodatage
**antérieur** à l'insertion.

Cette story écrit elle aussi. ⚠️ **Elle ne doit pas reproduire le choix avant qu'il soit tranché** :
l'en-tête de la migration 4.1 dit que « le défaut `now()` est l'horloge SERVEUR : honnête pour une
écriture directe, et remplacé par l'horloge du geste dès que l'outbox existe (story 4.9) ». Une
fonction SQL résout le problème gratuitement — `now()` y est l'horloge serveur, la même qu'à
l'insertion. **C'est un argument de plus pour D1(a).**

### Frontières — ce que cette story ne fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| L'arrondi des quantités mises à l'échelle | **4.7** (FR-16 — voir la note sous D4) |
| Les règles mot-clé → rayon (remplir `product_aisle_map`) | **2.3** |
| Le câblage de la résolution automatique | **4.16** |
| Supprimer, archiver, vider | **4.5** |
| La provenance sur la ligne | **4.6** |
| La génération depuis le menu | **4.7** |
| Écriture hors ligne, outbox | **4.9** |
| L'arbitrage LWW | **4.10** |

### Fichiers à toucher

```
supabase/migrations/<neuve>.sql    NEW   ajouter_article() + check quantity >= 0
lib/quantite.ts                    UPD   normaliserQuantite + son compagnon (D3)
lib/quantite.test.ts               UPD
lib/recettes/saisie.ts             UPD   ré-export, en-tête corrigé
lib/liste/ajout.ts                 NEW   l'appel RPC, client EN PARAMÈTRE
lib/liste/ajout.test.ts            NEW
lib/liste/nom.ts                   NEW   normaliserNomArticle (enveloppe de lib/texte.ts)
lib/liste/nom.test.ts              NEW
app/courses/AjouterArticle.tsx     NEW   le formulaire
app/courses/ListeCourses.tsx       UPD   monter le bouton, rafraîchir après ajout
supabase/tests/isolation.test.ts   UPD   agrégation, tombstone, acheté, inter-foyers
```

⚠️ **`lib/liste/ajout.ts` prend son client EN PARAMÈTRE**, comme `articlesDuFoyer` et
`basculerStatut` : c'est ce qui le rend appelable par le serveur MCP (Epic 7, qui ajoutera des
articles) et **exerçable contre une vraie base** dans `isolation.test.ts`.

### Ce que les stories 4.2 et 4.3 lèguent

- **`formaterQuantiteEtUnite`** vit dans `lib/quantite.ts` — les nouveaux appelants importent de là.
- **`comparerGroupes` et `trierPanierEnBas` sont exportées et mesurées.** Toute règle pure neuve
  suit le même principe : **exportée et mesurée**, jamais « correcte par construction ».
- **`versArticle` écarte une ligne avec un `console.warn`** plutôt qu'en silence.
- ⚠️ **La liste se rafraîchit après un ajout, et le chemin n'existe pas.** La 4.2 est une lecture
  unique ; AD-8 proscrit le polling et le reload manuel ; le temps réel est la 4.11. Le plus proche
  du dépôt est la mise à jour **optimiste** de la 4.3, avec son rollback. À trancher en chemin.
- ⛔ **Le parcours à l'écran de la 4.3 n'a pas été rejoué après son correctif** — si tu enchaînes,
  fais les deux d'un coup.

### Standards de test

- `node --test` natif, aucun harnais de composants (NFR-10) → **toute règle testable descend dans
  `lib/`**. Leçon mesurée deux fois : « 2 pièce » était intestable dans le JSX, et
  `comparerGroupes` non exportée laissait sa mutation survivre.
- Un invariant entre deux fichiers **se mesure** (§4).
- Les tests d'isolation passent par `a.client`/`b.client`, **jamais `admin`** (AD-17).
- ⛔ La garde CI ne tolère **qu'un seul** test sauté, nommé en dur : un `test.skip` neuf fait
  rougir le job.

### Project Structure Notes

`lib/liste/` est le module posé par la 4.2 et étendu par la 4.3 ; cette story l'étend encore sans
le réorganiser. Une migration est due — la seconde de l'Epic 4 après celle de la 4.3. Elle porte sa
requête de contrôle en en-tête, s'applique **au déploiement**, et `db reset` reste l'outil normal
en local, interdit sur le distant.

### References

- [Source: `epics.md#Story 4.4`] — story, AC
- [Source: `prd.md#FR-4, FR-5, FR-52, FR-16`] — ajout, agrégation, vocabulaire fermé, échelle
- [Source: `ARCHITECTURE-SPINE.md#AD-6`] — **autorité serveur, UPSERT-incrémente sur clé canonique**
- [Source: `ARCHITECTURE-SPINE.md#AD-3, AD-7, AD-1, AD-2, AD-13`]
- [Source: `EXPERIENCE.md:109`] — « Ajouter un truc », résout le rayon, agrège si doublon
- [Source: `20260805092611_...sql` volets 3, 4, 6] — contraintes, index canonique, RLS
- [Source: `deferred-work.md`] — `quantity >= 0`, miroir applicatif, `unit` non normalisé, tombstone futur
- [Source: `lib/recettes/unites.ts`, `lib/recettes/saisie.ts`, `lib/texte.ts`]
- [Source: `_bmad-output/project-context.md`]

### Intelligence git — ce que les derniers commits enseignent

| Commit | Ce qu'il apprend à cette story |
|---|---|
| `4e65beb` seed-local | `node supabase/seed-local.mjs` monte un foyer en une commande — le parcours à l'écran n'a plus d'excuse |
| `d8dc590` fix(4-3) panier | ⛔ **Un défaut trouvé à l'ŒIL que 258 tests ne voyaient pas** : l'état gardait une liste déjà triée pour l'affichage. **Pour cette story : l'état garde ce que la base a rendu, la présentation se dérive** |
| `aedbeff` feat(4-3) | La valeur posée plutôt que le basculement relatif (AD-4) — même esprit que l'UPSERT-incrémente ici |
| `0f4ee0e` (4.2, dans `main`) | La lecture client-direct, ses trois états, le `catch` lié. Et la reddition de comptes : chiffres rejoués, File List relevée depuis `git diff` |

### Latest tech — rien à rafraîchir

Aucune dépendance nouvelle (NFR-10), aucune API externe. `nulls not distinct` exige **PostgreSQL
15+** ; local et production sont en **17.6** (mesuré en 4.1). ⚠️ `unaccent` est `STABLE` sous ses
deux formes sur 17.6 — d'où `public.strip_accents`, et un `reindex` dû après toute montée de
version **majeure** de Postgres.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (`dev-story`, 2026-08-16)

### Debug Log References

| Commande | Résultat |
|---|---|
| `npm test` | **266 / 266**, `fail 0` — 258 avant (+8 : 5 sur le nom, 3 sur l'unité) |
| `npm run test:isolation` | **111 tests · 110 pass · 0 fail · 1 skipped** — 103 avant (**+8**) |
| `npm run typecheck` · `npm run lint` | verts (`--max-warnings 0`) |
| `npm run check:migrations` | **18 / 16 avec requête de contrôle / 2 exemptées / 0 sans** |
| `npm run build` | réussi — 14 routes, `/courses` en `ƒ`, aucune route neuve |
| **Contrôle n°3 de l'en-tête de migration, EXÉCUTÉ** | `ajouter_article('Lait',1,'L')` puis `('lait',2,'L')` → **1 ligne, quantité 3** |
| **M14** — casse, accents, espaces | `'  LAÏT '` après `'Lait'` → **1 ligne, quantité 6** |
| **M15** — unité différente | `('Lait','pièce')` → **2 lignes** (AC2) |
| **M16** — sans quantité puis avec | `null` puis `5` → **5** (le `coalesce` des deux côtés tient) |
| **M17** — réajout sur un **tombstone acheté** | **1 ligne, quantité 3, `pending`, tombstone levé** |
| **Sonde CSS** | `.btn-action` 4 · `.input` 4 · `.label` 1 · `min-h-touch` 1. **3 contrôles négatifs à 0** |
| **Contraste du bouton d'action** | encre `#3a1e04` sur aplat : **6,56:1** en clair, **8,07:1** en sombre |
| **Parcours à l'écran** | ⛔ **NON FAIT** — sous-tâche laissée ouverte avec sa raison |

⛔ **DEUX DÉFAUTS QUE J'AI INTRODUITS PUIS CORRIGÉS, CONSIGNÉS PLUTÔT QU'EFFACÉS.**

1. **La signature de `resolve_aisle_id` était supposée, pas vérifiée.** J'ai écrit
   `resolve_aisle_id(v_foyer, p_nom)` ; la vraie est
   `(p_household_id, p_product_id, p_ingredient, p_fallback_kw)` — quatre arguments. La fonction
   a échoué au premier appel. ⚠️ **La requête de contrôle n°2 de mon propre en-tête existait pour
   ça, et je ne l'avais pas exécutée avant d'écrire.**
2. **La contrainte `deleted_at >= created_at` a CASSÉ un test d'isolation préexistant** — « A gère
   SON article de bout en bout, tombstone compris » — en rendant `23514`. **Cause mesurée : le
   même défaut d'horloge que la 4.3.** `created_at` vient du serveur, `deleted_at` du client, et
   le conteneur Postgres est **+0,740 s en avance** sur l'hôte. ⛔ **Conséquence si la borne était
   restée stricte : un membre dont le téléphone retarde d'une seconde n'aurait plus rien pu
   supprimer.** Corrigée avec une tolérance d'un jour, **reprise mot pour mot de
   `grocery_list_items_intention_bornee`**, dont la raison écrite est exactement celle-ci.

⚠️ **Un troisième point, sur les types générés.** `lib/supabase/types.ts` a dû être régénéré (la
fonction est neuve). La CLI épinglée en CI (2.110.0) n'a pas pu être téléchargée dans le temps
imparti ; la locale (2.114.0) ajoute donc, en plus de `ajouter_article`, un bloc `graphql_public`
sans rapport. **Vérifié : la régénération est purement ADDITIVE** — `diff` ne retire aucune ligne.
J'ai pris la sortie de l'outil telle quelle plutôt que de la retoucher à la main.

### Completion Notes List

**Livré — 5 fichiers neufs, 6 modifiés**, aucune dépendance, **une migration**.

1. **La migration** pose l'UPSERT-incrémente en **fonction SQL `security invoker`** (D1a). La RLS
   de l'appelant s'applique donc intégralement : la fonction n'ouvre aucun chemin qu'un membre
   n'avait pas déjà. ⛔ **`on conflict` porte l'EXPRESSION de l'index**, extraite du fichier
   source **par script** plutôt que recopiée à la main — ma première rédaction avait transformé
   les échappements `\uXXXX` en caractères littéraux, ce qui est exactement le piège n°4 de
   cette story.
2. **Le `do update` rouvre le tombstone et ramène l'acheté à `pending`.** C'est ce qui rend
   « rajouter un article supprimé » possible : sans lui, un `INSERT` rendait `23505` sur un geste
   légitime, en désignant un article que la vue affirme absent.
3. **`quantity >= 0`** (D2a) et **`deleted_at >= created_at - 1 jour`** : les deux fenêtres bon
   marché refermées pendant que la table est vide.
4. **`normaliserQuantite`, `analyserQuantite` et leurs bornes ont déménagé** vers `lib/quantite.ts`
   (D3a), avec ré-export depuis `lib/recettes/saisie.ts`. Même geste que `formaterQuantite`.
5. **`lib/liste/nom.ts`** — `normaliserNomArticle`. ⛔ **Elle ne recalcule PAS la clé canonique**,
   et son docblock porte un tableau qui dit ce que les deux normalisations font de différent.
6. **`app/courses/AjouterArticle.tsx`** — le formulaire, avec le `<select>` d'unité comme **seule
   garde** contre une forme Unicode décomposée, et `analyserQuantite` pour dire *pourquoi* une
   saisie est refusée plutôt que de répondre « en chiffres » à quelqu'un qui en a écrit.
7. **`.btn-action`** posé dans `globals.css` : `DESIGN.md` le spécifie depuis le début, cet écran
   est le premier à le monter. Seul bouton abricot du produit, et UX-DR2 l'énumère nommément.

**Trois choses à signaler à la revue :**

- ⚠️ **La liste se RELIT après un ajout, elle ne se devine pas.** La 4.3 emploie une mise à jour
  optimiste pour la coche — bon choix là-bas, on connaissait l'état visé. Ici, non : on ignore si
  l'ajout a créé une ligne ou incrémenté une existante, quel rayon le serveur a résolu, et si un
  tombstone vient d'être rouvert. ⛔ **Ce n'est pas le « reload manuel » qu'AD-8 proscrit** — c'est
  la conséquence d'une écriture.
- ✅ **`reserve` est revenu sur le `Notice` du formulaire**, et la prémisse de la 4.2 est rouverte
  explicitement (§5) : elle disait « ni formulaire ni cible sous la zone », cet écran apporte les
  deux.
- ⚠️ **L'arrondi de l'AC3 n'a PAS été implémenté**, et c'est écrit sous D4 : FR-52 le rattache aux
  quantités mises à l'échelle de FR-16, donc à la **story 4.7**. Un ajout manuel n'a pas d'échelle.

### File List

| Fichier | État |
|---|---|
| `supabase/migrations/20260816180000_ajouter_un_article_upsert_incremente.sql` | **nouveau** — 3 volets, requête de contrôle en en-tête |
| `lib/liste/ajout.ts` | **nouveau** — `ajouterArticle`, `uniteChoisie` |
| `lib/liste/ajout.test.ts` | **nouveau** — 3 tests |
| `lib/liste/nom.ts` | **nouveau** — `normaliserNomArticle`, `MAX_NOM_ARTICLE` |
| `lib/liste/nom.test.ts` | **nouveau** — 5 tests |
| `app/courses/AjouterArticle.tsx` | **nouveau** — le formulaire |
| `lib/quantite.ts` | modifié — reçoit la saisie de quantité (D3) |
| `lib/recettes/saisie.ts` | modifié — ré-exporte les quatre déplacés |
| `app/courses/ListeCourses.tsx` | modifié — `relire()` extraite, formulaire monté |
| `app/globals.css` | modifié — `.btn-action` |
| `lib/supabase/types.ts` | modifié — **régénéré** (fonction neuve) |
| `supabase/tests/isolation.test.ts` | modifié — 8 tests neufs + 2 helpers |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |

⚠️ **`package.json` intact**, aucune dépendance.

## Parcours à l'écran — 2026-08-17

⛔ **FAIT SUR UNE CONSTRUCTION DE PRODUCTION (`next build` + `next start`), pas sur le serveur de
développement.** Les quatre tentatives précédentes échouaient toutes de la même façon : la page
restait sur son squelette, JS chargé mais effet jamais exécuté. Passer en production a réglé le
problème d'un coup — **c'était l'outillage de développement, pas l'application**. C'est la
troisième famille de la règle §7, « l'outillage de test lui-même », et elle a coûté quatre
diagnostics.

⚠️ **Serveur DÉDIÉ pointé sur le stack local** : `.env.local` du dépôt pointe la production, et ces
stories écrivent. Compte et 11 articles semés par `node supabase/seed-local.mjs`, puis supprimés.
Thème piloté au **réglage système** (`osascript`), remis au clair à la fin.

### Ce qui a été vu, dans les DEUX thèmes

| Vérifié | Résultat |
|---|---|
| Squelette au chargement | ✅ cartes avec leur ombre `--card-shadow` (le correctif de la 2ᵉ passe de la 4.2) |
| Accord de l'unité | ✅ « 6 pièces », « 10 pièces » — jamais « 6 pièce » |
| Séparateur « DANS LE PANIER » | ✅ présent quand il sépare, **absent** quand le rayon est entièrement acheté |
| Article acheté | ✅ barré + coche pleine, libellé **resté lisible** ; quantité en `muted-2` |
| **Hit-target de la ligne** | ✅ un clic à **389 px de la case** bascule — ligne mesurée à **46 px** (plancher 44) |
| Compteur et ratio | ✅ 6 → 5 à la coche, ratio 1/3 → 2/3 |
| **Correctif du panier (4.3)** | ✅ **vérifié** : le panier rend `Carottes, Salade` — l'ordre de la BASE, pas celui de l'affichage |
| **Agrégation (4.4)** | ✅ « Pommes 6 pièces » + 4 → **« Pommes 10 pièces »**, UNE ligne, champs vidés, liste relue |
| Refus de quantité | ✅ « deux » → « Une quantité s'écrit en chiffres. », et **le bouton ne bouge pas** (`reserve` tient) |
| Vocabulaire d'unités | ✅ les 8 jetons dans le `<select>`, plus l'option vide |
| Bouton `btn-action` | ✅ abricot lisible dans les deux thèmes, hauteur **44 px** |
| **NFR-3** | ✅ **0 débordement** à 390 / 360 / 320 px ; le champ « Quoi » passe de 182 à 112 px |

⚠️ **Une réserve sur NFR-3, dite plutôt qu'esquivée** : la fenêtre Chrome a refusé de se
redimensionner (`innerWidth` bloqué à 1502). La mesure a donc été faite **en contraignant le
conteneur**, ce qui est un proxy — les media queries ne s'y déclenchent pas. Cet écran n'en emploie
aucune sur la largeur, mais la nuance est réelle.

⚠️ **Ma première sonde annonçait 9 débordements à toutes les largeurs.** Vérification faite,
c'étaient les 9 `<option>` du `<select>`, jamais rendues dans le flux — un faux positif de la
sonde, pas un défaut. Consigné parce qu'une sonde qui crie au loup coûte autant qu'une sonde muette.

### R2-6 — le jugement d'œil sur la pile sombre

✅ **La séparation des cartes se lit.** Ce qui la porte n'est pas la bordure (mesurée 1,352:1) mais
le **remplissage de carte plus clair que le fond**, plus la pastille d'emoji qui ancre chaque
en-tête. ⚠️ **La mesure reste vraie** — rien n'atteint les 3:1 de WCAG 1.4.11 — et la marge est
mince sur un écran de magasin en plein soleil. **Non bloquant pour ces trois stories ; à trancher
dans `DESIGN.md` avant la 4.13**, qui possède le plancher d'accessibilité.

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-16 | dev-story | **Implémentée.** 5 fichiers neufs, 6 modifiés, **une migration**, aucune dépendance. Les **quatre décisions prises sur leur défaut prescrit** : D1(a) fonction SQL `security invoker` · D2(a) `quantity >= 0` · D3(a) `normaliserQuantite` déplacée · D4(a) `resolve_aisle_id` appelée. ✅ **L'agrégation est mesurée de bout en bout** : deux ajouts du même article → 1 ligne quantité 3 · casse/accents/espaces plient · unité différente → 2 lignes · sans quantité puis avec → 5 · **réajout sur un tombstone ACHETÉ → 1 ligne, `pending`, tombstone levé**. ⛔ **DEUX DÉFAUTS INTRODUITS PUIS CORRIGÉS, consignés** : (1) la signature de `resolve_aisle_id` était **supposée** — quatre arguments, pas deux — et **la requête de contrôle n°2 de mon propre en-tête existait pour ça, non exécutée avant d'écrire** ; (2) la contrainte `deleted_at >= created_at` a **cassé un test préexistant**, et la cause est **le même défaut d'horloge que la 4.3** — `created_at` serveur, `deleted_at` client, **+0,740 s d'écart mesuré**. Une borne stricte aurait empêché tout membre au téléphone qui retarde de supprimer quoi que ce soit ; corrigée avec la tolérance d'un jour **reprise de `grocery_list_items_intention_bornee`**. ⚠️ **Et D1(a) referme le défaut `intent_at` hérité de la 4.3** pour les écritures de cette story : `now()` en SQL est l'horloge serveur. ⚠️ `types.ts` régénéré — la CLI épinglée n'a pas pu être téléchargée, la locale ajoute un bloc `graphql_public` sans rapport ; **vérifié purement additif**. ⚠️ L'arrondi de l'AC3 **non implémenté** : FR-52 le rattache à FR-16, donc à la 4.7. Portes : `npm test` **266/266** (+8) · isolation **111 · 110 pass · 0 fail · 1 skipped** (+8) · typecheck · lint · `check:migrations` 18/16/2/0 · build 14 routes · sonde CSS 4 classes, 3 contrôles négatifs à 0 · contraste du bouton **6,56:1** clair / **8,07:1** sombre. ⛔ **RESTE DÛ : le parcours à l'écran**, non coché avec sa raison (§7). |
| 2026-08-16 | create-story | Contextualisation sur `4e65beb`. **Douze mesures exécutées** sur le stack local, en `begin … rollback`. ⛔ **Le fait central est mesuré trois fois** : l'index unique canonique est TOTAL, donc un article **acheté** (M5) comme un **tombstone** (M6) occupent la clé et font rendre `23505` à un INSERT — alors que la vue ne les montre pas. **Règle : lire la TABLE, jamais la vue, avant tout ajout.** ✅ **AD-6 tranche la question de fond** — l'agrégation est autoritaire côté serveur — et une contrainte technique élimine la voie client : **PostgREST ne sait pas incrémenter en upsert**, son `on_conflict` écrase. D'où quatre décisions, dont **D1 : une fonction SQL `security invoker`** (jamais `definer` — c'est le trou de `seed_default_aisles`). ⚠️ **Deux fenêtres bon marché se referment ici** : `quantity >= 0` (M7 : `-5` est accepté aujourd'hui) et `deleted_at >= created_at`, la table étant encore vide en production. ⚠️ **L'arrondi de l'AC3 n'appartient probablement pas à cette story** : FR-52 le rattache à FR-16, la génération — donc la 4.7. Écrit plutôt qu'esquivé. ⛔ **Un défaut OUVERT est hérité et concerne directement cette story** : `intent_at` mélange horloge client et horloge serveur (+0,740 s d'écart mesuré). Une fonction SQL le résout gratuitement, ce qui est un argument de plus pour D1(a). |
