# Révision de l'Epic 2 avant sa première story

_Établi le 2026-07-29, sur `main` à `4ee719a`. Déclencheur : `next-steps.md` §3, qui interdit de
lancer `create-story` sur la 2.1 en l'état. Le constat qui suit est **plus large** que celui que §3
consigne : §3 ne nommait que la 2.1, et six stories sur sept sont concernées._

Tout ce qui est affirmé ici est **lu dans le fichier cité**, pas déduit.

---

## 1. Le constat en une phrase

`supabase/migrations/20260502000000_initial_schema.sql` — la migration du squelette, antérieure à
tout l'Epic 1 — contient déjà **le moteur entier de l'Epic 2** : la table des règles, la fonction de
résolution à trois niveaux, l'amorçage des rayons, la vue de liste ordonnée par parcours, et les
politiques RLS de tout cela. Ce qui manque à l'Epic 2 n'est pas son moteur : ce sont **ses écrans**.

Et une partie de ses critères ne se démontre pas sur un écran de rayons, mais **sur la liste de
courses** — qui est l'Epic 4.

---

## 2. Ce qui existe déjà, story par story

| Story | Déjà en base (fichier : ligne) | Ce qui manque réellement |
|---|---|---|
| **2.1** Amorcer | `seed_default_aisles()` (`:330`) — 11 rayons français, icône, `sort_order` distincts ; appelée par `create_household_with_profile` (`:381`) ; idempotente via `on conflict (household_id, name) do nothing` (`:349`) ; RLS `aisles_all` | **AC1 et AC3 tenus.** AC2 seul reste : rien n'appelle la fonction hors création de foyer |
| **2.2** Gérer | table `aisles` (`:74`), `unique (household_id, name)` ; **`grocery_list_items.aisle_id` est `on delete set null`** (`:201`) → un rayon supprimé fait basculer ses articles en « À classer » **par le schéma** | **AC3 déjà tenu structurellement.** Manque : l'écran CRUD et l'état vide (AC4) |
| **2.3** Réordonner | `sort_order int` (`:78`), index `(household_id, sort_order)` (`:84`), vue `grocery_list_by_aisle` ordonnée `coalesce(a.sort_order, 9999), g.name` (`:226`) | **AC2 tenu côté données.** Manque : l'interaction de manipulation directe |
| **2.4** Règles | `product_aisle_map` (`:115`) — `product_id` **ou** `keyword`, `check` à l'appui ; index GIN `to_tsvector('french', keyword)` (`:125`) ; RLS `aisle_map_all` (`:289`) | L'écran des règles. **AC3 est infondé — voir §4** |
| **2.5** Résoudre | **`resolve_aisle_id()` entier** (`:466`) — produit exact, puis mot-clé `like`, puis repli recette ; `order by length(m.keyword) desc` **est** le « plus spécifique gagne » de FR-13 ; rend `null` si rien ne matche, donc « À classer » | AC1 exige que « tout chemin d'ajout » y passe. **Il n'existe aucun chemin d'ajout** — c'est la story 4.4 |
| **2.6** À classer | vue `grocery_list_by_aisle` en `left join` + `coalesce(sort_order, 9999)` (`:217`) → les sans-rayon existent et tombent en fin de parcours | AC1/AC2 disent « **quand la liste s'affiche** ». Il n'y a pas de liste. Seul AC3 (composant carte-rayon) est bâtissable seul |
| **2.7** Apprendre | rien | Tout — et ça suppose de **déplacer un article**, donc la liste, donc l'Epic 4 |

---

## 3. Le vrai problème d'ordonnancement

Trois stories (**2.5, 2.6, 2.7**) et un critère chacune de **2.2 et 2.3** ont des critères
d'acceptation qui s'énoncent sur la liste de courses. Or la liste est l'Epic 4.

Écrites telles quelles, elles ne sont pas « difficiles à tester » : elles sont **indémontrables**.
On peut les implémenter et les cocher, mais la seule preuve possible serait une déduction — c'est
exactement ce que `next-steps.md` §4 interdit depuis l'Epic 1, et le motif qui a coûté trois défauts
en deux jours.

La formule de l'objectif d'epic entretient l'illusion : « donner au foyer un tri de liste qui suit
*son* magasin ». Le tri de liste n'est pas de ce ressort — l'Epic 2 produit **la table de tri et les
écrans qui la peuplent**, l'Epic 4 s'en sert.

---

## 4. Un défaut isolé, à traiter à part

**Story 2.4, AC3** : « cette gestion reste une surface de Florian et n'est jamais exposée à la
conjointe (test d'acceptation, **NFR-9**) ».

Deux problèmes, tous deux vérifiés :

1. **NFR-9 ne dit pas ça.** Lu à `epics.md:114`, NFR-9 porte sur le **ton** — « aucun jargon
   visible », avec sa liste de mots bannis. Il n'a aucun rapport avec le contrôle d'accès. La
   citation est fausse.
2. **La capacité demandée n'a aucun support.** `profiles` (`:30`) n'a **pas de colonne de rôle** :
   `id`, `household_id`, `display_name`, les cibles nutritionnelles, `restrictions`, `preferences`.
   Rien ne distingue Florian de la conjointe. Toutes les politiques RLS passent par
   `current_household_id()`, qui est **par foyer**, jamais par membre.

Distinguer deux membres au sein d'un foyer est une **décision de produit non prise**, avec un coût
de schéma, de RLS et de tests d'isolation. Elle ne peut pas être avalée en passant par un critère
d'acceptation d'une story d'écran.

---

## 5. Quatre décisions à prendre

### D1 — Que devient la story 2.1 ?

Trois de ses quatre critères sont tenus depuis le squelette.

| Option | Coût | Effet |
|---|---|---|
| **A. La supprimer, absorber AC2 dans la 2.2** | nul | Plus de story fantôme. Le cas « foyer sans rayons » naît de la 2.2, il s'y traite |
| B. La réduire à AC2 seul | faible | Garde une story dont le seul contenu est un cas qui ne peut pas encore survenir |
| C. La laisser | nul à l'écriture | Réimplémentation garantie de code qui tourne en production |

**Recommandation : A.** Le cas « foyer dépourvu de rayons » ne peut naître que d'une suppression
totale, c'est-à-dire du dernier critère de la 2.2. Les deux stories décrivent le même événement
depuis deux bouts ; une seule doit le porter. *(C'est le recouvrement que §3 demandait de trancher.)*

### D2 — Que fait-on de 2.5, 2.6, 2.7 ?

| Option | Effet |
|---|---|
| **A. Les déplacer vers l'Epic 4**, au contact de la liste | Chaque critère devient démontrable là où il est écrit. L'Epic 2 se réduit à ce qu'il est : les écrans de configuration |
| B. Les garder, en assumant qu'elles ne seront cochées qu'après l'Epic 4 | Trois stories « done » sans preuve pendant deux epics — le motif que la rétro condamne |
| C. Remonter l'Epic 4 avant l'Epic 2 | La liste d'abord ; mais elle a besoin des rayons pour se grouper, donc on déplace le problème |

**Recommandation : A**, avec une nuance — l'AC3 de la 2.6 (le **composant carte-rayon**) reste dans
l'Epic 2 : il est bâtissable et visible sur l'écran des rayons, et l'Epic 4 le réutilise.

### D3 — Reformule-t-on l'objectif de l'Epic 2 ?

Actuel : « donner au foyer un tri de liste qui suit *son* magasin et s'améliore chaque semaine ».
Proposé : **« rendre les rayons visibles, modifiables et ordonnables, et poser les règles qui les
alimentent »** — ce que l'epic livre réellement une fois D2 appliquée.

**Recommandation : oui.** L'objectif actuel promet un résultat que l'Epic 4 seul peut montrer, et
c'est ce qui a permis d'écrire trois stories indémontrables sans que ça se voie.

### D4 — Que fait-on de la distinction Florian / conjointe (2.4 AC3) ?

| Option | Coût | Effet |
|---|---|---|
| **A. Sortir la capacité en décision de produit à part**, retirer AC3 de la 2.4 | faible | Le trou est nommé au lieu d'être caché dans un critère. Se tranche avec son vrai coût sous les yeux |
| B. L'implémenter dans la 2.4 | colonne de rôle + RLS par membre + tests d'isolation à rejouer | Une story d'écran qui refait le modèle de permissions |
| C. La retirer purement | nul | Perd une intention réelle du PRD — l'asymétrie des deux surfaces |

**Recommandation : A.** Et corriger la citation NFR-9, fausse, où qu'elle apparaisse.

---

## 6. Ce que ça ne change pas

- Aucune migration à écrire pour ces décisions : elles portent sur `epics.md`, pas sur la base.
- `seed_default_aisles`, `resolve_aisle_id`, `product_aisle_map` et la vue **restent tels quels**.
  Ils sont en production et couverts par les tests d'isolation depuis le 2026-07-29.
- L'Epic 2 reste le prochain epic. Il devient plus petit et entièrement démontrable.

## 7. Une observation mineure, hors décisions

`resolve_aisle_id` (`:466`) est la **seule** fonction du fichier sans `set search_path = public` —
`current_household_id`, `seed_default_aisles`, `create_household_with_profile`,
`redeem_household_invite`, `generate_household_invite` le posent toutes. Elle n'est pas
`security definer`, donc elle s'exécute avec les droits de l'appelant et il n'y a **pas
d'escalade de privilège** à la clé : la portée est une résolution de nom inattendue, pas une fuite
entre foyers. À corriger par cohérence quand la story qui la touche s'ouvrira, pas en urgence.
