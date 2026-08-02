# Story 3.2: Gérer les ingrédients d'une recette

Status: ready-for-dev

<!-- Deuxième story de l'Epic 3. Elle porte DEUX contrats avec des epics à venir :
     le vocabulaire d'unités (clé canonique de l'Epic 4) et l'ordre des ingrédients.
     Les deux ont un piège mesuré. Voir § Questions avant de démarrer : cette story
     a une dépendance de branche qui n'est pas un détail. -->

## Story

As a membre configurant le foyer (Florian),
I want ajouter, modifier, réordonner et retirer les ingrédients d'une recette,
So that la liste d'ingrédients soit juste sans devoir tout supprimer et recréer.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-3.2`.

**AC1 — Ajouter**
**Given** une recette
**When** Florian ajoute un ingrédient avec quantité, unité, nom, mot-clé de rayon et caractère
optionnel
**Then** l'ingrédient est rattaché à la recette avec tous ces attributs

**AC2 — Éditer en place**
**Given** un ingrédient existant
**When** Florian édite l'un de ses attributs
**Then** la modification est appliquée en place, sans suppression-recréation (FR-18)

**AC3 — Vocabulaire d'unités fermé**
**Given** une unité d'ingrédient
**When** Florian la choisit
**Then** elle provient du **vocabulaire d'unités fermé** (g, kg, ml, L, pièce, cs, cc, pincée —
FR-52/AD-7), pour que la génération puisse agréger correctement plus tard

**AC4 — Réordonner**
**Given** plusieurs ingrédients dans une recette
**When** Florian les réordonne
**Then** le nouvel ordre est persisté et respecté à l'affichage (FR-18)

> **⚠️ « Retirer » est dans la user story et dans AUCUN critère.** Les quatre AC couvrent ajouter,
> éditer, choisir une unité et réordonner. La suppression d'un ingrédient n'a pas de critère — mais
> elle est nommée dans le *I want*, et une liste d'ingrédients sans suppression est un aller simple
> (le même *roach motel* que la story 3.1 a refermé pour les recettes). **Elle entre au périmètre**,
> voir § Questions, point 2.

> **⚠️ AC1 nomme cinq attributs, et le cinquième vous surprendra.** « mot-clé de rayon » =
> `recipe_ingredients.aisle_keyword`, le **troisième repli** de `resolve_aisle_id`
> (`initial_schema.sql:498-507`). Ce n'est pas un champ décoratif : c'est ce qui rattrape un
> ingrédient dont le nom ne contient aucun mot-clé connu du foyer, en Epic 4. Le libeller « mot-clé
> de rayon » à l'écran serait du jargon — voir la microcopy.

## Tasks / Subtasks

- [ ] **Task 1 — La migration additive : le vocabulaire, et le nom non vide** (AC1, AC3)
  - [ ] `npx supabase migration new require_valid_recipe_ingredient_fields`
  - [ ] `recipe_ingredients_unite_fermee` — `check (unit is null or unit = any (array[...]))`.
        **Les huit jetons d'AD-7, à la lettre** : `g, kg, ml, L, pièce, cs, cc, pincée`
        (piège n°1). ⚠️ **`is null or` n'est pas une faiblesse** : la colonne est nullable et un
        ingrédient sans quantité (« du sel ») n'a pas d'unité. La resserrer en `not null` ne serait
        pas additif
  - [ ] `recipe_ingredients_nom_non_vide` — **cinquième** contrainte de cette forme. Regex
        **extraite par script** de `20260729095923:80`, jamais retapée (piège n°2)
  - [ ] **Requête de contrôle en en-tête**, avec son attendu écrit et la mention de ce qui est
        déduit plutôt que mesuré (piège n°3)
  - [ ] `npx supabase db reset`, `npx supabase gen types typescript --local`
  - [ ] ⚠️ Le diff de types est **attendu vide** — une contrainte `check` ne change pas la forme du
        schéma. S'il ne porte que sur `__InternalSupabase`/`graphql_public`, **ne le commite pas**

- [ ] **Task 2 — La migration de la fonction de réordonnancement** (AC4)
  - [ ] `reorder_recipe_ingredients(p_recipe_id uuid, p_ids uuid[])`, **security INVOKER**
  - [ ] ⚠️ **Le filtre `and ri.recipe_id = p_recipe_id` DANS l'`update`.** Sans lui, la fonction
        calquée sur `reorder_aisles` renumérote **une autre recette du même foyer** — mesuré
        (piège n°4). C'est la ligne qui compte le plus de toute cette story
  - [ ] Quatre gardes : tableau vide, doublon, cardinal, **comptage des lignes touchées**
  - [ ] `docs/migrations.md` : le compte de fonctions passe à **neuf** (huit après la 2.2), avec sa
        date. ⚠️ Ne le touche que si la 2.2 est fusionnée — sinon c'est **huit** (voir § Questions)

- [ ] **Task 3 — `lib/recettes/unites.ts`, en TDD** (AC1, AC3)
  - [ ] Phase rouge **constatée** avant l'implémentation
  - [ ] `UNITES` — le tuple des huit jetons, `as const`, **source unique** du `<select>` et du test
        d'accord avec la contrainte
  - [ ] `estUniteConnue(valeur)` et le type `Unite`
  - [ ] `normaliserQuantite(saisie)` → `number | null` — décimale, pas entière (piège n°6)
  - [ ] Tests : chaque jeton accepté, un jeton inconnu refusé, **`pièce` en NFD refusé**
        (piège n°1)

- [ ] **Task 4 — `lib/recettes/ingredients.ts`, la couche lecture** (AC1, AC2, AC4)
  - [ ] `type Ingredient`, `ingredientsDeRecette(supabase, recetteId)`
  - [ ] **Client passé en paramètre**, motif de `rayons.ts` et `recettes.ts`
  - [ ] **Aucun filtre `household_id`** : `recipe_ingredients_all` porte `using` **et**
        `with check`, via un `exists` sur `recipes`
  - [ ] `.order("sort_order").order("created_at")` — le second critère n'est **pas** décoratif, et
        il l'est encore moins ici que sur les rayons (piège n°5)

- [ ] **Task 5 — Le pur du réordonnancement, réutilisé et non recopié** (AC4)
  - [ ] ⚠️ `lib/rayons/ordre.ts` (story 2.2) est **déjà générique** — il travaille sur
        `ReadonlyArray<{ id: string }>` et ne connaît rien aux rayons. **Extrais-le en
        `lib/ordre.ts`**, exactement comme `lib/texte.ts` a été extrait quand les rayons sont
        devenus le troisième champ libre. Ne le recopie pas (piège n°7)
  - [ ] `lib/rayons/ordre.ts` devient un ré-export, ou ses importeurs pointent vers `lib/ordre.ts` :
        **choisis, et écris pourquoi**
  - [ ] Les tests suivent le module ; le compte doit rester au moins égal

- [ ] **Task 6 — `IngredientsRecette.tsx` : la liste, l'ajout, l'édition, la suppression**
      (AC1, AC2)
  - [ ] **Composant à part**, monté par `/recettes/[id]/modifier` **sous** le formulaire de la
        recette — pas dedans (piège n°8)
  - [ ] Écritures **client-direct** (AD-13). `recipe_id` explicite à l'insert
  - [ ] Ligne repliée / panneau d'édition, motif exact de `ListeRayons`
  - [ ] Suppression avec confirmation en deux temps, motif d'`InviteCard`. Jamais `window.confirm`
  - [ ] `<select>` pour l'unité — **jamais un champ libre** (piège n°1)
  - [ ] Une case pour « optionnel », dont le libellé dit ce qu'elle fait, pas comment elle s'appelle
  - [ ] **Une région de statut par surface de soumission** : le récidiviste maison (piège n°8)
  - [ ] État vide : une recette sans ingrédient est l'état **nominal** au sortir de la story 3.1

- [ ] **Task 7 — Le réordonnancement à l'écran** (AC4)
  - [ ] Les **flèches** monter/descendre, obligatoires : seul chemin clavier (UX-DR11) et
        alternative exigée par WCAG 2.5.7 si un glisser existe
  - [ ] Le glisser : **voir § Questions, point 3** — il n'est pas décidé
  - [ ] `disabled={occupe}` sur les flèches : ferme la course de deux pressions rapides
  - [ ] Une région de statut qui **nomme le rang atteint** — la seule information qu'un lecteur
        d'écran ne peut pas tirer d'une liste qui se réordonne en silence (leçon de la 2.2)

- [ ] **Task 8 — Les tests exécutés** (AC1–AC4, NFR-5)
  - [ ] `isolation.test.ts` — `recipe_ingredients` n'a **jamais** été éprouvée. A ne lit pas les
        ingrédients de B ; A ne peut ni insérer, ni modifier, ni supprimer chez B
  - [ ] ⚠️ **Le test qui compte le plus** : l'appel forgé à `reorder_recipe_ingredients` annonçant
        une recette et citant les identifiants d'une **autre recette du même foyer**. La RLS ne le
        refuse pas — c'est le filtre de l'`update` qui doit le faire (piège n°4)
  - [ ] ⚠️ Sous RLS, écrire sur une ligne masquée rend **zéro ligne et aucune erreur** : compte les
        lignes **et relis avec le client `admin`**
  - [ ] `contraintes.test.ts` — l'accord entre `UNITES` et `recipe_ingredients_unite_fermee` se
        **mesure** : chaque jeton du code accepté par la base, et **`pièce` en NFD refusé**
  - [ ] **Vérifie les dents** : retire une contrainte, retire le filtre `recipe_id`, compte combien
        de tests tombent, écris les chiffres, remets-les

- [ ] **Task 9 — Le parcours à l'écran, dans les deux thèmes** (AC1–AC4)
  - [ ] Stack local, `localhost:3333`, **jamais** une prévisualisation Vercel
  - [ ] Ajouter, éditer, réordonner, supprimer ; recette sans ingrédient
  - [ ] **Les huit unités**, chacune enregistrée et relue **en base** (pas seulement à l'écran)
  - [ ] Les deux thèmes au réglage système, **remis après**
  - [ ] Focus mesuré dans le DOM, 200 % de zoom, largeur 390 px
  - [ ] ⚠️ **Le glisser AU DOIGT s'il est retenu** — c'est la classe d'erreur qui a fait écarter
        `draggable` HTML5, et la 2.2 l'a laissée non mesurée
  - [ ] Les six portes

---

## Dev Notes

### Ce que la base fait déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où | Ce que ça implique |
|---|---|---|
| Table `recipe_ingredients` complète | `initial_schema.sql:156-167` | **Aucune colonne à créer** |
| Isolation, héritée de la recette | `recipe_ingredients_all`, `exists` sur `recipes` (`:299-313`) | **Aucun filtre `household_id`**, et aucun `recipe_id` non plus dans les lectures — la RLS suffit |
| Cascade à la suppression de recette | `recipe_id ... on delete cascade` (`:158`) | Supprimer une recette emporte ses ingrédients. Rien à écrire |
| Index de l'ordre | `idx_recipe_ingredients_recipe (recipe_id, sort_order)` (`:169`) | Rien à créer — et il sert **exactement** le tri de cette story |
| Résolution de rayon | `resolve_aisle_id`, 3 replis dont `aisle_keyword` (`:466-511`) | Epic 4. Ici on ne fait que **stocker** le mot-clé |
| Filtre des optionnels | `generate_grocery_list_from_menu`, `ri.optional = false` (`:553`) | Epic 4. Ici on ne fait que stocker le drapeau |
| Agrégation par nom+unité | `group by ri.name, ri.unit, …` (`:554`) | **C'est ce qui fait de l'unité un contrat** (piège n°1) |
| Privilèges de table | `alter default privileges` (`20260729094500`) | Aucun `grant` à écrire |
| Le pur du réordonnancement | `lib/rayons/ordre.ts` (story 2.2) | **À extraire, pas à recopier** (piège n°7) |
| Écran d'édition d'une recette | `app/recettes/[id]/modifier/` (story 3.1) | Le point de montage. Ne le réécris pas |
| Motifs d'écran | `ListeRayons` (ligne + panneau + confirmation), `Notice`, `useSoumission` | Réutilise |

### Piège n°1 — Le vocabulaire d'unités n'existe nulle part, et sa forme exacte est un contrat

**Trois faits mesurés le 2026-08-02.**

1. **`recipe_ingredients.unit` est un `text` sans aucune contrainte.** Vérifié dans
   `pg_constraint` : la table ne porte que sa clé primaire et ses deux clés étrangères. AC3 —
   « elle provient du vocabulaire d'unités fermé » — n'a donc **aucune frontière** aujourd'hui.

2. **Le commentaire du schéma CONTREDIT l'architecture.** `initial_schema.sql:162` annonce
   `-- 'g', 'ml', 'piece', 'cs', 'cc'` : **cinq** jetons, et `piece` **sans accent**. AD-7 en nomme
   **huit** : `g, kg, ml, L, pièce, cs, cc, pincée`. Un développeur qui lit le schéma implémentera
   la mauvaise liste. **C'est AD-7 qui fait foi**, et le commentaire du squelette qui a tort.

3. **`pièce` composé et `pièce` décomposé sont deux chaînes différentes**, et Postgres les juge
   **inégales** :

   ```
   'pièce' NFC → 5 points de code, 6 octets
   'pièce' NFD → 6 points de code, 7 octets
   Postgres : U&'pi\00E8ce' = U&'pie\0300ce'  →  f
   ```

**Pourquoi ça compte au-delà de cet écran.** `generate_grocery_list_from_menu` groupe par
`ri.name, ri.unit` **brut** et recopie `ri.unit` dans `grocery_list_items.unit`
(`initial_schema.sql:554, 562`). Et AD-3 fait de `(household_id, nom normalisé, unité)` la **clé
canonique** de toute la liste de courses. La chaîne que cette story écrit dans `unit` devient donc
la clé d'agrégation de l'Epic 4 : deux `pièce` de formes Unicode différentes seraient **deux lignes
de courses qui ne fusionnent jamais**, et personne ne verrait pourquoi.

L'architecture emploie d'ailleurs elle-même la forme accentuée et le `L` majuscule dans son exemple :
*« lait vocal fusionne avec la ligne canonique `lait / L` »* (AD-12).

**Ce qu'il faut faire, et c'est simple :**

- **`UNITES` est un tuple `as const` dans `lib/recettes/unites.ts`**, écrit une seule fois, en NFC ;
- **l'écran offre un `<select>`, jamais un champ libre** — ce qui supprime le risque NFD *à la
  source*, puisque l'utilisateur ne tape rien ;
- **une contrainte `check` en base** le tient quand même, parce que le `<select>` ne voit pas les
  appels REST directs et qu'AD-1/AD-2 veulent la règle en Postgres ;
- **un test mesure l'accord** entre les deux, jamais un commentaire qui l'affirme.

⚠️ **N'invente pas de conversion.** AD-7 : « deux unités différentes ne sont jamais additionnées ni
converties ». `kg` et `g` sont deux unités, pas deux échelles.

### Piège n°2 — `name` non vide : la cinquième contrainte de cette famille

`name text not null` n'interdit ni la chaîne vide ni une chaîne d'invisibles. Après
`display_name`, `household_name`, `aisle_name` et `recipes.title`, c'est la **cinquième**.

⚠️ **Recopie la regex de `20260729095923_require_non_blank_aisle_name.sql:80`, et EXTRAIS-LA PAR
SCRIPT** comme l'a fait la migration de la story 3.1 — la retaper est le seul moyen de se tromper.
Elle a été fausse deux fois avant d'être juste.

⚠️ **`͏` et consorts sont des échappées de l'analyseur d'expressions rationnelles de
Postgres**, pas de l'analyseur de chaînes — la lecture naïve (« ces backslashes ne sont pas
interprétés ») est plausible et fausse. Mesuré et écrit dans l'en-tête de
`20260801124553_require_valid_recipe_fields.sql` : lis-le avant de douter.

### Piège n°3 — La migration s'applique au déploiement

Il n'y a plus de `db push` humain : la requête de contrôle en en-tête s'exécute **en revue**, avant
la fusion. Attendu ici : zéro ligne — et c'est une **déduction**, pas une mesure. Aucune surface n'a
jamais écrit dans `recipe_ingredients` ; la story 3.1 ouvre `recipes` et **ne touche pas** aux
ingrédients. Écris-le comme une déduction, et exécute la requête en revue.

### Piège n°4 — Le trou inter-recettes, MESURÉ : la garde de `reorder_aisles` ne suffit pas ici

`reorder_aisles` (story 2.2) tient sa sûreté de deux choses : elle est **security invoker**, donc la
RLS filtre, et son cardinal se compare à `select count(*) from aisles` — qui, sous RLS, **ne voit que
le foyer de l'appelant**. La portée de la garde et la portée de la RLS coïncident.

**Pour des ingrédients, elles ne coïncident plus.** La portée est la **recette** ; la RLS, elle, est
par **foyer**. Deux recettes du même foyer sont mutuellement visibles.

**Mesuré le 2026-08-02 sur le stack local.** Fonction candidate calquée à l'identique sur
`reorder_aisles`, deux recettes A et B dans le même foyer, deux ingrédients chacune. Appel annonçant
la recette **A** et citant les identifiants de la recette **B** — cardinal correct, 2 = 2 :

```
--- AVANT ---            --- APRÈS l'appel forgé ---
A-ail       0            A-ail       0
A-oignon    0            A-oignon    0
B-carotte   0            B-carotte   20   ←
B-poireau   0            B-poireau   10   ←
```

**L'appel a réussi et a renuméroté la recette B.** Aucune des quatre gardes ne l'a vu : le tableau
n'est pas vide, il n'a pas de doublon, son cardinal égale le compte de A (2 = 2), et les deux lignes
visées ont bien été touchées. La RLS n'a rien à refuser — tout appartient au foyer.

**Le correctif tient en une clause**, et il a été éprouvé à son tour :

```sql
   update recipe_ingredients ri
      set sort_order = t.rang * 10
     from unnest(p_ids) with ordinality as t(id, rang)
    where ri.id = t.id
      and ri.recipe_id = p_recipe_id;   -- ← sans elle, le trou ci-dessus
```

Les lignes touchées tombent alors à 0, et la garde de comptage refuse. **Quatre contrôles mesurés :**

| Contrôle | Attendu | Mesuré |
|---|---|---|
| Appel forgé A annoncée / identifiants de B | refusé | ✅ « (0 déplacés sur 2) », B **intacte** |
| Appel légitime sur A | accepté, ex æquo résorbés | ✅ `0,0` → `10,20`, **2 positions distinctes** |
| Cardinal partiel (1 sur 2) | refusé | ✅ « (1 cités, 2 en base) » |
| Un identifiant cité deux fois | refusé | ✅ « Un ingrédient est cité deux fois » |

⚠️ **`security INVOKER`, comme `reorder_aisles` et à l'inverse de `seed_default_aisles`.** Une
fonction `security definer` qui reçoit un identifiant en paramètre doit le recontrôler elle-même —
c'est le trou que la story 2.1 a dû refermer. En `invoker`, la RLS fait le travail pour le **foyer**,
et le filtre ci-dessus fait le reste pour la **recette**.

### Piège n°5 — Ici, les ex æquo ne sont pas un cas limite : c'est l'état de départ

`recipe_ingredients.sort_order` est `int not null default 0`. **Tous** les ingrédients créés sans
calcul explicite valent donc **0** — mesuré dans `information_schema.columns`.

C'est plus dur que pour les rayons, où `seed_default_aisles` posait des positions distinctes et où
le défaut à 100 ne heurtait qu'un rayon. Ici, une recette de dix ingrédients ajoutés sans calcul a
**dix ingrédients à la position 0**, et leur ordre d'affichage est celui que Postgres choisit ce
jour-là.

Deux conséquences, et il faut les deux :

1. **Le tri secondaire est obligatoire** — `.order("sort_order").order("created_at")`. `created_at`
   plutôt que `name` : l'ordre d'ajout est ce qu'un cuisinier attend d'une liste d'ingrédients qu'il
   n'a pas encore rangée, là où l'alphabet n'aurait aucun sens.
2. **La position d'un ingrédient ajouté se calcule**, jamais laissée au défaut — motif de
   `prochainOrdre` (`lib/rayons/saisie.ts:113-117`), `max + 10`, avec le même piège du `Math.max()`
   sur une liste vide qui rend `-Infinity`.

### Piège n°6 — La quantité est décimale, pas entière

`quantity numeric(8,2)`, **nullable**. Trois écarts avec les entiers de la story 3.1 :

- **`normaliserEntier` ne convient pas.** « 0,5 » et « 1.5 » sont des quantités légitimes ;
  `/^-?\d+$/` les refuse. Il faut une fonction sœur, et le **séparateur décimal français** doit être
  accepté : un clavier français produit une virgule, et `Number("0,5")` vaut `NaN`.
- **`numeric(8,2)` borne à 999999.99** et arrondit à deux décimales. Au-delà, Postgres rend `22003`,
  que rien ne traduit — donc « Réessaie » en boucle sur une saisie fautive.
- **`null` est légitime** : « du sel », « un peu de persil ». Une quantité vide n'est pas une erreur.

⚠️ **Quantité négative : ne l'invente pas comme règle sans contrainte en base.** La story 3.1 a
tranché ce cas pour les temps de cuisson — `servings` a reçu sa contrainte parce qu'il est *consommé
par un calcul*, les temps non. Ici la quantité **est** consommée par un calcul
(`coalesce(ri.quantity,0) * …`). L'argument penche donc pour une contrainte — mais AUCUN AC ne le
demande. Voir § Questions, point 4.

### Piège n°7 — `lib/rayons/ordre.ts` est déjà générique : extraire, pas recopier

Le module de la story 2.2 travaille sur `ReadonlyArray<{ id: string }>` et ne connaît **rien** aux
rayons. Ses trois fonctions — `ordreDeplace`, `ordreApresDeplacement`, `indexCibleDuGlisser` — et son
type `Sens` s'appliquent tels quels à des ingrédients.

**Le projet a déjà fait ce geste une fois** : `lib/texte.ts` a été extrait de `lib/foyer/saisie.ts`
« quand les rayons sont devenus le troisième champ libre du produit ». C'est le même mouvement, au
même moment du cycle — le deuxième appelant.

⚠️ **Ne recopie pas.** Deux copies de la géométrie du glisser divergeront, et c'est exactement le
défaut que `useSoumission` a été extrait pour réparer : *« ce squelette existait en trois copies, et
les copies avaient déjà divergé »*.

⚠️ **Son en-tête parle de « rayons » partout.** L'extraction demande de réécrire ces commentaires
en termes neutres **sans perdre les avertissements**, qui sont le vrai contenu : « ces fonctions
rendent l'ordre COMPLET, jamais un couple à échanger », « `null` veut dire n'appelle pas la base ».

### Piège n°8 — Où la liste se monte, et le récidiviste des régions de statut

**Un composant à part, monté sous le formulaire de la recette.** `FormulaireRecette.tsx` fait déjà
~500 lignes, porte six champs, la suppression et la garde des saisies non enregistrées. Y verser les
ingrédients en ferait le plus gros fichier du dépôt après `ListeRayons`.

⚠️ **Et surtout, les deux n'ont pas le même modèle d'écriture.** Le formulaire de la recette
**accumule** puis enregistre en un geste, avec une garde. Les ingrédients s'écrivent **un par un**,
immédiatement, comme les rayons. Les mêler ferait entrer les ingrédients dans le périmètre de la
garde — et un ajout d'ingrédient enregistré déclencherait « tu as des modifications non
enregistrées » sur la recette. **Garde les deux modèles séparés.**

**Les régions de statut sont le récidiviste de ce dépôt** — deux défauts trouvés *deux fois de
suite* sur `/rayons`, la première correction en ayant créé deux pour trois surfaces. Compte tes
surfaces de soumission : l'ajout, chaque panneau d'édition, la suppression, le réordonnancement.
**Une région par surface**, montée **en permanence**, et `reserve` quand elle surplombe une cible.

### Piège n°9 — Ce qui est stocké ici et consommé ailleurs, sans y toucher

Trois champs que cette story **écrit** et ne **lit** jamais. Les traiter en simples champs de
formulaire, sans logique :

| Champ | Consommé par | Ce que cette story fait |
|---|---|---|
| `aisle_keyword` | `resolve_aisle_id`, **3e repli** (`:498-507`) | le stocke, tel quel |
| `optional` | `generate_grocery_list_from_menu`, `where ri.optional = false` (`:553`) | le stocke |
| `unit` | l'agrégation et la clé canonique | le stocke — mais **contraint** (piège n°1) |

⚠️ **`product_id` reste nul et hors périmètre** : c'est le cache Open Food Facts, nommément déféré
en v2 dans l'Architecture Spine. Ne l'expose pas, ne le renseigne pas.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| L'écran de **lecture** d'une recette (ingrédients compris) | **Story 3.3** |
| Étiquettes, filtre, recherche | **Story 3.4** |
| Grille du menu, assignation | **Stories 3.5 et 3.6** |
| La résolution de rayon, l'agrégation, la mise à l'échelle | **Epic 4** — tout est déjà en base |
| Toute **conversion** entre unités | **jamais** — AD-7 l'interdit explicitement |
| `product_id` / Open Food Facts | **v2 produit** |
| Realtime | **Epic 4** (AD-8). Ici, l'autre membre voit au rechargement |
| Une contrainte d'unicité sur `(recipe_id, name)` | **jamais sans décision** — deux « huile » à deux étapes sont légitimes |
| Une contrainte `unique (recipe_id, sort_order)` | **non** — même arbitrage qu'à la story 2.2 : la fonction garantit l'unicité par construction, et un test la mesure |
| Rendre `unit` ou `quantity` obligatoires | **non** — « du sel » est un ingrédient valide |

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre de section | « Les ingrédients » | « Gestion des ingrédients » |
| Aucun ingrédient | « Pas encore d'ingrédient. » + « Ajoute-les dans l'ordre où tu t'en sers. » | « Liste vide » · « Aucun enregistrement » |
| Champ nom | « Quoi » ou « Ingrédient » | « Libellé » · « name » |
| Champ quantité | « Combien » | « Quantité (numeric) » |
| Champ unité | « Unité » | « Unité de mesure normalisée » |
| **Champ mot-clé de rayon** | « Dans quel rayon le chercher (facultatif) » | « Mot-clé de rayon » · « aisle_keyword » · **jamais** le mot « règle » |
| Case optionnel | « On peut s'en passer » | « Optionnel (booléen) » · « Ingrédient non requis » |
| Monter / descendre (`aria-label`) | « Monter les oignons » | « Haut » · « Ordre −1 » |
| Déplacement réussi | « Les oignons sont en 3e position. » | « `sort_order` enregistré » |
| Ajouté / modifié | « C'est noté. » | « Ingrédient créé avec succès » |
| Supprimé | « C'est retiré. » | « Suppression effectuée » |
| Nom vide | « Il faut un nom. » | « Le champ name est requis » |
| Quantité illisible | « Une quantité s'écrit en chiffres. » | « NaN » · « Format invalide » |
| L'ensemble a changé sous les pieds | « La liste des ingrédients vient de changer. La voilà à jour. » | « Conflit » · **jamais** « Réessaie » |
| Échec générique | « Ça n'a pas marché. Réessaie dans un instant. » | le message brut de la base |

**Pas d'abricot** : UX-DR2 le réserve à l'action courses. L'anneau de focus reste la seule exception,
et c'est déjà une règle globale.

**DESIGN.md ne spécifie pas cet écran** — il place « l'éditeur de recettes » hors de son périmètre de
composition (`:329`). Compose avec ce qui existe ; n'invente pas un langage visuel.

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — le vocabulaire d'unités et le non-vide vont **en base**, pas dans la vigilance du
  formulaire. Jamais de `SUPABASE_SERVICE_KEY`
- **AD-3 / AD-6 / AD-7** — l'unité écrite ici est un **morceau de la clé canonique** de l'Epic 4.
  Aucune conversion, jamais
- **AD-13** — client-direct, y compris pour l'appel RPC de réordonnancement. Le critère est la
  **cause**, pas l'analogie
- **AD-16** — foyer **symétrique** : aucun contrôle d'accès par membre
- **AD-17** — l'isolation se prouve par un test **exécuté**
- **AR-MIGRATIONS** — strictement additive ; horodatage postérieur à toutes les existantes ; requête
  de contrôle en en-tête
- **UX-DR11 / UX-DR12** — cibles ≥ 44px, contraste AA sur les fonds réels, anneau de focus,
  `prefers-reduced-motion`, 200 % de zoom ; tutoiement, `tabular-nums` sur tout chiffre
- **NFR-10** — **aucune dépendance nouvelle.** Ni bibliothèque de glisser-déposer, ni sélecteur, ni
  harnais de test de composants

### Standards de test

Trois familles. **Comptes mesurés le 2026-08-02 sur la branche de la story 3.1** :

1. **`npm test`** — glob `lib/**/*.test.ts`, **103/103**. Couvre le pur : `unites`,
   `normaliserQuantite`, `lib/ordre.ts` après extraction
2. **`npm run test:isolation`** — glob `supabase/tests/**/*.test.ts`, **34/34**. C'est là que va la
   preuve de NFR-5 sur `recipe_ingredients` **et** l'appel forgé inter-recettes
3. **Le manuel** — le JSX reste intestable sans dépendance. Les deux thèmes, le focus, le zoom, le
   glisser au doigt

**TDD sur `lib/`, phase rouge constatée.** ⚠️ `node --test` sur un glob vide rend 0.
⚠️ **Vérifie les dents** : un test qui ne tombe jamais ne prouve rien.

⚠️ **Et une leçon de la story 3.1 sur les dents :** une mutation qui ne fait rien tomber n'est pas
forcément un test sans dent — ce peut être un **no-op**. Retirer le `with check` d'une politique
`FOR ALL` n'ouvre rien, Postgres réutilisant alors l'expression `using`. Pour ouvrir vraiment, il
faut `with check (true)`.

### Project Structure Notes

```
app/recettes/[id]/modifier/
  page.tsx                    ~  monte IngredientsRecette sous le formulaire, et lui passe
                                 les ingrédients lus côté serveur
  FormulaireRecette.tsx       INCHANGÉ si possible — son modèle d'écriture est distinct
                                 (piège n°8). Si tu dois y toucher, dis pourquoi
  IngredientsRecette.tsx      +  liste, ajout, édition, suppression, réordonnancement
lib/
  ordre.ts + ordre.test.ts    +  EXTRAITS de lib/rayons/ordre.ts (piège n°7)
  rayons/ordre.ts             ~  ré-export ou importeurs redirigés — choisis et écris pourquoi
  recettes/
    unites.ts + .test.ts      +  UNITES (8 jetons, source unique), estUniteConnue, type Unite
    ingredients.ts            +  Ingredient, ingredientsDeRecette — client EN PARAMÈTRE
    saisie.ts + .test.ts      ~  + normaliserQuantite (décimale, virgule française)
    erreurs.ts + .test.ts     ~  + les refus d'ingrédient et de réordonnancement
  supabase/types.ts           ~  régénéré — la FONCTION apparaîtra dans `Functions`
supabase/
  migrations/<ts>_require_valid_recipe_ingredient_fields.sql  +  2 `check`
  migrations/<ts>_reorder_recipe_ingredients.sql              +  la fonction, 4 gardes
                                                                 + LE FILTRE recipe_id
  tests/isolation.test.ts     ~  + recipe_ingredients, + l'appel forgé inter-recettes
  tests/contraintes.test.ts   ~  + l'accord UNITES ↔ contrainte, + le cas NFD
docs/migrations.md            ~  le compte de fonctions (voir Task 2 et § Questions)
app/globals.css               INCHANGÉ par défaut — une classe sans appelant est une dette
proxy.ts, package.json        INTACTS — aucune dépendance (NFR-10)
```

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session** — ses sept règles de méthode et
son tableau « motifs à reprendre » ne sont pas recopiés ici. Trois mordent particulièrement :

- **Ne consigner comme vérifié que ce qui a été exécuté.** Cette story distingue le mesuré du déduit
  à chaque fait ; fais pareil.
- **Un invariant entre deux fichiers se mesure.** D'où l'accord `UNITES` ↔ contrainte dans
  `contraintes.test.ts`, et non un commentaire.
- **Une énumération ne peut pas gagner contre une catégorie** — sauf quand la catégorie **est** une
  énumération fermée, ce qui est précisément le cas des unités. C'est l'exception qui confirme la
  règle, et elle vaut d'être notée : AD-7 *définit* l'ensemble, il ne le décrit pas.

**Une case vide honnête vaut mieux qu'une case cochée à tort.** Les stories 1.5 à 3.1 ont toutes
laissé des sous-tâches vides avec leur raison ; la revue l'a préféré à chaque fois.

### Intelligence git

⚠️ **Cette story a une dépendance de branche, et ce n'est pas un détail — voir § Questions, point 1.**

Au 2026-08-02, `main` (`2ad08c4`) ne contient **ni la story 2.2 ni la 3.1** :

| Ce dont 3.2 a besoin | Où c'est | État |
|---|---|---|
| L'écran `/recettes/[id]/modifier` | story 3.1, **PR #17** | ouverte, **CI verte** |
| `lib/rayons/ordre.ts` (le pur du réordonnancement) | story 2.2, **PR #15** | ouverte, **CI verte** |
| `reorder_aisles` comme modèle | story 2.2, PR #15 | ouverte |

Neuf migrations sur `main`, dix avec la 2.2, onze avec la 3.1. **Les deux de cette story seront donc
la douzième et la treizième** — à condition que les deux PR soient fusionnées d'abord.

⚠️ **`main` est protégée** : `verify` et `isolation` requis, `strict`, push direct interdit. Depuis
`vercel.json`, un commit sur `main` applique les migrations en production. **Fusionner n'est plus
mettre en ligne** : regarder le déploiement de `main` réussir, pas seulement la PR passer au vert.

⚠️ **Un horodatage de migration antérieur à la dernière appliquée fait échouer `db push` — et
TOUS les déploiements suivants**, jusqu'à intervention manuelle. Crée tes migrations **au moment de
les écrire**, pas au moment d'ouvrir la branche.

Conventional Commits, corps en français ; branche → PR → **squash merge** CI verte. Versions
installées à ne pas bouger : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`,
`typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5`.
Node 24.

### Environnement de test

Stack local **debout** au 2026-08-02, base **remise à l'état du dépôt** après les sondes de cette
story (`recipe_ingredients`, `recipes`, `households` à 0, aucune fonction `reorder_ing*` résiduelle
dans `pg_proc` — vérifié). Ports 5532x : API `55321`, base `55322`, Studio `55323`, Mailpit `55324`.

⚠️ **`localhost:3333`, jamais `127.0.0.1:3333`** — Next 16 bloque ses ressources en cross-origin,
l'hydratation échoue, et **rien ne le dit dans le navigateur**.

⚠️ **`.env.local` pointe sur la PRODUCTION.** Bascule sur le stack local pour tout parcours qui
écrit, et **restaure à l'identique en comparant l'empreinte SHA-256** — motif des stories 2.2 et
3.1.

⚠️ **Après un `supabase db reset`, Kong garde l'ancienne adresse du conteneur d'authentification.**
Symptôme : `AuthRetryableFetchError`, la moitié des tests d'isolation en échec,
`/auth/v1/health` en **502** alors que le conteneur `auth` est sain. Remède :
`docker restart supabase_kong_nutriclaude`. **Ça ressemble à une régression et ça n'en est pas
une** — trouvé à la story 3.1.

⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION.** AC1 à AC4 dépendent des
migrations de cette PR : ils n'y sont **pas démontrables**.

### References

- [Source: epics.md#Story-3.2] — user story et 4 AC, cités verbatim ; [#FR-18], [#FR-52], [#NFR-10],
  [#UX-DR11], [#UX-DR12]
- [Source: …/ARCHITECTURE-SPINE.md] — **AD-7** (`g, kg, ml, L, pièce, cs, cc, pincée`, sans
  conversion), AD-3 (clé canonique), AD-6, AD-12 (l'exemple `lait / L`), AD-1, AD-2, AD-13, AD-16,
  AD-17, AR-MIGRATIONS
- [Source: …/DESIGN.md:329] — l'éditeur de recettes est **hors périmètre de composition**
- [Source: _bmad-output/project-context.md] — chargé à chaque session, c'est lui qui fait foi
- [Source: initial_schema.sql] — `recipe_ingredients` (`:156-169`), **le commentaire trompeur
  `:162`**, `recipe_ingredients_all` (`:299-313`), `resolve_aisle_id` (`:466-511`, le 3e repli
  `:498-507`), `generate_grocery_list_from_menu` (`:538-567`, `group by :554`, `optional :553`)
- [Source: 20260729095923_require_non_blank_aisle_name.sql:80] — la regex à **extraire par script**
- [Source: 20260801124553_require_valid_recipe_fields.sql] (story 3.1) — le modèle d'en-tête, et la
  note mesurée sur les échappées `\uwxyz` de l'analyseur d'expressions rationnelles
- [Source: branche `feat/rayons-reordonner-parcours`] — `lib/rayons/ordre.ts` (à extraire),
  `20260731062945_reorder_aisles.sql` (le modèle, et ses quatre gardes)
- [Source: 3-1-creer-et-editer-une-recette.md] — les 13 pièges, le parcours à l'écran, les pièges
  d'outillage (Kong, `.env.local`, `getComputedStyle` vivant)
- **Sondes exécutées le 2026-08-02 sur le stack local** — (1) le trou inter-recettes de la fonction
  naïve, **reproduit** puis refermé, 4 contrôles ; (2) l'absence de contrainte sur `unit` et `name`
  dans `pg_constraint` ; (3) `sort_order` à 0 par défaut dans `information_schema.columns` ;
  (4) l'inégalité NFC/NFD de `pièce` côté Node **et** côté Postgres. Base remise à l'état du dépôt.

---

## Questions ouvertes — à trancher avant démarrage

**Question 1 — Sur quoi cette story se branche.** *(Recommandation : A.)*

`main` n'a ni la 2.2 ni la 3.1. Cette story a besoin de l'écran de la 3.1 **et** du module d'ordre
de la 2.2. Les deux PR sont ouvertes avec la CI verte.

- **A. Fusionner #15 puis #17, et brancher 3.2 depuis `main`** *(recommandé)* — le seul chemin où
  les horodatages de migration sont sûrs et où la revue de 3.2 ne traîne pas le code des deux
  autres. ⚠️ Il reste des contrôles ouverts sur les deux : le glisser au doigt (#15) et la requête
  de contrôle de migration en production (#15 **et** #17).
- **B. Empiler 3.2 sur la branche de #17** — possible, mais la PR de 3.2 afficherait le diff de la
  3.1 tant que #17 n'est pas fusionnée, et une revue adversariale sur un diff empilé est nettement
  plus dure.
- **C. Attendre** — si tu préfères mener les revues de #15 et #17 avant d'ouvrir un troisième front.

**Question 2 — Retirer un ingrédient.** *(Recommandation : oui, au périmètre.)*
« retirer » est dans le *I want* et dans aucun AC. Une liste où l'on ajoute sans pouvoir retirer est
un aller simple, et le motif (confirmation en deux temps) existe déjà. Coût : ~25 lignes et ses
tests. C'est le même arbitrage qu'à la story 3.1, tranché de la même façon.

**Question 3 — Le glisser, ou les flèches seules.** *(Recommandation : flèches seules.)*
Pour les rayons, tu as tranché **contre** la recommandation et retenu le glisser. Les deux cas
diffèrent sur trois points : le parcours magasin se réordonne rarement mais **compte** (c'est l'ordre
d'un vrai magasin), il vit sur onze lignes stables, et FR-12 **exige** la manipulation directe. AC4
n'exige rien de tel, une recette a typiquement moins de dix ingrédients, et la 2.2 a chiffré le
coût : **~200 lignes de JSX qu'aucun test ne couvre, et une vérification manuelle dédoublée
souris/doigt** — dont la moitié doigt n'a toujours pas été faite.
Les flèches restent obligatoires dans les deux cas (WCAG 2.5.7 + seul chemin clavier).

**Question 4 — Une contrainte sur la quantité.** *(Recommandation : `quantity >= 0`, en base.)*
Aucun AC ne le demande, mais `quantity` **est consommée par un calcul** — c'est le critère exact qui
a valu sa contrainte à `servings` en story 3.1, et qui l'a refusée aux temps de cuisson. Une
quantité négative produirait des quantités de courses négatives, additionnées aux autres recettes par
l'UPSERT-incrémente d'AD-6. Coût : une ligne dans la migration de la Task 1.

**Question 5 — `lib/rayons/ordre.ts` après extraction.** *(Recommandation : redirigier les
importeurs, supprimer le fichier.)* Un ré-export laisse deux chemins d'import pour une même chose,
et le prochain développeur en choisira un au hasard. Un seul appelant existe (`ListeRayons`) : le
coût est d'une ligne.

---

## Dev Agent Record

### Agent Model Used

_(à renseigner par l'agent d'implémentation)_

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Changement |
|---|---|
| 2026-08-02 | Story créée. **Le mécanisme de réordonnancement a été ÉPROUVÉ PAR EXÉCUTION avant d'être prescrit**, et la sonde a trouvé un trou que la story 2.2 n'avait pas : calquée à l'identique sur `reorder_aisles`, la fonction accepte un appel annonçant une recette et citant les identifiants d'une **autre recette du même foyer**, et la renumérote — les quatre gardes ne le voient pas, la RLS étant par foyer et non par recette. Correctif éprouvé à son tour : le filtre `and ri.recipe_id = p_recipe_id` dans l'`update`, 4 contrôles mesurés. **Trois autres faits mesurés** : `unit` et `name` sans aucune contrainte (`pg_constraint`), `sort_order` à 0 par défaut pour tous — donc les ex æquo sont l'état de départ, pas un cas limite —, et l'inégalité NFC/NFD de `pièce` côté Node comme côté Postgres, qui fait de la forme du jeton un **contrat avec la clé canonique de l'Epic 4**. Relevé au passage : le commentaire du schéma (`:162`) contredit AD-7 — cinq jetons ASCII contre huit accentués. Cinq questions ouvertes, dont une **dépendance de branche** : `main` n'a ni la 2.2 ni la 3.1 |
