---
baseline_commit: fb7b5c40aaff471c3802941e19957eb1c28d75a9
---

# Story 4.2: Lecture client-direct de la liste groupée par rayon

Status: ready-for-dev

<!-- DEUXIÈME story de l'Epic 4, et la PREMIÈRE SURFACE du produit à lire depuis le navigateur.
     Quatre choses la distinguent, et il faut les avoir en tête avant de lire les critères :

     1. ⚠️ **ELLE EST LA PREMIÈRE LECTURE CLIENT-DIRECT DU DÉPÔT.** Mesuré : les 20 sites d'appel
        de `createNavigateurClient()` sont TOUS des écritures ou de l'auth, et aucun des huit
        `useEffect` du dépôt ne fait d'`await` de données. Toutes les lectures
        d'écran passent aujourd'hui par un composant serveur. Il n'y a donc **aucun motif à
        copier** pour les états chargement / erreur / vide d'une lecture — c'est le vrai poids de
        cette story, et ce n'est écrit nulle part dans ses critères.

     2. ⛔ **ELLE EST BLOQUÉE PAR LA STORY 2.4, ET C'EST UNE DÉCISION.** L'AC2 renvoie au
        « composant carte-rayon de l'Epic 2, story 2.4 ». Mesuré : `2-4-composant-carte-rayon` est
        en `backlog` — il n'existe pas. **Florian a tranché le 2026-08-06 : c'est la 2.4 qui le
        construit**, pas cette story. **Ne commence donc PAS la 4.2 avant que la 2.4 soit `done`.**

     3. ⚠️ **LE REGROUPEMENT NAÏF EST FAUX, ET C'EST MESURÉ.** `aisles.sort_order` n'a aucune
        contrainte d'unicité. Deux rayons ex æquo font s'INTERCALER leurs articles : regrouper
        « par lignes consécutives » rendrait deux cartes portant le même rayon. Piège n°1.

     4. ✅ **LA VUE EST DÉJÀ EN PRODUCTION.** Contrairement à la 4.1, cette story se démontre
        AUSSI sur la prévisualisation Vercel : la migration `20260805092611` a été fusionnée et
        appliquée le 2026-08-05 (déploiement vert). C'est une inversion de contrainte par rapport
        à toutes les stories récentes — § Environnement de test. -->

<!-- ⚠️ **QUATRE DÉCISIONS SONT OUVERTES** (§ Décisions). Chacune porte un **défaut prescrit** :
     la story est implémentable telle quelle si personne ne tranche, mais D1 et D2 changent son
     périmètre, et il vaut mieux les trancher avant de commencer. -->

## Story

As a membre du foyer,
I want voir la liste partagée groupée par rayon, dans l'ordre du parcours,
So that je retrouve ma liste unique et triée sur n'importe quelle surface.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-4.2`.

**AC1 — La lecture part du navigateur**
**Given** la vue `grocery_list_by_aisle` et le client Supabase du navigateur (RLS-enforced)
**When** la liste est lue
**Then** elle est chargée en **client-direct** (AD-13), plus via des Server Actions
`force-dynamic`, et affiche la liste unique du foyer (FR-1) groupée par rayon dans l'ordre du
parcours (FR-2)

**AC2 — Seuls les articles vivants**
**Given** les articles non supprimés (tombstone nul)
**When** la liste est rendue
**Then** seuls les articles vivants apparaissent, groupés par rayon, « À classer » compris
(réutilise le composant carte-rayon de l'Epic 2, story 2.4 ; le groupe « À classer » lui-même est
la story 4.17)

**AC3 — Le contrat, pas le calcul**
**Given** la lecture via le contrat
**When** une surface lit la liste
**Then** elle obtient le même état que toute autre surface (FR-20), aucune surface ne calculant
son propre regroupement

---

> **⚠️ L'AC1 dit « plus via des Server Actions `force-dynamic` », et il n'y a RIEN À DÉMANTELER.**
> Mesuré : `grep -rn "force-dynamic\|revalidatePath" app lib` ne rend aucune occurrence dans les
> écrans. La formulation vise le prototype retiré à la story 1.1, pas du code présent. **Ne perds
> pas une heure à chercher le `force-dynamic` à retirer : il n'existe pas.** Ce que l'AC1 demande
> est positif — écrire la première lecture navigateur du produit.

> **⚠️ L'AC2 dit « réutilise le composant carte-rayon […] story 2.4 ». Mesuré : il n'existe pas.**
> `sprint-status.yaml:263` → `2-4-composant-carte-rayon: backlog`. `app/rayons/ListeRayons.tsx`
> n'est PAS ce composant : c'est l'éditeur CRUD du parcours, et `app/rayons/page.tsx:20-23` le dit
> lui-même. **Décision D1**, et c'est la seule qui peut faire déborder la story.

> **⚠️ L'AC3 dit « aucune surface ne calculant son propre regroupement », et ça ne veut PAS dire
> « ne regroupe pas ».** La vue rend des lignes plates, pas des groupes : le client DOIT
> matérialiser des cartes. Ce que l'AC3 interdit, c'est de **décider** l'appartenance ou l'ordre —
> les deux viennent de la base (`aisle_id`, `aisle_sort`). Le client matérialise, il n'arbitre pas.

> **⚠️ Ce que ces trois critères NE disent PAS et qui est dû quand même** : la phrase d'annonce
> périmée de l'accueil et son bouton manquant, le squelette de chargement, le tri secondaire des
> groupes, et le fait qu'aucun test ne mesure aujourd'hui l'ORDRE rendu par la vue. Les quatre
> sont au § Ce qui est dû sans être écrit.

---

## Ce qui est MESURÉ — le 2026-08-05, sur `fb7b5c4`

*Stack local `supabase start`, PostgreSQL 17.6. Sondes base en `begin … rollback` ; une sonde
HTTP `GET` en lecture seule sur PostgREST local. Règle §1 : ce qui suit a été **exécuté**.*

| # | Question | Réponse **mesurée** |
|---|---|---|
| M1 | Lectures client-direct existantes | **ZÉRO.** Les **20** appels de `createNavigateurClient()` (11 fichiers) sont des `insert`/`update`/`delete`/`rpc`/`signInWithOtp`. Le `.select("id")` qu'on y voit est le **retour d'écriture**, jamais une lecture d'écran. ⚠️ **Et aucun des 8 `useEffect` du dépôt ne fait d'`await` de données** — ce sont des minuteurs (`InviteCard.tsx:44`) et des écouteurs (`ListeRayons.tsx:564`). C'est ça, la preuve qu'il n'y a aucun motif à copier |
| M2 | `force-dynamic` / `revalidatePath` | **Zéro `force-dynamic`.** ⚠️ `revalidatePath` existe, en trois appels dans `app/foyer/actions.ts` (`:89`, `:113`, `:161`) — c'est la **seconde branche d'AD-13** (conséquence visible dans un rendu serveur), légitime et hors périmètre. **Il n'y a rien à démanteler pour autant** |
| M3 | Le composant carte-rayon (story 2.4) | **N'EXISTE PAS** — `sprint-status.yaml:263` = `backlog`. Epic 2 a encore 2.3 et 2.4 ouvertes |
| M4 | Définition réelle de `grocery_list_by_aisle` | 20 colonnes, `security_invoker = true` (`pg_class.reloptions`), `where status='pending' and deleted_at is null`, `order by coalesce(a.sort_order, 9999), g.name` |
| M5 | L'`ORDER BY` de la vue survit-il à PostgREST ? | **OUI aujourd'hui** — deux sondes convergentes (psql en forme PostgREST, et `curl` HTTP réel sans `order=`). ⚠️ Mais voir piège n°1 : ce n'est **pas** ce qui rend le regroupement correct |
| M6 | **Deux rayons de même `sort_order`** | ⛔ **LEURS ARTICLES S'INTERCALENT.** `Alpha` et `Exaequo` tous deux à 20 → `aaa`(Exaequo), `bbb`(Alpha), `ccc`(Exaequo). `sort_order` n'a **aucune contrainte d'unicité** et vaut `100` par défaut |
| M7 | Un article sans rayon | `LEFT JOIN` → `aisle_name`, `aisle_icon`, `aisle_sort` **tous nuls**, et `coalesce(…, 9999)` le place **en dernier**, après `Autre` (999) |
| M8 | Articles avec un rayon résolu, en base | **ZÉRO.** 100 % ont `aisle_id` nul. ⚠️ **Mais pas pour la raison qu'on croit** : `resolve_aisle_id` **EST** appelée, par `generate_grocery_list_from_menu` (`pg_proc.prosrc`). C'est **`product_aisle_map` qui est VIDE** — 0 ligne : les règles mot-clé → rayon sont la story **2.3**, en `backlog`. La fonction rend donc toujours `null`. *(Son câblage sur l'ajout manuel reste la 4.16.)* |
| M9 | Types de la vue | `Views.grocery_list_by_aisle.Row` — **`Row` seul, ni `Insert` ni `Update`**, et **toutes les colonnes `| null`**, `id` et `name` compris. Postgres ne propage pas le `not null` à travers une vue |
| M10 | Politiques sur `grocery_list_items` | `grocery_select` / `grocery_insert` / `grocery_update`, ancrées sur `current_household_id()`. **Aucune politique DELETE** |
| M11 | `aisles.sort_order` | `integer not null default 100`, index `idx_aisles_household(household_id, sort_order)`, unicité seulement sur `(household_id, name)`. `seed_default_aisles` pose 10, 20 … 100, puis `Autre` à **999** |
| M12 | `grocery_list_items.aisle_id` | FK vers `aisles(id)` **`on delete set null`** — supprimer un rayon bascule ses articles en « sans rayon », il ne les détruit pas |
| M13 | Borne de nom d'article | `grocery_list_items_nom_borne check (length(name) <= 200)` — un nom va jusqu'à **200 caractères**, sans garantie d'espace où couper |
| M14 | Tests touchant la vue | Trois, tous de la 4.1 : `isolation.test.ts:1364` (A ne lit pas B), `:1480` (`aisle_name === null`), `:1513` (le tombstone quitte la vue). **Aucune assertion d'ORDRE nulle part** |
| M15 | Les deux suites sur `fb7b5c4` | `npm test` → **198 / 198**. `npm run test:isolation` → **95 / 95**. Les deux **exécutées** |
| M16 | La migration de la 4.1 en production | **APPLIQUÉE.** Fusionnée le 2026-08-05 (`fb7b5c4`), déploiement Vercel **vert**, et `vercel.json` enchaîne `npm run build && node scripts/migrer-au-deploiement.mjs` qui sort non nul sur échec |

**Ce qui reste DÉDUIT** : que `loading.tsx` ne couvre pas un `await` dans un `useEffect`. C'est la
lecture du contrat Next (un `loading.tsx` de segment enveloppe l'attente du **rendu serveur**),
pas une mesure — mais elle décide la Task 3, et elle se vérifie en trente secondes au réseau bridé.

---

## Décisions à trancher — chacune avec son défaut prescrit

*La story est implémentable si personne ne tranche : les défauts ci-dessous sont écrits pour ça.
**D1 et D2 changent le périmètre**, et méritent une réponse avant démarrage.*

### ⛔ D1 — Le composant carte-rayon : ✅ **TRANCHÉ le 2026-08-06 — c'est la STORY 2.4 qui le construit**

L'AC2 dit « réutilise le composant carte-rayon de l'Epic 2, story 2.4 ». **Mesuré : la 2.4 est en
`backlog`.** Il n'y avait rien à réutiliser.

✅ **Décision de Florian : la 2.4 le construit, dans sa propre story.** La 4.2 le **consomme**, elle
ne l'écrit pas — l'AC2 est donc pris au mot.

⛔ **CONSÉQUENCE DE SÉQUENCEMENT, ET ELLE EST DURE : LA STORY 2.4 DOIT ÊTRE FAITE AVANT CELLE-CI.**
Sans elle, la Task 2 n'a rien à consommer et l'AC2 est intenable. La 4.2 n'est pas « prête à
démarrer » tant que la 2.4 n'est pas `done`, quel que soit son statut dans le suivi de sprint
(`ready-for-dev` y décrit l'existence du fichier, pas la disponibilité du travail).

⚠️ **Ce que ça coûte, et qui était l'argument contre** : un composant de carte-rayon **sans liste**
ne se démontre que par une page de démonstration qui n'existe pas, et le dépôt n'a pas de harnais
de composants (NFR-10). **C'est à la contextualisation de la 2.4 de trancher comment elle se
démontre** — ce n'est plus un problème de la 4.2.

⚠️ **Le contrat du composant appartient donc à la 2.4**, et la 4.2 doit s'y conformer. Forme
attendue d'après l'AC de la 2.4, UX-DR4 et `DESIGN.md:278` — props seules, aucune lecture, aucune
base :

⚠️ **LIVRÉ ET REVU LE 2026-08-07** — ce n'est plus une forme attendue, c'est le contrat réel. Il est
**exporté** sous le nom `ProprietesCarteRayon` depuis `app/_lib/CarteRayon.tsx` : l'importer plutôt
que le recopier.

```ts
export type ProprietesCarteRayon = {
  id: string | null;        // « À classer » porte `null` — la story 4.18 en aura besoin
  nom: string | null;       // `null` quand le rayon n'est pas résolu ; repli dans `lib/rayons/carte.ts`
  icone: string | null;     // nettoyé par `iconeDeRayon` — décide si la pastille abricot s'affiche
  pris?: number | null;     // absent OU nul = pas de ratio (l'AC1 le conditionne au compte)
  total: number;
  children?: React.ReactNode;  // optionnel : un rayon vide est un cas nominal (AC2)
};
```

⛔ **UNE OBLIGATION QUE LE COMPOSANT NE PEUT PAS VÉRIFIER, ET QUI EST DONC LA TIENNE.**
`pris`/`total` et `children` **doivent être dérivés du MÊME tableau, dans la même expression.** La
carte reçoit deux sources de vérité pour le même fait et ne peut pas les rapprocher — l'AC3 de la
2.4 lui interdit de connaître le type des articles qu'elle enveloppe.

*Si tu filtres les enfants en comptant sur la liste non filtrée, la carte annoncera « 3 sur 5 pris »
au-dessus de 4 lignes, et **aucune porte ne le verra** : ni test, ni typecheck, ni lint.* La revue
du 2026-08-07 a pesé le correctif (`compte?: { pris, total }`, qui rendrait l'incohérence
inexprimable) et Florian a tranché pour **laisser D2 gelé** — le contrat est déjà annoncé à trois
stories. L'obligation reste donc ici, en toutes lettres, plutôt que dans le type.

⚠️ **Et `pris` vaudra structurellement `0` jusqu'à la story 4.3** — voir la Task 2. ⛔ **Le
dénominateur bouge aussi** : un article coché **sort** de la vue, donc `total` décroît
(`0/4 → 0/3 → …`). C'est consigné dans `deferred-work.md` pour la 4.5.

⚠️ **Ce contrat est celui de la décision D2 de la story 2.4** (2026-08-06), et c'est **elle** qui le
possède. Si le composant livré en diverge, c'est le fichier de la 2.4 qui fait foi.

⚠️ **Deux points de l'AC2 de la story 2.4 à ne pas perdre** : un rayon **sans article** doit se
rendre sans casse (le cas `0/0`), et **le contrat gagnerait un `id`** — sans lui, la story 4.18
(corriger le rayon d'un article) devra changer la signature.

### ⚠️ D2 — Le panier : ✅ **TRANCHÉ le 2026-08-06 — reporté à la STORY 4.5**

`grocery_list_by_aisle` filtre `status = 'pending'`. Or **FR-3** dit que « les articles achetés
restent consultables et récupérables », et `DESIGN.md:283` décrit un séparateur « Dans le panier »
qui sépare, **à l'intérieur d'un rayon**, les articles à prendre des articles cochés.

La story 4.1 a **délibérément laissé** ce filtre, en écrivant : « **La vue ne change PAS son filtre
`status = 'pending'`** : c'est le périmètre de la **4.2 / 4.5**. » Elle n'a pas dit laquelle.

✅ **Décision de Florian : c'est la 4.5.** La 4.2 reste une story de **lecture pure, sans
migration**.

**Ce qui la motive** : cocher est la story **4.3**. Tant que rien ne coche, aucun article n'est
`bought` — un panier livré ici serait **vide et invérifiable**, donc un critère non démontrable.
La 4.5, qui possède le chemin d'écriture du tombstone et l'archivage des achetés, arrive après la
4.3 et pourra l'éprouver.

⚠️ **Conséquences pour l'implémentation de la 4.2** :
- **AUCUNE migration.** `npm run check:migrations` doit rester à 16 / 14 / 2 / 0, et
  `lib/supabase/types.ts` ne se régénère pas.
- **Pas de séparateur « Dans le panier »**, pas de `status` lu, pas de style d'article barré.
- ⚠️ **Le ratio `n/total` de la carte-rayon vaut donc `0/n`** — voir Task 2. C'est juste, et c'est
  la conséquence directe de cette décision.
- **Daté dans `deferred-work.md`**, adressé nommément à la 4.5 (règle §6 bis : ce qui reste ouvert
  se date, il ne s'efface pas).

### ⚠️ D3 — La forme de la première lecture client-direct

L'AC1 exige le client navigateur. Mesuré (M1) : tout le dépôt lit en composant serveur. Le motif
du menu **ne se transpose pas tel quel**, et `loading.tsx` ne couvre pas un `await` client.

| Option | Ce que ça coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** `"use client"` + `useEffect` + `createNavigateurClient()`, squelette rendu **dans** le composant | Tient l'AC1 sans ambiguïté et prépare la 4.8/4.11, qui rafraîchiront ce même état. ⚠️ Perd le premier paint serveur ; le squelette doit donc être **dans** le composant, pas dans `loading.tsx` |
| (b) Rendu serveur pour le premier paint, puis client-direct pour les rafraîchissements | Meilleur premier paint. ⚠️ Mais **deux chemins de lecture** dès la première story, et l'AC1 dit « chargée en client-direct » — pas « rafraîchie » |
| (c) Reporter le client-direct à la 4.8/4.11 | ⚠️ Viderait l'AC1 de son contenu. À écarter, sauf décision explicite |

⚠️ **Dans tous les cas, la fonction de lecture vit dans `lib/liste/` avec le client EN PARAMÈTRE**
(motif `rayonsDuFoyer`). C'est ce qui la rend appelable par le dashboard (Epic 5) et le serveur MCP
(Epic 7) sans une ligne de plus — `createNavigateurClient()` rend le même type
`SupabaseClient<Database>`.

### ⚠️ D4 — « Ma liste » ou « Ta liste » ?

`EXPERIENCE.md` et la maquette écrivent « **Ta liste** » — copie rédigée en **juillet**, avant la
décision de Florian du **2026-08-02** sur les possessifs.

La règle du dépôt (`project-context.md:219-232`) classe un **titre d'écran** comme un LIBELLÉ,
donc **première personne** — cohérent avec « Mon foyer », « Mes rayons », « Mes recettes »,
« Mon menu ».

**DÉFAUT PRESCRIT : « Ma liste »**, et la phrase voisine rendue neutre (piège du voisinage). C'est
le titre le plus visible du produit ; il mérite un mot de Florian.

⚠️ **Et la ROUTE va avec.** Mesuré : aucun chemin d'URL n'est prescrit — ni dans `epics.md`, ni
dans `DESIGN.md`, ni dans `EXPERIENCE.md`. Les quatre voisins nomment tous leur objet (`/foyer`,
`/rayons`, `/recettes`, `/menu`). **DÉFAUT PRESCRIT : `/courses`** — c'est le mot du produit
(« les courses »), et `/liste` serait le mot du modèle. ⚠️ **Une URL ne se renomme pas
gratuitement** : à trancher en même temps que D4.

### ⚠️ D5 — Le gros compteur « 12 à prendre » : ici ou en 4.13 ?

C'est l'objet le plus gros de la maquette (48px), et il est prescrit **cinq fois** :
`DESIGN.md:215` et `:221`, `EXPERIENCE.md:151`, UX-DR11 (`epics.md:162`), et
`review-accessibility.md:65` (« compteur en un seul label "12 articles à prendre" »).

⚠️ **Il tombe entre deux stories** : la 4.2 ne le nomme pas, et la 4.13 **suppose son existence**
sans le livrer (elle ne traite que son annonce accessible). Sans décision, personne ne l'écrit.

| Option | Ce que ça coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Livré ici | C'est un simple `articles.length` sur une liste déjà chargée. ⚠️ Exige de poser le token `--text-counter` (48px, `tabular-nums`), `text-accent-text` — **jamais** `--accent-strong`, mesuré à **2,08:1 sur clair, FAIL AA** — et **un seul `aria-label`** : « 12 articles à prendre », jamais deux nœuds séparés |
| (b) Déféré nommément à la 4.13 | Acceptable si c'est **écrit**. ⚠️ Laisse l'écran sans son objet le plus visible, et la 4.13 devra alors le créer et non l'améliorer |

---

## Ce qui est dû sans être écrit dans les AC

*Quatre points. Aucun n'est du débordement : chacun est soit une conséquence directe que cette
story introduit, soit une prémisse à rouvrir (règle §5).*

### 1. L'accueil se périme à la seconde où cet écran existe

`app/page.tsx:26-32` **nomme cette story** :

> « Cette phrase énumère ce qui EXISTE, et elle se périme à chaque écran livré […] La prochaine à
> la toucher est celle qui livrera la liste de courses (Epic 4). »

La phrase « Tout est prêt : le foyer, les rayons, les recettes, le menu. **Les courses arrivent.** »
devient fausse, et il manque un bouton. **Ce défaut a déjà été payé quatre fois** — stories 1.6,
1.7, 2.1 et 2.2 l'ont chacune réparé. ⚠️ **Il se répare AVEC l'écran, jamais après.**

⚠️ **Et le bouton obéit à la règle des possessifs** : « Ma liste », comme ses quatre voisins.
⚠️ **UX-DR2 : c'est le premier écran du produit qui a droit à l'abricot.** Est-ce que le bouton
« Ma liste » prend `btn-primaire` à la place de « Mon foyer » ? La règle réserve l'abricot à
l'action courses — mais `btn-primaire` n'est pas un accent d'action, c'est une hiérarchie de
bouton. **Défaut prescrit : ne pas déplacer `btn-primaire`**, et ne pas introduire d'abricot sur
l'accueil. L'abricot de cette story vit sur l'écran liste, pas ailleurs.

### 2. Le squelette de chargement

`app/menu/loading.tsx:4-12` porte la leçon, payée par la story 3.3 :

> « Sans ce fichier, `/menu` affiche un **écran blanc** pendant sa lecture. […] un squelette
> manquant ou mal placé **ne se voit qu'au réseau bridé** — jamais en local. »

⚠️ **Mais pour une lecture CLIENT-DIRECT, `loading.tsx` ne suffit pas** — il couvre l'attente du
rendu serveur, pas un `await` dans un `useEffect`. Le squelette doit être **dans le composant**.
`EXPERIENCE.md:116` fixe sa forme : « squelette **de rayons**, pas de spinner plein écran ».

⚠️ **Les hauteurs du squelette suivent celles de l'écran** — contrainte qu'aucun test ne tient
(NFR-10 interdit un harnais de composants). La 3.6 a rendu ses cases à 44px sans toucher le
squelette resté à ~40px : saut de mise en page sur 28 cases, rattrapé en revue.

⚠️ **Le contraste vient de la COULEUR, jamais de l'animation** : `prefers-reduced-motion` ramène
les animations à 0,01 ms, et un squelette dont seule l'animation portait le contraste deviendrait
un aplat invisible. Token : `bg-card-border`. ⛔ **`bg-gray-200` n'existe pas dans ce projet et
échoue EN SILENCE.**

### 3. Le tri secondaire des groupes

`rayonsDuFoyer` (`lib/rayons/rayons.ts:22-28`) le fait déjà pour les rayons, et pour la même
raison : **`sort_order` n'est pas unique**. Sans tri secondaire, l'ordre des cartes change d'un
rechargement à l'autre — « l'écran bouge tout seul ».

⚠️ **Ici c'est pire qu'un ordre instable** : voir piège n°1, deux rayons ex æquo font s'intercaler
leurs articles, donc un regroupement naïf **duplique une carte**.

### 4. Le premier test d'ORDRE sur cette vue

M14 : trois tests touchent la vue, **aucun ne mesure l'ordre**. Cette story est la première dont
l'ordre est un critère (« dans l'ordre du parcours », FR-2). Règle §4 : ça se **mesure**.

---

## Tasks / Subtasks

- [ ] **Task 1 — `lib/liste/` : la lecture et le regroupement** (AC1, AC3)
      <!-- ⚠️ Le glob de `npm test` est `lib/**/*.test.ts` : une fonction pure placée ici est
           testée par la suite rapide, sans stack. Une fonction placée dans `app/` ne l'est pas. -->

  - [ ] `lib/liste/liste.ts` — `articlesDuFoyer(supabase: SupabaseClient<Database>)`
        ⚠️ **Le client est un PARAMÈTRE**, jamais construit dans la fonction (motif
        `lib/rayons/rayons.ts:11-28`) : c'est ce qui la rend utilisable par le dashboard (Epic 5)
        et le serveur MCP (Epic 7), et appelable depuis un client navigateur sans une ligne de plus.
        ⚠️ **Aucun filtre `household_id` à la main** — la RLS s'en charge. L'écrire laisserait
        croire que c'est lui qui protège (AD-1/AD-2).
        ⚠️ **`throw` sur `error`, `[]` sur zéro ligne** — « une liste vide est l'état nominal, pas
        une panne ».
        ⚠️ **`.order("aisle_sort").order("name")` explicite.** Mesuré (M5) : l'`ORDER BY` de la vue
        survit aujourd'hui à PostgREST — mais Postgres ne le **garantit** pas pour une sous-requête,
        et l'explicite coûte zéro.
        ⚠️ **Mapper vers un type de domaine français**, jamais rendre la ligne PostgREST brute.

  - [ ] **Les deux types de domaine, écrits explicitement** — c'est là que se décide l'écran :
        ```ts
        export type ArticleDeListe = {
          id: string;
          nom: string;                 // `name`, tel que le membre l'a tapé
          quantite: number | null;     // `quantity`, formaté par `formaterQuantite`
          unite: string | null;        // `unit` — ⚠️ AD-7, voir Task 3
          rayonId: string | null;      // `aisle_id` — la CLÉ de groupement
          rayonNom: string | null;     // `aisle_name`
          rayonIcone: string | null;   // `aisle_icon`
          rayonOrdre: number | null;   // `aisle_sort`
        };

        export type GroupeDeRayon = {
          rayonId: string | null;      // `null` = « À classer », clé de plein droit
          nom: string | null;
          icone: string | null;
          articles: ArticleDeListe[];
        };
        ```
        ⚠️ **`unite` n'est PAS décoratif** : AD-7 fait de l'unité un morceau de la clé canonique.
        « lait / L » et « lait / pièce » sont **deux lignes distinctes du même rayon**, et les
        omettre rendrait deux « Lait » identiques et inexplicables (voir Task 3).
        ⚠️ **Ne demande que ces colonnes** dans le `.select()` — pas `household_id`, `added_by`,
        `actor_id`, `source_ref`, `intent_at`, qui ne s'affichent pas. ⚠️ **Aucune borne de volume
        n'existe nulle part dans l'architecture** (mesuré : aucune décision AD ne traite
        pagination ni volumétrie). C'est un silence assumé, pas un oubli — ne pose pas de `.limit()`
        sans décision.

  - [ ] Le rétrécissement des nullités
        ⚠️ **Mesuré (M9) : TOUTES les colonnes de la vue sont `| null` dans les types**, `id` et
        `name` compris, parce que Postgres ne propage pas le `not null` à travers une vue. En base
        elles sont `not null`. **Écarter les lignes à `id`/`name` nuls par un `flatMap`** — motif
        exact de `versCaseDeMenu` (`lib/menu/menu.ts:182-201`), qui rend un tableau de 0 ou 1
        élément précisément pour ça.
        ⚠️ **Ne pas affirmer la non-nullité par un `!`** : le dépôt le refuse — « le type décrit le
        schéma, pas la RLS », la garde d'exécution reste due.

  - [ ] `lib/liste/groupement.ts` — `grouperParRayon(articles): GroupeDeRayon[]`
        ⚠️ **REGROUPER PAR CLÉ, JAMAIS PAR LIGNES CONSÉCUTIVES** (piège n°1, mesure M6). La clé est
        `aisle_id`, avec `null` comme clé propre. Motif : `grouperParCase`
        (`lib/menu/menu.ts:286-295`).
        ⚠️ **L'ordre des GROUPES se dérive de `(aisle_sort, aisle_name)`**, pas de l'ordre
        d'apparition. `aisle_sort` nul → **en dernier**, ce qui reproduit `coalesce(…, 9999)` et
        place « À classer » en fin (mesure M7), conforme à `EXPERIENCE.md:67`.
        ⚠️ **L'ordre des ARTICLES dans un groupe reste celui rendu** (par `name`) — ne pas retrier.

- [ ] **Task 2 — CONSOMMER le composant carte-rayon** (AC2) — *décision D1 : il vient de la 2.4*

  ⛔ **PRÉREQUIS DUR : la story 2.4 doit être `done`.** Décision de Florian du 2026-08-06. **La 4.2
  n'écrit PAS ce composant.** Si tu le trouves absent, ne le crée pas : arrête-toi et signale que
  la 2.4 n'est pas faite. Le construire ici serait exactement le débordement que la décision a
  écarté, et la story 4.17 en hériterait d'une seconde version.

  - [ ] Importer le composant livré par la 2.4 et lui passer un groupe par carte
  - [ ] **Le ratio `n/total` vaut `0/n`** — conséquence directe de la décision D2 : les articles
        achetés ne sont pas dans la vue, donc `pris` est structurellement nul avant la 4.3.
        ⚠️ **Ça s'écrit en commentaire, ça ne se découvre pas.** Un relecteur qui voit `0/4`
        pensera à un défaut ; c'est le comportement voulu, et il se corrige à la 4.3.
  - [ ] ⚠️ **Si le contrat de props de la 2.4 diverge de ce que la 4.2 attend** (par exemple s'il
        ne porte pas d'`id` de rayon, dont la 4.18 aura besoin), **le signaler plutôt que de
        l'adapter en place** : c'est un contrat partagé avec la 4.17 et la 4.18.
  - [ ] ⚠️ **Ce que la 4.2 ne redécide PAS**, parce que c'est le contrat de la 2.4 : la pastille
        `bg-accent-soft`, l'emoji `aria-hidden`, le nom en `text-eyebrow uppercase`, l'`aria-label`
        du ratio (« 3 sur 4 pris »), le gabarit `rounded-md`. **Si l'un manque, c'est un défaut de
        la 2.4, à corriger là-bas.**

- [ ] **Task 3 — L'écran** (AC1, AC2)
  - [ ] `app/courses/page.tsx` — la route n'existe pas encore (nom tranché par **D4**)
  - [ ] **L'ENVELOPPE DE PAGE, et elle n'est PAS celle des autres écrans.** Les cinq écrans
        existants partagent `<main className="flex-1 p-6"><div className="mx-auto w-full
        max-w-{sm|2xl|5xl} py-6">`, plus `<Link href="/" className="btn-quiet px-0">← Retour</Link>`
        et `<h1 className="titre-ecran mt-2">`.
        ⚠️ **`DESIGN.md:247` fixe la marge latérale de CET écran à 8px** (`p-screen`), contre 24px
        (`p-6`) partout ailleurs — « l'écran est tenu à une main, **chaque pixel de largeur sert le
        contenu** ». Et `app/recettes/page.tsx:28-32` nomme explicitement cet écran comme le seul à
        porter la contrainte du magasin (NFR-3).
        **Recopier `p-6` est le réflexe, et il coûte 32px de largeur sur le seul écran où c'est
        spécifié.** Reprendre la structure de retour/titre, pas les marges.
        ⚠️ **`export const metadata`** : `app/layout.tsx:10-13` emploie `template: "%s"`, chaque
        page pose donc son titre d'onglet. Motif : `app/menu/page.tsx:22`.
  - [ ] `await requireProfile()` en garde d'expérience
        ⚠️ **Ce n'est PAS un contrôle de sécurité** (`app/_lib/garde.ts:18-22`) — la RLS l'est, et
        elle seule. ⚠️ **`redirect()` lève** : ne jamais l'envelopper dans un `try/catch`.
  - [ ] **LA LIGNE-ARTICLE** — `DESIGN.md:279`, la spécification que cette story doit rendre :
        > « de gauche à droite : **coche** / **libellé** (`{typography.body}`) / **pastille
        > "arrive…"** si en attente / **quantité** (`{typography.qty}` en muted, AA) / **icône de
        > provenance**. Hauteur min `{spacing.item-min-height}`, zone de tap = toute la ligne. »

        Ce que la **4.2** rend, et rien d'autre : **le libellé, la quantité et l'unité.**
        La coche est la 4.3/4.13, la pastille la 4.14, la provenance la 4.6.
        - [ ] Libellé en `text-body`, `min-w-0 flex-1 break-words` (200 caractères possibles, M13)
        - [ ] **Quantité + unité**, en `text-muted` et **`tabular-nums`**, via
              `formaterQuantite(quantite)` (`lib/recettes/lecture.ts:47` — réutilisable tel quel)
        - [ ] Hauteur `min-h-item` (46px — le token `--spacing-item` existe **et n'est employé
              nulle part** : il attendait cet écran)
        - [ ] ⚠️ **SANS L'UNITÉ, L'ÉCRAN MENT.** AD-7 : « lait / L » et « lait / pièce » sont deux
              lignes légitimes du même rayon (la clé canonique porte l'unité). Les afficher toutes
              deux « Lait » rendrait un doublon apparent que rien n'explique — et le membre
              conclurait que l'agrégation est cassée.
        - [ ] ⚠️ **`muted`, jamais `muted-2`** : la quantité est un texte PORTEUR d'information.
              `DESIGN.md:226` — « aucun texte porteur d'information n'est en muted-2 ».
              `muted-2` est réservé à l'article déjà coché (donc à la 4.3).
        - [ ] ⚠️ **La ligne est UN SEUL conteneur.** La 4.13 y posera une coche et un hit-target
              unique : si la 4.2 rend plusieurs éléments interactifs frères, la 4.13 devra tout
              refaire.

  - [ ] Le sous-titre, verbatim d'`EXPERIENCE.md:90` — c'est la phrase qui **explique le critère
        central de la story** au membre :
        ```
        Rangée dans l'ordre de ton magasin.
        ```
        En `text-meta text-muted` (`DESIGN.md:226` la nomme explicitement parmi les textes muted).

  - [ ] Le composant de liste, forme tranchée par **D3**
        ⚠️ **Un drapeau d'annulation dans le nettoyage du `useEffect`** (ou un `AbortController`) :
        ne jamais `setState` après démontage, et ne pas laisser la seconde lecture du double
        montage de développement écraser la première. **Tous les `useEffect` du dépôt rendent un
        nettoyage** — le premier qui lit des données ne doit pas faire exception.
        ⚠️ **`articlesDuFoyer` LÈVE, et sur un écran client PERSONNE ne l'attrape.** `app/error.tsx`
        est une frontière d'erreur de **rendu** : un rejet de promesse dans un callback `async` de
        `useEffect` ne la traverse pas — il devient un `unhandledrejection`, et l'écran **reste sur
        le squelette indéfiniment, sans rien dire**. C'est le motif de `rayonsDuFoyer` qui ne se
        transpose pas : il est appelé depuis un composant **serveur**, où le `throw` atterrit bien
        dans `error.tsx`. **Enveloppe l'appel dans un `try/catch` et rends l'échec dans la
        `Notice`. Le squelette ne doit JAMAIS être l'état d'échec.**
  - [ ] **Le squelette DANS le composant** (§ Ce qui est dû, point 2), pas seulement un
        `loading.tsx`
  - [ ] `app/courses/loading.tsx` quand même : il n'y a ni `app/loading.tsx` ni `layout.tsx` de
        segment, donc rien ne couvre l'attente du rendu serveur de la page
  - [ ] **Structure de titres et listes** : `<h1>` titre d'écran, **`<h2>` par carte-rayon**
        portant le nom, `<ul>`/`<li>` pour les articles. Pas de saut de niveau, pas d'empilement de
        `<div>`.
  - [ ] **Une région `Notice` montée EN PERMANENCE**, hors des conditionnels
        ⚠️ **C'est le récidiviste n°1 du dépôt — cinq occurrences.** Un message rendu à l'intérieur
        de la liste partirait avec elle au premier rendu vide.
        ⚠️ **`reserve` si la région surplombe la liste**, sans sinon (`Notice.tsx:15-18`).
  - [ ] **L'état vide** : `EXPERIENCE.md:117` fixe « **Ta liste est vide.** »
        ⚠️ **ÉCART ASSUMÉ à cette même ligne** : elle prescrit aussi « Sur téléphone, **lien vers
        l'ajout** ». Ce lien n'existera qu'en **4.4**. Un conseil qui ne peut pas fonctionner
        enferme l'utilisateur dans une boucle (`project-context.md:241-244`) — donc **pas de lien**,
        et c'est écrit ici plutôt que d'esquiver la source.
  - [ ] ⚠️ **Aucun défilement horizontal** (NFR-3, **UX-DR11** — UX-DR10 est la grille du menu) : un nom d'article va jusqu'à **200
        caractères** (mesure M13), sans garantie d'espace où couper. Motif de contention du dépôt :
        `min-w-0 flex-1` + `break-words`.

- [ ] **Task 4 — L'accueil** (§ Ce qui est dû, point 1)
  - [ ] La phrase d'annonce de `app/page.tsx:39-42` cesse de dire « Les courses arrivent »
  - [ ] Un bouton « Ma liste », cohérent avec ses quatre voisins
  - [ ] ⚠️ **Ne déplace pas `btn-primaire`** et n'introduis pas d'abricot sur l'accueil (§ dû, 1)
  - [ ] ⚠️ **`project-context.md:247` — NE PAS le corriger ici.** Il dit aujourd'hui, sans nuance :
        « **Pas d'abricot** hors de l'anneau de focus ». ⛔ **C'est la story 2.4 qui lève l'interdit**,
        puisque c'est elle qui pose le premier abricot du produit (la pastille `bg-accent-soft` de la
        carte-rayon) et qu'elle est le prérequis dur de celle-ci. La tâche vit dans son fichier.

- [ ] **Task 5 — Les tests**
  - [ ] `lib/liste/groupement.test.ts` — la fonction pure, dans `npm test`
        - [ ] **Deux rayons ex æquo ne font pas deux cartes du même rayon** — le test de la
              mesure M6, et le plus important du lot
        - [ ] **Aucun article perdu, aucun dupliqué** : assertion STRUCTURELLE sur l'ensemble,
              motif `memeEnsemble` de `lib/ordre.test.ts:26-38`
        - [ ] **Les articles sans rayon forment un groupe, et il est en DERNIER**
        - [ ] **L'ordre des groupes suit `(aisle_sort, aisle_name)`**, pas l'ordre d'apparition
  - [ ] `supabase/tests/isolation.test.ts` — ce qu'un faux client ne peut pas prouver
        - [ ] **L'ORDRE rendu par la vue** — M14 : aucun test ne le mesure aujourd'hui, et c'est
              le premier critère qui en dépend
        - [ ] **Un article dont le rayon EXISTE** — M8 : tous les tests actuels ont `aisle_id` nul,
              donc le `left join` n'est jamais éprouvé côté renseigné
        - [ ] ⚠️ **Par le client authentifié de A, jamais par `admin`** : la clé de service
              traverse la RLS et le test passerait en ne prouvant rien
  - [ ] ⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers avant de
        lancer. Tout contrôle neuf répond à : *que se passe-t-il s'il ne trouve rien ?*

- [ ] **Task 6 — Les portes, le parcours à l'écran, puis les statuts**
  - [ ] `npm run lint` · `npm run typecheck` · `npm test` (**198 attendus au minimum**) ·
        `npm run test:isolation` (**95 attendus au minimum**)
  - [ ] ⚠️ **`npm run check:migrations` doit rester à 16 / 14 / 2 / 0** — décision D2 : cette story
        ne pose **aucune migration**, et ne régénère donc pas `lib/supabase/types.ts`
  - [ ] **Le parcours à l'écran, et il n'est pas optionnel** : règle §7, trois familles de défaut
        n'ont jamais été attrapées que par un humain qui regarde. ⚠️ **Poser `aisle_id` à la main
        sur le stack local** — mesure M8 : sans ça, l'écran n'affiche qu'un seul groupe et le
        regroupement n'est pas éprouvé
  - [ ] ⚠️ **Naviguer sur `localhost:3333`, jamais `127.0.0.1:3333`.** Sur un écran client-direct,
        une hydratation cassée ne rend **aucune donnée**, et rien ne le dit dans le navigateur
  - [ ] **Les deux thèmes**, au réglage système et non dans les outils de développement
        (`osascript`, **et le remettre après**)
  - [ ] `Status` du fichier de story, **puis** `sprint-status.yaml`. Règle §6 bis : **le fichier
        fait foi**

---

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Besoin | Où c'est déjà | Piège si tu le refais |
|---|---|---|
| Le client navigateur | `lib/supabase/client.ts:14-20` — `createNavigateurClient()` | ⚠️ **Appelée DANS le gestionnaire**, jamais au niveau module ni dans un `useMemo`. Et `supabaseEnv()` **lève** : l'appel doit être dans le `try` |
| Le motif « client en paramètre » | `lib/rayons/rayons.ts:30-58`, `lib/menu/menu.ts:120` | Construire le client dans la fonction la rend inutilisable par l'Epic 5 et l'Epic 7 |
| Le regroupement pur | `lib/menu/menu.ts:286-295` — `grouperParCase` | ⚠️ **Reprends sa BOUCLE, pas son type de retour** : il rend une `Map`, dont l'itération suit l'**ordre d'insertion** — exactement l'« ordre d'apparition » que la Task 1 proscrit. `grouperParRayon` rend un **tableau trié** |
| Le rétrécissement des nullités | `lib/menu/menu.ts:182-201` — `versCaseDeMenu` | Un `!` d'assertion : le dépôt le refuse explicitement |
| Le formatage de quantité | `lib/recettes/lecture.ts:46-52` — `formaterQuantite` | Réutilisable **tel quel** : virgule française, `useGrouping: false`, 2 décimales max |
| La zone de message | `app/_lib/Notice.tsx` | Écrire `role="status"`+`aria-live` à la main : l'oubli est **silencieux et grave** |
| Le squelette | `app/recettes/loading.tsx:23-36` | `bg-gray-200` — **échec silencieux**, la palette est neutralisée |
| La garde d'écran | `app/_lib/garde.ts` — `requireProfile()` | L'envelopper dans un `try/catch` : `redirect()` lève |
| Le motif de test pur | `lib/ordre.test.ts` | Un test qui n'assertionne pas l'ensemble complet laisse passer un article avalé |
| Le harnais à deux comptes | `supabase/tests/isolation.test.ts:52-113` | Mesurer avec `admin` : il traverse la RLS |
| L'écran plein d'erreur | `app/_lib/EcranMessage.tsx` | Le réécrire — il porte déjà `role="alert"` et le focus sur le titre |
| Le libellé d'attente | `app/_lib/libelles.ts` — `LIBELLE_OCCUPE` | Il était en dur dans sept boutons avant d'être centralisé |
| **Trois tokens posés POUR cet écran et employés nulle part** | `globals.css:146-149` — `--spacing-screen` (8px, *« marge latérale de l'écran liste »*), `--spacing-item` (46px, *« hauteur de ligne-article »*), `--spacing-gutter` (14px, inter-cartes) | Recopier `p-6` comme les autres écrans : `DESIGN.md:247` fixe la marge de CET écran à **8px**, et chaque pixel de largeur sert le contenu |

### Piège n°1 — LE REGROUPEMENT NAÏF EST FAUX, et c'est mesuré

**Mesuré (M6).** `aisles.sort_order` est `integer not null default 100`, **sans contrainte
d'unicité**. Deux rayons ex æquo :

```
 name | aisle_name | aisle_sort
 aaa  | Exaequo    |         20
 bbb  | Alpha      |         20
 ccc  | Exaequo    |         20
```

Un regroupement « je parcours les lignes et j'ouvre une carte quand `aisle_name` change » rendrait
**trois cartes, dont deux « Exaequo »**. L'utilisateur verrait son rayon deux fois, avec ses
articles répartis au hasard entre les deux.

**La forme correcte** : regrouper par **clé** (`aisle_id`, `null` étant une clé propre), puis trier
les groupes par `(aisle_sort, aisle_name)`. C'est exactement le correctif que `rayonsDuFoyer`
applique déjà (`lib/rayons/rayons.ts:22-28`), pour la même raison.

⚠️ **Et c'est le test le plus important de la story** — sans lui, le défaut ne se voit que sur un
foyer qui a réordonné ses rayons, donc jamais en développement.

### Piège n°2 — Sur une base réelle, tu ne verras QU'UN SEUL GROUPE

**Mesuré (M8).** 100 % des articles ont `aisle_id` nul, et **la raison n'est pas celle qu'on
suppose** : `resolve_aisle_id` **est** bien appelée par `generate_grocery_list_from_menu`. C'est
**`product_aisle_map` qui ne contient aucune ligne** — les règles mot-clé → rayon sont la story
**2.3**, encore en `backlog`. La fonction s'exécute et rend `null`.

Conséquence : l'écran affichera un unique groupe « À classer », et le regroupement par rayon
paraîtra cassé alors qu'il est juste. **Pose `aisle_id` à la main sur le stack local** pour
l'éprouver — c'est la seule façon de voir la Task 1 fonctionner.

⚠️ **N'ajoute aucune règle dans `product_aisle_map` et ne câble pas `resolve_aisle_id`** pour
arranger ça : ce sont les stories 2.3 et 4.16. L'AC3 dit que la résolution du rayon est autoritaire
côté serveur — la poser depuis une surface de lecture serait exactement la règle métier hors base
qu'AD-1 interdit.

### Piège n°3 — `loading.tsx` ne couvre pas une lecture client

Un `loading.tsx` de segment enveloppe l'attente du **rendu serveur**. Une lecture faite dans un
`useEffect` se produit **après** que la page est rendue : le `loading.tsx` a déjà disparu, et
l'écran est vide pendant le `await`.

**Les deux sont dus, et ils ne couvrent pas la même chose** : `loading.tsx` pour l'attente du
rendu, un squelette **dans le composant** pour l'attente de la lecture.

⚠️ **Ça ne se voit qu'au réseau bridé** — la leçon de la story 3.3, écrite dans
`app/menu/loading.tsx:4-12`. En local, la lecture est trop rapide pour que le trou soit visible.

### Piège n°4 — Les types de la vue mentent sur les nullités

**Mesuré (M9).** `Views.grocery_list_by_aisle.Row` porte **toutes** ses colonnes en `| null`,
`id` et `name` compris, alors qu'elles sont `not null` en base. Postgres ne propage pas la
non-nullité à travers une vue, et le générateur de types ne peut pas l'inventer.

Le dépôt a déjà tranché la forme : **écarter par `flatMap`**, jamais affirmer par `!`. La raison
est écrite dans `lib/menu/menu.ts:146-155` — « le type décrit le schéma, pas la RLS » : une ligne
peut manquer pour des raisons que le type ne voit pas, donc la garde d'exécution reste due.

### Piège n°5 — L'abricot, enfin autorisé, et pourtant presque partout interdit

C'est **le premier écran du produit où l'abricot devient légitime** (UX-DR2 le réserve à l'action
courses ; jusqu'ici il ne vivait que dans l'anneau de focus). Trois emplois, et rien d'autre :

1. **L'anneau de focus** — déjà global (`globals.css:236-239`). Zéro code.
2. **La pastille emoji du rayon** — `bg-accent-soft`. C'est le seul abricot *neuf* de la story, et
   il est explicitement spécifié (`DESIGN.md:150-151`).
3. **Le gros compteur**, s'il est rendu — `text-accent-text`.

⚠️ **INTERDIT** : abricot sur le titre, le sous-titre, les noms de rayon, le ratio, les quantités,
les libellés d'articles ; abricot pour marquer « À classer » (ce serait un badge d'état générique) ;
bordure abricot sur la carte-rayon (**seule la tuile Courses du dashboard la porte**).
⚠️ **`--accent` et `--accent-strong` ne sont PAS publiés comme utilitaires**, délibérément :
`text-accent` rendait **1,90:1** sur carte blanche. Employer `accent-fill` / `accent-text` /
`accent-ink`, ou `var(--accent)` dans la couche composants.
⚠️ **Aucun rouge, jamais** — y compris pour l'erreur de lecture (UX-DR1).

### Piège n°6 — Ce que la 4.1 a légué et que cette story installe comme habitude

La 4.1 a mesuré, et l'a écrit dans l'en-tête de sa migration :

> Un article **ACHETÉ** occupe la clé canonique, et **la ligne qui occupe la clé est invisible dans
> `grocery_list_by_aisle`**. Une surface qui lit la vue et écrit par INSERT recevra `23505` en
> désignant un article que sa propre lecture affirme absent. **La règle : lire la TABLE, pas la
> vue, avant tout ajout.**

La 4.2 n'écrit rien, donc elle ne peut pas tomber dedans. **Mais elle est la story qui installe
l'habitude de lire la vue**, et la 4.4 héritera de cette habitude. C'est pour ça que c'est écrit
ici plutôt que découvert là-bas.

### Piège n°7 — Les mots bannis sont exactement ceux qui viennent à l'esprit ici

`synchronisation, jeton, API, MCP, pont, Supabase, RLS, cache` — sur un écran de lecture
client-direct, ce sont **les huit mots les plus naturels** pour décrire ce qui se passe. Aucun ne
peut apparaître à l'écran (NFR-9, UX-DR12).

⚠️ Ils peuvent et **doivent** apparaître dans les commentaires de code : ce sont les bons mots pour
parler à un développeur.

### Piège n°8 — Une hydratation cassée ne rend RIEN, et ne le dit pas

Sur les écrans précédents, une hydratation ratée dégradait l'interactivité mais le contenu restait
— il venait du serveur. **Sur un écran client-direct, le contenu vient de l'hydratation** : si elle
échoue, il n'y a pas de liste du tout, et le navigateur ne dit rien (seule la sortie du serveur le
signale).

Cause n°1 dans ce dépôt : naviguer sur `127.0.0.1:3333` au lieu de `localhost:3333` — Next 16
bloque ses ressources de développement en cross-origin.

### Frontières — ce que cette story ne fait pas

| Hors périmètre | Sa story |
|---|---|
| Cocher / décocher | 4.3 |
| Ajouter un article, l'agrégation, la traduction de `23505`/`23514` à l'écran, `lib/liste/erreurs.ts` | 4.4 |
| Supprimer, archiver les achetés, vider — et **rendre les achetés visibles** | 4.5 *(voir D2)* |
| Afficher la provenance | 4.6 |
| Le cache local, le service worker, le squelette « dernière liste connue » | 4.8 |
| L'outbox, l'optimiste local | 4.9 |
| L'arbitrage LWW | 4.10 |
| **Realtime** — cet écran est un chargement, pas un abonnement | 4.11 |
| Le versionnage du contrat | 4.12 |
| La coche comme vrai contrôle, le hit-target unique, le zoom 200 % | 4.13 |
| Le bandeau hors-ligne, la pastille « arrive… » | 4.14 |
| Générer la liste depuis le menu — l'action la plus tentante à côté d'une liste vide | 4.7 |
| Le filet de vérification nommé (isolation & convergence) | 4.15 |
| `resolve_aisle_id` câblée | 4.16 |
| Les règles mot-clé → rayon, qui rempliraient `product_aisle_map` | 2.3 |
| **Le composant carte-rayon lui-même** — décision de Florian du 2026-08-06 | **2.4** *(prérequis dur)* |
| **Rendre les articles achetés, le séparateur « Dans le panier »** — décision du 2026-08-06 | **4.5** |
| **Le groupe « À classer » comme groupe de première classe** — la 4.2 le fait seulement apparaître | 4.17 |
| Corriger le rayon d'un article | 4.18 |

⚠️ **Si tu te retrouves à écrire un `subscribe`, un `IndexedDB`, un `navigator.onLine` ou un
`<input type="checkbox">`, arrête-toi et relis ce tableau.**

### Contraintes d'architecture applicables

- **AD-13** — « les surfaces liste **lisent/écrivent via le client Supabase du navigateur**
  (RLS-enforced) ». ⚠️ **La lecture est nommée en premier, au même titre que l'écriture**, et le
  critère de cause (secret serveur / rendu serveur) n'est écrit **que pour les écritures**. Le
  *Prevents* nomme la régression exacte : « un retour au tout-`force-dynamic` »
- **AD-1 / AD-2** — la règle vit en Postgres. `security_invoker = true` sur la vue est ce qui tient
  l'isolation en lecture ; **aucun filtre `household_id` côté client**
- **AD-3** — `updated_at` est explicitement « l'horodatage d'**affichage**/Realtime, **pas
  l'arbitre** » : c'est celui qu'une surface de lecture a le droit d'employer. *(Qu'`intent_at` ne
  soit jamais un horodatage d'affichage en est la conséquence — **déduit**, AD-3 ne le nomme pas)*
- **AD-6** — la résolution de rayon est **autoritaire côté serveur**. Une surface ne la recalcule
  pas, même « provisoirement »
- ⛔ **STORY 2.4 — prérequis dur, décision du 2026-08-06.** Le composant carte-rayon vient de là.
  La 4.2 ne démarre pas avant qu'elle soit `done`
- **AD-5** — « le cache de lecture local est **jetable** ; Supabase est le magasin durable, repull
  à la réouverture ». C'est l'argument architectural de la décision D3, et le lien avec la 4.8
- **AD-7** — vocabulaire d'unités fermé, **deux unités ne sont jamais additionnées ni converties :
  elles restent deux lignes**. C'est pourquoi la ligne-article DOIT rendre l'unité (Task 3)
- **AD-8** — « jamais de polling, **jamais de reload manuel** ». ⚠️ **Donc pas de bouton
  « rafraîchir » ni de `setInterval` pour compenser l'absence de Realtime** — c'est la 4.11 qui
  apporte la propagation, et un bouton posé ici serait à retirer
- **AD-16** — la RLS est par FOYER, pas par membre. N'invente aucun contrôle applicatif
- **AD-17** — deux familles : tests de RLS (`test:isolation`) et de convergence. Cette story ajoute
  au premier, et ouvre le premier test d'ORDRE de la vue
- **FR-20** — « aucune surface ne peut produire un état que les autres jugeraient invalide ».
  L'Epic 5 lira **la même vue** : toute règle de regroupement inventée ici serait à réimplémenter
  là-bas
- **NFR-3** — le magasin est le contexte de référence : téléphone à une main, **aucun défilement
  horizontal**, colonne unique. C'est le seul écran dont l'ergonomie mobile n'est pas négociable
- **NFR-10** — aucune dépendance npm nouvelle. Pas de bibliothèque de state ni de data-fetching :
  `useState` + `useEffect` suffisent, et c'est la réponse attendue

### Standards de test

**Comptes MESURÉS le 2026-08-05 sur `fb7b5c4`** :

| Suite | Commande | État mesuré |
|---|---|---|
| Unitaires | `npm test` | **198 / 198** — exécuté |
| Isolation & contraintes | `npm run test:isolation` | **95 / 95** — exécuté, stack local debout |

**Où va quoi :**

1. **`lib/liste/groupement.test.ts`** (`npm test`) — le regroupement et le tri, en fonction pure.
   C'est là que vit le test des rayons ex æquo.
2. **`supabase/tests/isolation.test.ts`** — ce qu'un faux client ne peut pas prouver : l'ordre
   réellement rendu par la vue, et le `left join` sur un rayon renseigné.

⚠️ **La frontière est celle que `lib/menu/menu.test.ts:9-13` a déjà tracée** : « un faux client
prouverait le mapping et jamais l'isolation ». Le regroupement pur ici, la lecture PostgREST là-bas.

⚠️ **Vérifie les dents.** Le dépôt a déjà mesuré une contrainte sans aucune dent, et la revue de la
4.1 a trouvé **deux** tests qui ne mesuraient pas ce qu'ils croyaient. La méthode : casse la chose
en local, et le test doit **tomber**. Ici, au minimum : mets deux rayons au même `sort_order` et
vérifie que le test de regroupement tombe si tu reviens à un parcours « par lignes consécutives ».

⚠️ **Le test qui a le plus de valeur est l'assertion STRUCTURELLE** — aucun article perdu, aucun
dupliqué. Sans elle, un `Map` mal alimentée passe tous les tests d'ordre.

### Project Structure Notes

```
app/courses/
  page.tsx                    +  NOUVEAU — la route n'existe pas
  loading.tsx                 +  NOUVEAU — ni `app/loading.tsx` ni `layout.tsx` de segment
  ListeCourses.tsx            +  NOUVEAU — le composant client (forme tranchée par D3)
app/_lib/
  CarteRayon.tsx              ⛔ LIVRÉ PAR LA STORY 2.4 — la 4.2 le CONSOMME, ne l'écrit pas (D1)
lib/rayons/carte.ts           ⛔ LIVRÉ PAR LA STORY 2.4 — la logique pure du ratio et le repli du
                                 libellé « À classer ». C'est la SEULE partie testée du composant
app/page.tsx                  ~  la phrase d'annonce et le bouton (§ dû, point 1)
lib/liste/
  liste.ts                    +  NOUVEAU — `articlesDuFoyer(supabase)`, client EN PARAMÈTRE
  groupement.ts               +  NOUVEAU — `grouperParRayon`, fonction PURE
  groupement.test.ts          +  NOUVEAU — dans `npm test`
  erreurs.ts                  ⛔ N'EXISTE PAS et ne doit pas naître ici — story 4.4
supabase/tests/
  isolation.test.ts           ~  l'ordre de la vue, et le rayon renseigné
supabase/migrations/          ⛔ AUCUNE — décision D2 : le panier part à la 4.5, donc rien à migrer
lib/supabase/types.ts         INCHANGÉ — aucune migration, donc aucune régénération
package.json                  INTACT — aucune dépendance (NFR-10)
app/globals.css               ~  `--text-counter` si D5 option (a). ⚠️ `--text-qty` est mesuré
                                 ABSENT — mais il sert le ratio de la carte-rayon, donc il relève
                                 de la story 2.4 (D1). À signaler si elle ne l'a pas posé
```

⚠️ **Si tu te retrouves à écrire une migration, relis D2 puis les frontières.**
⚠️ **Si tu régénères `lib/supabase/types.ts`, tu as fait une migration sans le vouloir.** Et si
c'est délibéré, la commande exacte est
`npx -y supabase@2.106.0 gen types typescript --local --schema public` — la commande nue dérive
(deux CLI sur le poste, aucune épinglée ; `deferred-work.md`, 2026-08-05).

### Environnement de test — une contrainte S'INVERSE ici

- **Le stack local** : API `http://127.0.0.1:55321`, base `:55322`, Studio `:55323`. `db reset` est
  l'outil normal en local, interdit sur le distant
- **Le serveur de développement écoute sur 3333**, et **l'hôte compte** : `localhost:3333`, jamais
  `127.0.0.1:3333` (piège n°8)
- ✅ **LES PRÉVISUALISATIONS VERCEL SONT UTILISABLES POUR CETTE STORY, contrairement aux
  précédentes.** Elles parlent à la base de PRODUCTION, et la migration dont dépend cette story y
  est **appliquée depuis le 2026-08-05** (mesure M16). Un critère de la 4.2 y est donc démontrable.
  ⚠️ **Le corollaire tient toujours** : ce sont de **vraies données du foyer de production**. Cette
  story ne fait que lire, donc le risque est faible — mais aucun geste d'écriture ne s'y essaie
- ⚠️ **Le parcours à l'écran exige de poser `aisle_id` à la main** (piège n°2), sur le stack local

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session.** Six règles mordent ici :

- **§1** — ne consigner comme vérifié que ce qui a été **exécuté**. Cette story distingue partout le
  mesuré du déduit ; la seule déduction assumée est le comportement de `loading.tsx` face à une
  lecture client
- **§2** — un commentaire explique un *pourquoi*, jamais un état. ⚠️ **`app/page.tsx:26-32` est un
  commentaire d'état qui se périme, et c'est CETTE story qui doit le rafraîchir** — il le dit
  lui-même
- **§3** — une énumération ne peut pas gagner contre une catégorie. Ici : le regroupement se fait
  par **clé**, pas par comparaison de libellés consécutifs
- **§4** — un invariant entre deux fichiers se **mesure**. Ici : l'ordre que la vue promet et celui
  que l'écran rend
- **§6 bis** — le `Status` du fichier de story se ferme AVEC le suivi de sprint. **Le fichier fait
  foi**
- **§7** — ce qu'aucune porte automatique ne voit : **le rendu**. Quatre défauts trouvés au parcours
  du 2026-07-29 que 92 tests ne voyaient pas. Cet écran a une surface : le parcours est dû

### Intelligence git — ce que les cinq derniers commits enseignent

| Commit | Ce qu'il enseigne à cette story |
|---|---|
| `fb7b5c4` feat(liste) (4.1) | **La vue que cette story lit.** Sa revue a trouvé deux défauts que la story déclarait fermés — l'AC4 défait par une RPC, l'AC2 faux pour 241 points de code. ⚠️ **Le motif : une story peut affirmer tenir un critère et ne pas le tenir.** Les huit passages au banc des dents sont ce qui l'a montré |
| `9c127d4` feat(menu) (3.6) | **Le motif de séparation serveur/client à reprendre**, et le défaut du squelette désaligné (44px rendus, ~40px au squelette) rattrapé en revue |
| `a56ba0b` feat(menu) (3.5) | Le premier écran de lecture d'une grille ; l'état vide hissé **hors** de la grille plutôt que dedans |
| `795678e` feat(recettes) (3.3) | ⚠️ **La leçon du squelette** : « un squelette manquant ou mal placé ne se voit qu'au réseau bridé — jamais en local » |
| `959a626` refactor(microcopy) | **La décision des possessifs du 2026-08-02**, 20 chaînes. C'est elle qui rend « Ma liste » cohérent et « Ta liste » périmé (décision D4) |

### References

- `_bmad-output/planning-artifacts/epics.md#Story-4.2` — les trois AC, cités verbatim ; bloc
  Story 2.4 pour le contrat du composant carte-rayon
- `_bmad-output/planning-artifacts/architecture/architecture-nutriclaude-2026-07-23/ARCHITECTURE-SPINE.md`
  — **AD-13** (le texte de référence de cette story), AD-1, AD-2, AD-3, AD-6, AD-8, AD-16, AD-17
- `_bmad-output/planning-artifacts/prds/prd-nutriclaude-2026-07-21/prd.md` — FR-1, FR-2, FR-3,
  FR-9, FR-20 ; NFR-1, NFR-3, NFR-5, NFR-8, NFR-9
- `_bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md` — `:247-251`
  densité et colonne unique, `:266` carte-rayon, `:278` en-tête de carte, `:283` séparateur panier,
  `:215-230` discipline de l'abricot
- `_bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md` — `:62-74`
  la liste comme objet central, `:103` carte-rayon, `:116-118` les états, `:136` le banni,
  `:84-92` la table de microcopy
- `_bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/mockups/liste-et-dashboard.html`
  — **la maquette de référence de cet écran** (« écran pivot »). ⚠️ `DESIGN.md:275` : « en cas de
  conflit entre une maquette et ce document, **ce document fait foi** — les maquettes illustrent,
  elles ne décident pas »
- `_bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/review-accessibility.md` —
  `:65` sémantique lecteur d'écran (ratio, compteur), `:73` cibles adjacentes.
  ⚠️ **Ne pas y puiser de VALEURS de couleur** : `globals.css:5-9` dit qu'elles sont d'avant
  l'arbitrage et ont été remplacées
- `supabase/migrations/20260805092611_poser_le_modele_canonique_de_la_liste.sql` — volet 7 (la vue),
  volet 6 (les politiques), et l'en-tête du volet 4 pour le piège `23505` adressé nommément à la 4.2
- `_bmad-output/implementation-artifacts/4-1-…-isolation-rls.md` — les mesures M1-M17 de la 4.1 et
  ses `Review Findings`
- `lib/rayons/rayons.ts` — le motif de lecture canonique (client en paramètre, `throw`/`[]`, tri
  secondaire)
- `lib/menu/menu.ts:182-201` et `:286-295` — le rétrécissement des nullités et le regroupement pur
- `lib/ordre.test.ts` — le motif d'un test de fonction pure avec assertion structurelle
- `app/menu/page.tsx`, `app/menu/loading.tsx` — la séparation serveur/client et le squelette
- `app/_lib/Notice.tsx`, `app/_lib/garde.ts` — les primitives et leurs pièges
- `app/globals.css` — `:109-200` les tokens publiés, `:249-396` la couche composants
- `_bmad-output/project-context.md` — les règles de méthode et les motifs à reprendre
- `docs/migrations.md` — pourquoi les prévisualisations parlent à la production

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Review Findings

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-05 | create-story | Contextualisation. Seize mesures exécutées sur le stack local (`fb7b5c4`), dont trois qui invalident le cadrage naïf : le composant carte-rayon de la story 2.4 **n'existe pas**, deux rayons ex æquo font **s'intercaler** leurs articles, et **aucun article n'a de rayon résolu** en base. Quatre décisions ouvertes, chacune avec son défaut prescrit. |
| 2026-08-06 | Florian | **D1 et D2 tranchées.** **D1 → la story 2.4** construit le composant carte-rayon : la 4.2 le **consomme**, et devient **bloquée** tant que la 2.4 n'est pas `done`. **D2 → la story 4.5** rend les articles achetés : la 4.2 reste une lecture pure, **sans migration**, et le ratio `n/total` vaut structurellement `0/n` jusqu'à la 4.3. Entrée datée ajoutée à `deferred-work.md`. D3, D4 et D5 restent sur leurs défauts prescrits. |
| 2026-08-05 | create-story (validation) | **Passe de validation en contexte neuf, et elle a trouvé un trou et quatre affirmations fausses.** ⛔ **Le trou** : la story ne disait nulle part ce qu'une **ligne d'article** affiche — `DESIGN.md:279` n'avait pas été ouvert. Sans l'unité, « lait / L » et « lait / pièce » rendraient deux « Lait » identiques et inexplicables (AD-7). Corrigé, avec les deux types de domaine écrits explicitement. ⛔ **Les faux** : `revalidatePath` existe bel et bien (3 appels, `app/foyer/actions.ts`) ; `resolve_aisle_id` **est** câblée — c'est `product_aisle_map` qui est vide, donc la story **2.3** et non la 4.16 ; 20 sites d'appel du client navigateur, pas 12 ; et la phrase « le type décrit le schéma » est dans `lib/menu/menu.ts:152`, pas dans `queries.ts`. ⚠️ **Trois manques structurants ajoutés** : un `throw` dans un `useEffect` **ne traverse pas `app/error.tsx`** (l'écran resterait sur le squelette, muet) ; le gros compteur tombait entre la 4.2 et la 4.13 (décision **D5**) ; et `project-context.md:247` interdit l'abricot que cette story est justement celle qui autorise. |
