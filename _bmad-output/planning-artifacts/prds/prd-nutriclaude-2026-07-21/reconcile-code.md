# Réconciliation PRD ↔ code — NutriClaude

**Date** : 2026-07-22
**Portée vérifiée** : `app/`, `components/`, `lib/`, `middleware.ts`, `supabase/migrations/20260502000000_initial_schema.sql`, `package.json`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`.
**Cible** : §7 « Écart avec l'existant » du `prd.md`, et `addendum.md` §1 « État technique du code actuel » / §5.

Verdict global : **le tableau §7 est majoritairement juste**. Trois lignes sont fausses ou trop généreuses (elles annoncent « Fonctionne » là où le code ne fait pas ce qui est écrit), une ligne est trop faible, et le point « hors périmètre » sur la compilation est en réalité **le blocage n°1 du Lot 0** — il est confirmé factuellement, pas « probable ».

---

## 1. Affirmations fausses ou exagérées

### 1.1 — « Liste partagée, triée par rayon, générée depuis le menu | Fonctionne | Conforme à FR-1, FR-2, FR-5, FR-16 » → **FR-5 est faux**

FR-5 : « Ajouter un article déjà présent dans la liste (même nom, même unité) **additionne les quantités** au lieu de créer un doublon. »

L'ajout manuel est un `INSERT` nu, sans aucune recherche d'un article existant :

`app/(app)/grocery/actions.ts:60-68`
```ts
const { error } = await supabase.from("grocery_list_items").insert({
  household_id: profile.household_id,
  name,
  quantity: quantity ? Number(quantity) : null,
  unit,
  aisle_id,
  added_by: profile.id,
  status: "pending",
});
```

Aucun `upsert`, aucun `select` préalable, aucune contrainte d'unicité en base (`grocery_list_items` n'a que la PK `id`, cf. migration L194-206). Ajouter « lait » deux fois crée **deux lignes**.

La seule agrégation qui existe est le `group by ri.name, ri.unit, ri.product_id, ri.aisle_keyword` **interne à la génération SQL** (migration L554), qui dédoublonne les ingrédients *entre recettes d'une même génération*. Elle ne dédoublonne rien à l'ajout, ni au regard d'articles déjà présents (ils viennent d'être effacés, cf. §1.2 du PRD). **FR-5 n'est pas couvert : c'est un écart, pas un acquis.**

> Correction proposée pour le tableau : scinder la ligne. « Liste partagée, triée par rayon, générée depuis le menu → Fonctionne (FR-1, FR-2, FR-16) » / **« Agrégation des doublons à l'ajout → Inexistante → FR-5 »**.

### 1.2 — « Provenance d'un article | **Jamais** renseignée en base » → **exagéré**

FR-7 demande trois choses : la recette d'origine, la surface d'arrivée, et le membre qui a ajouté. Le code en renseigne **une sur trois**, systématiquement :

- **`added_by` est bien peuplé, sur les deux chemins d'ajout** :
  - ajout manuel : `app/(app)/grocery/actions.ts:66` → `added_by: profile.id`
  - génération depuis le menu : migration L565 → `auth.uid()` dans le `select` du `insert`
- **`recipe_id` n'est jamais peuplé** — confirmé. La colonne existe (migration L202) mais la liste des colonnes du `INSERT` de `generate_grocery_list_from_menu` l'omet :
  ```sql
  insert into grocery_list_items
    (household_id, name, quantity, unit, product_id, aisle_id, added_by, status)
  ```
  (migration L556-557). Aucune autre écriture n'y touche.
- **La surface d'arrivée n'a pas de colonne du tout** — rien dans le schéma.

> Correction : « Provenance d'un article | `added_by` renseigné ; **`recipe_id` jamais peuplé** (colonne existante mais absente de l'INSERT de génération) ; aucune colonne « surface » | FR-7 ». C'est moins de travail que ce que le tableau laisse croire : un `recipe_id` à propager et une colonne à ajouter, pas une provenance à inventer.

### 1.3 — « Correction de rayon apprenante | Inexistante » → **trop faible : la correction elle-même est impossible**

Le PRD ne relève que l'absence de la boucle d'apprentissage (FR-14). En réalité **on ne peut pas corriger le rayon d'un article déjà dans la liste, tout court** : `GroceryGroup.tsx` n'expose que deux actions, cocher (L52-58) et supprimer (L67-74). Aucun sélecteur de rayon, aucune Server Action de type `updateItemAisle` dans `app/(app)/grocery/actions.ts`.

De plus, **le rayon n'est pas déterminé automatiquement à l'ajout manuel** : `addAdHocItem` lit `aisle_id` depuis le formulaire (`actions.ts:56`), et le `<select>` est explicitement marqué « — Rayon (optionnel) — » (`AdHocForm.tsx:52`). La fonction SQL `resolve_aisle_id` (migration L466) **n'est appelée que depuis `generate_grocery_list_from_menu`**. Un article ajouté à la main sans rayon choisi tombe dans « À classer » **définitivement**.

> C'est un écart sur **FR-4** (« le rayon est déterminé automatiquement, et reste corrigeable ») que §7 ne mentionne nulle part, et qui touche directement la contre-métrique « le groupe À classer grossit » de §8.

### 1.4 — « Code d'invitation | Fonction en base, aucun bouton dans l'app » → **juste, mais la formulation « mode rejoindre inutilisable » mérite précision**

Vérifié : `generate_household_invite` (migration L437) **n'est appelée nulle part**. Les seuls `.rpc()` du code sont :
- `generate_grocery_list_from_menu` — `app/(app)/grocery/actions.ts:14`
- `create_household_with_profile` — `app/onboarding/OnboardingForm.tsx:26`
- `redeem_household_invite` — `app/onboarding/OnboardingForm.tsx:36`

Donc l'**écran** « Rejoindre un foyer » existe et est fonctionnel (`OnboardingForm.tsx:65-75` et L112-126) ; c'est la **production du code** qui est orpheline. Conséquence identique à celle du PRD (aucun second membre possible), mais l'effort réel est plus petit qu'annoncé : il ne reste qu'un bouton + un affichage, la moitié aval du parcours est déjà câblée et testée par le formulaire.

### 1.5 — Addendum §1 : « L'app ne compile **probablement** pas en l'état » → **elle ne compile pas, c'est établi ; et le diagnostic est incomplet**

`npx next build` échoue, reproductible :

```
Error: Turbopack build failed with 1 errors:
./app/globals.css
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin.
The PostCSS plugin has moved to a separate package […] install `@tailwindcss/postcss`
```

**Trois causes distinctes, pas une :**

1. **Tailwind 4 vs config Tailwind 3** — `postcss.config.mjs` déclare `plugins: { tailwindcss: {}, autoprefixer: {} }` alors que `package.json:27` installe `tailwindcss@4.2.4`, qui exige `@tailwindcss/postcss`. C'est **l'erreur qui fait échouer le build en premier**. S'y ajoute `app/globals.css:1-3` en syntaxe v3 (`@tailwind base/components/utilities`) et `tailwind.config.ts` en config JS v3 (v4 attend `@theme` en CSS). L'addendum mentionne le CSS mais pas le plugin PostCSS — or c'est lui le point de blocage effectif.
2. **`cookies()` non attendu** — confirmé par `tsc` :
   ```
   lib/supabase/server.ts(17,30): error TS2339: Property 'getAll' does not exist on type 'Promise<ReadonlyRequestCookies>'.
   lib/supabase/server.ts(24,27): error TS2339: Property 'set' does not exist on type 'Promise<ReadonlyRequestCookies>'.
   ```
   Ce n'est pas qu'un problème de types : en Next 16 `cookies()` renvoie une Promise, donc **toute page et toute Server Action planterait à l'exécution** même si le CSS était réparé.
3. **`npm run typecheck` échoue avant même d'analyser le code** — TypeScript 6.0.3 (`package.json:28`) refuse `baseUrl` :
   ```
   tsconfig.json(17,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
   ```
   Non mentionné dans l'addendum.

Deux avertissements supplémentaires du build, non relevés :
- `experimental.typedRoutes` a été déplacé à la racine de `next.config.mjs`.
- **`middleware.ts` est une convention dépréciée en Next 16** (« Please use "proxy" instead ») — or `middleware.ts` porte **tout le gating d'authentification** (`lib/supabase/middleware.ts:41-55`). À traiter avant qu'il ne soit retiré.

`params`/`searchParams` typés en objets et non en Promises : confirmé (`app/(app)/menu/page.tsx:26-29`, `app/(app)/grocery/page.tsx:22-25`, `app/(app)/recipes/[id]/page.tsx:12-15`). `tsc` ne le signale pas — les types de routes générés ne sont pas produits, le build échouant avant — mais c'est un échec d'exécution garanti.

> **Conséquence de planification** : ce point n'appartient pas à « hors périmètre PRD ». **Aucune ligne du Lot 0 ne peut être livrée avant sa résolution**, puisque le produit ne démarre pas. À remonter en tête du Lot 0, avec un chiffrage propre (le choix « migrer vers Tailwind 4 » vs « redescendre en Tailwind 3 » est un arbitrage à trancher, pas une correction mécanique).

### 1.6 — Addendum §1 et §3 : « Auth par magic link, sans mot de passe » / « Le mot de passe — rejeté au profit du magic link » → **contredit par le code**

L'application implémente l'authentification **par email + mot de passe** :

- `app/login/LoginForm.tsx:24` → `supabase.auth.signInWithPassword({ email, password })`
- `app/signup/page.tsx:23-30` → `supabase.auth.signUp({ email, password, … })`, avec un champ « Mot de passe (min. 6 caractères) »

L'addendum présente ces deux lignes comme des décisions actées du doc d'origine ; elles ne décrivent pas l'existant. À reformuler en « décision d'origine, **non appliquée dans le code** » — sinon une phase architecture partira du principe que le magic link est en place.

---

## 2. Ce que le PRD a raté

Éléments matériellement présents ou matériellement cassés, absents du tableau §7, et qui changent la planification.

### 2.1 — L'ajout manuel ne résout pas le rayon (FR-4)
Voir §1.3. Écart non listé. Impacte le Lot « en continu » et la contre-métrique « À classer ».

### 2.2 — Aucune écriture de `product_aisle_map.product_id` n'est possible
`app/(app)/aisles/actions.ts:62-66` (`createMapping`) n'insère qu'un `keyword`, et `app/(app)/aisles/page.tsx:19` filtre l'affichage par `.not("keyword", "is", null)`. La branche 1 de `resolve_aisle_id` (mapping par produit exact, migration L479-486) est donc **du code mort**. L'addendum le note ; le PRD non. Sans conséquence en v1 (le catalogue OFF est un non-objectif), mais à ne pas re-spécifier comme acquis.

### 2.3 — Le repas « collation » : deux causes, pas une
§7 dit « En base, absent de l'écran ». Exact : la contrainte accepte `snack` (migration L180) mais `MEAL_TYPES` de `app/(app)/menu/page.tsx:19-23` ne liste que breakfast/lunch/dinner. À noter qu'il manque aussi **le petit-déjeuner dans la génération de liste** ? — non, `generate_grocery_list_from_menu` ne filtre pas par `meal_type` (migration L548-554), donc les collations éventuellement créées hors UI seraient bien prises. RAS, la ligne est correcte.

### 2.4 — `meal_plan_entries` n'a aucune contrainte d'unicité
Migration L175-185 : aucun `unique (household_id, meal_date, meal_type, recipe_id)`. `assignRecipe` (`app/(app)/menu/actions.ts:18-25`) est un `insert` nu. Assigner deux fois la même recette au même créneau crée deux entrées, et la génération **double alors les quantités** (le `sum()` de la migration L544 les additionne). C'est exactement la contre-métrique « une quantité qui double » de §8, et elle est atteignable sans hors-ligne ni multi-surfaces.

### 2.5 — Aucune gestion d'erreur : `requireProfile()` lève une exception non rattrapée
`lib/supabase/queries.ts:33` → `throw new Error("PROFILE_REQUIRED")`. Aucun `error.tsx`, aucun `not-found.tsx`, aucun `loading.tsx` dans tout `app/` (vérifié par recherche). Une session expirée dans une Server Action produit donc un écran d'erreur Next brut — en contradiction directe avec **NFR-8** (« les messages d'erreur techniques ne sont jamais montrés bruts »). Non listé en §7.

### 2.6 — Aucune migration au-delà de l'initiale
`supabase/migrations/` ne contient qu'un seul fichier. Il n'existe aucun outillage de migration incrémentale en place, et `supabase/.temp/` est non suivi (cf. git status). Le Lot 1 va produire beaucoup de schéma : la discipline de migration est à établir, elle n'existe pas encore.

### 2.7 — Confirmations sur l'absence de socle (utile pour chiffrer, pas un désaccord)
- **Aucun `public/`**, donc pas de manifeste, pas d'icône, pas de service worker — FR-35 part de zéro, y compris le répertoire.
- **Aucun `channel()` / `realtime`** dans tout le code — FR-10/FR-22/FR-27 partent de zéro.
- **`export const dynamic = "force-dynamic"`** sur les 4 pages applicatives (`grocery:19`, `menu:17`, `recipes:7`, `recipes/[id]:9`, `aisles:8`) — confirme intégralement le diagnostic hors-ligne de l'addendum §5.

### 2.8 — Cosmétique confirmé (addendum §1, tout est exact)
- `metadata.title = "NutriCloud — Le Cadre"` (`app/layout.tsx:5`) — faute de frappe *et* fuite du branding Le Cadre, alors que le PRD sort Le Cadre du périmètre.
- Fragment sans clé dans `.map` : `app/(app)/menu/page.tsx:128` → `{MEAL_TYPES.map(({type,…}) => (<>` — le `key` est posé sur le `<div>` interne (L130), pas sur le fragment. Warning React à chaque rendu du menu.
- Dark mode en dur : `app/globals.css:5-14` (`color-scheme: dark`, `background: #0f1117`).
- README annonce Next 14 (L5) contre Next 16.2.4 en `package.json:15`.
- Aucun test dans le dépôt.
- `products` : `select`/`insert`/`update` ouverts à tout authentifié (migration L281-286).

---

## 3. Confirmations — lignes de §7 vérifiées et fiables

| Ligne §7 | Verdict | Preuve |
|---|---|---|
| **Cocher / décocher : Cassé, case codée en dur** | **Exact** | `GroceryGroup.tsx:54` `checked={false}` en dur, et `onChange={() => toggle(it.id, "pending")}` (L55) passe **littéralement** `"pending"` comme état courant. Le `toggle` (L18-25) calcule alors toujours `status = "bought"`. Aucun chemin ne produit `pending`. Les articles achetés sont bien listés en lecture seule (`grocery/page.tsx:124-138`, `<details>` avec `line-through`) sans aucun contrôle. **Un acheté ne peut jamais revenir.** |
| **Génération depuis le menu : efface les articles à acheter existants** | **Exact** | Migration L534-536 : `delete from grocery_list_items where household_id = v_household_id and status = 'pending';` — sans filtre de date ni de provenance. Les ajouts manuels sont détruits. L'UI l'annonce d'ailleurs : « La génération remplace les articles "à acheter" actuels » (`grocery/page.tsx:98-100`). |
| **Réordonnancement des rayons : par saisie d'un numéro** | **Exact** | `AisleRow.tsx:45-50` : `<input type="number" value={sortOrder}>`. Aucun glisser-déposer, aucun bouton monter/descendre. |
| **Propagation entre surfaces : inexistante** | **Exact** | Aucune occurrence de `channel`, `realtime`, ou souscription Supabase dans `app/`, `lib/`, `components/`. Tout passe par `revalidatePath`. |
| **Hors-ligne : inexistant, tout est `force-dynamic`** | **Exact** | Les 5 pages applicatives déclarent `export const dynamic = "force-dynamic"`. Aucun service worker, aucun `public/`. |
| **API / contrat : inexistant, logique en Server Actions** | **Exact** | Le seul route handler du dépôt est `app/auth/callback/route.ts`. Toute la logique métier vit dans 4 fichiers `actions.ts` `"use server"`, non adressables en HTTP par un tiers. |
| **Dashboard maison / voix / mobile / conversationnel : inexistants** | **Exact** | Aucun fichier, aucune dépendance correspondante. |
| **Identités d'appareil : seul modèle = utilisateur connecté** | **Exact** | `current_household_id()` (migration L48-56) lit `profiles where id = auth.uid()`. Les 10 politiques RLS en dépendent toutes. `middleware.ts` redirige vers `/login` toute route non publique sans `user` (`lib/supabase/middleware.ts:41-48`). |
| **Écran profil / membres du foyer : inexistant** | **Exact** | La navigation ne contient que 4 entrées : Menu, Recettes, Liste de courses, Rayons (`app/(app)/layout.tsx:7-12`). Aucune route `/profile`, `/settings`, `/household` sous `app/`. `display_name` n'est écrit qu'une fois, à l'onboarding (`OnboardingForm.tsx`), jamais modifiable ensuite. Aucun écran ne liste les membres du foyer — seul le prénom de l'utilisateur courant est affiché (`layout.tsx:52`). |
| **Édition d'un ingrédient : suppression + recréation uniquement** | **Exact** | `IngredientsList.tsx` : rendu en `<span>` non éditables (L33-49) + bouton `×` → `deleteIngredient` (L50-62). `recipes/actions.ts` n'expose que `addIngredient` et `deleteIngredient`, pas d'`updateIngredient`. |
| **Instructions d'une recette : zone d'édition seulement, jamais rendue** | **Exact** | `recipes/[id]/page.tsx` ne rend que `<EditRecipeForm>` et `<IngredientsList>`. `instructions` n'apparaît que dans un `<textarea>` (`EditRecipeForm.tsx:86-93`), avec un label « Instructions (markdown) » — aucun rendu markdown nulle part. |
| **Repas « collation » : en base, absent de l'écran** | **Exact** | Migration L180 accepte `'snack'` ; `menu/page.tsx:19-23` n'en liste que trois. |
| **Mobile : grille du menu à défilement horizontal forcé** | **Exact** | `menu/page.tsx:103-104` : `overflow-x-auto` + `min-w-[900px]`. Violation directe de NFR-3 — mais NFR-3 l'autorise explicitement pour le menu, donc l'écart est cosmétique, pas bloquant. |
| **Suppression de compte / export : inexistant ; un utilisateur appartient à un foyer à vie** | **Exact** | Aucune action de suppression de profil. Structurellement verrouillé en base : `profiles.household_id` est `not null` et `create_household_with_profile` comme `redeem_household_invite` refusent toutes deux d'agir si un profil existe déjà (`raise exception 'Profile already exists'`, migration L371-373 et L407-409). Il n'existe **aucun chemin, même manuel via l'app, pour changer de foyer**. |
| **Suppression d'un article, vidage : fonctionne (FR-6, FR-8)** | **Exact, avec une nuance** | `deleteItem` / `clearBought` / `clearAll` existent et sont câblées (`grocery/actions.ts:37-96`, `GenerateBar.tsx:33-47`). Nuance : FR-8 dit « **archivés** » ; `clearBought` fait un `DELETE` définitif (L77-81), et le dialogue de confirmation dit « Supprimer **définitivement** » (`GenerateBar.tsx:34`). Combiné au décochage cassé, l'historique d'achat n'est donc jamais récupérable. |
| **Isolation des foyers (NFR-5) — non listé mais sain** | **Correct** | RLS activé sur les 10 tables (migration L236-245), politiques toutes ancrées sur `current_household_id()`, et la vue `grocery_list_by_aisle` est bien en `security_invoker = true` (L217). Les Server Actions qui filtrent seulement par `.eq("id", id)` (`toggleItemStatus`, `deleteItem`, `updateAisle`, `deleteAisle`, `deleteRecipe`, `unassignRecipe`) s'appuient sur cette RLS — c'est correct aujourd'hui, mais **cela rend la RLS non contournable pour toute future API** ; c'est le nœud identifié par l'addendum §5 (tension MCP / `SUPABASE_SERVICE_KEY`). |

---

## 4. Récapitulatif des modifications à apporter au tableau §7

1. **Retirer FR-5 de la ligne « Fonctionne »** et créer une ligne d'écart : agrégation des doublons à l'ajout — inexistante.
2. **Reformuler la ligne « Provenance »** : `added_by` est renseigné ; seuls `recipe_id` (colonne existante, absente de l'INSERT) et la surface manquent.
3. **Élargir la ligne « Correction de rayon apprenante »** : ce n'est pas seulement l'apprentissage (FR-14) qui manque, c'est la correction elle-même, et la résolution automatique du rayon à l'ajout manuel (FR-4).
4. **Remonter le point « versions de dépendances » du statut de note de bas de page au statut de prérequis du Lot 0** : le build échoue, c'est vérifié (`npx next build`), avec trois causes indépendantes — plugin PostCSS Tailwind 4, `cookies()` non attendu, `baseUrl` refusé par TS 6. S'y ajoute la dépréciation de `middleware.ts` en Next 16, qui porte tout l'auth gating.
5. **Ajouter trois lignes absentes** : rayon non résolu à l'ajout manuel (FR-4) · absence totale de gestion d'erreur, `error.tsx`/`not-found.tsx` inexistants (NFR-8) · `meal_plan_entries` sans unicité, doublons d'assignation ⇒ quantités doublées à la génération (FR-16).
6. **Corriger l'addendum §1/§3** : l'auth du code est email + mot de passe, pas magic link. La décision « magic link » n'a jamais été appliquée.
