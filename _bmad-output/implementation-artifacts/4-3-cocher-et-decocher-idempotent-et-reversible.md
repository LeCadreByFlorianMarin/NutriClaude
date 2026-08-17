---
baseline_commit: 5b43c77
---

<!-- Contextualisée le 2026-08-12, sur `5b43c77` — la tête de `feat/4-2` APRÈS sa seconde passe de
     revue. Les seize mesures ci-dessous ont été exécutées sur le stack local, pas déduites. -->

<!-- ⛔ **LA CHOSE À SAVOIR AVANT TOUT LE RESTE, ET ELLE EST MESURÉE.**
     `grocery_list_by_aisle` porte `where g.status = 'pending'` (migration `20260805092611:625`).
     **Mesuré (M3) : cocher un article le fait DISPARAÎTRE de la seule surface de lecture du
     produit.** Or FR-3 dit « les articles achetés restent consultables et récupérables », et l'AC1
     de cette story exige que décocher marche « dans les deux sens ». **On ne décoche pas ce qu'on
     ne voit plus.**
     Cette story ne peut donc PAS se contenter d'écrire `status` : elle doit d'abord rendre les
     articles cochés visibles. C'est la décision **D1**, et c'est la plus structurante. -->

<!-- ⚠️ **CE N'EST PAS UN ÉCRAN « PANIER ».** `EXPERIENCE.md:107` et `DESIGN.md:283` sont explicites :
     le panier est un **séparateur À L'INTÉRIEUR de chaque carte-rayon** (`separateur-panier`), qui
     repousse les articles cochés en bas de LEUR rayon. Pas d'onglet, pas de page, pas de section
     séparée. Un développeur qui invente un écran refait la maquette contre elle. -->

<!-- ✅ **CE QUI EST DÉJÀ LÀ ET QU'IL NE FAUT PAS RÉINVENTER** : la colonne `status` existe depuis le
     squelette (`initial_schema:204`, `not null default 'pending' check (status in ('pending',
     'bought'))`), la politique `grocery_update` autorise déjà un membre à écrire sur son foyer
     (`20260805092611:608`), et les tokens `--checkbox-empty` / `--checkbox-empty-fill` sont posés
     dans `globals.css:57-58` et `:86-87`, publiés en `--color-checkbox-empty*`. **Aucune migration
     n'est due pour la colonne ni pour la RLS.** -->

# Story 4.3: Cocher et décocher, idempotent et réversible

Status: done

<!-- ⛔ **FERMÉE AVEC UNE CONDITION OUVERTE, DATÉE PLUTÔT QU'EFFACÉE** (§6 bis : « fermer avec ses
     conditions ouvertes est permis ; les effacer ne l'est pas »).

     **Ce qui reste dû avant la fusion, et aucune porte automatique ne le voit (§7) :**
     le **parcours à l'écran**, sur le stack local, `localhost:3333` (jamais `127.0.0.1:3333`), aux
     DEUX réglages système, thème remis après. La sous-tâche correspondante de la Task 7 est
     **laissée non cochée avec sa raison** — une case vide honnête vaut mieux qu'une case cochée à
     tort (§1), et les stories 1.5, 1.6, 1.7 et 2.1 ont fait le même choix, préféré à chaque fois
     par la revue.

     Six choses à regarder, qu'aucun test ne peut établir :
     · la coche cochée et son trait, dans les deux thèmes ;
     · le libellé barré — **lisible**, pas effacé (c'est ce qui permet de récupérer l'article) ;
     · le séparateur « Dans le panier » : présent quand il sépare, absent quand tout est acheté ;
     · l'article qui **descend sous le séparateur au moment du tap**, sans saut de mise en page ;
     · l'état « Tout est dans le panier. » — **et sa formulation, inventée ici** ;
     · le compteur qui décroît sans sautiller (`tabular-nums`).

     ⚠️ **Le parcours de la story 4.2 est lui aussi toujours dû** — elle est en `in-progress` pour
     cette raison. Les deux peuvent se faire d'un seul passage. -->

<!-- ✅ **LES QUATRE DÉCISIONS SONT PRISES SUR LEUR DÉFAUT PRESCRIT**, le 2026-08-13, faute
     d'arbitrage de Florian au lancement de `dev-story` — c'est ce que la section « Décisions
     ouvertes » prévoit explicitement. Chacune est signalée à l'endroit du code qui l'applique :
     · **D1 → (a)** la vue s'élargit par migration additive, `statut` remonte au client ;
     · **D2 → (a)** la 4.3 pose la VRAIE coche ; la 4.13 ne garde que le plancher ;
     · **D3 → (a)** `intent_at` est écrit à chaque bascule ;
     · **D4 → (a)** mise à jour optimiste avec rollback sur échec.
     ⚠️ Si l'une est refusée en revue, c'est D1 qui coûte le plus cher à défaire (migration +
     types + trois modules). -->


## Story

As a **membre au supermarché**,
I want **cocher un article acheté et le décocher d'un geste, dans les deux sens**,
so that **l'état reflète mes achats sans jamais se bloquer**.

## Acceptance Criteria

**AC1 — La bascule est une valeur posée, pas un basculement relatif**

**Given** qu'une bascule relative bloquerait un article acheté dans son état
**When** `status` devient une **valeur posée** (`pending`/`bought`) sur la ligne canonique (AD-4)
**Then** cocher puis décocher fonctionne **dans les deux sens** (FR-3), en un seul geste

**AC2 — L'opération est idempotente**

**Given** un article déjà coché sur une autre surface
**When** un membre le coche à nouveau
**Then** l'opération est **idempotente** : convergence sans conflit ni erreur (NFR-2)

**AC3 — L'article acheté reste consultable et récupérable**

**Given** un article acheté
**When** la liste est consultée
**Then** il reste consultable et récupérable — **repoussé « dans le panier », pas effacé** (FR-3)

---

## Décisions ouvertes — chacune avec son défaut prescrit

> Le dev agent applique le **défaut prescrit** si Florian n'a pas tranché. Chaque option porte son
> coût réel, mesuré quand c'était possible.

### D1 — Comment les articles cochés redeviennent visibles ⛔ **la plus structurante**

**Le problème, mesuré (M2/M3)** : la vue filtre `status = 'pending'`. Un article coché sort de
`articlesDuFoyer`, donc de l'écran, donc l'AC1 et l'AC3 sont **inatteignables en l'état**.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Une migration retire `status = 'pending'` de la vue ; `ArticleDeListe` porte `statut`, et l'écran filtre à l'affichage | ⚠️ **La vue est le CONTRAT** que l'Epic 5 (dashboard) et l'Epic 7 (MCP) liront, et que la 4.12 versionnera. L'élargir est un changement de contrat — mais **additif** : aucun consommateur ne casse, ils voient des lignes de plus. ⛔ Tout consommateur existant doit alors filtrer : `ListeCourses` (compteur, ratio), et rien d'autre aujourd'hui (mesuré : `articlesDuFoyer` n'a qu'un appelant) |
| (b) Une seconde requête pour les articles cochés | Deux lectures, deux ordres, deux moments — et un risque de divergence que le tri de `comparerGroupes` ne couvre pas. ⛔ Contredit l'AD-6 (« autorité serveur ») en répartissant la vérité sur deux chemins |
| (c) Garder le filtre, ne tenir l'état coché qu'en local (optimiste) | ⛔ **Un mensonge** : un rechargement perd l'article coché, et l'AC3 est faux. À écarter, listé pour que personne ne le redécouvre |

⚠️ **Si (a) : le `order by` de la vue ne change PAS.** Le regroupement des cochés en bas de rayon est
un tri d'**affichage** (`separateur-panier`), pas un ordre de parcours. Le mettre dans la vue
imposerait cet arbitrage au dashboard et au MCP, que l'AC3 de la 2.4 interdit.

### D2 — Qui possède la coche : cette story ou la 4.13 ?

La story 4.13 (« Coche réelle & plancher d'accessibilité ») dit que la coche est **un vrai contrôle**
(`role="checkbox"` / `<input type="checkbox">` stylé), que la zone de tap est **toute la ligne**, et
que l'état acheté est **barré + coche pleine**. Cette story-ci a besoin de quelque chose de tapable.
**C'est exactement la forme de la décision D1 de la story 4.2** (la 2.4 construisait `CarteRayon`, la
4.2 le consommait).

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** La 4.3 pose **la vraie coche tout de suite** — `<input type="checkbox">` stylé, hit-target = ligne entière, barré + coche pleine. La 4.13 ne garde que le **plancher** : contrastes mesurés, anneau de focus, `prefers-reduced-motion`, zoom 200 % | ⚠️ Élargit la 4.3. Mais `EXPERIENCE.md:104` dit « tap n'importe où sur la ligne = bascule », et `ListeCourses.tsx` **prévient déjà** : « la story 4.13 posera ici une coche et un hit-target unique couvrant toute la ligne : la rendre en plusieurs morceaux interactifs l'obligerait à tout refaire » |
| (b) La 4.3 pose un contrôle minimal, la 4.13 le remplace | ⛔ Le rework que le docblock de la 4.2 nomme pour l'éviter. Et une coche qui n'annonce pas son état est un défaut d'accessibilité **livré sciemment** |

### D3 — `intent_at` est-il écrit dès maintenant ?

**Mesuré (M4bis)** : après un `UPDATE` de `status`, `updated_at` bouge (le trigger du volet 5 tire,
+1,209 s d'écart mesuré) mais **`intent_at` reste à sa valeur d'insertion** — un `default` ne
s'applique pas à un `UPDATE`.

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** L'UPDATE écrit `intent_at: new Date().toISOString()` en même temps que `status` | Une colonne de plus dans un objet déjà écrit : **coût nul**. ⚠️ C'est l'horloge du CLIENT, ce qui est correct au sens d'AD-3 (« l'intention », pas l'arrivée) et deviendra l'horloge du geste avec l'outbox (4.9) |
| (b) Laisser à la 4.10 (convergence LWW) | ⛔ Toute coche posée d'ici là porte un **arbitre périmé**, et la 4.10 héritera de données dont le LWW ne peut pas trancher. Le défaut n'est pas visible à l'écran : il se paiera deux stories plus loin, sur des données déjà écrites |

### D4 — La mise à jour à l'écran

`EXPERIENCE.md:104` prescrit une **mise à jour optimiste**. La 4.2 est une lecture unique sans chemin
de rafraîchissement (AD-8 proscrit le polling et le reload manuel ; le temps réel est la 4.11).

| Option | Ce qu'elle coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** État local posé immédiatement, écriture ensuite, **rollback de l'état local si l'écriture échoue** + message | ⚠️ Le rollback est la moitié qu'on oublie : sans lui, l'écran affiche un état que la base n'a pas. C'est la forme du défaut « le squelette ne doit jamais être l'état d'échec » corrigé en revue de la 4.2 |
| (b) Relire toute la liste après chaque écriture | ⛔ Un aller-retour réseau par coche, dans un magasin, sur réseau instable. Contredit NFR-1 et l'esprit d'AD-13 |

---

## Ce qui a été MESURÉ pour cette story

*Stack local, `5b43c77`. Commandes exécutées, sorties citées. Ce qui n'a pas été exécuté est dit tel quel.*

| # | Mesure | Résultat |
|---|---|---|
| **M1** | `status`, `intent_at`, `updated_at` à l'insertion | `pending`, tous deux **posés non nuls** |
| **M2** | La vue montre-t-elle un article `pending` ? | **1 ligne** ✅ |
| **M3** | ⛔ **La vue montre-t-elle un article après cochage ?** | **0 ligne** — l'article DISPARAÎT |
| **M4bis** | Un `UPDATE` de `status` touche-t-il `intent_at` ? | ⛔ **Non.** `updated_at` bouge (+1,209 s), `intent_at` **reste à l'insertion**. *(Une première sonde en transaction unique a rendu un résultat trompeur — `now()` y est constant. Refaite hors transaction.)* |
| **M5** | Recocher un article déjà `bought` | **Aucune erreur**, `status` reste `bought` — l'idempotence de l'AC2 est **native à une valeur posée** |
| **M6** | Décocher (`bought` → `pending`) | Revient à `pending` ✅ |
| **M7** | Politique RLS d'écriture | `grocery_update` existe déjà (`20260805092611:608`), `using` et `with check` sur `current_household_id()`. **Aucune migration RLS due** |
| **M8** | Colonne `status` | `text not null default 'pending' check (status in ('pending','bought'))` — `initial_schema:204`. **Aucune migration de colonne due** |
| **M9** | Index | `idx_grocery_household_status on (household_id, status)` existe (`initial_schema:208`) |
| **M10** | Tokens de coche dans `globals.css` | `--checkbox-empty` (57, 86) et `--checkbox-empty-fill` (58, 87) posés **et publiés** en `--color-checkbox-empty*` (236-237) |
| **M11** | Tokens ABSENTS | ⛔ **aucun** `--checkbox-size`, aucun `separateur-panier`, aucun `done-label-color`, aucune règle `line-through`. À poser ici |
| **M12** | Appelants d'`articlesDuFoyer` | **un seul** (`ListeCourses.tsx`) + le test d'isolation. Élargir la vue a donc un rayon de souffle connu |
| **M13** | `pris` sur `CarteRayon` | câblé `pris={0}` en dur par la 4.2, avec le commentaire « se corrige à la 4.3 » |
| **M14** | Portes au point de départ | `npm test` **247/247** · isolation **98 · 97 pass · 0 fail · 1 skipped** · typecheck · lint · build 14 routes |
| **M15** | `separateur-panier` dans `DESIGN.md` | `:283` — eyebrow `muted` (**jamais muted-2**), à l'intérieur du rayon |
| **M16** | `done-label-color` | `DESIGN.md:161` = **`muted`**, pas `muted-2` : « le libellé barré reste lisible (AA), le barré + coche pleine restent les signaux primaires » |

---

## Tasks / Subtasks

- [x] **Task 1 — Rendre les articles cochés lisibles** (AC: 3) · *dépend de D1*
  - [x] Migration : retirer `status = 'pending'` de `grocery_list_by_aisle`, **sans toucher au `order by`**, avec sa requête de contrôle en en-tête (`npm run check:migrations` l'exige)
  - [x] ⛔ **AJOUTER `status` À LA CHAÎNE `.select()` d'`articlesDuFoyer`** — elle liste ses colonnes une par une (`"id, name, quantity, unit, aisle_id, aisle_name, aisle_icon, aisle_sort"`). Élargir la vue ne suffit pas : sans cette ligne, `status` n'arrive **jamais** au client, et le symptôme est un `undefined` silencieux, pas une erreur
  - [x] `ArticleDeListe` porte `statut: "pending" | "bought"` ; `versArticle` le rétrécit avec la même garde que `id`/`name` (une valeur hors vocabulaire écarte la ligne **avec son `console.warn`**, elle ne la déforme pas)
  - [x] ⚠️ **Rejouer `test:isolation` DÈS la migration, avant d'écrire l'écran.** Les tests de la 4.2 assertent le **contenu et l'ordre exacts** de la vue (`deepEqual` sur cinq noms) : élargir la vue peut les casser si une fixture n'est pas `pending`. C'est le moment le moins cher pour le découvrir
  - [x] `npm run supabase gen types --local` **puis** relire le diff : la vue gagne des lignes, pas des colonnes
  - [x] ⚠️ Le compteur « n à prendre » et le ratio `pris/total` comptent désormais **sur `statut`**, plus sur la longueur du tableau

- [x] **Task 2 — La coche, vrai contrôle** (AC: 1) · *dépend de D2*
  - [x] `<input type="checkbox">` stylé, **jamais un `<span>`** — `EXPERIENCE.md:151`
  - [x] Hit-target = **toute la ligne**, un seul élément interactif par ligne (`EXPERIENCE.md:104`)
  - [x] Label au lecteur d'écran : « {article}, {à prendre | dans le panier} »
  - [x] Poser `--checkbox-size: 25px` (`DESIGN.md:131`) et la règle de coche cochée (aplat `accent-fill`, trait `accent-ink`)
  - [x] ⛔ **L'abricot est ici LÉGITIME** — UX-DR2 réserve l'accent à l'action courses, et la coche en fait nommément partie

- [x] **Task 3 — L'écriture, posée et idempotente** (AC: 1, 2) · *dépend de D3*
  - [x] `update({ status, intent_at })` client-direct (AD-13 : aucun secret serveur, aucun `revalidatePath` — la conséquence est locale)
  - [x] **Valeur posée, jamais `!statut`** : l'appelant décide `pending` ou `bought` et l'envoie
  - [x] Motif du dépôt : `data` se lit autant qu'`error` (`DisplayNameForm.tsx:70-78`) — **zéro ligne est un succès PostgREST**, et ici zéro ligne veut dire « la ligne n'est plus à toi ou n'existe plus »
  - [x] Journal préfixé `[courses]` sur échec (convention mesurée : 28 occurrences sur 29)

- [x] **Task 4 — Le panier dans la carte** (AC: 3)
  - [x] Les cochés sont **repoussés en bas de LEUR rayon**, sous l'eyebrow « Dans le panier » (`separateur-panier`) — **jamais un écran ni un onglet**
  - [x] Le séparateur ne se rend **que s'il y a au moins un article coché** dans ce rayon
  - [x] État acheté : **libellé barré + `muted`** (M16), coche pleine. ⛔ **Jamais la seule couleur**
  - [x] La quantité et la provenance d'un article coché **peuvent** passer en `muted-2` (admis car redondant) — c'est le seul emploi autorisé de `muted-2`

- [x] **Task 5 — La mise à jour optimiste** (AC: 1) · *dépend de D4*
  - [x] État local posé avant l'écriture, **rollback + message si l'écriture échoue**
  - [x] ⛔ Pas de bouton « réessayer », pas de reload : AD-8 les proscrit, la 4.11 porte la propagation
  - [x] Le compteur et le ratio suivent l'état optimiste, sinon ils démentent la coche sous le doigt

- [x] **Task 6 — Les tests**
  - [x] `lib/liste/` : le compte `pending` vs `bought`, le tri panier-en-bas, le rétrécissement de `statut`
  - [x] **Isolation** : un membre d'un autre foyer ne peut pas cocher (`grocery_update` ancrée sur `current_household_id()`), et **recocher deux fois ne rend aucune erreur** (AC2, mesuré côté SQL en M5 — à porter côté client)
  - [x] ⚠️ Placer les tests neufs **avant** celui de la génération (`isolation.test.ts`), qui segfaute — encadré déjà en place
  - [x] ⛔ La garde CI compte **un seul** saut attendu, nommé en dur : un `test.skip` neuf fait rougir le job

- [x] **Task 7 — Les portes, puis le parcours à l'écran**
  - [x] `npm run typecheck` · `lint` · `test` · `test:isolation` · `check:migrations` · `build`
  - [x] **Sonde CSS** : tout token neuf doit apparaître dans la feuille compilée, avec contrôle négatif
  - [x] ⛔ **Parcours à l'œil, aux DEUX réglages système, thème remis après** — FAIT le 2026-08-13, sur un serveur DÉDIÉ pointé sur le stack local (`.env.local` du dépôt pointe la PRODUCTION : lancer le parcours dessus aurait modifié la vraie liste de Florian). Compte, foyer et 11 articles semés puis supprimés. ⚠️ **Deux points NON couverts, dits plutôt qu'esquivés** : (a) NFR-3 aux largeurs réelles — la fenêtre a refusé de se redimensionner (`innerWidth` bloqué à 1502), le contrôle à 320 px a été fait en **contraignant le conteneur**, ce qui est un proxy et non un viewport ; (b) le correctif du défaut trouvé n'a **pas** été revu à l'écran — le navigateur a cessé d'exécuter le JS de la page
  - [x] ⚠️ **Mesurer le contraste de la coche vide sur la carte** dans les deux thèmes (≥3:1 non-textuel). Les tokens l'annoncent (3,64:1 clair / 4,77:1 sombre) ; personne ne l'a mesuré **en place**
  - [x] Fermer le `Status` du fichier **et** `sprint-status.yaml` (règle §6 bis)

---

## Dev Notes

### Les pièges, dans l'ordre où ils mordent

**Piège n°1 — Croire que la story se réduit à un `update`.** Elle commence par un problème de
**lecture** (D1). Un dev qui écrit `status` en premier verra l'article disparaître à chaque coche et
croira à une panne.

**Piège n°2 — Le basculement relatif.** AD-4 existe pour empêcher `status = !status`. Deux surfaces
qui basculent en même temps s'annulent ; deux surfaces qui **posent** `bought` convergent. C'est
littéralement le bug du produit d'origine, tracé au PRD (`:207` — « Cocher / décocher : **Cassé** —
case codée en dur, un article acheté ne peut pas revenir »).

**Piège n°3 — `intent_at` qui se périme sans rien dire.** Mesuré (M4bis). Aucune porte ne le voit,
aucun écran ne le montre, et la 4.10 en dépend entièrement.

**Piège n°4 — Inventer un écran « panier ».** `EXPERIENCE.md:107` et `DESIGN.md:283` : c'est un
séparateur **dans** la carte-rayon.

**Piège n°5 — `muted-2` sur le libellé barré.** `DESIGN.md:161` l'a explicitement corrigé (« était
muted-2 ~2:1 sur clair »). Le libellé acheté est en **`muted`** : il doit rester lisible pour
permettre la récupération (FR-3). `muted-2` n'est admis que sur la quantité et la provenance d'un
article coché, parce qu'elles y deviennent redondantes.

**Piège n°6 — Le dénominateur du ratio.** `CarteRayon` reçoit `pris` et `total`. Une fois les cochés
visibles, `total` = tous les articles du rayon et `pris` = ceux à `bought`. La 4.2 avertit déjà : les
deux doivent venir **du même tableau, dans la même expression**, sinon la carte annonce « 3 sur 5 »
au-dessus de 4 lignes et **aucune porte ne le voit**.

**Piège n°7 — Le compteur qui sautille.** `.compteur` porte `tabular-nums` précisément parce qu'il
va enfin bouger à chaque coche (`globals.css:318-320`, écrit en prévision de cette story).

**Piège n°8 — La coche est un des rares emplois LÉGITIMES de l'abricot.** UX-DR2 l'énumère. Mais
l'interdit tient partout ailleurs : pas d'abricot sur le séparateur, ni sur le libellé barré.

**Piège n°9 — ⛔ L'ÉTAT VIDE CHANGE DE SENS, ET RIEN NE LE SIGNALE.** `ListeCourses` teste
aujourd'hui `articles.length === 0` pour rendre « Ta liste est vide. ». Une fois les cochés visibles,
**ce test devient faux** : une liste dont tout est acheté a `articles.length > 0` et « 0 à prendre ».
Il y a désormais **trois** états de contenu, pas deux :

| État | Condition | Ce que l'écran doit dire |
|---|---|---|
| Vide | aucun article, tous statuts confondus | « Ta liste est vide. » *(inchangé)* |
| **Tout est pris** | des articles, **aucun** en `pending` | ⚠️ **État NEUF, sans copie écrite.** Ni « vide » (faux et décourageant après avoir tout coché), ni le silence. À rédiger — voir la question ouverte en fin de story |
| En cours | au moins un `pending` | compteur + cartes |

⛔ **Le piège n'est pas d'oublier l'état, c'est de réutiliser « Ta liste est vide. »** — la phrase
affirme un fait faux, exactement comme l'échec de lecture qui affirmait le vide, corrigé en revue de
la 4.2.

**Piège n°10 — Le compteur n'est plus `articles.length`.** Il vaut le nombre de `pending`. Le laisser
sur la longueur du tableau ferait annoncer « 12 à prendre » au-dessus de douze articles dont dix sont
barrés, **et aucune porte ne le verrait**.

### Frontières — ce que cette story ne fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| Supprimer un article, archiver les achetés, vider la liste | **4.5** (FR-6, FR-8 — distinct du cochage) |
| Contraste mesuré, anneau de focus, `prefers-reduced-motion`, zoom 200 % | **4.13** (plancher d'accessibilité) — voir D2 |
| Provenance sur la ligne | **4.6** |
| Pastille « arrive… » et bandeau hors-ligne | **4.14** |
| Écriture hors ligne, outbox | **4.9** |
| LWW par champ entre appareils | **4.10** — mais D3 lui prépare le terrain |
| Propagation temps réel | **4.11** |
| Versionnage du contrat de vue | **4.12** — ⚠️ D1(a) l'élargit, à signaler à la 4.12 |

### Fichiers à toucher

```
supabase/migrations/<neuve>.sql    NEW   la vue élargie (D1a) + requête de contrôle en en-tête
lib/supabase/types.ts              UPD   régénéré --local (jamais --linked)
lib/liste/liste.ts                 UPD   `statut` sur ArticleDeListe et versArticle
lib/liste/liste.test.ts            UPD   le rétrécissement de statut
lib/liste/groupement.ts            UPD   tri panier-en-bas DANS le groupe (pas dans la vue)
lib/liste/groupement.test.ts       UPD   ordre intra-groupe, séparateur, ratio
lib/liste/basculer.ts              NEW   l'écriture posée, client EN PARAMÈTRE (motif rayonsDuFoyer)
lib/liste/basculer.test.ts         NEW
app/courses/ListeCourses.tsx       UPD   coche, optimiste + rollback, compteur/ratio réels
app/_lib/CarteRayon.tsx            ~     seulement si le séparateur doit vivre dans la carte
app/globals.css                    UPD   --checkbox-size, coche cochée, separateur-panier, barré
supabase/tests/isolation.test.ts   UPD   cochage inter-foyers refusé + idempotence
```

⚠️ **`lib/liste/basculer.ts` prend son client EN PARAMÈTRE**, comme `articlesDuFoyer` et
`rayonsDuFoyer` : c'est ce qui le rendra appelable par le dashboard (Epic 5) et le MCP (Epic 7) sans
réécriture, et **testable contre Postgres** dans `isolation.test.ts`.

### Motifs du dépôt à reprendre, jamais à réinventer

| Besoin | Où est le motif |
|---|---|
| Écriture client-direct + état de soumission | `app/foyer/DisplayNameForm.tsx`, `app/_lib/useSoumission.ts` (avec son `finally`) |
| Lire `data` autant qu'`error` — zéro ligne est un succès PostgREST | `DisplayNameForm.tsx:70-78` |
| Erreur métier : **SQLSTATE d'abord**, texte en repli | `lib/foyer/erreurs.ts` |
| Zone de message accessible (`role="status"` + `aria-live`) | `app/_lib/Notice.tsx` |
| Lecture avec le client **en paramètre** | `lib/liste/liste.ts`, `lib/foyer/membres.ts` |
| Présentateur pur, testable, hors JSX | `lib/quantite.ts`, `lib/rayons/carte.ts` |
| Confirmation en deux temps, jamais `window.confirm` | `app/foyer/InviteCard.tsx` *(pour la 4.5, pas ici)* |

⚠️ **`useSoumission` n'est PAS forcément le bon outil ici.** Il sert un formulaire qui bloque pendant
son envoi ; une coche optimiste ne bloque rien, par définition. Le regarder avant de décider, et
écrire pourquoi si on ne le prend pas.

### Ce que la story 4.2 lègue, et qui n'est pas dans ses tâches

- **`formaterQuantiteEtUnite`** vit dans `lib/quantite.ts` (décision D-5), avec ré-export depuis
  `lib/recettes/lecture.ts`. **Les nouveaux appelants importent depuis `@/lib/quantite`.**
- **`comparerGroupes` est exportée** et testée sur le groupe vide — le tri intra-groupe de cette
  story doit suivre le même principe : **exporté et mesuré**, jamais « correct par construction ».
- **`Notice` sans `reserve` sur cet écran** : il n'y avait pas de cible à protéger. ⚠️ **Cette story
  en ajoute une** (la ligne devient tapable) : si un message doit surplomber la liste, `reserve`
  redevient dû — et c'est un changement de conclusion, pas un oubli de la 4.2.
- ⛔ **Le squelette porte `--card-shadow`** depuis la revue du 2026-08-12. Toute carte neuve ou
  modifiée doit rester en accord avec lui, faute de quoi le passage de relais saute en thème clair.

### Standards de test

- `node --test` natif, aucun harnais de composants (NFR-10) → **toute règle testable descend dans
  `lib/`**. C'est la leçon mesurée de la 4.2 : « 2 pièce » était intestable dans le JSX.
- ⛔ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers, et la garde de
  l'isolation compte désormais **les tests sautés** — un `test.skip` neuf fait rougir la CI.
- Un invariant entre deux fichiers **se mesure** (§4). Si le tri d'affichage doit s'accorder avec
  autre chose, un test l'exécute.
- Les tests d'isolation passent par `a.client`/`b.client`, **jamais `admin`** (AD-17).
- **Préfixe unique par test** (`zzbasc-`, pas `zz-`) : la 4.2 a payé le préfixe partagé en revue.

### Project Structure Notes

Aucune divergence avec la structure en place. `lib/liste/` est le module posé par la 4.2 et cette
story l'étend sans le réorganiser. La seule nouveauté structurelle est `lib/liste/basculer.ts`, qui
suit le motif « une fonction, son client en paramètre, son fichier de test à côté ».

⚠️ **Une migration est due si D1 = (a)** — la première depuis la 4.1. Elle porte sa requête de
contrôle en en-tête, elle s'applique **au déploiement** (`vercel.json` →
`scripts/migrer-au-deploiement.mjs`), et `db reset` reste l'outil normal en local, interdit sur le
distant.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 4.3`] — story, AC
- [Source: `_bmad-output/planning-artifacts/prds/.../prd.md#FR-3, FR-6, FR-8, NFR-2, NFR-3`]
- [Source: `.../ARCHITECTURE-SPINE.md#AD-4`] — toggle idempotent, valeur posée
- [Source: `.../ARCHITECTURE-SPINE.md#AD-3`] — `intent_at` arbitre du LWW, `updated_at` affichage
- [Source: `.../ARCHITECTURE-SPINE.md#AD-13`] — écriture client-direct sauf secret serveur
- [Source: `.../ux-designs/.../EXPERIENCE.md:104, :107, :151`] — ligne-article, panier, plancher
- [Source: `.../ux-designs/.../DESIGN.md:161, :283, :131`] — libellé barré, séparateur, taille coche
- [Source: `supabase/migrations/20260502000000_initial_schema.sql:204`] — colonne `status`
- [Source: `supabase/migrations/20260805092611_...sql:608, :613-626`] — RLS update, vue
- [Source: `_bmad-output/project-context.md`] — règles de méthode, Tailwind 4, microcopy
- [Source: story 4.2, Review Findings des 2026-08-07 et 2026-08-12] — legs et pièges

### Intelligence git — ce que les cinq derniers commits enseignent

| Commit | Ce qu'il apprend à cette story |
|---|---|
| `5b43c77` fix(4-2) 2ᵉ passe | ⛔ **Le code passait, la reddition de comptes non.** Chiffres périmés, File List amputée, route d'échafaudage livrée. **Pour cette story : la File List se relève depuis `git diff --name-status`, et aucun chiffre ne s'écrit sans avoir été rejoué** |
| `9b2d91f` feat(4-2) | La lecture client-direct, ses trois états, le `catch` lié. **Le motif à reprendre tel quel pour l'écriture** |
| `69a34fa` Carte Rayon | `ProprietesCarteRayon` et son ratio `pris/total` — **c'est cette story qui rend `pris` réel** |
| `fb7b5c4` (4.1) | La ligne canonique et la RLS. Sa revue avait trouvé « deux tests qui ne mesuraient pas ce qu'ils croyaient » |
| `68dcd42` (7.1) | L'accès MCP scopé foyer — **le futur appelant de `basculer`**, d'où le client en paramètre |

### Latest tech — rien à rafraîchir

Aucune dépendance nouvelle (NFR-10), aucune API externe. La pile est celle d'AR-STACK, inchangée
depuis la 4.2 et mesurée verte au point de départ (M14). `<input type="checkbox">` et
`Intl`/`node --test` sont natifs — **c'est presque toujours la réponse sur ce projet**.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (`dev-story`, 2026-08-13)

### Debug Log References

Toutes les commandes ci-dessous ont été **exécutées**. Ce qui ne l'a pas été est dit tel quel.

| Commande | Résultat |
|---|---|
| `npm test` | **257 / 257**, `fail 0` — 249 avant la story (+8 : 3 sur `basculer`, 5 sur le panier) |
| `npm run test:isolation` | **103 tests · 102 pass · 0 fail · 1 skipped** — 98 avant (+5). Le saut reste **celui, unique, attendu par la garde CI** |
| `npm run typecheck` · `npm run lint` | verts (`--max-warnings 0`) |
| `npm run check:migrations` | **17 / 15 avec requête de contrôle / 2 exemptées / 0 sans** — la migration neuve porte la sienne |
| `npm run build` | réussi — **14 routes**, `/courses` en `ƒ`, aucune route neuve |
| **Application de la migration** | `supabase migration up --local` → appliquée. **Contrôle n°3 de son en-tête exécuté** : `via_vue = 238`, `via_table = 238` — la vue rend désormais autant de lignes que la table, tombstones exclus |
| **`pg_get_viewdef` après migration** | `WHERE g.deleted_at IS NULL` — **le filtre `status` a bien disparu** |
| **Sonde des types générés** | `supabase gen types --local` puis **diff du bloc `grocery_list_by_aisle` : IDENTIQUE**. ⛔ `lib/supabase/types.ts` n'a donc PAS été régénéré — la migration ajoute des LIGNES, pas des colonnes, et la CLI locale (2.114.0) diffère de celle épinglée en CI (2.110.0) : régénérer aurait importé un bloc `graphql_public` sans rapport |
| **Sonde CSS** (feuille compilée) | `.coche` 4 · `.ligne-article` 1 · `.article-achete` 1 · `.separateur-panier` 1 · `--checkbox-size:25px` émise. ⚠️ **6 contrôles négatifs à 0** : `bg-gray-200`, `text-counter`, `text-accent`, `w-checkbox-size`, `h-checkbox-size`, `checkbox-size` |
| **Contraste de la coche VIDE** (calcul WCAG, script exécuté) | clair `#83887b` sur carte `#ffffff` → **3,638:1** ✅ · sombre `#828aa3` sur verre → **4,544 / 4,768 / 4,359:1** sur les trois arrêts ✅. Seuil non-textuel = 3:1, **tenu partout** |
| **Contraste du TRAIT de la coche cochée** | clair **6,558:1**, sombre **8,070:1** — largement lisible |
| **Parcours à l'écran** | ⛔ **NON FAIT** — voir la sous-tâche laissée ouverte en Task 7 |

⚠️ **Une affirmation fausse écrite puis corrigée en cours de route, consignée plutôt qu'effacée.**
Le commentaire de `--checkbox-size` disait d'abord que le ranger dans `@theme` « générerait les
utilitaires `w-checkbox-size` / `h-checkbox-size` ». **Mesuré : c'est faux** — `--checkbox-size`
n'appartient à aucun espace de noms Tailwind, donc aucun utilitaire n'en sort (sonde à 0). Le
commentaire dit désormais la vraie raison : c'est de l'avoir nommé ainsi **plutôt que
`--spacing-checkbox`** qui évite les utilitaires, `--spacing-*` étant, lui, un espace de noms.

### Completion Notes List

**Les quatre décisions ont été prises sur leur défaut prescrit** (aucun arbitrage de Florian au
lancement), et chacune est justifiée à l'endroit du code qui l'applique.

**Ce qui a été livré — 3 fichiers neufs, 5 modifiés**, aucune dépendance, **une migration** :

1. **La migration** (`20260813210000`) retire `status = 'pending'` de `grocery_list_by_aisle`.
   ⛔ **C'est elle qui rend la story possible** : sans elle, cocher faisait disparaître l'article
   de la seule surface de lecture, et l'AC1 comme l'AC3 étaient inatteignables. Changement
   **additif** (des lignes de plus, jamais des colonnes de moins), `security_invoker` et
   `deleted_at is null` explicitement reconduits, **`order by` inchangé** — le tri du panier est
   un choix d'affichage, il n'a rien à faire dans le contrat que liront l'Epic 5 et l'Epic 7.
2. **`lib/liste/basculer.ts`** — `basculerStatut` pose une **valeur**, jamais un `!statut` : c'est
   AD-4, et c'est l'AC2 obtenu par construction plutôt que par une garde. Client **en paramètre**.
   Écrit `intent_at` en même temps que `status` (D3).
3. **`lib/liste/groupement.ts`** — `trierPanierEnBas`, exportée et mesurée. S'appuie sur la
   **stabilité de `Array.sort`** (ES2019) pour préserver l'ordre alphabétique de part et d'autre du
   séparateur, plutôt que de réimplémenter la collation Postgres côté client.
4. **`lib/liste/liste.ts`** — `StatutArticle`, `estStatutConnu`, et `statut` sur `ArticleDeListe`.
   ⚠️ **`status` a dû être ajouté à la chaîne `.select()`** : élargir la vue ne suffisait pas, et
   l'oubli aurait rendu `statut` `undefined` **en silence**.
5. **`app/globals.css`** — `.coche` (vrai `<input>` restylé), `.ligne-article` (le hit-target),
   `.article-achete` (barré + `muted`), `.separateur-panier`, et le token `--checkbox-size`.
6. **`app/courses/ListeCourses.tsx`** — la coche, la bascule optimiste avec **rollback**, le
   compteur qui compte les `pending`, le ratio `pris/total` **enfin réel**, et le séparateur.

**Trois choses valent d'être signalées à la revue :**

- ⛔ **Un état neuf est né, et il n'avait aucune copie écrite** : « tout est pris » — des articles,
  aucun en `pending`. Réutiliser « Ta liste est vide. » y aurait été **faux** (la liste n'est pas
  vide, elle est faite), et de la même famille que l'échec qui affirmait le vide, corrigé en revue
  de la 4.2. Rédigé : **« Tout est dans le panier. »** ⚠️ **C'est une chaîne inventée par le dev
  agent, pas reprise d'`EXPERIENCE.md`** — à valider ou à réécrire.
- ✅ **La note que la 4.2 laissait à la story 4.5 tombe d'elle-même** : elle prévoyait que le
  dénominateur du ratio DÉCROÎTRAIT (`0/4 → 0/3`) parce qu'un article coché sortait de la vue. Il
  ne décroît plus — il vaut `1/4 → 2/4`, ce que le ratio annonçait depuis toujours.
- ⚠️ **La ligne-article est devenue une cible tactile.** La revue de la 4.2 avait retiré `reserve`
  du `Notice` au motif qu'« il n'y a ni formulaire ni cible sous la zone ». **Cette prémisse vient
  de changer.** Le message et la liste ne coexistent toujours jamais sur le chemin d'échec de
  lecture, mais l'échec de BASCULE, lui, laisse la liste montée — donc un message peut désormais
  apparaître au-dessus de cibles tapables. **À rouvrir en revue** (règle §5).

### File List

| Fichier | État |
|---|---|
| `supabase/migrations/20260813210000_elargir_la_vue_liste_aux_articles_achetes.sql` | **nouveau** — la vue élargie, avec sa requête de contrôle |
| `lib/liste/basculer.ts` | **nouveau** — `basculerStatut`, `statutApresGeste` |
| `lib/liste/basculer.test.ts` | **nouveau** — 3 tests sur le pur |
| `lib/liste/liste.ts` | modifié — `StatutArticle`, `estStatutConnu`, `statut`, `status` dans le `.select()` |
| `lib/liste/liste.test.ts` | modifié — 2 tests neufs, fixture et mapping à 9 colonnes |
| `lib/liste/groupement.ts` | modifié — `trierPanierEnBas`, appliquée dans `grouperParRayon` |
| `lib/liste/groupement.test.ts` | modifié — 5 tests neufs (panier, stabilité, non-mutation) |
| `app/globals.css` | modifié — `--checkbox-size`, `.coche`, `.ligne-article`, `.article-achete`, `.separateur-panier` |
| `app/courses/ListeCourses.tsx` | modifié — coche, bascule optimiste + rollback, compteur/ratio réels, séparateur, état « tout est pris » |
| `supabase/tests/isolation.test.ts` | modifié — 5 tests neufs + 4 helpers de lecture |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |

⚠️ **`lib/supabase/types.ts` n'est PAS régénéré, et c'est mesuré** — le bloc de type de la vue est
identique avant/après (la migration ajoute des lignes, pas des colonnes). ⚠️ **`package.json`
intact**, aucune dépendance.

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
| 2026-08-13 | parcours à l'écran | **PARCOURS FAIT, et il a trouvé un défaut que 257 tests ne voyaient pas.** ⛔ **Sécurité d'abord** : `.env.local` du dépôt pointe la **PRODUCTION** — le parcours a donc tourné sur un **serveur dédié** (port 3344) pointé sur le stack local, avec compte, foyer et 11 articles semés puis supprimés. Rien n'a touché la production. ✅ **Ce qui tient, vu à l'œil dans les DEUX thèmes** : compteur « 5 à prendre » puis **5 → 4** à la coche · ratio Crèmerie **1/3 → 2/3** · séparateur « DANS LE PANIER » présent quand il sépare et **absent quand le rayon est entièrement acheté** (Épicerie 3/3) · barré + coche pleine, libellé **resté lisible** · quantité de l'article coché en `muted-2`, celle d'un article à prendre en `muted` · accord « 6 pièces » / « 2 pièces » · coche vide au contour visible dans les deux thèmes · squelette portant bien son ombre. ⛔ **DÉFAUT TROUVÉ ET CORRIGÉ** : après une bascule, la Crèmerie rendait `Lait, Beurre` sous le séparateur ; **après rechargement, `Beurre, Lait`** — le même état affiché de deux façons selon qu'on venait de cocher ou non. Cause : l'état gardait `GroupeDeRayon[]`, **déjà trié pour l'affichage**, et une bascule regroupait ce tri-là au lieu de l'ordre de la base. Correctif : l'état garde la liste **à plat, dans l'ordre reçu**, et le regroupement est **dérivé** (`useMemo`) — une seule source de vérité, la même règle au chargement et après une coche. ⚠️ **Re-trier par nom aurait été le mauvais correctif** : c'est la collation Postgres qu'il aurait fallu réimplémenter, ce que l'AC3 interdit. Test de non-régression ajouté (idempotence de `grouperParRayon`), **et son commentaire dit ce qu'il NE garde pas** : le chemin composant reste hors de portée (NFR-10 interdit un harnais). ⚠️ **DEUX POINTS NON COUVERTS, DITS PLUTÔT QU'ESQUIVÉS** : (a) **NFR-3 aux largeurs réelles** — la fenêtre a refusé de se redimensionner, le contrôle à 320 px a été fait en contraignant le conteneur (0 débordement), ce qui est un **proxy, pas un viewport** ; (b) **le correctif n'a pas été revu à l'écran** — le navigateur a cessé d'exécuter le JS de la page, et §6 veut qu'une passe de correction soit revue à son tour. Portes après correctif : **258/258** · isolation **103 · 102 pass · 0 fail · 1 skipped** · typecheck · lint. |
| 2026-08-13 | dev-story | **Implémentée.** 3 fichiers neufs, 5 modifiés, **aucune dépendance**, **une migration**. Les **quatre décisions prises sur leur défaut prescrit**, faute d'arbitrage : D1(a) vue élargie · D2(a) la vraie coche ici · D3(a) `intent_at` écrit · D4(a) optimiste + rollback. ⛔ **La migration est ce qui rend la story possible** : la vue filtrait `status = 'pending'`, donc cocher faisait disparaître l'article et l'AC1 comme l'AC3 étaient inatteignables. Changement **additif**, `order by` inchangé (le tri du panier est un choix d'affichage, pas de contrat), `security_invoker` reconduit explicitement. ⚠️ **`status` a dû être ajouté à la chaîne `.select()`** — élargir la vue ne suffisait pas, et l'oubli aurait rendu `statut` `undefined` en silence. ⚠️ **`types.ts` NON régénéré, et c'est mesuré** : le bloc de type de la vue est identique (des lignes de plus, pas des colonnes), et la CLI locale diverge de celle épinglée en CI. ⛔ **Un état neuf est né sans copie écrite** — « tout est pris » : réutiliser « Ta liste est vide. » y aurait été faux. Rédigé « **Tout est dans le panier.** », **chaîne inventée ici et non reprise d'`EXPERIENCE.md`** — à valider. ✅ **La note laissée par la 4.2 à la story 4.5 tombe d'elle-même** : le dénominateur du ratio ne décroît plus. ⚠️ **Une affirmation fausse écrite puis corrigée en chemin, consignée** : le commentaire de `--checkbox-size` prêtait à Tailwind une génération d'utilitaires qui n'existe pas (mesuré à 0). Portes : `npm test` **257/257** (+8), isolation **103 · 102 pass · 0 fail · 1 skipped** (+5), typecheck, lint, `check:migrations` **17/15/2/0**, build 14 routes, **sonde CSS 4 classes neuves + 6 contrôles négatifs à 0**, **contraste de la coche mesuré** (3,638:1 clair · 4,359–4,768:1 sombre, seuil 3:1 tenu). ⛔ **RESTE DÛ : le parcours à l'écran**, laissé non coché avec sa raison — aucune porte automatique ne voit un rendu (§7). |
| 2026-08-12 | create-story | Contextualisation sur `5b43c77`. **Seize mesures exécutées sur le stack local**, dont une qui change la forme de la story : ⛔ **M3 — cocher un article le fait DISPARAÎTRE de la vue** (`where status = 'pending'`), donc l'AC1 et l'AC3 sont inatteignables sans élargir la lecture. Quatre décisions ouvertes avec leur défaut prescrit : **D1** la visibilité des cochés (migration additive) · **D2** qui possède la coche, 4.3 ou 4.13 · **D3** `intent_at` écrit dès maintenant — **M4bis mesuré : un `UPDATE` de `status` laisse `intent_at` périmé**, et la 4.10 en dépend · **D4** mise à jour optimiste avec rollback. ✅ **Rien à migrer pour la colonne ni la RLS** : `status` et `grocery_update` existent déjà (M7, M8), et les tokens de coche vide sont posés (M10). ⚠️ Une première sonde de `intent_at` a rendu un résultat trompeur (`now()` constant en transaction) — refaite hors transaction et signalée comme telle plutôt qu'effacée. |
