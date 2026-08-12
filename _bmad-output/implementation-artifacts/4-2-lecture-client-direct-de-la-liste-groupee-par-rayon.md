---
baseline_commit: 69a34fa
---
<!-- ⚠️ `baseline_commit` MIS À JOUR le 2026-08-07, sur décision de Florian, et c'est un écart
     délibéré au workflow `dev-story` (qui prescrit de préserver un baseline existant).
     Il valait `fb7b5c40aaff471c3802941e19957eb1c28d75a9`, posé à la contextualisation du
     2026-08-05 — **avant que la story 2.4 n'existe**. Depuis, `99e62e0` puis `69a34fa` ont livré
     le composant carte-rayon, ses 22 tests et deux passes de revue : 678 lignes qui ne sont pas
     celles de la 4.2. Laisser l'ancien baseline aurait fait porter la revue de cette story sur le
     travail d'une autre. -->

<!-- ✅ **D3, D4 ET D5 TRANCHÉES PAR FLORIAN LE 2026-08-07**, toutes sur leur défaut prescrit :
     · D3 → **(a)** lecture tout-client (`"use client"` + `useEffect` + `createNavigateurClient()`),
       squelette DANS le composant ;
     · D4 → **« Ma liste »** et la route **`/courses`** ;
     · D5 → le gros compteur est **livré ici**, avec son token `--text-counter`. -->

<!-- ✅ **PRÉREQUIS DUR LEVÉ** : la story 2.4 est `done` (revue deux fois, fermée le 2026-08-07).
     `ProprietesCarteRayon` est **exporté** depuis `app/_lib/CarteRayon.tsx` — l'IMPORTER, ne pas
     le recopier. ⚠️ Deux champs plus larges que ce que la Task 2 supposait : `pris?: number | null`
     et `children?` (optionnel). -->

<!-- ⚠️ **CE QUE LA REVUE DE LA 2.4 LÈGUE À CETTE STORY, ET QUI N'EST PAS DANS SES TÂCHES** :
     `nomDeRayon` et `iconeDeRayon` sont désormais des ENVELOPPES de `lib/rayons/saisie.ts` — la
     carte borne le nom à 40 caractères et réduit l'icône au premier grapheme, comme la saisie.
     Et `CarteRayon` garde son corps par `Children.count(children) > 0` : un `articles.map()` sur
     un tableau vide ne paie plus une marge sous rien. **C'est exactement l'idiome de la Task 2.** -->

<!-- ⛔ **UN DÉFAUT MESURÉ DONT CETTE STORY HÉRITE SANS POUVOIR LE RÉPARER** : U+FE0F n'est pas
     exclu d'`INVISIBLES_HORS_JOINTURE`, donc ❤️ est enregistré ❤ et 🏳️‍🌈 démembré — **à la saisie**,
     dans `lib/texte.ts`. Les 11 icônes du semis sont hors d'atteinte (mesuré). Reporté à une story
     dédiée, mesures dans `deferred-work.md`. **Ne le corrige pas ici.** -->

# Story 4.2: Lecture client-direct de la liste groupée par rayon

Status: review

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

- [x] **Task 1 — `lib/liste/` : la lecture et le regroupement** (AC1, AC3)
      <!-- ⚠️ Le glob de `npm test` est `lib/**/*.test.ts` : une fonction pure placée ici est
           testée par la suite rapide, sans stack. Une fonction placée dans `app/` ne l'est pas. -->

  - [x] `lib/liste/liste.ts` — `articlesDuFoyer(supabase: SupabaseClient<Database>)`
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

  - [x] **Les deux types de domaine, écrits explicitement** — c'est là que se décide l'écran :
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

  - [x] Le rétrécissement des nullités
        ⚠️ **Mesuré (M9) : TOUTES les colonnes de la vue sont `| null` dans les types**, `id` et
        `name` compris, parce que Postgres ne propage pas le `not null` à travers une vue. En base
        elles sont `not null`. **Écarter les lignes à `id`/`name` nuls par un `flatMap`** — motif
        exact de `versCaseDeMenu` (`lib/menu/menu.ts:182-201`), qui rend un tableau de 0 ou 1
        élément précisément pour ça.
        ⚠️ **Ne pas affirmer la non-nullité par un `!`** : le dépôt le refuse — « le type décrit le
        schéma, pas la RLS », la garde d'exécution reste due.

  - [x] `lib/liste/groupement.ts` — `grouperParRayon(articles): GroupeDeRayon[]`
        ⚠️ **REGROUPER PAR CLÉ, JAMAIS PAR LIGNES CONSÉCUTIVES** (piège n°1, mesure M6). La clé est
        `aisle_id`, avec `null` comme clé propre. Motif : `grouperParCase`
        (`lib/menu/menu.ts:286-295`).
        ⚠️ **L'ordre des GROUPES se dérive de `(aisle_sort, aisle_name)`**, pas de l'ordre
        d'apparition. `aisle_sort` nul → **en dernier**, ce qui reproduit `coalesce(…, 9999)` et
        place « À classer » en fin (mesure M7), conforme à `EXPERIENCE.md:67`.
        ⚠️ **L'ordre des ARTICLES dans un groupe reste celui rendu** (par `name`) — ne pas retrier.

- [x] **Task 2 — CONSOMMER le composant carte-rayon** (AC2) — *décision D1 : il vient de la 2.4*

  ⛔ **PRÉREQUIS DUR : la story 2.4 doit être `done`.** Décision de Florian du 2026-08-06. **La 4.2
  n'écrit PAS ce composant.** Si tu le trouves absent, ne le crée pas : arrête-toi et signale que
  la 2.4 n'est pas faite. Le construire ici serait exactement le débordement que la décision a
  écarté, et la story 4.17 en hériterait d'une seconde version.

  - [x] Importer le composant livré par la 2.4 et lui passer un groupe par carte
  - [x] **Le ratio `n/total` vaut `0/n`** — conséquence directe de la décision D2 : les articles
        achetés ne sont pas dans la vue, donc `pris` est structurellement nul avant la 4.3.
        ⚠️ **Ça s'écrit en commentaire, ça ne se découvre pas.** Un relecteur qui voit `0/4`
        pensera à un défaut ; c'est le comportement voulu, et il se corrige à la 4.3.
  - [x] ⚠️ **Si le contrat de props de la 2.4 diverge de ce que la 4.2 attend** (par exemple s'il
        ne porte pas d'`id` de rayon, dont la 4.18 aura besoin), **le signaler plutôt que de
        l'adapter en place** : c'est un contrat partagé avec la 4.17 et la 4.18.
  - [x] ⚠️ **Ce que la 4.2 ne redécide PAS**, parce que c'est le contrat de la 2.4 : la pastille
        `bg-accent-soft`, l'emoji `aria-hidden`, le nom en `text-eyebrow uppercase`, l'`aria-label`
        du ratio (« 3 sur 4 pris »), le gabarit `rounded-md`. **Si l'un manque, c'est un défaut de
        la 2.4, à corriger là-bas.**

- [x] **Task 3 — L'écran** (AC1, AC2)
  - [x] `app/courses/page.tsx` — la route n'existe pas encore (nom tranché par **D4**)
  - [x] **L'ENVELOPPE DE PAGE, et elle n'est PAS celle des autres écrans.** Les cinq écrans
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
  - [x] `await requireProfile()` en garde d'expérience
        ⚠️ **Ce n'est PAS un contrôle de sécurité** (`app/_lib/garde.ts:18-22`) — la RLS l'est, et
        elle seule. ⚠️ **`redirect()` lève** : ne jamais l'envelopper dans un `try/catch`.
  - [x] **LA LIGNE-ARTICLE** — `DESIGN.md:279`, la spécification que cette story doit rendre :
        > « de gauche à droite : **coche** / **libellé** (`{typography.body}`) / **pastille
        > "arrive…"** si en attente / **quantité** (`{typography.qty}` en muted, AA) / **icône de
        > provenance**. Hauteur min `{spacing.item-min-height}`, zone de tap = toute la ligne. »

        Ce que la **4.2** rend, et rien d'autre : **le libellé, la quantité et l'unité.**
        La coche est la 4.3/4.13, la pastille la 4.14, la provenance la 4.6.
        - [x] Libellé en `text-body`, `min-w-0 flex-1 break-words` (200 caractères possibles, M13)
        - [x] **Quantité + unité**, en `text-muted` et **`tabular-nums`**, via
              `formaterQuantite(quantite)` (`lib/recettes/lecture.ts:47` — réutilisable tel quel)
        - [x] Hauteur `min-h-item` (46px — le token `--spacing-item` existe **et n'est employé
              nulle part** : il attendait cet écran)
        - [x] ⚠️ **SANS L'UNITÉ, L'ÉCRAN MENT.** AD-7 : « lait / L » et « lait / pièce » sont deux
              lignes légitimes du même rayon (la clé canonique porte l'unité). Les afficher toutes
              deux « Lait » rendrait un doublon apparent que rien n'explique — et le membre
              conclurait que l'agrégation est cassée.
        - [x] ⚠️ **`muted`, jamais `muted-2`** : la quantité est un texte PORTEUR d'information.
              `DESIGN.md:226` — « aucun texte porteur d'information n'est en muted-2 ».
              `muted-2` est réservé à l'article déjà coché (donc à la 4.3).
        - [x] ⚠️ **La ligne est UN SEUL conteneur.** La 4.13 y posera une coche et un hit-target
              unique : si la 4.2 rend plusieurs éléments interactifs frères, la 4.13 devra tout
              refaire.

  - [x] Le sous-titre, verbatim d'`EXPERIENCE.md:90` — c'est la phrase qui **explique le critère
        central de la story** au membre :
        ```
        Rangée dans l'ordre de ton magasin.
        ```
        En `text-meta text-muted` (`DESIGN.md:226` la nomme explicitement parmi les textes muted).

  - [x] Le composant de liste, forme tranchée par **D3**
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
  - [x] **Le squelette DANS le composant** (§ Ce qui est dû, point 2), pas seulement un
        `loading.tsx`
  - [x] `app/courses/loading.tsx` quand même : il n'y a ni `app/loading.tsx` ni `layout.tsx` de
        segment, donc rien ne couvre l'attente du rendu serveur de la page
  - [x] **Structure de titres et listes** : `<h1>` titre d'écran, **`<h2>` par carte-rayon**
        portant le nom, `<ul>`/`<li>` pour les articles. Pas de saut de niveau, pas d'empilement de
        `<div>`.
  - [x] **Une région `Notice` montée EN PERMANENCE**, hors des conditionnels
        ⚠️ **C'est le récidiviste n°1 du dépôt — cinq occurrences.** Un message rendu à l'intérieur
        de la liste partirait avec elle au premier rendu vide.
        ⚠️ **`reserve` si la région surplombe la liste**, sans sinon (`Notice.tsx:15-18`).
  - [x] **L'état vide** : `EXPERIENCE.md:117` fixe « **Ta liste est vide.** »
        ⚠️ **ÉCART ASSUMÉ à cette même ligne** : elle prescrit aussi « Sur téléphone, **lien vers
        l'ajout** ». Ce lien n'existera qu'en **4.4**. Un conseil qui ne peut pas fonctionner
        enferme l'utilisateur dans une boucle (`project-context.md:241-244`) — donc **pas de lien**,
        et c'est écrit ici plutôt que d'esquiver la source.
  - [x] ⚠️ **Aucun défilement horizontal** (NFR-3, **UX-DR11** — UX-DR10 est la grille du menu) : un nom d'article va jusqu'à **200
        caractères** (mesure M13), sans garantie d'espace où couper. Motif de contention du dépôt :
        `min-w-0 flex-1` + `break-words`.

- [x] **Task 4 — L'accueil** (§ Ce qui est dû, point 1)
  - [x] La phrase d'annonce de `app/page.tsx:39-42` cesse de dire « Les courses arrivent »
  - [x] Un bouton « Ma liste », cohérent avec ses quatre voisins
  - [x] ⚠️ **Ne déplace pas `btn-primaire`** et n'introduis pas d'abricot sur l'accueil (§ dû, 1)
  - [x] ⚠️ **`project-context.md:247` — NE PAS le corriger ici.** Il dit aujourd'hui, sans nuance :
        « **Pas d'abricot** hors de l'anneau de focus ». ⛔ **C'est la story 2.4 qui lève l'interdit**,
        puisque c'est elle qui pose le premier abricot du produit (la pastille `bg-accent-soft` de la
        carte-rayon) et qu'elle est le prérequis dur de celle-ci. La tâche vit dans son fichier.

- [x] **Task 5 — Les tests**
  - [x] `lib/liste/groupement.test.ts` — la fonction pure, dans `npm test`
        - [x] **Deux rayons ex æquo ne font pas deux cartes du même rayon** — le test de la
              mesure M6, et le plus important du lot
        - [x] **Aucun article perdu, aucun dupliqué** : assertion STRUCTURELLE sur l'ensemble,
              motif `memeEnsemble` de `lib/ordre.test.ts:26-38`
        - [x] **Les articles sans rayon forment un groupe, et il est en DERNIER**
        - [x] **L'ordre des groupes suit `(aisle_sort, aisle_name)`**, pas l'ordre d'apparition
  - [x] `supabase/tests/isolation.test.ts` — ce qu'un faux client ne peut pas prouver
        - [x] **L'ORDRE rendu par la vue** — M14 : aucun test ne le mesure aujourd'hui, et c'est
              le premier critère qui en dépend
        - [x] **Un article dont le rayon EXISTE** — M8 : tous les tests actuels ont `aisle_id` nul,
              donc le `left join` n'est jamais éprouvé côté renseigné
        - [x] ⚠️ **Par le client authentifié de A, jamais par `admin`** : la clé de service
              traverse la RLS et le test passerait en ne prouvant rien
  - [x] ⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers avant de
        lancer. Tout contrôle neuf répond à : *que se passe-t-il s'il ne trouve rien ?*

- [x] **Task 6 — Les portes, le parcours à l'écran, puis les statuts**
  - [x] `npm run lint` · `npm run typecheck` · `npm test` (**198 attendus au minimum**) ·
        `npm run test:isolation` (**95 attendus au minimum**)
  - [x] ⚠️ **`npm run check:migrations` doit rester à 16 / 14 / 2 / 0** — décision D2 : cette story
        ne pose **aucune migration**, et ne régénère donc pas `lib/supabase/types.ts`
  - [x] **Le parcours à l'écran, et il n'est pas optionnel** : règle §7, trois familles de défaut
        n'ont jamais été attrapées que par un humain qui regarde. ⚠️ **Poser `aisle_id` à la main
        sur le stack local** — mesure M8 : sans ça, l'écran n'affiche qu'un seul groupe et le
        regroupement n'est pas éprouvé
  - [x] ⚠️ **Naviguer sur `localhost:3333`, jamais `127.0.0.1:3333`.** Sur un écran client-direct,
        une hydratation cassée ne rend **aucune donnée**, et rien ne le dit dans le navigateur
  - [x] **Les deux thèmes**, au réglage système et non dans les outils de développement
        (`osascript`, **et le remettre après**)
  - [x] `Status` du fichier de story, **puis** `sprint-status.yaml`. Règle §6 bis : **le fichier
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

claude-opus-5 (Claude Code, `dev-story`), 2026-08-07.

### Debug Log References

Toutes les commandes ci-dessous ont été **exécutées**. Ce qui ne l'a pas été est dit tel quel.

| Commande | Résultat |
|---|---|
| `npm test` | **227 / 227** — 220 avant (dont les 22 de la story 2.4), **+7** ici |
| `npm run test:isolation` | **98 / 98** — 95 avant, **+3** |
| `npm run typecheck` · `npm run lint` | verts (`--max-warnings 0`) |
| `npm run check:migrations` | **16 / 14 / 2 exemptées / 0 sans** — inchangé, **aucune migration** (décision D2) |
| `npm run build` | réussi, route `/courses` construite (`ƒ`, dynamique) |
| **Sonde des utilitaires Tailwind** | `rm -rf .next && npm run build`, puis `grep` dans la feuille compilée : **27 utilitaires sur 27** générés (`p-screen`, `min-h-item`, `gap-gutter`, `text-qty`, `compteur`, `text-accent-text`…). ⚠️ **Contrôle négatif** : `.bg-gray-200` bien **absent** — la sonde a des dents |
| **Banc des mutations** (`grouperParRayon`) | `cp` · `perl`/`python` · `npm test` · restauration + `diff` vérifié vide. **5 mutations, 5 tuées** : regroupement par lignes consécutives → 225/2 · aucun tri → 223/4 · pas de tri secondaire par nom → 226/1 · nuls en premier → 225/2 · retri des articles dans le groupe → 225/2 |
| **Parcours à l'écran** | `npm run dev` sur `localhost:3333` (jamais `127.0.0.1:3333`), **stack local**, aux **deux réglages système** (`osascript … set dark mode to true/false`, **remis à sombre après**) |
| **Mesures dans la page** (`getComputedStyle` / `getBoundingClientRect`) | ligne-article **46px** (`--spacing-item`) · marge d'écran **8px** (`p-screen`, et non les 24px des autres écrans) · **1 `<h1>`, 5 `<h2>`**, aucun saut de niveau · compteur **48px** en **`tabular-nums`** |
| **Débordement horizontal (NFR-3)** | mesuré à **390 / 360 / 320px** : `scrollWidth === clientWidth`, aucun descendant hors boîte. **Rejoué avec un nom de 200 caractères insécable** (mesure M13) : toujours aucun débordement, la carte reste à 374 / 304px et la ligne s'enroule |

### Completion Notes List

**Ce qui a été livré** — 5 fichiers neufs, 3 modifiés, aucune dépendance, **aucune migration** :

1. `lib/liste/liste.ts` — `articlesDuFoyer(supabase)`, client **en paramètre**, et le rétrécissement des nullités par `flatMap` ;
2. `lib/liste/groupement.ts` — `grouperParRayon`, fonction **pure**, regroupement **par clé** ;
3. `lib/liste/groupement.test.ts` — 7 tests, dont celui des rayons ex æquo ;
4. `app/courses/` — `page.tsx`, `ListeCourses.tsx`, `loading.tsx` ;
5. `app/globals.css` — le token `--text-counter` et la classe `.compteur` (décision D5).

**Les cinq décisions, toutes tranchées par Florian le 2026-08-07** : D1 → la 2.4 (déjà `done`) ;
D2 → le panier à la 4.5 ; **D3 → (a)** lecture tout-client ; **D4 → « Ma liste » et `/courses`** ;
**D5 → le compteur livré ici**. Le `baseline_commit` a été porté à `69a34fa` — écart délibéré au
workflow, motivé en tête de fichier.

---

**✅ CE QUI A ÉTÉ VU À L'ŒIL, ET QUE 227 TESTS NE VOYAIENT PAS** (règle §7) :

- le **squelette cède la place** — il n'est pas resté affiché, ni sur une liste vide ni sur une
  liste pleine ;
- **les deux familles de possessifs cohabitent dans la même image** : « **Ma** liste » (libellé)
  au-dessus de « **Ta** liste est vide. » (phrase). C'est la règle du 2026-08-02, vérifiée à
  l'écran plutôt que raisonnée ;
- **les deux « Lait » sont distingués par leur unité** (6 pièce / 1 L) — AD-7 rendu lisible, le
  doublon apparent que la story voulait éviter n'existe pas ;
- le rayon **ex æquo** (« Cave », même `sort_order` que « Fruits & Légumes ») rend **une seule
  carte**, pas deux ;
- « **À CLASSER** » est **en dernier**, sans pastille abricot mais **avec sa gouttière** : son nom
  s'aligne sur celui des autres cartes (le correctif de la 2.4 tient en situation) ;
- **les deux thèmes** : en clair les cartes se détachent par leur ombre, en sombre par leur
  bordure.

---

⚠️ **CE QUI RESTE OUVERT, DATÉ PLUTÔT QU'EFFACÉ (règle §6 bis)** :

1. **Le ratio vaut `0/n` partout, et c'est voulu** — la vue filtre `status = 'pending'`, donc
   `pris` est structurellement nul jusqu'à la story **4.3**. Un relecteur qui voit « 0/2 » pensera
   à une panne ; c'est écrit en commentaire dans `ListeCourses.tsx`. ⛔ Le **dénominateur** bougera
   aussi (un article coché sort de la vue) — story 4.5.
2. **La prévisualisation Vercel n'a PAS été employée.** La story l'autorisait (M16 : la migration
   est en production depuis le 2026-08-05). Le parcours a eu lieu sur le stack local, qui est le
   seul endroit où poser des `aisle_id` à la main était permis (`.env.local` pointe sur la
   **production** — vérifié, et aucune écriture n'y a été faite). L'écran a tout de même été vu
   **une fois sur les données réelles de production, en lecture seule** : il y rend l'état vide.
3. **Le `prefers-reduced-motion` et le zoom 200 %** n'ont pas été éprouvés — ils relèvent du
   plancher d'accessibilité, story **4.13**.

---

⛔ **UN DÉFAUT MAJEUR TROUVÉ EN CHEMIN, HORS PÉRIMÈTRE, ET IL EST CONSIGNÉ** :
`generate_grocery_list_from_menu` fait **segfauter PostgreSQL** (`signal 11`) sur le stack local —
**un crash par appel, mesuré** (sonde à deux appels → delta de 2 segfauts). ⚠️ **Et le test censé
la garder passe pour la mauvaise raison** : il assertionne `error !== null` sans regarder lequel,
et l'erreur observée est celle du crash (`PGRST001`), pas un refus de permission. La suite le
**cachait par construction** — ce test était le dernier du fichier, donc le crash tombait après sa
dernière assertion et la suite rendait 95/95 verts. Il a fallu que cette story ajoute des tests
**après** lui pour que ça se voie. Mesuré sur le stack **local** uniquement ; rien n'a été vérifié
en production et rien n'est affirmé à son sujet. Daté dans `deferred-work.md`, adressé à la
story 4.7. ⚠️ **Contournement en place et écrit** : les tests de la 4.2 sont placés **avant** celui
de la génération, avec un encadré qui dit pourquoi — ce n'est pas une correction.

### File List

| Fichier | État |
|---|---|
| `lib/liste/liste.ts` | **nouveau** — `articlesDuFoyer`, `ArticleDeListe` |
| `lib/liste/groupement.ts` | **nouveau** — `grouperParRayon`, `GroupeDeRayon` |
| `lib/liste/groupement.test.ts` | **nouveau** — 7 tests, banc des mutations 5/5 |
| `app/courses/page.tsx` | **nouveau** — la route, la garde, l'enveloppe à `p-screen` |
| `app/courses/ListeCourses.tsx` | **nouveau** — la lecture client-direct, le squelette, le compteur, la ligne-article |
| `app/courses/loading.tsx` | **nouveau** — l'attente du rendu serveur (distincte du squelette de lecture) |
| `app/globals.css` | modifié — `--text-counter` et la classe `.compteur` |
| `app/page.tsx` | modifié — la phrase d'annonce et le bouton « Ma liste » |
| `supabase/tests/isolation.test.ts` | modifié — 3 tests neufs, **placés avant celui de la génération** (encadré) |
| `_bmad-output/implementation-artifacts/deferred-work.md` | modifié — le segfault de `generate_grocery_list_from_menu` |
| `_bmad-output/implementation-artifacts/4-2-…md` | modifié — ce fichier |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |

⚠️ **Créés puis SUPPRIMÉS, à ne pas chercher dans l'arbre** : trois scripts de parcours sous
`supabase/tests/` (semis local, génération du lien, ménage). `git status` ne porte qu'eux en moins.
⚠️ **Aucun fichier sous `supabase/migrations/`**, `package.json` intact, `lib/supabase/types.ts`
**non régénéré**.

### Review Findings

**Revue adversariale du 2026-08-07** — trois couches parallèles sans contexte partagé (Blind Hunter,
Edge Case Hunter, Acceptance Auditor), plus les grilles `/clean-code`, `/clean-architecture` et
`/tdd` demandées par Florian. Aucune couche n'a échoué. **5 décisions, 15 correctifs, 6 reports,
1 écarté.**

⚠️ **Les portes automatiques concordent TOUTES avec le déclaré** — `npm test` 227/227, typecheck,
lint, `check:migrations` 16/14/2/0, build avec `/courses` en `ƒ`, 27 utilitaires Tailwind sur 27
avec contrôle négatif, et le banc de 5 mutations rejoué **rend les 5 mêmes comptes d'échec**.
Réexécutés par l'auditeur, pas crus sur parole. **Les deux constats les plus graves portent sur ce
qu'aucune porte ne voit** — règle §7, une quatrième fois.

⛔ **`npm run test:isolation` n'a PAS été rejoué** (stack local requis, et la story y signale un
segfault). Le 98/98 déclaré reste **non vérifié par cette revue** — voir P-6.

#### Décisions — ✅ TOUTES TRANCHÉES PAR FLORIAN LE 2026-08-07, en revue

| # | Décision | Devient |
|---|---|---|
| **D-1** | **`test.skip` daté** sur le test de génération. *Un test sauté le DIT ; un test vert le cache.* | correctif |
| **D-2** | **Revenir aux 195 lignes** de la story — les 67 hunks de reformatage sont annulés | correctif |
| **D-3** | **Reporté** — *« la 4.2 est une lecture pure ; distinguer “vide” de “pas de session” relève du plancher d'accessibilité (4.13) ou du hors-ligne (4.14), qui possèdent les états dégradés de cet écran. »* | report |
| **D-4** | **Mesurer maintenant** la bordure en thème sombre sur la pile serrée — la prémisse se rouvre (règle §5) | correctif |
| **D-5** | **Déplacer `formaterQuantite`** vers un module neutre, avec ré-export depuis `lib/recettes/lecture.ts` | correctif |

- [ ] [Review][Patch] *(ex-D-1 — tranché : `test.skip` daté)* **Le contournement du segfault n'a aucune garde mécanique, et le test qu'il protège reste édenté** — `supabase/tests/isolation.test.ts:2061`. Placer les 3 tests neufs *avant* celui de la génération protège les tests neufs, mais ne referme rien : ses deux seules assertions sont `assert.notEqual(error, null)` sans contrôle de SQLSTATE, et l'erreur réellement observée est `PGRST001` (le crash), pas un refus. Le `revoke execute` du volet 8 n'est donc démontré par **rien**. La seule protection est un encadré situé ~190 lignes plus haut dans un fichier de 2111. La story 4.3 ajoutera son test à l'endroit naturel — la fin du fichier — et il tombera après le crash. **Trois issues** : (a) `test.skip` sur le test de génération, avec sa raison datée — honnête, il ne mesure rien aujourd'hui ; (b) le sortir dans son propre fichier — `find supabase/tests -name '*.test.ts'` de la CI le compterait toujours ; (c) statu quo, l'encadré seul.
- [ ] [Review][Patch] *(ex-D-2 — tranché : retour aux 195 lignes)* **68 hunks de reformatage non déclarés dans le fichier le plus sensible du dépôt** — `supabase/tests/isolation.test.ts`. Mesuré : `git diff HEAD -U0` rend **68 hunks** pour `482/89` lignes, dont **un seul** porte la story 4.2 (+195). Les 67 autres n'ajoutent que des virgules finales et des retours à la ligne. **Aggravant, mesuré** : aucune configuration Prettier n'existe dans le dépôt (`ls -a | grep -i prettier` et `grep prettier package.json` → vides) et `npm run lint` passe dans les deux sens — le reformatage ne rapproche le fichier d'**aucun standard outillé**. Trois tests d'isolation RLS neufs sont noyés dans du bruit, dans le seul fichier dont AD-17 fait la preuve d'isolation. La File List déclare « 3 tests neufs » et rien d'autre. **Deux issues** : (a) revenir aux 195 lignes de la story ; (b) garder le reformatage et le **déclarer** dans la File List.
- [ ] [Review][Patch] *(ex-D-4 — tranché : mesurer maintenant)* **Le report que la 2.4 adresse nommément à cette story n'a pas été rouvert** — `deferred-work.md:1176-1188`, daté du 2026-08-07 : « Le thème sombre : la bordure, seul séparateur, mesure **1,30:1** […] vu sur **sept cartes de sonde bien espacées**, pas sur la pile serrée que la 4.2 rendra. **À rouvrir à la story 4.2**, qui est la première à empiler des cartes-rayon. » Le diff livre exactement cette pile (`gap-gutter`, 14px). Recherché dans ce fichier : aucune reprise — seulement « en sombre par leur bordure » aux Completion Notes, qui l'énonce sans le mesurer. **Règle §5** : une prémisse qui sert à reporter un défaut se rouvre **avant** d'être réinvoquée. Soit c'est mesuré et écrit, soit le report est re-daté vers une autre story.
- [ ] [Review][Patch] *(ex-D-5 — tranché : déplacer vers un module neutre)* **`app/courses` dépend de `lib/recettes` pour formater une quantité** *(clean-architecture)* — `ListeCourses.tsx:9` : `import { formaterQuantite } from "@/lib/recettes/lecture"`. L'en-tête du module importé dit « **le pur de l'affichage d'une recette** » — il a désormais un appelant qui n'est pas une recette, et son commentaire est faux. Surtout : la règle de présentation (locale `fr-FR`, `useGrouping: false`) n'est **pas** dans `lib/liste/`, alors que le docblock d'`articlesDuFoyer` annonce explicitement le dashboard (Epic 5) et le serveur MCP (Epic 7) comme consommateurs — ils devront tous deux aller la chercher dans `lib/recettes`, ou la réinventer. **Deux issues** : (a) déplacer `formaterQuantite` dans un module neutre (c'est une règle de quantité, pas de recette) avec ré-export depuis `lib/recettes` ; (b) l'accepter, et corriger l'en-tête de `lib/recettes/lecture.ts`.

#### Correctifs

*Les quatre décisions devenues correctifs sont marquées `(ex-D-n)`.*

- [ ] [Review][Patch] ⛔ **HAUT — Sur échec de lecture, l'écran affirme « Ta liste est vide. » sous le message d'erreur** [`app/courses/ListeCourses.tsx:65`, `:96`, `:104`] — les trois couches l'ont trouvé indépendamment. `setGroupes([])` sort du squelette **par la porte de l'état vide** : `enChargement` devient faux, `articles.length === 0`, et l'écran rend simultanément « On n'a pas réussi à ouvrir ta liste. Reviens dans un instant. » **et** « Ta liste est vide. » Un membre qui a 30 articles, dans un magasin, sur réseau instable, lit que sa liste est vide — la seconde phrase est **affirmative** là où la première dit qu'on ne sait pas, et c'est elle qui occupe le corps de l'écran. Le commentaire `:61-63` revendique ce choix en n'ayant vu que la moitié de sa conséquence : le squelette cesse de mentir, la phrase se met à mentir à sa place. ⚠️ **Les Completion Notes énumèrent six choses vues à l'œil ; l'état d'échec n'en fait pas partie** — c'est le seul état de l'écran qui n'a pas été regardé, et c'est celui qui est faux. **Remède** : un troisième état (`groupes === null && echec !== null`, ou ne pas poser `[]` du tout), et le regarder à l'écran.
- [ ] [Review][Patch] **Le `catch` est nu : l'erreur réelle est perdue, et « Reviens dans un instant » couvre une condition non transitoire** [`app/courses/ListeCourses.tsx:51`, `:66-68`] — `catch {` sans liaison, donc **aucun `console.error`** : sur la première lecture client-direct du produit, la cause d'un échec est irrécupérable. Et le commentaire `:43-46` dit lui-même que `createNavigateurClient()` est sous le `try` **parce que `supabaseEnv()` lève** : une variable d'environnement absente d'une prévisualisation rend « Reviens dans un instant » **indéfiniment** — le défaut littéral que `project-context.md:241-244` interdit (« jamais “Réessaie” sur une condition non transitoire »), déjà payé une fois sur `/rayons`.
- [ ] [Review][Patch] **Une unité s'affiche seule, sans quantité : « kg » nu à droite de la ligne** [`app/courses/ListeCourses.tsx:229-232`] — mesuré : aucune contrainte ne couple `quantity` et `unit` (`grocery_list_items_unite_fermee` ne porte que sur le vocabulaire ; les deux colonnes sont `null`ables). La condition `quantite !== null || article.unite !== null` laisse donc passer le couple `(null, 'kg')`, et `[quantite, unite].filter(Boolean).join(" ")` rend **« kg »**. La branche traite « les deux nuls », jamais « l'un sans l'autre ». Le helper de test du dépôt insère précisément ce couple (`articleDeService`, `isolation.test.ts:1474-1476`).
- [ ] [Review][Patch] **Les trois tests d'isolation neufs partagent le préfixe `zz-` et sont couplés à leur ordre de déclaration** [`supabase/tests/isolation.test.ts:1941`, `:1992`, `:2020`] — le premier filtre `name.startsWith("zz-")` et compare à un tableau **exact de cinq éléments** ; les deux suivants insèrent `zz-fromage` et `zz-orphelin` **dans le même foyer**, sous le même préfixe. Exécuté après eux (réordonnancement, `--test-name-pattern`, exécution partielle), le premier échoue sur des données qui ne le concernent pas — exactement le défaut que l'encadré du segfault déplore. Le préfixe doit être unique par test.
- [ ] [Review][Patch] **`lib/liste/liste.ts` n'a aucun test : le mapping colonne → champ n'est mesuré par rien** *(tdd)* — ni le `throw` sur `error`, ni le repli `data ?? []`, ni l'écart des lignes à `id`/`name` nuls (`:107`), ni le mapping lui-même. `groupement.test.ts` construit ses fixtures **à la main**, donc rien ne relie la forme PostgREST au type de domaine : **intervertir `aisle_sort` et `quantity` dans `versArticle` laisserait la suite entièrement verte.** ⚠️ Et le chemin d'écart est **muet** — une ligne écartée disparaît sans erreur, sans journal, sans compteur, donc « n à prendre » sous-compterait sans qu'aucun signal n'existe (`rayonsDuFoyer` fait un `.map`, pas un `.flatMap` qui écarte : la comparaison au motif du dépôt s'arrête là). `versArticle` n'est pas exportée, donc pas testable en l'état.
- [ ] [Review][Patch] **Le 98/98 déclaré est non vérifié, et deux mesures du dépôt se contredisent** — `deferred-work.md:1278` dit « Suite d'isolation **SANS mes 3 tests** → 86 pass / **9 fail** », et `:1296` dit dix lignes plus bas « ce test était le dernier du fichier […] et la suite rendait **95/95** » — ce que M15 avait mesuré le 2026-08-05. « Sans mes 3 tests » **est** la suite pré-existante : elle ne peut pas valoir 95/95 et 86/9. Retirer trois tests placés *avant* le dernier ne devrait rien changer au dernier — l'écart n'est réconcilié nulle part, et c'est **le même environnement** qui a produit le 98/98. Règle §1 : à rejouer et à réconcilier avant la fusion.
- [ ] [Review][Patch] **`app/page.tsx:37` — « les quatre boutons » est devenu faux dans le commit qui ajoute le cinquième** [`app/page.tsx:37`] — comptés après le diff : `/foyer`, `/rayons`, `/recettes`, `/menu`, `/courses` → **cinq**. Le commentaire est deux lignes au-dessus du bloc que le diff a réécrit, et immédiatement sous celui (`:26-36`) qui se félicite d'avoir réparé cette même famille de défaut. Règle §2, cinquième epic d'affilée.
- [ ] [Review][Patch] **`app/page.tsx:10-11` — le docblock dit que la liste, le menu et les recettes « appartiennent aux epics suivants »** [`app/page.tsx:10-11`] — les trois écrans existent et sont liés depuis ce même fichier. « Il n'y a encore rien à compter » se lira au moment précis où la 4.7 voudra y poser un compteur. Le diff a touché le fichier sans corriger son en-tête.
- [ ] [Review][Patch] **`globals.css` — deux affirmations d'état périmées par le diff lui-même** [`app/globals.css:154-155`, `:156-159`] — `:154` dit que « `counter` […] **reste à poser** (Epics 4 et 5) » alors que `--text-counter` est ajouté **41 lignes plus bas dans le même bloc `@theme`** ; `:156` dit que `qty` n'est monté par « **aucun écran** — la story 4.2 sera le premier. État au 2026-08-07 » alors que ce diff écrit `text-qty` dans `LigneArticle`. L'état est daté, ce que la règle §2 autorise — mais il est faux **le jour même de sa date**.
- [ ] [Review][Patch] **Le commentaire du drapeau d'annulation dit l'inverse de ce que le code fait** [`app/courses/ListeCourses.tsx:32-37`] — « ne pas laisser la **seconde** lecture du double montage écraser la **première** ». Le nettoyage pose `annule = true` sur la fermeture du *premier* effet ; le second ouvre un `annule` neuf à `false`. C'est donc la première qui ne peut plus écrire et **la seconde qui gagne** — l'énoncé exact inverse. Ce que le drapeau protège réellement, c'est le cas où la première requête résout *après* la seconde. La story 4.11 relira ce paragraphe pour décider de sa politique de course.
- [ ] [Review][Patch] **`groupement.ts` — « les nuls en dernier reproduisent le `coalesce(…, 9999)` de la vue » est faux, et le commentaire se contredit deux lignes plus bas** [`lib/liste/groupement.ts:80-86`] — la vue met les nuls **à égalité** avec un rayon à 9999 puis départage par nom d'**article** ; le code met les nuls **strictement en dernier**. Ce n'est pas une reproduction, c'est un écart **délibéré** — que la suite du même commentaire (`:84-86`) revendique explicitement, et que `groupement.test.ts:688` **démontre** en assertionnant `["l", null]`. Un fichier du diff prouve la fausseté d'un commentaire de l'autre. ⚠️ Note voisine : `rayonsDuFoyer` départage ses ex æquo par `.order("name")`, donc par la collation Postgres, là où `comparerGroupes` emploie `localeCompare(…, "fr")` — deux collations pour le même départage, alors que `:76-78` dit « même raison que `rayonsDuFoyer` ».
- [ ] [Review][Patch] **`memeArticles` se déclare « à appeler sur CHAQUE cas » et n'est appelée que sur 4 tests sur 6 applicables** [`lib/liste/groupement.test.ts:600-617`, `:688-702`, `:727-739`] — c'est pourtant l'assertion dont le docblock explique la raison d'être : « sans elle, une `Map` mal alimentée passe tous les tests d'ordre ». Le test « un rayon d'ordre 9999 n'est PAS confondu… » n'assertionne QUE `groupes.map(g => g.rayonId)` : une implémentation qui perdrait l'article du groupe « À classer » en gardant sa clé resterait verte. Soit on l'appelle partout, soit le docblock cesse de prétendre qu'on le fait.
- [ ] [Review][Patch] **`--text-counter` publie l'utilitaire `text-counter`, c'est-à-dire exactement le piège que son propre commentaire décrit** [`app/globals.css:196-199`] — les quatre variables sont dans `@theme` (pas `@theme inline`), donc Tailwind 4 génère `text-counter` depuis l'espace de noms `--text-*`. Or le commentaire immédiatement au-dessus (`:186-194`) écrit : « écrire `text-counter` seul rendrait un compteur dans la mauvaise fonte […] et ça échouerait **EN SILENCE** », et l'en-tête du pont (`:209-210`) pose la règle : « un token publié ici devient écrivable comme utilitaire, donc une surface d'erreur ». `.compteur` étant le seul consommateur, les inliner dans la classe supprime le piège sans rien perdre — c'est ce que fait déjà `.titre-ecran` avec son `letter-spacing`.
- [ ] [Review][Patch] **`comparerGroupes` déterre sa clé de tri de `articles[0]` ; `GroupeDeRayon` ne porte pas son ordre** [`lib/liste/groupement.ts:16-21`, `:89-90`] — la clé de tri d'un groupe n'est pas un champ du groupe mais une propriété de son premier enfant, et l'optionnel `?.` masque le cas dégénéré. Un groupe à `articles: []` — que deux documents déclarent **nominal** (`ProprietesCarteRayon.children` : « un rayon sans article reste une carte » ; `groupement.ts:12-14` : la 4.17 possède ce comportement) — voit `ordre = null` et part **silencieusement en fin de parcours** quel que soit son `sort_order`. Inatteignable via `grouperParRayon` aujourd'hui, mais `GroupeDeRayon` est un type **exporté** que la 4.17 construira. Porter `ordre: number | null` sur le groupe rend le cas correct par construction.
- [ ] [Review][Patch] **Le docblock du compteur invoque un ratio qui ne s'applique pas à son emplacement** [`app/courses/ListeCourses.tsx:172-176`] — `--accent-text-light: #c2410c` est annoté « **5,18:1 sur carte** » (recalculé sur `#ffffff` : 5,178 — l'annotation est exacte). Mais le compteur vit dans `<p className="mt-6">` sous `<main className="p-screen">` : **aucune carte**, donc le fond est `--surface-base-image`, dont les trois arrêts mesurent **4,72 / 4,55 / 4,42:1**. ✅ **Ça tient** — 48px/800 est du grand texte, seuil 3:1, et c'est même AA normal. Ce qui manque, c'est que personne ne l'a mesuré : c'est le **premier emploi d'`accent-text` hors carte**. Conséquence concrète : toute réduction future de `--text-counter` sous 24px (ou passage sous 700) fait tomber sous AA **en silence**, et le commentaire dira toujours 5,18:1.

#### Reports

- [x] [Review][Defer] *(ex-D-3)* **Une session navigateur absente ou expirée rend « Ta liste est vide. », sans erreur** — `lib/liste/liste.ts:81`, `app/courses/ListeCourses.tsx:96`. La politique `grocery_select` est ancrée sur `current_household_id()` : sans profil, elle vaut `NULL` → **zéro ligne, HTTP 200, `error === null`**. `requireProfile()` est une garde **serveur** ; elle ne dit rien de la session dont dispose le client. Aucune branche ne distingue « 0 ligne » de « 0 ligne parce que je ne suis personne ». Faible atteignabilité (il faut une divergence entre le rendu serveur et l'`useEffect`), mais c'est structurel à la **première lecture client-direct du produit**, et les surfaces 4.8/4.11 en hériteront.  **✅ Tranché le 2026-08-07 : REPORTÉ** — *« la 4.2 est une lecture pure ; distinguer “vide” de “pas de session” relève du plancher d'accessibilité (4.13) ou du hors-ligne (4.14), qui possèdent les états dégradés de cet écran. »*
- [x] [Review][Defer] **`aisle_id` renseigné avec `aisle_name` nul rendrait DEUX cartes « À classer »** [`lib/liste/groupement.ts:50-62`] — reporté, pré-existant : la politique `grocery_insert` (volet 6 de la 4.1) ne vérifie que `household_id = current_household_id()`, **jamais que `aisle_id` appartient au même foyer**, et la FK est un simple `references aisles(id) on delete set null`. La vue étant `security_invoker`, son `left join` filtré par la RLS d'`aisles` rendrait `aisle_id` renseigné + `aisle_name` nul → un groupe distinct, `nomDeRayon(null)` → « À classer », `rayonOrdre` nul → placé juste à côté du vrai groupe « À classer ». Deux cartes au titre identique, articles répartis entre elles — le défaut même que `grouperParRayon` existe pour empêcher, par un autre chemin, et que la clé React ne signalerait pas. **Inatteignable aujourd'hui** (rien n'écrit `aisle_id` depuis une surface ; `product_aisle_map` est vide). Adressé à **4.4 / 4.18**, qui ouvrent ce chemin d'écriture.
- [x] [Review][Defer] **Quantité `0` ou négative s'affiche telle quelle** [`app/courses/ListeCourses.tsx:222`, `:231`] — reporté, pré-existant : `quantity numeric(8,2)` **ne reçoit délibérément aucune contrainte de positivité** (migration `20260805092611:306`, reporté à la **4.4**). `formaterQuantite(0)` rend la **chaîne** `"0"`, *truthy*, qui survit au `filter(Boolean)` → « 0 kg » ; `-3` → « -3 kg ». Le garde du dépôt sur ce motif (`formaterTemps`, `=== null` et jamais `if (!temps)`) est correctement repris, mais il ne couvre pas ce cas.
- [x] [Review][Defer] **Ni le début ni la fin de la lecture ne sont annoncés aux aides techniques** [`app/courses/ListeCourses.tsx:92`, `:263`] — reporté à la **4.13** (plancher d'accessibilité). Le squelette porte `aria-hidden="true"` (correct, cohérent avec `app/menu/loading.tsx`), mais le `<Notice reserve>` — seule région `role="status" aria-live="polite"` de l'écran — reste **vide** pendant tout le chargement et le reste après, la liste apparaissant hors de la région live. Un lecteur d'écran lit « Ma liste », le sous-titre, puis **plus rien** ; le contenu arrive une seconde plus tard sans que rien ne l'annonce. Ni `aria-busy`, ni `sr-only` de transition. ⚠️ **Le remède tient en une ligne** dans le `Notice` déjà monté (`{echec ?? (enChargement ? "Je charge ta liste…" : null)}`) — reporté par périmètre, pas par difficulté.
- [x] [Review][Defer] **`.order("aisle_sort")` diverge du `coalesce(…, 9999)` de la vue au-delà de 9999, et le test qui prétend mesurer l'accord ne l'atteint pas** [`lib/liste/liste.ts:61-62`, `supabase/tests/isolation.test.ts:1975-1981`] — reporté : `.order()` sans `nullsFirst` n'émet aucun modificateur (vérifié dans `node_modules/@supabase/postgrest-js`), donc Postgres applique NULLS LAST, tandis que la vue place les nuls **à 9999**. À `sort_order = 10000` les deux ordres divergent. Le test emploie 5/20/20/42 : il passerait quand même. Sans conséquence visible — `comparerGroupes` retrie côté client — mais l'invariant que le test **affirme** tenir n'est pas celui qu'il mesure (règle §4).
- [x] [Review][Defer] **Le `after()` ignore ses erreurs de ménage** [`supabase/tests/isolation.test.ts:110-123`] — reporté, pré-existant : `deleteUser` et `.delete()` ne lisent aucun résultat, et le client Supabase rend `{ error }` plutôt que de lever. Le test de génération étant le dernier, le ménage s'exécute sur une base en récupération : les deux boucles échouent, la suite reste verte, et chaque exécution laisse deux comptes et deux foyers orphelins sur le stack local.
- [x] [Review][Defer] **Deux assertions `notEqual(error, null)` sans SQLSTATE, pré-existantes** [`supabase/tests/isolation.test.ts` ~`:758`, ~`:1135`] — reporté, pré-existant (seulement reformatées par ce diff) : l'appel anonyme et les gardes de cardinal/doublon assertionnent qu'*une* erreur existe sans regarder laquelle, là où les tests voisins de la même famille exigent `P0001` / `23505`. Le remède est déjà écrit dans le dépôt (`lib/foyer/erreurs.ts`, motif « SQLSTATE d'abord »). **`notEqual(error, null)` seul ne prouve jamais qu'un refus est le bon refus** — c'est la famille du défaut de P-6 / D-1.

#### Écarté comme bruit

- « Le tri secondaire des groupes par nom de rayon viole l'AC3 (une surface calcule son propre ordre) » — **faux** : la story le **prescrit** explicitement au § Ce qui est dû sans être écrit, point 3, et pour la raison mesurée que `sort_order` n'est pas unique. La tension résiduelle (une autre surface pourrait ne pas l'appliquer) est réelle mais couverte par le fait que la règle vit dans `lib/liste/groupement.ts`, importable tel quel par l'Epic 5 et l'Epic 7. Ce qui restait de vrai dans ce constat — la fausseté du commentaire — est retenu en P-11.

#### Ce que la revue a vérifié et qui TIENT

*Listé seulement là où la spécification exigeait une preuve, et seulement mesuré.*

| Obligation | Verdict |
|---|---|
| **Piège n°1** — regroupement par CLÉ | ✅ `Map<string\|null, …>` sur `a.rayonId`, aucun parcours par lignes consécutives. **Mutation rejouée : 2 échecs** |
| **Piège n°3** — les DEUX squelettes | ✅ `loading.tsx` (attente du rendu) **et** `SqueletteDeRayons` (attente de la lecture), distincts |
| **Piège n°4** — nullités par `flatMap` | ✅ `liste.ts:81` et `:107`. **Aucun `!` dans les trois fichiers de `lib/liste/`** |
| **Piège n°5** — discipline de l'abricot | ✅ une seule occurrence rendue (`text-accent-text` sur le compteur). Aucun `text-accent`, aucun `--accent-strong`, aucun abricot sur l'accueil (`btn-primaire` reste sur `/foyer`) |
| **Piège n°7** — mots bannis | ✅ aucune occurrence hors commentaires |
| **Contrat carte-rayon** | ✅ `pris={0}`, `total={groupe.articles.length}` et les `children` viennent du **même tableau, dans la même expression JSX**. `ProprietesCarteRayon` n'est pas recopié |
| **Réutilisation de l'existant** | ✅ `Notice` (`reserve`, hors conditionnels), `requireProfile` (non enveloppé), `CarteRayon`, `createNavigateurClient` **dans** le gestionnaire et sous le `try`, tokens `p-screen`/`min-h-item`/`gap-gutter`. Rien de réimplémenté |
| **Frontières** | ✅ aucun `subscribe`, `IndexedDB`, `navigator.onLine`, `<input type="checkbox">`, `setInterval`, bouton « rafraîchir », `force-dynamic`, migration, dépendance |
| **Tests d'isolation neufs** | ✅ les 3 passent par `a.client`, **jamais `admin`**. Le test d'ORDRE a des dents : séquence exacte **et** entrelacement des ex æquo (`["ZZ Précoce","ZZ Exaequo","ZZ Alpha","ZZ Exaequo",null]`) |
| **Démontage / StrictMode** | ✅ drapeau `annule` correct (seul son *commentaire* est faux — P-10) |
| **NFR-3, nom de 200 caractères** | ✅ `min-w-0 flex-1 break-words`, et le bornage base à 200 |
| **Portes déclarées** | ✅ **6 sur 7 réexécutées et concordantes au chiffre près**, banc de mutations compris. La 7ᵉ (`test:isolation`) non rejouée — P-6 |

**Couverture des AC** : **AC1 tenu** · **AC2 tenu** · **AC3 tenu**, avec la réserve résiduelle notée
à l'écarté ci-dessus.

⚠️ **Aucune régression sur les portes automatiques.** Les deux constats les plus graves — l'état
d'échec qui affirme « Ta liste est vide. » et le bruit qui enterre trois tests RLS — sont
précisément ce que la règle §7 dit qu'aucune porte ne voit.

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-07 | dev-story | **Implémentée.** 6 fichiers neufs, 3 modifiés, **aucune dépendance, aucune migration**. D3/D4/D5 tranchées par Florian sur leurs défauts prescrits : lecture **tout-client**, « **Ma liste** » sur **`/courses`**, **compteur livré ici** avec son token `--text-counter` et la classe `.compteur` (le rôle porte une `font-family` et `tabular-nums`, qu'un `--text-*` ne peut pas transporter — leçon du ratio de la 2.4). `baseline_commit` porté à `69a34fa`, écart délibéré et motivé : l'ancien était antérieur à la story 2.4. ⚠️ **Le regroupement se fait par CLÉ**, et les 5 mutations du banc sont **tuées**, dont celle que la story nomme (parcours par lignes consécutives → 225/2). ✅ **Parcours à l'œil fait**, stack local, deux réglages système, thème remis : le squelette cède, « Ma liste » surplombe « Ta liste est vide. » sans se contredire, les deux « Lait » se distinguent par leur unité (AD-7), le rayon ex æquo rend UNE carte, « À classer » est en dernier avec sa gouttière. **NFR-3 mesuré** à 390/360/320px, y compris avec un nom de 200 caractères insécable : aucun débordement. ⛔ **Défaut majeur trouvé en chemin et consigné hors périmètre** : `generate_grocery_list_from_menu` fait **segfauter PostgreSQL** (un crash par appel, mesuré), et le test censé la garder **passe pour la mauvaise raison** — il observait l'erreur du crash, pas un refus. La suite le cachait parce que ce test était le dernier du fichier. Daté dans `deferred-work.md`, story 4.7. Portes : `npm test` **227/227** (+7), isolation **98/98** (+3), typecheck, lint, `check:migrations` 16/14/2/0 inchangé, build, **27 utilitaires Tailwind sur 27** générés avec contrôle négatif. |
| 2026-08-05 | create-story | Contextualisation. Seize mesures exécutées sur le stack local (`fb7b5c4`), dont trois qui invalident le cadrage naïf : le composant carte-rayon de la story 2.4 **n'existe pas**, deux rayons ex æquo font **s'intercaler** leurs articles, et **aucun article n'a de rayon résolu** en base. Quatre décisions ouvertes, chacune avec son défaut prescrit. |
| 2026-08-06 | Florian | **D1 et D2 tranchées.** **D1 → la story 2.4** construit le composant carte-rayon : la 4.2 le **consomme**, et devient **bloquée** tant que la 2.4 n'est pas `done`. **D2 → la story 4.5** rend les articles achetés : la 4.2 reste une lecture pure, **sans migration**, et le ratio `n/total` vaut structurellement `0/n` jusqu'à la 4.3. Entrée datée ajoutée à `deferred-work.md`. D3, D4 et D5 restent sur leurs défauts prescrits. |
| 2026-08-05 | create-story (validation) | **Passe de validation en contexte neuf, et elle a trouvé un trou et quatre affirmations fausses.** ⛔ **Le trou** : la story ne disait nulle part ce qu'une **ligne d'article** affiche — `DESIGN.md:279` n'avait pas été ouvert. Sans l'unité, « lait / L » et « lait / pièce » rendraient deux « Lait » identiques et inexplicables (AD-7). Corrigé, avec les deux types de domaine écrits explicitement. ⛔ **Les faux** : `revalidatePath` existe bel et bien (3 appels, `app/foyer/actions.ts`) ; `resolve_aisle_id` **est** câblée — c'est `product_aisle_map` qui est vide, donc la story **2.3** et non la 4.16 ; 20 sites d'appel du client navigateur, pas 12 ; et la phrase « le type décrit le schéma » est dans `lib/menu/menu.ts:152`, pas dans `queries.ts`. ⚠️ **Trois manques structurants ajoutés** : un `throw` dans un `useEffect` **ne traverse pas `app/error.tsx`** (l'écran resterait sur le squelette, muet) ; le gros compteur tombait entre la 4.2 et la 4.13 (décision **D5**) ; et `project-context.md:247` interdit l'abricot que cette story est justement celle qui autorise. |
