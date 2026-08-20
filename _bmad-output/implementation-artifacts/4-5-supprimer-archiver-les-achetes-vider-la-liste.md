---
baseline_commit: 452f308
---

<!-- Contextualisée le 2026-08-17, sur `452f308` — la tête de `main`. Les stories 4.1 à 4.4 sont
     `done` et fusionnées ; aucune branche de travail ne subsiste. Les dix mesures ci-dessous ont
     été EXÉCUTÉES sur le stack local, chacune en `begin … rollback`, pas déduites. -->

<!-- ⛔ **LA CHOSE À SAVOIR AVANT TOUT LE RESTE : `.delete()` NE RATE PAS, IL MENT.**
     Mesuré (M3) : un `DELETE` en rôle `authenticated` sur sa PROPRE ligne rend **`DELETE 0`** —
     zéro ligne, **aucune erreur**, et la ligne survit. La cause est mesurée en deux temps :
     le privilège de table `DELETE` **est accordé** à `authenticated` (M2), mais **aucune
     politique RLS `for delete` n'existe** (M1) — le volet 6 de la migration 4.1 s'intitule
     « la RLS, et le DELETE qui disparaît ». Postgres ne refuse pas : il ne voit aucune ligne.
     ⛔ **Côté client, PostgREST rendra donc `error: null`.** Un écran optimiste montrerait
     l'article disparu, et il **reviendrait au prochain chargement**, sans qu'aucune porte, aucun
     journal ni aucun message ne dise pourquoi. **Supprimer est un `UPDATE deleted_at`, jamais un
     `DELETE`.** -->

<!-- ⛔ **ET LE DÉFAUT QUE CETTE STORY CRÉE SI ELLE NE LE FERME PAS — MESURÉ (M7) :**
     10 pommes achetées → archivées → 4 pommes réajoutées la semaine suivante → la liste annonce
     **14**. `ajouter_article` (4.4) fait `quantity = ancienne + nouvelle` et rouvre le tombstone :
     la quantité d'une vie précédente se reporte sur la suivante. **Cette story est la PREMIÈRE à
     écrire des tombstones** — donc la première à rendre ce chemin atteignable, et c'est à elle de
     le fermer (D3). -->

<!-- ✅ **CE QUI EST DÉJÀ LÀ ET QU'IL NE FAUT PAS RÉINVENTER** : la colonne `deleted_at` et sa
     borne basse `grocery_list_items_tombstone_posterieur` (4.4), la vue qui exclut déjà les
     tombstones (`where g.deleted_at is null`), la politique `grocery_update` ancrée sur
     `current_household_id()`, le motif de confirmation en deux temps (`InviteCard`,
     `ListeRayons`), `useSoumission`, `Notice` (et son `reserve`), la mise à jour optimiste avec
     rollback (`ListeCourses.basculer`) et la relecture après écriture (`relire`). -->

# Story 4.5: Supprimer, archiver les achetés, vider la liste

Status: done

<!-- ✅ **FERMÉE LE 2026-08-20, après revue adversariale à trois couches.** 2 décisions tranchées
     par Florian et 14 correctifs appliqués et vérifiés ; 5 constats reportés vers les stories qui
     les possèdent (4.10, 4.11, 4.12), consignés dans `deferred-work.md`.
     ⛔ **CE QUI RESTE OUVERT ET DATÉ** : la décision `intent_at` (horloge client vs serveur,
     +0,740 s mesuré), à trancher AVANT la 4.10 — cette story l'a évitée, pas refermée. -->

<!-- ✅ **FUSIONNÉE le 2026-08-18** (PR #31, squash `fefa2ec`), les 4 contrôles verts.
     ⛔ **La requête de contrôle en PRODUCTION n'a PAS été exécutée** — décision de Florian,
     consignée en commentaire de la PR. ⛔ **Et la fusion n'a déclenché NI la CI NI le
     déploiement** : mesuré 3 h après, 0 run pour `fefa2ec`. ✅ **Résolu le 2026-08-19** — la
     fusion suivante (#32) a tout déclenché, et **la migration est appliquée en production**
     (journal de build : « [migrations] appliquées. »). ⚠️ La cause du premier raté reste
     INCONNUE. ✅ Et le build ayant passé, le volet 1 s'est validé contre les vraies lignes :
     `violeraient` valait bien 0 — preuve PAR L'APPLICATION, obtenue après coup. -->

<!-- ✅ **LE PARCOURS À L'ÉCRAN EST FAIT, AUX DEUX THÈMES, THÈME REMIS** (2026-08-17, sur une
     construction de PRODUCTION). Il a trouvé **trois défauts qu'aucune des six portes ne voyait**
     — dont un **cul-de-sac** hérité de la 4.4 que « Tout enlever » rendait atteignable — tous
     corrigés PUIS revérifiés à l'œil. NFR-3 mesuré à 390/360/320 px, pire cas compris.
     ⚠️ **Une note d'outillage à lire avant le prochain parcours** : les cookies ne distinguent pas
     les ports, et le diagnostic de la 4.4 (« c'était le serveur de développement ») était
     INCOMPLET. Détail en fin de section « Parcours à l'écran ». -->

<!-- ⚠️ **CE QUI CHANGE POUR LES STORIES SUIVANTES** : `.delete()` est désormais interdit sur
     `grocery_list_items` par un test qui FIGE son échec silencieux · la quantité d'un article
     tombstoné ne s'additionne plus (4.7 en dépend, elle ressuscite des lignes) · `deleted_at`
     est borné des DEUX côtés (4.10 arbitre dessus) · `bought` + tombstone signifie ARCHIVÉ, et
     ce couple ne doit pas être contraint. -->

<!-- ⛔ **TOUJOURS OUVERT, INCHANGÉ** : la décision `intent_at` (horloge client vs serveur,
     +0,740 s mesuré), à trancher AVANT la 4.10. D2(a) l'a ÉVITÉE pour les écritures de cette
     story — elle ne l'a pas refermée. -->


## Story

As a **membre du foyer**,
I want **retirer un article, archiver les achetés et vider la liste**,
so that **je gère la liste sans confondre « supprimer » et « cocher »**.

## Acceptance Criteria

**AC1 — Supprimer est distinct de cocher, et se fait par tombstone**

**Given** un article de la liste
**When** un membre le supprime
**Then** la suppression (tombstone `deleted_at`, AD-3) est **distincte du cochage** (FR-6) et
l'article disparaît de la liste vivante

**AC2 — Les achetés s'archivent d'un geste, sans cesser d'être traçables**

**Given** des articles achetés
**When** un membre les archive d'un geste
**Then** ils sont retirés de la liste active tout en restant traçables (FR-8)

**AC3 — Le vidage complet exige une confirmation, et n'efface rien**

**Given** une demande de vidage complet de la liste
**When** le membre la déclenche
**Then** une **confirmation** est exigée avant que la liste soit vidée (FR-8), sans DELETE dur

---

## Décisions ouvertes — chacune avec son défaut prescrit

> Le dev agent applique le **défaut prescrit** si Florian n'a pas tranché.

> ✅ **D1 TRANCHÉE PAR FLORIAN LE 2026-08-17, AVANT DÉMARRAGE — option (a).** Elle coïncide avec le
> défaut prescrit, mais elle est **choisie**, pas subie : `EXPERIENCE.md:104` est donc réécrit sur
> décision, et non contredit par omission. **Conséquence à ne pas rater** : `EXPERIENCE.md:104`
> doit être re-daté (règle §5), et le `<li>` de `LigneArticle` devient deux frères — un `<label>`
> qui garde le hit-target de bascule, et un `<button>` qui ne peut pas être son enfant.
>
> **D2 à D5 restent sur leur défaut prescrit**, faute d'arbitrage.

### D1 — Où le geste « supprimer » vit sur la ligne ⛔ **la plus structurante, et elle est nommée**

`ListeCourses.tsx:480-482` pose la question et la lui adresse, mot pour mot : « **UN SEUL élément
interactif par ligne.** Y ajouter un second (bouton de suppression, menu) casserait le hit-target
unique — la suppression est la story 4.5, **et elle devra trancher ce point plutôt que le
contourner**. » La source est `EXPERIENCE.md:104` : « tap n'importe où sur la ligne = bascule,
**un seul hit-target par ligne** ».

⚠️ **Et la maquette ne tranche pas.** Mesuré : `mockups/liste-et-dashboard.html` ne contient
**aucune** affordance de suppression — ses deux seuls `×` sont des multiplicateurs de quantité
(« ×3 », « ×2 »), et ses deux seuls `aria-label` sont celui de la ligne et celui du compteur.
C'est un silence de conception, pas une omission de lecture.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Un second contrôle en fin de ligne, **frère du `<label>` et non son enfant**, avec confirmation en deux temps | ⚠️ **Réécrit `EXPERIENCE.md:104`**, qui devient « un hit-target de bascule + un contrôle explicite ». À **DATER dans la story** (règle §5), jamais à contredire en silence. ⛔ **Le bouton ne peut PAS être dans le `<label>`** : un clic dessus basculerait AUSSI la case. Le `<li>` devient `<label class="flex-1">` + `<button>`, deux frères |
| (b) Un mode « Gérer » global qui échange la coche contre une suppression | ⛔ **Deux rendus de la même ligne qui peuvent diverger** — la famille de défaut que ce dépôt a payée deux fois (l'ordre du panier en 4.3, le ratio en 2.4). Et un mode est un état qu'il faut découvrir puis quitter, dans un magasin, à une main |
| (c) Balayage (swipe) | ⛔ **NFR-10** interdit une bibliothèque de geste, et un balayage écrit à la main est **inatteignable au clavier et au lecteur d'écran**. L'affordance est invisible : rien à l'écran ne dit qu'elle existe |

⚠️ **La confirmation en deux temps remplace le bouton, elle n'ouvre pas un panneau.** « Supprimer »
devient « Confirmer / Non » **sur place** : un panneau qui pousse ferait sauter les trente lignes
en dessous. Motif d'`InviteCard`, pas celui de `ListeRayons`.

### D2 — La forme de l'écriture : PostgREST direct ou fonction SQL

Les trois gestes sont des `UPDATE` de `deleted_at` (+ `intent_at`). **Mesuré (M8)** : l'archivage
en masse s'écrit en **un seul** `update … where status = 'bought' and deleted_at is null`, et la
RLS le borne au foyer de l'appelant sans le moindre filtre à la main — foyer B intact.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Trois fonctions SQL `security invoker` — `supprimer_article`, `archiver_les_achetes`, `vider_la_liste` | ✅ `now()` y est **l'horloge du SERVEUR**, la même qu'à l'insertion : le défaut `intent_at` **n'est pas élargi** à un troisième chemin d'écriture. C'est exactement l'argument de D1(a) de la 4.4. ✅ Les deux gestes de masse **rendent leur compte**, que l'écran doit annoncer. ⚠️ **`invoker`, JAMAIS `definer`** — c'est le trou de `seed_default_aisles`. ⚠️ Une migration est de toute façon due (D3, D4) : le surcoût est marginal |
| (b) `.update({ deleted_at, intent_at })` depuis le client | ⛔ **Élargit le défaut ouvert à un TROISIÈME chemin**, et sur le champ le plus exposé : `deleted_at` est précisément ce que la **4.10** arbitre. Écart mesuré client ↔ serveur : **+0,740 s**. Le suivi de sprint dit « à trancher AVANT la 4.10 » — creuser d'ici là est l'inverse |
| (c) Une Server Action | ⛔ **AD-13** : ni secret serveur, ni `revalidatePath` à faire. Le critère est la cause, pas l'analogie de vocabulaire |

⚠️ **D2(a) ne referme PAS la décision `intent_at` du projet.** Elle l'évite pour les écritures de
cette story. La décision reste ouverte et datée, et la 4.9 (horloge du geste) la rouvrira.

### D3 — La quantité au réajout d'un article archivé ⛔ **mesurée à 14**

**Mesuré (M7)** : `ajouter_article` fait `quantity = coalesce(ancienne,0) + coalesce(nouvelle,0)`
et rouvre le tombstone dans le même `do update`. Archiver ne libère **pas** la clé canonique —
l'index est TOTAL (mesuré en 4.4, M5/M6). Donc la quantité de la semaine dernière survit à
l'archivage et s'additionne à celle de la semaine suivante.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** `ajouter_article` **remet** la quantité à celle de l'ajout quand la ligne était tombstonée : `quantity = case when grocery_list_items.deleted_at is not null then excluded.quantity else coalesce(…) + coalesce(…) end` | ✅ Corrigé **à la source** : vaut pour toute surface d'ajout à venir (voix, pont, génération), pas seulement pour cet écran. ⚠️ **Modifie la fonction de la 4.4** par `create or replace` — donc sa requête de contrôle doit être **rejouée**, pas seulement écrite. ⚠️ Le raisonnement vaut aussi pour un tombstone de **suppression** : une quantité supprimée est morte, elle ne se cumule pas |
| (b) L'archivage remet `quantity` à `null` | ⛔ **Détruit la trace que l'AC2 exige** (« tout en restant traçables ») : on ne saurait plus combien a été acheté. Et ça ne couvre pas la suppression simple |
| (c) Ne rien faire | ⛔ **« 14 pommes » est mesuré.** Le membre ne peut ni le comprendre ni le corriger autrement qu'en supprimant la ligne |

### D4 — La borne haute de `deleted_at` — report daté de la 4.1, **adressé nommément à cette story**

**Mesuré (M5)** : `deleted_at = now() + 100 ans` est **accepté**. La borne basse existe
(`deleted_at >= created_at - 1 jour`, posée par la 4.4) ; la haute a été laissée en écrivant
« elle appartient à la 4.5 et à la 4.10 ».

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** `check (deleted_at is null or deleted_at <= now() + interval '1 day')` | ✅ **Symétrique de la borne basse**, et la tolérance d'un jour est **reprise de `grocery_list_items_intention_bornee`**, dont la raison écrite est le décalage d'horloge entre appareils. ✅ **Mesuré (M9) : `now()` est accepté dans un `check` sur ce schéma** — `grocery_list_items_intention_bornee` en contient un. Ce n'est donc pas une supposition |
| (b) Laisser à la 4.10 | ⚠️ Défendable : la 4.10 arbitre. ⛔ Mais un tombstone daté de 2999 gagnerait **tout** arbitrage LWW à jamais, et la fenêtre est encore bon marché |

⛔ **CE QU'IL NE FAUT PAS « CORRIGER » AU PASSAGE.** `deferred-work.md` signale que
« `(status, deleted_at)` n'est contraint par rien » et **mesuré (M6)** : une ligne peut être
`bought` **et** tombstonée. ⚠️ **C'est exactement ce qu'est un article archivé**, et c'est ce qui
rend l'AC2 traçable — `bought + deleted_at` se distingue de `pending + deleted_at`, qui est une
suppression pure. **Poser une contrainte d'exclusion ici casserait l'AC2.** Le report est donc
*résolu par une décision*, pas par une contrainte : à écrire dans la migration.

### D5 — La microcopy des deux gestes globaux ⚠️ **deux libellés dangereusement voisins**

`EXPERIENCE.md:134` donne le premier **verbatim** : « **Vider le panier** : archiver les achetés
d'un geste, avec confirmation (FR-8) ». FR-8 nomme le second « la liste entièrement vidée ».
⛔ **« Vider le panier » et « Vider la liste » se ressemblent trop** pour deux gestes dont l'un
retire ce qui est pris et l'autre retire tout, y compris ce qui ne l'est pas.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** « **Vider le panier** » (source verbatim) et « **Tout enlever** » | ⚠️ « Tout enlever » est une chaîne **INVENTÉE**, comme « Tout est dans le panier. » l'a été en 4.3 — **à signaler en revue**, écrit plutôt qu'esquivé. Elle évite « effacer » et « supprimer », qui promettraient une destruction que le tombstone ne fait pas |
| (b) « Vider le panier » et « Vider la liste » | ⛔ Deux libellés voisins pour deux portées différentes, sur l'écran qu'on lit à une main dans un magasin |

⚠️ **Les phrases de confirmation tutoient, les libellés non** (project-context) — et ⛔ **jamais
« Réessaie »** : rien ici n'est transitoire. Proposées : « Les articles pris sortent de ta liste.
Tu peux les rajouter. » et « Tout part, même ce qui n'est pas encore pris. »

⚠️ **Chaque geste global ne se montre que s'il a une cible** — « Vider le panier » quand au moins
un article est acheté, « Tout enlever » quand la liste n'est pas vide. Un bouton qui ne peut rien
faire est un bouton qui ment. *(L'arête de `/rayons` — un bouton devenu inatteignable — ne se
reproduit pas ici : le bouton revient dès qu'un article est coché.)*

---

## Ce qui a été MESURÉ pour cette story

*Stack local, `452f308`, chaque sonde en `begin … rollback`, en rôle `authenticated` avec le claim
d'un profil réel. Commandes exécutées, pas déduites.*

| # | Mesure | Résultat |
|---|---|---|
| **M1** | Politiques de `grocery_list_items` | `grocery_select` · `grocery_insert` · `grocery_update`. ⛔ **Aucune `for delete`** |
| **M2** | Privilèges de table de `authenticated` | `SELECT, INSERT, UPDATE, **DELETE**, TRUNCATE, REFERENCES, TRIGGER` — le DELETE **est** accordé |
| **M3** | `delete from grocery_list_items where …` sur sa propre ligne | ⛔ **`DELETE 0`, aucune erreur, la ligne survit.** L'échec est SILENCIEUX |
| **M4** | `update … set deleted_at = now()` | ✅ **1 en table, 0 dans la vue** — le tombstone marche, et la vue l'exclut déjà |
| **M5** | `deleted_at = now() + 100 ans` | ⚠️ **ACCEPTÉ** — aucune borne haute (D4) |
| **M6** | `status = 'bought'` **et** `deleted_at` non nul | ⚠️ **ACCEPTÉ** — et c'est ce qu'est un archivé (voir D4) |
| **M7** | 10 achetées → archivées → réajout de 4 | ⛔ **quantité = 14**, `pending`, tombstone levé. **Le défaut central de cette story** (D3) |
| **M8** | Archivage en masse `where status='bought'` | ✅ **`UPDATE 2`** — les 2 achetés du foyer A, le `pending` intact, **foyer B jamais touché ni même visible** |
| **M9** | Contraintes `check` de la table | 9, dont `grocery_list_items_intention_bornee` = `intent_at <= now() + '1 day'` → ✅ **`now()` est accepté dans un `check`** |
| **M10** | Portes au point de départ | `npm test` **266/266** · isolation **111 · 110 pass · 0 fail · 1 skipped** · `check:migrations` **18/16/2/0** |

---

## Tasks / Subtasks

- [x] **Task 1 — La migration** (AC: 1, 2, 3) · *dépend de D2, D3, D4*
  - [x] Requête de contrôle en en-tête, et ⚠️ **elle inclut le rejeu du contrôle de la 4.4** : `create or replace` sur `ajouter_article` refait sa promesse, il faut la remesurer
  - [x] `supprimer_article(p_id uuid)` · `archiver_les_achetes()` · `vider_la_liste()`, en **`security invoker`**
  - [x] Les deux gestes de masse **rendent le nombre de lignes touchées** (`get diagnostics … row_count`) — l'écran l'annonce
  - [x] ⛔ **Aucune politique `for delete` n'est créée** : le DELETE dur doit rester impossible (M1/M3), c'est le volet 6 de la 4.1 et il est délibéré
  - [x] `ajouter_article` : la quantité **repart de zéro** quand la ligne était tombstonée (D3)
  - [x] `check (deleted_at is null or deleted_at <= now() + interval '1 day')` (D4)
  - [x] ⛔ **Ne PAS contraindre `(status, deleted_at)`** — `bought` + tombstone **est** l'archivage (D4). L'écrire dans la migration pour qu'une revue ne le « répare » pas
  - [x] ⚠️ **`grant execute` explicite** sur les trois fonctions — `20260729094500` a montré qu'on ne suppose pas les privilèges

- [x] **Task 2 — Le pur, côté `lib/`** (AC: 1, 2, 3)
  - [x] `lib/liste/suppression.ts` : `supprimerArticle`, `archiverLesAchetes`, `viderLaListe` — ⚠️ **client EN PARAMÈTRE**, motif d'`articlesDuFoyer`, `basculerStatut` et `ajouterArticle` (c'est ce qui les rend exerçables en isolation et appelables par l'Epic 5 / l'Epic 7)
  - [x] Les deux gestes de masse **rendent leur compte** au lieu de `void`
  - [x] Toute règle d'affichage (accord de « article/articles », phrase du compte-rendu) descend **ici** et est **exportée + mesurée** — leçon de « 2 pièce » et de `comparerGroupes`
  - [ ] ~~Erreur métier : **SQLSTATE d'abord**, texte en repli (`lib/foyer/erreurs.ts`)~~ — **NON FAIT, et c'est une décision, pas un oubli.** Aucun SQLSTATE distinctif n'est atteignable par ces trois gestes : le seul refus métier possible est `P0001` (« Aucun foyer »), qui signifie session perdue et non erreur de saisie. Les trois autres refus concevables — RLS, article disparu, double suppression — **rendent 0 ligne sans erreur** (mesuré), donc il n'y a rien à traduire. Ajouter une table de correspondance vide serait un motif copié sans sa cause

- [x] **Task 3 — L'écran** (AC: 1, 2, 3) · *dépend de D1, D5*
  - [x] `LigneArticle` restructurée : `<label class="flex-1">` et `<button>` **frères**, jamais imbriqués (D1)
  - [x] Confirmation en deux temps **sur place**, motif d'`InviteCard` ; cible tactile **44 px** (`min-h-touch`)
  - [x] ⛔ **`btn-quiet`, jamais `btn-action`** : UX-DR2 énumère les emplois légitimes de l'abricot, et un geste destructif n'en est pas. L'abricot veut dire « ça concerne tes courses », jamais « attention » — ⚠️ **et une classe `.btn-ligne` a dû naître** : `btn-quiet` est souligné, et trente soulignés au fil de la liste concurrenceraient le geste principal. Ni abricot ni souligné, 44 px conservés
  - [x] Les deux gestes globaux **en bas de la liste** (le geste de fin de courses), conditionnés à leur cible (D5)
  - [x] Mise à jour **optimiste avec rollback** (motif de `basculer`, 4.3) : l'issue visuelle est connue d'avance, contrairement à l'ajout. ⚠️ Le rollback d'un geste de masse rétablit **le tableau précédent**, pas un article
  - [x] ⚠️ **Une région de statut PAR zone d'action**, pas une seule en tête de page — défaut trouvé deux fois sur `/rayons`. `reserve` sur le `Notice` qui **surplombe** une cible
  - [x] Le compte-rendu annonce ce qui a été fait (« 3 articles rangés »), jamais un message technique — ⚠️ **et son compte vient du SERVEUR**, pas de l'optimisme : si l'autre membre a déjà archivé, la fonction rend moins que ce que l'écran a retiré, et c'est ce chiffre-là qui est vrai

- [x] **Task 4 — Les tests**
  - [x] `lib/` : l'accord du compte-rendu, les bornes des règles pures — **+5 tests**, banc de mutations **3/3 tués**
  - [x] **Isolation** : la suppression pose un tombstone et **ne DELETE pas** · ⛔ **un `DELETE` dur rend 0 ligne** (fige M3 comme voulu) · l'archivage n'emporte **que** les achetés · le vidage emporte les deux statuts · **le réajout après archivage rend la quantité de l'ajout, pas la somme** (D3, fige M7) · la borne haute refuse un tombstone futur (D4) · un membre d'un autre foyer ne peut rien supprimer, archiver ni vider — **+10 tests**
  - [x] ⚠️ **Préfixe UNIQUE par test** (`zz45supp-`, `zz45arch-`…) — le préfixe partagé a coûté un défaut en revue de la 4.2
  - [x] ⚠️ Placer les tests **avant** celui de la génération, qui segfaute et reste `test.skip`
  - [x] ⛔ La garde CI ne tolère **qu'un seul** test sauté, nommé en dur — aucun `skip` neuf
  - [x] ⛔ **Un test PRÉEXISTANT de la 4.4 a dû changer d'assertion** (`zztomb-riz` : 3 → 2). Il figeait la somme à travers le tombstone ; D3 la supprime. **Mis à jour avec sa raison datée, jamais effacé** — et sa raison d'être (le tombstone se rouvre, pas de `23505`) est intacte

- [x] **Task 5 — Les portes, puis le parcours à l'écran**
  - [x] `typecheck` · `lint` · `test` · `test:isolation` · `check:migrations` · `build`
  - [x] `lib/supabase/types.ts` régénéré (**3 fonctions neuves**) avec la commande épinglée — ⚠️ **et le diff n'est PAS purement additif, ce qui est écrit plutôt qu'esquivé** : il **retire** le bloc `graphql_public` (28 lignes) que la 4.4 avait introduit en régénérant avec une CLI plus récente. `deferred-work.md` disait nommément que ce bloc « entrerait dans le contrat PostgREST que la story 4.12 doit geler sans qu'aucune story l'ait décidé ». Le retrait le referme. **Mesuré** : aucun fichier `.ts`/`.tsx` du dépôt ne référence `graphql_public`
  - [x] Sonde CSS : `.btn-ligne` 3 · `.ligne-bascule` 1 · `.ligne-article` 1 · **5 contrôles négatifs à 0** · ⚠️ **4 témoins positifs non nuls** — la première sonde lisait un fichier VIDE et rendait donc « 0 » partout, y compris sur ses contrôles négatifs ; le témoin positif est ce qui distingue une sonde vertueuse d'une sonde muette
  - [x] ⛔ **Parcours à l'œil, aux DEUX réglages système, thème remis après** — FAIT le 2026-08-17, sur une construction de PRODUCTION. Il a trouvé **deux défauts qu'aucune des six portes ne voyait** (plus un troisième, mineur), tous corrigés **puis revérifiés à l'œil**. NFR-3 mesuré à 390/360/320 px, confirmation armée et nom de 200 caractères compris. Détail à la section « Parcours à l'écran »
  - [x] Fermer le `Status` du fichier **et** `sprint-status.yaml` (§6 bis)

### Review Findings — revue adversariale du 2026-08-19

> Trois couches lancées en parallèle, sans contexte de conversation : Blind Hunter, Edge Case
> Hunter, Acceptance Auditor. ⚠️ **Revue par le même modèle que l'implémentation** — la règle §6 du
> dépôt recommande un autre LLM. Les convergences entre couches indépendantes sont donc le signal
> le plus fiable de cette passe, et elles sont notées.

#### Décisions à trancher

- [x] **[Review][Decision] Les trois fonctions ne portent aucun filtre de foyer — un appelant dont la RLS est contournée balaie TOUTES les listes** — `20260817160000_….sql:157,184,212`. ⛔ **Trouvé indépendamment par deux couches, et reproduit une troisième fois pendant le triage.** Mesuré : en rôle `service_role` avec un JWT du foyer `989a39e5` (1 article), `vider_la_liste()` rend **11** et vide le foyer `fa5eac28`, qui n'est pas le sien. La seule garde est `current_household_id() is null → raise`, qui passe dès qu'un `sub` est connu, **quel que soit le rôle Postgres**. ⚠️ **Atteignabilité mesurée aujourd'hui : nulle** — `grep -rn "SERVICE_ROLE" app lib proxy.ts` ne rend rien, et AD-2 interdit la clé de service côté application. ⛔ **Mais c'est une mine posée** : le `comment on function` promet « du foyer courant » (faux sous un rôle qui contourne), et `lib/liste/suppression.ts:36` annonce ces fonctions comme « appelable telle quelle par le dashboard (Epic 5) et le serveur MCP (Epic 7) » — précisément les surfaces qui portent une clé de service. **Options** : (a) ajouter `and household_id = v_foyer` aux trois `where` — le foyer est déjà calculé, c'est du SQL serveur et non un contrôle applicatif, donc AD-1/AD-2 ne s'y opposent pas, contrairement à ce que l'en-tête de la migration affirme ; (b) `revoke execute … from service_role` ; (c) ne rien changer et écrire l'interdit dans `project-context.md`. ⚠️ Toute correction exige une **migration neuve** — une migration appliquée ne se retouche pas.
- [x] **[Review][Decision] `lib/supabase/types.ts` est retouché à la main alors que la doc le dit généré** — `lib/supabase/types.ts:9,787`. Trouvé par les trois couches. Mesuré : `npx supabase gen types typescript --local` réémet le bloc `graphql_public` et son entrée `Constants` (28 lignes de diff), parce que `supabase/config.toml:13` expose toujours `["public","graphql_public"]`. Or `docs/configuration.md:193` écrit « généré […] et non plus écrit à la main ». **Options** : (a) restaurer le bloc et régénérer à la commande nue ; (b) retirer `graphql_public` de `config.toml` pour que la génération et le contrat s'accordent ; (c) poser un script `gen:types` portant la commande épinglée. *(C'est le point n°2 déjà signalé dans la PR #31.)*

#### Correctifs

- [x] [Review][Patch] La confirmation d'un geste global survit à la disparition de son bouton, et remonte **déjà armée** — un seul tap suffit alors [`app/courses/GestesDeListe.tsx:53,75`]
- [x] [Review][Patch] Plusieurs lignes peuvent rester armées ; « Confirmer » occupe la position exacte de « Retirer », donc un retour sur une ligne armée supprime au premier tap [`app/courses/ListeCourses.tsx:658`]
- [x] [Review][Patch] « Un instant… » est injoignable : `setAConfirmer(null)` précède l'appel, donc aucun retour visible pendant l'écriture [`app/courses/GestesDeListe.tsx:199`]
- [x] [Review][Patch] La ligne n'a **pas** de région de statut : ses deux messages s'écrivent sous les trente articles, hors champ — la règle que la story pose elle-même en Task 3 [`app/courses/ListeCourses.tsx:292,302`]
- [x] [Review][Patch] WCAG 2.5.3 « Label in Name » violé sur les deux boutons « Non » — deux lignes sous le commentaire qui invoque cette règle [`app/courses/ListeCourses.tsx:767`, `app/courses/GestesDeListe.tsx:205`]
- [x] [Review][Patch] L'explication de confirmation est annoncée **deux fois** au lecteur d'écran, et la chaîne est écrite quatre fois pour deux phrases [`app/courses/GestesDeListe.tsx:139,210`]
- [x] [Review][Patch] Le compte rendu survit à la reconstitution de la liste : « 11 articles retirés. » reste affiché au-dessus d'articles neufs [`app/courses/ListeCourses.tsx:530`]
- [x] [Review][Patch] « Ta liste est vide. » s'affiche pendant un vidage **en vol** — l'affirmation avant acquittement que l'en-tête du fichier interdit [`app/courses/ListeCourses.tsx:404`]
- [x] [Review][Patch] Le focus clavier retombe sur `<body>` à chaque armement ; le motif source (`ListeRayons.tsx:223`) porte le mécanisme, il n'a pas été repris [`app/courses/ListeCourses.tsx:784`]
- [x] [Review][Patch] `.btn-ligne:disabled` est mathématiquement invisible : `saturate(0.6)` déplace l'encre de 3 unités sur 255 [`app/globals.css:648`]
- [x] [Review][Patch] `EXPERIENCE.md:104` n'a **pas** été réécrit — D1 exigeait de le DATER, pas de le contredire dans un commentaire de CSS. `EXPERIENCE.md:142` et `DESIGN.md:279,298` disent la même chose et sont aussi contredits [`EXPERIENCE.md:104`]
- [x] [Review][Patch] La story affirme que la contrainte « n'est évaluée qu'à l'écriture » — **faux** : un `ADD CONSTRAINT … CHECK` sans `NOT VALID` scanne les lignes existantes, ce que l'en-tête de la migration dit correctement deux paragraphes plus loin [story, D4]
- [x] [Review][Patch] Trois trous de couverture : aucun test n'exerce les RPC en rôle contournant la RLS, ne fige le `P0001` sans session, ni ne vérifie qu'un tombstone à +2 min est **accepté** (la tolérance que la migration argumente sur un paragraphe entier) [`supabase/tests/isolation.test.ts`]
- [x] [Review][Patch] Indentation JSX cassée sur ~45 lignes ; aucune porte ne le voit (ni Prettier ni règle de format en CI) [`app/courses/ListeCourses.tsx:405-511`]

#### Ce que la passe de correction a produit — 2026-08-20

**Les 2 décisions tranchées par Florian et les 14 correctifs sont appliqués.** Portes rejouées :
`npm test` **271/271** · isolation **124 · 123 pass · 0 fail · 1 skipped** (+3) · typecheck · lint ·
`check:migrations` **20/18/2/0** · build 14 routes.

✅ **Les deux décisions sont PROUVÉES, pas seulement appliquées :**

| Décision | Preuve exécutée |
|---|---|
| **D-1** — filtre de foyer | Contrôle n°2 de la migration neuve : en `service_role` avec le JWT du foyer A (1 article), `vider_la_liste()` rend **1** et **les 3 articles du foyer B restent vivants**. Avant : rendait 11 et vidait B |
| **D-2** — `graphql_public` | `npx supabase gen types typescript --local \| diff - lib/supabase/types.ts` → **0 ligne**. La commande documentée nue reproduit désormais le fichier du dépôt |

⛔ **ET CE SECOND PARCOURS À L'ŒIL A TROUVÉ DEUX DÉFAUTS DE PLUS — dans mes propres correctifs.**
Les deux passaient les six portes.

1. **La zone de statut de ligne a cassé la mise en page.** Je l'avais posée en `<Notice
   className="basis-full">` **dans** le `<li className="ligne-article">`, qui est un flex sans
   `flex-wrap` : un troisième enfant y a écrasé la colonne du nom, et **les libellés se rendaient
   une lettre par ligne**. ⛔ Typecheck, lint, 271 tests, 123 tests d'isolation, build et sonde CSS
   étaient tous verts. Le rang est désormais un `<div>` dans le `<li>`, le message vit dessous.
2. **Le message de ligne n'apparaissait sur aucun chemin réussi.** Mesuré : sur « il n'était déjà
   plus là », la ligne est retirée **optimistement**, donc sa zone de statut part avec elle. Les
   deux cas ne se ressemblent pas et sont maintenant routés séparément — **échec** → la ligne
   revient, le message se pose dessus ; **succès sans effet** → la ligne est légitimement partie,
   le message va sous la liste.

✅ **Vérifié à l'écran, aux deux thèmes, thème remis :**

| Vérifié | Résultat |
|---|---|
| Une seule ligne armée | ✅ armer une seconde ligne **désarme** la première (`nbConfirmer: 1`) |
| Focus clavier | ✅ armer déplace le focus sur « Confirmer » (`activeElement` mesuré) — il retombait sur `<body>` |
| ⛔ **Message de ligne, chemin d'échec** | ✅ **provoqué pour de vrai** (`revoke execute`) : la ligne « Pommes » revient et le message s'affiche **dans cette ligne**, plus sous les trente autres |
| « Non » et WCAG 2.5.3 | ✅ `aria-label` = « Non — garder Salade dans la liste » |
| État inerte visible | ✅ l'encre passe de `rgb(174,182,201)` à `rgb(137,144,165)` — **38 unités sur 255**, contre 3 avant |
| Contraste de `.btn-ligne` | ✅ **8,059:1** en sombre (fond recomposé `#261d23`), inchangé |
| NFR-3 | ✅ **0 débordement** à 390 / 360 / 320 px avec la nouvelle structure |

⚠️ **« Un instant… » n'a PAS pu être capté** : en local l'écriture rend en quelques millisecondes,
et six relevés à 60 ms ne l'ont pas vu passer. Le chemin est corrigé et lisible dans le code — le
geste reste armé pendant l'attente — mais **je ne l'ai pas observé**, et je l'écris plutôt que de
le supposer.

#### Reportés

- [x] [Review][Defer] `basculerStatut` n'exclut pas les lignes tombstonées ; cocher un article retiré ailleurs rend `UPDATE 1` sans erreur et écrase `intent_at` [`lib/liste/basculer.ts`] — reporté, code de la 4.3 rendu atteignable par la 4.5, l'arbitrage appartient à la **4.10**
- [x] [Review][Defer] Le rollback d'un geste de masse écrase un ajout ou une coche concurrents [`app/courses/ListeCourses.tsx:265,285`] — reporté, la réconciliation est la **4.11**
- [x] [Review][Defer] Aucune relecture après un geste de masse : le compte annoncé peut dépasser ce qui a disparu de l'écran [`app/courses/ListeCourses.tsx:306`] — reporté, **4.11**
- [x] [Review][Defer] La borne haute laisse une fenêtre de 24 h dans laquelle un tombstone gagne tout arbitrage LWW [`20260817160000_….sql:111`] — reporté, **4.10**
- [x] [Review][Defer] `revoke all … from public` ne retire rien : les privilèges par défaut de `20260729094500` réaccordent `execute` nominativement à `anon` et `service_role` [`20260817160000_….sql:221`] — reporté, pré-existant, et c'est le mécanisme sous-jacent de la décision D-1

---

## Dev Notes

### Les pièges, dans l'ordre où ils mordent

**Piège n°1 — Écrire `.delete()`.** Il rend `error: null` et ne supprime rien (M1/M2/M3). Avec une
mise à jour optimiste, l'article disparaît de l'écran et **revient au chargement suivant** : un
défaut que ni les tests, ni la console, ni le membre ne savent expliquer. Supprimer est un
`UPDATE deleted_at`.

**Piège n°2 — Archiver en cochant, ou l'inverse.** FR-6 exige que les deux soient distincts.
`status` dit *ce qui est dans le caddie* ; `deleted_at` dit *ce qui n'est plus de cette liste*.
Un archivé porte **les deux**, et c'est ce qui le rend traçable (M6).

**Piège n°3 — Croire que l'archivage libère la clé canonique.** L'index est **TOTAL** : un
tombstone occupe la clé (mesuré en 4.4). C'est pour ça qu'un réajout est un `UPDATE` — et c'est
pour ça que la quantité se reporte si D3 n'est pas appliquée (M7).

**Piège n°4 — Mettre le bouton de suppression dans le `<label>`.** Le clic basculerait **aussi**
la case. Deux frères, pas une imbrication (D1).

**Piège n°5 — L'abricot sur un geste destructif.** UX-DR2 l'énumère et n'y met pas la suppression.
`btn-quiet`. Et rien de rouge : la palette Tailwind est neutralisée, `bg-red-500` **ne rend rien,
en silence**.

**Piège n°6 — Un seul `Notice` en tête d'écran.** Trois zones d'action désormais : la ligne, et
les deux gestes globaux en bas. Un message affiché en haut d'une liste de trente articles est
**hors écran** au moment où il est écrit — défaut trouvé deux fois sur `/rayons`.

**Piège n°7 — `security definer` par réflexe.** Elle traverse la RLS et devrait donc recontrôler
l'identité elle-même : c'est le trou de `seed_default_aisles`. `invoker` laisse la RLS faire son
travail, et la RLS suffit — mesuré (M8), l'archivage en masse ne voit déjà que son foyer.

**Piège n°8 — S'inspirer de `generate_grocery_list_from_menu`.** Elle fait **segfauter
PostgreSQL** (un crash par appel, mesuré) et son `delete … where status = 'pending'` est
exactement ce que le modèle canonique a retiré. C'est le contre-exemple, pas le motif.

**Piège n°9 — Inventer une annulation.** Il n'y en a pas au périmètre, et le tombstone n'en est
pas une : réajouter un article supprimé **rouvre la ligne**, mais rien à l'écran ne le propose.
La confirmation en deux temps est ce qui tient lieu de filet (D1).

### Ce que cette story rend visible et qu'il ne faut pas prendre pour un défaut

- **Une carte-rayon disparaît quand tous ses articles sont archivés.** Le ratio passe de `3/3` à
  plus rien — c'est le but de l'archivage, pas une régression du compteur de la 4.2/4.3.
- **Après un vidage, « Ta liste est vide. » est l'état juste.** Il existe déjà. ⚠️ Ne pas
  réutiliser « Tout est dans le panier. », qui dit l'inverse (des articles, tous achetés).
- **Le gros compteur reste monté à zéro** — le retirer ferait sauter la mise en page et priverait
  le lecteur d'écran de l'annonce du passage à zéro.

### Frontières — ce que cette story ne fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| La provenance sur la ligne | **4.6** |
| La génération non destructive, et le segfault de sa RPC | **4.7** |
| La consultation hors ligne | **4.8** |
| L'outbox, l'horloge du geste | **4.9** |
| L'arbitrage LWW entre `deleted_at` et les autres champs | **4.10** |
| La propagation temps réel | **4.11** |
| Le plancher d'accessibilité de la liste (contrastes, focus, zoom 200 %) | **4.13** |
| La pastille « arrive… » | **4.14** |
| L'arrondi des quantités mises à l'échelle | **4.7** |
| Supprimer depuis le dashboard (FR-26) | **Epic 5** |
| La décision `intent_at` du projet (horloge client vs serveur) | **à trancher avant la 4.10** |

### Fichiers à toucher

```
supabase/migrations/<neuve>.sql       NEW   3 fonctions + borne haute + correctif D3 d'ajouter_article
lib/liste/suppression.ts              NEW   supprimerArticle, archiverLesAchetes, viderLaListe
lib/liste/suppression.test.ts         NEW
app/courses/ListeCourses.tsx          UPD   LigneArticle restructurée (D1) + gestes globaux (D5)
lib/supabase/types.ts                 UPD   régénéré — 3 fonctions neuves
supabase/tests/isolation.test.ts      UPD   tombstone, DELETE nul, archivage, vidage, réajout, inter-foyers
```

⚠️ **`ListeCourses.tsx` fait 648 lignes et porte trois états dont chacun est né d'un défaut de
revue.** Lire son en-tête et l'encadré de l'état **avant** d'y toucher : `articles` reste `null`
en cas d'échec (un état vide se mérite), l'état garde la liste **à plat dans l'ordre de la base**
(le correctif du panier du 2026-08-13), et le regroupement est **dérivé**, jamais stocké.

### Ce que les stories 4.2 à 4.4 lèguent

- **`relire()` existe déjà** (extraite par la 4.4) : la relecture après écriture est un motif
  acquis, et ce n'est **pas** le « reload manuel » qu'AD-8 proscrit. ⚠️ Mais ici l'issue est
  connue d'avance — préférer l'optimiste avec rollback, comme la coche.
- **`versArticle` écarte une ligne avec un `console.warn`** plutôt qu'en silence. Tout nouveau
  chemin d'écart suit la même règle : le membre voit une phrase, le développeur voit la cause.
- **`comparerGroupes` et `trierPanierEnBas` sont exportées et mesurées.** Toute règle pure neuve
  suit ce principe — jamais « correcte par construction ».
- **La revue de la 4.4 a payé une signature SUPPOSÉE** (`resolve_aisle_id`, quatre arguments et
  non deux) alors que sa propre requête de contrôle existait pour ça. ⛔ **Exécuter les requêtes
  de contrôle AVANT d'écrire la fonction**, pas après.

### Standards de test

- `node --test` natif, aucun harnais de composants (NFR-10) → **toute règle testable descend dans
  `lib/`**.
- Un invariant entre deux fichiers **se mesure** (§4), il ne s'affirme pas.
- Les tests d'isolation passent par `a.client` / `b.client`, **jamais `admin`** (AD-17).
- ⚠️ **`node --test` sur un glob vide rend 0** : tout contrôle neuf doit répondre à « que se
  passe-t-il s'il ne trouve rien ? ».

### Project Structure Notes

`lib/liste/` est le module posé par la 4.2 et étendu par la 4.3 puis la 4.4 ; cette story l'étend
encore sans le réorganiser. Une migration est due — la **troisième** de l'Epic 4. Elle porte sa
requête de contrôle en en-tête, s'applique **au déploiement** (`vercel.json` →
`scripts/migrer-au-deploiement.mjs`), et `db reset` reste l'outil normal en local, interdit sur le
distant. ⚠️ **`supabase gen types` s'emploie avec `--local`**, jamais `--linked` : le distant n'a
pas encore la migration au moment où l'on génère.

⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION**, et cet écran **supprime**.
Le parcours à l'écran se fait sur le **stack local**, jamais sur la prévisualisation.

### References

- [Source: `epics.md#Story 4.5`] — story, AC1 à AC3
- [Source: `prd.md#FR-6, FR-8, FR-3, FR-26`] — suppression distincte, archivage et vidage avec confirmation
- [Source: `ARCHITECTURE-SPINE.md#AD-3`] — **tombstone, jamais de DELETE dur ; LWW par champ**
- [Source: `ARCHITECTURE-SPINE.md#AD-1, AD-2, AD-6, AD-8, AD-13, AD-17`]
- [Source: `EXPERIENCE.md:104`] — un seul hit-target par ligne (**réécrit par D1**)
- [Source: `EXPERIENCE.md:134`] — « Vider le panier : archiver les achetés d'un geste, avec confirmation »
- [Source: `EXPERIENCE.md:122`] — supprimer un article coché ailleurs n'est jamais une erreur (NFR-2)
- [Source: `DESIGN.md:283`] — le séparateur « Dans le panier »
- [Source: `20260805092611_…sql` volet 6] — **la RLS, et le DELETE qui disparaît**
- [Source: `20260813210000_…sql`] — la vue exclut les tombstones, délibérément
- [Source: `20260816180000_…sql`] — `ajouter_article`, borne basse du tombstone, `quantity >= 0`
- [Source: `deferred-work.md`] — borne de `deleted_at`, `(status, deleted_at)`, articles achetés
- [Source: `app/courses/ListeCourses.tsx:480-482`] — **la question de D1, posée et adressée ici**
- [Source: `_bmad-output/project-context.md`]

### Intelligence git — ce que les derniers commits enseignent

| Commit | Ce qu'il apprend à cette story |
|---|---|
| `452f308` docs(4-4) | La dette ouverte est récapitulée : `intent_at` **reste à trancher avant la 4.10**, et cette story écrit `deleted_at`, que la 4.10 arbitre. D'où D2(a) |
| `1a4bf87` feat(4-4) | Le motif de la fonction SQL `security invoker`, son `grant execute` explicite, et la leçon de la signature supposée. ⛔ C'est aussi le commit qui **crée** le défaut de quantité que D3 ferme |
| `fc20e81` feat(4-3) | La valeur posée plutôt que le basculement relatif, l'optimiste avec **rollback**, et l'élargissement de la vue aux achetés — sans quoi l'AC2 n'aurait rien à archiver |
| `0f4ee0e` (4.2) | Les trois états de lecture, le `catch` lié, et la reddition de comptes : chiffres rejoués, File List relevée depuis `git diff` |

### Latest tech — rien à rafraîchir

Aucune dépendance nouvelle (NFR-10), aucune API externe, aucune bibliothèque de geste. PostgreSQL
**17.6** en local comme en production. ⚠️ **`now()` dans un `check` est accepté et déjà employé**
sur cette table (M9) — ce n'est pas une supposition.

⛔ **CETTE PHRASE DISAIT ENSUITE « la contrainte n'est évaluée qu'à l'écriture : elle ne réécrit
pas les lignes existantes, ce qui la rend sûre ici ». C'EST FAUX**, et la revue du 2026-08-19 l'a
relevé. Un `alter table … add constraint … check` **sans `not valid`** SCANNE les lignes
existantes : une seule en violation fait échouer la migration, donc le déploiement. L'en-tête de
la migration le dit correctement deux paragraphes plus loin (« `violeraient` DOIT valoir 0, sinon
le volet 1 échoue et le déploiement s'arrête ») — c'est bien cette ligne-ci qui affirmait
l'inverse, et elle servait d'argument de sûreté.

✅ **Ce qui reste vrai** : la contrainte est passée en production le 2026-08-19, donc aucune ligne
ne la violait. Mais c'est une preuve **par l'application**, obtenue après coup — pas la garantie
*a priori* que cette phrase prétendait donner.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (`dev-story`, 2026-08-17)

### Debug Log References

| Commande | Résultat |
|---|---|
| `npm test` | **271 / 271**, `fail 0` — 266 avant (**+5**) |
| `npm run test:isolation` | **121 tests · 120 pass · 0 fail · 1 skipped** — 111 avant (**+10**) |
| `npm run typecheck` · `npm run lint` | verts (`--max-warnings 0`) |
| `npm run check:migrations` | **19 / 17 avec requête de contrôle / 2 exemptées / 0 sans** |
| `npm run build` | réussi — **14 routes**, aucune route neuve |
| **Contrôle n°3 de l'en-tête, EXÉCUTÉ** | 10 archivées + 4 réajoutées → **quantité 4**, `pending`, tombstone levé *(14 avant correctif)* |
| **Contrôle n°4 de l'en-tête, EXÉCUTÉ** | l'agrégation normale tient toujours : `ajouter_article` ×2 → **1 ligne, quantité 3** |
| **Borne haute (D4)** | `deleted_at = now() + 100 ans` → **`23514`** refusé |
| **Idempotence** | `supprimer_article` deux fois → **1 puis 0**, `status` resté `pending` |
| **Acheté mais VIVANT** | 6 + 4 → **10** — le correctif D3 ne déborde pas de son cas |
| **Banc de mutations** (`lib/liste/suppression.ts`) | **3 mutants sur 3 tués** (accord du pluriel · phrase du zéro · « retiré » → « effacé ») |
| **Sonde CSS** | 3 classes neuves émises · 5 contrôles négatifs à 0 · **4 témoins positifs non nuls** |
| **Parcours à l'écran** | ✅ **FAIT, aux deux thèmes** — 3 défauts trouvés puis corrigés et revérifiés. Détail plus bas |
| **Contraste `.btn-ligne`** | **5,713:1** clair · **8,059:1** sombre (fond recomposé `#261d23`) · cible **44 px** |
| **NFR-3** | **0 débordement** à 390 / 360 / 320 px, confirmation armée et nom de 200 caractères compris |

⛔ **TROIS DÉFAUTS QUE J'AI INTRODUITS PUIS CORRIGÉS, CONSIGNÉS PLUTÔT QU'EFFACÉS.**

1. **`String.replace` a mangé les `$$` de la fonction SQL.** J'extrais le corps d'`ajouter_article`
   par script pour préserver les échappements `\uXXXX` (piège n°4 de la 4.4) — mais en JS, `$$`
   dans une chaîne de REMPLACEMENT signifie un `$` littéral. La migration est sortie avec `as $`
   et a échoué au `db reset`. ⚠️ **Le piège est le voisin exact de celui que la 4.4 avait payé** :
   elle avait perdu ses `\u`, j'ai perdu mes `$`. Corrigé avec un remplaçant **fonction**, qui
   neutralise toute interprétation.
2. **Deux de mes tests d'isolation supposaient être seuls au monde.** Ils attendaient un compte
   exact (`archives === 1`) et un zéro (`viderLaListe(b.client) === 0`). ⛔ Le premier a rendu
   **4** — les gestes de masse portent sur TOUT le foyer, et ce fichier partage le foyer A entre
   ses 121 tests. Le second a rendu **5**, et c'était le **bon comportement** : B a vidé SA
   PROPRE liste. ⚠️ **Le préfixe unique par test isole les NOMS, pas les compteurs de foyer** —
   la garde du dépôt ne couvrait pas ce cas. Le compte attendu se **mesure** désormais avant le
   geste, et l'isolation s'assertionne sur l'état des lignes de A, jamais sur ce qui est rendu à B.
3. **Le premier jet de la sonde CSS lisait un fichier VIDE** (mauvaise expansion du `find`), donc
   ses cinq contrôles négatifs rendaient 0 **par absence de données**, pas par vertu. ⚠️ C'est
   littéralement la question que `project-context.md` impose à tout contrôle neuf — « que se
   passe-t-il s'il ne trouve rien à contrôler ? ». La sonde porte désormais une garde de taille
   **et** quatre témoins positifs.

### Completion Notes List

**Livré — 4 fichiers neufs, 5 modifiés**, aucune dépendance (`package.json` intact), **une migration**.

1. **La migration** pose les trois gestes en fonctions SQL **`security invoker`** (D2a) : `now()`
   y est l'horloge du serveur, donc le défaut `intent_at` **n'est pas élargi** à un troisième
   chemin d'écriture — et surtout pas sur `deleted_at`, le champ que la 4.10 arbitre.
2. ⛔ **Le fait qui commande tout le reste : `.delete()` ne rate pas, il ment.** Le privilège de
   table `DELETE` est accordé, aucune politique RLS ne l'autorise → `DELETE 0`, **sans erreur**,
   ligne intacte. Un `.delete()` côté client aurait fait disparaître l'article de l'écran et
   revenir au chargement suivant, sans trace. Un test d'isolation **fige** ce comportement.
3. ⛔ **Le défaut « 14 pommes » est fermé à la source** (D3) : `ajouter_article` repart de la
   quantité de l'ajout quand la ligne était tombstonée. ⚠️ **Et seulement là** — un acheté encore
   vivant continue de s'additionner, ce qu'un second test borne explicitement.
4. **Un report est résolu par une DÉCISION, pas par une contrainte** : `(status, deleted_at)`
   reste délibérément non contraint, parce que `bought` + tombstone **est** l'archivage. C'est
   écrit dans la migration pour qu'une revue ne le « répare » pas.
5. **`EXPERIENCE.md:104` est réécrit sur décision de Florian** (D1a), pas contredit en silence :
   la ligne porte désormais un hit-target de bascule **+** un contrôle explicite de retrait, le
   `<button>` étant **frère** du `<label>` et jamais son enfant.
6. **`.btn-ligne` est née, et ce n'est pas un token de confort** : `btn-quiet` est souligné, et
   trente soulignés au fil de la liste concurrenceraient le geste principal de l'écran. Ni
   abricot (UX-DR2 ne l'accorde pas à un geste destructif), ni rouge (la palette Tailwind est
   neutralisée et échouerait en silence), 44 px conservés.

**Quatre choses à signaler à la revue :**

- ⚠️ **« Tout enlever » est une chaîne INVENTÉE** (D5), comme « Tout est dans le panier. » l'a été
  en 4.3. Elle existe parce que « Vider le panier » et « Vider la liste » se ressemblent trop pour
  deux portées différentes. À valider.
- ⛔ **DEUX DÉFAUTS TROUVÉS PAR LE SEUL PARCOURS À L'ŒIL**, invisibles aux six portes et aux 271
  tests : le compte rendu du vidage était **démonté dans le rendu même qui l'écrivait**, et
  l'état vide était un **cul-de-sac** — plus de formulaire d'ajout après avoir vidé sa liste.
  ⚠️ **Le second est ANTÉRIEUR à cette story** (la 4.4 a monté le formulaire dans la branche non
  vide) mais il était DORMANT : aucun geste ne menait à l'état vide. « Tout enlever » l'y mène
  d'un clic, donc cette story devait le fermer. ✅ **Et ça referme l'écart que la 4.2 avait daté
  à l'intention de la 4.4** — « lien vers l'ajout sur l'état vide ».
- ⚠️ **Le compte affiché vient du SERVEUR, pas de l'optimisme.** Si l'autre membre vient
  d'archiver, la fonction rend moins que ce que l'écran a retiré, et c'est ce chiffre-là qui est
  vrai.
- ✅ **Le parcours à l'écran est COMPLET**, aux deux thèmes, et les trois correctifs y ont été
  revérifiés — dont **D3 vu à l'écran** : « Pommes » vidé puis réajouté à 4 rend « 4 pièces », pas
  10. ⚠️ **Contraste de la classe neuve `.btn-ligne` mesuré : 5,713:1 en clair, 8,059:1 en sombre**
  — et ma première mesure sombre était FAUSSE (2,03:1) parce qu'elle ignorait l'alpha du fond de
  carte ; recomposée, elle retombe sur `#261d23`, le « verre » que `DESIGN.md` nomme.

### File List

| Fichier | État |
|---|---|
| `supabase/migrations/20260817160000_supprimer_archiver_vider_la_liste.sql` | **nouveau** — 3 volets, requête de contrôle en en-tête (dont le **rejeu** de celle de la 4.4) |
| `lib/liste/suppression.ts` | **nouveau** — `supprimerArticle`, `archiverLesAchetes`, `viderLaListe`, les deux comptes rendus |
| `lib/liste/suppression.test.ts` | **nouveau** — 5 tests |
| `app/courses/GestesDeListe.tsx` | **nouveau** — « Vider le panier » et « Tout enlever », confirmation en deux temps |
| `app/courses/ListeCourses.tsx` | modifié — ligne restructurée (D1), trois retraits optimistes, état vide non bloquant |
| `app/globals.css` | modifié — `.ligne-article` réécrite, `.ligne-bascule` et `.btn-ligne` neuves |
| `lib/supabase/types.ts` | modifié — **régénéré** (3 fonctions neuves ; retire `graphql_public`) |
| `supabase/tests/isolation.test.ts` | modifié — **10 tests neufs**, + 1 assertion préexistante mise à jour (D3) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |

⚠️ **`package.json` intact**, aucune dépendance (NFR-10).

## Parcours à l'écran — 2026-08-17 (PARTIEL)

⚠️ **Construction de PRODUCTION (`next build` + `next start`) sur un serveur dédié pointé vers le
stack LOCAL**, port 3355 — `.env.local` pointe la production et cet écran **supprime**. Foyer de
démonstration semé par `node supabase/seed-local.mjs` (11 articles, 6 à prendre).

### ✅ Ce qui a été VU, en thème SOMBRE

| Vérifié | Résultat |
|---|---|
| Bouton « Retirer » sur chaque ligne | ✅ discret (`text-muted`, non souligné, pas d'abricot), aligné à droite |
| ⛔ **Le clic sur « Retirer » ne bascule PAS la case** | ✅ **le piège n°4 est bien évité** — le bouton est frère du `<label>` |
| Confirmation en deux temps | ✅ « Retirer » → « Confirmer / Non » **sur place**, sans saut de mise en page des 30 lignes |
| Suppression | ✅ l'article disparaît, et **la carte-rayon disparaît avec lui** quand il était seul (Boucherie) |
| ⛔ **Tombstone en base après le geste d'écran** | ✅ **mesuré en psql** : ligne présente, `deleted_at` posé, **`status` resté `pending`** (FR-6) |
| « Vider le panier » | ✅ armé → confirmé → **« 5 articles rangés. »**, accord juste, compte du SERVEUR |
| ⛔ **Traçabilité de l'archivage** | ✅ **mesuré** : 5 lignes `bought` + tombstone (archivées) **se distinguent** de 1 ligne `pending` + tombstone (supprimée) |
| Bouton conditionné à sa cible | ✅ « Vider le panier » **disparaît** dès qu'il n'y a plus d'acheté |
| `reserve` sur le `Notice` | ✅ **le bouton n'a pas bougé d'un pixel** à l'arrivée du message |
| Séparateur « DANS LE PANIER » | ✅ présent quand il sépare, **absent** sur un rayon entièrement acheté (Épicerie 3/3) |
| Groupe « À classer » | ✅ rendu comme un rayon de plein droit |
| « Tout enlever » | ✅ armé, confirmé, liste vidée, **« Ta liste est vide. »** |

### ⛔ Les deux défauts que ce parcours a trouvés — et que rien d'autre ne voyait

1. **Le compte rendu du vidage était démonté dans le rendu qui l'écrivait.** `GestesDeListe`
   vivait dans la branche « liste non vide » : après « Tout enlever », le membre voyait sa liste
   disparaître **sans jamais lire combien d'articles étaient partis**.
2. **L'état vide était un cul-de-sac.** Le formulaire d'ajout vivait dans la même branche : après
   avoir vidé sa liste, **on ne pouvait plus rien y remettre**.
3. *(mineur)* « 5 articles rangés. » restait affiché au-dessus d'un « Confirmer » portant sur le
   geste **suivant** — un compte rendu parle du passé, il ment dès qu'un geste est armé.

Les trois sont corrigés, **et les trois correctifs ont été revérifiés à l'œil** après que Florian a
coupé le serveur du port 3333 (voir la note d'outillage en fin de section).

### ✅ Les trois correctifs, REVÉRIFIÉS à l'écran

| Vérifié | Résultat |
|---|---|
| Armer un geste efface le compte rendu précédent | ✅ « 5 articles rangés. » **disparaît** quand « Tout enlever » est armé — ⚠️ **et les boutons ne bougent pas d'un pixel**, `reserve` tenant la place |
| Le compte rendu **survit** au vidage | ✅ **« 6 articles retirés. »** reste lisible sur l'écran vide |
| L'état vide n'est plus un cul-de-sac | ✅ « Ta liste est vide. » **avec** le formulaire d'ajout, et **l'ajout depuis cet état fonctionne** |
| ⛔ **Le correctif D3, VU À L'ÉCRAN** | ✅ « Pommes » (6 pièces) vidé puis réajouté à 4 → **« 4 pièces »**, pas 10 |

### ✅ Thème CLAIR, et les mesures des deux thèmes

| Vérifié | Résultat |
|---|---|
| Squelette en clair | ✅ cartes avec leur ombre `--card-shadow` (le token vaut `none` en sombre — défaut qui ne se voit que dans UN thème) |
| Ligne, coche, barré, séparateur | ✅ conformes dans les deux thèmes ; le libellé barré reste lisible |
| **Contraste de `.btn-ligne`** | ✅ **5,713:1** en clair (encre `#63685f` sur carte blanche) · **8,059:1** en sombre |
| ⚠️ **Le fond sombre est TRANSLUCIDE, et la première mesure était fausse** | Ma fonction ignorait l'alpha et rendait **2,03:1**. Recomposé couche par couche, le fond réel est **`rgb(38,29,35)` = `#261d23`** — exactement le « verre translucide » que `DESIGN.md` nomme, ce qui valide la composition. Témoin : le libellé d'article voisin mesure 14,48:1 |
| Cible tactile du bouton | ✅ **44 px** (plancher), ligne à 46 px |
| Anneau de focus clavier | ✅ la règle globale `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }` s'applique — **mesuré : `.btn-ligne` ne pose aucun `outline: none`** |

### ✅ NFR-3 — aucun défilement horizontal

| Largeur | Cas nominal | **Pire cas** : confirmation armée (2 boutons) + nom de 200 caractères insécables |
|---|---|---|
| 390 px | ✅ 0 débordement | ✅ 0 débordement |
| 360 px | ✅ 0 débordement | ✅ 0 débordement |
| 320 px | ✅ 0 débordement | ✅ 0 débordement |

⚠️ **Le champ « Quoi » passe de 182 à 152 puis 112 px** — **les mêmes chiffres que la 4.4**. Le
bouton « Retirer » n'a donc rien coûté en largeur : c'est la colonne du nom qui absorbe, comme
prévu par `min-w-0`.

⚠️ **La même réserve que la 4.4, dite plutôt qu'esquivée** : la fenêtre Chrome a **refusé de se
redimensionner** (`innerWidth` bloqué à 1502 malgré un ordre explicite). La mesure est donc faite
en contraignant le conteneur — un proxy : les media queries ne s'y déclenchent pas. Cet écran n'en
emploie aucune sur la largeur, mais la nuance est réelle et se reproduit à l'identique.

### ⚠️ Une note d'outillage qui a coûté une demi-journée, et qui resservira

**Les cookies ne distinguent pas les ports.** Le serveur de développement de Florian tournait sur
`localhost:3333` **connecté à la PRODUCTION** (mesuré :
`NEXT_PUBLIC_SUPABASE_URL=https://ywoubvebmlhtomwgouci.supabase.co`). Le serveur de parcours sur
`localhost:3355` partageait donc **la même session** — l'écran a fini par afficher « Quelqu'un est
déjà connecté ici · Cet appareil est ouvert au nom de Florian ».

⛔ **Une session de production écrite dans le cookie n'est plus validable par le stack local**, et
le rendu serveur reste alors **suspendu sur `requireProfile()`** : page bloquée sur son
`loading.tsx`, `aria-hidden`, React jamais hydraté, **et pas une seule erreur en console**.

⚠️ **C'est la troisième famille de la règle §7 — l'outillage, pas l'application — et le diagnostic
de la 4.4 était INCOMPLET.** Elle avait conclu « c'était le serveur de développement » ; la vraie
variable partagée est **l'origine du cookie**. Passer en construction de production avait
fonctionné ce jour-là parce que ça changeait le port, donc la collision, pas parce que le mode
développement était en cause.

**Le remède, pour la prochaine fois** : couper tout autre serveur du projet avant un parcours, ou
servir sur une origine distincte. ⚠️ **`127.0.0.1` ne suffit PAS** — mesuré : la redirection
d'authentification ramène sur `localhost`.

⚠️ **Aucune écriture n'a atteint la production** : le bundle client était construit avec l'URL du
stack local (vérifié dans les fragments compilés), et **chaque geste a été recontrôlé en `psql`
sur la base locale**. Les seules données touchées sont celles du foyer de démonstration.

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-17 | dev-story | **Implémentée.** 4 fichiers neufs, 5 modifiés, **une migration**, aucune dépendance. **D1 tranchée par Florian (option a)** ; D2 à D5 sur leur défaut prescrit. ⛔ **Le fait central est figé par un test** : `.delete()` rend `DELETE 0` **sans erreur** — privilège de table accordé, aucune politique RLS. ⛔ **Le défaut « 14 pommes » est fermé à la source** : `ajouter_article` repart de la quantité de l'ajout quand la ligne était tombstonée, et **seulement là** (un acheté encore vivant continue de s'additionner, borné par un second test). ⛔ **Un test PRÉEXISTANT de la 4.4 a dû changer d'assertion** (`zztomb-riz`, 3 → 2) : il figeait la somme à travers le tombstone, que D3 supprime — **mis à jour avec sa raison datée, jamais effacé**. ⛔ **Un report est résolu par une DÉCISION** : `(status, deleted_at)` reste non contraint, `bought` + tombstone **étant** l'archivage. ⛔ **TROIS DÉFAUTS INTRODUITS PUIS CORRIGÉS, consignés** : (1) `String.replace` a mangé les `$$` de la fonction SQL — le voisin exact du piège `\uXXXX` que la 4.4 avait payé ; (2) deux de mes tests d'isolation supposaient être seuls au monde, or **le préfixe unique isole les NOMS, pas les compteurs de foyer** ; (3) la première sonde CSS lisait un fichier VIDE, donc ses contrôles négatifs rendaient 0 par absence de données — la question même que `project-context.md` impose. ⛔ **LE PARCOURS À L'ŒIL A TROUVÉ DEUX DÉFAUTS QUE 271 TESTS ET SIX PORTES NE VOYAIENT PAS** : le compte rendu du vidage était démonté dans le rendu qui l'écrivait, et **l'état vide était un cul-de-sac** (plus de formulaire d'ajout après avoir vidé) — ce dernier ANTÉRIEUR à cette story, dormant jusqu'à ce que « Tout enlever » le rende atteignable, et sa correction referme l'écart que la 4.2 avait daté à l'intention de la 4.4. Portes : `npm test` **271/271** (+5) · isolation **121 · 120 pass · 0 fail · 1 skipped** (+10) · typecheck · lint · `check:migrations` 19/17/2/0 · build 14 routes · sonde CSS 3 classes, 5 contrôles négatifs à 0, **4 témoins positifs** · banc de mutations **3/3 tués**. ⚠️ `types.ts` régénéré : le diff **n'est pas purement additif** — il retire `graphql_public`, que `deferred-work.md` signalait comme entré dans le contrat sans décision. ⛔ **RESTE DÛ, daté** : thème CLAIR, NFR-3, et la revue à l'œil des trois correctifs — bloqués par une collision de cookies entre le serveur de développement de Florian (port 3333, **production**) et le serveur de parcours (port 3355), les cookies ne distinguant pas les ports. |
| 2026-08-17 | create-story | Contextualisation sur `452f308`. **Dix mesures exécutées** sur le stack local, en `begin … rollback`. ⛔ **Le fait central : `.delete()` ne rate pas, il ment** — le privilège `DELETE` est accordé (M2) mais aucune politique RLS ne l'autorise (M1), donc un DELETE rend **`DELETE 0` sans erreur** et la ligne survit (M3). Un écran optimiste montrerait l'article disparu et il reviendrait au chargement suivant. ⛔ **Et un second défaut, mesuré, que cette story CRÉE si elle ne le ferme pas** : 10 articles achetés puis archivés, réajoutés à 4, donnent **14** (M7) — `ajouter_article` additionne sur la quantité d'une vie précédente, l'index canonique étant total. D'où **cinq décisions** : D1 où loger le geste de suppression alors qu'`EXPERIENCE.md:104` impose un seul hit-target — **question posée nommément par `ListeCourses.tsx:480-482`, et la maquette ne tranche pas** · D2 fonctions SQL `security invoker` pour ne pas élargir le défaut `intent_at` à un troisième chemin d'écriture, sur le champ même que la 4.10 arbitre · D3 la quantité repart de zéro au réajout d'un tombstone · D4 la borne haute de `deleted_at`, report daté de la 4.1 · D5 la microcopy, « Vider le panier » et « Vider la liste » étant trop voisins. ⛔ **Un report est résolu par une DÉCISION plutôt que par une contrainte** : `(status, deleted_at)` reste délibérément non contraint, parce que `bought` + tombstone **est** l'archivage (M6) — le contraindre casserait l'AC2. Portes au départ : `npm test` **266/266** · isolation **111 · 110 pass · 0 fail · 1 skipped** · `check:migrations` **18/16/2/0**. |
