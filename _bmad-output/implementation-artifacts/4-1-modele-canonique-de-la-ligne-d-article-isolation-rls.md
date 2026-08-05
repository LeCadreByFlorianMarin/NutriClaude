---
baseline_commit: 68dcd42e03b9b2dd2b1f36d5e3a6e4824e921d99
---

# Story 4.1: Modèle canonique de la ligne d'article & isolation RLS

Status: done

<!-- ⚠️ **FERMÉE AVEC DEUX CONDITIONS OUVERTES, DATÉES PLUTÔT QU'EFFACÉES** (règle §6 bis) :
     1. La requête de contrôle n'a **jamais été exécutée sur la PRODUCTION**. Local uniquement,
        zéro ligne aux quatre. Sur le distant, que la table soit vide reste une DÉDUCTION.
     2. `generate_grocery_list_from_menu` reste **cassée** (`23505` sur deux chemins) et fait
        toujours un DELETE dur — story 4.7. Depuis la revue, plus aucune surface ne peut
        l'atteindre (volet 8), mais la fonction elle-même n'est pas réparée.
     Les quatre reports de revue sont dans `deferred-work.md`, adressés à 4.6, 4.12 et « qui
     touchera au schéma ». -->


<!-- PREMIÈRE story de l'Epic 4, et la plus structurante du produit entier. Quatre choses la
     distinguent de tout ce qui a précédé, et il faut les avoir en tête avant de lire les
     critères :

     1. ⚠️ **ELLE N'A AUCUNE SURFACE.** Aucun écran, aucun composant, aucun `app/`. Elle ne
        pose que du schéma. C'est la seule story du dépôt dont la démonstration est
        intégralement en SQL et en tests — et donc la seule où « ça marche à l'écran » ne
        peut rien prouver. Le corollaire : **la seule preuve admissible est un test exécuté**
        (AD-17, règle §1).

     2. ⚠️ **ELLE POSE LA CLÉ SUR LAQUELLE TOUT L'EPIC 4 S'ARBITRE.** `status` (4.3),
        l'UPSERT-incrémente (4.4), le tombstone (4.5), la provenance (4.6), la génération non
        destructive (4.7), le LWW par champ (4.10) et le contrat versionné (4.12) s'énoncent
        TOUS sur la ligne canonique que cette story crée. Une clé mal choisie ici n'est pas
        une dette : c'est une migration de données à écrire plus tard sur une table peuplée.

     3. ⛔ **ELLE CASSE `generate_grocery_list_from_menu`, ET C'EST MESURÉ.** L'index unique
        que l'AC2 demande fait échouer en `23505` l'INSERT nu de cette fonction, sur deux
        chemins distincts. La fonction n'est appelée par aucune surface (mesuré), donc la
        casse est dormante — mais elle est réelle, et elle se DATE plutôt que de se taire.
        Voir § Décision D4 et piège n°6.

     4. ✅ **LES QUATRE DÉCISIONS ONT ÉTÉ TRANCHÉES LE 2026-08-05, AVANT DÉMARRAGE** —
        § Décisions. Rien n'attend. **La première l'a été CONTRE la recommandation** : la clé
        canonique **plie les accents**, donc la migration installe l'extension `unaccent` et
        une enveloppe `immutable`. Ce que ça coûte est écrit au piège n°2 — ce n'est pas un
        détail d'implémentation, c'est une promesse faite au planificateur de requêtes. -->

<!-- ⚠️ **CETTE STORY SE DÉMONTRE INTÉGRALEMENT EN LOCAL — décision de Florian du 2026-08-05.**
     Aucune tâche n'attend un accès à la production, et `SUPABASE_DB_URL` n'est pas requis. La
     requête de contrôle en en-tête reste due (`npm run check:migrations` la vérifie, et elle
     sert au relecteur avant la fusion), mais **l'agent l'exécute sur le stack local** et
     consigne ce qu'il a mesuré là — pas ailleurs (règle §1). -->

<!-- ⚠️ **LA TABLE EST VIDE EN LOCAL (mesuré : 0 ligne le 2026-08-05) ET PROBABLEMENT EN
     PRODUCTION (déduit, non mesuré).** C'est ce qui rend cette story bon marché — poser une
     contrainte d'unicité sur une table peuplée par des saisies libres est ce que ce dépôt a
     déjà eu à faire deux fois. **Cette fenêtre se referme à la story 4.4.** Tout ce qui doit
     être contraint doit l'être MAINTENANT ; c'est pour ça que cette story pose deux
     contraintes que ses critères ne nomment pas (§ Ce qui est dû sans être écrit). -->

## Story

As a foyer,
I want que chaque article de la liste soit une ligne unique et isolée à mon foyer,
So that il n'existe jamais de doublon à fusionner et qu'aucun autre foyer ne puisse voir ma liste.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-4.1`.

**AC1 — Le modèle canonique en base**
**Given** le schéma actuel de `grocery_list_items`
**When** il est migré vers le modèle canonique (AD-3) via une migration additive
**Then** la table porte les champs `name` (normalisé), `unit`, `quantity`, `status`, `aisle_id`,
`recipe_id`, `actor_kind`, `actor_id`, `source_ref`, `intent_at`, `updated_at`, `deleted_at`,
avec une contrainte **`unique(household_id, name normalisé, unit)`**

**AC2 — L'unicité qui rend l'agrégation possible**
**Given** un article et une tentative d'insérer un second article de même nom normalisé et même
unité dans le foyer
**When** l'insertion est tentée
**Then** la contrainte d'unicité l'empêche (base d'agrégation FR-5, aucune ligne à fusionner)

**AC3 — L'isolation au niveau de la donnée**
**Given** les politiques RLS ancrées sur `current_household_id()` (AD-2)
**When** un utilisateur d'un autre foyer tente de lire ou modifier ces lignes
**Then** l'accès est refusé au niveau de la donnée (NFR-5), jamais seulement à l'interface

**AC4 — La suppression est un tombstone**
**Given** la suppression d'un article
**When** elle est appliquée
**Then** elle se fait par tombstone (`deleted_at`), **jamais** par DELETE dur (AD-3)

---

> **⚠️ L'AC1 dit « name normalisé », et il ne dit PAS ce que ça veut dire.** C'est la décision
> la plus lourde de la story : « Oignon » et « oignon » sont-ils la même ligne ? Et « crème »
> tapé en NFD ? Et « lait entier » avec un espace de largeur nulle collé depuis une messagerie ?
> **Les cinq familles ont été mesurées** (§ Ce qui est mesuré). La réponse est tranchée en
> Décision D1 — et elle plie AUSSI les accents. **Ne l'improvise pas au moment d'écrire le SQL.**

> **⚠️ L'AC2 dit « la contrainte d'unicité l'empêche ». Mesuré : la forme naïve NE
> L'EMPÊCHE PAS.** Un `unique (household_id, …, unit)` ordinaire laisse passer DEUX lignes dès
> que `unit` est nul — et un article ajouté sans unité est le cas le plus courant du produit.
> `nulls not distinct` (PostgreSQL 15+) le ferme, et il exige un `create unique index`, pas un
> `alter table … add constraint`. Piège n°1, et il tue l'AC2 en silence.

> **⚠️ L'AC4 dit « jamais par DELETE dur », et ce n'est pas une convention de code.** AD-1/AD-2 :
> la règle vit en Postgres. Une politique RLS `for all` — celle qui existe aujourd'hui —
> **autorise le DELETE**. Tenir l'AC4 veut dire retirer ce verbe au niveau de la donnée, pas
> écrire « on ne fait pas de delete » dans un commentaire. Piège n°4.

> **⚠️ Ce que ces quatre critères NE disent PAS et qui est dû quand même** : le vocabulaire
> d'unités fermé sur cette table, la contrainte de nom non vide, la vue qui montrerait les
> articles supprimés, et l'entrée datée pour `generate_grocery_list_from_menu`. Les quatre sont
> au § Ce qui est dû sans être écrit. **Une story doit laisser le système entier en état de
> marche, pas seulement satisfaire ses propres AC.**

---

## Ce qui est MESURÉ — huit sondes, le 2026-08-05, sur `68dcd42`

*Stack local `supabase start`, PostgreSQL **17.6**, chaque sonde dans une transaction annulée.
Règle §1 : ce qui suit a été **exécuté**. Ce qui est déduit est écrit « déduit ».*

| # | Question | Réponse **mesurée** |
|---|---|---|
| M1 | État de `grocery_list_items` | **11 colonnes**, aucune de `updated_at` / `deleted_at` / `intent_at` / `actor_kind` / `actor_id` / `source_ref`. Une seule politique : `grocery_all for all`. **0 ligne** en local. Aucun trigger |
| M2 | `unique (…, unit)` ordinaire, `unit` **nul** | **2 lignes acceptées.** `nulls not distinct` → `23505` |
| M3 | `normalize(name, NFC)` dans une expression d'index | `provolatile = 'i'` → **indexable**. SANS elle, « crème » NFC et NFD font **2 lignes** ; AVEC elle → `23505` |
| M4 | `lower(regexp_replace(name, '[^[:graph:]]…', '', 'g'))` | **Indexable.** « Lait\<U+200B\> entier » et « lait entier » produisent la même clé `laitentier` → `23505`. ⚠️ **Les espaces ordinaires disparaissent aussi** — `[:graph:]` les exclut |
| M5 | L'INSERT nu de `generate_grocery_list_from_menu`, après son `delete … where status='pending'`, quand un article **acheté** porte la même clé | **`23505`.** Le DELETE ne retire que les `pending` ; l'acheté survit et occupe la clé |
| M6 | Le `group by ri.name, ri.unit, ri.product_id, ri.aisle_keyword` de la même fonction, quand deux ingrédients ne diffèrent que par `product_id` | **`23505`.** Deux lignes de même clé canonique |
| M7 | La vue `grocery_list_by_aisle` face à un tombstone | **1 ligne rendue** — elle montre l'article supprimé. Et `g.*` **ne reprend pas** les colonnes ajoutées après sa création |
| M8 | `create or replace view` avec le corps `g.*` d'origine, colonnes neuves ajoutées | **ÉCHOUE** : `cannot change name of view column "aisle_name" to "deleted_at"`. Les colonnes neuves **appendues à la fin** passent |
| M9 | Les deux suites, sur `68dcd42` | `npm test` → **198 / 198**, `duration_ms 174.8`. `npm run test:isolation` → **66 / 66**, `duration_ms 1680` — les deux **exécutées** |
| M10 | Tests couvrant `grocery_list_items` | **ZÉRO.** Deux commentaires nomment la fonction de génération, aucune assertion ne touche la table |
| M11 | Code applicatif touchant la table | **AUCUN.** `grep -rn "grocery_list" --include=*.ts --include=*.tsx` ne rend que `lib/supabase/types.ts` |
| M12 | `SUPABASE_DB_URL` dans `.env.local` | **ABSENT.** Sans portée : décision du 2026-08-05, cette story se démontre **en local** |

**Cinq mesures de plus, après la décision D1 (accents pliés) :**

| # | Question | Réponse **mesurée** |
|---|---|---|
| M13 | Volatilité des deux formes d'`unaccent` sur PG 17.6 | **LES DEUX sont `STABLE`**, y compris `unaccent(regdictionary, text)`. ⚠️ Le contournement classique « employer la forme à deux arguments, elle est `IMMUTABLE` » est **FAUX ici** — une enveloppe est obligatoire |
| M14 | Une enveloppe SQL déclarée `immutable` autour d'`unaccent` | `provolatile = 'i'`, et **l'index se crée** |
| M15 | Schéma d'installation | `create extension unaccent with schema extensions` → **`extensions`**, la convention des quatre extensions déjà posées (`pg_net`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`). ⚠️ **Sans `with schema`, elle atterrit dans `public`** |
| M16 | Comportement du dictionnaire | `crème→creme` · `Épinard→Epinard` (**la casse est préservée**) · `pâté→pate` · `curaçao→curacao` · **`œuf→oeuf`** (la ligature est développée) |
| M17 | Les cinq familles, avec l'expression complète, à unité **égale** | « Crème fraîche » puis `creme fraiche` / `CRÈME FRAÎCHE` / la forme NFD / « Crème\<U+200B\> fraîche » → **`23505` aux quatre**. « Sel » puis « sel », `unit` **nul** aux deux → **`23505`**. Et « Crème fraîche » en `ml` → **passe**, deux lignes (AD-7) |

⚠️ **`unaccent` retire un diacritique combinant même SANS `normalize` en amont** (mesuré). Ça
ne rend pas `normalize(name, NFC)` inutile : il couvre les différences de forme Unicode que le
dictionnaire ne mappe pas, et il coûte un appel de fonction immutable. Il reste.

**Ce qui reste DÉDUIT, et qui doit être mesuré en revue :** que la table est vide en production.
Aucune surface n'y a jamais écrit (M11), et la seule fonction qui l'alimente n'a aucun point
d'appel — mais le prototype du 2026-05-02 a vécu, et « déduit » n'est pas « mesuré ».

---

## Décisions de Florian — 2026-08-05

*Les quatre ont été tranchées **avant démarrage**. Rien n'attend. Elles sont écrites ici avec
la mesure qui les motive, pour que le développeur sache **pourquoi** et pas seulement **quoi**.*

### D1 — « Nom normalisé » plie AUSSI les accents *(tranchée contre la recommandation)*

**⚠️ La décision la plus lourde de l'Epic 4.** Elle fixe ce que « le même article » veut dire
pour toujours, et elle ne se change plus une fois la table peuplée.

Les options examinées étaient : `name` brut · `lower(btrim(name))` · la forme sans accents ·
**la forme avec accents pliés**. La recommandation était l'avant-dernière ; **Florian a
tranché la dernière**. La clé canonique est donc :

```sql
lower(public.strip_accents(regexp_replace(normalize(name, NFC), '<LA REGEX>', '', 'g')))
```

**Ce qu'elle fusionne (mesuré, M17) :** la casse · la forme Unicode (NFC/NFD) · les invisibles ·
les espaces · **les accents**. « Crème fraîche », « creme fraiche », « CRÈME FRAÎCHE » et la
forme décomposée sont **une seule ligne**, clé `cremefraiche`.

**Ce qu'elle ne fusionne pas :** le pluriel (« oignon » ≠ « oignons ») ni les synonymes. Aucun
mécanisme de cette story ne s'en approche, et aucune story de l'Epic 4 ne le demande.

Ce que la décision achète : le membre qui tape vite, sans accents, sur un téléphone, retombe
sur la ligne existante. C'est **le** geste du produit (ajout au supermarché, à une main), et
c'est aussi ce que la dictée et le pont Google produiront — un texte dont on ne contrôle pas
l'accentuation (AD-12 : « l'ingestion normalise vers le vocabulaire fermé »).

⚠️ **Ce que la décision coûte est réel et se lit au piège n°2** : une extension de plus, une
fonction enveloppe, et une promesse d'immutabilité qui n'est pas strictement vraie. **Ce n'est
pas une objection — c'est la contrepartie, et elle s'écrit une fois, dans l'en-tête de la
migration.**

⚠️ **La regex reste la MÊME famille que `recipe_ingredients_nom_non_vide`**
(`20260802112511:83`), qui la tient de `20260729095923:80`. Règle §3 : une énumération ne peut
pas gagner contre une catégorie — Postgres n'a pas de propriété Unicode, donc `[^[:graph:]]`
plus la liste résiduelle est la forme que ce dépôt a déjà arbitrée. **Extraire la regex par
script depuis la migration existante, jamais la retaper.**

⚠️ **Conséquence assumée : les espaces ordinaires disparaissent de la clé** (M4). « lait
entier » et « laitentier » deviennent la même ligne. Sans danger — personne ne tape la seconde
forme délibérément — mais **ça s'écrit**, ça ne se découvre pas.

⚠️ **La colonne `name` garde sa casse, ses accents et sa mise en forme.** La normalisation vit
dans l'**expression de l'index**, jamais dans la donnée. On n'écrase jamais ce que le membre a
tapé — « Crème fraîche » s'affiche « Crème fraîche ».

### D2 — `generate_grocery_list_from_menu` : datée pour la 4.7, non touchée

M5 et M6 mesurent qu'elle échouera en `23505` sur deux chemins. Elle fait aussi un **DELETE
dur**, que l'AC4 proscrit.

**La fonction n'est pas touchée par cette story.** Elle part dans `deferred-work.md` avec ses
deux mesures citées, adressée nommément à la story 4.7.

Motif : elle n'a **aucun point d'appel** (M11), donc la casse est dormante ; et la réparer
correctement — UPSERT-incrémente non destructif, tombstone au lieu du DELETE, compte des
articles ajoutés — **est la story 4.7 en entier**. Une demi-réparation ici serait jetée.

Et ça s'écrit **honnêtement** : l'AC4 est tenu **pour les surfaces** (RLS, mesuré par test), et
**pas** pour cette fonction `security definer` détenue par `postgres`, qui traverse la RLS par
construction. C'est la règle §6 bis appliquée à un critère : fermer en DATANT ce qui reste
ouvert, jamais en l'effaçant.

### D3 — Le tombstone OCCUPE la clé canonique : index total

**Aucun `where deleted_at is null` sur l'index.** Supprimer puis rajouter le même article
**ressuscite la même ligne** (`deleted_at` remis à nul).

AD-3 le dit dans sa clause *Prevents* : « l'id sur lequel s'arbitre LWW/tombstone doit rester
stable ». Avec un index partiel, une ligne neuve naîtrait à côté du tombstone, et un cochage
hors ligne flushé après une suppression arbitrerait contre une ligne qui n'existe plus — c'est
exactement le défaut qu'AD-3 prévient.

Conséquence pour la 4.5 et la 4.7 : « rajouter un article supprimé » est un **UPDATE**, jamais
un INSERT.

### D4 — La vue `grocery_list_by_aisle` est amendée ICI

M7 mesure qu'elle **montre les articles supprimés** dès que `deleted_at` existe, et M8 que son
corps `g.*` **ne se rejoue pas** (`create or replace` échoue).

C'est cette story qui invente le tombstone ; laisser derrière elle une vue qui montre les
supprimés serait un défaut **introduit** par elle. Et M8 montre que c'est faisable sans
`drop view` — donc sans rien casser.

**La vue ne change PAS son filtre `status = 'pending'`** : c'est le périmètre de la 4.2 / 4.5.

---

## Ce qui est dû sans être écrit dans les AC

*Quatre points. Aucun n'est du débordement : chacun est soit une prémisse à rouvrir (règle §5),
soit une conséquence directe que cette story introduit.*

### 1. Le vocabulaire d'unités fermé sur cette table (AD-7 / FR-52)

`unit` est un **morceau de la clé canonique**. Une unité libre fragmente la clé : « L » et
« l » et « litre » font trois lignes de lait. `lib/recettes/unites.ts` le dit déjà en toutes
lettres — « ce n'est pas une liste d'affichage, c'est un contrat avec l'Epic 4 » — et
`recipe_ingredients_unite_fermee` (`20260802112511:78`) est la contrepartie côté recettes.

**La contrainte jumelle est due ici**, et son accord avec `UNITES` se **mesure** (règle §4), sur
le modèle du test existant de `contraintes.test.ts`.

⚠️ **Elle ne coûte rien MAINTENANT** (table vide, M1) et coûterait une migration de données à
partir de la 4.4.

### 2. La contrainte de nom non vide — la SIXIÈME de cette famille

Après `display_name`, `households.name`, `aisles.name`, `recipes.title`, `recipe_ingredients.name`.
Même motif, même raison : un champ libre partagé par tout le foyer descend en base (AD-1/AD-2),
et le contrôle navigateur ne voit pas les appels REST directs.

⚠️ **Et ici elle porte davantage** : un nom entièrement invisible produirait une clé canonique
**vide**, donc un seul emplacement par foyer pour tous les articles fantômes. La regex est la
même que celle de la clé — c'est le même prédicat, employé deux fois.

### 3. Le retrait du verbe DELETE (AC4, au niveau de la donnée)

Voir piège n°4. La politique `grocery_all for all` autorise aujourd'hui le DELETE ; l'AC4 exige
qu'il n'existe pas.

### 4. Ce qui se DATE plutôt que de se taire

Quatre entrées à écrire dans `deferred-work.md`, chacune nommant sa story destinataire :

- `generate_grocery_list_from_menu` → **4.7** (D2, mesures M5/M6)
- L'index d'idempotence `unique (household_id, source_ref) where source_ref is not null` (AD-12) →
  **Epic 6**. La colonne naît ici ; **son unicité n'est pas de cette story** et ne doit pas être
  posée en silence
- `added_by` est **supplanté** par `actor_kind` / `actor_id` → **4.6**, qui possède le chemin de
  lecture de la provenance. ⚠️ La colonne n'est **pas** supprimée (`drop column` interdit sans
  décision explicite, `docs/migrations.md`)
- Le miroir applicatif de la clé canonique → **4.4**, la première story qui écrit depuis une
  surface. **N'écris pas ce module ici** : il n'aurait aucun consommateur, et rule §4 se tient
  d'ici là par un test qui interroge la base

---

## Tasks / Subtasks

- [x] **Task 1 — La migration : sept volets, un seul fichier** (AC1, AC2, AC3, AC4)
      <!-- ⚠️ **UN SEUL FICHIER, comme la 3.6.** `supabase db push` n'est pas atomique sur un
           LOT : sur deux migrations dont la seconde échoue, la première est appliquée et
           enregistrée (`docs/migrations.md`). Les sept volets servent la même story et se
           contrôlent par la même requête — un seul point d'échec. -->

  - [x] `npx supabase migration new poser_le_modele_canonique_de_la_liste`
  - [x] **L'en-tête porte sa requête de contrôle**, et `npm run check:migrations` le vérifie.
        ✅ **Décision de Florian du 2026-08-05 : l'agent l'exécute sur le STACK LOCAL**, et
        consigne ce qu'il a mesuré **là** (règle §1 — « local » n'est pas « production »).
        **Trois volets peuvent échouer sur des données existantes**, **zéro ligne** attendue :
        ```sql
        -- 0. Le contexte : combien d'articles existe-t-il seulement ?
        select count(*) as articles, count(*) filter (where status='bought') as achetes
          from grocery_list_items;

        -- 1. Doublons sur la clé canonique (bloqueraient l'index unique du volet 4)
        --    ⚠️ à exécuter APRÈS le volet 1 (l'extension et `strip_accents` doivent exister)
        select household_id,
               lower(public.strip_accents(
                 regexp_replace(normalize(name, NFC), '[^[:graph:]]', '', 'g'))) as cle,
               unit, count(*)
          from grocery_list_items
         group by 1, 2, 3 having count(*) > 1;

        -- 2. Unités hors du vocabulaire fermé (bloqueraient le volet 3)
        select id, unit from grocery_list_items
         where unit is not null
           and unit not in ('g','kg','ml','L','pièce','cs','cc','pincée');

        -- 3. Noms qui ne montrent rien (bloqueraient le volet 3)
        select id, name from grocery_list_items
         where regexp_replace(name, '[^[:graph:]]', '', 'g') = '';
        ```
        ⚠️ **La requête 1 est écrite ici en forme SIMPLIFIÉE** (sans la liste résiduelle de
        points de code) parce qu'un contrôle doit être lisible dans un SQL Editor. Celle du
        fichier de migration porte la regex **complète**, extraite par script.
        ⚠️ **La requête 1 dépend du volet 1 de sa propre migration.** C'est inhabituel et il
        faut le dire dans l'en-tête : elle n'est exécutable qu'une fois l'extension posée. La
        forme de repli, si on veut sonder AVANT toute application, remplace
        `public.strip_accents(…)` par `unaccent(…)` — **strictement équivalent en lecture**,
        c'est seulement en index que la volatilité compte (M13).
        ⚠️ **Les volets 2, 5, 6 et 7 n'ont rien à contrôler, et c'est à écrire plutôt qu'à
        taire** : ajouter une colonne nullable ou avec défaut ne peut pas échouer
        (`docs/migrations.md`, « autorisé sans précaution »).

  - [x] **Volet 1 — L'extension et l'enveloppe immutable** (décision D1)
        ```sql
        create extension if not exists unaccent with schema extensions;

        create or replace function public.strip_accents(p_texte text)
        returns text
        language sql
        immutable
        parallel safe
        strict
        as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p_texte) $$;
        ```
        ⚠️ **`with schema extensions` n'est pas décoratif** (M15). Sans lui, l'extension
        atterrit dans `public` — mesuré — alors que les quatre déjà posées (`pg_net`,
        `pgcrypto`, `uuid-ossp`, `pg_stat_statements`) vivent toutes dans `extensions`. Un
        schéma divergent entre le local et la production est exactement le défaut que
        `20260729094500` a été écrite pour fermer.
        ⚠️ **L'ENVELOPPE EST OBLIGATOIRE, ET LE CONTOURNEMENT QUE TU CONNAIS EST FAUX ICI.**
        Mesuré (M13) : sur PostgreSQL 17.6, **les deux** formes d'`unaccent` sont `STABLE`, y
        compris `unaccent(regdictionary, text)` que la sagesse commune décrit comme
        `IMMUTABLE`. Une expression `STABLE` ne peut pas indexer. **Ne perds pas une heure à
        essayer la forme à deux arguments toute nue : elle est refusée.**
        ⚠️ **Le dictionnaire est cité PLEINEMENT QUALIFIÉ** (`'extensions.unaccent'`) et la
        fonction n'a **pas** de clause `set search_path`. Une expression d'index ne doit
        dépendre d'aucun `search_path` : deux sessions aux chemins différents produiraient
        deux clés pour la même ligne, et l'index serait faux sans que rien ne le dise.
        ⚠️ **`immutable` est ici une PROMESSE, pas un constat** — voir piège n°2. Elle
        s'explique dans l'en-tête, une fois, en toutes lettres.
        ⚠️ **Nommage anglais**, comme les dix fonctions existantes (`resolve_aisle_id`,
        `reorder_aisles`, `seed_default_aisles`…). Pas `sans_accent`.
        ⚠️ **Les privilèges sont déjà couverts** : `20260729094500` porte
        `alter default privileges in schema public grant all on functions` — écrite exactement
        pour que « chaque nouvelle fonction ne rejoue pas le même défaut en silence ». **Ne
        réécris pas de `grant`**, et vérifie-le plutôt que de le supposer.

  - [x] **Volet 2 — les six colonnes du modèle canonique** (AC1)
        ```sql
        alter table grocery_list_items
          add column actor_kind text,
          add column actor_id   uuid,
          add column source_ref text,
          add column intent_at  timestamptz not null default now(),
          add column updated_at timestamptz not null default now(),
          add column deleted_at timestamptz;
        ```
        ⚠️ **`actor_id` n'est PAS une clé étrangère vers `profiles`.** Convention du spine :
        la provenance est **polymorphe** — `(actor_kind ∈ {profile, device}, actor_id)`. Un
        appareil n'est jamais une FK `profiles` (AD-9/NFR-6). Poser la FK « pour bien faire »
        rendrait la story 5.x impossible sans migration.
        ⚠️ **`intent_at not null default now()` et non nullable** : `deleted_at` mis à part,
        AUCUN champ d'arbitrage LWW ne doit pouvoir être nul — une comparaison contre `null`
        rend `null`, donc « ni plus récent ni plus ancien », donc un arbitrage silencieusement
        sans gagnant (AD-3). Le défaut `now()` est l'horloge SERVEUR : honnête pour une
        écriture directe, et remplacé par l'horloge du geste dès que l'outbox existe (4.9).
        ⚠️ **`deleted_at` reste NULLABLE** : c'est un tombstone, son absence est l'état normal.

  - [x] **Volet 3 — les trois contraintes** (AC1, § Ce qui est dû 1 et 2)
        ```sql
        alter table grocery_list_items
          add constraint grocery_list_items_unite_fermee
          check (unit is null or unit in ('g','kg','ml','L','pièce','cs','cc','pincée'));

        alter table grocery_list_items
          add constraint grocery_list_items_nom_non_vide
          check (regexp_replace(name, '<LA REGEX COMPLÈTE>', '', 'g') <> '');

        alter table grocery_list_items
          add constraint grocery_list_items_acteur_connu
          check (actor_kind is null or actor_kind in ('profile','device'));
        ```
        ⚠️ **La regex de `nom_non_vide` est EXTRAITE PAR SCRIPT** de `20260729095923:80` ou de
        `20260802112511:83`, **jamais retapée**. Ses `\uXXXX` sont des échappées de l'analyseur
        d'**expressions rationnelles** de Postgres, pas de chaînes — la lecture naïve est
        plausible et fausse, et c'est démontré dans l'en-tête de `20260801124553`.
        ⚠️ **`quantity` ne reçoit PAS de contrainte de positivité ici.** Le critère du projet
        est « la valeur est-elle consommée par un calcul ? » — elle l'est, mais l'agrégation
        qui la consomme est la story **4.4**. La poser ici sans son chemin d'écriture
        contraindrait un champ que personne n'écrit encore. ⚠️ **À rouvrir à la 4.4**, et c'est
        une entrée de `deferred-work.md`, pas un oubli.

  - [x] **Volet 4 — L'INDEX UNIQUE CANONIQUE** (AC2, décision D1) — *le cœur de la story*
        ```sql
        create unique index grocery_list_items_cle_canonique
          on grocery_list_items (
            household_id,
            lower(public.strip_accents(
              regexp_replace(normalize(name, NFC), '<LA MÊME REGEX>', '', 'g'))),
            unit
          ) nulls not distinct;
        ```
        ⚠️ **L'ORDRE DES QUATRE OPÉRATIONS EST CELUI-LÀ, et il n'est pas commutatif.**
        `normalize` d'abord (composer avant de mesurer), puis `regexp_replace` (retirer les
        invisibles), puis `strip_accents`, puis `lower`. Mesuré sur les cinq familles (M17).
        ⚠️ **`create unique index`, PAS `alter table … add constraint unique`.** Une contrainte
        de table n'accepte ni expression ni `nulls not distinct`. Ce n'est pas une préférence
        de style : c'est la seule forme qui exprime l'AC2.
        ⚠️ **`nulls not distinct` est le point qui tue l'AC2 en silence s'il manque** (M2, et
        piège n°1). PostgreSQL 15+ ; la production est en 17.6 (`AR-MIGRATIONS`), le local
        aussi (mesuré).
        ⚠️ **INDEX TOTAL, pas partiel** (décision D3) : **aucun** `where deleted_at is null`.
        Le tombstone garde sa clé — c'est ce qui rend l'arbitrage LWW possible (AD-3).
        ⚠️ **La regex est LA MÊME que celle du volet 3**, aux octets près. Deux expressions qui
        divergeraient produiraient un nom refusé par la contrainte et accepté par la clé, ou
        l'inverse. Règle §4 : **un test le mesure** (Task 3).
        ⚠️ **`strip_accents` n'est PAS dans la contrainte `nom_non_vide`, et c'est voulu** :
        plier les accents ne peut pas vider un nom qui montrait quelque chose. Les deux
        expressions partagent la regex, pas l'enveloppe.

  - [x] **Volet 5 — `updated_at` posé serveur** (AC1)
        ```sql
        create trigger grocery_list_items_updated_at
          before update on grocery_list_items
          for each row execute function set_updated_at();
        ```
        ⚠️ **`set_updated_at()` EXISTE DÉJÀ** (`20260502000000:…`, employée par `profiles` et
        `recipes` — mesuré : ce sont les deux seuls triggers du schéma). **Ne la réécris pas.**
        ⚠️ **`updated_at` n'est PAS l'arbitre du LWW** (AD-3) : c'est l'horodatage d'affichage
        et de Realtime. L'arbitre est `intent_at`. Les confondre est le contresens central
        d'AD-3, et il coûterait la story 4.10.

  - [x] **Volet 6 — La RLS, et le DELETE qui disparaît** (AC3, AC4)
        ```sql
        drop policy grocery_all on grocery_list_items;

        create policy grocery_select on grocery_list_items for select
          using (household_id = current_household_id());
        create policy grocery_insert on grocery_list_items for insert
          with check (household_id = current_household_id());
        create policy grocery_update on grocery_list_items for update
          using (household_id = current_household_id())
          with check (household_id = current_household_id());
        -- Aucune politique DELETE : la RLS refuse par défaut. C'est l'AC4.
        ```
        ⚠️ **C'est un RESSERREMENT, pas une destruction.** Il ne casse aucun consommateur :
        M11 mesure qu'aucun code applicatif ne touche cette table. Écris-le dans l'en-tête.
        ⚠️ **Ce que cette forme NE fait PAS, et c'est assumé** : elle ne lie ni le rôle de
        service, ni une fonction `security definer`. `generate_grocery_list_from_menu`
        continuera donc de faire son DELETE dur (D2). **L'AC4 est tenu pour les surfaces, pas
        pour cette fonction** — et ça se DATE, ça ne se tait pas.
        ⚠️ **Les cascades ne sont pas concernées** : `on delete cascade` depuis `households` et
        `on delete set null` depuis `recipes`/`aisles`/`products` sont des contraintes
        d'intégrité, pas des ordres soumis à la RLS.
        ⚠️ **Le harnais de test emploie `service_role`, qui traverse la RLS.** Un test « A ne
        peut pas supprimer » DOIT passer par le client authentifié de A, jamais par `admin` —
        sinon il passe en ne prouvant rien. Ce faux positif a déjà été trouvé deux fois sur ce
        dépôt (story 2.2).

  - [x] **Volet 7 — La vue, qui montrerait sinon les articles supprimés** (décision D4)
        ```sql
        create or replace view grocery_list_by_aisle
          with (security_invoker = true) as
          select g.id, g.household_id, g.name, g.quantity, g.unit, g.product_id,
                 g.aisle_id, g.recipe_id, g.added_by, g.status, g.created_at,
                 a.name as aisle_name, a.icon as aisle_icon, a.sort_order as aisle_sort,
                 g.actor_kind, g.actor_id, g.source_ref,
                 g.intent_at, g.updated_at, g.deleted_at
          from grocery_list_items g
          left join aisles a on g.aisle_id = a.id
          where g.status = 'pending' and g.deleted_at is null
          order by coalesce(a.sort_order, 9999), g.name;
        ```
        ⚠️ **LES ONZE PREMIÈRES COLONNES SONT DANS L'ORDRE EXACT DE L'EXISTANT, ET LES TROIS
        `aisle_*` RESTENT EN 12/13/14.** Mesuré (M8) : rejouer le `g.*` d'origine **échoue** —
        `cannot change name of view column "aisle_name" to "deleted_at"`. `create or replace`
        n'autorise que l'**ajout en fin**. Les six neuves vont donc **après** `aisle_sort`.
        ⚠️ **`security_invoker = true` est conservé** : sans lui, la vue s'exécuterait avec les
        droits de son propriétaire et **traverserait la RLS**. C'est le commentaire du squelette
        et il a raison.
        ⚠️ **Le filtre `status = 'pending'` NE CHANGE PAS.** Rendre les achetés est le
        périmètre de la 4.2/4.5.
        ⚠️ **`g.*` est REMPLACÉ par une liste explicite, définitivement.** M7 mesure que `g.*`
        ne reprend pas les colonnes ajoutées après coup : la forme implicite était déjà un
        piège dormant.

- [x] **Task 2 — Rejouer la chaîne et régénérer les types** (AC1)
  - [x] `npx supabase db reset` — **la seule façon d'éprouver la migration dans les conditions
        de la production** : jouée après toutes les précédentes, sur une base vierge
  - [x] `npx supabase gen types typescript --local > lib/supabase/types.ts`
        ⚠️ **`--local`, jamais `--linked`** : le distant n'a pas encore la migration.
        ⚠️ **Le diff N'EST PAS vide cette fois** : six colonnes et six colonnes de vue. C'est
        l'inverse de la 3.2. S'il est vide, la migration n'a pas été jouée
  - [x] `npm run typecheck` — le diff de types ne doit rien casser (M11 : aucun consommateur,
        donc le résultat attendu est **vert du premier coup**. S'il est rouge, quelque chose
        d'autre a bougé, et ce n'est pas cette story)

- [x] **Task 3 — Les tests de contraintes** (AC1, AC2 — `supabase/tests/contraintes.test.ts`)
      <!-- Ce fichier existe pour « l'accord entre le client et la base, MESURÉ » (règle §4).
           Les tests de clé canonique y vont, pas dans `isolation.test.ts` : ils n'éprouvent
           pas une frontière entre foyers. -->
  - [x] **L'unité fermée : le client n'est jamais plus laxiste que la base.** Motif exact du
        test existant sur `recipe_ingredients_unite_fermee`. `UNITES` de
        `lib/recettes/unites.ts` est la source, jamais une liste recopiée (règle §3)
  - [x] **Les huit jetons sont acceptés**, et une neuvième valeur est refusée avec
        `grocery_list_items_unite_fermee` dans le message
  - [x] **La clé canonique fusionne les QUATRE familles mesurées** — un test par famille, et
        chacun cite sa mesure. Toutes à **unité égale**, sans quoi le test mesure l'unité et
        pas le nom (piège déjà tombé pendant la contextualisation) :
        - la **casse** : « Crème fraîche » puis « CRÈME FRAÎCHE » → `23505`
        - les **accents** (décision D1) : puis « creme fraiche » → `23505` (M17)
        - la **forme Unicode** : puis `'cr'||'e'||U&'\0300'||'me fraiche'` → `23505` (M3, M17)
        - les **invisibles** : puis « Crème\<U+200B\> fraîche » → `23505` (M4, M17)
  - [x] **`unit` nul ne fait PAS deux lignes** — le test qui tient `nulls not distinct` (M2,
        M17 : « Sel » puis « sel », `unit` nul aux deux).
        ⚠️ **Vérifie ses dents** : retire `nulls not distinct` de la migration en local, et ce
        test doit **tomber**. S'il reste vert, il ne mesure rien
  - [x] **`strip_accents` rend ce que le dictionnaire promet** — `crème→creme`,
        `Épinard→Epinard` (**la casse est préservée**, c'est `lower` qui la plie ensuite),
        `œuf→oeuf`. ⚠️ **Ce test n'est PAS de la redondance avec les précédents** : il est le
        seul qui tombera le jour où le dictionnaire d'`unaccent` changera sous nos pieds
        (piège n°2a), et il le fera **avec un message qui dit pourquoi**
  - [x] **Deux unités différentes font DEUX lignes** — le versant AD-7 : « lait / L » et
        « lait / ml » coexistent, et c'est voulu (jamais de conversion)
  - [x] **Le nom non vide** : le client (`normaliserTexte`) n'est jamais plus laxiste que
        `grocery_list_items_nom_non_vide`, dans le seul sens qui blesse

- [x] **Task 4 — Les tests d'isolation** (AC3, AC4 — `supabase/tests/isolation.test.ts`)
      <!-- ⚠️ **ZÉRO test touche cette table aujourd'hui** (M10). AD-17 : l'isolation se prouve
           par un test EXÉCUTÉ. Cette story est la première à en devoir. -->
  - [x] **A ne lit pas les articles de B**, même en nommant leur identifiant
  - [x] **A ne peut ni poser, ni modifier un article chez B** — les deux verbes, séparément
  - [x] **A ne peut pas supprimer son PROPRE article** — c'est l'AC4, et c'est le test le plus
        important du lot. ⚠️ Passe par le client authentifié de A, **jamais par `admin`**
  - [x] **A gère SON article de bout en bout** : insertion, mise à jour, pose du tombstone
        (`update … set deleted_at = now()`), et l'article disparaît de `grocery_list_by_aisle`
        — le témoin positif, sans lequel les tests négatifs pourraient tous passer sur une
        table simplement inaccessible
  - [x] **Le tombstone garde sa clé** (décision D3) : un article supprimé puis « rajouté » par
        un INSERT rend `23505` ; l'UPDATE qui remet `deleted_at` à nul, lui, passe
  - [x] ⚠️ **Vérifie les dents de chaque politique** : la mutation qui mord est
        `using (true) with check (true)`. Supprimer une politique rend la table **plus**
        restrictive et laisse les tests négatifs verts **gratuitement** — mesuré sur la 3.5

- [x] **Task 5 — Les quatre entrées datées de `deferred-work.md`** (§ Ce qui est dû, point 4)
  - [x] `generate_grocery_list_from_menu` → **4.7**, avec les mesures M5 et M6 **citées**
  - [x] L'index d'idempotence `source_ref` → **Epic 6** (AD-12)
  - [x] `added_by` supplanté par `actor_kind`/`actor_id` → **4.6**. ⚠️ Rappelle que
        `recipe_id` est `on delete set null` : un `recipe_id` nul peut vouloir dire « recette
        supprimée » et pas seulement « ajout manuel » (entrée existante du 2026-08-01)
  - [x] `quantity >= 0` et le miroir applicatif de la clé → **4.4**

- [x] **Task 6 — Les deux portes, puis les statuts**
  - [x] `npm run check:migrations` · `npm run lint` · `npm run typecheck`
  - [x] `npm test` — **198 attendus au minimum** (M9). Un nombre qui baisse est un fichier
        perdu, pas un progrès
  - [x] `npm run test:isolation` — **66 attendus au minimum** (M9), plus ceux des Tasks 3 et 4
  - [x] ⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers avant
        de lancer. Tout contrôle neuf doit répondre à : *que se passe-t-il s'il ne trouve rien ?*
  - [x] `Status` du fichier de story → `review`, **puis** `sprint-status.yaml`. Règle §6 bis :
        **le fichier fait foi**, et fermer ailleurs clôt la story sans clore ses conditions

---

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Besoin | Où c'est déjà | Piège si tu le refais |
|---|---|---|
| Le vocabulaire d'unités | `lib/recettes/unites.ts` — `UNITES`, `estUniteConnue` | Une liste recopiée diverge le jour où AD-7 bouge (règle §3) |
| La regex d'invisibles côté base | `20260729095923:80`, reprise par `20260802112511:83` | La retaper : ses `\uXXXX` ne se lisent pas comme des chaînes |
| La normalisation côté client | `lib/texte.ts` — `normaliserTexte` | ⚠️ Elle **détruit les sauts de ligne** ; c'est voulu sur un champ d'une ligne |
| `set_updated_at()` | `20260502000000` (employée par `profiles`, `recipes`) | La réécrire écraserait l'existante pour les deux autres tables |
| `resolve_aisle_id()` | `20260502000000:466` | ⚠️ **Elle est déjà en production.** Elle n'est pas de cette story (4.16) |
| `current_household_id()` | `20260502000000:48` | L'ancre de toutes les politiques. Ne la touche pas |
| Le harnais à deux comptes réels | `supabase/tests/isolation.test.ts:52-113` | Il crée les comptes, les foyers, et nettoie par cascade |
| L'adresse du stack local | `supabase/tests/stack-local.ts` | Rien n'est écrit en dur, et **aucun repli silencieux** |

### Piège n°1 — L'AC2 échoue en silence sur le cas le PLUS courant

**Mesuré (M2).** Avec un index unique ordinaire :

```
insert  (foyer, 'Oignon', null)   → OK
insert  (foyer, 'oignon ', null)  → OK          ← DEUX lignes
```

Un article ajouté **sans unité** est le cas nominal de l'ajout vocal et de l'ajout manuel
rapide. Sans `nulls not distinct`, l'AC2 est faux précisément là où il compte, et **rien ne le
dit** : pas d'erreur, pas de log, deux lignes dans la liste. Le test de la Task 3 existe pour
que ce cas ne puisse pas repasser.

### Piège n°2 — La normalisation vit dans l'index, et l'index repose sur une PROMESSE

**Deux choses distinctes, et la seconde est le prix de la décision D1.**

**a) `immutable` sur `strip_accents` est une promesse, pas un constat.**

`unaccent` est `STABLE` parce que son dictionnaire est un **fichier sur disque**
(`unaccent.rules`), rechargeable, et remplaçable par une montée de version de Postgres. En
déclarant l'enveloppe `immutable`, on jure au planificateur que la fonction rendra toujours la
même chose pour la même entrée — ce qui est **vrai tant que le dictionnaire ne bouge pas**.

Ce que ça coûte le jour où il bouge : l'index contient des clés calculées avec l'ancien
dictionnaire, Postgres ne les recalcule pas, et **une recherche par la clé peut manquer une
ligne qui existe** — sans erreur, sans log, sans rien. C'est le mode de défaillance le plus
discret que ce dépôt aura introduit.

Ce n'est **pas une objection à la décision** — c'est le contournement standard, il est employé
partout, et le risque est petit à cette échelle. Mais il s'écrit :

- **dans l'en-tête de la migration**, en toutes lettres, avec sa contre-mesure : après toute
  montée de version majeure de Postgres, `reindex index grocery_list_items_cle_canonique` ;
- ⚠️ **et il ne se laisse pas déduire.** Règle §1 : « une déduction s'écrit *déduit* ». Que le
  dictionnaire de Supabase ne bougera pas est une **hypothèse**, pas une mesure.

**b) La clé se calcule dans l'index, jamais dans une colonne.**

Il est tentant d'ajouter une colonne `name_canonique` calculée et d'y poser l'unicité. Ne le
fais pas :

- une colonne stockée est une **seconde source de vérité** qui peut diverger de `name` si une
  écriture oublie de la recalculer ;
- une colonne générée (`generated always as … stored`) est de toute façon **impossible ici** :
  Postgres exige une expression `immutable`, et elle le serait — mais elle apparaîtrait dans
  `lib/supabase/types.ts` et dans le contrat PostgREST, donc dans le contrat versionné de la
  story 4.12, pour une valeur qui n'intéresse personne à l'extérieur ;
- l'expression d'index ne coûte rien : M3, M4 et M14 mesurent qu'elle s'indexe.

**Ce que le membre a tapé reste ce que le membre a tapé.** « Oignons jaunes » s'affiche
« Oignons jaunes ».

### Piège n°3 — `intent_at` n'est pas `updated_at`, et les confondre coûte la story 4.10

AD-3, mot pour mot : « le serveur garde, **par champ mutable**, la valeur dont l'intention est
la plus récente — **pas** l'heure d'arrivée. `updated_at` serveur reste l'horodatage
d'affichage/Realtime, **pas l'arbitre**. »

Concrètement : un cochage fait à 09:00 et flushé à 09:30 ne doit pas écraser une modification
de quantité faite à 09:05. C'est `intent_at` qui porte 09:00 ; `updated_at` porterait 09:30 et
donnerait le mauvais gagnant. **Cette story ne fait qu'installer les deux colonnes** — mais
elle installe aussi le trigger, et le trigger doit toucher `updated_at` **seulement**.

### Piège n°4 — « Jamais de DELETE dur » est une politique, pas une intention

`grocery_all … for all` couvre `select`, `insert`, `update` **et `delete`**. Écrire dans le code
applicatif « on ne supprime pas, on tombstone » est exactement le mode de défaillance qu'AD-1 et
AD-2 interdisent : *la règle métier vit en Postgres, jamais dans la vigilance d'une surface*.

Et ce n'est pas théorique sur ce dépôt : l'écriture de la liste sera **client-direct** (AD-13),
donc le membre possède sa clé anon et son jeton. Un `DELETE` PostgREST direct suffit — c'est
exactement la forme d'appel qui a révélé le trou de `meal_plan_entries` le 2026-08-04.

⚠️ **Et dis ce que ça ne couvre pas** : le rôle de service et les fonctions `security definer`.
Une politique est une frontière de RLS, pas une contrainte.

### Piège n°5 — `g.*` dans une vue est un piège dormant, et il vient de se déclencher

**Mesuré (M7, M8).** La vue a été écrite `select g.*, a.name as aisle_name, …`. Postgres
**fige** l'expansion à la création : les six colonnes neuves n'y apparaîtront jamais, et
`create or replace` avec le même texte **échoue** parce qu'il tenterait de renommer
`aisle_name` en `deleted_at`.

La sortie de secours n'est pas `drop view` : c'est la **liste explicite avec les colonnes
neuves appendues à la fin**, mesurée comme acceptée. `drop view` serait plus propre à l'œil et
plus risqué en fait — elle casse les dépendances et sort de l'additivité.

### Piège n°6 — La fonction de génération devient capable d'échouer, sur DEUX chemins

**Mesuré (M5, M6).** Les deux, avec l'index canonique en place :

1. **L'acheté survivant.** La fonction fait `delete … where status = 'pending'`, donc un
   article `bought` de même clé reste. L'INSERT nu qui suit rend `23505`.
2. **Le `group by` trop fin.** Elle groupe par `ri.name, ri.unit, ri.product_id,
   ri.aisle_keyword`. Deux ingrédients de même nom et même unité mais de `product_id`
   différents sortent en **deux lignes** de même clé canonique → `23505`.

**Ne la répare pas ici** (décision D2) : la réparation *est* la story 4.7. **Mais ne la tais
pas non plus.** Elle part dans `deferred-work.md` avec ses deux mesures citées, et l'en-tête de
la migration le dit.

### Piège n°7 — Ce que le tombstone change pour toutes les stories suivantes

L'index est **total** (D3), donc :

- « rajouter un article supprimé » est un **UPDATE** (`deleted_at = null`), jamais un INSERT.
  Une surface qui ferait un INSERT rendrait `23505` sur un geste parfaitement légitime, et le
  message d'erreur ne dirait rien d'utile au membre ;
- toute lecture de liste doit filtrer `deleted_at is null` — la vue le fait maintenant
  (volet 6), mais une lecture directe de la table ne le fait pas ;
- AD-6 le dit déjà pour la génération : « un article tombstoné réclamé par la génération n'est
  **ressuscité que si l'intention de génération > intention de suppression** ».

**Écris-le dans l'en-tête de la migration.** C'est le genre de conséquence qui se redécouvre en
production trois stories plus tard.

### Piège n°8 — Le nom entièrement invisible produit une clé VIDE

Sans `grocery_list_items_nom_non_vide`, un nom composé uniquement d'invisibles donne une clé
canonique `''`. Conséquence : **un seul emplacement par foyer et par unité** pour tous les
articles fantômes, et le second rend `23505` sur un ajout que le membre croit normal. C'est
pour ça que la contrainte et la clé emploient **le même prédicat** — et que la story les pose
dans le même volet.

### Piège n°9 — Le harnais de test traverse la RLS

`supabase/tests/isolation.test.ts` construit `admin` avec `serviceRoleKey`. Ce client **ignore
toutes les politiques**. Il sert à préparer et à nettoyer, jamais à mesurer.

Deux faux positifs déjà trouvés sur ce dépôt (story 2.2) : sous RLS, A ne peut pas lire les
identifiants de B, donc un test inter-foyers doit les obtenir du client `admin`, faute de quoi
il passe **en ne prouvant rien**. Le motif correct est aux lignes 52-113.

### Piège n°10 — Aucune microcopy dans cette story, et ce n'est pas un oubli

Aucune chaîne n'est rendue à l'écran : cette story n'a pas de surface. **N'invente pas de
message d'erreur**, ne crée pas de `lib/liste/erreurs.ts`. La traduction de `23505` et de
`23514` en français appartient à la story **4.4**, la première qui ajoute un article depuis un
écran — et elle reprendra le motif de `lib/foyer/erreurs.ts` (SQLSTATE d'abord, texte en repli).

⚠️ **Corollaire** : les mots bannis (synchronisation, jeton, API, MCP, pont, Supabase, RLS,
cache) ne peuvent pas apparaître à l'écran depuis cette story. Ils peuvent et doivent apparaître
dans les commentaires SQL — ce sont les bons mots pour parler à un développeur.

### Frontières — ce que cette story ne fait pas

**Elle ne fait AUCUN de ces points, et chacun a sa story :**

| Hors périmètre | Sa story |
|---|---|
| Lire la liste depuis une surface, client-direct | 4.2 |
| Cocher / décocher | 4.3 |
| L'UPSERT-incrémente, la traduction des erreurs à l'écran, `quantity >= 0` | 4.4 |
| Supprimer, archiver, vider — le chemin d'écriture du tombstone | 4.5 |
| Afficher / exploiter la provenance | 4.6 |
| Réparer `generate_grocery_list_from_menu` | 4.7 |
| Le service worker, IndexedDB, l'outbox | 4.8, 4.9 |
| L'arbitrage LWW par champ (la logique, pas les colonnes) | 4.10 |
| Realtime | 4.11 |
| Le versionnage du contrat | 4.12 |
| `resolve_aisle_id` câblée sur l'ajout | 4.16 |
| Le groupe « À classer » à l'écran | 4.17 |
| L'unicité de `source_ref` (idempotence du pont) | Epic 6 |
| `device_credentials`, `actor_kind = 'device'` en pratique | Epic 5 |

⚠️ **Cette story POSE les colonnes que ces stories liront.** Poser une colonne n'est pas
implémenter la règle qui s'appuie dessus — et écrire la règle ici serait la réécrire là-bas.

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — la règle métier vit en **Postgres**. C'est tout le volet 5 : le DELETE ne
  se retire pas par convention de code. Jamais de `SUPABASE_SERVICE_KEY` côté application (le
  seul porteur légitime est le harnais d'isolation, comme témoin négatif)
- **AD-3** — **le texte de référence de cette story.** Clé canonique
  `(household_id, nom normalisé, unité)`, LWW **par champ** sur **intention client**, tombstone
  `deleted_at`, `updated_at` **posé serveur** et **non arbitre**. Relis-le en entier avant
  d'écrire le SQL
- **AD-7** — vocabulaire d'unités fermé ; **deux unités différentes ne sont jamais additionnées
  ni converties** — donc deux lignes, et le test le mesure
- **AD-9 / NFR-6** — provenance **polymorphe** `(actor_kind, actor_id)` ; un appareil n'est
  **jamais** une FK `profiles`
- **AD-12** — `source_ref` est la colonne d'idempotence du pont. Elle naît ici ; **son index
  unique n'est pas de cette story**
- **AD-13** — écritures **client-direct**. Aucune Server Action n'est due : ni secret serveur,
  ni `revalidatePath` — et de toute façon aucune surface
- **AD-16** — la RLS est **par FOYER, pas par membre**. `profiles` n'a aucune colonne de rôle.
  N'invente aucun contrôle applicatif pour distinguer les membres
- **AD-17** — deux familles nommées : tests de **RLS** (Task 4) et tests de **convergence**
  (Task 3). Cette story ouvre les deux sur cette table, qui n'en avait aucun (M10)
- **NFR-2** — la convergence est ce que la clé canonique rend possible : **aucune ligne à
  fusionner**
- **NFR-5** — l'isolation entre foyers est la seule chose que ce produit ne peut pas se
  permettre de casser
- **NFR-10** — **aucune dépendance npm nouvelle** : `package.json` reste intact.
  ⚠️ **UNE extension Postgres est ajoutée — `unaccent` — et c'est une décision assumée**
  (D1, Florian, 2026-08-05). Elle est **livrée avec Postgres** (contrib), pas tirée d'un tiers,
  et n'ajoute ni service à surveiller ni entretien hebdomadaire — ce que NFR-10 vise. Son coût
  réel n'est pas le paquet : c'est la promesse d'immutabilité du piège n°2
- **AR-MIGRATIONS** — additive, horodatée après toutes les existantes, jamais retouchée après
  application, requête de contrôle en en-tête. ⚠️ **Resserrer une contrainte demande de
  vérifier d'abord que les données existantes la respectent** — c'est exactement ce que fait la
  requête de la Task 1, et c'est pour ça qu'elle porte quatre volets

### Standards de test

**Comptes MESURÉS le 2026-08-05 sur `68dcd42`** (`origin/main`, story 7.1 contextualisée) :

| Suite | Commande | État mesuré |
|---|---|---|
| Unitaires | `npm test` (glob `lib/**/*.test.ts`) | **198 / 198**, `duration_ms 174.8` — **exécuté** |
| Isolation & contraintes | `npm run test:isolation` (glob `supabase/tests/**/*.test.ts`) | **66 / 66**, `duration_ms 1680` — **exécuté**, stack local debout |

**Où va quoi :**

1. **`npm test`** — **rien de neuf n'y va.** Cette story n'écrit aucun code applicatif pur. Si
   tu te retrouves à créer un fichier dans `lib/`, relis les frontières
2. **`supabase/tests/contraintes.test.ts`** — l'accord `UNITES` ↔ contrainte, l'accord
   `normaliserTexte` ↔ `nom_non_vide`, et les cinq familles que la clé canonique fusionne
3. **`supabase/tests/isolation.test.ts`** — les quatre verbes chez B, le DELETE refusé chez
   soi, le parcours complet de A, et le tombstone qui garde sa clé

⚠️ **`node --test` sur un glob vide rend 0.** Un fichier mal nommé rend la CI verte sans une
assertion ; les deux jobs comptent donc les fichiers avant de lancer. **Tout contrôle neuf doit
répondre à : que se passe-t-il s'il ne trouve rien à contrôler ?**

⚠️ **Vérifie les dents de CHAQUE contrainte, une par une.** Le dépôt a déjà mesuré une
contrainte sans aucune dent : retirer `recipe_ingredients_nom_non_vide` laissait **55/55**
vertes, alors que la story affirmait le contraire. La méthode : retire la ligne en local,
`db reset`, et le test doit **tomber**. Sept contraintes/index/politiques dans cette
migration — **sept passages au banc**, dont le `nulls not distinct` et le `strip_accents` de
la clé, qui se retirent **séparément** : retirer l'un doit faire tomber le test de l'unité
nulle, retirer l'autre celui des accents. Si un seul retrait fait tomber les deux, un des deux
tests ne mesure pas ce qu'il croit.

⚠️ **Le test qui a le plus de valeur ici est le témoin POSITIF** : « A gère SON article de bout
en bout ». Sans lui, tous les tests négatifs pourraient passer sur une table simplement
inaccessible — et c'est la forme de faux positif la plus difficile à voir.

### Project Structure Notes

```
supabase/migrations/
  <horodatage>_poser_le_modele_canonique_de_la_liste.sql   +  LA migration, SEPT volets :
                                                              unaccent + strip_accents ·
                                                              colonnes · contraintes · clé
                                                              canonique · trigger · RLS · vue
supabase/tests/
  contraintes.test.ts         ~  unités fermées, nom non vide, les 3 familles de la clé
  isolation.test.ts           ~  la table n'y a AUCUN test aujourd'hui (M10)
  stack-local.ts              INCHANGÉ
lib/supabase/types.ts         ~  RÉGÉNÉRÉ — le diff n'est PAS vide : 6 colonnes, 6 de vue,
                                 et `strip_accents` dans `Functions`
lib/recettes/unites.ts        INCHANGÉ — la source du vocabulaire, lue par le test
lib/texte.ts                  INCHANGÉ — la source de la normalisation cliente
_bmad-output/implementation-artifacts/
  deferred-work.md            ~  QUATRE entrées datées (Task 5)
  sprint-status.yaml          ~  statut
app/                          INTACT — cette story n'a aucune surface
lib/liste/                    N'EXISTE PAS, et ne doit pas naître ici (piège n°10)
package.json                  INTACT — aucune dépendance (NFR-10)
```

⚠️ **Si tu te retrouves à écrire du TSX, arrête-toi et relis les frontières.** Cette story
touche `supabase/` et `lib/supabase/types.ts`, et rien d'autre.

⚠️ **Une seule migration.** Si tu en écris deux, relis la Task 1 : `db push` n'est pas atomique
sur un lot, et les sept volets se contrôlent par la même requête.

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session.** Sept règles mordent ici :

- **§1 — Ne consigner comme vérifié que ce qui a été exécuté, en citant la commande.** Cette
  story distingue partout le **mesuré** du **déduit** : les huit sondes ont été exécutées, la
  vacuité de la production est **déduite**. ⚠️ **`SUPABASE_DB_URL` est absent de `.env.local`**
  (M12) : tu ne peux pas exécuter la requête de contrôle. **Une case vide honnête vaut mieux
  qu'une case cochée à tort.**
- **§2 — Un commentaire explique un pourquoi, jamais un état de la base.** Les commentaires du
  squelette sur `grocery_list_items` sont déjà faux : `initial_schema.sql:162` annonce cinq
  unités dont « piece » sans accent. **Tu peux les corriger dans TON fichier, jamais dans le
  leur** — une migration appliquée ne se retouche plus.
- **§3 — Une énumération ne peut pas gagner contre une catégorie.** Ici : la regex d'invisibles
  s'extrait de la migration existante, et `UNITES` est la source du test, pas une liste
  recopiée.
- **§4 — Un invariant entre deux fichiers se mesure.** Il y en a **trois** dans cette story :
  la regex du volet 2 ↔ celle du volet 3, `UNITES` ↔ `grocery_list_items_unite_fermee`, et
  `normaliserTexte` ↔ `grocery_list_items_nom_non_vide`. **Les trois se mesurent** (Task 3).
- **§5 — Une prémisse qui sert à reporter un défaut se rouvre avant d'être réinvoquée.** C'est
  la décision D2 : « la fonction n'est appelée par personne » est une prémisse. Elle est
  **mesurée** (M11), pas supposée — et elle est datée pour la 4.7.
- **§6 — Revue adversariale par story, et la passe de correction doit être revue à son tour.**
  Trois des six défauts majeurs de l'Epic 1 ont été **introduits par une passe de revue**.
- **§6 bis — Le `Status` du fichier de story se ferme AVEC le suivi de sprint.** **Le fichier
  fait foi.**

### Intelligence git — ce que les six derniers commits t'apprennent

| Commit | Ce qu'il enseigne à cette story |
|---|---|
| `68dcd42` docs(story-7.1) | La story 7.1 a été contextualisée avec **quatre décisions ouvertes**, dont le mécanisme d'identité lui-même. Elle dépend d'`actor_kind = 'device'` — donc de colonnes que **cette** story crée |
| `9c127d4` feat(menu) (3.6) | **Le motif exact à reprendre** : une migration à volets multiples, un en-tête qui explique chaque volet, la requête de contrôle en tête, `gen types --local`. Lis `20260804144217` en entier avant d'écrire |
| `7277c8b` fix(recettes) revue 3.2 | Une passe de correction faite **après** la fusion. Neuf correctifs, et le motif : *la story a mesuré ce qu'elle avait prévu de mesurer, et rien d'autre* |
| `86fafe7` feat(rayons) (2.2) | Fusionnée **sans revue adversariale**, sur décision. Six défauts d'usage ensuite, tous dans du JSX qu'aucun test n'exécute. ⚠️ **Sans objet ici** : cette story n'a pas une ligne de JSX — tout son contenu est testable, donc rien n'excuse un test manquant |
| `2ad08c4` fix(migrations) | Une garde de déploiement ajoutée **après** qu'elle eut coûté un déploiement. Le script de migration refuse maintenant l'hôte de connexion directe |
| `f29c1a1` feat(rayons) (2.1) | ⚠️ **Le trou de `seed_default_aisles`** : une fonction `security definer` qui recevait une identité en paramètre sans la recontrôler. **Onze tests d'isolation ne le voyaient pas** parce qu'ils portaient tous sur des tables |

### Environnement de test

- **Le stack local est debout** au 2026-08-05 (`npx supabase status` — mesuré). API sur
  `http://127.0.0.1:55321`, base sur `:55322`, Studio sur `:55323`
- **`npx supabase db reset`** est l'outil normal en local, et **interdit sur le distant**
- **Les prévisualisations Vercel parlent à la base de PRODUCTION.** Un critère qui dépend d'une
  migration de la PR **n'y est pas démontrable** — la migration n'y est pas appliquée. ⚠️ Toute
  cette story est dans ce cas : **elle se démontre en local, exclusivement**
- **Le serveur de développement n'a rien à voir ici** : aucune surface. Ne le lance pas pour
  « vérifier », il n'y a rien à voir
- **Sonder directement la base** : `docker exec -i supabase_db_nutriclaude psql -U postgres -d
  postgres` — c'est ainsi que les huit mesures de cette story ont été prises. ⚠️ **Chaque sonde
  dans un `begin … rollback`**, sans exception

### References

- `_bmad-output/planning-artifacts/epics.md#Story-4.1` — les quatre AC, cités verbatim
- `_bmad-output/planning-artifacts/architecture/architecture-nutriclaude-2026-07-23/ARCHITECTURE-SPINE.md`
  — **AD-3** (clé canonique, LWW par champ, tombstone), AD-4, AD-6, AD-7, AD-9, AD-12,
  Consistency Conventions (ERD `grocery_list_items`)
- `_bmad-output/project-context.md` — les sept règles de méthode, les motifs à reprendre
- `docs/migrations.md` — additivité, nommage, application au déploiement, ce que
  `db push` ne garantit pas sur un lot
- `supabase/migrations/20260502000000_initial_schema.sql` — `:194-229` la table et la vue,
  `:320-323` la politique `grocery_all`, `:466` `resolve_aisle_id`, `:527-580`
  `generate_grocery_list_from_menu`
- `supabase/migrations/20260804144217_contraindre_les_assignations_de_menu.sql` — **le modèle
  d'en-tête à volets** de cette migration
- `supabase/migrations/20260802112511_require_valid_recipe_ingredient_fields.sql` — `:78`
  l'unité fermée, `:83` la regex de nom non vide (à **extraire**, pas à retaper)
- `lib/recettes/unites.ts` + `lib/recettes/unites.test.ts` — le vocabulaire fermé et son contrat
  explicite avec l'Epic 4
- `lib/texte.ts` — pourquoi NFC vient en premier, et pourquoi une énumération perd
- `supabase/migrations/20260729094500_grant_table_privileges.sql` — `alter default privileges
  … grant all on functions`, qui couvre `strip_accents` sans qu'on écrive un `grant`
- Documentation PostgreSQL, `unaccent` — la volatilité des deux formes et l'enveloppe
  `immutable`. ⚠️ **La sagesse commune (« la forme à deux arguments est `IMMUTABLE` ») est
  fausse sur PG 17.6** : mesuré en M13, les deux sont `STABLE`
- `supabase/tests/contraintes.test.ts`, `supabase/tests/isolation.test.ts` — les deux motifs de
  test, et le harnais à deux comptes réels
- `_bmad-output/implementation-artifacts/deferred-work.md` — `:387` (`recipe_id` en
  `on delete set null`), `:32` (les RPC de la base gelée)

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, `dev-story`), 2026-08-05.

### Debug Log References

Toutes les commandes ci-dessous ont été **exécutées**, sur le stack local
(PostgreSQL 17.6, `supabase_db_nutriclaude`). Ce qui n'a pas été exécuté est dit tel quel.

| Commande | Résultat |
|---|---|
| `npm run check:migrations` | **16 migrations, 14 avec requête de contrôle, 2 exemptées, 0 sans** |
| `npm run typecheck` | vert |
| `npm run lint` | vert (`--max-warnings 0`) |
| `npm test` | **198 / 198** — inchangé, et c'est le résultat attendu : aucun code applicatif n'a été écrit |
| `npm run test:isolation` | **87 / 87** (66 avant la story, **+21**) |
| `npx supabase db reset` | rejoué **quatre fois** — la migration passe après toutes les précédentes, sur base vierge |
| `npx supabase gen types typescript --local` | 53 insertions, 4 suppressions |

**Requête de contrôle de la migration — exécutée sur le STACK LOCAL le 2026-08-05, avant
application** (décision de Florian : cette story se démontre en local) :

| Volet contrôlé | Lignes rendues |
|---|---|
| 0. contexte (`count(*)`, achetés) | **0 article, 0 acheté** |
| 1. doublons sur la clé canonique | **0** |
| 2. unités hors vocabulaire fermé | **0** |
| 3. noms qui ne montrent rien | **0** |

⚠️ **C'est une mesure LOCALE, et « local » n'est pas « production ».** Sur le distant, que la
table soit vide reste une **DÉDUCTION** — appuyée sur le fait, mesuré, qu'aucun code applicatif
ne touche cette table et que `generate_grocery_list_from_menu` n'a aucun point d'appel. La
requête est en tête de la migration pour être exécutée en revue.

### Completion Notes List

**Ce qui a été livré** — une migration à sept volets, `20260805092611_poser_le_modele_canonique_de_la_liste.sql` :

1. `unaccent` (schéma `extensions`) + `public.strip_accents`, enveloppe `immutable`
2. six colonnes : `actor_kind`, `actor_id`, `source_ref`, `intent_at`, `updated_at`, `deleted_at`
3. trois contraintes : `unite_fermee`, `nom_non_vide`, `acteur_connu`
4. `grocery_list_items_cle_canonique` — index unique, expression à quatre opérations, `nulls not distinct`, **total**
5. le trigger `set_updated_at` (réemployée, jamais réécrite)
6. `grocery_all` remplacée par `grocery_select` / `grocery_insert` / `grocery_update` — **aucune politique DELETE**
7. `grocery_list_by_aisle` : liste explicite de colonnes, filtre `deleted_at is null`

**La regex d'invisibles a été EXTRAITE PAR SCRIPT** de `20260802112511:83`, jamais retapée, et
l'identité aux octets entre ses deux emplacements exécutables (contrainte et index) a été
vérifiée par script : **89 octets, identiques entre elles et à la source.**

---

**⚠️ ONZE PASSAGES AU BANC DES DENTS, ET ILS ONT TROUVÉ DEUX AFFIRMATIONS FAUSSES.**

Chaque objet a été retiré isolément, la suite relancée, et le test qui devait tomber vérifié :

| Objet retiré | Tests qui tombent |
|---|---|
| `nulls not distinct` de l'index | l'unité NULLE, **et lui seul** |
| `strip_accents` de la clé | les ACCENTS, **et lui seul** |
| `normalize(NFC)` de la clé | ⛔ **AUCUN — trou trouvé, voir ci-dessous** |
| `regexp_replace` de la clé | les INVISIBLES, et lui seul |
| `lower()` de la clé | la CASSE, les ACCENTS, l'unité NULLE |
| `grocery_list_items_unite_fermee` | l'unité hors vocabulaire |
| `grocery_list_items_nom_non_vide` | le nom entièrement invisible |
| `grocery_list_items_acteur_connu` | `actor_kind` |
| une politique DELETE ajoutée | « A ne peut pas SUPPRIMER son propre article » |
| les 3 politiques → `using(true) with check(true)` | **6 tests d'isolation** |
| `deleted_at is null` retiré de la vue | « A gère SON article de bout en bout » |
| `security_invoker` retiré de la vue | « A ne lit pas les articles de B » |
| `with check` de `grocery_update` | ⛔ **AUCUN — second trou, voir ci-dessous** |

**Trou n°1 — le test NFC n'avait aucune dent.** La contextualisation prescrivait
`normalize(name, NFC)` en première opération de la clé, et un test « fusionne les formes NFC et
NFD » censé le tenir. Mesuré : retirer `normalize` laisse ce test **vert**, parce
qu'`unaccent` retire les diacritiques combinants tout seul
(`strip_accents('cr'||'e'||U&'\0300'||'me')` → `creme`). La première opération de la clé
n'était donc tenue par **rien**.

*Corrigé, et pas contourné* : un test neuf — « la clé canonique COMPOSE avant de comparer » —
oppose les jamo Hangul décomposés à la syllabe précomposée, cas qu'`unaccent` **ne** confond
pas et que `normalize` confond. Vérifié au banc : il tombe quand `normalize` est retirée, et
lui seul. Le test d'origine est conservé (il mesure un comportement attendu de la clé), avec
son commentaire corrigé pour dire ce qui le tient réellement.

**Trou n°2 — `with check` sur `grocery_update` n'est pas ce qui refuse un déplacement
inter-foyers.** La story et l'en-tête de migration l'affirmaient. Mesuré en
`set local role authenticated` avec un claim JWT forgé :

```
with check (true) + grocery_select using (household_id = …)  →  42501, REFUSÉ
with check (true) + grocery_select using (true)              →  ACCEPTÉ
with check (true) + grocery_select supprimée                 →  refusé
```

C'est la politique **SELECT** qui refuse la ligne d'arrivée : Postgres exige que le nouvel état
d'une ligne mise à jour reste visible à celui qui la modifie.

*Le `with check` est GARDÉ* — même raison que l'égalité redondante de `20260804144217` : il dit
ce que la règle **exige**, au lieu de dépendre d'une propriété d'une politique voisine que rien
ne mesure ici. Mais **les deux commentaires qui l'affirmaient ont été corrigés** (migration
volet 6, `isolation.test.ts`), et le fait qu'aucun test ne le fasse tomber est **écrit** plutôt
que laissé croire (règle §1).

---

**⚠️ CE QUI RESTE OUVERT, DATÉ PLUTÔT QU'EFFACÉ** (`deferred-work.md`, entrée du 2026-08-05) :

- ⛔ **`generate_grocery_list_from_menu` est cassée** — `23505` sur deux chemins mesurés, et
  elle fait toujours un DELETE dur. Adressée à la **4.7**, sur décision de Florian. **L'AC4 est
  donc tenu POUR LES SURFACES, et pas pour cette fonction `security definer`.** C'est la seule
  condition de cette story qui se ferme en étant datée.
- L'index d'idempotence de `source_ref` → **Epic 6** ; `added_by` supplantée → **4.6** ;
  `quantity >= 0` et `normaliserNomArticle` → **4.4**.
- `household_invites_valides` (`20260728133837`) n'a **pas** été auditée sur le piège du `g.*`
  figé, alors que la 4.1 vient de le mesurer sur `grocery_list_by_aisle`.

**⚠️ CE QUE PERSONNE N'A ENCORE FAIT** : la requête de contrôle sur la **production**, et une
revue adversariale de ce travail (règle §6 — trois des six défauts majeurs de l'Epic 1 sont nés
d'une passe de revue non revue). Aucun écran n'est concerné : cette story n'a pas de surface,
donc pas de parcours visuel à faire.

### File List

| Fichier | État |
|---|---|
| `supabase/migrations/20260805092611_poser_le_modele_canonique_de_la_liste.sql` | **nouveau** — la migration, sept volets |
| `supabase/tests/contraintes.test.ts` | modifié — +13 tests (clé canonique, unités, nom, `actor_kind`, `strip_accents`), + import de `normaliserTexte` |
| `supabase/tests/isolation.test.ts` | modifié — +8 tests (lecture, écriture, DELETE refusé, témoin positif, tombstone, déplacement, anonyme) |
| `lib/supabase/types.ts` | régénéré — 6 colonnes, 6 colonnes de vue, `strip_accents` |
| `_bmad-output/implementation-artifacts/deferred-work.md` | modifié — entrée datée du 2026-08-05 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |
| `_bmad-output/implementation-artifacts/4-1-…-isolation-rls.md` | modifié — ce fichier |

⚠️ **Aucun fichier sous `app/` ni `lib/` (hors types régénérés).** C'était la frontière de la
story, et elle est tenue : `package.json` est intact, aucune dépendance npm ajoutée (NFR-10).

### Review Findings

**Revue adversariale du 2026-08-05** — trois couches parallèles (Blind Hunter, Edge Case Hunter,
Acceptance Auditor) plus les sondes du relecteur. Les cinq portes ont été **réexécutées** :
`check:migrations` 16/14/2/0, `lint` vert, `typecheck` vert, `npm test` **198/198**,
`npm run test:isolation` **87/87** — les chiffres du Dev Agent Record sont exacts.

⚠️ **Tout ce qui suit a été MESURÉ** (`docker exec … psql`, chaque sonde en `begin … rollback`),
sauf mention « déduit » explicite.

#### Décisions — les six TRANCHÉES par Florian le 2026-08-05, en revue

*Cinq deviennent des correctifs, une part en report. Elles restent écrites ici avec la mesure
qui les motive, pour que celui qui applique sache **pourquoi** et pas seulement **quoi**.*

- [x] [Review][Patch] **⛔ L'AC4 est défait par un chemin ouvert aux surfaces** — `generate_grocery_list_from_menu` est `security definer` détenue par `postgres`, avec `EXECUTE` accordé à `anon` ET `authenticated` (`proacl` mesuré). **Mesuré** en `set local role authenticated` avec le claim d'un profil réel : `select public.generate_grocery_list_from_menu('2026-08-01','2026-08-07')` fait passer le foyer de **2 lignes (dont 1 tombstone) à 0**, tombstones compris. L'écriture étant client-direct (AD-13), le membre possède sa clé anon et son jeton : `POST /rest/v1/rpc/…` suffit — **exactement la forme d'appel que l'en-tête du volet 6 cite lui-même** à propos de `meal_plan_entries`. La prémisse de D2 (« aucun point d'appel, la casse est dormante ») est mesurée sur le **source TypeScript** ; elle ne dit rien de la surface REST, qui est ouverte. Règle §5 : la prémisse se rouvre avant d'être réinvoquée. **Ceci n'attaque pas D2** — réparer la fonction reste la 4.7. ✅ **TRANCHÉ — `revoke execute` dans cette migration.** `revoke execute on function public.generate_grocery_list_from_menu(date, date) from anon, authenticated;`, en huitième volet. Le corps de la fonction n'est **pas** touché : D2 reste entière et la réparation demeure la story 4.7. Ce que ce volet ferme, c'est le **second chemin de suppression**, exactement comme le volet 6 a fermé le premier. Sans risque de rupture : M11 mesure zéro point d'appel. ⚠️ Un test est dû — « un membre authentifié ne peut pas appeler la génération » — et il doit passer par le client authentifié de A, jamais par `admin`.
- [x] [Review][Patch] **⛔ L'AC2 est faux pour une famille entière d'invisibles — l'énumération perd contre la catégorie** — **Mesuré** : trois `insert` de `'Creme fraiche'`, `'Creme fraiche'||chr(917760)` (U+E0100) et `'Creme fraiche'||chr(6159)` (U+180F) dans le même foyer et la même unité → **`count(*) = 3`**. Trois lignes rigoureusement identiques à l'œil, aucune ne fusionnera jamais. Le Blind Hunter dénombre **241** points de code `Default_Ignorable` qui ne sont retirés ni par `[^[:graph:]]` ni par la liste `[͏…ﾠ]` — dont U+180F, **voisin immédiat de la plage `᠋-᠎` énumérée** (ajouté en Unicode 14), et tout le bloc U+E0100–U+E01EF. C'est littéralement la règle §3, et `lib/texte.ts:18-25` documente la leçon déjà payée deux fois. ⚠️ **La regex elle-même est pré-existante** (`20260802112511:84`, extraite par script, identité aux octets vérifiée) — ce qui est neuf, c'est son emploi dans une **expression d'index unique**, où le coût d'un manque n'est plus un champ mal rempli mais un doublon irrécupérable, sur une table alimentée par la dictée et le pont Google (AD-12). Postgres n'a pas de propriété Unicode : c'est le compromis que le dépôt avait arbitré. ✅ **TRANCHÉ — étendre l'énumération aux plages MESURÉES.** Les points de code à ajouter s'établissent **par sonde**, jamais de mémoire : énumérer sur `generate_series` les points que ni `[^[:graph:]]` ni la liste actuelle ne retirent, et étendre la liste à ce qui en sort (U+180F, U+E0100–U+E01EF, et le reste des 241). ⚠️ **La regex reste identique à ses deux emplacements exécutables** (contrainte volet 3, index volet 4) — l'identité aux octets se revérifie par script après modification. ⚠️ **La regex source de `20260802112511:84` n'est PAS retouchée** : une migration appliquée ne se retouche plus ; les deux formes divergeront donc, et **ça s'écrit** dans l'en-tête plutôt que se découvrir. ⚠️ **Et la règle §3 reste vraie** : c'est la troisième rédaction d'une énumération que le dépôt sait perdante — la limite se date dans `deferred-work.md`, elle ne se déclare pas fermée.
- [x] [Review][Patch] **`intent_at`, l'arbitre du LWW, n'a aucune borne** — **Mesuré** : `insert … (intent_at) values ('infinity'::timestamptz)` accepté. Le volet 2 explique longuement pourquoi le `null` serait fatal et pose le `not null`, mais rien ne borne la valeur, et `grocery_insert`/`grocery_update` ne regardent que `household_id`. Écriture client-direct : un appareil à l'horloge décalée — ou un appel forgé — **gagne définitivement tout arbitrage** pour les stories 4.5, 4.9 et 4.10. ✅ **TRANCHÉ — `check (intent_at <= now() + interval '1 day')`, posée maintenant.** Faisabilité **mesurée en revue** : Postgres accepte `now()` dans un `CHECK` — `intent_at = now()` passe, `'infinity'` rend `23514`. ⚠️ **C'est un garde-fou, PAS la politique LWW** : celle-ci reste la 4.9 (l'horloge du geste) et la 4.10 (l'arbitrage). La borne est volontairement **généreuse** — un jour — pour qu'une horloge d'appareil légèrement en avance ne soit jamais refusée. ⚠️ **Une contrainte qui emploie `now()` n'est évaluée qu'à l'écriture** : elle ne se revalide pas, et c'est bien ce qu'on veut ici.
- [x] [Review][Patch] **Aucune borne de longueur sur `name` : la clé rend `54000`, pas un refus lisible** — **Mesuré** : un nom incompressible de 3840 caractères rend `index row size 3880 exceeds btree version 4 maximum 2704`. ⚠️ **Le défaut est intermittent selon l'entropie** — `repeat('a', 3000)` passe, la compression d'index masquant le seuil. Le plafond de 120 points de code n'existe **que côté client** (`normaliserTexte(saisie, 120)`), or AD-1/AD-2 disent précisément de ne pas confier ça à une surface. Mesuré aussi : **aucune contrainte de longueur nulle part dans le schéma** — les bornes vivent côté client, dans les modules de domaine (`MAX_NOM_RAYON = 40`, `MAX_TITRE = 80`). ✅ **TRANCHÉ — `check (length(name) <= 200)`, généreuse et posée maintenant.** ⚠️ **Elle rompt délibérément la convention du dépôt, et voici pourquoi** : aucune autre colonne n'est dans une **expression d'index unique**, et c'est exactement ce qui rend `54000` atteignable. ⚠️ **Cette borne n'est PAS la règle produit** : elle empêche un plantage btree. Le vrai `MAX_NOM_ARTICLE` appartient à la story **4.4**, avec `normaliserNomArticle` et le premier écran d'ajout. Le désaccord qui en résulte — client 120, base 200 — est celui que le dépôt qualifie lui-même de **bénin** (« le client refuse, la base accepterait »), et jamais l'inverse.
- [x] [Review][Defer] **Rien n'attache `actor_id` à l'appelant** — reporté vers la story **4.6** — **Mesuré** : `grocery_insert` porte `with check (household_id = current_household_id())` et rien d'autre. Un membre peut donc attribuer un article à un autre membre de son foyer. La provenance de FR-7 est auto-déclarée par le client. ✅ **TRANCHÉ — reporté à la 4.6.** *Raison :* la forme correcte dépend de l'**Epic 5**, où `actor_kind = 'device'` rend `auth.uid()` dépourvu de sens ; aucune surface n'écrit encore cette colonne ; et se tromper de forme ici coûterait une migration corrective. C'est le seul des quatre invariants trouvés en revue dont cette story n'a pas les éléments pour trancher — la 4.6 possède le chemin de lecture de la provenance. La candidate est `with check (actor_kind is distinct from 'profile' or actor_id = auth.uid())`.
- [x] [Review][Patch] **`lib/supabase/types.ts` a dérivé au-delà du schéma de la story** — Le diff retire `__InternalSupabase: { PostgrestVersion: "14.5" }` et ajoute un schéma `graphql_public` entier. **Mesuré** : PostgREST tourne toujours en **v14.5** (`public.ecr.aws/supabase/postgrest:v14.5`) — ce n'est donc pas le schéma qui a bougé, c'est la CLI. `package.json` n'épingle **aucune** version de `supabase` ; `npx supabase --version` rend **2.111.0**, une autre que celle qui a produit la ligne de base. Conséquences mesurées : `lib/supabase/types.ts:688` porte encore `Omit<Database, "__InternalSupabase">`, une omission d'une clé qui n'existe plus (légale, donc `typecheck` reste vert, mais l'expression ne fait plus rien) ; et `graphql_public` entre dans le contrat que la story **4.12** devra geler. Le Dev Agent Record consigne « 53 insertions, 4 suppressions » sans dire que 4 d'entre elles ne sont pas de cette story. ✅ **TRANCHÉ — régénérer avec la version d'origine de la CLI**, pour que le diff ne porte que les 6 colonnes, les 6 colonnes de vue et `strip_accents`. ⚠️ **Pas de `devDependency` ajoutée** : NFR-10 tient, et l'outillage reste hors de `package.json`. ⚠️ **Conséquence assumée et à ÉCRIRE, pas à taire** : rien n'empêche la prochaine régénération, par quelqu'un d'autre, de rejouer la même dérive. La version employée se consigne dans le Dev Agent Record, et le problème de reproductibilité se **date** dans `deferred-work.md` — il n'est pas résolu, il est circonscrit.

#### Correctifs

- [x] [Review][Patch] **⛔ Le volet 1 est un no-op silencieux si `unaccent` préexiste dans `public` — la migration meurt en plein déploiement** [`supabase/migrations/20260805092611_poser_le_modele_canonique_de_la_liste.sql`:356] — **Mesuré** de bout en bout : après `create extension unaccent with schema public`, le `create extension if not exists … with schema extensions` rend `NOTICE: extension "unaccent" already exists, skipping`, **l'extension reste dans `public`**, et la ligne suivante échoue en `ERROR: text search dictionary "extensions.unaccent" does not exist`. Comme il n'y a plus de `db push` humain (`vercel.json` → `scripts/migrer-au-deploiement.mjs`), ça se produirait **pendant un déploiement Vercel** — le scénario même que l'en-tête invoque pour justifier « un seul fichier, sept volets ». La sonde prescrite au relecteur est `where extname = 'unaccent'` ; elle doit porter sur **`extnamespace`**. Correctif : garde `do $$ … raise exception …` ou `alter extension unaccent set schema extensions` conditionnel, plus la sonde corrigée dans l'en-tête.
- [x] [Review][Patch] **La requête de contrôle n°1 porte la regex SIMPLIFIÉE, contre la prescription de la story, et elle sous-détecte** [`20260805092611`:26 et :39] — La Task 1 dit mot pour mot : « Celle du fichier de migration porte la regex **complète**, extraite par script. » Le fichier fait l'inverse (`:46-47`). **Mesuré** : `'Sel'+U+3164` vs `'Sel'` → le contrôle voit `selㅤ ≠ sel`, **aucun doublon** ; l'index réel voit `sel = sel` → `23505`. Idem requête 3 : un nom `U+3164` seul est rendu **0 ligne** par le contrôle et **refusé** par `nom_non_vide`. Conséquence : « zéro ligne aux quatre » **ne prouve pas** que les volets 3 et 4 s'appliqueront sur le distant, où la vacuité est déduite de l'aveu même de la story.
- [x] [Review][Patch] **`updated_at` n'est PAS posé serveur à l'INSERT** [`20260805092611`:401] — Le trigger est `before update` seul (`pg_trigger.tgtype = 19` = `ROW|BEFORE|UPDATE`, mesuré). **Mesuré** : `insert … (updated_at) values ('1970-01-01Z')` est conservé tel quel, et `lib/supabase/types.ts` expose bien `updated_at?` en `Insert`. Or le volet 5 s'intitule « `updated_at` POSÉ SERVEUR », et AD-3 en fait l'horodatage de **Realtime** : une lecture incrémentale `where updated_at > dernier_vu` raterait la ligne pour toujours. Aucun test ne mesure le versant INSERT. Correctif : `before insert or update`, ou réduire le titre du volet à ce qu'il tient.
- [x] [Review][Patch] **`nom_non_vide` et la clé n'emploient PAS le même prédicat — la clé vide reste atteignable, et deux commentaires affirment l'inverse** [`20260805092611`:383 contre :391-397] — La contrainte applique la regex à `name` **nu** ; la clé applique en plus `normalize(NFC)` puis `strip_accents`. **Mesuré** : `insert (name) values (chr(768))` passe, puis `chr(769)` rend `23505` sur `Key (…, , null) already exists` — clé vide. Le Blind Hunter dénombre **106** points de code `[:graph:]` que `strip_accents` vide. Deux affirmations écrites sont donc fausses : « la contrainte et la clé emploient **le même prédicat** » (:192) et « **plier les accents ne peut pas vider un nom qui montrait quelque chose** » (:254). C'est le piège n°8 que la story croyait fermé. Correctif : faire porter à `nom_non_vide` la même pile que l'index, et corriger les deux commentaires (règle §2).
- [x] [Review][Patch] **La provenance polymorphe accepte d'être à moitié remplie, dans les deux sens** [`20260805092611`:386-388] — **Mesuré** : `('profile', null)` accepté, `(null, gen_random_uuid())` accepté. AD-9 fait du **couple** la provenance ; `acteur_connu` ne parle que d'`actor_kind`. Le test `contraintes.test.ts` n'insère **jamais** d'`actor_id` : le couple n'est mesuré par rien. Correctif : `check ((actor_kind is null) = (actor_id is null))`, plus le test. ⚠️ La fenêtre se referme à la 4.4.
- [x] [Review][Patch] **L'index total plus la vue filtrée fabriquent un `23505` que la surface ne peut pas expliquer** [`20260805092611`:391 et :431] — L'en-tête écrit la conséquence pour le **tombstone** (« rajouter un article supprimé est un UPDATE ») et pour la fonction de génération, mais pas pour le cas nominal de la 4.4. **Mesuré** : un article `bought` occupe la clé — `insert 'Lait'/'L'/'pending'` alors qu'un `'Lait'/'L'/'bought'` existe rend `23505`. Et la ligne qui occupe la clé est **invisible dans `grocery_list_by_aisle`**, seule source de lecture prévue par la 4.2 : une surface qui lit la vue et écrit par INSERT recevra `23505` en désignant un article que sa propre lecture affirme absent. Correctif : l'écrire dans l'en-tête et dans `deferred-work.md` pour 4.2 / 4.4 / 4.5 — *lire la table, pas la vue, avant tout ajout*.
- [x] [Review][Patch] **La liste explicite d'invisibles de l'INDEX n'a aucune dent** [`supabase/tests/contraintes.test.ts` — test « la clé canonique fusionne les INVISIBLES »] — **Mesuré** : U+034F, U+115F, U+1160, U+2800, U+3164, U+FFA0 et U+FE0F sont **tous `[:graph:]`** ; U+200B ne l'est pas. Le seul test de fusion emploie **U+200B**, que `[^[:graph:]]` retire à lui seul — retirer `|[͏…ﾠ]` de l'**expression d'index** laisse la suite entière verte. C'est le motif exact que le banc des dents a trouvé sur `normalize(NFC)`, non refermé sur l'alternation. Correctif : un cas à U+2800 ou U+3164 **au milieu d'un nom**.
- [x] [Review][Patch] **`household_id` en tête de la clé canonique n'a aucune dent** [`supabase/tests/contraintes.test.ts` / `isolation.test.ts`] — Tous les noms insérés par les 21 tests sont deux à deux distincts entre foyers (« Poireaux de Bruno », « Farine », « Lentilles corail »…), et `contraintes.test.ts` travaille sur un foyer unique. Retirer `household_id` de l'index — donc unicité **globale**, donc fuite d'information inter-foyers par `23505` — laisserait toute la suite verte. Le commentaire de `viderLaListe` affirme « la clé canonique est unique **PAR FOYER** » sans que rien ne le mesure. Correctif : un test « le même nom et la même unité coexistent chez A et chez B ».
- [x] [Review][Patch] **Le test d'accord `normaliserTexte` ↔ `nom_non_vide` avale les `23505` et saute son propre nettoyage** [`supabase/tests/contraintes.test.ts` — `if (erreur.code === "23505") continue;`] — Le `continue` saute aussi le `viderLaListe()` de fin de boucle : la ligne survivante ferait collisionner toutes les itérations suivantes, qui seraient sautées **en silence**, et le test dégénérerait en no-op sans rien signaler. **Mesuré** côté client : `normaliserTexte("Boucherie​")` et `normaliserTexte("Bou​cherie")` rendent tous deux `"Boucherie"` — deux fixtures n'atteignent donc jamais l'assertion. Correctif : nettoyer inconditionnellement, et compter les cas réellement éprouvés.
- [x] [Review][Patch] **La contre-mesure `reindex` ne couvre pas tous les chemins qui périment l'index** [`20260805092611`:114-115] — L'en-tête ne la prévoit qu'après une montée **majeure** de Postgres. **Mesuré** : (a) `create or replace function public.strip_accents(…) as $$ select 'X' $$` avec l'index en place rend `CREATE FUNCTION`, **sans avertissement ni reindex** — le chemin le plus probable, une future migration qui « améliore » l'enveloppe, n'est pas couvert ; (b) la base est en `en_US.UTF-8`, provider ICU — `lower()` et `[:graph:]` dépendent aussi du ctype, et une montée de glibc/ICU **sans** montée majeure de Postgres périme l'index sans déclencher la contre-mesure écrite. Correctif : élargir la note de l'en-tête aux deux chemins.
- [x] [Review][Patch] **Citation de ligne fausse** [`20260805092611`:194 et story § Références] — La regex est à la ligne **84** de `20260802112511`, pas 83 (la 83 est `check (`). L'extraction elle-même est irréprochable : **vérifié**, 89 octets, identiques aux quatre emplacements et à la source.

#### Reportés

- [x] [Review][Defer] **`deleted_at` accepte une date future, et aucune combinaison `(status, deleted_at)` n'est exclue** [`20260805092611`:373] — **Mesuré** : `deleted_at = '2999-01-01'` accepté ; `(deleted_at not null, status='bought')` accepté. La vue teste `deleted_at is null`, jamais `deleted_at <= now()` : un tombstone daté de 2999 est indiscernable d'un tombstone posé maintenant. Reporté — la 4.5 possède le chemin d'écriture du tombstone et la 4.10 l'arbitrage.
- [x] [Review][Defer] **`unit` n'est normalisé nulle part, contrairement à `name`** [`20260805092611`:377 et :396] — **Mesuré** : `normalize('pièce', NFD)` rend `23514 grocery_list_items_unite_fermee` sur une unité que le membre a pourtant choisie dans une liste fermée. `name` traverse `normalize(…, NFC)` dans la clé ; `unit` ne traverse rien, ni dans la contrainte ni dans l'index. Sans conséquence tant que l'unité vient d'un sélecteur ; à rouvrir quand le pont Google écrira (AD-12, Epic 6).
- [x] [Review][Defer] **`strip_accents` est exposée en RPC appelable par `anon`, héritée plutôt que choisie** [`20260805092611`:358] — **Mesuré** : `has_function_privilege('anon', 'public.strip_accents(text)', 'execute')` → `t`, par l'`alter default privileges` de `20260729094500` sur lequel le volet 1 s'appuie explicitement. `lib/supabase/types.ts` l'enregistre désormais dans `Functions`. Aucune ligne de la story ne décide que cette primitive doit être appelable sans session. Sans danger (fonction pure, aucune donnée exposée) ; à trancher par la story **4.12**, qui gèle le contrat versionné.

#### Écartés comme bruit (4)

- **Le `i` sans point turc (U+0131) n'est pas replié.** Mesuré et exact, mais D1 ne plie explicitement ni les pluriels ni les variantes orthographiques, et le pendant majuscule est correct (`İstanbul` → `istanbul`). Aucune conséquence produit. ⚠️ **Ce que la même sonde a confirmé comme TENU** : sigma final `ς`→`σ`, `ß`/`ẞ`→`ss`, `æ`→`ae`, ligature `ﬁ`→`fi`, `œ`→`oe`, pleine largeur `Ｌ`→`l`, emoji et hors-BMP conservés.
- **Le `with check` de `grocery_update` sans dent.** L'Acceptance Auditor a **refait** la sonde du développeur et confirme sa mesure aux trois cas : c'est bien la politique **SELECT** qui refuse le déplacement. Le trou est réel, mais il est mesuré, écrit dans le code ET dans les commentaires, et l'objet est gardé délibérément. Règle §1 respectée — ce n'est pas un défaut de revue.
- **« Aucun code applicatif ne touche la table » périmé par les 21 tests du même commit.** Un test n'est pas une surface, et le fond du sujet est subsumé par la décision n°1.
- **Débordement documentaire** — une 5ᵉ section dans `deferred-work.md` et 64 lignes de commentaire dans `sprint-status.yaml` là où la Task 6 ne demandait qu'un statut. Non commandé, mais conforme à l'esprit du dépôt.

#### La passe de correction — 2026-08-05, et elle a été mesurée à son tour (règle §6)

*Trois des six défauts majeurs de l'Epic 1 ont été introduits par une passe de revue. Celle-ci
est donc passée au banc comme le reste, et le banc a trouvé une **affirmation fausse de plus**.*

**Ce que la migration porte désormais** — huit volets au lieu de sept :

| Volet | Ce qui a changé |
|---|---|
| 1 | Une garde `do $$ … $$` qui **déplace** `unaccent` si elle est ailleurs que dans `extensions`. Contre-mesure `reindex` élargie à **trois** chemins, pas un |
| 3 | Six contraintes au lieu de trois : `nom_non_vide` porte l'expression **entière** de la clé, plus `nom_borne`, `acteur_couple`, `intention_bornee` |
| 4 | Regex étendue de **deux plages mesurées** — `U+180F` et `U+E0100–U+E01EF` |
| 5 | `before insert or update`, et non plus `before update` seul |
| 8 | **NEUF** — `revoke execute … from public, anon, authenticated` sur `generate_grocery_list_from_menu` |

**⛔ LE BANC A TROUVÉ UNE AFFIRMATION FAUSSE DANS LA CORRECTION ELLE-MÊME.** La première
rédaction du volet 8 écrivait `revoke … from anon, authenticated`. Mesuré juste après :
`has_function_privilege('anon', …, 'execute')` rendait **encore `t`**. La cause est dans l'ACL —
`{=X/postgres, …}` : cette entrée sans rôle nommé est **`PUBLIC`**, à qui Postgres accorde
`execute` sur toute fonction créée, et dont `anon` comme `authenticated` héritent
**indépendamment** de leurs entrées nommées. Sans le contrôle, ce correctif aurait été consigné
« appliqué » en ne fermant **rien** — la forme exacte du défaut que la règle §1 vise.
Corrigé en `from public, anon, authenticated`, et re-mesuré : `f`, `f`, `service_role` à `t`.

**HUIT PASSAGES AU BANC DES DENTS, et les huit sont propres :**

| Objet retiré | Tests qui tombent |
|---|---|
| contrainte `nom_borne` | « le nom d'article est borné EN BASE », **et lui seul** |
| contrainte `acteur_couple` | « la provenance est un COUPLE », **et lui seul** |
| contrainte `intention_bornee` | « `intent_at` n'accepte pas une intention hors du temps », **et lui seul** |
| `nom_non_vide` revenue à sa forme partielle | « un nom fait UNIQUEMENT de diacritiques combinants », **et lui seul** |
| regex de la clé revenue à sa forme d'origine | « la clé fusionne les invisibles QUE `[^[:graph:]]` NE RETIRE PAS », **et lui seul** |
| trigger revenu à `before update` | « `updated_at` est posé SERVEUR à l'insertion », **et lui seul** |
| `household_id` retiré de la clé | « le MÊME article existe chez A et chez B », **et lui seul** |
| volet 8 retiré | « un membre authentifié ne peut PAS appeler la génération », **et lui seul** |

⚠️ **Deux passages ont d'abord rendu « 55 tests tombent », et ce n'était PAS une dent.** Le banc
relançait la suite sans attendre le redémarrage des conteneurs qui suit `db reset` : la
passerelle n'était pas prête, et tout tombait. Les deux ont été **rejoués à la main**, avec
attente, et rendent chacun 1 test. Écrit ici parce qu'un banc qui ment dans ce sens-là fait
croire à des dents qu'on n'a pas.

**Les cinq portes, réexécutées après correction :**

| Porte | Avant la revue | Après |
|---|---|---|
| `npm run check:migrations` | 16 / 14 / 2 / 0 | **16 / 14 / 2 / 0** |
| `npm run lint` | vert | **vert** |
| `npm run typecheck` | vert | **vert** |
| `npm test` | 198 / 198 | **198 / 198** — inchangé, aucun code applicatif écrit |
| `npm run test:isolation` | 87 / 87 | **95 / 95** (+8 tests) |

**`lib/supabase/types.ts`** — régénéré par `npx -y supabase@2.106.0 gen types typescript --local
--schema public`. Le diff passe de **53 insertions / 4 suppressions** à **26 / 5**.
⚠️ **Ce qui n'a PAS pu être refermé** : le bloc `__InternalSupabase` reste supprimé. Mesuré —
aucune CLI ne reproduit la ligne de base : ≤ 2.105.0 échouent sur `local_smtp`, ≥ 2.106.0
n'émettent plus le bloc. Daté dans `deferred-work.md` plutôt que masqué par une retouche à la
main, qui aurait été reperdue à la régénération suivante.

⚠️ **CE QUE LA REVUE N'A PAS FAIT, ET QUI RESTE DÛ AVANT LA FUSION** : la requête de contrôle sur
la **PRODUCTION**. Elle a été exécutée sur le stack local (zéro ligne aux quatre, table vide) ;
sur le distant, que la table soit vide reste une **DÉDUCTION**. L'en-tête de la migration porte
désormais la requête avec la regex **complète** — la forme simplifiée sous-détectait, c'est
mesuré — et la sonde d'extension avec son **schéma**.

#### Ce qui a été re-mesuré et qui TIENT

| Objet | Vérification |
|---|---|
| **AC1** | Les 12 champs présents ; `actor_id` sans FK, `intent_at not null default now()`, `deleted_at` nullable — conformes au volet 2 prescrit |
| **AC2 / D1 / D3** | `nulls not distinct` posé, **aucun `where`** → index **TOTAL**, D3 respectée (lu dans `pg_indexes`) — *sous réserve de la décision n°2* |
| **AC3** | Trois politiques ancrées sur `current_household_id()`, **aucune politique DELETE** (`pg_policy` : `r`, `a`, `w`), vue en `security_invoker` |
| **AC4 (table)** | Aucune politique DELETE ; le test négatif passe par le client authentifié de A — *voir la décision n°1 pour le second chemin* |
| **Trou n°1 (NFC), corrigé par le dev** | **Re-mesuré et il tient** : sans `normalize`, les jamo Hangul ne collisionnent pas (`len 2/1`) et le test neuf **tombe**. Il est bien le seul à tenir la première opération de la clé |
| **D1** | `unaccent` dans `extensions` ; **les DEUX formes `provolatile='s'`** (M13 reconfirmée) ; `strip_accents` `provolatile='i'` |
| **D2 / D4** | La fonction de génération n'est pas touchée ; vue amendée ici, 20 colonnes dans l'ordre prescrit (11 + 3 `aisle_*` + 6 neuves), **aucune colonne perdue** par l'abandon de `g.*` |
| **Regex extraite** | **89 octets**, identiques aux quatre emplacements et à la source — jamais retapée |
| **Unités fermées** | Contrainte = `UNITES` = les mêmes 8 jetons ; le test importe la constante |
| **4 entrées `deferred-work`** | Les quatre présentes et adressées (4.7 avec M5/M6, Epic 6, 4.6, 4.4) |
| **Frontières** | Aucun fichier sous `app/` ; sous `lib/`, uniquement les types régénérés ; `lib/liste/` n'existe pas ; `package.json` et le lock **intacts** (NFR-10) |
| **Règle §6 bis** | Le fichier de story et `sprint-status.yaml` portent tous deux `review`, conditions ouvertes datées |
| **Les 5 portes** | `check:migrations` 16/14/2/0 · `lint` vert · `typecheck` vert · `npm test` **198/198** · `test:isolation` **87/87** — **les cinq réexécutées en revue** |

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-05 | create-story | Contextualisation. Huit sondes exécutées sur le stack local (PostgreSQL 17.6) ; quatre décisions ouvertes avec leur défaut prescrit. |
| 2026-08-05 | Florian | **Les quatre décisions tranchées.** D1 **contre la recommandation** : la clé canonique plie les accents. D2, D3, D4 conformes. La story se démontre **en local**, `SUPABASE_DB_URL` n'est plus requis. |
| 2026-08-05 | create-story | Répercussion de D1 : cinq mesures de plus (M13–M17), un septième volet (`unaccent` + `strip_accents`), l'ordre des quatre opérations de la clé, et le piège n°2a — la promesse d'immutabilité. Stack local remis à l'état du dépôt par `db reset`, sans résidu. |
| 2026-08-05 | code-review | **Revue adversariale à trois couches** (Blind Hunter, Edge Case Hunter, Acceptance Auditor) + sondes du relecteur. **6 décisions tranchées par Florian, 16 correctifs appliqués, 4 reports datés, 4 écartés.** Les deux constats bloquants : l'**AC4 était défait** — `generate_grocery_list_from_menu` laissait tout membre effacer sa liste en dur par RPC (mesuré : 2 lignes → 0, tombstones compris) — et l'**AC2 était faux** pour 241 points de code invisibles, qui produisaient des lignes indiscernables à l'œil et infusionnables. Trois contraintes neuves posées pendant que la table est vide (`nom_borne`, `acteur_couple`, `intention_bornee`), un huitième volet (`revoke execute`), le trigger étendu à l'INSERT, et `nom_non_vide` alignée sur l'expression de la clé. **Huit passages au banc des dents, tous propres** — et le banc a trouvé une affirmation fausse dans la correction elle-même : `revoke … from anon, authenticated` ne retirait rien, l'entrée `PUBLIC` de l'ACL survivant. 95/95 en isolation (contre 87). |
| 2026-08-05 | dev-story | **Implémentée.** Une migration à sept volets (`20260805092611`), 21 tests neufs, types régénérés. **Onze passages au banc des dents**, qui ont trouvé DEUX affirmations fausses de la contextualisation : le test NFC n'avait aucune dent, et le `with check` de `grocery_update` n'est pas ce qui refuse un déplacement inter-foyers. Les deux corrigées dans le code ET dans les commentaires, pas seulement contournées. |
