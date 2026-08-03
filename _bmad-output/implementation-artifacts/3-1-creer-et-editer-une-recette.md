---
baseline_commit: 2ad08c48dfe587bb83445b0cea198c3f50fb8d25
---

# Story 3.1: Créer et éditer une recette

Status: done

<!-- `review` → `done` le 2026-08-03, en réalignement : `sprint-status.yaml` la donnait
     `done` depuis sa fusion du 2026-08-02 (PR #17, squash `d270c47`), ce fichier disait
     encore `review`.

     ⚠️ FERMÉE AVEC SES CONDITIONS OUVERTES :
       · **fusionnée SANS revue adversariale**, la deuxième des trois d'affilée ;
       · la garde des saisies non enregistrées n'est vérifiée que sur 1 de ses 4 chemins
         (seul le clic sur le lien de retour a été joué ; `beforeunload` est posé et typé
         mais non observé ; le bouton Retour du navigateur n'est couvert par RIEN,
         délibérément) ;
       · le `<textarea>` sur un texte long — éprouvé sur 4 lignes, pas 30.
     ⚠️ Cette story reste la SEULE de l'Epic 3 à n'avoir reçu aucune revue adversariale.
     La 3.2 a eu la sienne le 2026-08-03, la 3.3 le 2026-08-02. -->

<!-- Première story de l'Epic 3. Elle ouvre le premier chemin d'écriture vers `recipes` et le
     premier champ de texte MULTILIGNE du produit. Les deux ont leur piège (n°1 et n°2).
     Les cinq questions ouvertes ont été TRANCHÉES le 2026-08-01 (§ Décisions), puis le périmètre
     dégonflé d'une route. Rien ne se rouvre en revue sans un fait nouveau. -->

## Story

As a membre configurant le foyer (Florian),
I want créer une recette avec son titre, sa description, ses portions, son temps et ses
instructions,
So that j'alimente un répertoire réutilisable pour planifier les repas.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-3.1`.

**AC1 — Créer**
**Given** l'écran des recettes sur la surface web
**When** Florian crée une recette en renseignant titre, description, nombre de portions, temps et
instructions
**Then** la recette est persistée, rattachée au foyer (partagée entre membres — FR-43), et apparaît
dans le répertoire

**AC2 — Éditer**
**Given** une recette existante
**When** Florian modifie l'un de ses champs (titre, description, portions, temps, instructions)
**Then** la modification est enregistrée sans avoir à recréer la recette

**AC3 — Portions exploitables**
**Given** le champ « portions »
**When** il est renseigné
**Then** il porte une valeur numérique exploitable plus tard pour la mise à l'échelle des quantités
(FR-16, consommée en Epic 4)

**AC4 — État vide et chargement**
**Given** un foyer dont le répertoire de recettes est vide
**When** l'écran des recettes s'affiche
**Then** il montre un état vide lisible invitant à créer une première recette, et pendant le
chargement un squelette plutôt qu'un écran blanc ou un message d'erreur

> **« Exploitable » (AC3) n'est pas satisfait par « c'est un `int` ».**
> `generate_grocery_list_from_menu` calcule `mpe.servings::numeric / nullif(r.servings, 0)`. Un
> `servings` à 0 ne lève pas : il rend `NULL`, donc **toutes les quantités de cette recette
> disparaissent en silence** de la liste de courses, en Epic 4. Négatif, elles deviennent négatives.
> AC3 se tient par une contrainte en base. Voir piège n°2.

> **AC1 en deux temps, et c'est un écart assumé.** Le répertoire crée avec le **titre seul**, puis
> l'écran d'édition reçoit les cinq autres champs. Le membre renseigne bien tout, et la recette est
> bien persistée et présente au répertoire — mais en deux écrans. Décidé en dégonflant le périmètre
> (§ Décisions, point 1). **Si un relecteur conteste la lettre de l'AC, c'est ici que la discussion
> a lieu, pas dans le code.**

## Tasks / Subtasks

- [x] **Task 1 — La migration additive : deux contraintes que `recipes` n'a pas** (AC1, AC3)
  - [x] `npx supabase migration new require_valid_recipe_fields` — horodatage **postérieur** à
        `20260731062945` ; jamais choisi à la main
  - [x] `recipes_titre_non_vide` — **recopie la regex de `20260729095923:80` à la lettre**. Elle a
        été fausse deux fois avant d'être juste (piège n°2)
  - [x] `recipes_servings_positif` — `check (servings > 0)`
  - [x] **Requête de contrôle en en-tête**, exécutable telle quelle, avec son attendu écrit.
        `npm run check:migrations` vérifie qu'elle existe ; **qu'elle ait été exécutée est humain**,
        et se fait EN REVUE — il n'y a plus de `db push` manuel (piège n°3)
  - [x] `npx supabase db reset`, puis `npx supabase gen types typescript --local > lib/supabase/types.ts`
  - [x] Diff de types **attendu vide ou quasi vide** : une contrainte `check` ne change pas la forme
        du schéma. Si le diff ne porte que sur `__InternalSupabase`/`graphql_public`, **ne le
        commite pas**
  - [x] `docs/migrations.md` **INCHANGÉ** — aucune fonction ajoutée, le compte « huit » tient

- [x] **Task 2 — `lib/recettes/saisie.ts`, en TDD** (AC1, AC2, AC3)
  - [x] Phase rouge **constatée** avant l'implémentation, comme `lib/rayons/ordre.ts`
  - [x] `MAX_TITRE = 80`, `MAX_DESCRIPTION = 300`, `MAX_INSTRUCTIONS = 5000`
  - [x] `normaliserTitre` → délègue à `normaliserTexte` de `lib/texte.ts`
  - [x] `normaliserMultiligne(saisie, maximum)` — **ne peut PAS déléguer à `normaliserTexte`** :
        il détruirait tous les retours à la ligne. **Mesuré** (piège n°1)
  - [x] `normaliserEntier(saisie)` → `number | null` — `Number("")` vaut `0` (piège n°5)
  - [x] Tests : NFD, emoji, invisibles collés, chaîne vide, bornage en points de code — **et pour le
        multiligne : les `\n` survivent, les `\r\n` se normalisent, tabulation et contrôles partent**

- [x] **Task 3 — `lib/recettes/erreurs.ts` + ses tests** (AC1, AC2)
  - [x] `RefusRecette = "titre-vide" | "portions-invalides" | "disparue" | "echec"`
  - [x] ⚠️ **`23514` ne suffit plus à décider** : `recipes` en portera deux là où `aisles` n'en avait
        qu'une. Le nom de contrainte arbitre — **mesuré** (piège n°6)
  - [x] Pas de cas `23505` : aucune contrainte d'unicité sur `recipes`, et on n'en ajoute pas

- [x] **Task 4 — `lib/recettes/recettes.ts`, la couche lecture** (AC1, AC2, AC4)
  - [x] `type Recette`, `recettesDuFoyer(supabase)`, `recetteParId(supabase, id)`
  - [x] **Client passé en paramètre** — motif de `lib/rayons/rayons.ts`, pour le dashboard (Epic 5)
        et le serveur MCP (Epic 7)
  - [x] **Aucun filtre `household_id`** : `recipes_all` porte `using` **et** `with check`
  - [x] `.order("title").order("created_at")` — le second critère n'est pas décoratif (piège n°7)
  - [x] `recetteParId` rend `null` sans lever sur zéro ligne : c'est un succès PostgREST, pas une
        erreur (`DisplayNameForm.tsx:70-78`)

- [x] **Task 5 — `/recettes` : le répertoire, sa création à un champ, son état vide, son squelette**
      (AC1, AC4)
  - [x] `app/recettes/page.tsx` — Server Component, `requireProfile()`, `metadata.title`
  - [x] Création **au titre seul**, motif exact du formulaire d'ajout de `ListeRayons:988-1044` :
        un champ, un `Notice` avec `reserve`, un bouton. `household_id` et `created_by` explicites
        (piège n°4)
  - [x] Après succès : `router.replace` vers `/recettes/[id]/modifier` — la création **continue**
        sur l'écran d'édition, elle ne s'y arrête pas
  - [x] État vide lisible + la même invitation (motif de `ListeRayons:680-694`)
  - [x] `app/recettes/loading.tsx` — **le premier du dépôt**. Un squelette, jamais un spinner,
        jamais un message (piège n°8)
  - [x] ⚠️ **Vérifie qu'il s'affiche vraiment**, en bridant le réseau. Un squelette jamais vu à
        l'écran n'est pas un squelette livré

- [x] **Task 6 — `/recettes/[id]/modifier` : les cinq autres champs, et la suppression** (AC1, AC2, AC3)
  - [x] `params` est une **`Promise`** (`strictRouteTypes` activé) : `const { id } = await params`
  - [x] Introuvable, d'un autre foyer, **ou identifiant qui n'est pas un uuid** → `notFound()`,
        jamais « Réessaie » (piège n°9)
  - [x] Les six champs ; **ne pose pas `updated_at`** — le trigger le fait (piège n°10)
  - [x] Contrôler `data` **autant** qu'`error` : un `update` sur une ligne masquée par la RLS rend
        zéro ligne **sans erreur**
  - [x] ⚠️ **Marque les champs FACULTATIFS, pas le requis.** Seul le titre est obligatoire
  - [x] Un `hint` sous la description — « Deux ou trois phrases. » — qui pose l'attente **avant** la
        borne plutôt qu'après (piège n°13)
  - [x] **Supprimer la recette** — confirmation en deux temps, motif d'`InviteCard` et de
        `ListeRayons:836-872`. Jamais `window.confirm` (piège n°11)
  - [ ] Après suppression : retour au répertoire, **et le focus posé** — la ligne qui le portait
        n'existe plus (leçon de `ListeRayons:671-675`)
  - [x] La garde des saisies non enregistrées, armée **seulement si un champ a changé**, et
        **désarmée avant la suppression** (piège n°12)
  - [x] **Deux surfaces de soumission = deux régions de statut.** C'est la règle, pas le compte
        (piège n°13)
  - [x] Lien de retour `← Tes recettes`, jamais `← Retour` : deux parents sont plausibles ici

- [x] **Task 7 — Le chemin depuis l'accueil, et le texte qui devient faux** (AC1)
  - [x] Un lien « Tes recettes » sur `/` (motif des deux liens existants)
  - [x] ⚠️ `app/page.tsx:26-29` écrit « Les courses, les recettes et le menu **arrivent**. » —
        **faux avec ce commit.** C'est le défaut de texte d'annonce périmé que les stories 1.6, 1.7,
        2.1 et 2.2 ont chacune eu à réparer
  - [x] `proxy.ts` **INCHANGÉ** — le matcher est un attrape-tout. Vérifie-le, ne le touche pas
  - [x] `deferred-work.md` : **deux entrées** — l'avertissement « au menu » à l'intention de la
        story 3.6 (piège n°11), et la CSP re-déférée à l'Epic 6 avec sa nouvelle raison
        (§ Décisions, point 4). Le commentaire de `next.config.ts:24-28` porte la même échéance et
        doit changer aussi

- [x] **Task 8 — Les tests exécutés : isolation et contraintes** (AC1–AC3, NFR-5)
  - [x] `isolation.test.ts` — **`recipes` n'a jamais été éprouvée** : c'est le premier chemin
        d'écriture vers cette table. A ne lit pas les recettes de B ; A ne peut ni `update`, ni
        `delete`, ni `insert` chez B ; l'`insert` forgé au `household_id` de B est refusé
  - [x] ⚠️ **Le `delete` inter-foyers est le test qui ment le plus facilement** : sous RLS il rend
        zéro ligne et **aucune erreur**. Compte les lignes **et relis avec le client `admin`** que la
        recette de B est toujours là
  - [x] ⚠️ Sous RLS, A ne peut pas lire les identifiants de B : un test inter-foyers doit les obtenir
        du client `admin`, sinon il passe **en ne prouvant rien** (deux faux positifs à la story 2.2)
  - [x] `contraintes.test.ts` — l'accord `normaliserTitre` ↔ `recipes_titre_non_vide` se **mesure**.
        Le sens qui blesse est « le client accepte, la base refuse ». Plus `servings` à 0 et à −1
  - [x] **Vérifie les dents** : retire une contrainte à la main, compte combien de tests tombent,
        écris le chiffre, remets-la

- [x] **Task 9 — Le parcours à l'écran, dans les deux thèmes** (AC1–AC4)
  - [x] Sur le **stack local** (`localhost:3333`, jamais `127.0.0.1:3333`) — une prévisualisation
        Vercel parle à la base de production et n'a pas ta migration
  - [x] Créer, compléter, éditer, supprimer, recharger, vider le répertoire pour l'état vide
  - [x] **Les deux thèmes**, au réglage système ; `osascript … set dark mode to true` — **et le
        remettre après**
  - [x] Le focus **mesuré dans le DOM**, pas supposé. 200 % de zoom sans défilement horizontal
  - [ ] Le `<textarea>` avec 30 lignes de texte, dans les deux thèmes
  - [ ] **Les quatre chemins de sortie de la garde**, un par un : rechargement, fermeture d'onglet,
        clic sur `← Tes recettes`, **et le bouton Retour du navigateur** — ce dernier n'est couvert
        par rien, et c'est à constater, pas à supposer
  - [x] Les cinq portes + `npm run test:isolation`

---

## Dev Notes

### Ce que la base fait déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où | Ce que ça implique |
|---|---|---|
| Table `recipes` complète | `initial_schema.sql:133-151` | **Aucune colonne à créer** |
| Isolation par foyer | `recipes_all`, `using` + `with check` (`:294-296`) | **Aucun filtre `household_id`** |
| Isolation des ingrédients | `recipe_ingredients_all` via `exists` (`:299-313`) | Story 3.2 |
| `updated_at` automatique | trigger `recipes_updated_at` (`:592-594`) | **Ne le pose jamais à la main** |
| Index du répertoire | `idx_recipes_household` (`:153`) | Rien à créer (piège n°7) |
| Index des étiquettes | `idx_recipes_tags` GIN (`:154`) | Story 3.4 |
| Privilèges de table | `alter default privileges` (`20260729094500`) | **Aucun `grant` à écrire** |
| Mise à l'échelle | `generate_grocery_list_from_menu:544-547` | Epic 4 — mais c'est lui qui **exige** `servings > 0` |
| Zone de message accessible | `app/_lib/Notice.tsx` | Ne réécris pas `role="status"` + `aria-live` |
| Soumission avec son `finally` | `app/_lib/useSoumission.ts` | Ne réécris pas la paire `occupe`/`cle` |
| Confirmation en deux temps | `app/foyer/InviteCard.tsx`, `ListeRayons:836-872` | Jamais `window.confirm` |
| Normalisation d'**une ligne** | `lib/texte.ts` | Réutilise — **pas pour le multiligne** (piège n°1) |

### Piège n°1 — `normaliserTexte` DÉTRUIT les retours à la ligne, en silence

**Le piège central.** Le produit a trois champs libres jusqu'ici — prénom, nom de foyer, nom de
rayon — et les trois tiennent sur une ligne. `instructions` est le **premier champ multiligne**, et
le réflexe légitime est de lui appliquer `normaliserTexte`.

**Mesuré le 2026-08-01 :**

```js
normaliserTexte("Étape 1\nÉtape 2\n\nÉtape 3", 4000)  // → "Étape 1Étape 2Étape 3"
/[\p{Cc}]/u.test("\n")                                 // → true
```

`INVISIBLES` (`lib/texte.ts:49-50`) contient `\p{Cc}`, la catégorie « contrôle », qui comprend
U+000A, U+000D et U+0009. **Ce n'est pas un défaut de `lib/texte.ts`** — c'est exactement ce qu'on
veut sur un champ d'une ligne, où un saut de ligne collé est une saisie cassée.

**Ce que ça casse si tu ne fais rien :** l'AC de la story **3.3** — « leur mise en forme est
préservée à la lecture (retours à la ligne / étapes) » — devient **indémontrable**, la mise en forme
ayant été détruite à l'écriture deux stories plus tôt. Aucun signal : ni typage, ni lint, ni test, ni
contrainte. Le texte s'enregistre, il s'affiche, il est simplement aplati.

**`normaliserMultiligne`, dans `lib/recettes/saisie.ts` :**

1. `normalize("NFC")` — « Crémerie » en NFD est une chaîne *différente* ;
2. `\r\n` et `\r` isolés → `\n` — un collage depuis Windows ou un PDF transporte des `\r` ;
3. retire les invisibles **sauf `\n`**, par **exclusion**, comme `INVISIBLES_HORS_JOINTURE` le fait
   déjà pour U+200C/U+200D : `/(?!\n)[\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cn}⠀]/gu`.
   ⚠️ **Pas le drapeau `v`** (soustraction d'ensembles) : la cible TypeScript ne l'accepte pas ;
4. borne **en points de code** (`[...net].slice(…)`) — `slice` coupe une paire de substitution en
   deux, et la demi-paire n'est pas du JSON valide : Postgres rend `22P02`, non traduit, donc
   « Réessaie » en boucle. Atteint pour de vrai sur le champ nom de rayon le 2026-07-29 ;
5. `trim()` **les bords seulement** : « Étape 1\n\nÉtape 2 » est une mise en forme voulue.

⚠️ **Titre et description gardent `normaliserTexte`.** Une description est une phrase ; lui donner
des sauts de ligne créerait un second champ multiligne sans besoin. *(Si tu juges le contraire à
l'implémentation, applique `normaliserMultiligne` aux deux — mais écris pourquoi.)*

⚠️ **Aucune contrainte de non-vacuité sur `description` ni `instructions`** : les deux sont
nullables, et l'AC de la 3.3 prévoit explicitement une recette sans description ni instructions.
`normaliserMultiligne` rend `null`, **jamais `""`** — sinon « vide » et « absent » coexistent dans la
colonne, deux états que l'écran de lecture devrait ensuite distinguer pour rien.

### Piège n°2 — Ni `title` ni `servings` ne sont contraints, et les deux comptent

`title text not null` n'interdit **pas** la chaîne vide ni une chaîne d'invisibles. C'est la
**quatrième** contrainte de cette forme, après `display_name`, `household_name` et `aisle_name` :
un champ libre partagé par tout le foyer descend en base, là où vivent les règles (AD-1/AD-2). Le
contrôle navigateur ne voit pas les appels REST directs — les tests d'isolation en font.

`servings` accepte 0 et le négatif, avec la conséquence décrite sous les AC : quantités
silencieusement nulles, ou négatives, en Epic 4. `min={1}` sur un `<input>` n'est pas une frontière.

⚠️ **Recopie la regex de `20260729095923_require_non_blank_aisle_name.sql:80` À LA LETTRE.**
Ne la réécris pas. Elle a été fausse **deux fois** : `btrim(name) <> ''` ne retirait que l'espace
ASCII ; une énumération de seize points de code laissait passer U+115F et U+1160.

**Éprouvée sur `recipes` le 2026-08-01, stack local, huit contrôles :**

| Cas | Attendu | Mesuré |
|---|---|---|
| `'Curry de pois chiches'` | accepté | accepté |
| `''` · `E'\t'` · `U&'\3164'` | refusés | `23514 recipes_titre_non_vide` (les trois) |
| `'🍛 Curry'` | accepté | accepté |
| `servings = 0` · `servings = -2` | refusés | `23514 recipes_servings_positif` |
| `instructions` sur 3 lignes | 3 `\n` conservés | 3 `\n`, 24 octets |

*Base remise à l'état du dépôt après la sonde : `pg_constraint` rend 0 pour les deux noms,
`recipes` et `households` rendent 0 ligne.*

### Piège n°3 — La migration s'applique au déploiement, donc le contrôle se fait EN REVUE

Depuis le 2026-07-29, `vercel.json` → `scripts/migrer-au-deploiement.mjs` : **il n'y a plus de
moment « juste avant de pousser »**. Une contrainte qui échoue sur une ligne existante fait échouer
le **déploiement de production**.

```sql
-- Attendu : zéro ligne.
select id, household_id, title, servings from recipes
where servings <= 0
   or regexp_replace(title, '[^[:graph:]]|[…]', '', 'g') = '';
```

**Ce qui est déduit et non mesuré :** aucune surface n'a jamais écrit dans `recipes` — le prototype
qui le faisait a été supprimé à la story 1.1. La production **devrait** contenir zéro recette. Je
n'ai pas d'accès à la production depuis ce dépôt (non lié) ; le stack local en rend 0, ce qui ne
prouve rien sur le distant. **Exécute la requête et écris son résultat dans la PR.**

⚠️ Une seule migration : ne divise pas les deux contraintes en deux fichiers — `db push` n'est pas
atomique sur un lot.

⚠️ **Fusionner n'est plus mettre en ligne.** Le 30/07, une PR fusionnée a vu son déploiement échouer
et la production est restée 23 heures sur le code d'avant, **sans que rien ne le signale**.

### Piège n°4 — `household_id` et `created_by` n'ont pas de défaut

`household_id` est `not null` sans défaut : écris-le à l'insert. Ce n'est **pas** une garde —
`recipes_all` porte `with check`, donc une valeur étrangère est refusée par Postgres. La frontière
est en base (AD-2). Motif exact de `ListeRayons:292-299`.

`created_by` est nullable et sans défaut : **renseigne-le**. `profiles.id` **est** `auth.users.id`
(`initial_schema.sql:31`), donc le `profile.id` de `requireProfile()` est la valeur voulue —
passe-le en propriété, comme `foyerId` l'est déjà à `ListeRayons`. Aucun critère ne le demande, mais
le laisser `null` perdrait définitivement l'information pour les recettes créées d'ici l'Epic 7.
Coût : une ligne.

⚠️ **Ne renseigne PAS `source`** : son défaut `'manual'` est exactement juste. `'claude'` est
l'Epic 7.

### Piège n°5 — `<input type="number">` vide rend `""`, et `Number("")` vaut `0`

Trois pièges empilés sur portions, préparation et cuisson :

1. **Vider le champ rend `""`**, et `Number("")` vaut **`0`** — un champ « cuisson » vidé
   enregistrerait « 0 minute » au lieu de « pas renseigné ». Pour `servings`, `0` est précisément la
   valeur refusée : l'utilisateur verrait une erreur pour avoir **effacé** un champ.
2. **`parseInt("")` rend `NaN`**, et `JSON.stringify({servings: NaN})` rend `{"servings":null}`,
   silencieusement. Sur une colonne `not null` c'est un `23502` que rien ne traduit.
3. **`type="number"` accepte `e`, `+`, `-` et le séparateur décimal local.** « 2e3 » est valide.

D'où `normaliserEntier(saisie): number | null`, testée : `""` → `null` ; `"0"` → `0` (c'est à
l'appelant de refuser 0, pas au normalisateur) ; `"2e3"` → **décide, écris-le, teste-le** ; `"-3"`
→ `-3` ; `"2,5"` → `null` ; `" 4 "` → `4`.

`inputMode="numeric"` en plus de `type="number"` : sur iPhone 15 Pro (référence NFR-1), c'est lui qui
décide du clavier. Et **`tabular-nums` sur tout chiffre affiché** (UX-DR12) — `.hint`, `.notice` et
`.input` ne le portent pas.

### Piège n°6 — `23514` ne suffit plus à dire lequel des deux refus a parlé

`lib/rayons/erreurs.ts` mappe `"23514" → "nom-vide"` **parce qu'`aisles` n'a qu'une contrainte
`check`**. `recipes` en aura deux : le SQLSTATE seul rendrait « Il faut un titre. » à quelqu'un qui
a saisi 0 portion.

**Mesuré via PostgREST le 2026-08-01**, les deux contraintes posées puis retirées :

```json
{"code":"23514","message":"… violates check constraint \"recipes_titre_non_vide\""}
{"code":"23514","message":"… violates check constraint \"recipes_servings_positif\""}
```

Donc : **le SQLSTATE identifie la famille, le nom de contrainte identifie laquelle.** Ce n'est
**pas** un abandon de « SQLSTATE d'abord, texte en repli » — cette règle existe parce que Vercel et
Supabase se déploient séparément, donc il y a toujours une fenêtre où le JS servi ne correspond pas
à la base. Un **nom de contrainte est stable** (c'est déjà ce sur quoi `PAR_MESSAGE` s'appuie) ; une
**phrase française** rédigée dans un corps de fonction ne l'est pas, d'où l'absence de repli textuel
dans `refusOrdre`. **Écris ce raisonnement dans le fichier**, sinon une revue le lira comme une
régression. `23514` sans nom reconnu → `"echec"`, jamais un des deux messages précis.

### Piège n°7 — Deux recettes de même titre, et l'écran qui « bouge tout seul »

`recipes` n'a **aucune** contrainte d'unicité sur `(household_id, title)`, et **on n'en ajoute
pas** : deux « Curry » différents sont légitimes. Conséquence, exactement celle des `sort_order` ex
æquo de `rayonsDuFoyer` :

> *sans second critère de tri, l'ordre de deux ex æquo est celui que Postgres choisit ce jour-là, et
> l'écran « bouge tout seul » d'un rechargement à l'autre.*

D'où `.order("title").order("created_at")`. **Le tri par titre n'est pas servi par
`idx_recipes_household`** (qui est sur `created_at desc`) — assumé et sans portée : un foyer a des
dizaines de recettes, pas des millions, et un répertoire qu'on parcourt à l'œil se range par nom.
**Écris-le**, pour qu'une revue n'y voie pas un oubli.

### Piège n°8 — Le squelette d'AC4, premier `loading.tsx` du dépôt

Aucun n'existe (`git ls-files` le confirme). Trois choses le rendent facile à croire livré :

1. **Il ne s'affiche que si quelque chose l'attend.** En local la page répond en quelques dizaines
   de millisecondes et le squelette **passe invisible**. Bride le réseau, ou intercale un `await`
   temporaire **que tu retires ensuite**, et **regarde-le**.
2. **Ni spinner, ni message.** AC4 dit « un squelette plutôt qu'un écran blanc **ou un message
   d'erreur** » : des blocs à la forme des lignes à venir, mêmes largeurs et hauteurs, pour que
   l'arrivée du contenu ne fasse pas sauter la page.
3. **`prefers-reduced-motion` est déjà couvert** par la règle globale (`globals.css:406-415`), qui
   ramène toute animation à `0.01ms` — donc `animate-pulse` est neutralisé. **Mesure-le** : le
   squelette doit rester **visible** une fois dé-animé (un squelette dont seule l'animation portait
   le contraste devient un aplat invisible).

⚠️ **Couleurs.** La palette Tailwind par défaut est neutralisée (`--color-*: initial`) :
`bg-gray-200` **ne génère rien et échoue EN SILENCE**. Emploie les tokens. Et vérifie **en sombre**,
où `--surface-card` vaut **5 % de blanc** — c'est ce qui a rendu la ligne tirée transparente à la
story 2.2, avec cinq portes vertes et zéro signal.

### Piège n°9 — Une recette introuvable n'est pas une erreur, un uuid mal formé non plus

Trois chemins, tous vers `notFound()` :

1. **L'identifiant n'existe plus** — l'autre membre vient de la supprimer, ou c'est un vieux favori.
2. **Elle appartient à un autre foyer** — la RLS rend **zéro ligne, sans erreur** : lire `data`
   autant qu'`error` (`DisplayNameForm.tsx:70-78`). **`.maybeSingle()`, pas `.single()`** — celui-ci
   transforme zéro ligne en `PGRST116` qu'il faudrait ensuite démêler d'une vraie panne.
3. **Ce n'est pas un uuid** — `/recettes/pizza/modifier` rend **`22P02`**, que rien ne traduit, donc
   « Ça n'a pas marché. Réessaie dans un instant. » : un conseil **qui ne peut pas fonctionner**,
   exactement ce que `project-context.md` interdit. Contrôle la forme côté application avant la
   requête — ce n'est pas une frontière de sécurité, la RLS l'est.

⚠️ **`params` est une `Promise`** : `strictRouteTypes: true` est activé, et son commentaire dit
pourquoi — sans lui, un `params` mal typé produirait un `params.id` valant `undefined` **à
l'exécution**, invisible à `tsc` comme à `next build`.

### Piège n°10 — Le trigger `updated_at`, que `aisles` n'avait pas

`recipes_updated_at before update … set_updated_at()` (`initial_schema.sql:592-594`). **Ne pose pas
`updated_at` à l'`update`** : le trigger l'écrase, et le poser laisserait croire que la valeur
cliente fait autorité — l'inverse de la convention (« `updated_at` **posé serveur** »). `aisles`
n'a pas ce trigger : sur ce point, le motif de `ListeRayons` ne t'aide pas.

### Piège n°11 — La suppression, et la cascade qu'elle déclenche silencieusement

**Pourquoi elle est au périmètre** (§ Décisions, point 2) : créer sans pouvoir supprimer est un
aller simple — un *roach motel*. `/rayons` est l'écran frère « gérer » et il supprime.

**Et pourquoi maintenant plutôt qu'après.** `meal_plan_entries.recipe_id` est `on delete cascade`
(`:178`) : supprimer une recette la **retire silencieusement des menus planifiés**. Tant que la
grille du menu n'existe pas (story 3.5), il n'y a **rien à avertir** — c'est ce qui rend la
suppression bon marché aujourd'hui et chère demain.

⚠️ **Contrepartie obligatoire, Task 7** : consigner dans `deferred-work.md`, à l'intention de la
**story 3.6**, que la confirmation devra dire « elle est au menu de mardi ». Sans cette note, la 3.6
hérite d'une suppression qui vide des cases sans le dire. C'est le mécanisme déjà employé pour les
arêtes qu'une story laisse à la suivante (`deferred-work.md:374`, refermée par la 2.2).

`grocery_list_items.recipe_id` est `on delete set null` (`:202`) : un article issu d'une recette
supprimée **perd sa provenance** sans disparaître. Correct, sans portée avant l'Epic 4.

### Piège n°12 — Les saisies non enregistrées, et le trou qui reste ouvert

**Sévérité 3 — un échec de tâche, pas une gêne.** Trente lignes d'instructions, un clic sur le
retour, tout est perdu sans un mot.

**Mesuré le 2026-08-01** dans `node_modules/next/dist/client/link.d.ts:4-5, :89` sur
`next@16.2.12` : `onNavigate?: (event: { preventDefault: () => void }) => void` **existe** sur
`<Link>`. Il est dans les types installés, donc `tsc` couvre son nom et sa forme.

| Chemin de sortie | Couvert par |
|---|---|
| Rechargement, fermeture d'onglet, URL externe | `beforeunload` |
| Clic sur `← Tes recettes` (un `<Link>`) | `onNavigate` + `preventDefault()` |
| `router.replace` après création, retour après suppression | **c'est nous** — désarme avant |
| **Bouton Retour du navigateur** | **RIEN** |

⚠️ **Le bouton Retour reste découvert, et il ne faut pas essayer de le couvrir.** La parade connue
(`history.pushState`) **casse le contrat du navigateur** — le remède serait pire que le mal. **Écris
la limite, ne la tais pas**, comme la story 2.2 l'a fait pour le défilement en bord d'écran.

⚠️ **Arme la garde seulement si un champ a changé.** Une garde qui se déclenche à chaque sortie
interrompt sans cause — motif sombre, et les navigateurs ignorent de toute façon un `beforeunload`
sans interaction préalable.

⚠️ **Désarme-la avant les navigations que le code déclenche lui-même.** Sinon une suppression
**réussie** annoncerait « tu as des modifications non enregistrées » : un message faux, qui fait
douter d'une écriture qui a marché.

### Piège n°13 — Trois petites choses qui se répètent d'une story à l'autre

**Les régions de statut.** Deux défauts trouvés **deux fois de suite** sur `/rayons` étaient des
messages rendus hors de la zone visible ; la première correction en avait créé deux pour trois
surfaces. Ici : **une région par surface de soumission**, montée **en permanence** (pas
conditionnellement — une région annoncée de façon fiable est une région qui existait déjà avant que
le message n'y arrive), **au-dessus** du bouton donc **avec `reserve`**. `/recettes` en a une (la
création), `/recettes/[id]/modifier` en a **deux** (enregistrer, supprimer).

**Le `<textarea>`, qui n'existe pas dans la couche de composants.** **N'ajoute pas de classe
`.textarea`** sauf usage double — « une classe sans appelant est une dette » est écrit dans
`globals.css`, et la story 2.2 a conclu en le laissant intact. Compose : `className="input min-h-40"`
plus `rows`, plus `resize-y`. ⚠️ **`min-h-40` gagne sur le `min-h-11` de `.input`** parce que
`.input` vit dans `@layer components` et l'utilitaire dans `utilities`, qui vient après — question
d'ordre de couche, pas de spécificité. C'est déjà ce dont dépendent `.input text-center` et
`.btn-primaire flex-1` : **ne « corrige » pas ça avec un `!important`**.

**Les bornes, dont la troncature ne doit pas être muette.** 80 / 300 / 5000. Le défaut n'est pas la
valeur mais le comportement à la limite : `maxLength` **arrête la frappe sans rien dire**. Le projet
a déjà tranché ce cas — *« Refuser plutôt que réduire en silence »* (`ListeRayons.tsx:276`), après
qu'un champ icône ait enregistré « F » pour « Fromages » sans un mot. **Prévenir avant plutôt que
récupérer après** : un `hint` sous la description pose l'attente ; pas de compteur permanent, ce
serait du bruit. ⚠️ `maxLength` compte des unités UTF-16 et **NFC peut ALLONGER** (39 unités saisies
en font 77 une fois composées) : le bornage réel se fait à la soumission, en points de code.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Les ingrédients (ajout, édition, réordonnancement, unités fermées) | **Story 3.2** |
| L'écran de **lecture** d'une recette | **Story 3.3** — ici, seulement l'édition |
| Étiquettes, filtre, recherche | **Story 3.4** — ne touche pas à `tags` |
| Grille du menu, assignation | **Stories 3.5 et 3.6** |
| L'avertissement « cette recette est au menu » avant suppression | **Story 3.6** — rien à avertir encore (piège n°11) |
| La génération de la liste depuis le menu | **Epic 4** (FR-16/17) |
| Colonnes nutritionnelles, `products` / `product_id` | **v2 produit** — nommément déféré dans l'Architecture Spine |
| Realtime sur les recettes | **Epic 4** (AD-8). Ici, l'autre membre voit au rechargement |
| Une corbeille, un `undo` de suppression | **jamais sans décision** — pas de tombstone sur `recipes` ; AD-3 n'en prescrit que pour `grocery_list_items` |
| Couvrir le **bouton Retour** contre la perte de saisie | **jamais** — la parade casserait le contrat du navigateur. Limite **écrite** (piège n°12) |
| `unique (household_id, title)` | **jamais** sans décision — deux « Curry » sont légitimes (piège n°7) |
| Markdown, éditeur riche, prévisualisation | **jamais** — NFR-10, et l'AC de la 3.3 bannit le balisage brut |
| Bibliothèque de formulaire, de validation, de test de composants | **jamais** — NFR-10 |
| La `Content-Security-Policy` | **Epic 6**, avec la story PWA (§ Décisions, point 4) |
| Corriger le `← Retour` de `/rayons` | *hors périmètre* — à consigner, pas à traiter ici |
| Le `set search_path` manquant sur `resolve_aisle_id` | *hors périmètre* — réservé à la story qui touche cette fonction. Ce n'est toujours pas celle-ci |

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre de l'écran | « Tes recettes » | « Répertoire de recettes » · « Gestion des recettes » |
| Répertoire vide | « Tu n'as encore aucune recette. » + « Ajoutes-en une, et elle servira à remplir le menu. » | « Aucun enregistrement trouvé » |
| Créer | « Ajouter une recette » | « Créer un nouvel élément » |
| Champ portions | « Pour combien de personnes » | « Servings » · « Nombre de portions (int) » |
| Champs temps | « Préparation (min) » · « Cuisson (min) » | « prep_time_min » · « Temps 1 / Temps 2 » |
| Champ instructions | « Comment on la fait » | « Instructions (texte libre) » |
| Champ facultatif | « Description (facultatif) » | un `*` sur le requis, sans légende |
| Sous la description | « Deux ou trois phrases. » | « 300 caractères maximum » |
| Lien de retour | « ← Tes recettes » | « ← Retour » · « Précédent » |
| Enregistré | « C'est noté. » | « Enregistrement réussi » |
| Titre vide | « Il faut un titre. » | « Le champ title est requis » |
| Portions ≤ 0 | « Il faut au moins une personne. » | « servings doit être > 0 » |
| Supprimer — le bouton | « Supprimer cette recette » | « Supprimer » seul · l'icône poubelle nue |
| Supprimer — la conséquence | « Elle disparaît de ton répertoire. » | « Action irréversible » · confirmshaming |
| Supprimé | « La recette est partie. » | « Suppression effectuée avec succès » |
| Saisies non enregistrées | « Tu as des modifications pas encore enregistrées. » | « Unsaved changes » |
| Recette disparue | « Cette recette n'existe plus. » | **jamais** « Réessaie » (condition non transitoire) |
| Échec générique | « Ça n'a pas marché. Réessaie dans un instant. » | le message brut de la base |
| Bouton occupé | `LIBELLE_OCCUPE` (`app/_lib/libelles.ts`) | une septième formulation en dur |

**Pas d'abricot sur ces écrans.** UX-DR2 le réserve à l'action courses ; constituer un répertoire est
de la préparation. Seul l'anneau de focus reste légitime, et c'est déjà une règle globale.

**DESIGN.md ne spécifie pas ces écrans.** Il place nommément « l'éditeur de recettes et grille de
menu (FR-15/18/51) » hors de son périmètre : *« ils héritent des tokens ci-dessus mais leur
composition n'est pas spécifiée ici »* (`:329`). **Compose avec ce qui existe. N'invente pas un
langage visuel et ne réclame pas une maquette qui n'existe pas.**

**La largeur, elle, est prescrite ailleurs.** `/rayons` et `/foyer` sont en `max-w-sm` parce que ce
sont des listes de lignes courtes. Pour ces écrans-ci, `DESIGN.md:249` et `EXPERIENCE.md:158` disent
l'inverse : *« Le menu et les recettes (surface web) peuvent respirer au grand écran »* — seul
l'écran liste porte la contrainte du magasin. **`max-w-2xl` pour le formulaire**, et vérifie les
200 % de zoom (UX-DR11 : colonne unique, aucun défilement horizontal).

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — la règle métier vit en Postgres. Les deux invariants de la Task 1 vont **en
  base**, jamais dans la vigilance du formulaire. Jamais de `SUPABASE_SERVICE_KEY`
- **AD-13** — **client-direct**, et le critère est la **cause** : Server Action si et seulement si
  un secret serveur est exigé, ou si la conséquence doit paraître dans un rendu serveur. Ni l'un ni
  l'autre ici — motif de `DisplayNameForm` et de `ListeRayons`
- **AD-16** — recettes **partagées entre tous les membres** (FR-43). **Le foyer est symétrique**
  (décision du 2026-07-30) : n'invente aucun contrôle d'accès par membre — `profiles` n'a pas de
  colonne de rôle, la RLS est par foyer, et un contrôle applicatif serait contournable à un appel
  REST près
- **AD-17** — l'isolation se prouve par un test **exécuté** (Task 8, job CI `isolation`)
- **AR-MIGRATIONS** — strictement additive ; un fichier appliqué ne se modifie **jamais** ;
  horodatage postérieur à tous les existants ; requête de contrôle en en-tête
- **UX-DR11 / UX-DR12** — cibles ≥ 44px, contraste AA **sur les fonds réels**, anneau de focus,
  `prefers-reduced-motion`, 200 % de zoom ; tutoiement, mots bannis, `tabular-nums`
- **NFR-3** — le « pas de défilement horizontal » porte sur l'écran **liste** et la **grille du
  menu** (3.5). Ici on peut respirer — mais le 200 % de zoom reste dû
- **NFR-5 / NFR-8 / NFR-10** — isolation au niveau de la **donnée** ; jamais de message technique
  brut ; **aucune dépendance nouvelle**

### Standards de test

Trois familles, elles ne se remplacent pas. **Comptes rapportés par la story 2.2 sur `e393d94`**,
non re-mesurés ici :

1. **`npm test`** — `node:test`, glob `lib/**/*.test.ts`, **96/96**. Couvre le pur : les trois
   normalisateurs, `refusRecette`
2. **`npm run test:isolation`** — glob `supabase/tests/**/*.test.ts`, exige un stack local debout et
   **lève** s'il est absent, **27/27**. C'est là que va la preuve de NFR-5 sur `recipes` et celle des
   deux contraintes
3. **Le manuel** — le JSX reste intestable sans dépendance. Les deux thèmes, le focus dans le DOM,
   le 200 % de zoom, le squelette qui s'affiche vraiment : rien d'automatisable, et **c'est la seule
   famille qui a attrapé le défaut décisif des trois derniers epics**

**TDD sur `lib/`, pas sur le JSX** : `lib/recettes/saisie.ts` s'écrit test d'abord, **phase rouge
constatée**.

⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers avant de lancer —
mais ils comptent un *dossier*, pas ton fichier. **Tout nouveau contrôle automatique doit répondre à
« que se passe-t-il s'il ne trouve rien à contrôler ? »**

⚠️ **Vérifie les dents.** Un test d'isolation qui ne tombe jamais ne prouve rien.

### Project Structure Notes

```
app/
  recettes/
    page.tsx                  +  répertoire, création AU TITRE SEUL, état vide, requireProfile
    loading.tsx               +  LE PREMIER DU DÉPÔT — squelette (piège n°8)
    ListeRecettes.tsx         +  répertoire + formulaire d'ajout (motif ListeRayons:988-1044)
    [id]/modifier/page.tsx    +  les cinq autres champs, la suppression, la garde des saisies.
                                 `params` est une Promise (piège n°9)
  page.tsx                    ~  lien « Tes recettes » ; ET la phrase « les recettes … arrivent »
                                 qui devient FAUSSE (Task 7)
  rayons/page.tsx             INCHANGÉ — son « ← Retour » n'est pas faux dans SON contexte
lib/
  recettes/
    saisie.ts + .test.ts      +  MAX_*, normaliserTitre, normaliserMultiligne, normaliserEntier
    erreurs.ts + .test.ts     +  refusRecette — nom de contrainte pour 23514 (piège n°6)
    recettes.ts               +  Recette, recettesDuFoyer, recetteParId — client EN PARAMÈTRE
  texte.ts                    INCHANGÉ — `normaliserTexte` reste juste pour les champs d'UNE ligne.
                                 Le multiligne est un BESOIN NOUVEAU, pas un défaut de ce fichier
  supabase/types.ts           ~  régénéré — diff attendu vide ou quasi vide
supabase/
  migrations/<ts>_require_valid_recipe_fields.sql  +  deux `check`, requête de contrôle en tête
  tests/isolation.test.ts     ~  + `recipes`, jamais éprouvée jusqu'ici
  tests/contraintes.test.ts   ~  + l'accord normaliserTitre ↔ recipes_titre_non_vide, servings
next.config.ts                ~  SON COMMENTAIRE SEUL (:24-28) — échéance CSP → Epic 6.
                                 Aucun en-tête ajouté
deferred-work.md              ~  deux entrées : « au menu » pour la 3.6, CSP re-déférée
docs/migrations.md            INCHANGÉ — aucune fonction ajoutée, le compte « huit » tient
app/globals.css               INCHANGÉ par défaut — compose avec `.input` (piège n°13)
app/_lib/*                    INCHANGÉ — Notice, useSoumission, libelles, garde
proxy.ts                      INCHANGÉ — matcher attrape-tout. VÉRIFIE-le, ne le touche pas
package.json                  INTACT — aucune dépendance. Ni `engines`, ni `.node-version`
```

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session** : ses sept règles de méthode, ses
contraintes techniques inhabituelles et son tableau « motifs à reprendre » ne sont **pas recopiés
ici**. Trois d'entre elles mordent particulièrement sur cette story :

- **Ne consigner comme vérifié que ce qui a été exécuté**, en citant la commande. Une déduction
  s'écrit « déduit ». Cette story distingue les deux à chaque fait ; fais pareil
- **Une énumération ne peut pas gagner contre une catégorie** — directement applicable au prédicat
  multiligne du piège n°1, qui s'écrit **par exclusion**, jamais en listant ce qu'on garde
- **Un invariant entre deux fichiers se mesure** — d'où l'accord `normaliserTitre` ↔ contrainte
  dans `contraintes.test.ts`, et non un commentaire qui l'affirme

**Une case vide honnête vaut mieux qu'une case cochée à tort.** Les stories 1.5 à 2.2 ont toutes
laissé des sous-tâches non cochées avec leur raison écrite ; la revue l'a préféré à chaque fois.

**Pièges d'outillage** : purger `.next` avant de conclure à une régression du `typecheck`, et
redémarrer le serveur après ; `npm run build | grep …` ne rend jamais la main — rediriger vers un
fichier.

### Intelligence git

`e393d94` est la tête de `feat/rayons-reordonner-parcours` — **la story 2.2, encore en revue**
(PR #15 ouverte au 2026-08-01). `git status --short` est vide.

⚠️ **Branche depuis `main`, pas depuis `e393d94`.** La 2.2 n'est pas fusionnée ; s'en dériver ferait
porter à ta PR ses 1 000 lignes et sa migration. Ta migration doit néanmoins porter un horodatage
**postérieur** à `20260731062945`, sans quoi `db push` refuserait après fusion des deux — et **tous**
les déploiements suivants échoueraient jusqu'à intervention manuelle.

⚠️ **`main` est protégée** depuis le 2026-07-29 : `verify` et `isolation` requis, `strict`,
administrateurs soumis, push direct et forcé interdits. Depuis `vercel.json`, un commit sur `main`
applique les migrations en production.

⚠️ **Les portes ne voient pas le déploiement.** `engines: "24.x"` et `.node-version` ont été épinglés
après qu'un `>=25.0.0` a tué la production avec une CI verte. **Cette story ne touche ni l'un ni
l'autre.**

Conventional Commits, corps en français ; branche → PR → **squash merge** CI verte. Dix migrations
existent ; la tienne sera la **onzième**.

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`,
`typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**pas
de 10**). Node 24.

### Environnement de test

Stack local **debout** au moment où cette story est écrite — `npx supabase status` répond (mesuré le
2026-08-01). Ports en 5532x : API `55321`, base `55322`, Studio `55323`, courriels `55324`.

**État mesuré le 2026-08-01 après la sonde** : `recipes` = 0 ligne, `households` = 0 ligne, aucune
des deux contraintes candidates dans `pg_constraint`. Tu pars d'une chaîne propre.

⚠️ **`localhost:3333`, jamais `127.0.0.1:3333`** — Next 16 bloque ses ressources de développement en
cross-origin, l'hydratation échoue, les formulaires partent en GET natif, et **rien ne le dit dans
le navigateur**.

⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION.** Un écran qui écrit se relit
**sur le stack local**, et **AC1 à AC3 n'y sont pas démontrables** — la migration de la PR n'y est
pas appliquée.

⚠️ **Le thème se contrôle au réglage système**, pas dans les outils de développement
(`globals.css:68` lit `prefers-color-scheme`).

✅ Un compte peut naître en local depuis la story 2.1 : lien magique → Mailpit (`55324`) →
`/auth/callback` → `/onboarding`. Il reste une action de l'Epic 1 entamée — `/onboarding` vu en
**sombre** seulement ; si tu crées un compte de test, **dis-le** et ça ferme l'action.

### References

- [Source: epics.md#Story-3.1] — user story et 4 AC, verbatim ; [#Epic-3], [#FR-18], [#FR-43],
  [#FR-51] (→ 3.4), [#NFR-3], [#NFR-10], [#UX-DR11], [#UX-DR12]
- [Source: …/ARCHITECTURE-SPINE.md] — AD-1, AD-2, AD-6, AD-13 (critère de **cause**), AD-16 (foyer
  symétrique), AD-17, AR-MIGRATIONS ; § Consistency Conventions ; § Deferred (v2 : Open Food Facts,
  macros)
- [Source: …/DESIGN.md:329] — ces écrans **hors périmètre de composition** ; [:249] et
  [EXPERIENCE.md:158] — « peuvent respirer au grand écran » ; [EXPERIENCE.md:70] — le répertoire
- [Source: _bmad-output/project-context.md] — **chargé à chaque session, c'est lui qui fait foi**
- [Source: initial_schema.sql] — `recipes` (`:133-151`), index (`:153-154`), `recipes_all`
  (`:294-296`), `generate_grocery_list_from_menu` (`:517-572`, la division `:546`), trigger
  (`:592-594`), `profiles.id references auth.users` (`:31`), cascades (`:178`, `:202`)
- [Source: 20260729095923_require_non_blank_aisle_name.sql:80] — **la regex à recopier à la lettre**
- [Source: lib/texte.ts:49-59] — `INVISIBLES` contient `\p{Cc}` ; `INVISIBLES_HORS_JOINTURE`, **le
  motif d'exclusion à reprendre** ; [:87-95] — bornage en points de code, NFC qui allonge
- [Source: lib/rayons/rayons.ts:24-51] — tri secondaire, ex æquo, zéro ligne ≠ erreur ;
  [lib/rayons/erreurs.ts:19-63] — SQLSTATE d'abord, et pourquoi aucun repli textuel
- [Source: app/rayons/ListeRayons.tsx] — `:56-91` régions de statut · `:282-312` insert
  client-direct · `:671-675` focus après suppression · `:836-872` confirmation en deux temps ·
  `:988-1044` **le formulaire d'ajout dont la création s'inspire** · `:276` refuser plutôt que réduire
- [Source: app/foyer/DisplayNameForm.tsx:70-78] — lire `data` autant qu'`error`
- [Source: docs/migrations.md] — additivité, cycle par le déploiement, `gen types --local`
- **Sonde exécutée le 2026-08-01** — les deux contraintes posées sur `recipes`, huit contrôles SQL +
  deux appels PostgREST mesurant la forme de l'erreur `23514` ; base remise à l'état du dépôt et
  vérifiée dans `pg_constraint`
- **Mesures du 2026-08-01** — `normaliserTexte` aplatit les retours à la ligne ;
  `/[\p{Cc}]/u.test("\n") === true` ; `onNavigate` présent dans
  `node_modules/next/dist/client/link.d.ts:4-5, :89`

---

## Décisions de Florian — 2026-08-01

Cinq questions tranchées **avant démarrage**, au terme d'un audit d'heuristiques d'utilisabilité,
puis le périmètre dégonflé d'une route. Elles ne se rouvrent pas en revue sans un fait nouveau.

> Le design initialement prescrit était noté **6/10** au diagnostic. Trois lignes échouaient : « peut-on
> revenir en arrière ou annuler ? » (**sévérité 3**), « sait-on où on est ? » et « la navigation
> est-elle claire ? » (sévérité 2). Les décisions ci-dessous ferment les trois — **elles sont le
> chemin vers 10/10, pas des préférences.**

**1. Deux routes, et la création au titre seul.** `/recettes` (répertoire + ajout à un champ) et
`/recettes/[id]/modifier`. La story 3.3 insérera `/recettes/[id]` (lecture).

*L'inline intégral a été écarté* parce qu'une recette en cours d'édition **n'aurait pas d'URL** — ni
favori, ni partage, ni retour — et que le bouton Retour quitterait l'écran au lieu de refermer le
panneau, ce qui rompt le contrat du navigateur. S'y ajoute le récidiviste maison : `/rayons` a
produit **quatre** défauts de région de statut, et un panneau inline portant un `<textarea>` de
trente lignes garantirait le cinquième.

*Le troisième écran (`/recettes/nouvelle`) a ensuite été retiré en dégonflant* : un formulaire de six
champs dupliqué entre création et édition, ou partagé avec un mode, pour un écran qu'on traverse une
fois. La création à un champ **réutilise le formulaire d'ajout de `/rayons` tel quel** et supprime la
question. ⚠️ **Coût assumé, dit d'avance : AC1 se lit alors en deux temps** (voir l'encadré sous les
AC).

⚠️ **Non négociables** : champs **facultatifs** marqués et non le requis ; `← Tes recettes` comme
lien de retour.

**2. La suppression entre dans le périmètre.** *(Contre la recommandation initiale de la story.)*
Créer sans pouvoir supprimer est un aller simple. `/rayons`, l'écran frère « gérer », supprime déjà —
deux écrans de gestion qui divergent font réfléchir, et le motif existe, donc rien n'est inventé. Et
**c'est maintenant que c'est le moins cher** : la cascade sur `meal_plan_entries` n'a rien à avertir
tant que la grille du menu n'existe pas. ⚠️ Contrepartie obligatoire au piège n°11.

**3. Deux champs de temps.** « Préparation » et « Cuisson », facultatifs. C'est ce que le schéma
modélise et ce que dit un livre de cuisine : temps actif et temps passif sont deux choses. Un champ
unique ferait penser *« temps de quoi ? »*. Enjeu faible — sévérité 1 si c'est un mauvais choix.

**4. La CSP est re-déférée — à l'Epic 6, avec la story PWA.** Le cadre ne tranche pas une question de
sécurité. Il dit une chose : une CSP mal réglée rend un **écran blanc sans message** — sévérité 4,
tâche bloquée — ce qui interdit de la prendre en passant dans une story d'écran. ⚠️ **Re-déférer ne
suffit pas : réécris l'entrée dans les DEUX fichiers** (`deferred-work.md:139` et
`next.config.ts:24-28`). L'échéance n'est pas arbitraire — la CSP exige un nonce **dans le proxy**,
que l'Epic 6 rouvre déjà pour les icônes PWA.

**5. Bornes tenues, troncature non muette.** 80 / 300 / 5000, avec le `hint` sous la description.
Voir piège n°13.

**6. La garde des saisies non enregistrées entre dans le périmètre.** *(Sortie de l'audit, hors des
cinq questions — c'était le dernier défaut de sévérité 3.)* Le bouton Retour du navigateur reste
**délibérément découvert**. Voir piège n°12.

---

## Note de séquence

Story créée **hors de l'ordre du sprint** : l'Epic 2 n'est pas clos. La 2.2 est en `review` (PR #15,
trois vérifications restant avant fusion), et les stories **2.3** et **2.4** sont en `backlog`.

Ce n'est pas un empêchement — l'Epic 3 ne dépend d'aucune des deux, et `epic-3` passe en
`in-progress` comme la première story d'un epic le fait. Écrit ici pour que ce soit un choix visible
et non un oubli.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

#### Vérification (2026-08-01) — les six portes

| Porte | Commande | Résultat |
|---|---|---|
| Typage | `npm run typecheck` | ✅ |
| Lint | `npm run lint` (`--max-warnings 0`) | ✅ |
| En-têtes de migration | `npm run check:migrations` | ✅ 10 migrations, 8 avec requête, 2 exemptées, **0 sans** |
| Unitaires | `npm test` | ✅ **103/103** (72 avant, **31 ajoutés**) |
| Isolation | `npm run test:isolation` | ✅ **34/34** (20 avant, **14 ajoutés**) |
| Build | `npm run build` | ✅ `/recettes` et `/recettes/[id]/modifier` en dynamique (ƒ) |

#### Les dents des tests, vérifiées par mutation

Un test qui ne tombe jamais ne prouve rien. Trois mutations jouées sur la base locale, puis
annulées :

| Mutation | Attendu | Mesuré |
|---|---|---|
| `drop constraint recipes_servings_positif` | des tests tombent | **34 → 32** (2 tombent) |
| + `drop constraint recipes_titre_non_vide` | davantage tombent | **34 → 30** (4 tombent) |
| `refusRecette` : mapper `servings_positif` sur `titre-vide` | des tests tombent | **103 → 100** (3 tombent) |

⚠️ **Une quatrième mutation n'a rien fait tomber, et c'est moi qui avais tort.** Retirer le
`with check` de `recipes_all` a laissé 34/34. Ce n'est pas un test sans dent : pour une politique
`FOR ALL`, **Postgres réutilise l'expression `using` comme expression de contrôle quand `with check`
est omise** — vérifié dans `pg_policy`, les deux colonnes rendent la même expression. La mutation
était donc un no-op. Rejouée en `with check (true)`, une vraie ouverture : **exactement un test
tombe**, « A ne peut pas poser une recette dans le foyer de B ». La dent existe.

#### La regex recopiée « à la lettre », et le doute qu'elle a levé

`20260729095923:80` contient les octets ASCII `\`, `u`, `0`, `3`, `4`, `F`… et
`standard_conforming_strings` vaut `on`. La lecture naïve — « ces backslashes ne sont donc pas
interprétés, la classe contient des caractères ASCII et un intervalle `B-\` » — est plausible et
**fausse** : c'est l'analyseur d'**expressions rationnelles** de Postgres qui les interprète, où
`\uwxyz` désigne un point de code, y compris dans une classe.

**Mesuré par insertions réelles dans `aisles`** (la contrainte étant déjà en base) : 7 noms normaux
acceptés — « Boucherie », « BIO », « BOB », « CAVE », « BAZAR », « ABBA », « SURGELÉS » — et 8
invisibles refusés — U+034F, U+3164, U+115F, U+1160, U+2800, U+FE0F, tabulation, chaîne vide.
**15 cas sur 15.** La regex de la nouvelle migration est ensuite **extraite du fichier par script**,
jamais retapée, et l'identité des deux motifs est contrôlée octet à octet.

#### Parcours à l'écran (2026-08-01) — stack local, `localhost:3333`, les deux thèmes

Compte créé par le vrai chemin : `/login` → Mailpit (55324) → `/auth/callback` → `/onboarding`.

| Geste | Attendu | Mesuré |
|---|---|---|
| `/recettes` sur un foyer neuf | état vide lisible | ✅ « Tu n'as encore aucune recette. » |
| Créer au titre seul | atterrit sur l'édition | ✅ `/recettes/<uuid>/modifier`, `servings` = 2 (défaut) |
| Remplir les 6 champs, enregistrer | « C'est noté. » | ✅ au-dessus du bouton, pas en tête de page |
| **Instructions sur 3 lignes → base** | les `\n` survivent | ✅ **3 sauts conservés**, 103 octets |
| `created_by` | renseigné | ✅ non nul |
| `updated_at` | posé par le trigger | ✅ `updated_at > created_at` |
| Lien de retour, formulaire modifié | intercepté | ✅ « Tu as des modifications pas encore enregistrées. » + « Partir sans enregistrer » / « Rester » |
| Portions à 0 | refusé | ✅ **bloqué par le `min={1}` du navigateur**, avant mon code |
| Cuisson = « abc » | refusé | ✅ Chrome refuse la frappe, la valeur reste vide |
| **Cuisson = « 2e3 »** | refusé par mon code | ✅ Chrome le tient pour **valide** (`value:"2e3"`, `badInput:false`, `checkValidity():true`) → il atteint `normaliserEntier` → « Les temps s'écrivent en minutes, en chiffres. » |
| Titre = trois espaces | refusé | ✅ passe le `required`, puis « Il faut un titre. » |
| `/recettes/pizza/modifier` | `notFound()` | ✅ « Il n'y a rien ici. », aucun message technique |
| `/recettes/<uuid inexistant>/modifier` | `notFound()` | ✅ idem |
| Recette supprimée pendant l'édition | « Cette recette n'existe plus. » | ✅ et le DOM confirme **3 régions `role=status`, une seule porteuse de texte** |
| Supprimer par l'interface | confirmation en deux temps puis retour | ✅ « Confirmer / Non » + « Elle disparaît de ton répertoire. » |
| Squelette de chargement | s'affiche vraiment | ✅ **vu dans les deux thèmes**, délai temporaire de 4 s intercalé puis **retiré et vérifié** |
| Zoom 200 % | aucun débordement horizontal | ✅ `scrollWidth === clientWidth` (1895) |
| Largeur téléphone (390 px) | les 3 champs passent à la ligne | ✅ mesuré : portions+préparation sur une ligne, cuisson sur la suivante, aucun débordement |

**Les deux thèmes au réglage système** (`osascript`), remis en clair après.

#### Trois erreurs de méthode de ma part, consignées plutôt que tues

1. **`getComputedStyle` rend un objet VIVANT.** J'ai lu `animationName` après avoir muté
   `style.animation`, et j'ai conclu que `animate-pulse` ne produisait aucune animation. Faux :
   remesuré proprement, l'animation `pulse` de 2 s est bien là. La conclusion utile tient quand
   même — **animation retirée, l'opacité vaut 1**, donc le squelette reste visible quand
   `prefers-reduced-motion` neutralise la durée. ⚠️ Ce dernier point est **déduit** de la règle
   globale de `globals.css` et de l'opacité mesurée sans animation ; `prefers-reduced-motion`
   n'était **pas actif** sur ce poste, donc le chemin réel n'a pas été observé.
2. **J'ai cru un instant que « Entrée ne soumet pas le formulaire ».** C'était le focus qui n'avait
   pas pris, pas le code : une fois le focus vérifié, Entrée crée bien la recette. Défaut rapporté à
   tort évité de justesse.
3. **J'ai affiché une chaîne de connexion de production avec son mot de passe** en inspectant
   `.env.local`. Erreur de manipulation sur un fichier que je savais sensible — **le mot de passe
   Supabase est à faire tourner**.

#### Pièges d'outillage rencontrés, à connaître

- ⚠️ **`.env.local` pointe sur la PRODUCTION.** Basculé sur le stack local le temps du parcours,
  **restauré à l'identique, SHA-256 comparé** (`8aa793a6…` avant et après, `shasum -c` OK). Sans
  cette bascule, le parcours aurait écrit de vraies recettes dans le foyer de Florian — et la
  migration n'y étant pas appliquée, sans aucune des deux contraintes.
- ⚠️ **Après un `supabase db reset`, Kong garde l'ancienne adresse du conteneur d'authentification.**
  Symptôme : `AuthRetryableFetchError`, 25 tests d'isolation en échec, `/auth/v1/health` en **502**
  alors que le conteneur `auth` est sain et que ses journaux sont normaux. Cause : `kong` tournait
  depuis 30 h, `auth` venait de redémarrer. **`docker restart supabase_kong_nutriclaude`** — 34/34
  rétablis en 2 secondes. Ça ressemble à une régression du code et ça n'en est pas une.
- Le port 3333 était déjà occupé par un serveur de développement portant l'**ancien** `.env.local` :
  `EADDRINUSE` silencieux dans le journal, page injoignable. Arrêté, `.next` purgé, relancé.

### Completion Notes List

**Les neuf tâches sont livrées, à trois sous-tâches près, laissées vides avec leur raison.**
Une migration additive, aucune migration existante modifiée, **aucune dépendance ajoutée**,
`app/globals.css`, `proxy.ts`, `docs/migrations.md` et `package.json` intacts.

**Le piège central était bien là où la story le disait.** `normaliserTexte` aplatit les retours à la
ligne (`INVISIBLES` contient `\p{Cc}`, donc U+000A). `lib/texte.ts` reçoit donc une fonction sœur,
`normaliserMultiligne`, **posée juste à côté d'elle** — les séparer dans deux fichiers ferait
resurgir le piège au premier développeur qui choisirait la mauvaise. Le premier test du fichier
épingle le comportement de `normaliserTexte` lui-même, pour que la raison d'être des deux fonctions
se lise sans chercher.

⚠️ **Écart assumé à la story sur ce point :** les Project Structure Notes annonçaient
`lib/texte.ts INCHANGÉ`. Il est modifié — par ajout seul, `normaliserTexte` n'est pas touchée. La
raison est celle ci-dessus, et elle vaut mieux que la lettre de la note.

**Deux écarts mineurs de plus, tous deux vers moins de code :**

- `RefusRecette` ne porte **pas** `"disparue"`, contrairement à ce que la Task 3 énonçait :
  `refusRecette` ne peut jamais le rendre — c'est l'appelant qui le décide en voyant zéro ligne.
  L'inscrire dans le type de retour aurait été un mensonge de typage. Le motif est celui de
  `RefusRayon`, dont `Cle` est plus large côté écran.
- La propriété `foyerId` du formulaire d'édition a été **retirée** : l'`update` porte sur un
  identifiant déjà résolu et la RLS ancre le foyer. La garder « pour la 3.2 » aurait demandé du
  balisage mort pour satisfaire le lint.

**Ce que le parcours à l'écran a trouvé, et que rien d'autre ne pouvait trouver.** Un message
`« La recette est partie. »` était défini et **ne pouvait jamais s'afficher** : la suppression
réussie navigue vers `/recettes`, et le composant est démonté avant tout rendu. Retiré, avec la
raison écrite dans le fichier. C'est le quatrième epic d'affilée où l'œil trouve ce que les portes
ne voient pas — même si, cette fois, la trouvaille est bénigne.

**Une prédiction de la story démentie, et une confirmée.**
*Démentie :* les refus « portions » ne sont **pas** atteignables depuis l'écran — `required` et
`min={1}` bloquent avant. Mon contrôle est une ceinture aux bretelles du navigateur ; c'est la
contrainte en base qui est la frontière, et elle est prouvée par test.
*Confirmée, et c'est la plus utile :* « 2e3 » **passe** la validation native de Chrome
(`checkValidity():true`) et atteint bien `normaliserEntier`. Sans cette fonction, on aurait
enregistré `2000` minutes de cuisson, ou `null` selon le chemin.

**Le focus après suppression n'est pas « posé », et il ne doit pas l'être.** La sous-tâche
supposait une suppression en place, comme sur `/rayons`. Ici la suppression **change de route** :
mesuré, `document.activeElement` vaut `<body>` et le défilement repart en haut — c'est le contrat
normal d'une navigation, et le forcer autrement se battrait contre le framework.

**Ce qui reste à vérifier avant la fusion, et qui ne peut pas l'être d'ici :**

1. **La garde sur ses trois autres chemins.** Seul le clic sur `← Tes recettes` a été joué. Le
   rechargement et la fermeture d'onglet passent par `beforeunload` — typé, posé, **non observé**.
   Le bouton Retour du navigateur n'est **couvert par rien**, délibérément (la parade casserait le
   contrat du navigateur) : c'est à **constater**, pas à corriger.
2. **Le `<textarea>` sur un texte long.** Éprouvé sur 4 lignes, pas sur 30. La hauteur, le
   défilement interne et le `resize-y` méritent un vrai pavé.
3. **La requête de contrôle de migration, sur la production.** Attendu zéro ligne — c'est une
   **déduction** (aucune surface n'a jamais écrit dans `recipes`), pas une mesure : le dépôt n'est
   pas lié. À exécuter en revue et à rapporter dans la PR.
4. **Les quatre questions du gabarit de PR.**

**Deux entrées portées dans `deferred-work.md`, dont une est une dette datée.** L'avertissement
« cette recette est au menu » à l'intention de la story **3.6** — `meal_plan_entries` est en
`on delete cascade`, et c'est précisément parce qu'il n'y a rien à avertir aujourd'hui que la
suppression a été livrée maintenant. Et la **CSP re-déférée à l'Epic 6**, avec sa raison réécrite
dans les **deux** fichiers qui portaient l'ancienne échéance.

**Une action de l'Epic 1 se ferme au passage :** `/onboarding` a été vu en thème **clair**
(capture au parcours), le morceau qui manquait depuis le 2026-07-29.

### File List

**Nouveaux**
- `supabase/migrations/20260801124553_require_valid_recipe_fields.sql` — `recipes_titre_non_vide`
  (regex **extraite par script** de la migration des rayons) et `recipes_servings_positif`
- `lib/recettes/saisie.ts` — `MAX_*`, `normaliserTitre`, `normaliserDescription`,
  `normaliserInstructions`, `normaliserEntier`, `estUuid`
- `lib/recettes/saisie.test.ts` — 17 tests
- `lib/recettes/erreurs.ts` — `refusRecette`, discriminé par **nom de contrainte**
- `lib/recettes/erreurs.test.ts` — 5 tests
- `lib/recettes/recettes.ts` — `Recette`, `recettesDuFoyer`, `recetteParId`
- `lib/texte.test.ts` — 9 tests, dont celui qui épingle l'aplatissement de `normaliserTexte`
- `app/recettes/page.tsx` — le répertoire (Server Component)
- `app/recettes/ListeRecettes.tsx` — liste + création au titre seul (client-direct)
- `app/recettes/loading.tsx` — **le premier squelette du dépôt**
- `app/recettes/[id]/modifier/page.tsx` — `params` en `Promise`, trois chemins vers `notFound()`
- `app/recettes/[id]/modifier/FormulaireRecette.tsx` — les six champs, la suppression, la garde

**Modifiés**
- `lib/texte.ts` — **ajout seul** : `INVISIBLES_HORS_SAUT_DE_LIGNE` et `normaliserMultiligne`.
  `normaliserTexte` **inchangée**
- `app/page.tsx` — lien « Tes recettes », et la phrase « les recettes … arrivent » devenue fausse
- `next.config.ts` — **son commentaire seul** : échéance CSP → Epic 6. Aucun en-tête ajouté
- `supabase/tests/isolation.test.ts` — 8 tests de recettes, dont le `delete` inter-foyers et la
  cascade sur `meal_plan_entries`
- `supabase/tests/contraintes.test.ts` — 6 tests, dont « titre et nom de rayon se comportent à
  l'identique »
- `_bmad-output/implementation-artifacts/deferred-work.md` — 2 entrées neuves + CSP réécrite
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut

**Inchangés, vérifiés**
- `app/globals.css` — aucune classe ajoutée ; `.input` + utilitaires ont suffi
- `lib/supabase/types.ts` — régénéré, **diff = bruit de CLI seul**
  (`__InternalSupabase` ↔ `graphql_public`), **non commité** comme `docs/migrations.md` le prescrit.
  Sept fonctions avant, sept après
- `docs/migrations.md` — aucune fonction ajoutée par cette migration
- `proxy.ts` — matcher attrape-tout, `/recettes` déjà protégé. Vérifié, non modifié
- `package.json`, `package-lock.json`, `.node-version` — intacts, **aucune dépendance**
- `.env.local` — basculé sur le stack local pour le parcours, **restauré à l'identique**
  (SHA-256 comparé)

---

## Change Log

| Date | Changement |
|---|---|
| 2026-08-01 | **Implémentation.** Une migration additive (deux contraintes `check`, regex **extraite par script** de la migration des rayons plutôt que retapée), `lib/recettes/` en TDD avec phase rouge constatée, deux écrans, le premier `loading.tsx` du dépôt, 14 tests d'isolation et de contraintes. **Six portes vertes : 103/103 unitaires, 34/34 isolation, build, typage, lint, en-têtes de migration.** Dents vérifiées par mutation (34 → 32 → 30 ; 103 → 100) — et une quatrième mutation qui n'a rien fait tomber s'est révélée être un no-op de ma part : pour une politique `FOR ALL`, Postgres réutilise `using` comme `with check` quand celle-ci est omise. Rejouée en `with check (true)`, un seul test tombe, le bon. **Le piège central mesuré de bout en bout** : instructions sur 3 lignes → 3 sauts conservés en base. **Une prédiction de la story confirmée** — « 2e3 » passe la validation native de Chrome (`checkValidity():true`) et atteint bien `normaliserEntier`. **Une autre démentie** — les refus « portions » sont inatteignables depuis l'écran, `required` et `min={1}` bloquent avant. Parcours à l'écran dans les deux thèmes, 200 % de zoom et largeur téléphone mesurés. Trois sous-tâches laissées vides avec leur raison, dont trois des quatre chemins de la garde. Statut → `review` |
| 2026-08-01 | **Périmètre et document dégonflés.** `/recettes/nouvelle` supprimée : la création se fait **au titre seul** depuis le répertoire, sur le motif du formulaire d'ajout de `/rayons`, et continue sur l'écran d'édition. Supprime une route, un fichier, et la question du formulaire partagé création/édition. ⚠️ Coût dit d'avance : **AC1 se lit en deux temps**, écart assumé et signalé sous les AC. Onze tâches → neuf, dix-huit pièges → treize (fusionnés, aucun fait perdu), **1 111 lignes → 796** (`wc -l`) — la redondance avec `project-context.md`, chargé à chaque session, a été remplacée par un pointeur |
| 2026-08-01 | **Les cinq questions tranchées par Florian**, au terme d'un audit d'heuristiques. Le design prescrit était noté **6/10** : trois lignes du diagnostic échouaient, dont une **majeure**. **Deux décisions contre la recommandation initiale** : la **suppression** entre au périmètre (créer sans supprimer est un aller simple ; `/rayons` supprime déjà ; la cascade sur `meal_plan_entries` n'a rien à avertir tant que le menu n'existe pas), et la **garde des saisies non enregistrées** aussi. `onNavigate` sur `<Link>` **mesuré présent** en `next@16.2.12` avec `preventDefault()` ; il ne couvre ni `router.push` ni le bouton Retour, limite laissée découverte et **écrite** |
| 2026-08-01 | Story créée. Deux contraintes candidates **éprouvées par exécution** sur le stack local avant d'être prescrites — huit contrôles SQL et deux appels PostgREST ; base remise à l'état du dépôt et l'absence des contraintes vérifiée dans `pg_constraint`. **Le piège central mesuré, pas déduit** : `normaliserTexte` détruit tous les retours à la ligne (`\p{Cc}` contient U+000A), ce qui rendrait l'AC de la story 3.3 indémontrable sans émettre aucun signal |
