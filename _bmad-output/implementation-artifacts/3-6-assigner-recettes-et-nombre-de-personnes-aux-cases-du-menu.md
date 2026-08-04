---
baseline_commit: a56ba0b0458d741f7c8f86f7624923a99b198559
---

# Story 3.6: Assigner recettes et nombre de personnes aux cases du menu

Status: review

<!-- Sixième et dernière story de l'Epic 3, et la PREMIÈRE qui ÉCRIT dans
     `meal_plan_entries`. Trois choses la distinguent de toutes les stories précédentes de
     cet epic, et il faut les avoir en tête avant de lire les critères :

     1. ⚠️ **ELLE PORTE UNE MIGRATION, et c'est la seule de l'Epic 3 dans ce cas depuis la
        3.2.** Son AC2 nomme lui-même la contrainte à poser. Elle en porte une SECONDE que
        les critères ne nomment pas et qui est due quand même — le trou d'intégrité que la
        3.5 a MESURÉ et daté à son intention. Les deux vivent dans le MÊME fichier.

     2. ⚠️ **ELLE ROUVRE LA MOITIÉ D'UN CRITÈRE DE LA 3.5.** L'AC4 de la 3.5 (« les cases
        vides sont lisibles ET DIRECTEMENT ACTIONNABLES ») a été livré à moitié le
        2026-08-04, par décision datée de Florian, au motif que « la 3.6 le fera ». C'est
        la règle §5 de `project-context.md` : une prémisse qui sert à reporter un défaut se
        ROUVRE en la citant avant d'être réinvoquée. Elle est citée en § Ce que cette story
        REFERME, et sa fermeture est la Task 4.

     3. ⛔ **L'AC2 DE LA 3.5 — « aucun défilement horizontal » — EST EN PRODUCTION SANS
        AVOIR JAMAIS ÉTÉ OBSERVÉ.** Mesuré le 2026-08-04 : la PR #22 a été fusionnée à
        13:34:53 UTC alors que le fichier de story disait « ⛔ NE PAS FUSIONNER EN L'ÉTAT »
        et que sa Task 5 (le parcours à l'écran) était entièrement décochée. Le corps de la
        PR est le gabarit vierge, aucune case cochée. **Cette story est la première paire
        d'yeux qui se posera sur cette grille** — et elle y ajoute un `<select>`, c'est-à-dire
        exactement l'élément qui peut la faire déborder. Voir piège n°1.

     ⚠️ **LES QUATRE QUESTIONS ONT ÉTÉ TRANCHÉES LE 2026-08-04, AVANT DÉMARRAGE** —
     § Décisions. Les quatre tâches qu'elles bloquaient sont ouvertes, plus rien n'attend.
     La plus lourde n'était pas dans les options proposées : **le nombre de personnes se règle
     au niveau du FOYER et s'ajuste par assignation** (décision 4), ce qui ajoute une colonne
     à `households`, une section à `/foyer`, et fait de cette story la PREMIÈRE surface du
     produit qui écrit dans `households`. -->

<!-- ⚠️ **PÉRIMÈTRE ÉLARGI PAR LA DÉCISION 4, ET C'EST DÉLIBÉRÉ.** Cette story ne touche plus
     seulement le menu : elle pose `households.default_servings` et l'écran qui le règle. Trois
     conséquences à ne pas découvrir en cours de route :
       · la migration change la **forme du schéma** — `supabase gen types` n'est plus « peut-être »,
         il est **dû** (une contrainte seule ne change rien ; une colonne, si) ;
       · trois nombres de personnes coexistent désormais à l'écran, et les confondre est un vrai
         défaut de microcopy — voir piège n°14 ;
       · l'isolation de `households` est **déjà éprouvée** (`isolation.test.ts:214-223`) : ne la
         re-teste pas, la politique est par ligne et pas par colonne. -->

## Story

As a membre configurant le foyer (Florian),
I want assigner des recettes aux cases de la grille avec un nombre de personnes,
So that le menu soit prêt à générer la liste (en Epic 4).

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-3.6`.

**AC1 — Assigner une recette avec son nombre de personnes**
**Given** une case (jour × repas) de la grille et un répertoire de recettes
**When** Florian y assigne une recette et indique le nombre de personnes prévues
**Then** l'assignation est persistée dans `meal_plan_entries` avec le nombre de personnes
(FR-15)

**AC2 — Pas de doublon d'assignation**
**Given** une même recette déjà assignée à la même case (jour × repas)
**When** une assignation identique est retentée
**Then** elle est empêchée par la contrainte
`unique(household_id, meal_date, meal_type, recipe_id)` — pas de doublon d'assignation (AD-6)

**AC3 — Retirer, ou changer le nombre de personnes**
**Given** une case assignée
**When** Florian retire la recette ou change le nombre de personnes
**Then** la modification est persistée et la case reflète l'état à jour

**AC4 — La grille montre ce qui est prévu, et pour combien**
**Given** un menu assigné
**When** Florian consulte la grille
**Then** chaque case montre la recette assignée et son nombre de personnes, prête à alimenter
la génération de la liste de l'Epic 4

> **⚠️ L'AC2 dit « empêchée par la contrainte », pas « empêchée par l'écran ».** La
> contrainte n'existe PAS en base au 2026-08-04 — vérifie-le toi-même :
> `grep -rn "meal_plan" supabase/migrations/` ne rend qu'`initial_schema.sql`, et aucune de
> ses sept occurrences n'est un `unique`. **Poser la contrainte est le critère ; ce que
> l'écran en fait vient après** (piège n°6 : empêcher sans un mot serait une case qui ne
> répond pas).

> **⚠️ L'AC4 dit « la recette assignée », au singulier, et la base en admet PLUSIEURS.** La
> contrainte d'AD-6 interdit le **doublon de la même recette** dans une case, jamais la
> pluralité : « Soir : gratin + salade » reste un menu normal et reste stockable après cette
> migration. `grouperParCase` rend déjà une **liste** par case, et la 3.5 l'a écrit exprès.
> **Ne réduis pas la case à une recette au singulier** — voir piège n°7.

> **⚠️ Ce que ces quatre critères NE disent PAS et qui est dû quand même :** le trou
> d'intégrité de `recipe_id` (§ Ce que cette story REFERME, point 2), l'inversion du test
> d'isolation qui assure aujourd'hui que ce trou EXISTE (piège n°2), et la confirmation de
> suppression d'une recette devenue fausse (piège n°9). Les trois sont datés et adressés
> nommément à cette story dans `deferred-work.md`. **Une story doit laisser le système
> entier en état de marche, pas seulement satisfaire ses propres AC.**

---

## Ce que cette story REFERME — trois prémisses rouvertes, pas supposées closes

*Règle §5 de `project-context.md` : « une prémisse qui sert à reporter un défaut se rouvre
avant d'être réinvoquée ». Les trois qui suivent ont été écrites en désignant CETTE story.
Elles sont citées ici, pas résumées.*

### 1. La moitié de l'AC4 de la 3.5

> « L'AC4 demande que les cases vides soient "lisibles **et directement actionnables**".
> "Lisibles" est livré. "Directement actionnables" ne l'est pas : l'action est d'assigner une
> recette, c'est-à-dire la story 3.6 en entier. […] **Ce qui l'attend est déjà en place : la
> case est dimensionnée, nommée, et n'a besoin que de sa destination. Rien n'est à jeter.** »
> — `deferred-work.md`, 2026-08-04

`app/menu/page.tsx:43-49` porte le `min-h-touch` posé d'avance pour ça, et `:55-67` explique
pourquoi il n'y a NI `<button disabled>`, NI `tabIndex={0}`, NI `title="Bientôt"`. **La case
attend une destination réelle. Cette story la lui donne** — c'est la Task 4.

### 2. Le trou d'intégrité de `recipe_id`

> « **LE TROU : rien n'oblige `meal_plan_entries.recipe_id` à désigner une recette du MÊME
> foyer.** […] Ce n'est donc PAS une fuite d'isolation […] c'est un défaut d'**intégrité
> référentielle**. […] *Reporté : la story 3.5 ne fait que LIRE. Le trou est à l'écriture, et
> c'est la story 3.6 qui l'ouvre — c'est elle qui doit le fermer, en même temps qu'elle pose
> la contrainte `unique(household_id, meal_date, meal_type, recipe_id)` d'AD-6 que son AC2
> nomme. **Les deux vivent dans la même migration.*** »
> — `deferred-work.md`, 2026-08-04

**Mesuré le 2026-08-04**, sonde à deux comptes réels sur le stack local :

| Question | Réponse mesurée |
|---|---|
| A peut-elle poser dans SON menu une case pointant une recette de B ? | **OUI** — `error` nul, une ligne rendue |
| Le titre de B traverse-t-il la jointure `recipes(id, title)` ? | **NON** — PostgREST rend `recipes: null` |

⚠️ **AD-1 / AD-2 : la garde `ligne.recipes ? … : []` de `casesDeLaSemaine` protège
l'AFFICHAGE, elle ne referme rien.** La règle métier vit en Postgres. Cette story ouvre
l'écriture — donc c'est elle qui pose la frontière. Voir § Décision 1 pour la forme.

### 3. L'AC2 de la 3.5, en production et jamais observé

Pas une prémisse reportée : un critère **fusionné sans sa démonstration**. Constaté par
`gh pr view 22` et `git log` le 2026-08-04 — PR #22 fusionnée à `2026-08-04T13:34:53Z`,
corps du gabarit vierge, aucune case cochée ; le fichier de story de la 3.5 porte toujours
« ⛔ NE PAS FUSIONNER EN L'ÉTAT » et sa Task 5 entièrement décochée ; aucun commit
postérieur à `a56ba0b` ne les rouvre.

**Conséquence, et elle n'est pas négociable :** le parcours à l'écran de cette story (Task 8)
porte **aussi** l'AC2 de la 3.5. Ce n'est pas de la générosité de périmètre — cette story
ajoute à cette grille l'élément le plus susceptible de la faire déborder (piège n°1). Le
mesurer une fois, c'est fermer les deux.

---

## Tasks / Subtasks

- [x] **Task 1 — La migration : quatre volets, un seul fichier** (AC2, le trou du § REFERME,
      décisions 1, 3 et 4)
      <!-- ⚠️ **UNE SEULE migration, pas quatre fichiers.** `db push` n'est pas atomique sur un
           lot (`docs/migrations.md`) : plusieurs fichiers dont l'un échoue laissent les
           précédents appliqués et enregistrés. Les quatre volets se contrôlent par la même
           requête et servent la même story — un seul fichier, un seul point d'échec. -->

  - [x] `npx supabase migration new contraindre_les_assignations_de_menu`
  - [x] **L'en-tête porte sa requête de contrôle**, et `npm run check:migrations` le vérifie.
        <!-- ⚠️ COCHÉE POUR CE QU'ELLE DIT — la requête EST écrite, et le script la voit.
             ⛔ **SON EXÉCUTION SUR LA PRODUCTION N'A PAS EU LIEU ET NE POUVAIT PAS AVOIR
             LIEU ICI** : c'est le geste de la revue de PR, et c'est une CONDITION DE FUSION.
             Ce qui a été exécuté : les trois volets sur le STACK LOCAL le 2026-08-04, qui
             rendent zéro ligne — et le stack local venait d'être remis à zéro, donc ça ne
             prouve rien sur le distant. C'est écrit dans l'en-tête de la migration comme une
             DÉDUCTION, pas comme une mesure. -->
        ⚠️ **Elle s'exécute EN REVUE, sur la PRODUCTION** — il n'y a plus de `db push`
        manuel depuis le 2026-07-29, donc plus de moment « juste avant de pousser ». Les
        trois volets qui peuvent échouer, **zéro ligne** attendue chacun :
        ```sql
        -- 1. Doublons d'assignation (bloquerait la contrainte unique)
        select household_id, meal_date, meal_type, recipe_id, count(*)
          from meal_plan_entries
         group by 1, 2, 3, 4 having count(*) > 1;

        -- 2. Cases pointant la recette d'un autre foyer
        select m.id, m.household_id, r.household_id
          from meal_plan_entries m join recipes r on r.id = m.recipe_id
         where r.household_id <> m.household_id;

        -- 3. Nombre de personnes non exploitable
        select id, servings from meal_plan_entries where servings <= 0;
        ```
        ⚠️ **Le quatrième volet n'a RIEN à contrôler, et c'est à écrire plutôt qu'à taire** :
        ajouter une colonne `not null` **avec valeur par défaut** ne peut pas échouer sur des
        données existantes (`docs/migrations.md`, « autorisé sans précaution »). Une requête
        inventée pour faire nombre serait pire que son absence.
        ⚠️ **« Attendu zéro ligne » est une DÉDUCTION, pas une mesure** — et la formule
        exacte de `20260801124553` s'applique : aucune surface n'a jamais écrit dans
        `meal_plan_entries` (la 3.5 ne fait que lire, et c'est le premier écran de la table).
        **Écris-le comme une déduction.** Le stack local en rend 0, ce qui ne prouve rien sur
        le distant.
  - [x] **Volet 1 — l'unicité (AC2)** :
        ```sql
        alter table meal_plan_entries add constraint meal_plan_entries_assignation_unique
          unique (household_id, meal_date, meal_type, recipe_id);
        ```
        **Mot pour mot ce qu'AD-6 prescrit et ce que l'AC2 cite.** Voir piège n°4 pour ce
        qu'elle n'interdit PAS
  - [x] **Volet 2 — la provenance (décision 1 : politique resserrée)** :
        ```sql
        alter policy meal_plan_all on meal_plan_entries
          with check (
            household_id = current_household_id()
            and exists (
              select 1 from recipes r
              where r.id = recipe_id and r.household_id = current_household_id()
            )
          );
        ```
        ⚠️ **`alter policy` ne touche QUE le `with check`** — le `using` reste celui
        d'`initial_schema.sql:317`, et il ne faut pas le réécrire : la **lecture** n'est pas
        concernée, seule l'écriture l'est. Motif de `recipe_ingredients_all`
        (`:299-313`), qui ancre déjà son isolation par un `exists` sur une table voisine.
        ⚠️ **Garde l'égalité explicite sur `household_id` dans le sous-`select`**, même si la
        RLS de `recipes` la rend redondante : elle dit ce que la règle exige au lieu de
        dépendre d'une propriété de la politique voisine (règle §4, appliquée à du SQL)
  - [x] **Volet 3 — le nombre de personnes exploitable (décision 3)** :
        ```sql
        alter table meal_plan_entries add constraint meal_plan_entries_servings_positif
          check (servings > 0);
        ```
        Le raisonnement complet est en piège n°5, et il est **recopié de
        `20260801124553`** — même formule, autre bout de la division
  - [x] **Volet 4 — le réglage du foyer (décision 4)** :
        ```sql
        alter table households add column default_servings int not null default 2;
        alter table households add constraint households_default_servings_positif
          check (default_servings > 0);
        ```
        ⚠️ **`default 2` reprend le défaut historique de `meal_plan_entries.servings`** — ce
        n'est pas un choix neuf, c'est la valeur que le squelette du 2026-05-02 avait déjà
        posée. La reprendre évite d'introduire un second chiffre arbitraire
  - [x] `npx supabase db reset` puis `npm run test:isolation` : la migration se rejoue
        **depuis zéro**, pas seulement par-dessus un état existant (`docs/migrations.md`)
  - [x] ⚠️ **Régénérer les types est DÛ — la décision 4 change la forme du schéma.**
        `npx supabase gen types typescript --local > lib/supabase/types.ts` (⚠️ `--local` et
        non `--linked` : le distant n'a pas encore la migration au moment où tu génères).
        Les trois contraintes n'y changeraient rien ; **la colonne, si** — `households.Row`,
        `.Insert` et `.Update` la gagnent. `git diff` non vide attendu, et **c'est le diff qui
        dit**, pas ce paragraphe
  - [x] `npm run check:migrations` — et **n'ajoute JAMAIS d'entrée à `EXEMPTEES`**
        (`scripts/controler-migrations.mjs:57-62`)

- [x] **Task 2 — Ce que la migration fait tomber : le test qui assurait le trou** (AC2)
      <!-- ⚠️ **CE N'EST PAS DU RANGEMENT, C'EST UNE CI ROUGE.** Le test
           `supabase/tests/isolation.test.ts:1074` « LE TROU POSSIBLE » assure
           AUJOURD'HUI que la pose est ACCEPTÉE (`assert.equal(poseInterdite, null)`).
           La migration la refuse : ce test tombera. Son propre commentaire l'a prévu —
           « pour que le jour où une migration ferme ce trou, ce soit ICI que ça se voie,
           et pas dans une branche `if` qui l'aurait absorbé en silence ». C'est ici. -->

  - [x] Inverser l'assertion de `:1096-1111` : la pose est désormais **refusée**, et le refus
        **nomme la contrainte** (le nom, pas le seul SQLSTATE — motif de
        `contraintes.test.ts`)
  - [x] Réécrire son commentaire d'en-tête : il décrit un état de la base qui n'existe plus.
        ⚠️ **Règle §2** — un commentaire explique un pourquoi ; s'il doit porter un état, il
        porte **sa date** et le fichier qui fait foi
  - [x] ⚠️ **Garder le second volet du test** — « la RLS filtre la ressource embarquée » — mais
        il ne peut plus se démontrer par une pose applicative. Deux chemins possibles : poser
        la ligne avec le **client de service** (le témoin négatif du fichier, `recetteDeService`
        emploie déjà ce motif) puis lire avec le client de A, ou déplacer ce volet dans un test
        distinct. **Le fait mesuré le 2026-08-04 — `recipes: null` à travers la jointure — ne
        doit pas disparaître de la suite** : c'est la seule chose qui l'atteste
  - [x] Le test « A ne lit pas les cases de menu de B » (`:1056`) et « A lit SA semaine de bout
        en bout » (`:1133`) doivent rester verts **sans être retouchés**. S'ils bougent, dis
        pourquoi

- [x] **Task 3 — `lib/menu/` : le pur, et lui seul** (AC1, AC2, AC3)
      <!-- Le JSX n'est couvert par rien (NFR-10 interdit le harnais de composants). Tout ce
           qui peut être pur va ici, où `npm test` le tient. Même partage que
           `lib/menu/semaine.ts` (20 tests) et `lib/recettes/saisie.ts`. -->

  - [x] **Phase rouge constatée** avant l'implémentation — la commande, l'heure, le compte de
        tests en échec. ⚠️ La 3.3 a laissé cette case vide faute d'avoir consigné quoi que ce
        soit, et la 3.5 l'a cochée en produisant sa preuve. **Si tu la coches, produis-la ;
        sinon laisse-la vide avec sa raison** (règle §1)
  - [x] `estCodeRepas(v: string | null | undefined): v is CodeRepas` dans `lib/menu/menu.ts`
        — ⚠️ **dérivé de `REPAS`, jamais d'une seconde liste recopiée.** `REPAS` est déjà « le
        seul endroit qui nomme les repas » (`lib/menu/menu.ts:18-19`), et une énumération
        parallèle divergerait (règle §3). Modèle : `estUniteConnue` de `lib/recettes/unites.ts`
  - [x] **Le `slug` français s'ajoute aux entrées de `REPAS`** (décision 2), avec sa résolution
        `slug → code` : `/menu/2026-08-04/midi`, jamais `/menu/2026-08-04/lunch`. ⚠️ **`REPAS`
        reste le seul décideur** — une table de correspondance ailleurs serait la seconde
        source de vérité que son en-tête interdit (`lib/menu/menu.ts:18-19`)
  - [x] `personnesParDefaut(foyer, …)` **ou rien du tout** — décision 4 : la valeur d'ouverture
        est `households.default_servings`, lue et passée en propriété. ⚠️ **S'il n'y a aucun
        calcul, n'écris pas de fonction** : une indirection sans règle est une dette
  - [x] `lib/menu/erreurs.ts` — `refusAssignation(erreur)`. Motif **exact** de
        `lib/recettes/erreurs.ts`, dont l'en-tête porte le raisonnement complet :
        - `23505` → `"deja-au-menu"` — le doublon d'AC2. ⚠️ **SQLSTATE ici, pas nom de
          contrainte** : `meal_plan_entries` n'aura qu'une seule contrainte d'unicité. Si la
          décision 3 ajoute un `check`, alors le `23514` se discrimine par **nom**
        - `23503` et `42501` → `"menu-change"` — la recette a disparu sous les pieds, ou la
          politique refuse. ⚠️ **Jamais « Réessaie » sur ces deux-là** : c'est le défaut
          nommément corrigé par la revue du 2026-08-03 sur le chemin d'ajout d'ingrédient
        - le reste → `"echec"`
  - [x] `casesDeRecette(supabase, recetteId)` — les cases de menu d'une recette, pour la
        Task 7. Client **en paramètre** (motif de tout `lib/`), garde `estUuid`, `[]` sur zéro
        ligne et `throw` sur `error`
  - [x] Tests de `lib/menu/erreurs.test.ts` et du pur de `menu.ts` — **et les dents mesurées
        par mutation**, avec le piège du no-op en tête (leçon 3.2 : une mutation qui ne fait
        rien tomber peut être un no-op plutôt qu'un test sans dent)
  - [x] ⚠️ **Pas de fichier de test pour les fonctions qui parlent à la base** — ni
        `casesDeLaSemaine`, ni `casesDeRecette`. `recettes.ts`, `ingredients.ts`, `rayons.ts`
        et `menu.ts` n'en ont aucun : un faux client prouverait le mapping, jamais
        l'isolation, et c'est `test:isolation` qui porte ce contrôle. **Si tu en écris un, dis
        ce qu'il prouve que la Task 9 ne prouve pas**

- [x] **Task 4 — La case devient actionnable, et montre pour combien de personnes** (AC4, et
      la moitié d'AC4 de la 3.5)

  - [x] La case **vide** devient un `<Link>` vers `/menu/[jour]/[slug-repas]` (décision 2).
        ⚠️ **C'est la fermeture de la moitié reportée** — cite la décision du 2026-08-04 dans
        le commentaire qui remplace celui de `app/menu/page.tsx:55-67`, ne l'efface pas en
        silence (règle §6 bis, du côté du code). ⚠️ **Et l'objection qui avait fait écarter
        cette forme à la 3.5 — « ça produirait un 404 en attendant » — tombe ici** : c'est
        cette story qui construit la destination. Dis-le, sinon une revue croira la décision
        contredite
  - [x] La case **remplie** montre, pour chaque entrée : le titre de la recette (le `<Link>`
        vers `/recettes/[id]` existe depuis la 3.3 et **reste**) et son **nombre de
        personnes**. ⚠️ **`tabular-nums` sur le chiffre** (UX-DR12), et un libellé qui se lit
        seul — « 4 pers. » comme `ListeRecettes.tsx:135-137`, jamais un « 4 » nu
  - [x] ⚠️ **Deux affordances dans une case, et un seul plancher tactile chacune.** Le titre
        mène à la recette, la case (ou son bouton) mène à l'assignation : deux cibles ≥ 44px
        (UX-DR11), **et deux cibles qui ne s'imbriquent pas** — un `<Link>` dans un `<button>`
        est un DOM invalide, et un `<Link>` posé SUR toute la case avale le clic du titre
  - [x] `app/menu/loading.tsx` suit — son en-tête (`:14-16`) porte la contrainte : « les
        hauteurs, les marges et la grille suivent `page.tsx`. Si l'une bouge, celui-ci doit
        bouger avec ». **Aucun test ne tient cet accord** (NFR-10)
  - [x] ⚠️ **Le repli « aucune recette au répertoire ».** Une case qui invite à assigner alors
        que le répertoire est vide envoie sur un écran sans choix. Dis-le, et propose la
        destination qui existe — `/recettes`. *(C'est la famille « un conseil qui ne peut pas
        fonctionner », que le produit s'interdit.)*

- [x] **Task 5 — L'écriture : assigner, changer le nombre, retirer** (AC1, AC2, AC3)
      <!-- ⚠️ **Écritures client-direct** (AD-13) : ni secret serveur, ni conséquence à faire
           apparaître dans un rendu serveur. Le critère est la CAUSE, pas l'analogie de
           vocabulaire. Motif de `ListeRecettes`, `IngredientsRecette`, `ListeRayons`. -->

  - [x] **L'assignation** : `insert` sur `meal_plan_entries` avec `household_id`,
        `created_by`, `recipe_id`, `meal_date`, `meal_type`, `servings`, puis
        `.select("id").maybeSingle()`.
        ⚠️ **`household_id` et `created_by` explicites** — motif et raison de
        `ListeRecettes.tsx:60-74` : la première est `not null` sans défaut (ce n'est pas une
        garde, `meal_plan_all` porte le `with check`) ; la seconde serait **définitivement
        perdue** si on la laissait nulle. Les deux viennent de `requireProfile()`, qui rend
        `{ id, household_id, display_name }`
  - [x] ⚠️ **`servings` n'est JAMAIS laissé au défaut de la colonne.** Il vaut 2, et l'AC1
        exige que le nombre soit *indiqué*. Même famille de piège que `sort_order` à 0
        (`lib/recettes/ingredients.ts:90-100`). **Décision 4 : le champ s'ouvre sur
        `households.default_servings`**, et la valeur envoyée est celle du champ — pas la
        valeur du foyer relue au moment de l'écriture (elle a pu être ajustée entre-temps)
  - [x] ⚠️ **Changer le réglage du foyer ne réécrit AUCUNE assignation existante.** Une case
        déjà posée garde son nombre — c'est ce que l'AC3 rend modifiable, une case à la fois.
        **N'écris pas d'`update` en masse** : ce serait effacer en silence des ajustements
        délibérés, et rien à l'écran ne le dirait
  - [x] **Lire `data` autant qu'`error`** — zéro ligne est un **succès** PostgREST. Un
        `update`/`delete` sur une ligne que la RLS masque rend zéro ligne et **aucune
        erreur** : sans ce test, l'écran annonce « C'est noté. » sur une écriture qui n'a rien
        touché. Motif `DisplayNameForm.tsx:70-78`, appliqué quatre fois dans
        `IngredientsRecette`
  - [x] **Le changement de nombre de personnes** : `update` sur la ligne, `.eq("id", …)`,
        `.select("id").maybeSingle()`
  - [x] **Le retrait** : `delete` + **confirmation en deux temps**, jamais `window.confirm`
        (hors thème, hors ton, et il bloque toute vérification pilotée par navigateur — motif
        d'`InviteCard`, repris par `ListeRayons`, `FormulaireRecette` et `IngredientsRecette`).
        ⚠️ **Zéro ligne au `delete` n'est PAS un échec** : la case avait déjà disparu, donc
        l'intention est satisfaite (`IngredientsRecette.tsx:418-423`)
  - [x] `useSoumission` + `Notice` + `messageDe`, et **une région de statut PAR SURFACE de
        soumission**. ⚠️ **C'est le récidiviste du dépôt** : deux défauts trouvés *deux fois de
        suite* sur `/rayons`, cinq occurrences au total du « message rendu dans une région
        qui n'existe plus ». Compte tes surfaces avant d'écrire, et **monte chaque région en
        permanence**, hors des branches qui se démontent (`IngredientsRecette.tsx:688-698`)
  - [x] ⚠️ **Les CHAMPS se désactivent pendant l'écriture, pas seulement les boutons.**
        `versColonnes` fige la saisie avant `soumettre` ; ce qui est tapé pendant
        l'aller-retour est déjà perdu. **Et le motif que tu vas copier porte le trou** : mesuré
        le 2026-08-04, `IngredientsRecette.tsx:775-783` — le champ « Combien » n'a PAS
        `disabled={occupe}`, alors que le commentaire vingt lignes au-dessus (`:741-748`)
        affirme que tous les champs le portent. **Copie l'intention, pas le trou**, et ne
        corrige pas celui-là en passant : autre écran, autre story
  - [x] ⚠️ **Aucune copie locale de la liste.** L'état ne porte que l'interface ; les données
        viennent des propriétés et `router.refresh()` les rafraîchit. Une copie divergerait dès
        que l'autre membre écrit, et il n'y a pas encore de propagation temps réel (AD-8,
        Epic 4)
  - [x] Le **focus** après chaque geste : ouvrir, refermer, supprimer font disparaître
        l'élément focalisé, et le focus retombe sur `<body>` — c'est-à-dire en haut du
        document. Motif `retourFocus` (`IngredientsRecette.tsx:206-254`), **et sa leçon** :
        viser la cible qui existera ENCORE après le rendu

- [x] **Task 6 — « Combien on est » sur `/foyer`** (décision 4)
      <!-- ⚠️ **C'est la PREMIÈRE surface du produit qui écrit dans `households`.** L'onboarding
           crée la ligne ; aucun écran ne l'a jamais modifiée depuis. Le nom du foyer lui-même
           n'est pas éditable — `/foyer:65` l'affiche en `hint`, sans champ. -->

  - [x] `households.default_servings` est lu par `app/foyer/page.tsx` et passé à un composant
        client neuf. ⚠️ **Où le lire** : `requireProfile()` rend le profil, pas le foyer. Le nom
        du foyer est déjà lu par cet écran — **branche-toi sur cette lecture** plutôt que d'en
        ajouter une seconde
  - [x] Le formulaire, sur le modèle **exact** de `DisplayNameForm.tsx` : écriture
        client-direct, `.update({ default_servings })` `.eq("id", foyerId)`
        `.select("default_servings").maybeSingle()`, **`data` autant qu'`error`**, puis
        `router.refresh()`
  - [x] ⚠️ **Sa PROPRE région de statut.** `/foyer` en porte déjà deux (`DisplayNameForm`,
        `InviteCard`) ; une troisième section d'écriture veut une troisième région. **C'est le
        défaut récidiviste du dépôt** — cinq occurrences, dont deux fois de suite sur le même
        écran
  - [x] ⚠️ **Aucun test d'isolation neuf n'est dû, et c'est mesuré :**
        `isolation.test.ts:214-223` (« A ne peut pas renommer le foyer de B ») éprouve déjà
        `households_update`, **et une politique RLS est par LIGNE, pas par colonne** — si A ne
        peut pas écrire la ligne de B, il ne peut pas écrire sa colonne non plus. **Ne le
        re-teste pas** ; écris cette phrase-là dans la story, elle vaut mieux qu'un test de
        plus. *(En revanche l'accord borne d'écran ↔ `households_default_servings_positif` se
        mesure : Task 9.)*
  - [x] ⚠️ **Le réglage est celui du FOYER, donc partagé** (AD-16 : foyer symétrique, aucun
        rôle). Le changer change ce que voit l'autre membre à sa prochaine assignation. **Dis-le
        à l'écran** — un réglage qu'on croit personnel et qui ne l'est pas est une surprise, pas
        une fonctionnalité
  - [x] `normaliserEntier` pour la saisie (`lib/recettes/saisie.ts:102`) et un refus nommé pour
        le `23514` — la contrainte a un nom, donc `refus…` discrimine par **nom de contrainte**,
        pas par le seul SQLSTATE

- [x] **Task 7 — Le texte de suppression d'une recette, devenu faux** (hors AC, dû dans le
      MÊME commit)
      <!-- ⚠️ Adressé nommément à cette story par `deferred-work.md` : « ce n'est pas une
           suggestion ». `meal_plan_entries.recipe_id` est `on delete cascade`
           (`initial_schema.sql:178`) : supprimer une recette efface ses repas planifiés. La
           confirmation dit aujourd'hui « Elle disparaît de ton répertoire. » — vrai jusqu'à
           la 3.5, faux dès que cette story permet d'assigner. -->

  - [x] `app/recettes/[id]/modifier/page.tsx` lit les cases de menu de la recette
        (`casesDeRecette`, Task 3) et les passe à `FormulaireRecette`
  - [x] `FormulaireRecette.tsx:493` — le `hint` de confirmation devient conditionnel :
        - 0 case → « Elle disparaît de ton répertoire. » *(inchangé)*
        - 1 case → « Elle disparaît de ton répertoire, et du repas où tu l'as prévue. »
        - N cases → « Elle disparaît de ton répertoire, et des N repas où tu l'as prévue. »
          — ⚠️ `tabular-nums` sur N (UX-DR12)
  - [x] ⚠️ **C'est le défaut le plus répété du dépôt** — texte d'annonce rendu faux par un
        commit, réparé après coup par les stories 1.6, 1.7, 2.1, 2.2 et 3.5. **Il se répare
        dans le commit qui le rend faux, jamais après**
  - [x] `app/recettes/page.tsx:23-26` — « l'assignation d'une recette à une case du menu
        (story 3.6) » n'est plus à venir
  - [x] `app/menu/page.tsx:27-34`, `:43-49`, `:55-67`, `:95-101` et `lib/menu/menu.ts:65-71`,
        `:102-125`, `:142-150` — **six commentaires qui annoncent cette story au futur** et
        décrivent un état de la base qu'elle change. ⚠️ **Règle §2, et le dépôt a déjà compté
        cinq commentaires devenus faux dont quatre écrits pendant une revue.** Relis-les un
        par un ; ce qui reste vrai reste, ce qui devient faux se réécrit

- [x] **Task 8 — Le parcours à l'écran, dans les deux thèmes** (AC1, AC2, AC3, AC4, **et
      l'AC2 de la 3.5**)
      <!-- ⛔ **CONDITION DE FUSION.** Trois familles de défaut ne sont attrapées que par un
           humain qui regarde (règle §7), et cette story les rencontre toutes les trois : le
           rendu (le débordement horizontal), le déploiement (la migration s'applique à la
           fusion), l'outillage. La 3.5 a été fusionnée sans ce parcours ; cette story ne
           peut pas l'être aussi, parce qu'elle porte MAINTENANT les deux. -->

  - [x] Stack local, `localhost:3333` — ⚠️ **jamais `127.0.0.1:3333`** : Next 16 bloque ses
        ressources de développement en cross-origin, l'hydratation échoue, les formulaires
        partent en GET natif, et **rien ne le dit dans le navigateur**, seulement dans la
        sortie du serveur
  - [x] ⚠️ **`.env.local` pointe sur la PRODUCTION.** Bascule vers le stack local et
        **restaure en comparant l'empreinte SHA-256**, en consignant les deux commandes et
        leurs sorties. Cet écran **écrit** : le relire sur une prévisualisation Vercel
        toucherait de vraies données du foyer (`docs/migrations.md § Relire une PR`)
  - [ ] ⚠️ **L'AC2 de cette story n'est PAS démontrable sur la prévisualisation** — sa
        migration n'y est pas appliquée. En local, et le dire dans la PR
        <!-- ⚠️ DÉCOCHÉE À MOITIÉ, ET C'EST LA MOITIÉ QUI RESTE. La démonstration EN LOCAL
             a bien eu lieu (tout le reste de cette Task). « Le dire dans la PR » ne peut pas
             l'être : aucune PR n'est ouverte à l'heure où ceci s'écrit. À reprendre au
             moment d'ouvrir la PR — c'est une condition de fusion, pas un oubli. -->
  - [x] ⚠️ **LA LARGEUR, MESURÉE ET PAS REGARDÉE — c'est l'AC2 de la 3.5, et c'est un
        nombre :** `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
        à **390 px**, **320 px** et **200 % de zoom**. ⚠️ **Le pire cas est le nouveau** : une
        case portant DEUX recettes dont l'une a un titre de 80 caractères, **avec l'affordance
        d'assignation**, au grand écran — c'est lui qui dit si `subgrid` tient et si la case
        ne pousse pas sa colonne
        <!-- ⚠️ COCHÉE, MAIS LA MÉTHODE N'EST PAS CELLE QUI ÉTAIT PRESCRITE, ET L'ÉCART EST
             ICI plutôt que tu. Chrome refuse de descendre sa fenêtre sous ~528 px de large
             (mesuré) : les trois largeurs demandées ne sont donc PAS atteignables en viewport
             réel par ce chemin, et un iframe dimensionné a été refusé par la politique
             d'origine du contexte d'extension.
             CE QUI A ÉTÉ MESURÉ, sur le pire cas (case à 2 recettes dont un titre de 79 car.) :
               · viewport RÉEL 1440 px  → scrollWidth 1415 = clientWidth 1415, aucun débordement ;
               · viewport RÉEL 528 px   → scrollWidth 513  = clientWidth 513,  aucun débordement
                 (déjà sous le seuil `lg`, donc en mode empilé — celui de 390 et 320) ;
               · largeur du conteneur FORCÉE à 390, 320 et 195 px → scrollWidth égal à la
                 largeur imposée dans les trois cas, aucun débordement. 195 px est
                 l'équivalent d'un zoom 200 % sur un écran de 390.
             Le mode de mise en page (empilé) est donc éprouvé en viewport réel, et le repli du
             CONTENU l'est par contrainte de conteneur. Ce qui n'est PAS éprouvé : un viewport
             réel de 390/320 px, où seule une media query supplémentaire pourrait différer —
             il n'y en a aucune sous `lg` dans cet écran (vérifié dans `page.tsx`). -->
        <!-- ⚠️ ET LE ZOOM À 200 % N'A PAS ÉTÉ JOUÉ COMME UN ZOOM : les raccourcis de zoom
             de page sont refusés par l'outil de pilotage. 195 px de conteneur en est
             l'équivalent en largeur, pas en taille de police. -->
  - [x] Le `<select>` mesuré à part : sa largeur ne dépasse jamais son conteneur (`w-full
        min-w-0`), ce qui est le point du piège n°1 — et c'est aussi pourquoi il ne vit pas
        dans une piste de la grille
  - [x] Le `<select>` de recettes avec un titre de **80 caractères** dans la liste — piège n°1
  - [x] **AC2 joué à la main** : assigner deux fois la même recette au même repas du même jour.
        La seconde est refusée, **et le refus se lit en français**, à l'endroit où on l'attend
  - [x] **AC3 joué à la main** : changer le nombre de personnes, puis retirer. Recharger : la
        case reflète l'état
  - [x] Une case à **plusieurs recettes différentes** — que la contrainte autorise (piège n°7)
  - [x] La **cascade** : supprimer une recette qui est au menu. La case disparaît, **sans
        erreur**, et la confirmation avait annoncé ce qui allait se passer (Task 7)
  - [x] **Le réglage du foyer** (Task 6) : le changer, puis ouvrir une assignation neuve — le
        champ s'ouvre sur la nouvelle valeur. Et **une case déjà posée n'a pas bougé**
  - [x] Les **quatre repas** et la navigation entre semaines, toujours vivants après les
        changements de la Task 4
  - [x] Les deux thèmes **au réglage système**, remis après — une émulation d'outils de
        développement ne prouve rien (`globals.css:68` lit `prefers-color-scheme`) :
        `osascript -e 'tell application "System Events" to tell appearance preferences to set
        dark mode to true'` puis `false`
  - [x] Le squelette **au réseau bridé** — celui de la grille, et celui de la nouvelle route
        celui de `/menu/[jour]/[repas]`, qui est le sien et pas celui de la grille (piège n°8)
  - [x] Anneau de focus **mesuré dans le DOM** (`document.activeElement`), pas à l'œil, après
        chaque geste de la Task 5
  - [x] ⚠️ **L'automatisation de navigateur n'alimente pas l'état React par la frappe** quand
        la fenêtre n'est pas au premier plan — artefact mesuré à la 3.2. **Cette story a des
        CHAMPS**, contrairement à la 3.5 : ça la concerne. Fenêtre au premier plan, ou saisie
        à la main
  - [x] Les six portes : `npm run typecheck`, `npm run lint`, `npm test`,
        `npm run test:isolation`, `npm run build`, `npm run check:migrations`

- [x] **Task 9 — L'isolation et les contraintes, mesurées** (AD-17, NFR-5, AC2, décisions 3 et 4)

  - [x] `supabase/tests/isolation.test.ts` — **A ne peut ni poser, ni modifier, ni supprimer
        une case de menu chez B.** Les trois verbes, sur le modèle de « A ne peut ni poser, ni
        modifier, ni supprimer un ingrédient chez B » (`:821`). ⚠️ La lecture est déjà
        couverte (`:1056`) ; **l'écriture ne l'est pas**, et c'est cette story qui l'ouvre
  - [x] **A ne peut pas pointer la recette de B** — le trou refermé. C'est la Task 2, du côté
        de l'assertion positive
  - [x] **Le doublon est refusé** (`23505`), et le **non**-doublon accepté : la même recette à
        deux repas différents, et deux recettes différentes au même repas. ⚠️ **Sans ces deux
        cas, une contrainte trop large passerait le test** en interdisant ce qu'AD-6 autorise
  - [x] ⚠️ **Aucun test neuf sur `households`, et c'est mesuré, pas supposé.**
        `isolation.test.ts:214-223` éprouve déjà `households_update` avec deux comptes réels, et
        **une politique RLS est par ligne, pas par colonne**. En ajouter un serait de la
        redondance — le dépôt reproche déjà « ne la re-teste pas » à propos de la cascade
        recette → menu
  - [x] `supabase/tests/contraintes.test.ts` — **les DEUX contraintes neuves** (décisions 3
        et 4) : `meal_plan_entries_servings_positif` et `households_default_servings_positif`.
        L'accord entre la borne d'écran et la contrainte se **mesure**, il ne s'affirme pas
        (règle §4, et le fichier existe pour ça). ⚠️ **Le sens du désaccord n'est pas
        symétrique** — « le client refuse, la base accepterait » est bénin ; « le client
        accepte, la base refuse » est le cas qui blesse, et c'est celui-là que le fichier
        interdit (son en-tête le dit)
  - [x] ⚠️ **Vérifie les dents par mutation, et méfie-toi du no-op.** La 3.5 l'a payé :
        supprimer `meal_plan_all` rend la table **plus** restrictive (RLS active sans politique
        = tout refusé), donc « A ne lit pas les cases de B » reste vert **gratuitement**. La
        mutation qui mord est la politique **remplacée par `using (true) with check (true)`**.
        Pour une contrainte, la mutation est de la **retirer**
  - [x] ⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers
        avant de lancer. **Tout contrôle neuf doit répondre à : que se passe-t-il s'il ne
        trouve rien à contrôler ?**

- [x] **Task 10 — `deferred-work.md`** (hors AC, dû dans le MÊME commit)

  - [x] **Refermer les deux entrées adressées à cette story**, en les citant : le demi-AC4 de
        la 3.5 et le trou d'intégrité. ⚠️ **Refermer, pas effacer** — c'est la règle §6 bis :
        une prémisse se ferme en DATANT ce qu'elle laisse, jamais en la retirant
  - [x] Consigner ce que cette story laisse ouvert, avec sa raison et sa date. **Une entrée
        vide honnête vaut mieux qu'une entrée absente**
  - [x] ⚠️ L'entrée « `servings` est lu et n'est pas affiché » se referme par l'AC4. L'entrée
        « la colonne `notes` n'est lue par personne » **reste ouverte** — aucune story ne la
        réclame, et cette story ne la réveille pas

---

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où | Ce que ça implique |
|---|---|---|
| La grille, la semaine, la navigation | `app/menu/page.tsx` (story 3.5) | **Rien à refaire.** Un seul DOM, `subgrid`, la semaine dans l'URL, aucun `"use client"` |
| Tout le calendaire, pur et testé | `lib/menu/semaine.ts` (20 tests) | `estJourISO`, `lundiDeLaSemaine`, `joursDeLaSemaine`, `semaineVoisine`, `aujourdhuiAParis`, les trois formateurs. **N'écris pas une seconde façon de manipuler une date** |
| La lecture des cases, avec sa jointure | `lib/menu/menu.ts` — `casesDeLaSemaine` | Rend déjà `personnes` (`servings`), que l'écran ignorait. **L'AC4 n'a qu'à l'afficher** |
| Les quatre repas et leur ordre | `lib/menu/menu.ts` — `REPAS` | **Le seul endroit qui les nomme.** Décision de Florian du 2026-08-04, la grille en hérite |
| Le regroupement par case, en LISTES | `grouperParCase`, `cleDeCase` | Déjà écrit pour la pluralité (piège n°7) |
| Le squelette de la grille | `app/menu/loading.tsx` | Le motif est écrit **trois fois** dans le dépôt. Rien à inventer |
| Le répertoire de recettes | `lib/recettes/recettes.ts` — `recettesDuFoyer` | Trié par titre, tri secondaire par date. C'est la source du sélecteur |
| Écriture client-direct + `router.refresh()` | `app/foyer/DisplayNameForm.tsx`, `ListeRecettes.tsx` | Et **lire `data` autant qu'`error`** (`DisplayNameForm.tsx:70-78`) |
| Ajout / édition / retrait ligne à ligne | `IngredientsRecette.tsx` | **Le modèle le plus proche de cette story.** Quatre zones de statut, `retourFocus`, confirmation en deux temps, champs désactivés |
| Confirmation en deux temps | `InviteCard.tsx`, `FormulaireRecette.tsx:449-495` | Jamais `window.confirm` |
| Traduction d'un refus de la base | `lib/recettes/erreurs.ts` | **SQLSTATE d'abord, nom de contrainte ensuite** — et son en-tête dit *pourquoi* les deux, et quand |
| État de soumission, avec son `finally` | `app/_lib/useSoumission.ts` | ⚠️ `occupe` est un drapeau de rendu, **pas un verrou** (`deferred-work.md`) |
| Zone de message accessible | `app/_lib/Notice.tsx` | ⚠️ `reserve` quand la zone est **au-dessus** du formulaire |
| Résolution de clé de message | `lib/messages.ts` — `messageDe` | ⚠️ `table[cle]` nu n'est pas sûr : les clés viennent d'une réponse serveur |
| Normalisation d'un entier saisi | `lib/recettes/saisie.ts` — `normaliserEntier` | ⚠️ `Number("")` vaut **0**, `parseInt("")` rend `NaN` et `JSON.stringify` en fait `null` **en silence** |
| Garde de forme sur un identifiant | `lib/recettes/saisie.ts` — `estUuid` | Le modèle, et le `22P02` qu'il évite |
| Garde de session + profil | `app/_lib/garde.ts` — `requireProfile()` | Rend `{ id, household_id, display_name }` — **les deux valeurs de l'`insert`**. Le proxy protège déjà toute route hors `PUBLIC_ROUTES` |
| Le témoin négatif et les dents | `supabase/tests/isolation.test.ts:1-37` | La posture du fichier, et comment on vérifie qu'un test mord |
| L'accord client ↔ contrainte, mesuré | `supabase/tests/contraintes.test.ts` | Le meilleur exemple de règle §4 du dépôt |
| La discipline de migration | `docs/migrations.md` | Additivité, requête de contrôle, `--local`, `db reset`, le lot non atomique |

⚠️ **Cet écran ÉCRIT, et c'est le seul de l'Epic 3 à écrire dans cette table.** Tout ce que la
3.5 s'interdisait — `createNavigateurClient`, `useSoumission`, `Notice`, une région de statut —
est ici **attendu**. Le commentaire de `app/menu/page.tsx:95-101` (« s'il en apparaît un, c'est
qu'on a glissé dans la story 3.6 ») parle de toi : réécris-le, ne le contourne pas.

---

### Piège n°1 — Le `<select>` est ce qui peut faire déborder la grille, et l'AC2 de la 3.5 n'a JAMAIS été observé

C'est le piège le plus coûteux de cette story, parce qu'il se trompe de deux façons à la fois.

**Le fait technique :** un `<select>` prend l'intrinsèque de sa **plus longue option**. Un
titre de recette va jusqu'à **80 caractères** (`MAX_TITRE`, `lib/recettes/saisie.ts:32`). Dans
une piste de grille à sept colonnes, ça fait un élément dont la largeur minimale dépasse la
piste — et une piste `minmax(0, 1fr)` **ne protège que le contenu qui peut se réduire**. Le
`<select>` ne se réduit pas tout seul : il lui faut `w-full` **et** `min-w-0`.

**Le fait de méthode :** l'AC2 de la 3.5 — « aucun défilement horizontal, à aucune largeur » —
est **en production sans avoir jamais été regardé** (§ Ce que cette story REFERME, point 3). Ce
qui est établi l'est par mesure statique : toutes les classes émettent bien leur CSS, les
colonnes sont en `minmax(0,1fr)`, les titres portent `break-words`. **C'est un raisonnement
solide, pas une observation** — et cette story ajoute précisément l'élément que ce raisonnement
n'a pas couvert.

**Conséquence directe sur la décision 2 :** poser le formulaire d'assignation **hors** des
pistes de la grille supprime le risque à la source, au lieu de le contenir par des classes.
C'est la raison principale de la recommandation.

⚠️ **`overflow-x: auto` n'est PAS une réponse.** L'AC dit « n'impose aucun défilement
horizontal forcé » : un conteneur qui défile *est* ce défilement, rangé dans une boîte. La
réponse est que le contenu se **replie**.

### Piège n°2 — Un test d'isolation assure aujourd'hui que le trou EXISTE

`supabase/tests/isolation.test.ts:1074` — « LE TROU POSSIBLE : A pointe une case de SON menu
sur une recette de B ». Il assure `assert.equal(poseInterdite, null, "état mesuré au
2026-08-04 : rien n'interdit de pointer la recette d'un autre foyer")`.

**Ta migration le fait tomber.** Ce n'est pas une régression : c'est le contrat que ce test
s'est donné. Son commentaire le dit — *« le jour où une migration ferme ce trou, ce soit ICI que
ça se voie, et pas dans une branche `if` qui l'aurait absorbé en silence »*.

⚠️ **Ne « répare » pas ce test en enveloppant l'assertion dans une condition** ni en la
supprimant. Inverse-la, et fais-lui nommer la contrainte. C'est la Task 2.

⚠️ **Et garde son second volet vivant** : le fait que la RLS filtre la ressource **embarquée**
de PostgREST — mesuré le 2026-08-04, première fois que ce dépôt éprouve cette forme de lecture
— n'a **aucun autre témoin** dans la suite. La pose applicative n'étant plus possible, le seul
chemin restant est le client de service (le témoin négatif du fichier), qui traverse la RLS par
conception.

### Piège n°3 — La clé étrangère composite : ÉCARTÉE le 2026-08-04, et voici pourquoi

⚠️ **Ce piège ne mord plus — la décision 1 a retenu la politique resserrée.** Il est **daté et
gardé, pas effacé** (règle §6 bis) : c'est la forme qu'une revue proposera spontanément comme
« plus propre », et les deux raisons de l'avoir écartée ne sont pas devinables.

**(a) La cascade.** `meal_plan_entries_recipe_id_fkey` est `on delete cascade`
(`initial_schema.sql:178`). Une seconde clé étrangère `(recipe_id, household_id) → recipes(id,
household_id)` laissée en `no action` **bloquerait la suppression d'une recette au menu** — ou
la ferait dépendre de l'ordre dans lequel Postgres déclenche ses contraintes, ce qui est pire.
La seconde devrait porter `on delete cascade` elle aussi — et il faudrait le **mesurer**, pas
le déduire.

**(b) L'embarquement PostgREST devient AMBIGU.** Avec deux clés étrangères entre
`meal_plan_entries` et `recipes`, PostgREST ne sait plus laquelle emprunter pour
`recipes(id, title)` et rend **`PGRST201`** — la lecture de `casesDeLaSemaine` **casse**,
c'est-à-dire toute la grille. La parade est de nommer la relation :
`recipes!meal_plan_entries_recipe_id_fkey(id, title)`.

⚠️ **DÉDUIT du comportement documenté de PostgREST, NON MESURÉ sur ce stack.** C'est
suffisant pour écarter la forme, pas pour affirmer qu'elle casse : **si quelqu'un veut la
rouvrir, la sonde vient d'abord** — appliquer la migration en local, relancer
`npm run test:isolation`, et regarder si « A lit SA semaine de menu de bout en bout »
(`:1133`) tombe. C'est le test qui l'attraperait.

⚠️ Elle exigerait aussi `unique (id, household_id)` sur `recipes` — index redondant avec la
clé primaire — et ferait apparaître une relation de plus dans `Relationships`.

**Ce que la politique resserrée ne fait PAS, et qu'il faut savoir :** elle ne lie ni le rôle de
service, ni une fonction `security definer`. C'est une frontière de RLS, pas une contrainte.
AD-2 interdisant `SUPABASE_SERVICE_KEY` côté application, le seul porteur est le harnais
d'isolation — **délibérément, comme témoin négatif**. ⚠️ **Si l'Epic 7 ouvrait une surface qui
traverse la RLS, cette prémisse se rouvrirait** (règle §5). Elle est datée ici pour ça.

### Piège n°4 — La contrainte d'unicité n'interdit PAS ce qu'AD-6 autorise

`unique (household_id, meal_date, meal_type, recipe_id)` interdit **la même recette deux fois
dans la même case**. Elle n'interdit ni :

- **deux recettes différentes dans la même case** — « Soir : gratin + salade » ;
- **la même recette dans deux cases différentes** — un plat cuisiné le dimanche et remangé le
  mardi, qui est le cas d'usage central du batch-cooking.

Une contrainte plus large — sur `(household_id, meal_date, meal_type)` seul — casserait les
deux, et **le test d'unicité passerait quand même**. C'est pourquoi la Task 9 exige les deux cas
**négatifs** en plus du positif.

### Piège n°5 — `servings` n'est pas un champ comme un autre : il est CONSOMMÉ par un calcul

`generate_grocery_list_from_menu` (`initial_schema.sql:544-547`) calcule :

```sql
sum(coalesce(ri.quantity, 0) * (mpe.servings::numeric / nullif(r.servings, 0)))
```

`mpe.servings` est au **numérateur**. La migration `20260801124553` a posé
`recipes_servings_positif` sur le **dénominateur** en écrivant le raisonnement complet :

> « Le `nullif` évite la division par zéro — il ne lève pas, il rend **NULL**. […] Un
> `servings` négatif est pire : il rend des quantités **négatives**, qui s'additionneront à
> celles des autres recettes par l'UPSERT-incrémente d'AD-6. »

**Le même raisonnement s'applique mot pour mot au numérateur, et cette story est la première à
l'écrire.** `meal_plan_entries.servings` est un `int not null default 2` **sans aucune
contrainte** : 0 verse des quantités nulles, un négatif verse des quantités négatives, et rien
ne le signale avant l'Epic 4. D'où la décision 3.

⚠️ **`min={1}` sur un `<input type="number">` n'est pas une frontière** — il se contourne dans
les outils de développement, et il n'existe pas du tout pour un appel REST direct. AD-1/AD-2 :
la règle métier vit en Postgres, jamais dans la vigilance d'une surface.

⚠️ **Et `normaliserEntier` existe déjà** (`lib/recettes/saisie.ts:102`) avec ses trois pièges
écrits : `Number("")` vaut 0, `parseInt("")` rend `NaN` que `JSON.stringify` transforme en
`null` **en silence** sur une colonne `not null`, et `type="number"` accepte « 2e3 ».

### Piège n°6 — « Empêché par la contrainte » ne veut pas dire « empêché sans un mot »

L'AC2 exige que le doublon soit refusé **par la base**. Il n'autorise pas l'écran à laisser
l'utilisateur devant un geste qui ne fait rien.

Un `23505` non traduit tombe sur `"echec"`, c'est-à-dire **« Ça n'a pas marché. Réessaie dans
un instant. »** — un conseil qui **ne peut jamais fonctionner**, puisque retenter à l'identique
reproduira le même refus. C'est la famille que `project-context.md` interdit nommément, et
c'est le défaut réel qu'a corrigé la revue du 2026-08-03 sur le chemin d'ajout d'ingrédient.

**Écris le message** : « Cette recette est déjà à ce repas. » — il dit ce qui s'est passé, et
il ne conseille rien d'impossible.

⚠️ Même exigence pour `23503` / `42501` : la recette a disparu sous les pieds (supprimée par
l'autre membre), et le **rafraîchissement fait partie du traitement du refus**, il n'est pas
décoratif (`IngredientsRecette.tsx:300-309`).

### Piège n°7 — La case porte une LISTE, et la contrainte ne change pas ça

`grouperParCase` rend `Map<clé, CaseDeMenu[]>` et `app/menu/page.tsx:70-86` en itère la liste.
**C'est délibéré, c'est documenté trois fois, et la contrainte d'AD-6 ne l'invalide pas**
(piège n°4).

Réduire la case à « au plus une recette » — un `Map<clé, CaseDeMenu>`, un `[0]`, un
`.find()` — perdrait des lignes **en silence** : la case en montrerait une, la base en aurait
trois, et la génération de l'Epic 4 compterait les trois.

⚠️ **Corollaire pour la Task 4 :** la case n'a **pas de hauteur connue**. C'est ce qui rend
`subgrid` utile plutôt que décoratif (`app/menu/page.tsx:116-120`), et c'est ce que le pire cas
de la Task 8 éprouve.

### Piège n°8 — `app/menu/loading.tsx` enveloppe DÉJÀ ses enfants

⚠️ **Actif : la décision 2 crée `/menu/[jour]/[repas]`.**

Un `loading.tsx` de segment **enveloppe tous ses enfants**. `app/menu/` n'a pas de
`layout.tsx` : une route `app/menu/[jour]/[repas]/` héritera donc du squelette de **la
grille** — sept colonnes de cases — pendant le chargement d'un écran qui est un formulaire.

⚠️ **C'est EXACTEMENT le défaut de la story 3.3**, et il avait été affirmé faux en trois
endroits avant d'être mesuré :

> « `app/recettes/loading.tsx` COUVRE bien `/recettes/[id]` — aucun `layout.tsx` sous
> `app/recettes/`, donc le `loading.tsx` du segment enveloppe tous ses enfants, et le build le
> confirme. La décision 4 (« aucun loading.tsx, absence décidée ») reposait donc sur une
> prémisse fausse. » — suivi de sprint, 2026-08-02

Le motif est écrit **trois fois** dans le dépôt. Pose le `loading.tsx` de la route, ou **écris
pourquoi tu ne le poses pas**.

### Piège n°9 — Trois textes deviennent faux avec ce commit, et six commentaires parlent au futur

**Le premier n'est pas cosmétique : il fait perdre des données sans le dire.**
`FormulaireRecette.tsx:492-494` promet « Elle disparaît de ton répertoire. » alors que
`recipe_id` est `on delete cascade` : dès cette story, supprimer une recette efface aussi les
repas planifiés. C'est la Task 7, et `deferred-work.md` le range explicitement en « ce n'est
pas une suggestion ».

Les deux autres : `app/recettes/page.tsx:23-25` (« l'assignation d'une recette à une case du
menu (story 3.6) ») et les commentaires de `app/menu/page.tsx` / `lib/menu/menu.ts` qui
annoncent la contrainte d'AD-6 comme n'existant pas encore.

⚠️ **Un quatrième est faux et n'est PAS de ton ressort** : `app/page.tsx:24` rend
`{nom ?? "Chez toi"}`, un repli à la deuxième personne au-dessus d'un « Mon foyer ». Reporté
par la revue du 2026-08-02. **Ne le corrige pas en passant** — c'est une décision de microcopy
sur trois écrans, et déborder rendrait ta propre revue plus difficile.

### Piège n°10 — Les paramètres d'URL sont des saisies, y compris le repas

⚠️ **Actif : la décision 2 crée une route paramétrée.**

`?semaine=` l'était déjà (piège n°7 de la 3.5) ; `jour` et `repas` le sont autant. Un jour
illisible, un repas inventé, un paramètre répété : **aucun ne plante, aucun n'affiche `Invalid
Date`**. Le repli est le même qu'à la 3.5 pour la semaine, et un `notFound()` pour un repas qui
n'existe pas — un chemin fautif n'est pas une panne, et « Réessaie » n'y peut rien.

⚠️ **`estJourISO` valide par ALLER-RETOUR, pas par `isNaN`** — `Date.UTC(2026, 12, 45)` ne lève
pas, il **déborde** au 14 février 2027 (mesuré). La fonction existe ; ne la réécris pas.

⚠️ **`estCodeRepas` se dérive de `REPAS`**, jamais d'une seconde liste. Règle §3 : quand la
base pose une énumération, une énumération parallèle finit par diverger.

⚠️ **`params` et `searchParams` sont des `Promise`** (`strictRouteTypes`, `next.config.ts:5-13`).
Les typer en objet **compile** et rend `undefined` à l'exécution : le fichier documente
précisément ce bug silencieux.

### Piège n°11 — Le fuseau, et il n'a pas changé de nature

`meal_date` est un `date` Postgres : **pas d'heure, pas de fuseau**. La règle de la 3.5 n'a
aucune exception ici : **une date est une chaîne `"AAAA-MM-JJ"`**. Pour calculer, `Date.UTC` et
les accesseurs `getUTC*` ; pour formater, `Intl.DateTimeFormat` avec `timeZone: "UTC"`. Tout est
écrit et testé dans `lib/menu/semaine.ts` — **le seul geste attendu de toi est de t'en servir.**

Mesuré le 2026-08-04, machine en `Europe/Paris` :

```
new Date(2026, 7, 4).toISOString()   →  "2026-08-03T22:00:00.000Z"   ← LE 3, pas le 4
```

⚠️ Le geste naturel — « je construis la date du 4 août » — produit le 3, et l'écran affiche
simplement le repas du mardi sur la case du lundi. **En hiver le décalage change de taille, pas
de nature.**

### Piège n°12 — La maquette porte quatre choses qui ne sont pas de cette story

`mockups/grille-menu.html` illustre l'écran **fini**. Le spine le dit lui-même : *« En cas de
conflit entre une maquette et ce document, ce document fait foi — les maquettes illustrent,
elles ne décident pas »* (`DESIGN.md:275`).

| Dans la maquette | Où ça vit vraiment |
|---|---|
| « Pour **2** personnes » **global**, dans la barre d'application (`:69`) | **Nulle part.** `servings` est une colonne **de la ligne d'assignation**, l'AC1 dit « l'assignation est persistée […] avec le nombre de personnes », et l'AC4 dit « **chaque case** montre […] son nombre de personnes ». Un réglage global serait un second modèle de données, sans colonne pour le porter |
| Les étiquettes dans les cases (`rapide`, `végé`, `batch`) | **Story 3.4**, sautée. Aucune colonne, aucune table, rien |
| « 🛒 Générer la liste — 23 ingrédients » (`:111-116`) | **Epic 4**, FR-16/FR-17. `generate_grocery_list_from_menu` est en base et **n'est appelée par rien** — ne l'appelle pas |
| La barre de navigation Liste / Menu / Recettes / Rayons (`:67`) | **Aucune story.** Le produit n'en a pas, et en poser une est une décision de composition qui n'a pas été prise |

⚠️ **L'abricot de la maquette est banni ici** (UX-DR2 le réserve à l'action courses ; l'anneau
de focus est sa seule exception, déjà globale dans `globals.css:236-239`). Et `--accent-strong`
**ne bascule pas entre les thèmes** — `text-accent` rendait **1,90:1** sur une carte blanche.

### Piège n°13 — Le sélecteur de recettes n'a ni filtre ni recherche, et c'est une frontière

Le répertoire se lit par `recettesDuFoyer`, trié par titre. **La 3.4 — étiquettes, filtre,
recherche — est sautée et reste due** ; c'est elle qui rendra ce choix confortable quand le
répertoire grossira.

⚠️ **N'invente ni filtre, ni recherche, ni `<datalist>`, ni étiquette.** L'AC1 demande
d'assigner une recette, pas de la trouver vite. Écrire une recherche ici, c'est écrire la 3.4
au mauvais endroit — et la 3.4 devra ensuite la déplacer.

⚠️ En revanche, **dis-le honnêtement dans `deferred-work.md`** : le confort de sélection dépend
de la 3.4, et c'est une conséquence connue de l'ordre dans lequel les stories ont été jouées.

### Piège n°14 — Trois nombres de personnes arrivent à l'écran, et deux d'entre eux portent le même nom en base

*Créé par la décision 4. C'est le piège de microcopy le plus coûteux de cette story, parce
qu'il se lit bien et se comprend mal.*

| En base | Ce que c'est | Le mot à l'écran |
|---|---|---|
| `recipes.servings` | Pour combien de personnes la **recette est écrite** — le dénominateur de la mise à l'échelle | « pers. » sur la ligne de répertoire (`ListeRecettes.tsx:135-137`) |
| `meal_plan_entries.servings` | Combien de personnes **on prévoit** pour ce repas-là — le numérateur | « personnes » dans la case et dans le formulaire d'assignation |
| `households.default_servings` | Combien on est **d'habitude** — la valeur proposée, jamais celle qui compte | « On est » sur `/foyer` |

⚠️ **Les deux premières s'appellent `servings` dans le schéma, et leur RAPPORT est tout le
calcul de l'Epic 4.** Employer le même mot pour les deux à l'écran rend le produit
incompréhensible au premier ajustement : « pourquoi la recette dit 4 et le menu dit 2 » n'a de
réponse que si les deux ne s'appellent pas pareil.

⚠️ **Et `households.default_servings` n'est PAS une quatrième vérité** : rien ne le lit après
l'ouverture du formulaire. Une case posée garde son nombre — écrire quelque part « le foyer
est de N personnes » à côté d'une case qui en dit 4 serait faux.

⚠️ **Jamais « portions » pour ce que le membre prévoit.** C'est le mot de la recette, et c'est
précisément la confusion que ce tableau existe pour empêcher.

---

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Générer la liste de courses depuis le menu | **Epic 4** (FR-16/FR-17). La fonction existe en base, elle n'est appelée par rien |
| Étiquettes, filtre, recherche du répertoire | **Story 3.4**, sautée et toujours due |
| La colonne `notes` de `meal_plan_entries` | **Aucune story.** Elle existe, rien ne la lit, rien ne l'écrit |
| Realtime, propagation entre appareils | **Epic 4** (AD-8). L'autre membre du foyer ne voit pas ton assignation sans rafraîchir |
| L'édition concurrente arbitrée | **Story 4.10** — décision de Florian : le dernier écrit gagne, en silence |
| Le menu du jour sur le dashboard | **Epic 5** (FR-44). `casesDeLaSemaine` est écrite pour y resservir |
| Une barre de navigation globale | **Aucune story** (piège n°12) |
| Le repli « Chez toi » de l'accueil | **Reporté**, revue du 2026-08-02. Ne le corrige pas en passant |
| Le champ « Combien » d'`IngredientsRecette` sans `disabled` | **Autre écran, autre story.** Consigne-le, ne le corrige pas ici |
| Des bornes de longueur sur les champs libres | **Reporté** — cinq tables ont le même trou, il se traitera d'un coup |
| Rendre le **nom du foyer** éditable | **Aucune story.** `households_update` le permettrait, `/foyer:65` l'affiche en `hint` sans champ. Ne l'ajoute pas au passage parce que tu ouvres le fichier |
| Un nombre de personnes **par membre** | **Rien, et jamais** — AD-16 : le foyer est symétrique, `profiles` n'a aucune colonne de rôle. Un réglage par membre serait un second modèle d'appartenance |
| Un nombre de personnes **par recette** (« ce plat, j'en fais toujours pour 6 ») | **Écarté le 2026-08-04**, décision 4. Ce serait une colonne de plus sur `recipes`, voisine de `servings` et de sens inverse — voir piège n°14 |

---

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement pour ce que l'application **dit**, première personne pour ce qui **nomme**
(`project-context.md`). **Mots bannis :** synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| L'action sur une case vide | « Mettre une recette » · « Choisir une recette » | « Assigner » (mot d'administration, pas de cuisine) · « + » seul |
| Le titre de l'écran d'assignation, s'il y en a un | « Mardi midi » — le jour et le repas, tels qu'on les dit | « Case 2026-08-04 / lunch » |
| Le champ du nombre de personnes | « Pour combien de personnes » | « Portions » (c'est le mot de la RECETTE, et les confondre est le piège) · « Servings » |
| L'affichage dans la case | « 4 pers. » avec `tabular-nums` | « 4 » nu · « servings: 4 » |
| Le doublon refusé (AC2) | « Cette recette est déjà à ce repas. » | « Ça n'a pas marché. Réessaie… » · « Contrainte violée » |
| La recette a disparu sous les pieds | « Cette recette n'existe plus. » | **jamais** « Réessaie » — la condition n'est pas transitoire |
| Retrait réussi | « C'est retiré. » | « Supprimé avec succès » |
| Assignation / changement réussis | « C'est noté. » | « Enregistré » · « OK » |
| Confirmation avant retrait | « Ce repas disparaît du menu. » | une boîte `window.confirm` |
| Répertoire vide au moment d'assigner | « Tu n'as encore aucune recette. » + le chemin vers `/recettes` | une case qui invite à un écran sans choix |
| Suppression d'une recette au menu | « Elle disparaît de ton répertoire, et des N repas où tu l'as prévue. » | « Elle disparaît de ton répertoire. » — **c'est le texte devenu faux** |
| Le titre de la section sur `/foyer` | **« On est »** — première personne du foyer, comme « Mon prénom » et « Qui est là » qui l'encadrent | « Paramètres » · « Préférences » · « Configuration du foyer » |
| Ce que la section explique | « C'est ce qu'on te proposera quand tu mettras une recette au menu. Tu peux toujours changer, repas par repas. » | « Valeur par défaut » · « Défaut : 2 » |
| Que le réglage est partagé | « Ça vaut pour tout le foyer. » | le taire — un réglage qu'on croit personnel et qui ne l'est pas est une surprise |

⚠️ **« Portions » et « personnes » ne sont pas synonymes ici, et depuis la décision 4 il y en a
TROIS à distinguer** — voir le tableau du piège n°14, qui est la version opposable de ce
paragraphe.

⚠️ **`tabular-nums` sur tout chiffre** (UX-DR12) : les nombres de personnes d'une case à
l'autre, sinon la grille tremble. `.notice` ne le porte pas — voir
`IngredientsRecette.tsx:493-511`.

**Pas d'abricot** hors de l'anneau de focus.

---

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — la règle métier vit en **Postgres**, jamais dans la vigilance d'une
  surface. C'est tout le § Ce que cette story REFERME, point 2 : la garde d'affichage de
  `casesDeLaSemaine` ne referme rien. Jamais de `SUPABASE_SERVICE_KEY` côté application (le seul
  appelant légitime est le harnais d'isolation, comme témoin négatif)
- **AD-6** — la contrainte d'unicité est **citée mot pour mot** par le spine :
  « `meal_plan_entries` porte `unique(household_id, meal_date, meal_type, recipe_id)` (empêche
  le doublon d'assignation) ». C'est l'AC2
- **AD-13** — écritures **client-direct**. Une Server Action **si et seulement si** un secret
  serveur est requis, ou si la conséquence doit apparaître dans un rendu serveur
  (`revalidatePath`). Ni l'un ni l'autre ici : **le critère est la cause, pas l'analogie de
  vocabulaire**
- **AD-16** — menu partagé entre tous les membres ; foyer **symétrique**, aucun rôle.
  ⚠️ **La RLS est par FOYER, pas par membre** — n'invente aucun contrôle applicatif pour
  distinguer les membres ; il serait contournable à un appel RPC près
- **AD-17** — l'isolation se prouve par un test **exécuté**. Cette story ouvre la première
  **écriture** applicative de la table : c'est la Task 9, et elle est due
- **NFR-3 / UX-DR10** — pas de défilement horizontal. Piège n°1, et il porte deux stories
- **NFR-5** — l'isolation entre foyers est la seule chose que ce produit ne peut pas se
  permettre de casser
- **NFR-8 / NFR-9** — français, aucun jargon, aucun message technique brut. `error.tsx` est le
  dernier filet, pas le premier
- **NFR-10** — **aucune dépendance nouvelle.** Ni sélecteur de date, ni bibliothèque de
  formulaire, ni harnais de test de composants, ni `date-fns` / `dayjs` / `luxon`.
  `lib/menu/semaine.ts` fait déjà tout le calendaire
- **UX-DR11** — cibles ≥ 44px (`min-h-touch`), contraste AA **sur les fonds réels**, anneau de
  focus, 200 % de zoom sans défilement horizontal
- **AR-MIGRATIONS** — additive, horodatée après toutes les existantes, jamais retouchée après
  application, requête de contrôle en en-tête. ⚠️ **Resserrer une contrainte demande de vérifier
  d'abord que les données existantes la respectent** (`docs/migrations.md`) — c'est exactement
  ce que fait la requête de la Task 1

---

### Standards de test

**Comptes MESURÉS le 2026-08-04 sur `a56ba0b`** (`origin/main`, story 3.5 fusionnée) :

| Suite | Commande | État mesuré |
|---|---|---|
| Unitaires | `npm test` (glob `lib/**/*.test.ts`) | **179 / 179**, `duration_ms 168` — exécuté |
| Isolation & contraintes | `npm run test:isolation` (glob `supabase/tests/**/*.test.ts`) | **60 fichiers-tests comptés** — 42 dans `isolation.test.ts`, 18 dans `contraintes.test.ts`. ⚠️ **Compté, pas exécuté** : la suite exige le stack local |

**Où va quoi :**

1. **`npm test`** — tout le pur : `estCodeRepas`, `refusAssignation`, la résolution de slug,
   la normalisation du nombre de personnes. **C'est le seul filet du code applicatif** ; le JSX
   reste intestable sans dépendance (NFR-10)
2. **`npm run test:isolation`** — les trois verbes d'écriture chez B, le trou refermé,
   l'unicité et ses deux cas négatifs
3. **`supabase/tests/contraintes.test.ts`** — l'accord entre la borne d'écran et la contrainte,
   **mesuré** (règle §4). Le fichier existe pour ça
4. **Le manuel (Task 8)** — l'AC2 de la 3.5 s'y vérifie par un **nombre**, et lui seul. Les
   deux thèmes, le focus, le squelette au réseau bridé, la cascade

⚠️ **`node --test` sur un glob vide rend 0.** Un fichier mal nommé rend la CI verte sans une
assertion ; les deux jobs comptent donc les fichiers avant de lancer. **Tout contrôle neuf doit
répondre à : que se passe-t-il s'il ne trouve rien à contrôler ?**

⚠️ **Vérifie les dents, et méfie-toi du no-op.** La 3.5 a mesuré que supprimer `meal_plan_all`
rend la table **plus** restrictive, donc que le test de lecture restait vert **gratuitement**.
La mutation qui mord est `using (true) with check (true)`.

---

### Project Structure Notes

```
supabase/migrations/
  <horodatage>_contraindre_les_assignations_de_menu.sql   +  LA migration, QUATRE volets :
                                                             unicité · provenance · servings > 0
                                                             · households.default_servings
lib/menu/
  menu.ts                     ~  estCodeRepas, casesDeRecette, le slug dans REPAS
  menu.test.ts                +  le pur de menu.ts — n'existe pas encore
  erreurs.ts                  +  refusAssignation — motif de lib/recettes/erreurs.ts
  erreurs.test.ts             +
  semaine.ts                  INCHANGÉ  — tout le calendaire y est déjà, et testé
app/menu/
  page.tsx                    ~  la case devient actionnable et montre le nombre de personnes
  loading.tsx                 ~  suit page.tsx si la forme de la case bouge (aucun test ne le tient)
  [jour]/[repas]/page.tsx     +  l'écran d'assignation (décision 2), rendu serveur
  [jour]/[repas]/<client>.tsx +  le formulaire, écritures client-direct
  [jour]/[repas]/loading.tsx  +  ⚠️ SANS LUI, c'est le squelette de la GRILLE qui s'affiche
                                 sur un écran qui est un formulaire (piège n°8)
app/foyer/
  page.tsx                    ~  lit default_servings, + une section (décision 4)
  <client>.tsx                +  le formulaire « On est », motif de DisplayNameForm
app/recettes/
  page.tsx                    ~  le commentaire :23-26
  [id]/modifier/page.tsx      ~  lit les cases de menu de la recette
  [id]/modifier/FormulaireRecette.tsx  ~  le hint :493
supabase/tests/
  isolation.test.ts           ~  INVERSION du test :1074 + écritures de menu chez B
                                 ⚠️ RIEN sur households — :214-223 couvre déjà
  contraintes.test.ts         ~  les DEUX contraintes neuves
lib/supabase/types.ts         ~  RÉGÉNÉRÉ, et cette fois le diff n'est PAS vide (colonne neuve)
_bmad-output/implementation-artifacts/
  deferred-work.md            ~  deux entrées refermées, ce que cette story laisse
  sprint-status.yaml          ~  statut
app/globals.css               INCHANGÉ par défaut — tout ce qu'il faut est publié
package.json                  INTACT — aucune dépendance (NFR-10)
lib/supabase/proxy.ts         INCHANGÉ — /menu, ses enfants et /foyer sont protégés par défaut
```

⚠️ **Une seule migration, et elle est OBLIGATOIRE** — c'est l'inverse exact de la 3.5, qui
n'en devait aucune. Si tu te retrouves à en écrire deux, relis la Task 1 : `db push` n'est pas
atomique sur un lot, et les quatre volets se contrôlent par la même requête.

⚠️ **Deux écrans d'écriture, pas un** — `/menu/[jour]/[repas]` et `/foyer`. La décision 4 a
élargi le périmètre, et ce n'est pas un débordement : c'est elle qui donne au champ du premier
sa valeur d'ouverture. **Mais compte tes régions de statut** : `/foyer` en aura trois.

⚠️ **`lib/menu/menu.ts` mélangera du pur et de l'accès base.** C'est déjà le cas (`REPAS`,
`cleDeCase`, `grouperParCase` sont purs) et ce n'est pas un problème : le glob de `npm test`
s'arrête à `lib/`, et un fichier de test peut n'éprouver que le pur. **Si le fichier devient
difficile à lire, sépare — mais dis-le, ne le fais pas en silence.**

---

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session.** Six règles mordent ici :

- **§1 — Ne consigner comme vérifié que ce qui a été exécuté, en citant la commande.** Cette
  story distingue partout le **mesuré** du **déduit** : `npm test` a été exécuté (179/179), les
  comptes d'isolation ont été **comptés** et non exécutés, `PGRST201` est **déduit**. Fais
  pareil, et laisse les cases vides plutôt que cochées à tort.
- **§2 — Un commentaire explique un pourquoi, jamais un état de la base.** Cette story rend six
  commentaires faux (piège n°9). Le dépôt a déjà compté cinq commentaires devenus faux, dont
  **quatre écrits pendant une revue**.
- **§3 — Une énumération ne peut pas gagner contre une catégorie.** Ici : `estCodeRepas` se
  dérive de `REPAS`, pas d'une liste recopiée.
- **§4 — Un invariant entre deux fichiers se mesure.** L'accord entre la borne d'écran sur le
  nombre de personnes et la contrainte en base : `contraintes.test.ts`, pas un commentaire.
- **§5 — Une prémisse qui sert à reporter un défaut se rouvre avant d'être réinvoquée.** C'est
  le § Ce que cette story REFERME, en entier — trois prémisses citées, pas supposées closes.
- **§7 — Ce qu'aucune porte automatique ne voit.** Le rendu (l'AC2, deux stories d'affilée), le
  déploiement (cette migration s'applique **à la fusion**), l'outillage.

**Une case vide honnête vaut mieux qu'une case cochée à tort.** Toutes les stories depuis la
1.5 en ont laissé ; la revue l'a préféré à chaque fois.

⚠️ **Et une leçon de méthode que cette story hérite, qu'elle le veuille ou non :** la 3.5 a été
fusionnée avec sa condition de fusion ouverte. Ce n'est pas un reproche à écrire dans le code —
c'est un fait à connaître, parce qu'il déplace une démonstration sur ton dos. **Ne la reporte
pas à ton tour.**

---

### Intelligence git

`origin/main` est à **`a56ba0b`** — « feat(menu): Affichage des choix de la semaine (#22) »,
fusionnée le **2026-08-04 à 13:34:53 UTC**. **Aucune PR ouverte** (`gh pr list`, vérifié le
2026-08-04). L'arbre de travail est **propre**. **Branche depuis `origin/main`** :

```bash
git fetch origin && git switch -c feat/menu-assignation origin/main
```

⚠️ **La branche `feat/menu-grille` est celle de la 3.5, déjà fusionnée en écrasement** — ne
branche pas depuis elle. Même piège que celui signalé à la 3.5 avec `feat/recettes-lecture`.

⚠️ **La 3.5 est fusionnée avec le statut `review` et sa Task 5 décochée.** Ce n'est pas un
travail en attente qui te bloquerait ; c'est une démonstration qui n'a pas eu lieu, et que ta
Task 8 absorbe (§ REFERME, point 3).

**14 migrations** en place, la dernière étant `20260803090000_reorder_recipe_ingredients_message_null.sql`.
La tienne doit porter un horodatage **postérieur** — c'est la seule raison d'être de
l'horodatage, et une migration antérieure à la dernière appliquée en distant **bloque tous les
déploiements suivants**, y compris ceux qui ne touchent aucune migration (`deferred-work.md`).

⚠️ **`main` est protégée** : jobs `verify` et `isolation` requis, `strict`, push direct
interdit. **Et depuis `vercel.json`, un commit sur `main` applique les migrations en
production** : cette PR n'est pas une PR ordinaire — la revue est le **dernier contrôle
humain** avant que la contrainte touche la vraie base. Le gabarit de PR pose les cinq questions
obligatoires ; elles ne sont pas décoratives ici.

Conventional Commits, corps en français ; branche → PR → **squash merge** CI verte. Versions à
ne pas bouger : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`,
`@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5`. Node 24.

---

### Environnement de test

⚠️ **`localhost:3333`, jamais `127.0.0.1:3333`** — Next 16 bloque ses ressources de
développement en cross-origin ; l'hydratation échoue, les formulaires partent en GET natif, et
**rien ne le dit dans le navigateur**, seulement dans la sortie du serveur. **Cette story a des
formulaires** : le symptôme serait ici, pas à la 3.5.

⚠️ **`.env.local` pointe sur la PRODUCTION.** Bascule et **restaure en comparant l'empreinte
SHA-256**, en consignant les deux sorties. Cette story **écrit et supprime**.

⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION**, et **la migration de cette
PR n'y est pas appliquée** : l'AC2 n'y est pas démontrable, et y assigner ou y supprimer
toucherait de vraies données.

⚠️ **Après `db reset`, Kong garde l'ancienne adresse du conteneur d'authentification** :
`AuthRetryableFetchError`, 25 tests rouges, `/auth/v1/health` en 502 alors qu'`auth` est sain.
Remède : `docker restart supabase_kong_nutriclaude`. **Ça ressemble à une régression et ça n'en
est pas une** — et cette story fera plusieurs `db reset`.

⚠️ **Le thème se contrôle au réglage système**, pas dans les outils de développement
(`globals.css:68` lit `prefers-color-scheme`). `osascript`, et **remets le réglage après**.

⚠️ **L'automatisation de navigateur n'alimente pas l'état React par la frappe** quand la fenêtre
n'est pas au premier plan — artefact mesuré à la 3.2, **sans portée à la 3.5 parce qu'elle
n'avait aucun champ. Elle en a une ici.**

---

### Tailwind 4 — le piège qui échoue en silence

`--color-*: initial` dans `globals.css:110`. **`bg-red-500`, `text-gray-400`, `bg-white` ne
génèrent plus rien et échouent EN SILENCE.** Toute couleur doit être un token publié :
`surface-base`, `surface-card`, `card-border`, `control-border`, `text`, `muted`, `muted-2`,
`accent-*`. Espacements nommés : `touch` (44px), `gutter` (14px), `card` (12px), `screen`
(8px), `item` (46px). Classes de composant : `titre-ecran`, `titre-section`, `btn`,
`btn-primaire`, `btn-quiet`, `input`, `label`, `card`, `hint`, `notice`, `sr-only`.

**Il n'y a PAS de fichier de configuration Tailwind et il ne faut pas en créer** : tout passe
par `@theme` / `@theme inline`. `dark:` suit `prefers-color-scheme`, aucune bascule manuelle.

---

### References

- [Source: epics.md#Story-3.6] — user story et 4 AC, cités **verbatim** ; [#FR-15], [#FR-43],
  [#NFR-3], [#UX-DR2], [#UX-DR5], [#UX-DR10], [#UX-DR11], [#UX-DR12], [#NFR-8], [#NFR-10]
- [Source: epics.md#Story-3.5] — ce que la story précédente a livré, et ce qu'elle a laissé ;
  [#Story-3.4] — ce qui manque encore ; [#Story-4.7] — la génération, qui consomme ce menu
- [Source: …/ARCHITECTURE-SPINE.md#AD-6] — la contrainte d'unicité, **citée mot pour mot** ;
  AD-1, AD-2, AD-3, AD-7, AD-8, AD-13, AD-16, AD-17 ; § Capability → Architecture Map
- [Source: …/DESIGN.md:249, :275, :329] et [EXPERIENCE.md:158] — « le menu et les recettes
  peuvent respirer au grand écran » ; **le spine prime sur la maquette** ; la composition de
  cet écran est hors périmètre de DESIGN.md
- [Source: …/mockups/grille-menu.html:34, :39, :61-63, :67, :69, :111-116] — l'écran FINI ;
  chacune de ces lignes porte quelque chose qui n'est pas de cette story (piège n°12)
- [Source: _bmad-output/project-context.md] — chargé à chaque session, **c'est lui qui fait foi**
- [Source: 3-5-…md] — la story précédente en entier : ses 9 pièges, ses 3 décisions, ses sondes
  datées, et **ses deux lignes restées ouvertes**
- [Source: deferred-work.md] — § *Deferred from: story 3-1* (la suppression de recette qui vide
  le menu, adressée nommément à cette story) ; § *Deferred from: story 3-5* (le demi-AC4, le
  trou d'intégrité, `servings` non affiché)
- [Source: supabase/migrations/20260502000000_initial_schema.sql:175-188] — la table, ses quatre
  `meal_type`, `servings int not null default 2`, la cascade sur `recipes` ; [:316-318] —
  `meal_plan_all`, `using` **et** `with check`, sur `household_id` **seul** ; [:513-572] —
  `generate_grocery_list_from_menu`, sa division par `r.servings`, et le fait qu'**elle n'est
  appelée par rien**
- [Source: supabase/migrations/20260801124553_require_valid_recipe_fields.sql] — le raisonnement
  complet sur `servings`, la forme d'une requête de contrôle, et pourquoi la regex ne se
  « simplifie » pas
- [Source: supabase/tests/isolation.test.ts:1074-1131] — « LE TROU POSSIBLE », **le test que
  cette migration fait tomber** ; [:821-857] — le modèle des trois verbes d'écriture ;
  [:1056-1072], [:1133-…] — les deux tests de menu qui doivent rester verts
- [Source: supabase/tests/contraintes.test.ts] — le motif d'un accord client ↔ base **mesuré**
- [Source: lib/menu/menu.ts] — `casesDeLaSemaine`, `REPAS`, `grouperParCase`, et les trois
  commentaires qui annoncent cette story
- [Source: lib/menu/semaine.ts] — tout le calendaire, **déjà écrit et testé** (20 tests)
- [Source: app/menu/page.tsx:43-49, :55-67, :95-101] — le `min-h-touch` posé d'avance, la case
  vide et sa décision, l'annonce du basculement en écriture
- [Source: app/recettes/[id]/modifier/FormulaireRecette.tsx:449-495] — la confirmation en deux
  temps, et le `hint` du `:493` que cette story rend faux
- [Source: app/recettes/[id]/modifier/IngredientsRecette.tsx] — **le modèle le plus proche** :
  quatre zones de statut, `retourFocus`, `attenteOrdre`, confirmation en deux temps, `data`
  autant qu'`error`, et **son trou mesuré au `:775-783`**
- [Source: app/recettes/ListeRecettes.tsx:60-96] — l'`insert` client-direct, `household_id` et
  `created_by` explicites, et **pourquoi**
- [Source: lib/recettes/erreurs.ts] — SQLSTATE d'abord, nom de contrainte ensuite, **et la
  frontière entre les deux**
- [Source: lib/recettes/saisie.ts:71-110] — `normaliserEntier` et ses trois pièges ; [:221-242]
  — `estUuid`
- [Source: app/_lib/useSoumission.ts], [app/_lib/Notice.tsx], [lib/messages.ts],
  [app/_lib/garde.ts] — les quatre briques d'un écran qui écrit
- [Source: docs/migrations.md] — additivité, requête de contrôle, `--local`, le lot non
  atomique, et **§ Relire une PR**
- [Source: scripts/controler-migrations.mjs] — ce que `check:migrations` voit, et ce qu'il ne
  peut pas voir
- [Source: next.config.ts:5-13] — `strictRouteTypes` et le bug silencieux qu'il attrape ;
  [:20-70] — la CSP et son échéance Epic 6
- **Mesures exécutées le 2026-08-04 sur `a56ba0b`, arbre propre** — (1) `npm test` →
  **179 pass / 0 fail**, `duration_ms 168` ; (2) `grep -c "^test(" supabase/tests/*.test.ts` →
  **42** (isolation) + **18** (contraintes) ; (3) `gh pr view 22` → `mergedAt`
  **2026-08-04T13:34:53Z**, corps = gabarit vierge ; (4) `git log --oneline -8` → `a56ba0b` en
  tête, aucun commit postérieur ; (5) `grep -rn "meal_plan" supabase/migrations/` → un seul
  fichier, **aucun `unique`**
- **Non mesuré, et signalé comme tel** — `PGRST201` sur l'embarquement ambigu (piège n°3b) :
  **déduit** du comportement documenté de PostgREST. Suffisant pour écarter la forme (décision
  1), insuffisant pour affirmer qu'elle casse
- [Source: app/foyer/page.tsx:64-75] — la composition de l'écran et ses sections ;
  [app/foyer/DisplayNameForm.tsx:55-90] — **le motif exact** de l'écriture client-direct et du
  contrôle de `data` autant qu'`error`
- [Source: supabase/migrations/20260502000000_initial_schema.sql:24-28] — `households`, trois
  colonnes ; [:248-255] — ses trois politiques, dont `households_update` (`using` seul, qui
  vaut aussi `with check` en Postgres)
- [Source: supabase/tests/isolation.test.ts:214-223] — « A ne peut pas renommer le foyer de
  B », **l'isolation de `households` déjà éprouvée**

---

## Décisions de Florian — 2026-08-04

Les quatre questions ont été tranchées **avant démarrage**. Elles ne se rouvrent pas en revue
sans un fait nouveau.

### 1. La provenance de `recipe_id` — la politique resserrée, option (a)

`alter policy meal_plan_all … with check (… and exists (select 1 from recipes …))`. Le SQL exact
est en Task 1, volet 2.

**Pourquoi celle-là :** `alter policy` est atomique, n'ajoute ni index ni relation, ne change pas
la forme du schéma, et c'est le motif que `recipe_ingredients_all` emploie déjà
(`initial_schema.sql:299-313`). C'est aussi la forme que `deferred-work.md` nommait en premier.

⚠️ **Ce qu'elle ne fait pas, et c'est assumé :** une politique ne lie ni le rôle de service ni
un `security definer` — c'est une frontière de RLS, pas une contrainte. **Si une surface future
traversait la RLS, cette prémisse se rouvrirait** (règle §5). Elle est datée pour ça.

⚠️ **La clé étrangère composite est ÉCARTÉE, pas oubliée** — piège n°3, gardé exprès : c'est la
forme qu'une revue proposera spontanément comme « plus propre », et ses deux coûts (embarquement
PostgREST ambigu, cascade à démêler) ne sont pas devinables.

### 2. L'assignation se fait sur une route dédiée, option (a)

`/menu/[jour]/[repas]`, avec un **slug français** (`/menu/2026-08-04/midi`), son propre
`loading.tsx`, et le slug porté par `REPAS` qui reste le seul décideur.

**Pourquoi :** ça supprime le risque de l'AC2 **à la source** — aucun `<select>` n'entre jamais
dans une piste à 1/7 de largeur (piège n°1) — et ça donne à la case vide exactement ce que la
3.5 disait qu'elle attendait : « une destination ». L'objection qui avait fait écarter cette
forme à la 3.5 (« ça produirait un 404 en attendant ») **tombe**, puisque c'est cette story qui
construit la destination.

**Coût assumé :** une navigation par case. Planifier une semaine dense demande des
aller-retours.

⚠️ **Conséquence :** les pièges n°8 (le `loading.tsx` de segment enveloppe ses enfants) et n°10
(les paramètres d'URL sont des saisies) passent de conditionnels à **actifs**.

### 3. `meal_plan_entries_servings_positif` — oui, dans la même migration

Le raisonnement de `20260801124553` s'applique mot pour mot au **numérateur** de la même
formule (piège n°5). Cette story est la première à écrire cette colonne : **c'est le seul moment
où la contrainte ne coûte rien.**

### 4. Le nombre de personnes se règle au FOYER, et s'ajuste par assignation

**Ni la valeur de la colonne (2), ni les portions de la recette** — les deux options que la
question proposait sont écartées au profit d'une troisième : `households.default_servings`
propose, `meal_plan_entries.servings` décide.

```
households.default_servings   →   proposé à l'ouverture du formulaire
meal_plan_entries.servings    →   ajusté à la main, case par case
```

**Pourquoi c'est meilleur que les deux options proposées :** « on est 2 à la maison » est un
fait stable du foyer, que le membre énonce **une fois**. Les portions de la recette sont le
**dénominateur** de la mise à l'échelle — les employer comme valeur d'ouverture reviendrait à
proposer par défaut de cuisiner pour un nombre de gens qui n'a rien à voir avec le foyer.

⚠️ **Ce que ça ajoute au périmètre, et il faut le savoir avant de commencer :**

- une **colonne** sur `households` (volet 4 de la migration) — donc la forme du schéma change,
  donc `supabase gen types` est **dû**, ce qui n'aurait pas été le cas avec trois contraintes ;
- une **section sur `/foyer`** (Task 6), et **la première écriture du produit dans
  `households`** ;
- un **troisième nombre de personnes à l'écran**, dont deux portent le même nom en base —
  piège n°14, qui est la partie de cette décision qu'on rate.

⚠️ **Trois choses que cette décision ne dit PAS**, et qui sont des frontières :

1. **Changer le réglage ne réécrit aucune assignation existante.** Une case posée garde son
   nombre. Pas d'`update` en masse.
2. **Ce n'est pas un réglage par membre** — AD-16, le foyer est symétrique. Le changer change ce
   que voit l'autre membre, et l'écran doit le dire.
3. **Ce n'est pas un réglage par recette.** « Ce plat, j'en fais toujours pour 6 » serait une
   colonne de plus sur `recipes`, voisine de `servings` et de sens inverse. Écarté ici ; à
   rouvrir seulement si le besoin apparaît à l'usage.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), 2026-08-04.

### Debug Log References

#### Phase rouge, constatée (Task 3)

`npm test` à **2026-08-04 16:51:11 CEST**, tests écrits, modules absents :
**181 tests · 179 pass · 2 fail** — les deux échecs étant `lib/menu/menu.test.ts` et
`lib/menu/erreurs.test.ts` qui ne se chargent pas (`ERR_MODULE_NOT_FOUND` sur
`lib/menu/erreurs.ts`). Seconde phase rouge pour `lib/personnes.ts` : **1 fail**, même cause.

#### Les dents, par mutation

Six mutations jouées, chacune restaurée immédiatement, et **chacune fait tomber le test
qu'elle vise et lui seul**.

| Mutation | Résultat |
|---|---|
| `drop constraint meal_plan_entries_assignation_unique` | 66 → **65 pass, 1 fail** — « l'unicité d'assignation refuse le doublon » |
| `meal_plan_all` rendu à son ANCIEN `with check` (sans la provenance) | 66 → **65 pass, 1 fail** — « LE TROU REFERMÉ » |
| `drop constraint meal_plan_entries_servings_positif` | 66 → **65 pass, 1 fail** — « la base refuse 0 et le négatif au menu » |
| `drop constraint households_default_servings_positif` | 66 → **65 pass, 1 fail** — « la base refuse un réglage de foyer à 0 » |
| Slug accentué `petit-déj` | 192 → **189 pass, 3 fail** |
| `repasParSlug` acceptant AUSSI le code de la base | 192 → **191 pass, 1 fail** |
| `refusAssignation` privé du cas `23505` | 192 → **191 pass, 1 fail** |
| Nom de contrainte comparé de façon relâchée (`servings_positif`) | 192 → **191 pass, 1 fail** |
| *(tout restauré, `pg_constraint` recontrôlé identique au dépôt)* | **197 / 197** et **66 / 66** |

⚠️ **La mutation qui compte pour la politique n'est PAS `drop policy`** — c'est la leçon de la
story 3.2, et elle vaut toujours : supprimer la politique rend la table **plus** restrictive
(RLS active sans politique = tout refusé), donc les tests resteraient verts gratuitement. La
mutation qui mord est le **remplacement** du `with check` par sa version d'avant la migration.

#### La chute annoncée par la story, constatée

Avant toute réécriture de test, `npm run test:isolation` sur la migration appliquée :
**60 → 59 pass, 1 fail**, l'échec étant `LE TROU POSSIBLE` (`isolation.test.ts:1074`) avec
`{ code: '42501', message: 'new row violates row-level security policy for table
"meal_plan_entries"' }` là où il attendait `null`. **C'est le test qui avait demandé que ça se
voie ici**, et c'est ici que ça s'est vu.

#### Une collision de données entre tests, trouvée à l'exécution

Le test d'unicité neuf réemployait les dates du témoin positif (`2026-09-21`). Le fichier ne
nettoyant pas entre les tests, « A lit SA semaine de menu de bout en bout » comptait **5 lignes
au lieu de 2**. Corrigé en donnant des dates à soi (`2026-10-05`/`06`) plutôt qu'en resserrant
l'assertion du voisin — resserrer aurait masqué le couplage au lieu de le supprimer.

#### Sondes exécutées

1. **Requête de contrôle, stack local** — les trois volets rendent **zéro ligne**. Le stack
   venait d'être remis à zéro : ça ne prouve rien sur le distant, et l'en-tête de la migration
   l'écrit comme une **déduction**.
2. **État réel de la base après `db reset`** — `pg_constraint` et `pg_policies` inspectés :
   les trois contraintes sont là, la colonne `default_servings` aussi, et le `using` de
   `meal_plan_all` est resté **intact** (seul le `with check` a changé).
3. **`__InternalSupabase` est du typage vivant** — `grep` dans
   `@supabase/postgrest-js/dist/index.d.cts` : la clé porte `ClientServerOptions` et pilote
   l'inférence côté client (`:5008-5009`). Le CLI 2.111.0 de ce poste **ne la régénère pas**.
   D'où le choix d'appliquer au fichier le **delta exact** du CLI (les trois
   `default_servings`) au lieu d'écraser : `diff` entre le fichier et
   `supabase gen types --local --schema public` ne montre plus que cette clé.
4. **Le squelette de la route, OBSERVÉ** — sonde de latence temporaire (4 s côté serveur,
   retirée aussitôt et vérifiée à 0 occurrence). Pendant l'attente : **9 blocs**,
   `aria-hidden="true"`, et **aucune grille 7 colonnes**. C'est bien son squelette, pas celui
   du segment parent (piège n°8).
5. **La largeur** — voir la case de la Task 8, qui porte la méthode et son écart.
6. **L'anneau de focus, au clavier** — `Tab` ×5 puis lecture du DOM : `outline 2px solid
   rgb(255,169,77)`, `offset 2px`, `:focus-visible` vrai, cible **44 px** de haut (UX-DR11).
   ⚠️ Un `.focus()` **programmatique** rend `outlineStyle: none` — il ne déclenche pas
   `:focus-visible`. Mesurer avec lui aurait conclu à tort que l'anneau manque.
7. **Le focus après retrait** — `document.activeElement` est le `<h2 id="titre-prevu">`, **pas**
   `<body>`.

#### Les six portes (2026-08-04)

| Porte | Résultat |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ (0 avertissement) |
| `npm test` | ✅ **197 / 197** (179 avant la story) |
| `npm run test:isolation` | ✅ **66 / 66** (60 avant la story) |
| `npm run build` | ✅ `/menu/[jour]/[repas]` en route dynamique, `strictRouteTypes` vert |
| `npm run check:migrations` | ✅ **15 migrations**, 13 avec requête de contrôle, 2 exemptées ; **aucune ajoutée à `EXEMPTEES`** |

### Completion Notes List

**Ce qui est livré, et démontré à l'écran :**

- **AC1** — assigner une recette avec son nombre de personnes. Joué sur `/menu/2026-08-04/midi`.
- **AC2** — le doublon est refusé **par la contrainte**, et l'écran le dit : « Cette recette est
  déjà à ce repas. » La console porte `duplicate key value violates unique constraint
  "meal_plan_entries_assignation_unique"` — donc c'est bien la base qui a parlé, pas un contrôle
  d'écran.
- **AC3** — nombre de personnes changé (2 → 6), puis retrait avec confirmation en deux temps.
- **AC4** — la grille montre « Gratin de courgettes / 2 pers. » et, sur la même case, une seconde
  recette avec son propre nombre. **La pluralité tient**, comme AD-6 l'autorise.
- **La moitié d'AC4 de la story 3.5 est REFERMÉE** : la case vide est un lien qui mène quelque
  part, et sa cible mesure 44 px.
- **L'AC2 de la story 3.5** — aucun débordement horizontal sur le pire cas (case à deux recettes
  dont un titre de 79 caractères), à 1440 px, à 528 px, et avec le conteneur forcé à 390/320/195.
- **Décision 4, vérifiée de bout en bout** : réglage du foyer porté à 3 sur `/foyer`, puis un
  formulaire d'assignation neuf s'ouvre sur **3**. Et une case déjà posée n'a pas bougé.

**Ce que le parcours à l'écran a TROUVÉ, et qu'aucune des six portes ne voyait :**

1. ⛔ **`min={1}` et `required` faisaient afficher un message de navigateur EN ANGLAIS** —
   « Value must be greater than or equal to 1. » — hors région `aria-live`, hors du ton du
   produit (NFR-8/NFR-9). **Et pire : le gestionnaire n'était jamais appelé**, donc « Il faut au
   moins une personne. » et « Choisis une recette. » étaient **inatteignables** — deux clés de
   message sans appelant, la dette exacte que ce dépôt a déjà eue à retirer. Corrigé par
   `noValidate` sur les trois formulaires ; `min`/`required` restent pour l'affordance et
   l'accessibilité. **Revérifié après correctif** : les quatre refus s'affichent en français dans
   la région de statut.
2. ⛔ **« et des 2repas »** — JSX mangeait l'espace avant un mot suivant un `<span>`. Corrigé par
   un `{" "}` explicite, et **revérifié à l'écran** : « et des 2 repas où tu l'as prévue. »

*Les deux étaient invisibles à `typecheck`, `lint`, `test`, `test:isolation` et `build`, tous
verts. C'est la règle §7 de `project-context.md`, deux fois dans la même journée.*

**Ce que l'implémentation a APPRIS et qui n'était pas dans la story :**

1. ⚠️ **Le CLI Supabase de ce poste régénère `lib/supabase/types.ts` en PERDANT
   `__InternalSupabase`**, qui n'est pas décoratif : il porte les options qui pilotent
   l'inférence de types côté client — précisément l'endroit que la story 3.5 avait mesuré comme
   donnant deux inférences contradictoires sur la ressource embarquée. Écraser le fichier aurait
   été un changement silencieux de typage sans rapport avec cette story. Le delta a donc été
   appliqué, et l'écart est mesuré (`diff`) plutôt qu'affirmé.
2. ⚠️ **`estCodeRepas` n'a pas été écrit, et c'est délibéré.** La story le prescrivait, mais la
   décision 2 fait arriver un **slug** par l'URL, jamais un code : le prédicat n'aurait eu aucun
   appelant. `repasParSlug` joue le rôle de garde de saisie qui lui était assigné. Un prédicat
   construit puis non branché est la dette que la revue du 2026-08-03 a relevée sur
   `estUniteConnue`.
3. ⚠️ **La règle du nombre de personnes a été extraite dans `lib/personnes.ts`**, à la racine et
   non sous `lib/menu/` : deux domaines la consomment (`/foyer` et `/menu/[jour]/[repas]`). C'est
   aussi ce qui rend l'accord avec les **deux** contraintes mesurable par
   `contraintes.test.ts` — sans extraction, la règle serait restée dans les composants, hors de
   portée de tout test (NFR-10).
4. ⚠️ **`nomDuFoyer` est devenue `foyerCourant`** et rend `{ nom, personnesParDefaut }` : les deux
   champs vivent sur la même ligne, et `/foyer` a besoin des deux. Deux fonctions auraient fait
   deux allers-retours pour une seule ligne.
5. ⚠️ **Chrome ne descend pas sa fenêtre sous ~528 px** (mesuré), et le contexte d'exécution de
   l'extension ne peut pas lire le document d'un iframe même de même origine (`SecurityError`).
   Les deux ont contraint la méthode de mesure de l'AC2 — l'écart est écrit dans la case
   correspondante plutôt que tu.
6. ⚠️ **`seed_default_aisles` refuse un appel du rôle `postgres`** (« Not your household ») :
   c'est sa garde d'identité qui fonctionne, pas une panne. Sans portée ici — les rayons ne
   servent pas au menu.

**⛔ CE QUI RESTE OUVERT, ET QUI CONDITIONNE LA FUSION :**

- **La requête de contrôle de la migration n'a PAS été exécutée sur la production**, et ne
  pouvait pas l'être depuis ici : c'est le geste de la revue de PR, et **la fusion applique la
  migration**. Les trois volets rendent zéro ligne sur le stack local, qui venait d'être remis à
  zéro — c'est une **déduction**, écrite comme telle dans l'en-tête de la migration.
- **« Le dire dans la PR »** — que l'AC2 n'est pas démontrable sur la prévisualisation, sa
  migration n'y étant pas appliquée — reste à faire au moment d'ouvrir la PR.
- **Le squelette de la GRILLE `/menu`** n'a toujours pas été regardé au réseau bridé (celui de la
  route neuve, si). Hérité de la story 3.5, consigné dans `deferred-work.md`.

*Aucune de ces trois lignes n'est un oubli : les deux premières demandent la PR, la troisième
demande un geste que cette story n'a pas eu à faire.*

### File List

**Créés**

- `supabase/migrations/20260804144217_contraindre_les_assignations_de_menu.sql`
- `lib/menu/erreurs.ts`
- `lib/menu/erreurs.test.ts`
- `lib/menu/menu.test.ts`
- `lib/personnes.ts`
- `lib/personnes.test.ts`
- `app/menu/[jour]/[repas]/page.tsx`
- `app/menu/[jour]/[repas]/AssignerRepas.tsx`
- `app/menu/[jour]/[repas]/loading.tsx`
- `app/foyer/PersonnesForm.tsx`
- `_bmad-output/implementation-artifacts/3-6-assigner-recettes-et-nombre-de-personnes-aux-cases-du-menu.md`

**Modifiés**

- `lib/menu/menu.ts` — `slug` dans `REPAS`, `repasParSlug`, `casesDuRepas`, `casesDeRecette`,
  `versCaseDeMenu` extrait ; trois commentaires que la migration rend faux
- `lib/foyer/foyer.ts` — `nomDuFoyer` → `foyerCourant`
- `lib/supabase/types.ts` — `households.default_servings` (delta du CLI, `__InternalSupabase`
  préservée)
- `app/menu/page.tsx` — la case devient actionnable et montre le nombre de personnes
- `app/foyer/page.tsx` — la section « Combien on est »
- `app/page.tsx` — appelant de `foyerCourant`
- `app/recettes/page.tsx` — le commentaire d'en-tête devenu faux
- `app/recettes/[id]/modifier/page.tsx` — lit les cases de menu de la recette
- `app/recettes/[id]/modifier/FormulaireRecette.tsx` — la confirmation de suppression
- `supabase/tests/isolation.test.ts` — « LE TROU POSSIBLE » **inversé**, + 2 tests neufs
- `supabase/tests/contraintes.test.ts` — 4 tests neufs (les deux contraintes × client/base)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Intacts, et vérifiés comme tels** : `package.json` (aucune dépendance — NFR-10),
`app/globals.css`, `lib/supabase/proxy.ts` (les routes neuves sont protégées par défaut),
`app/menu/loading.tsx` (la forme de la grille n'a pas bougé), `.env.local` (basculé pour le
parcours puis **restauré, SHA-256 identique** :
`8aa793a63fb651aba4e2d457ccbd4b58adcd3897efc01f8f6ebb4116b1fcaf2d`), réglage système de thème
(remis à `false`).

### Review Findings

## Change Log

| Date | Quoi |
|---|---|
| 2026-08-04 | Story créée sur `a56ba0b`. Statut `backlog` → `ready-for-dev`. **Quatre questions posées, dont deux structurantes** (forme de la contrainte de provenance, place de l'assignation). Trois prémisses rouvertes et citées (règle §5), dont **l'AC2 de la 3.5, fusionné sans avoir été observé** — sa démonstration passe dans la Task 8 de cette story |
| 2026-08-04 | **Implémentée sur `feat/menu-assignation`** (branchée sur `a56ba0b`). 11 fichiers créés, 13 modifiés. Une migration à **quatre volets**. 18 tests unitaires neufs (179 → 197), 6 tests d'isolation/contraintes neufs (60 → 66), **8 mutations** jouées, chacune faisant tomber le test qu'elle vise et lui seul. Six portes vertes. ✅ **PARCOURS À L'ÉCRAN JOUÉ EN ENTIER** — les quatre AC de cette story, la moitié d'AC4 de la 3.5, **et l'AC2 de la 3.5 qui n'avait jamais été observé**. Il a trouvé **2 défauts qu'aucune porte ne voyait** : un message de navigateur en anglais qui rendait deux messages français inatteignables, et « et des 2repas » — les deux corrigés et revérifiés. ⛔ **Reste avant fusion** : la requête de contrôle de la migration sur la PRODUCTION (geste de revue), et le dire dans la PR |
| 2026-08-04 | **Les quatre questions tranchées par Florian, avant démarrage.** (1) Politique `meal_plan_all` resserrée — la clé étrangère composite est écartée et le piège n°3 est DATÉ plutôt qu'effacé. (2) Route dédiée `/menu/[jour]/[repas]`, slug français porté par `REPAS` — les pièges n°8 et n°10 deviennent actifs. (3) `meal_plan_entries_servings_positif` dans la même migration. (4) **Le nombre de personnes se règle au FOYER puis s'ajuste par assignation** — réponse hors des options proposées, qui ajoute `households.default_servings`, une section sur `/foyer`, la **première écriture du produit dans `households`**, un `supabase gen types` désormais **dû**, et le piège n°14 (trois nombres de personnes, deux du même nom en base). Périmètre passé de 9 à **10 tâches** ; toutes ouvertes, plus rien n'attend |
