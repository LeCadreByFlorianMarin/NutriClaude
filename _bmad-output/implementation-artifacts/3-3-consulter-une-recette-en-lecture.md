---
baseline_commit: 8f91f521d863c7f45dc1b1603d01efed03625832
---

# Story 3.3: Consulter une recette en lecture

Status: review

<!-- Troisième story de l'Epic 3, et la première qui RENDE du texte écrit par le membre.
     C'est elle qui encaisse la dette posée par la 3.1 (`normaliserMultiligne` existe pour
     que son AC2 soit démontrable) et qui rouvre la question de la CSP, différée à l'Epic 6
     au motif qu'aucune surface XSS n'existait encore. Piège n°2.
     Les quatre questions ont été TRANCHÉES le 2026-08-02 — voir § Décisions. -->

## Story

As a membre du foyer,
I want lire une recette avec ses instructions rendues proprement,
So that je puisse la suivre en cuisinant, sans avoir à ouvrir un écran d'édition.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-3.3`.

**AC1 — Tout est là, et en lecture**
**Given** une recette du répertoire
**When** un membre l'ouvre en lecture
**Then** son titre, sa description, ses portions, son temps, sa liste d'ingrédients et ses
**instructions sont rendus lisiblement** (FR-18), pas dans une zone d'édition

**AC2 — La mise en forme survit**
**Given** les instructions d'une recette
**When** elles sont affichées
**Then** leur mise en forme est préservée à la lecture (retours à la ligne / étapes), sans exposer
de balisage brut

**AC3 — Les trous sont propres**
**Given** une recette sans description ou sans instructions
**When** elle est consultée
**Then** l'affichage reste propre, sans champ vide disgracieux ni erreur

> **AC1 nomme « sa liste d'ingrédients », et c'est nouveau pour cet écran.** Les ingrédients
> existent depuis la story 3.2 mais ne se voient que dans l'éditeur. `ingredientsDeRecette` est déjà
> écrit, testé et prêt — voir le tableau « ce qui existe déjà ».

> **⚠️ « son temps » est au singulier et la base en porte DEUX** (`prep_time_min`,
> `cook_time_min`), tous deux nullables. Ce n'est pas un détail de rendu : les quatre combinaisons
> (aucun, l'un, l'autre, les deux) tombent toutes sous l'AC3. Voir piège n°4.

## Tasks / Subtasks

- [x] **Task 1 — `lib/recettes/lecture.ts` : le pur de l'affichage, en TDD** (AC1, AC3)
  - [x] Phase rouge **constatée** avant l'implémentation
  - [x] `formaterQuantite(q: number | null): string | null` — **le séparateur décimal français**
        (piège n°3). `null` pour « rien à afficher », jamais `""`
  - [x] `formaterTemps(prep, cuisson): string | null` — les **quatre** combinaisons, `null` quand
        il n'y a rien à dire (piège n°4)
  - [x] `formaterPortions(n: number): string` — accord singulier/pluriel
  - [x] Tests : `0.5` → « 0,5 » ; `400` → « 400 » ; `null` → `null` ; les quatre combinaisons de
        temps ; 1 personne / 4 personnes

- [x] **Task 2 — `/recettes/[id]` : l'écran de lecture** (AC1, AC2, AC3)
  - [x] `app/recettes/[id]/page.tsx` — Server Component. ⚠️ **`params` est une `Promise`**
        (`strictRouteTypes`), et les trois chemins d'introuvable mènent à `notFound()` — la garde
        est déjà dans `recetteParId` (piège n°6)
  - [x] **Aucun composant client, aucun `"use client"`** : cet écran ne fait qu'afficher. C'est
        d'ailleurs ce qui rend l'AC1 (« pas dans une zone d'édition ») littéralement vrai
  - [x] Titre, description, portions, temps, ingrédients, instructions
  - [x] ⚠️ **`whitespace-pre-wrap` sur les instructions, et RIEN d'autre** (piège n°1)
  - [x] Un lien « Modifier » vers `/recettes/[id]/modifier`
  - [x] `generateMetadata` pour que l'onglet porte le titre de la recette (décision 2) —
        ⚠️ elle **ne lève jamais** sur une recette introuvable ; c'est le composant qui décide
        du `notFound()` (piège n°7)

- [x] **Task 3 — Les trous, un par un** (AC3)
  - [x] Description absente, instructions absentes, **aucun ingrédient**, les deux temps absents,
        et la combinaison de tous
  - [x] ⚠️ Un temps à **`0`** s'affiche (décision 3) — le test est `!== null`, jamais
        `if (!temps)`, qui attraperait `0` ET `null` en silence (piège n°4)
  - [x] ⚠️ **Une section vide ne s'affiche pas** — pas de titre orphelin, pas de tiret, pas de
        « Non renseigné ». L'absence se dit par l'absence (piège n°5)
  - [x] Sauf **les ingrédients** : une recette sans ingrédient a quelque chose à dire, et c'est un
        lien vers l'édition (piège n°5)

- [x] **Task 4 — Recâbler la navigation** (AC1)
  - [x] `app/recettes/ListeRecettes.tsx:126` — la cible passe de `/recettes/[id]/modifier` à
        `/recettes/[id]`. ⚠️ Le commentaire juste au-dessus (`:118-123`) **annonce ce changement** :
        il devient faux avec ce commit et doit être réécrit (piège n°8)
  - [x] `app/recettes/[id]/modifier/page.tsx:27` — son commentaire dit « la story 3.3 ajoutera
        `/recettes/[id]` en LECTURE ». Faux à partir de maintenant
  - [x] Le lien de retour de l'écran d'édition reste **« ← Tes recettes »** — décision 1,
        rien à changer. Vérifie-le, ne le touche pas

- [x] **Task 5 — Le parcours à l'écran, dans les deux thèmes** (AC1, AC2, AC3)
  - [x] Stack local, `localhost:3333`. ⚠️ `.env.local` pointe sur la **production** : bascule et
        **restaure en comparant l'empreinte SHA-256**
  - [x] Une recette complète, puis une **totalement vide** (titre seul)
  - [x] ⚠️ **Les instructions sur un texte à lignes vides intérieures**, relues à l'écran : c'est
        AC2, et c'est la dette que la story 3.1 a payée d'avance
  - [x] Les deux thèmes au réglage système, **remis après**
  - [x] 200 % de zoom, largeur 390 px, focus mesuré dans le DOM
  - [x] Les six portes
  - [x] ⚠️ **Aucun `loading.tsx` sur cette route** (décision 4). Écris-le dans les notes de
        complétion : c'est une absence décidée, pas subie

- [x] **Task 6 — Trancher la CSP, une bonne fois** (hors AC, mais c'est ici que ça se joue)
  - [x] ⚠️ **C'est cette story qui rend du texte écrit par le membre.** L'échéance de la CSP a été
        repoussée à l'Epic 6 en écrivant « cet epic n'a pas ouvert de surface XSS ». Vérifie que
        c'est **toujours vrai après cette story**, et écris la conclusion (piège n°2)
  - [x] Si tu introduis quoi que ce soit qui rende du HTML, **arrête-toi et repose la question**

---

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où | Ce que ça implique |
|---|---|---|
| Lecture d'une recette, garde d'uuid comprise | `lib/recettes/recettes.ts` — `recetteParId` | **Rien à écrire.** Rend `null` sur les trois cas d'introuvable |
| Lecture des ingrédients, dans l'ordre | `lib/recettes/ingredients.ts` — `ingredientsDeRecette` | **Rien à écrire.** Tri `sort_order` puis `created_at` déjà en place |
| Les retours à la ligne **en base** | `normaliserMultiligne` (story 3.1) | **La moitié d'AC2 est déjà tenue** : les `\n` sont stockés. Reste à les rendre |
| Isolation par foyer | `recipes_all`, `recipe_ingredients_all` | **Aucun filtre `household_id`** ; la RLS suffit |
| `notFound()` et son écran | `app/not-found.tsx`, motif de `/recettes/[id]/modifier` | Réutilise |
| Écran plein à un seul message | `app/_lib/EcranMessage.tsx` | Pour l'état « rien à afficher », si besoin |
| Le vocabulaire d'unités | `lib/recettes/unites.ts` — `UNITES` | Ici on ne fait qu'**afficher** ce qui est stocké |
| Tokens, largeur, typographie | `app/globals.css`, `max-w-2xl` des deux écrans recettes | Compose, n'invente pas |

⚠️ **Cet écran n'écrit rien.** Aucun `createNavigateurClient`, aucun `useSoumission`, aucun
`Notice`, aucune région de statut. Si tu te retrouves à en poser un, c'est que tu as glissé hors du
périmètre.

### Piège n°1 — AC2 se tient avec UNE déclaration CSS, et tout le reste est un piège

Les instructions sont déjà stockées avec leurs `\n` — `normaliserMultiligne` existe précisément
pour ça, et la story 3.1 l'a mesuré (3 sauts de ligne conservés en base). **Il ne reste qu'à les
rendre**, et la réponse est :

```jsx
<p className="whitespace-pre-wrap">{recette.instructions}</p>
```

`pre-wrap` conserve les retours à la ligne **et les lignes vides intérieures**, tout en laissant le
texte se replier sur la largeur disponible — c'est exactement « retours à la ligne / étapes » sans
défilement horizontal.

⚠️ **Ce qu'il ne faut PAS faire, et chacun a sa raison :**

| Tentation | Pourquoi non |
|---|---|
| Un parseur Markdown | **NFR-10** interdit la dépendance, et AC2 dit « sans exposer de balisage brut » — donc il n'y a pas de balisage à parser |
| `dangerouslySetInnerHTML` | Ouvre une vraie surface XSS sur un champ écrit par un membre, sur un produit **sans CSP** (piège n°2). Le cookie de session est lisible en JavaScript et dure 400 jours |
| `texte.split("\n").map(...<br/>)` | Marche, mais réinvente `pre-wrap` en JSX, perd les espaces significatifs, et demande une `key` par ligne — trois occasions de se tromper pour zéro gain |
| `.replace(/\n/g, "<br>")` | La pire : c'est `dangerouslySetInnerHTML` déguisé |

⚠️ **`whitespace-pre-wrap` n'est pas concerné par la neutralisation de la palette.** `globals.css`
ne remet à `initial` que `--color-*` (`:110`) et `--radius-*` (`:123`) ; les utilitaires de
`white-space` sont statiques. *Lu dans le fichier, pas mesuré au build — confirme-le en regardant le
rendu, ce que la Task 5 demande de toute façon.*

### Piège n°2 — C'est CETTE story qui rouvre la question de la CSP

Le 2026-08-01, l'échéance de la `Content-Security-Policy` a été repoussée de « l'epic qui introduit
du contenu libre saisi par le membre (recettes, articles) » à **l'Epic 6, avec la story PWA**. La
raison écrite dans `deferred-work.md` et dans `next.config.ts` était :

> *« cet epic est arrivé, la story 3.1 a ouvert les recettes, et il n'a pas ouvert de surface XSS :
> React échappe tout ce qu'il rend, il n'y a ni `dangerouslySetInnerHTML`, ni parseur Markdown, ni
> rendu HTML brut, et NFR-10 interdit la dépendance qui en apporterait un. »*

**Cette affirmation portait sur l'écriture. Celle-ci est la story qui LIT.** Elle reste vraie tant
que le rendu passe par `{recette.instructions}` — React échappe, `pre-wrap` est du CSS. Mais c'est
ici, et nulle part ailleurs, que quelqu'un pourrait la rendre fausse en une ligne.

**D'où la Task 6, qui n'a pas de critère d'acceptation et qui n'est pas facultative :** vérifier que
la prémisse tient encore, et l'écrire. Une prémisse qui sert à reporter un défaut se rouvre avant
d'être réinvoquée — c'est la règle §5 de `project-context.md`, celle qui a couvert le trou
`profiles_update_own` pendant tout l'Epic 1.

### Piège n°3 — Le produit saisit « 0,5 » et réafficherait « 0.5 »

**Mesuré le 2026-08-02.** PostgREST rend `quantity` en nombre JSON — `400.00` et `0.50` sur le fil,
qui deviennent `400` et `0.5` après `JSON.parse`. Rendus tels quels en JSX, ils s'affichent
**« 400 » et « 0.5 »**.

Or `normaliserQuantite` (story 3.2) **accepte explicitement la virgule française**, avec ce
commentaire : *« un clavier français produit une virgule, et `Number("0,5")` vaut NaN »*. Le membre
tape donc « 0,5 » et le produit lui répond « 0.5 » — sur un produit dont NFR-8 exige le français et
dont UX-DR12 impose `tabular-nums` sur tout chiffre.

`(0.5).toLocaleString("fr-FR")` rend **« 0,5 »** — vérifié.

⚠️ **Le défaut existe déjà sur l'écran d'édition de la story 3.2**, où la ligne repliée affiche
`{i.quantite}` brut. Cette story ne le corrige **pas** là-bas — déborder sur l'écran d'une autre
story rend sa propre revue plus difficile. **Consigne-le dans `deferred-work.md`** et corrige-le
seulement ici, où l'AC1 t'oblige à afficher la quantité.

⚠️ **`toLocaleString` sans argument suivrait la locale du NAVIGATEUR**, donc afficherait « 0.5 » à
un membre dont le système est en anglais. Le produit est en français par NFR-8 : la locale est
**écrite en dur**, pas déduite.

### Piège n°4 — « son temps » au singulier, deux colonnes nullables, quatre cas

`prep_time_min` et `cook_time_min` sont tous deux `int` **nullables**. Les quatre combinaisons
existent et tombent toutes sous l'AC3 :

| `prep` | `cuisson` | Ce qu'il faut afficher |
|---|---|---|
| 15 | 30 | les deux, distingués — ce sont deux choses différentes (temps actif / passif) |
| 15 | — | la préparation seule |
| — | 30 | la cuisson seule |
| — | — | **rien du tout**, pas même l'intitulé |

⚠️ **N'additionne pas les deux en un « temps total ».** La story 3.1 a tranché en gardant deux
champs, précisément parce qu'un livre de cuisine les sépare — les fusionner à l'affichage
défairait la décision, et rendrait « 45 min » pour une recette qui demande 15 min de présence.

⚠️ **`0` S'AFFICHE, comme les autres** (décision 3 du 2026-08-02). `cook_time_min = 0` est une
valeur **saisie**, distincte de `null` qui veut dire « non renseigné ». Les masquer toutes les deux
confondrait « je n'ai pas répondu » et « il n'y en a pas ».

⚠️ **Et c'est précisément pour ça que le test est `!== null`, jamais `if (!temps)`.** Un test de
véracité attrape `0` **et** `null` — donc il fait exactement l'erreur que cette décision interdit,
et il la fait en silence. Les quatre lignes du tableau ci-dessus deviennent alors trois, sans que
rien ne le signale. **Teste les deux valeurs**, pas seulement les deux absences.

### Piège n°5 — « Sans champ vide disgracieux » veut dire : la section n'existe pas

AC3 est un critère d'**absence**, et c'est le plus facile à rater en le prenant pour un critère de
message. Ce qu'il interdit :

- un intitulé « Description » suivi de rien ;
- un tiret, un « — », un « Non renseigné », un « (vide) » ;
- une bordure ou une marge qui trahit une section absente.

**Une section sans contenu ne se rend pas du tout.** C'est du JSX conditionnel, pas du CSS.

⚠️ **Une exception, et une seule : les ingrédients.** Une recette sans ingrédient n'est pas un
champ vide — c'est une recette inachevée, et le membre a quelque chose à y faire. Un mot et un lien
vers l'édition, motif de l'état vide du répertoire (`ListeRecettes:110-117`). C'est aussi l'état
**nominal** de toute recette au sortir de la story 3.1, qui crée au titre seul.

⚠️ **Le titre et les portions ne sont jamais vides** — `recipes_titre_non_vide` et
`recipes_servings_positif` (story 3.1) le garantissent en base. Ne les traite pas comme
conditionnels : ce serait du code mort qui suggère une possibilité qui n'existe pas.

### Piège n°6 — Les trois chemins d'introuvable sont déjà gardés, ne les réécris pas

`recetteParId` (story 3.1) rend `null` dans les trois cas — identifiant qui n'est pas un uuid,
recette inexistante, recette d'un autre foyer — et c'est **délibéré** : les distinguer serait au
mieux inutile, au pire une fuite. Sous RLS, la base elle-même ne fait pas la différence.

Le seul geste de cet écran est donc `if (!recette) notFound();`, exactement comme
`/recettes/[id]/modifier`. **Ne rajoute ni contrôle d'uuid, ni message spécifique.**

⚠️ **`params` est une `Promise`.** `strictRouteTypes: true` est activé précisément pour que le
typage l'attrape : sans lui, un `params` mal typé passerait `tsc` **et** `next build`, et
`params.id` vaudrait `undefined` à l'exécution.

⚠️ **Deux lectures, deux `await`.** `recetteParId` puis `ingredientsDeRecette`. Les enchaîner en
séquence est correct et suffisant à cette échelle ; un `Promise.all` économiserait un aller-retour
mais empêcherait de sortir en `notFound()` avant la seconde lecture. **Le séquentiel est le bon
choix ici** — dis-le, pour qu'une revue n'y voie pas une négligence.

### Piège n°7 — Le titre de l'onglet, et le piège qu'il porte

Les deux écrans recettes exportent un `metadata` **statique** (« Tes recettes », « Modifier une
recette »). Pour que l'onglet porte le titre de la recette, il faut `generateMetadata`.

⚠️ **Elle refait une lecture.** Next met en cache les requêtes d'un même rendu, mais notre client
Supabase n'est pas instrumenté pour ça : `generateMetadata` et le composant liront **deux fois**.
Sans portée sur un écran de configuration — mais sache-le, et n'en déduis pas qu'il faut un cache.

⚠️ **Une recette introuvable passe aussi par `generateMetadata`.** Elle doit rendre un titre neutre
et **ne pas lever** : c'est le composant qui décide du `notFound()`, pas elle.

⚠️ **Le titre est du texte écrit par le membre.** Il est échappé par React dans le corps, mais un
titre d'onglet n'est pas du HTML — aucun risque, juste une raison de plus de ne pas le bricoler.

*Si `generateMetadata` te paraît disproportionné, laisse le `metadata` statique et dis-le : c'est un
choix défendable, pas un oubli. Mais alors ne laisse pas « Modifier une recette » sur un écran de
lecture.*

### Piège n°8 — Deux commentaires qui deviennent faux avec ce commit

C'est le défaut de **texte d'annonce périmé**, que les stories 1.6, 1.7, 2.1, 2.2 et 3.1 ont
**chacune** eu à réparer. Deux endroits l'annoncent déjà :

- `app/recettes/ListeRecettes.tsx:118-123` — *« ⚠️ La cible mène à l'ÉDITION, et ce ne sera pas
  toujours vrai : la story 3.3 introduira `/recettes/[id]` en lecture, et c'est elle qui deviendra
  la destination naturelle d'un titre. Écrit ici pour que le changement soit prévu plutôt que
  subi. »* — **c'est maintenant.**
- `app/recettes/[id]/modifier/page.tsx:27` — *« La story 3.3 ajoutera `/recettes/[id]` en
  LECTURE »* — au futur, alors que ce sera fait.

Les deux se réécrivent **dans le même commit** que le changement, jamais après.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Modifier quoi que ce soit depuis cet écran | **Story 3.1 / 3.2** — il y a un lien vers l'éditeur, c'est tout |
| Étiquettes, filtre, recherche | **Story 3.4** |
| Grille du menu, assignation | **Stories 3.5 et 3.6** |
| Une case à cocher par ingrédient (« j'ai mis celui-là ») | **jamais ici** — la coche appartient à la liste de courses (Epic 4) |
| Mettre les quantités à l'échelle pour N personnes | **Epic 4** (FR-16) — l'écran affiche les portions de la recette, pas un calcul |
| Markdown, HTML, éditeur riche | **jamais** — NFR-10, et AC2 bannit le balisage brut |
| Impression, export, partage | **hors périmètre** — aucun critère |
| Corriger l'affichage décimal de l'écran d'édition | **story 3.2, à consigner** (piège n°3) |
| La `Content-Security-Policy` | **Epic 6** — mais la prémisse se **revérifie** ici (Task 6) |
| Realtime | **Epic 4** (AD-8) |

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Portions | « Pour 4 personnes » · « Pour 1 personne » | « Servings : 4 » · « 4 portions » |
| Les deux temps | « 15 min de préparation, 30 min de cuisson » | « Prep 15 / Cook 30 » · « Temps total : 45 min » |
| Un seul temps | « 15 min de préparation » | « Préparation : 15, Cuisson : — » |
| Section ingrédients | « Ce qu'il faut » | « Liste des ingrédients » |
| Ingrédient optionnel | « on peut s'en passer » | « (optionnel) » · « facultatif* » |
| Aucun ingrédient | « Tu n'as pas encore mis d'ingrédients. » + un lien « Les ajouter » | « Aucun enregistrement » · un tableau vide |
| Section instructions | « Comment on la fait » | « Instructions » · « Mode opératoire » |
| Lien vers l'édition | « Modifier » | « Éditer la recette » · « Mode édition » |
| Lien de retour | « ← Tes recettes » | « ← Retour » (deux parents possibles) |
| Recette introuvable | l'écran `not-found` existant | **jamais** « Réessaie » |

**Pas d'abricot** : UX-DR2 le réserve à l'action courses. L'anneau de focus reste la seule
exception, déjà globale.

**DESIGN.md ne spécifie pas cet écran** (`:329` — l'éditeur de recettes est hors de son périmètre de
composition). Mais **DESIGN.md et EXPERIENCE.md disent que les recettes « peuvent respirer au grand
écran »** : garde le `max-w-2xl` des deux autres écrans recettes, et sers-toi de la place pour la
lisibilité d'un texte qu'on lit **en cuisinant, debout, à distance du plan de travail**. C'est le
seul écran de l'Epic 3 qui se consulte les mains occupées.

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — rien à écrire ici, donc rien à garder ; la RLS filtre déjà les deux lectures
- **AD-13** — cet écran est un **rendu serveur pur**. Pas de client-direct parce qu'il n'y a pas
  d'écriture, et pas de `"use client"` parce qu'il n'y a pas d'interaction
- **AD-16** — recettes partagées entre tous les membres ; foyer **symétrique**
- **NFR-3** — les recettes peuvent respirer au grand écran ; seul l'écran liste porte la contrainte
  du magasin. Mais le 200 % de zoom reste dû
- **NFR-8 / NFR-9** — français, aucun jargon, aucun message technique brut
- **NFR-10** — **aucune dépendance nouvelle.** Ni Markdown, ni sanitizer, ni bibliothèque de
  formatage de nombres : `Intl` est natif
- **UX-DR11 / UX-DR12** — contraste AA sur les fonds réels, anneau de focus, 200 % de zoom ;
  `tabular-nums` sur tout chiffre

### Standards de test

**Comptes mesurés le 2026-08-02 sur `8f91f52`** (`main`, story 3.2 fusionnée) :

1. **`npm test`** — glob `lib/**/*.test.ts`, **142/142**. C'est là que va la Task 1 : le formatage
   est pur, donc entièrement testable
2. **`npm run test:isolation`** — **55/55**. ⚠️ **Cette story n'ajoute probablement RIEN ici** :
   elle ne fait que lire, par des fonctions dont l'isolation est déjà prouvée. Si tu n'ajoutes
   aucun test d'isolation, **dis-le et dis pourquoi** — une case vide honnête vaut mieux qu'un test
   décoratif
3. **Le manuel** — le JSX reste intestable sans dépendance (NFR-10). **AC2 et AC3 se vérifient
   là**, et nulle part ailleurs

⚠️ `node --test` sur un glob vide rend 0. ⚠️ **Vérifie les dents** de ce que tu ajoutes.

⚠️ **Une leçon de la story 3.2 sur les dents :** une mutation qui ne fait rien tomber n'est pas
forcément un test sans dent — ce peut être un **no-op**. Retirer le `with check` d'une politique
`FOR ALL` n'ouvre rien, Postgres réutilisant l'expression `using`.

### Project Structure Notes

```
app/recettes/
  [id]/page.tsx               +  L'ÉCRAN DE LECTURE. Server Component, aucun "use client"
  [id]/modifier/page.tsx      ~  son commentaire :27 devient faux (piège n°8)
  ListeRecettes.tsx           ~  la cible du lien :126, ET le commentaire :118-123 (piège n°8)
lib/recettes/
  lecture.ts + lecture.test.ts  +  formaterQuantite, formaterTemps, formaterPortions
  recettes.ts                 INCHANGÉ — `recetteParId` fait déjà tout
  ingredients.ts              INCHANGÉ — `ingredientsDeRecette` fait déjà tout
  unites.ts                   INCHANGÉ — on affiche ce qui est stocké
deferred-work.md              ~  l'affichage décimal de l'écran d'édition (piège n°3),
                                 et la conclusion de la Task 6 sur la CSP
supabase/migrations/          AUCUNE — cette story ne touche pas au schéma
lib/supabase/types.ts         INCHANGÉ — aucune migration, donc aucune régénération
app/globals.css               INCHANGÉ par défaut — `whitespace-pre-wrap` est un utilitaire
proxy.ts, package.json        INTACTS — aucune dépendance (NFR-10)
```

⚠️ **Aucune migration. C'est la première story de l'Epic 3 dans ce cas** — les trois précédentes en
portaient une ou deux. Si tu te retrouves à en écrire une, arrête-toi : c'est le signe que tu as
débordé.

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session.** Trois règles mordent ici :

- **Ne consigner comme vérifié que ce qui a été exécuté.** Cette story distingue le mesuré du lu à
  chaque fait ; fais pareil.
- **Un commentaire explique un pourquoi, jamais un état de la base** — d'où le piège n°8, qui porte
  sur deux commentaires devenus faux.
- **Une prémisse qui sert à reporter un défaut se rouvre avant d'être réinvoquée** — c'est
  exactement la Task 6 sur la CSP.

**Une case vide honnête vaut mieux qu'une case cochée à tort.** Toutes les stories depuis la 1.5 en
ont laissé ; la revue l'a préféré à chaque fois.

### Intelligence git

`main` est à **`8f91f52`** (story 3.2 fusionnée le 2026-08-02, déploiement de production réussi).
**Aucune PR ouverte.** Branche directement depuis `main` — la dépendance de branche qui pesait sur
la 3.2 est levée.

**13 migrations** en place ; cette story n'en ajoute aucune, donc rien à horodater et rien à
régénérer.

⚠️ **`main` est protégée** : `verify` et `isolation` requis, `strict`, push direct interdit. Depuis
`vercel.json`, un commit sur `main` applique les migrations en production — sans objet ici, mais
**fusionner reste mettre en ligne**, et le déploiement de `main` se regarde réussir.

⚠️ **Trois stories d'affilée (2.2, 3.1, 3.2) sont parties en production SANS revue adversariale**,
alors que la règle n°6 de `project-context.md` en demande une par story. Ce n'est pas le problème de
cette story, mais c'est le contexte dans lequel elle arrive : **le dernier filet n'a pas été tendu
depuis trois fois**.

Conventional Commits, corps en français ; branche → PR → **squash merge** CI verte. Versions à ne
pas bouger : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`,
`@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5`. Node 24.

### Environnement de test

Stack local **debout** au 2026-08-02, base **remise à l'état du dépôt** après les sondes de cette
story (0 recette, 0 ingrédient, 0 foyer — vérifié). Ports 5532x.

⚠️ **`localhost:3333`, jamais `127.0.0.1:3333`** — Next 16 bloque ses ressources en cross-origin et
**rien ne le dit dans le navigateur**.

⚠️ **`.env.local` pointe sur la PRODUCTION.** Bascule pour le parcours et **restaure à l'identique
en comparant l'empreinte SHA-256** (motif des stories 2.2, 3.1 et 3.2).

⚠️ **Après `db reset`, Kong garde l'ancienne adresse du conteneur d'authentification** :
`AuthRetryableFetchError`, `/auth/v1/health` en 502 alors que `auth` est sain. Remède :
`docker restart supabase_kong_nutriclaude`. **Ça ressemble à une régression et ça n'en est pas
une.**

⚠️ **L'automatisation de navigateur n'alimente pas l'état React par la frappe** quand la fenêtre
n'est pas au premier plan. Contournement mesuré à la 3.2 : le setter natif de `value` + un
`dispatchEvent('input')` + `form.requestSubmit()` **dans la même exécution** — les séparer laisse
React réinitialiser la valeur. C'est un artefact de l'outil, **pas un défaut du produit**.

### References

- [Source: epics.md#Story-3.3] — user story et 3 AC, cités verbatim ; [#FR-18], [#NFR-3], [#NFR-8],
  [#NFR-10], [#UX-DR11], [#UX-DR12]
- [Source: …/ARCHITECTURE-SPINE.md] — AD-1, AD-2, AD-13, AD-16 ; § Consistency Conventions
- [Source: …/DESIGN.md:249, :329] et [EXPERIENCE.md:158] — « le menu et les recettes peuvent
  respirer au grand écran » ; l'éditeur de recettes hors périmètre de composition
- [Source: _bmad-output/project-context.md] — chargé à chaque session, c'est lui qui fait foi
- [Source: lib/recettes/saisie.ts:59-69] — `normaliserInstructions`, et pourquoi elle existe :
  *« C'est ce qui rend l'AC de la story 3.3 démontrable »* ; [:118-165] — `normaliserQuantite` et
  **la virgule française acceptée**
- [Source: lib/texte.ts] — `normaliserMultiligne` et son en-tête : `normaliserTexte` aplatit les
  retours à la ligne
- [Source: lib/recettes/recettes.ts] — `recetteParId`, les trois chemins d'introuvable
- [Source: lib/recettes/ingredients.ts] — `ingredientsDeRecette`, le tri et le pourquoi du secondaire
- [Source: app/recettes/ListeRecettes.tsx:118-126] — **le commentaire qui annonce ce changement**
- [Source: app/recettes/[id]/modifier/page.tsx:20-30] — les trois chemins vers `notFound()`, et le
  commentaire `:27` à réécrire
- [Source: next.config.ts:24-40] et [deferred-work.md] — la CSP, son échéance repoussée à l'Epic 6,
  **et la prémisse à revérifier ici**
- [Source: 3-1-…md, 3-2-…md] — les pièges d'outillage (Kong, `.env.local`, l'automatisation), les
  motifs d'écran, et les deux erreurs de méthode consignées
- **Sondes exécutées le 2026-08-02** — (1) PostgREST rend `quantity` en nombre JSON (`400.00`,
  `0.50` sur le fil) qui devient `400` et `0.5` en JS, et `toLocaleString("fr-FR")` rend « 0,5 » ;
  (2) les instructions relues par l'API portent bien leurs `\n` et leur ligne vide intérieure ;
  (3) `globals.css` ne neutralise que `--color-*` et `--radius-*`. Base remise à l'état du dépôt

---

## Décisions de Florian — 2026-08-02

Les quatre questions ont été tranchées **avant démarrage**, conformément aux recommandations. Elles
ne se rouvrent pas en revue sans un fait nouveau.

**1. Le lien de retour de l'écran d'édition reste « ← Tes recettes ».** Zéro ligne à écrire. Le
répertoire est une destination juste et **toujours atteignable**, là où « ← La recette » serait faux
dès qu'on ouvre `/recettes/[id]/modifier` directement — favori, lien partagé, ou retour du
navigateur. Pour qui arrive depuis la lecture, le bouton Retour du navigateur ramène à la recette :
le chemin d'arrivée est déjà couvert par le contrat du navigateur, il n'a pas besoin d'être doublé
par un lien qui ment dans l'autre cas.

**2. `generateMetadata` : oui.** L'onglet porte le nom de la recette.

⚠️ **Deux contraintes qui vont avec, et elles ne sont pas facultatives** (piège n°7) : la fonction
**refait une lecture** — sans portée sur un écran de configuration, mais n'en déduis pas qu'il faut
un cache — et elle **ne doit jamais lever** sur une recette introuvable. C'est le composant qui
décide du `notFound()` ; `generateMetadata` rend un titre neutre et se tait.

**3. Un temps de cuisson à `0` s'affiche comme les autres.** « 0 min de cuisson » est une
information, pas un trou : `0` est une valeur **saisie**, distincte de `null` qui veut dire « non
renseigné ». Les masquer toutes les deux confondrait « je n'ai pas répondu » et « il n'y en a pas ».

⚠️ **Teste les deux cas**, et ne les traite pas par le même `if` — `if (!temps)` attrape `0` **et**
`null`, ce qui est précisément l'erreur que cette décision interdit. Le test est `!== null`.

**4. Pas de `loading.tsx` sur cet écran.** Aucun AC ne le demande : l'AC4 de la story 3.1 portait
sur le **répertoire**, et `app/recettes/loading.tsx` ne couvre pas cette route. En poser un est un
travail réel — forme, deux thèmes, vérification réseau bridé — pour un écran qui se charge en deux
lectures.

⚠️ **Écris-le dans les notes de complétion**, pour qu'une revue n'y voie pas un oubli. C'est une
absence décidée, pas une absence subie.

---

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

#### Les six portes (2026-08-02)

| Porte | Résultat |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm run build` | ✅ |
| `npm run check:migrations` | ✅ 13 migrations — **aucune ajoutée**, comme prévu |
| `npm test` | ✅ **152/152** (142 avant, **+10**) |
| `npm run test:isolation` | ✅ **55/55**, **inchangé** — voir les notes de complétion |

#### La dent, vérifiée par mutation

| Mutation | Attendu | Mesuré |
|---|---|---|
| `formaterTemps` : remplacer `!== null` par `if (temps)` | le test du zéro tombe | **152 → 151**, et c'est bien « ZÉRO s'affiche, parce que zéro est une réponse » |

C'est la mutation qui compte : elle reproduit **exactement** l'erreur que la décision 3 interdit —
confondre « je n'ai pas répondu » avec « il n'y en a pas », en silence.

#### AC2 mesuré dans le DOM, pas à l'œil

```json
{"whiteSpace":"pre-wrap","contientDesSautsDeLigne":true,"nombreDeSauts":3,
 "ligneVideInterieure":true,"aucunHTMLInjecte":true}
```

`aucunHTMLInjecte` compte les **nœuds enfants** du paragraphe : zéro. Le texte du membre est bien
rendu comme du texte, pas comme du balisage.

⚠️ **Et `white-space: pre-wrap` est bien émis dans le CSS construit** — vérifié dans `.next/` après
`npm run build`. La story le donnait pour *lu dans `globals.css`, pas mesuré au build* ; c'est
maintenant mesuré.

#### Parcours à l'écran (2026-08-02) — stack local, les deux thèmes

| Cas | Mesuré |
|---|---|
| Recette complète | ✅ titre, « Pour 4 personnes · 15 min de préparation, 30 min de cuisson », description, 4 ingrédients, instructions |
| **Virgule française** | ✅ « 0,5 L » — le membre relit ce qu'il a tapé |
| **Pas de séparateur de milliers** | ✅ « 1500 g », sans l'espace insécable étroite (U+202F) que `toLocaleString` insère par défaut |
| Ingrédient sans quantité ni unité | ✅ « Coriandre — on peut s'en passer », **aucun `<span>` de quantité** |
| **Recette au titre seul** (AC3) | ✅ « Pour 1 personne » au singulier, **aucun temps**, aucune description, **aucune section « Comment on la fait »**, et l'invitation à ajouter des ingrédients |
| **Cuisson à `0`** (décision 3) | ✅ « 10 min de préparation, **0 min de cuisson** » |
| Titre de l'onglet | ✅ « Curry de pois chiches · NutriClaude » |
| `/recettes/pizza` | ✅ « Il n'y a rien ici. », **et un titre d'onglet neutre** — `generateMetadata` n'a pas levé |
| Navigation recâblée | ✅ les 3 liens du répertoire pointent vers la **lecture**, aucun vers `/modifier` |
| Zoom 200 % · largeur 390 px | ✅ aucun débordement |
| Thème sombre | ✅ lisible, séparateurs et texte secondaire compris |

#### Le verdict CSP (Task 6)

Contrôlé sur l'arbre complet, et **la prémisse tient** :

| Contrôle | Résultat |
|---|---|
| `dangerouslySetInnerHTML` / `innerHTML` / `__html` dans `app/` et `lib/` | **aucune occurrence** — la seule est dans un commentaire qui les interdit |
| Markdown / sanitizer / bibliothèque HTML parmi les 14 dépendances | **aucune** |
| Rendu des champs du membre (titre, description, nom, instructions) | **expressions React**, donc échappées |

Consigné dans `deferred-work.md`, avec la commande d'une ligne pour que **la prochaine story qui
rend du texte de membre refasse le contrôle** au lieu de le supposer fait.

#### Pièges d'outillage

- ⚠️ **`.env.local` pointe sur la PRODUCTION.** Basculé, **restauré à l'identique, SHA-256 comparé**.
- ⚠️ Après `db reset`, **Kong garde l'ancienne adresse du conteneur d'authentification** —
  `docker restart supabase_kong_nutriclaude`. Troisième story consécutive à le rencontrer.
- L'API d'OTP appelée **directement** (sans `redirect_to`) produit un lien magique **malformé** —
  `http://localhost:3333&token_hash=…`, sans le chemin `/auth/callback`. L'URL de rappel se
  reconstruit à la main avec le `token_hash`. Artefact de la sonde, **pas un défaut du produit** :
  le vrai chemin passe par le formulaire, éprouvé aux stories 3.1 et 3.2.

### Completion Notes List

**Les six tâches sont livrées, aucune sous-tâche laissée vide.** Aucune migration, **aucune
dépendance**, `app/globals.css`, `proxy.ts`, `next.config.ts` et `lib/supabase/types.ts` intacts.

**AC2 tenait effectivement dans une déclaration CSS**, parce que la story 3.1 avait payé la dette
d'avance en écrivant `normaliserMultiligne`. Les quatre pièges que la story énumérait — parseur
Markdown, `dangerouslySetInnerHTML`, `split("\n").map(<br/>)`, `.replace(/\n/g,"<br>")` — ont tous
été évités, et le commentaire du code dit **pourquoi** chacun est refusé, pas seulement qu'il l'est.

**Le défaut d'affichage décimal est réparé ici, et consigné ailleurs.** `formaterQuantite` rend
« 0,5 » ; l'écran d'édition de la story 3.2 affiche encore « 0.5 » et **n'a pas été touché** —
déborder sur l'écran d'une autre story rend sa propre revue plus difficile. L'entrée
`deferred-work.md` précise que le module est déjà écrit et qu'il ne reste qu'une ligne à changer.

**Une découverte de la mise en œuvre, absente de la story.**
`(1500).toLocaleString("fr-FR")` insère une **espace insécable étroite (U+202F)** entre le millier
et la centaine — exactement la famille de caractères invisibles que `lib/texte.ts` passe son temps à
retirer des saisies. `useGrouping: false` l'évite, et un test l'épingle en vérifiant qu'**aucune
espace, fût-elle insécable**, ne subsiste. Sans ce test, un futur « nettoyage » du formatage le
réintroduirait sans que rien ne le signale.

**Les quatre décisions ont toutes été appliquées :** lien de retour de l'édition inchangé (vérifié,
non touché) · `generateMetadata` posée, **et qui ne lève pas** — mesuré sur `/recettes/pizza`, où le
titre reste neutre pendant que le composant rend `notFound()` · un temps à `0` s'affiche · **aucun
`loading.tsx`** sur cette route.

⚠️ **L'absence de `loading.tsx` est décidée, pas subie**, et c'est écrit dans `deferred-work.md` :
aucun AC ne le demande, l'AC4 de la story 3.1 portait sur le répertoire, et
`app/recettes/loading.tsx` ne couvre pas cette route.

⚠️ **Aucun test d'isolation ajouté, et c'est délibéré.** Cette story ne fait que lire, par
`recetteParId` et `ingredientsDeRecette` — deux fonctions dont l'isolation est déjà prouvée par 14
tests écrits aux stories 3.1 et 3.2. En ajouter serait décoratif. Le compte reste à **55/55**, et
c'est une case vide honnête plutôt qu'un test qui ne prouverait rien.

**Deux commentaires devenus faux ont été réécrits dans le même commit** — celui de
`ListeRecettes.tsx` qui annonçait ce changement, et celui de `modifier/page.tsx` qui parlait de la
story 3.3 au futur. C'est le défaut de texte d'annonce périmé que les stories 1.6, 1.7, 2.1, 2.2 et
3.1 ont chacune eu à réparer ; il ne s'est pas reproduit ici parce que la story le nommait.

**Ce qui reste à vérifier avant la fusion :** rien qui dépende de la production — cette story
n'ajoute **aucune migration**. Restent les questions du gabarit de PR.

⚠️ **Rappel hors périmètre :** les stories 2.2, 3.1 et 3.2 sont parties en production **sans revue
adversariale**, ce que la règle n°6 de `project-context.md` impose. Celle-ci a le même profil.

### File List

**Nouveaux**
- `lib/recettes/lecture.ts` — `formaterQuantite`, `formaterTemps`, `formaterPortions`
- `lib/recettes/lecture.test.ts` — 10 tests
- `app/recettes/[id]/page.tsx` — **l'écran de lecture**, Server Component pur, `generateMetadata`

**Modifiés**
- `app/recettes/ListeRecettes.tsx` — la cible du lien passe à la lecture, **et son commentaire**
- `app/recettes/[id]/modifier/page.tsx` — **son commentaire seul** : il parlait de la 3.3 au futur,
  et il porte désormais la raison du lien de retour (décision 1)
- `_bmad-output/implementation-artifacts/deferred-work.md` — le **verdict CSP**, l'affichage décimal
  de l'écran d'édition, l'absence de `loading.tsx`, la double lecture de `generateMetadata`

**Inchangés, vérifiés**
- `supabase/migrations/` — **aucune migration**, donc `lib/supabase/types.ts` intact et
  `docs/migrations.md` inchangé
- `app/globals.css` — aucune classe ajoutée ; `whitespace-pre-wrap` est un utilitaire standard,
  **vérifié émis dans le CSS construit**
- `next.config.ts` — les quatre en-têtes de sécurité inchangés, la CSP toujours différée
- `proxy.ts`, `package.json` — intacts, **aucune dépendance**
- `.env.local` — basculé pour le parcours, **restauré à l'identique** (SHA-256 comparé)

---

## Change Log

| Date | Changement |
|---|---|
| 2026-08-02 | **Implémentation.** Un module pur en TDD (phase rouge constatée), un écran de lecture **sans aucun `"use client"`**, la navigation recâblée. **Six portes vertes : 152/152 unitaires, 55/55 isolation**, typage, lint, build, en-têtes de migration — **aucune migration ajoutée**. **AC2 mesuré dans le DOM** : `pre-wrap`, 3 sauts de ligne, ligne vide intérieure, et **zéro nœud enfant** — donc aucun balisage injecté. Dent vérifiée : remplacer `!== null` par `if (temps)` fait tomber le test du zéro (152 → 151), l'erreur exacte que la décision 3 interdit. **Une découverte absente de la story** : `toLocaleString("fr-FR")` insère une espace insécable étroite (U+202F) sur les milliers — la famille d'invisibles que `lib/texte.ts` retire des saisies ; `useGrouping: false` l'évite et un test l'épingle. **Verdict CSP rendu** (Task 6) : aucun `dangerouslySetInnerHTML`, aucun parseur, tout est rendu par expression React — la prémisse tient, consignée avec la commande pour que la prochaine story la revérifie. Aucun test d'isolation ajouté, **délibérément**. Statut → `review` |
| 2026-08-02 | **Les quatre questions tranchées par Florian**, conformes aux recommandations : lien de retour de l'édition inchangé, `generateMetadata` oui, un temps à `0` **s'affiche**, et **aucun `loading.tsx`** sur cette route. Le piège n°4 disait l'inverse sur le `0` — réécrit, avec l'avertissement qui compte : le test est `!== null`, jamais `if (!temps)`, qui attraperait `0` et `null` en silence et ferait passer le tableau des quatre cas à trois sans que rien ne le dise. Deux sous-tâches ajoutées pour acter les décisions 3 et 4 |
| 2026-08-02 | Story créée. **La moitié d'AC2 est déjà tenue** — `normaliserMultiligne` (story 3.1) stocke les retours à la ligne, et la sonde confirme qu'ils survivent à l'aller-retour par l'API, ligne vide intérieure comprise. Il ne reste qu'un `whitespace-pre-wrap`, et le piège n°1 énumère les quatre façons de le rater. **Un défaut mesuré, hérité de la 3.2** : PostgREST rend `quantity` en nombre JSON, donc « 0,5 » saisi se réaffiche « 0.5 » — alors que `normaliserQuantite` accepte explicitement la virgule française et que NFR-8 exige le français. Corrigé ici seulement, consigné pour l'écran d'édition. **Et c'est cette story qui rouvre la CSP** : son échéance a été repoussée à l'Epic 6 au motif qu'aucune surface XSS n'existait — l'affirmation portait sur l'écriture, celle-ci est la story qui LIT. D'où une tâche sans critère d'acceptation qui n'est pas facultative. Quatre questions ouvertes, chacune avec sa recommandation |
