---
baseline_commit: 1eb9669
---

<!-- Contextualisée le 2026-08-20, sur `1eb9669` — la tête de `main`. Les stories 4.1 à 4.6 sont
     `done`, fusionnées et déployées. Les onze mesures ci-dessous ont été EXÉCUTÉES sur le stack
     local, pas déduites. -->

<!-- ⛔ **LE SEGFAUT NE SE REPRODUIT PLUS. C'EST LA PREMIÈRE CHOSE À SAVOIR, ET ELLE CHANGE LA
     FORME DE LA STORY.** `deferred-work.md` décrit `generate_grocery_list_from_menu` comme faisant
     tomber PostgreSQL — « un crash par appel, déterministe », mesuré le 2026-08-07. **Mesuré à
     nouveau le 2026-08-20 : la fonction rend son compte sans erreur, et le journal du conteneur ne
     porte aucune trace de `signal 11`.** Éprouvé deux fois : sur 1 ingrédient, puis sur **201**
     avec les coûts de parallélisme abaissés pour forcer un plan large.
     ⚠️ **La cause de la disparition n'est PAS établie, et je ne l'invente pas.** Le fait
     circonstanciel : l'image du conteneur porte un numéro de build Supabase
     (`postgres:17.6.1.111`) et a été retirée plusieurs fois depuis. La version majeure, elle, est
     **identique** aux deux mesures (17.6). **Cette story ne doit donc PAS partir en croyant
     diagnostiquer un crash** — elle doit re-dater le constat, et surtout resserrer le test qui
     l'observait. -->

<!-- ⛔ **CE QUI, EN REVANCHE, EST TOUJOURS VRAI ET MESURÉ AUJOURD'HUI — les trois défauts réels :**
     1. **Le DELETE dur détruit les ajouts du membre.** Mesuré : 2 articles avant génération
        (« Oignons » + « Ajout manuel du membre »), **1 après**. Et l'article détruit ne laisse
        **aucun tombstone** — 0 ligne portant ce nom. Il est physiquement perdu.
     2. **`23505` sur un acheté survivant.** Le `delete … where status = 'pending'` épargne les
        `bought`, qui occupent la clé canonique ; l'INSERT nu la heurte. Reproduit.
     3. **`23505` sur un `group by` trop fin.** Deux ingrédients de même nom et même unité mais de
        `product_id` différents sortent en deux lignes de **même clé canonique**. Reproduit. -->

<!-- ✅ **CE QUI EXISTE DÉJÀ ET RÉSOUT LA MOITIÉ DU PROBLÈME** : `ajouter_article` (4.4, 4.5, 4.6)
     fait déjà l'UPSERT-incrémente sur la clé canonique, rouvre un tombstone, ramène un acheté à
     `pending`, repart de la bonne quantité, résout le rayon et **estampille la provenance**. La
     génération n'a pas à réinventer tout ça — voir D1. -->

# Story 4.7: Générer la liste depuis le menu, sans rien écraser

Status: review

## Story

As a **membre planifiant la semaine**,
I want **générer la liste complète depuis le menu en une action**,
so that **le dimanche soir dure quatre minutes — sans perdre mes ajouts manuels ni mes achats**.

## Acceptance Criteria

**AC1 — La génération agrège, met à l'échelle et UPSERT-incrémente**

**Given** un menu de semaine assigné (Epic 3)
**When** la génération s'exécute
**Then** elle agrège les ingrédients non optionnels de toutes les recettes planifiées, met à
l'échelle selon les personnes prévues rapportées aux portions, résout les rayons et
**UPSERT-incrémente sur la clé canonique** (AD-6/FR-16)

**AC2 — Elle n'écrase jamais, et elle rend compte**

**Given** des articles ajoutés à la main ou déjà achetés dans la liste
**When** la génération s'exécute
**Then** elle ne les **écrase jamais** (corrige le DELETE destructeur actuel) et **annonce combien
d'articles ont été ajoutés** (FR-17)

**AC3 — La génération ne ressuscite JAMAIS un article retiré** ⛔ *réécrit le 2026-08-22*

**Given** un article précédemment supprimé (tombstoné) que la génération réclame
**When** la génération s'exécute
**Then** il **reste supprimé, et n'est pas compté** — seul un geste **humain** (retaper le nom) le
rouvre

> ⛔ **CE CRITÈRE A CHANGÉ EN REVUE, ET C'EST UNE DÉCISION DE FLORIAN.** Il demandait auparavant un
> LWW sur `deleted_at` — « ressuscité que si l'intention de génération est plus récente ». Le code
> le faisait **correctement**. Mais mesuré par la porte du produit : tous les chemins de suppression
> posent `deleted_at = now()` et la génération prend son intention **plus tard**, donc la condition
> était **toujours vraie** et l'article revenait toujours. La garde ne se déclenchait que sur un
> tombstone daté dans le FUTUR, que seul un test fabrique.
>
> ⚠️ **Le LWW arbitre des écritures CONCURRENTES entre appareils.** Ici il n'y a pas de concurrence :
> la génération est postérieure par construction. L'appliquer donnait à la machine une victoire
> garantie sur une décision humaine — ce qui n'est pas ce à quoi il sert. La **motivation de D2**
> (« la génération de dimanche retirait au membre sa décision ») fait donc foi contre la **lettre**
> de l'ancien AC3.
>
> ⚠️ **Contrepartie assumée** : un article retiré par erreur ne reviendra plus tout seul. Le membre
> le retape, et c'est un geste d'une seconde.

---

## Décisions ouvertes — chacune avec son défaut prescrit

> Le dev agent applique le **défaut prescrit** si Florian n'a pas tranché.

> ✅ **D1 ET D2 TRANCHÉES PAR FLORIAN LE 2026-08-20, AVANT DÉMARRAGE — leur défaut prescrit.**
> Elles coïncident avec le défaut, mais elles sont **choisies**, pas subies. **Conséquences à ne pas
> rater** : la génération passe en `security invoker` (une `definer` qui appelle une `invoker`
> contournerait la RLS), et `ajouter_article` change de signature — donc **`drop function if exists`
> de l'ancienne AVANT de créer la nouvelle**, sans quoi tout appel à l'ancienne arité rendra
> `is not unique` et le chemin d'ajout du produit cessera de fonctionner (mesuré en 4.6).
>
> **D3 à D7 restent sur leur défaut prescrit**, faute d'arbitrage.

### D1 — Réécrire la génération, ou la faire passer par `ajouter_article` ⛔ **la plus structurante**

`ajouter_article` fait **déjà** tout ce que l'AC1 et l'AC2 demandent d'un article : UPSERT-incrémente
sur la clé canonique, tombstone rouvert, acheté ramené à `pending`, quantité qui repart d'une vie
neuve, rayon résolu, provenance estampillée. La génération, elle, fait un `INSERT` nu — d'où les
deux `23505`.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** La génération **boucle sur les ingrédients agrégés et appelle `ajouter_article`** | ✅ Les trois défauts disparaissent **par construction** : plus d'INSERT nu, donc plus de `23505` ; plus de DELETE, donc plus de destruction. ✅ Une seule règle d'agrégation dans le produit (AD-6), au lieu de deux qui divergeront. ⛔ **Elle doit passer en `security invoker`** — `ajouter_article` l'est, et une `definer` qui l'appellerait contournerait la RLS de l'appelant. ⚠️ **Perte à assumer et à mesurer** : `ajouter_article` résout le rayon par le seul NOM (`resolve_aisle_id(v_foyer, null, p_nom, null)`), alors que la génération dispose en plus de `product_id` et `aisle_keyword`. Il faut soit élargir sa signature, soit accepter une résolution plus pauvre |
| (b) Réécrire la génération de bout en bout, avec son propre `on conflict` | ⛔ **Deux copies de l'expression de l'index canonique** dans le dépôt, à garder d'accord à l'octet près. La 4.4 a déjà payé ce piège une fois (échappements `\uXXXX` transformés) |
| (c) Ne corriger que le DELETE | ⛔ Laisse les deux `23505` : la génération continuerait d'échouer dès qu'un article acheté ou un doublon de produit existe |

### D2 — Comment l'AC3 arbitre la résurrection ⛔ **et `ajouter_article` ne le fait PAS aujourd'hui**

**Mesuré** : `ajouter_article` rouvre **inconditionnellement** un tombstone (`deleted_at = null`).
C'est correct pour un ajout **manuel** — le membre qui retape un nom veut l'article. Ce n'est **pas**
ce que l'AC3 demande de la génération : « ressuscité **que si** l'intention de génération est plus
récente que l'intention de suppression ».

⚠️ **Sans cet arbitrage, la génération de dimanche ressuscite l'article que le membre a retiré
samedi** — et le retire de sa décision.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Un paramètre d'intention sur `ajouter_article` (`p_intention timestamptz default null`) : quand il est fourni, le `do update` ne lève le tombstone **que si** `p_intention > grocery_list_items.deleted_at` | ✅ Un seul chemin d'écriture, et l'arbitrage vit **en base** (AD-1). ✅ Le défaut `null` préserve exactement le comportement actuel de l'ajout manuel — aucune régression sur la 4.4. ⚠️ **C'est un avant-goût de la 4.10** : le LWW par champ y sera généralisé. Écrire ici un arbitrage **sur le seul `deleted_at`** est le minimum que l'AC3 exige, et il faut le dire pour que la 4.10 ne croie pas le travail fait |
| (b) La génération lit puis décide côté appelant | ⛔ **Course garantie** entre la lecture et l'écriture — ce que NFR-2 interdit, et l'argument qui a déjà écarté cette forme en 4.4 |
| (c) Reporter l'AC3 à la 4.10 | ⛔ L'AC3 est un critère de CETTE story, et le défaut est réel : une suppression volontaire annulée par la génération suivante |

### D3 — Le `group by` trop fin, qui produit deux lignes de même clé

**Mesuré** : deux ingrédients « Sel / g » avec des `product_id` distincts rendent **deux** lignes de
clé canonique `(foyer, sel, g)` → `23505`.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Grouper sur la **clé canonique** — le nom **normalisé** et l'unité — et non sur `(name, unit, product_id, aisle_keyword)` | ✅ Le groupement de la génération et la clé de la base disent enfin la même chose. ⛔ **L'expression de normalisation ne doit PAS être recopiée** : elle vit dans l'index (AD-1/AD-6) et la 4.4 a mesuré le coût d'une copie. ⚠️ **D1(a) rend ce point sans objet** : si chaque ingrédient passe par `ajouter_article`, deux lignes de même clé s'additionnent au lieu de se heurter — c'est précisément ce que l'UPSERT-incrémente fait |
| (b) `distinct on` | ⛔ Choisit arbitrairement un `product_id` et **perd une quantité** |

### D4 — La surface de la génération n'existe pas dans le vocabulaire

**Mesuré** : `SURFACES` vaut `web, dashboard, voix, dictee, pont, mcp` (`lib/liste/surfaces.ts`, en
accord mesuré avec `grocery_list_items_surface_fermee`). **Aucun jeton ne nomme la génération.**

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Ne PAS ajouter de jeton : la génération écrit `recipe_id`, et c'est **lui** qui commande l'icône 🍴 « issu d'une recette » (`provenanceDe` donne la priorité absolue à la recette). La surface reste celle d'où le membre a cliqué — `web` | ✅ Aucune migration de vocabulaire, et l'AC2 de la 4.6 est satisfait sans rien ajouter. ⚠️ **La revue de la 4.6 a signalé que les six jetons étaient déjà posés avant leurs stories** : en ajouter un septième sans nécessité aggraverait ce report |
| (b) Un jeton `menu` | ⚠️ Plus explicite, mais resserrer un `check` sur table peuplée coûte cher si le nom se révèle mauvais, et l'information est **déjà** portée par `recipe_id` |

### D5 — `recipe_id` quand une ligne vient de PLUSIEURS recettes ⛔ **report daté, adressé à cette story**

**Mesuré** : la génération agrège à travers **toutes** les recettes du menu. Une ligne vient de N
recettes, `recipe_id` est un `uuid` unique.

⚠️ **La revue de la 4.6 a corrigé l'argument** : le modèle porte parfaitement le cas
**mono-recette**, qui est le cas courant et celui que l'AC1 de la 4.6 vise (« `recipe_id` **s'il**
vient d'une recette »). Ce n'est donc pas une impossibilité, c'est un arbitrage.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** `recipe_id` renseigné **si et seulement si** une seule recette a contribué : `case when count(distinct r.id) = 1 then min(r.id) end` | ✅ Honnête dans les deux sens — jamais une recette arbitraire, et l'icône 🍴 n'apparaît que quand elle dit vrai. ⚠️ Un ingrédient partagé par deux recettes n'affichera **aucune** provenance : c'est le prix, et c'est cohérent avec D5 de la 4.6 (« on n'invente pas une origine ») |
| (b) La première recette | ⛔ Affirme une origine fausse dans la moitié des cas |
| (c) Une table de liaison | ⛔ Change le modèle canonique pour un besoin d'affichage non exprimé |

### D6 — Le sort d'`added_by` ⛔ **report daté de la 4.1 puis de la 4.6, adressé à cette story**

La 4.6 écrit : « le retrait appartient à la 4.7, qui réécrit la génération — son unique écrivain ».

**Mesuré** : `added_by` est écrite **uniquement** par cette fonction (`auth.uid()`), et
`actor_kind`/`actor_id` la supplantent depuis la 4.1.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** La génération cesse de l'écrire, et la colonne est **retirée** dans la même migration | ✅ Le moment est exactement celui que la 4.6 avait daté : on touche son unique écrivain. ⛔ **`drop column` exige une décision explicite et une sauvegarde vérifiée** (`docs/migrations.md`) — la requête de contrôle en en-tête doit établir que la colonne est vide **en production** |
| (b) Cesser de l'écrire, retirer plus tard | ⚠️ Défendable, mais reporte une troisième fois un point déjà reporté deux fois |

### D7 — L'arrondi des quantités mises à l'échelle ⛔ **report daté de la 4.4**

La 4.4 écrit : « FR-52 rattache l'arrondi aux quantités mises à l'échelle **(FR-16)**, et FR-16 est
la génération — donc la story **4.7**. Un ajout manuel n'a pas d'échelle à appliquer. »

**Mesuré** : 2 oignons pour 4 portions, servis à 6 → `2 × 6/4` = **3,00**. Le cas propre. Mais
`2 × 5/4` = 2,5 — et l'epic dit « arrondie à une valeur achetable (jamais « 1,67 oignon ») ».

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Arrondir **à l'entier supérieur** les unités dénombrables (`pièce`), laisser les unités continues (`g`, `kg`, `ml`, `L`) telles quelles, et arrondir `cs`/`cc`/`pincée` au demi | ✅ « Jamais 1,67 oignon » est tenu, et on n'invente pas de précision sur une pincée. ⚠️ **La règle est PURE et descend dans `lib/`**, exportée et mesurée — jamais dans le SQL ni dans le JSX |
| (b) Arrondir tout au supérieur | ⛔ 250 g de beurre deviendrait 250 g, mais 1,2 kg de farine deviendrait 2 kg — une erreur d'un facteur proche de 2 |
| (c) Reporter encore | ⛔ Troisième report d'un point que FR-52 rattache explicitement à FR-16 |

---

## Ce qui a été MESURÉ pour cette story

*Stack local, `1eb9669`, PostgreSQL **17.6** (image `postgres:17.6.1.111`). Commandes exécutées.*

| # | Mesure | Résultat |
|---|---|---|
| **M1** | La fonction existe-t-elle, et qui peut l'appeler ? | `security definer`, propriétaire `postgres`. ✅ **`execute` RÉVOQUÉ** pour `authenticated` **et** `anon` (volet 8 de la 4.1) — inatteignable depuis l'application |
| **M2** | ⛔ **Le segfaut** | **NE SE REPRODUIT PAS.** Appel nominal → rend son compte, journal du conteneur **sans `signal 11`** |
| **M3** | Le segfaut sur un plan large | **201 lignes insérées**, coûts de parallélisme abaissés, **aucun crash** |
| **M4** | Le DELETE dur détruit-il un ajout manuel ? | ⛔ **OUI** — 2 articles avant, **1 après**. L'ajout du membre a disparu |
| **M5** | Laisse-t-il un tombstone ? | ⛔ **NON** — **0 ligne** portant ce nom. Destruction physique, irrécupérable |
| **M6** | `23505` sur un acheté survivant | ⛔ **REPRODUIT** — clé `(foyer, oignons, pièce)` déjà occupée |
| **M7** | `23505` sur le `group by` trop fin | ⛔ **REPRODUIT** — deux `product_id` pour « Sel / g » |
| **M8** | La mise à l'échelle | ✅ 2 pièces pour 4 portions, servies à 6 → **3,00**. `mpe.servings / r.servings` fonctionne |
| **M9** | Ce que la génération écrit | `added_by` renseigné · **`surface` NULLE** · **`actor_kind` NULLE** · **`recipe_id` NUL** — aucune provenance |
| **M10** | Le test qui la garde | `assert.notEqual(error, null)` — **« une erreur, n'importe laquelle »**. Il passerait encore sur un crash |
| **M11** | Portes au point de départ | `npm test` **279/279** · isolation **131 · 130 pass · 0 fail · 1 skipped** · `check:migrations` **21/19/2/0** |

---

## Tasks / Subtasks

- [x] **Task 1 — Vérifier le segfaut avant toute chose** (AC: 1) · *dépend de rien* ⛔ **A RENVERSÉ LA PRÉMISSE DE LA STORY**
  - [x] Rejouer M2 et M3 : **le segfaut SE REPRODUIT**. La story le croyait éteint ; c'était une mesure prise par le seul chemin qui ne crashe pas (`psql` en rôle `postgres`). Détail et témoins dans le Debug Log
  - [x] ⛔ **DÉVIATION ASSUMÉE, POUR CAUSE MESURÉE — le test n'assertionne PAS `42501`.** Mesuré : le chemin d'erreur « permission denied for function » **est** ce qui segfaute. Exiger `42501` depuis une surface, c'est exiger le crash — le test ne pourrait jamais être VERT et coucherait le stack à chaque exécution. Il assertionne l'**injoignabilité** (`PGRST202`), plus un **témoin positif**, plus la garde de fond « aucune fonction de `public` n'est injoignable à `anon` » — un prédicat, pas l'énumération de cette fonction-ci
  - [x] ⛔ **Vu ROUGE puis VERT** : ROUGE avec un delta de **+1 segfaut** et `PGRST001` au lieu de `PGRST202` ; VERT avec un delta de **0**. Le test est réactivé — **plus aucun test sauté dans le dépôt**
  - [x] ⚠️ **Rien déclenché en production, et rien affirmé sans mesure.** L'exposition y était *inférée* (la migration de révocation est sur `main`). Le correctif isolé (PR #36) est parti ; son application est **constatée dans les journaux de déploiement** — `Applying migration 20260821090000… / [migrations] appliquées.` — jamais en appelant la fonction
  - [x] ⛔ **HORS PÉRIMÈTRE INITIAL, LIVRÉ À PART (PR #36, fusionnée)** : un `POST` **anonyme** couchait la base de production. La mitigation posée en revue de la 4.5 (révoquer `EXECUTE` en laissant la fonction dans `public`) **était** le danger. Arbitré par Florian le 2026-08-21 : correctif isolé immédiat, puis reprise de la story

- [x] **Task 2 — La migration** (AC: 1, 2, 3) · *dépend de D1, D2, D5, D6*
  - [x] Requête de contrôle en en-tête, **dont celle qui établit que `added_by` est vide en production** (D6)
  - [x] `ajouter_article` reçoit `p_intention timestamptz default null` : le tombstone ne se lève que si l'intention est plus récente (D2)
  - [x] ⛔ **`p_intention` a un DÉFAUT** — sans lui, la 4.4 et l'écran d'ajout changeraient de comportement en silence
  - [x] ⚠️ **Le piège de la SURCHARGE, mesuré en 4.6** : ajouter un paramètre crée une seconde fonction, et tout appel à l'ancienne arité rend `is not unique`. **`drop function if exists` de l'ancienne signature AVANT de créer la nouvelle**
  - [x] `generate_grocery_list_from_menu` réécrite : **plus de DELETE**, boucle sur les ingrédients agrégés, appelle `ajouter_article` (D1)
  - [x] ⛔ **Elle passe en `security invoker`** — une `definer` qui appelle une `invoker` contournerait la RLS
  - [x] Groupement sur la clé canonique, `recipe_id` seulement si une seule recette a contribué (D3, D5)
  - [x] ⛔ **Retirer `added_by`** (D6) — `drop column` appliqué. ⛔ **SA REQUÊTE DE CONTRÔLE N'A PAS ÉTÉ EXÉCUTÉE** : le volet est parti sur la seule **autorisation** de Florian du 2026-08-21, pas sur une mesure. Cette case affirmait le contraire — corrigé en revue le 2026-08-22, règle §1. ⚠️ Et « ne pas appliquer le volet 4 » n'a jamais été une option : il vivait dans le même fichier que les volets indispensables
  - [x] `grant execute` explicite : la fonction redevient appelable par `authenticated`

- [x] **Task 3 — Le pur, côté `lib/`** (AC: 1) · *dépend de D7*
  - [x] `arrondirPourAchat(quantite, unite)` — exportée et **mesurée** ; jamais dans le SQL, jamais dans le JSX
  - [x] ⚠️ Le vocabulaire d'unités vient de `lib/recettes/unites.ts`, **jamais réécrit**
  - [x] `lib/liste/generation.ts` : l'appel RPC, **client EN PARAMÈTRE** (motif de toutes les portes de `lib/liste/`)
  - [x] Le compte rendu (« 12 articles ajoutés ») descend ici, exporté et mesuré — leçon de « 2 pièce »

- [x] **Task 4 — L'écran** (AC: 2)
  - [x] Le geste de génération, sur l'écran du menu ou de la liste — **à situer** d'après `EXPERIENCE.md`
  - [x] ⛔ **Il annonce combien d'articles ont été ajoutés** (FR-17) — c'est un critère, pas un confort
  - [x] Motifs acquis : `useSoumission`, `Notice` avec `reserve` s'il surplombe une cible, **une région de statut par zone d'action**
  - [x] ⚠️ ~~La liste se RELIT après génération~~ — ⛔ **DÉVIÉ, ET LA DÉVIATION N'AVAIT PAS ÉTÉ DÉCLARÉE** (relevé en revue le 2026-08-22 ; les notes annonçaient DEUX déviations, c'était la troisième). L'écran du menu n'affiche pas la liste : il n'a rien à relire, et le compte rendu EST le retour de la base. ⚠️ Corollaire qui, lui, était un vrai défaut : aucun lien ne menait vers `/courses` — ajouté

- [x] **Task 5 — Les tests**
  - [x] `lib/` : l'arrondi sur les huit unités, le compte rendu, ses accords ; **banc de mutations**
  - [x] **Isolation** : ⛔ **un ajout manuel SURVIT à la génération** (fige M4/M5) · un acheté de même clé **s'incrémente** au lieu de rendre `23505` (fige M6) · deux `product_id` de même nom+unité **fusionnent** (fige M7) · la mise à l'échelle (fige M8) · ⛔ **un tombstone plus RÉCENT que la génération n'est pas ressuscité**, et un plus ancien l'est (AC3) · la provenance est écrite (`recipe_id` si mono-recette) · un membre d'un autre foyer ne génère rien chez A
  - [x] ⚠️ **Les tests passent par la PORTE du dépôt**, jamais par un `rpc` recopié — la revue de la 4.6 a montré qu'un test qui recopie la requête laisse passer une fonctionnalité inerte
  - [x] ⚠️ **Le compte attendu se MESURE avant le geste** — le préfixe unique isole les noms, pas les compteurs de foyer
  - [x] ⛔ La garde CI ne tolère **qu'un seul** test sauté : si le test de génération est réactivé, **il n'y en a plus aucun**

- [x] **Task 6 — Les portes, puis le parcours à l'écran**
  - [x] `typecheck` · `lint` · `test` · `test:isolation` · `check:migrations` · `build`
  - [x] `lib/supabase/types.ts` régénéré (signature changée, colonne retirée) — la commande **nue** doit reproduire le fichier
  - [x] Sonde CSS sur tout token neuf, **avec contrôle négatif ET témoin positif**
  - [x] ⛔ **Parcours à l'œil, aux DEUX réglages système, thème remis** — et ⛔ **sur des données produites par LE PRODUIT** : la revue de la 4.6 a trouvé un parcours qui validait des lignes plantées à la main
  - [x] ⚠️ **Couper tout autre serveur du projet d'abord** (les cookies ne distinguent pas les ports)
  - [x] Fermer le `Status` du fichier **et** `sprint-status.yaml` (§6 bis)

---


### Review Findings

**Revue adversariale du 2026-08-21, quatre couches en parallèle** sur `1eb9669..a451d86` — donc la
story 4.7 **et** le correctif #36, que la règle §6 exige de relire. Toutes les trouvailles ci-dessous
ont été **remesurées par moi** avant d'être notées ; deux affirmations de couche ont été **écartées**
parce que ma mesure les contredit.

#### Décisions — TRANCHÉES PAR FLORIAN LE 2026-08-22

⛔ **Les cinq sont devenues des correctifs.** Elles sont conservées ici avec leur raison, parce que
trois d'entre elles changent la story elle-même, pas seulement le code.

| # | Tranchée | Ce que ça change |
|---|---|---|
| 1 | **La génération ne touche PAS un acheté** — ni statut, ni quantité, quand `p_intention` est fourni | Le code, mon test d'isolation (qui verrouillait l'inverse), et la phrase de l'écran redevient vraie |
| 2 | **La clé canonique devient une fonction nommée**, partagée par l'index et le `group by` | Une migration qui dépose et recrée l'index unique ; ferme le double arrondi ET la provenance arbitraire |
| 3 | **Chaque article est isolé dans la boucle** | La génération rend deux nombres (ajoutés / échoués) ; le compte rendu et son test suivent |
| 4 | ⛔ **La MOTIVATION de D2 fait foi — la génération ne ressuscite JAMAIS un tombstone** | **La lettre de l'AC3 doit être réécrite** : elle décrit un LWW que le produit ne veut pas ici. Seul un geste humain rouvre un article |
| 5 | **`arrondirPourAchat` reste un oracle, et le docblock le DIT** | La revendication « banc de mutations 8/8 » est corrigée partout ; un banc neuf portera sur le SQL, la règle qui tourne |

⚠️ **La décision 4 est un changement de CRITÈRE, pas d'implémentation.** L'AC3 tel qu'écrit est
aujourd'hui *satisfait* par le code ; c'est lui qui change. Contrepartie assumée : un article retiré
par erreur ne reviendra plus tout seul.

#### Décisions, dans leur formulation d'origine

- [ ] [Review][Decision] **Un article ACHETÉ est décoché par la génération, et l'écran promet le contraire** — les quatre couches l'ont trouvé. `ajouter_article` fait `status = 'pending'` **inconditionnellement** ; un article coché repasse « à prendre » ET voit sa quantité gonfler. L'AC2 nomme pourtant « des articles ajoutés à la main **ou déjà achetés** … elle ne les **écrase jamais** », et `GenererLaListe.tsx` l'affirme au membre : « ce que tu as déjà pris **restent en place** ». ⛔ **Et mon test d'isolation verrouille le mauvais comportement** (`l'acheté n'est pas redevenu à prendre`). La tension est réelle : la 4.5 a mesuré qu'un acheté **vivant** continue de s'additionner (« il est encore de cette liste-ci »), et cette règle est juste pour un **ajout manuel**. Choix : (a) la génération (`p_intention is not null`) ne touche ni le statut ni la quantité d'un acheté ; (b) elle incrémente mais garde `bought` ; (c) on corrige la phrase de l'écran et on assume.
- [ ] [Review][Decision] **L'arrondi tombe par groupe BRUT, puis les groupes fusionnent — le membre achète en trop, et la provenance ment** — trois couches, reproduit. « Oignon » et « oignon » forment deux groupes ; l'arrondi s'applique à chacun **avant** la fusion (⌈1,5⌉+⌈1,5⌉ = **4** au lieu de ⌈3⌉ = **3**, soit +33 %), et `recipe_id` prend celui du premier groupe — donc l'icône 🍴 nomme **une** recette sur deux contributrices, ce que D5 interdit. ⛔ **Le commentaire du volet 3 affirme le contraire**, et mes deux tests emploient des graphies **identiques** : la couture n'est exercée par rien. Choix : (a) grouper sur l'expression canonique — mais D3(a) interdit de la recopier, il faudrait l'extraire dans une fonction SQL nommée, partagée avec l'index ; (b) agréger d'abord, arrondir ensuite, en gardant le groupe brut pour la lecture ; (c) accepter et le documenter.
- [ ] [Review][Decision] **Un débordement `numeric(8,2)` perd la génération ENTIÈRE, et l'état n'est pas transitoire** — `quantity` plafonne à 999 999,99 et l'écran autorise exactement cette valeur par ingrédient : une simple mise à l'échelle déborde. La boucle n'isole rien, donc **tous** les autres articles de la semaine sont perdus, l'écran dit « On n'a pas réussi à générer ta liste » sans nommer la recette fautive, et le membre est **bloqué**. ⚠️ L'accumulation des régénérations y mène toute seule. Choix : (a) borner la quantité en base et signaler l'article écrêté ; (b) isoler chaque article dans la boucle et rendre compte des échecs ; (c) élargir la colonne.
- [ ] [Review][Decision] **L'AC3 ne protège pas le scénario pour lequel il a été écrit** — deux couches, et **je l'ai remesuré par la porte du produit** : `supprimer_article` puis génération → l'article **revient** (`deleted_at` nul, `pending`). Tous les chemins de suppression posent `deleted_at = now()`, et la génération prend son intention plus tard : `p_intention > deleted_at` est **toujours vrai**. La garde ne se déclenche que sur un tombstone daté dans le **futur**, que seul mon test fabrique. ⛔ La **lettre** de l'AC3 est tenue (c'est du LWW) ; la **motivation de D2** — « la génération de dimanche ressuscite l'article retiré samedi, et retire au membre sa décision » — ne l'est pas, et mon commentaire de migration promet cette protection. La contradiction est dans la story elle-même. Choix : (a) accepter le LWW et corriger commentaire + D2 ; (b) faire perdre la génération en cas d'égalité de journée ; (c) rouvrir le sujet en 4.10.
- [ ] [Review][Decision] **`arrondirPourAchat` n'a AUCUN appelant de production** — la règle qui s'exécute est la SQL ; la copie `lib/` est un oracle de test. Mon « banc de mutations 8/8 tués » porte donc sur la copie **qui ne tourne pas**. L'invariant les garde d'accord, mais D7 prescrivait l'inverse de ce qui est livré. Choix : (a) l'assumer et le réécrire honnêtement ; (b) la câbler à l'écran (affichage) pour qu'elle serve ; (c) la supprimer et ne garder que le SQL plus l'invariant.

#### Correctifs sans ambiguïté

- [x] [Review][Patch] **Un ingrédient sans quantité arrive à « 0 g » — régression sur l'implémentation remplacée** : l'ancienne génération faisait `nullif(p.total_qty, 0)`, la mienne l'a perdu [`supabase/migrations/20260821110000…sql:307`]
- [x] [Review][Patch] **`p_intention` est pilotable par le client — l'horodatage LWW devient déclaratif** : exposé en RPC et accordé, borné seulement vers le futur par un `check`. C'est le motif que la 4.6 avait fermé pour la provenance, rouvert pour l'horodatage — et la 4.10 en hériterait falsifiable [`…110000.sql:118`]
- [x] [Review][Patch] **Le compte rendu annonce « ajoutés » alors qu'il compte les ids TOUCHÉS** : au second appel, « N articles ajoutés » quand zéro l'a été [`lib/liste/generation.ts:73`]
- [x] [Review][Patch] **Ma sonde divulgue exactement ce que PostgREST cache — et ma justification écrite était fausse, non mesurée** : ⛔ **remesuré par moi** — l'OpenAPI d'`anon` est filtré par privilège (`zz_visible` visible, `zz_cachee` absente), et la sonde rend précisément `zz_cachee()`. Elle donne donc à un anonyme le nom, la signature et la liste des cibles. Rendre un **compte**, pas des noms [`…090000.sql:75`]
- [x] [Review][Patch] **La sonde manque l'état `anon` accordé / `authenticated` révoqué** : un MEMBRE connecté y déclenche le même refus de permission [`…090000.sql:88`]
- [x] [Review][Patch] **La garde CI est MUETTE à `n=0`, et elle promettait de rougir exactement là** : ⛔ **vérifié** — les branches sont `n>1` et `n=1` ; la 4.7 a retiré le saut sans la toucher et rien n'a rougi. `SAUT_ATTENDU` nomme désormais un test qui n'existe plus [`.github/workflows/ci.yml:181`]
- [x] [Review][Patch] **Semaine vide : le bouton est rendu AVANT le test, et la phrase affirme le faux** — « Ta liste avait déjà tout ce qu'il faut. » alors que c'est le MENU qui est vide, et que la liste n'a pas été consultée. Zéro a trois causes et une seule phrase [`app/menu/page.tsx:277`]
- [x] [Review][Patch] **⛔ `Task 2` porte une case cochée qui dit « avec sa requête de contrôle exécutée »** — alors que les notes, le Change Log et le commit la disent **due**. C'est la règle §1 violée dans le document qui la cite
- [x] [Review][Patch] **⛔ `Task 4` porte une case cochée « la liste se RELIT après génération »** — le composant fait l'inverse, et l'assume. C'est une **troisième** déviation, non déclarée, alors que les notes en annoncent deux. Corollaire mesuré : **aucun lien vers `/courses`** depuis `/menu`
- [x] [Review][Patch] **`sprint-status.yaml` affirme toujours « LE SEGFAUT NE SE REPRODUIT PLUS »** — démenti par la Task 1 le lendemain, jamais re-daté
- [x] [Review][Patch] **L'énoncé causal du segfaut est plus ferme que la mesure** : ⛔ **arbitré par ma propre mesure** — une couche affirmait que `language sql` ne crashe pas ; je l'ai reproduit **6 fois sur 6** via PostgREST, donc sa correction est **écartée**. Mais une autre couche a relevé des `permission denied for function` **propres** le même jour : le fait est donc **intermittent selon l'état de la connexion**, et « c'est ce chemin d'erreur qui crashe » reste plus ferme que ce qui est établi. À corriger dans `deferred-work.md` (la migration est déployée, donc intouchable)
- [x] [Review][Patch] **Le `drop` a emporté les commentaires de la vue ET d'`ajouter_article`** — miroir exact du piège que le volet 4 revendique avoir évité : une vue ne suit pas sa table, un commentaire ne suit pas sa vue [`…110000.sql:368`, `:109`]
- [x] [Review][Patch] **`arrondir_pour_achat` est la seule fonction neuve sans `set search_path`** [`…110000.sql:68`]
- [x] [Review][Patch] **L'invariant TS↔SQL ne compare ni `quantite = null`, ni `unite = null`, ni une unité hors vocabulaire** — précisément les trois cas que le test TS revendique [`supabase/tests/contraintes.test.ts:440`]
- [x] [Review][Patch] **`nullif(r.servings, 0)` est du code mort et son commentaire affirme un cas impossible** — `recipes_servings_positif` l'interdit [`…110000.sql:303`]

#### Reportés

- [x] [Review][Defer] **Régénérer double les quantités** — déjà consigné avant la revue comme un arbitrage ouvert ; les quatre couches le confirment
- [x] [Review][Defer] **`p_start_date`/`p_end_date` sans bornes** — `-infinity`/`infinity` déverse tout l'historique de menu en un appel ; pas d'escalade inter-foyer, la RLS tient
- [x] [Review][Defer] **La génération écrit `ri.name` BRUT, sans normalisation** — les surfaces actuelles normalisent, mais AD-1/AD-2 disent que la règle ne doit pas vivre « dans la vigilance d'une surface »
- [x] [Review][Defer] **`aisle_id` est le seul champ du `do update` sans son cas tombstone** — inobservable aujourd'hui, `product_aisle_map` étant vide
- [x] [Review][Defer] **`graphql_public` est exposé par PostgREST et la sonde ne regarde que `public`** — aucun contrevenant en base
- [x] [Review][Defer] **Le `drop column added_by` est parti sans sa condition, et la condition était inapplicable** — le volet vivait dans le même fichier que les volets dont la story a besoin, et le déploiement applique le lot entier. « Ne pas appliquer le volet 4 » n'a jamais été une option. Irréversible, à consigner comme leçon de rédaction

#### Écartées, mesure à l'appui

- **`prokind = 'f'` serait un trou exploitable** (deux couches) — ⛔ **écarté** : une couche l'a éprouvé, PostgREST **n'expose pas** les procédures (`HTTP 404`, absentes de l'OpenAPI). Le prédicat reste plus étroit que son commentaire ne le prétend, mais ce n'est pas un vecteur
- **« `language sql` refuse proprement, seul `plpgsql` crashe »** (une couche) — ⛔ **écarté** : reproduit **6/6** chez moi via PostgREST, delta de segfaut à chaque appel


## Dev Notes

### Les pièges, dans l'ordre où ils mordent

**Piège n°1 — Croire qu'il faut diagnostiquer un segfaut.** Il ne se reproduit plus (M2, M3). Le
travail réel est ailleurs : le DELETE destructeur et les deux `23505`. ⚠️ Mais **re-mesurer avant**,
et écrire le résultat.

**Piège n°2 — Réécrire l'agrégation au lieu de réutiliser `ajouter_article`.** Deux copies de
l'expression de l'index canonique dans le dépôt, à garder d'accord à l'octet près. La 4.4 a payé ce
piège.

**Piège n°3 — Ajouter un paramètre sans retirer l'ancienne signature.** Mesuré en 4.6 : deux
surcharges coexistent et **tout appel à l'ancienne arité rend `is not unique`** — le chemin d'ajout
du produit cesse de fonctionner.

**Piège n°4 — Une `security definer` qui appelle une `invoker`.** Elle contournerait la RLS de
l'appelant, et la fonction redeviendrait ce que le volet 8 de la 4.1 a révoqué.

**Piège n°5 — Rouvrir un tombstone inconditionnellement.** C'est le comportement actuel
d'`ajouter_article`, correct pour un ajout manuel, **faux pour la génération** (AC3).

**Piège n°6 — Oublier que la génération n'écrit aucune provenance.** Mesuré (M9) : `surface`,
`actor_kind` et `recipe_id` sont tous nuls. Passer par `ajouter_article` les remplit — sauf
`recipe_id`, qu'elle ne prend pas en paramètre aujourd'hui.

**Piège n°7 — `drop column added_by` sans contrôle en production.** `docs/migrations.md` l'interdit
sans décision explicite et sauvegarde vérifiée.

**Piège n°8 — Un test qui recopie la requête.** La revue de la 4.6 a montré qu'un tel test reste
vert sur une fonctionnalité entièrement inerte.

### Frontières — ce que cette story ne fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| Le LWW **par champ** généralisé | **4.10** — cette story n'arbitre que `deleted_at`, et le dit |
| La décision `intent_at` (horloge client vs serveur) | **à trancher avant la 4.10** |
| La consultation hors ligne, l'outbox | **4.8**, **4.9** |
| La propagation temps réel | **4.11** |
| Le plancher d'accessibilité de la liste | **4.13** |
| La ceinture `update` sur `actor_id` (trigger) | **4.10** |
| `actor_id` sans clé étrangère | **Epic 5** |
| La course du cache de schéma PostgREST | à instruire par qui touchera signature ou vue |

### Ce que les stories 4.4 à 4.6 lèguent

- **`ajouter_article` est l'unique chemin d'ajout** (AD-6), et il fait déjà l'essentiel du travail
  de l'AC1. C'est le legs le plus utile de l'epic.
- **La provenance est estampillée côté serveur** ; la surface est un **paramètre obligatoire** de
  `ajouterArticle` — un appelant qui l'oublie est arrêté par le compilateur.
- **Le vocabulaire des surfaces est mesuré contre la base** (`contraintes.test.ts`) : y toucher
  exige de mettre les deux côtés d'accord.
- **Les gestes de liste sont bornés au foyer *dans* la fonction**, ceinture en plus de la RLS.
- ⛔ **La leçon de méthode de la 4.6** : un parcours à l'écran qui valide des données ensemencées à
  la main ne mesure rien. Générer depuis un menu **réellement saisi**, pas depuis un `insert`.

### Standards de test

- `node --test` natif, aucun harnais de composants (NFR-10) → **toute règle testable descend dans `lib/`**.
- Les tests d'isolation passent par `a.client` / `b.client`, **jamais `admin`** (AD-17).
- Un invariant entre deux fichiers **se mesure** (§4).
- ⛔ **`node --test` sur un glob vide rend 0** : tout contrôle neuf doit répondre à « que se passe-t-il
  s'il ne trouve rien ? ».

### Project Structure Notes

`lib/liste/` est le module posé par la 4.2 et étendu par les 4.3 à 4.6. Une migration est due — la
**cinquième** de l'Epic 4. Elle porte sa requête de contrôle en en-tête et s'applique **au
déploiement**. ⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION** : le parcours se
fait sur le stack local.

### References

- [Source: `epics.md#Story 4.7`] — story, AC1 à AC3
- [Source: `prd.md#FR-16, FR-17, FR-52`] — génération, compte rendu, arrondi
- [Source: `ARCHITECTURE-SPINE.md#AD-6`] — **UPSERT-incrémente, agrégation autoritaire côté serveur**
- [Source: `ARCHITECTURE-SPINE.md#AD-3`] — tombstone, LWW par champ sur intention
- [Source: `ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-13, AD-17`]
- [Source: `20260502000000_initial_schema.sql:520-570`] — la fonction actuelle, ses trois défauts
- [Source: `20260805092611_…sql` volet 8] — le `revoke execute` qui la rend inatteignable
- [Source: `20260820140000_…sql`] — `ajouter_article` dans son état livré
- [Source: `deferred-work.md`] — segfaut · `added_by` · N-recettes · arrondi
- [Source: `_bmad-output/project-context.md`]

### Intelligence git — ce que les derniers commits enseignent

| Commit | Ce qu'il apprend à cette story |
|---|---|
| `1eb9669` feat(4-6) | ⛔ **Une story peut être verte et INERTE** : la porte ne transmettait pas son paramètre, et les tests recopiaient la requête. Cette story appelle une fonction depuis une autre — le même piège s'y loge |
| `065ec58` fix(4-5) revue | Le motif de la fonction qui **s'auto-borne** au foyer, et la leçon : revendiquer une règle sans se l'appliquer |
| `fefa2ec` feat(4-5) | `.delete()` rend `DELETE 0` sans erreur — **le DELETE dur de la génération, lui, fonctionne** parce qu'elle est `definer` |
| `1a4bf87` feat(4-4) | `ajouter_article`, l'UPSERT-incrémente, et le piège de l'expression d'index recopiée |

### Latest tech — rien à rafraîchir

Aucune dépendance nouvelle (NFR-10). PostgreSQL **17.6**, image `postgres:17.6.1.111`. ⚠️ **Le
numéro de build de l'image a changé depuis la mesure du segfaut du 2026-08-07** — c'est le seul fait
circonstanciel disponible pour expliquer sa disparition, et il ne prouve rien.

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

#### 2026-08-20 — Task 1 : le segfaut SE REPRODUIT, et ce n'est pas ce que la story croyait

⛔ **La prémisse de la story est FAUSSE.** La story partait de « le segfaut ne se reproduit
plus » (mesuré à la contextualisation). Cette mesure était **invalide** : elle appelait la
fonction depuis `psql` en rôle `postgres`, c'est-à-dire par le seul chemin qui ne crashe pas.

**Ce qui a manqué de rester invisible.** La première contre-mesure du jour a elle aussi conclu
« 0 ligne de crash » — puis le **témoin positif** l'a démentie : mes appels HTTP tapaient le
port `54321`, qui n'est **pas** NutriClaude mais un autre projet Supabase local (`crm`).
NutriClaude écoute sur `55321`. Sans témoin positif, j'aurais écrit un test fondé sur une
mesure prise contre une autre base. C'est la leçon §7 du project-context, payée une fois de plus.

**Le crash, isolé, avec ses témoins :**

| # | Cas | Rôle | Résultat |
|---|---|---|---|
| T1 | `generate_grocery_list_from_menu`, appel nu | `anon` | 💥 `signal 11: Segmentation fault` |
| T2 | idem | `postgres` (EXECUTE accordé) | ✅ `ERROR: No household for current user` |
| T3 | `current_household_id()` seule | `anon` | ✅ null, aucun crash |
| S1 | fonction **minimale** `security definer`, EXECUTE révoqué | `anon` | 💥 segfault |
| S2 | fonction **minimale** `security invoker`, EXECUTE révoqué | `anon` | 💥 segfault |
| B1 | `SELECT` refusé sur une **table** | `anon` | ✅ erreur propre |
| B2 | fonction **SQL** (non plpgsql), EXECUTE révoqué | `anon` | 💥 segfault |
| B3 | fonction **inexistante** (témoin négatif) | `anon` | ✅ erreur propre |
| P1 | fonction **accordée** | `anon` | ✅ retourne 42 |
| P2 | fonction **accordée** qui lève une exception | `anon` | ✅ erreur propre |
| P3 | fonction **supprimée** | `anon` | ✅ erreur propre |

**Conclusion mesurée : le segfaut n'a RIEN à voir avec l'agrégation de la génération.** C'est le
chemin d'erreur « permission denied for function » lui-même qui crashe le serveur, sur l'image
Postgres 17.6 de Supabase — quel que soit le langage (`sql`, `plpgsql`), quel que soit le mode
de sécurité (`definer`, `invoker`), quel que soit le corps (`return 42` suffit). Le refus sur
une **table** est propre ; seul le refus sur une **fonction** crashe.

⛔ **La mitigation posée en revue de la 4.5 est donc elle-même le danger.** Révoquer `EXECUTE`
en laissant la fonction dans `public` a transformé « un membre peut détourner la génération »
en « **n'importe qui peut faire tomber la base** » : un seul `POST` anonyme, sans compte ni
session, avec la seule clé publiable — qui est publique par construction dans le bundle
navigateur — suffit. Reproduit délibérément deux fois, isolément, journal à l'appui.

**Conséquence directe sur cette story :** la sous-tâche « resserrer l'assertion du test sauté à
`42501` » est **impossible à satisfaire**. Exiger `42501` depuis une surface, c'est exiger le
crash : le test ne pourrait jamais être VERT, et chaque exécution coucherait le stack local. Le
test doit prouver autre chose — que la fonction est **injoignable**, pas qu'elle est refusée.

**Parade mesurée (P1/P2/P3) :** ne jamais laisser dans `public` une fonction dont `EXECUTE` est
révoqué. Soit on l'**accorde** et on la sécurise par la RLS et ses propres contrôles (ce que
D1(a) prescrit déjà), soit on la **supprime**. Recensement du jour : une seule fonction du
produit est dans l'état dangereux — `generate_grocery_list_from_menu`. Aucun code produit ne
l'appelle ; seul le test sauté la nomme.

⚠️ **PRODUCTION — inféré, NON vérifié, et volontairement non vérifié.** La migration qui pose la
révocation (`20260805092611`) est sur `origin/main`, donc appliquée au déploiement Vercel. La
production a donc selon toute vraisemblance la même fonction, dans `public`, exposée par
PostgREST, révoquée. **Je n'ai déclenché aucun appel en production et je ne le ferai pas** : la
seule façon de le « vérifier » serait de coucher la vraie base du foyer.


### Completion Notes List

**Ce que la story livre, et ce qu'elle a trouvé en chemin.**

⛔ **Task 1 a RENVERSÉ la prémisse de la story, et le résultat est parti à part.** Le segfaut se
reproduisait, mais pas pour la raison qu'on croyait : c'est le chemin d'erreur « permission denied
for function » qui crashe l'image Postgres 17.6 de Supabase — donc la mitigation posée en revue de
la 4.5 (révoquer `EXECUTE` en laissant la fonction dans `public`) **était** le danger. Un `POST`
anonyme couchait la base de production. Arbitré par Florian : correctif isolé immédiat (**PR #36**,
fusionnée, **application constatée dans les journaux de déploiement**), puis reprise de la story.
Détail et témoins dans le Debug Log.

**Les trois défauts destructeurs sont fermés, chacun mesuré :**

| Défaut | Avant | Après |
|---|---|---|
| M4/M5 — le `DELETE` dur détruit les ajouts manuels, **sans tombstone** | 2 lignes → 1 | l'ajout manuel survit (test + parcours à l'écran) |
| M6 — un acheté de même clé fait échouer l'`insert` | `23505`, génération entièrement perdue | s'incrémente : 1 + ⌈2×1,5⌉ = **4** |
| M7 — deux `product_id` de même nom+unité | `23505` | **une** ligne, 150 g, aucune quantité perdue |

**AC3 tenu dans les DEUX sens** : un tombstone plus récent que la génération n'est pas ressuscité
(la génération rend 0, l'article reste supprimé) ; un plus ancien l'est, avec une quantité de **vie
neuve**. L'arbitrage tient dans un `where` sur le `do update` — la mise à jour est **sautée**, la
ligne reste intacte, et `returning` ne rend rien : c'est ce `null` qui dit à la génération de ne pas
compter l'article.

⛔ **DEUX DÉFAUTS DE MES PROPRES ÉCRITS, TROUVÉS PAR LES TESTS ET PAR LE BANC — pas par la relecture :**
1. **L'arrondi au demi écrasait une pincée à ZÉRO** (`round(0,1×2)/2 = 0`) : l'ingrédient sortait de
   la liste en silence. Corrigé **des deux côtés** (TypeScript et SQL) par un plancher à 0,5.
2. **Muter `> 0` en `>= 0` survivait** à toute la suite — avec `>=`, une quantité NULLE devenait 0,5,
   donc on **inventait** une quantité. Or `coalesce(ri.quantity, 0)` fait arriver ici tout ingrédient
   saisi sans quantité. Test ajouté ; **8 mutations sur 8 tuées** au passage final.

⛔ **UNE BRANCHE MORTE SUPPRIMÉE PLUTÔT QUE COUVERTE PAR UN TEST CONTRIVÉ.** Une mutation survivait
sur la branche `quantité ≤ 0` : à zéro, les deux formes coïncident, donc aucun test ne pouvait
distinguer la juste de la fautive. La réponse honnête n'était pas d'inventer un cas négatif — c'était
de retirer la branche.

⛔ **DEUX PRESCRIPTIONS DE LA STORY ONT DÛ ÊTRE DÉVIÉES, chacune pour une cause MESURÉE :**
- **D5 prescrivait `min(r.id)` — ça ne compile pas** (`function min(uuid) does not exist`). Remplacé
  par `(array_agg(distinct …))[1]`, qui dit la même chose.
- **Le test de Task 1 devait exiger `42501` — l'exiger, c'est exiger le crash.** Il prouve
  désormais qu'un anonyme reçoit un refus **applicatif** (`P0001`), et porte la garde de fond :
  *aucune fonction de `public` n'est injoignable à `anon`* — un prédicat, pas l'énumération d'une
  fonction.

⚠️ **D7 ET D1(a) SE CONTREDISAIENT**, et la contradiction est résolue par le motif que le dépôt
emploie déjà trois fois : D7 disait « l'arrondi ne vit jamais dans le SQL », D1(a) mettait la boucle
DANS la base. La règle vit donc en deux exemplaires (`lib/liste/arrondi.ts` et
`public.arrondir_pour_achat`), et leur **accord est MESURÉ** — 8 unités × 16 valeurs, avec contrôle
négatif vérifié (muter `ceil` en `floor` côté TypeScript fait bien tomber le test).

⛔ **DEUX PIÈGES DÉJÀ PAYÉS PAR LE DÉPÔT, ÉVITÉS PARCE QU'ILS ÉTAIENT ÉCRITS :**
- L'expression d'index recopiée avec les caractères invisibles **rendus** au lieu de leurs
  échappements `\uXXXX` — la faute exacte de la 4.4. Rattrapée en comparant à `pg_indexes`.
- **Retirer une colonne casse la vue qui la lit** : `drop column added_by` aurait échoué, et
  `cascade` aurait emporté `grocery_list_by_aisle`. C'est le MIROIR du piège de la 4.6 (ajouter une
  colonne ne l'ajoute pas à la vue). La vue est déposée puis recréée, la colonne part après.

⚠️ **`recipe_id` N'AVAIT JAMAIS ÉTÉ ÉCRIT PAR PERSONNE** — mesuré : ni l'ancienne génération, ni
`ajouter_article` (la colonne était absente de sa liste d'`insert`, alors que son `do update` lisait
`excluded.recipe_id`, donc toujours nul). La branche « issu d'une recette » de la 4.6 était
**inatteignable** jusqu'ici. Cette story est son premier écrivain, et le parcours à l'écran le montre.

**Parcours à l'œil, sur des données produites par LE PRODUIT** (inscription, recette, ingrédients,
menu, ajout manuel — tout par l'écran) : « **3 articles ajoutés à ta liste.** », puis la liste montre
`Café en grains` **survivant sans icône**, `Crème fraîche 300 ml` (continue, non arrondie),
`Muscade 1,5 pincée` (demi), `Potimarron **2 pièces**` (⌈1,5⌉, et le pluriel est juste — le défaut
« 2 pièce » de la 4.2 ne revient pas). Provenance sur **trois canaux** (icône en présentation texte,
jumeau `.sr-only`, nom accessible de la case) — UX-DR6 tenu. Les deux thèmes vérifiés, **thème
système remis à son état d'origine**.

⚠️ **CE QUI N'A PAS PU ÊTRE VÉRIFIÉ, ET QUI EST DÛ :**
- **NFR-3 sur toute la page** : l'outillage n'a pas réussi à redimensionner la fenêtre de l'onglet
  (il rend « succès », la fenêtre d'affichage reste à 1590 px), et l'application refuse d'être
  encadrée. Ce qui EST mesuré : **mon ajout** ne déborde à aucune largeur jusqu'à 280 px, et son
  bouton fait exactement 44 px. La grille, elle, n'a pas été touchée par cette story.
- **La requête de contrôle n°1 de la migration (D6, `added_by` vide en production)** — à exécuter
  par Florian avant fusion. Le `drop column` en dépend.

### File List

**Neufs**
- `supabase/migrations/20260821110000_generer_la_liste_sans_rien_ecraser.sql`
- `lib/liste/arrondi.ts`
- `lib/liste/arrondi.test.ts`
- `lib/liste/generation.ts`
- `app/menu/GenererLaListe.tsx`

**Modifiés**
- `app/menu/page.tsx` — l'îlot câblé au-dessus de la grille ; l'avertissement du docblock nuancé
- `supabase/tests/isolation.test.ts` — 8 tests de la 4.7 ; le test du correctif réécrit (3ᵉ vie)
- `supabase/tests/contraintes.test.ts` — l'invariant d'arrondi `lib/` ↔ base
- `lib/supabase/types.ts` — régénéré (signature d'`ajouter_article`, `added_by` retirée, sonde d'audit)
- `_bmad-output/implementation-artifacts/4-7-…md`, `deferred-work.md`, `sprint-status.yaml`

**Livrés à part, PR #36 (fusionnée)** — arrêt de service anonyme, hors périmètre initial
- `supabase/migrations/20260821090000_rendre_la_generation_injoignable.sql`

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-20 | create-story | Contextualisation sur `1eb9669`. **Onze mesures exécutées.** ⛔ **LE FAIT QUI CHANGE LA FORME DE LA STORY : le segfaut ne se reproduit plus.** `deferred-work.md` le décrit comme « un crash par appel, déterministe » (2026-08-07) ; mesuré à nouveau le 2026-08-20, la fonction rend son compte sans erreur et le journal ne porte aucune trace de `signal 11` — éprouvé sur 1 puis **201** ingrédients avec les coûts de parallélisme abaissés. ⚠️ **Cause non établie** : la version majeure est identique (17.6), seul le numéro de build de l'image a changé. La story ne doit donc pas partir en croyant diagnostiquer un crash — elle doit **re-mesurer, re-dater, et resserrer le test qui l'observait** (il assertionne encore « une erreur, n'importe laquelle »). ⛔ **Les trois défauts RÉELS sont, eux, reproduits** : le DELETE dur **détruit** les ajouts du membre (2 articles avant, 1 après, **sans tombstone** — irrécupérable) ; `23505` sur un acheté survivant ; `23505` sur un `group by` plus fin que la clé canonique. ✅ **Et la moitié du travail existe déjà** : `ajouter_article` fait l'UPSERT-incrémente, rouvre les tombstones, résout le rayon et estampille la provenance — d'où **D1, la décision la plus structurante** : la génération boucle dessus plutôt que de réécrire une seconde agrégation. ⛔ **Ce qu'`ajouter_article` ne fait PAS et que l'AC3 exige** : elle rouvre un tombstone **inconditionnellement**, correct pour un ajout manuel, faux pour la génération — d'où D2, un paramètre d'intention. ⚠️ **Trois reports datés convergent ici et sont tranchés** : `added_by` (D6, retrait dans la migration), la question N-recettes (D5, `recipe_id` seulement si une seule recette a contribué), et l'arrondi (D7, à l'entier supérieur pour les unités dénombrables seulement). Portes au départ : `npm test` 279/279 · isolation 131 · 130 pass · 0 fail · 1 skipped · `check:migrations` 21/19/2/0. |
| 2026-08-21 | dev-story | **Implémentée.** 5 fichiers neufs, 5 modifiés, **une migration**, aucune dépendance. **D1 et D2 tranchées par Florian** (leur défaut prescrit) ; D3 à D7 sur le leur. ⛔ **TASK 1 A RENVERSÉ LA PRÉMISSE ET FAIT SORTIR UN CORRECTIF DE PRODUCTION** : le segfaut se reproduisait, mais la cause n'était pas la génération — c'est le chemin d'erreur « permission denied for function » qui crashe l'image Postgres 17.6 (fonction minimale `return 42`, `sql` comme `plpgsql`, `definer` comme `invoker` ; le refus sur une TABLE est propre). Donc **la mitigation de la revue de la 4.5 ÉTAIT le danger** : un `POST` **anonyme** couchait la base. Livré à part (**PR #36**, fusionnée, application **constatée dans les journaux de déploiement**). ⛔ **Les trois défauts destructeurs sont fermés et mesurés** : l'ajout manuel survit (M4/M5), l'acheté s'incrémente à 4 au lieu de `23505` (M6), deux `product_id` fusionnent en 150 g (M7). **AC3 tenu dans les deux sens** par un `where` sur le `do update` — la mise à jour est SAUTÉE, la ligne reste intacte, `returning` ne rend rien. ⛔ **DEUX DÉFAUTS DE MES PROPRES ÉCRITS, trouvés par le test et le banc** : l'arrondi au demi écrasait une pincée à ZÉRO (corrigé des deux côtés) ; muter `> 0` en `>= 0` survivait, or il **inventait** une quantité sur un ingrédient sans quantité. ⛔ **Une branche morte SUPPRIMÉE plutôt que couverte par un test contrivé.** ⛔ **DEUX PRESCRIPTIONS DÉVIÉES pour cause mesurée** : `min(uuid)` n'existe pas en PostgreSQL ; exiger `42501` depuis une surface, c'est exiger le crash — le test prouve désormais le refus **applicatif** plus la garde de fond « aucune fonction de `public` n'est injoignable à `anon` ». ⚠️ **D7 et D1(a) se contredisaient** : la règle d'arrondi vit en deux exemplaires, et leur accord est **MESURÉ** (8 unités × 16 valeurs, contrôle négatif vérifié). ⛔ **DEUX PIÈGES DÉJÀ PAYÉS, évités parce qu'écrits** : l'expression d'index recopiée avec les invisibles rendus au lieu des échappements (la faute de la 4.4) ; `drop column` qui casse la vue qui la lit (le MIROIR du piège de la 4.6). ⚠️ **`recipe_id` n'avait jamais été écrit par personne** — la branche « issu d'une recette » de la 4.6 était inatteignable ; cette story est son premier écrivain. Portes : `npm test` **291/291** · isolation **140 · 0 fail · 0 SAUTÉ** (le dernier test sauté du dépôt est réveillé) · typecheck · lint · `check:migrations` 23/21/2/0 · build · `types.ts` reproductible par la commande nue · **banc de mutations 8/8 tués — ⛔ MAIS SUR LA COPIE `lib/`, QUI NE S'EXÉCUTE PAS** (relevé en revue ; un banc portant sur `public.arrondir_pour_achat`, la règle qui tourne, a été ajouté depuis : 8/8 également) · **0 segfaut** sur toute la suite. **Parcours à l'œil sur des données produites par LE PRODUIT** (inscription → recette → ingrédients → menu → ajout manuel), aux deux thèmes, thème système remis : « 3 articles ajoutés à ta liste. », `Café en grains` survit **sans icône**, `Crème fraîche 300 ml` non arrondie, `Muscade 1,5 pincée`, `Potimarron **2 pièces**` — pluriel juste. Provenance sur **trois canaux** (UX-DR6). ⚠️ **RESTE DÛ, daté** : NFR-3 sur toute la page (l'outillage n'a pas su redimensionner la fenêtre ; mon îlot, lui, ne déborde pas jusqu'à 280 px), et **la requête de contrôle n°1 (D6, `added_by` vide en production)**, dont dépend le `drop column`. |
| 2026-08-22 | code-review | **Revue adversariale, quatre couches en parallèle** sur `1eb9669..a451d86` — la 4.7 **et** le correctif #36, que §6 exige de relire. **26 trouvailles** : 5 décisions, 15 correctifs, 6 reports, **2 écartées mesure à l'appui**. ⛔ **Les quatre couches ont convergé par des chemins différents**, et j'ai remesuré chaque point avant de le noter. ⛔ **TROIS DÉCISIONS CHANGENT LA STORY, PAS SEULEMENT LE CODE** : (1) la génération ne touche plus un **acheté** — l'AC2 les nommait et mon test verrouillait l'inverse ; (2) la clé canonique devient une **fonction partagée** entre l'index et le groupement — le `group by` sur le nom brut faisait tomber l'arrondi **deux fois** (+33 %) et faisait mentir `recipe_id` ; (4) ⛔ **la LETTRE de l'AC3 est réécrite** — elle demandait un LWW que le code respectait, mais tous les chemins de suppression posent `deleted_at = now()` et la génération est postérieure **par construction** : la garde ne se déclenchait donc que sur un tombstone daté dans le futur, que seul un test fabrique. La génération ne ressuscite plus rien ; seul un geste humain rouvre. ⛔ **QUATRE DÉFAUTS QUE J'AVAIS ÉCRITS ET DÉFENDUS PAR UN COMMENTAIRE FAUX** : le `group by` brut (mon commentaire affirmait qu'il ne coûtait rien) ; le `nullif(total,0)` **perdu** par rapport à l'implémentation remplacée, d'où « 0 pincée » ; un débordement `numeric(8,2)` qui **perdait la semaine entière** ; et ma sonde d'audit qui **divulguait exactement ce que l'OpenAPI cache** — remesuré : l'OpenAPI est filtré par privilège, et j'avais écrit la justification contraire **sans la mesurer**. ⛔ **DEUX CASES COCHÉES DISAIENT LE CONTRAIRE DE MES NOTES** (la requête de contrôle D6, la relecture de la liste) — §1 violée dans le document qui la cite. ⛔ **LA GARDE CI CENSÉE FORCER SA PROPRE RELECTURE EST RESTÉE MUETTE** : ses branches couvraient `n>1` et `n=1`, jamais `n=0`, et `SAUT_ATTENDU` nommait un test disparu. Seuil désormais à **zéro, sans exception nommée**. ⛔ **`p_intention` était falsifiable par le client** — le motif que la 4.6 avait fermé pour la provenance, rouvert pour l'horodatage ; borné par `least(…, now())`. ⚠️ **`arrondirPourAchat` n'a aucun appelant de production** : le « banc 8/8 » de la 4.7 portait sur la copie qui ne tourne pas — requalifié partout, et **un banc neuf sur `public.arrondir_pour_achat` rend 8/8**. Portes : `npm test` **292** · isolation **144 · 0 fail · 0 sauté** · typecheck · lint · `check:migrations` 24/22/2/0 · build · types reproductibles · **0 segfaut**. **Parcours à l'œil, données produites par LE PRODUIT**, aux deux thèmes, thème remis : semaine vide → **aucun bouton** ; « **1 article posé sur ta liste.** » ; « **Voir ma liste →** » ; Courgette **5 pièces** (⌈3×6/4⌉) ; cochée puis régénérée → « **Rien de neuf pour ta liste.** » et « Courgette, **dans le panier** » **intacte**. ⛔ **Le parcours a trouvé un 21ᵉ défaut** qu'aucune porte ne voyait : le lien « Voir ma liste » était **centré** sous un bloc aligné à gauche (`flex` au lieu d'`inline-flex`) — corrigé, alignement **mesuré** à 239 px des deux côtés. |
