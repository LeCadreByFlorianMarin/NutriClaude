---
baseline_commit: 795678ec533a62c6dec6ced18b1ba776d4d29eb5
---

# Story 3.5: Planifier le menu de la semaine sans défilement horizontal

Status: review

<!-- Cinquième story de l'Epic 3, et la PREMIÈRE qui touche `meal_plan_entries` depuis une
     surface. La table existe depuis le squelette du 2026-05-02, sa RLS est posée, ses types
     sont générés — aucune migration n'est due, et si tu t'en écris une, c'est que tu as
     débordé (voir § Project Structure Notes).

     ⚠️ **LA STORY 3.4 EST SAUTÉE, ET C'EST DÉLIBÉRÉ.** Florian a demandé la 3.5 alors que la
     3.4 (étiquettes, filtre, recherche) est encore `backlog`. Conséquence directe et à ne pas
     réinventer : **la maquette `grille-menu.html` montre des étiquettes dans les cases
     (« rapide », « végé », « batch ») — elles n'existent pas.** Il n'y a pas de colonne
     d'étiquettes, pas de table, rien. Ne les rends pas, ne les invente pas, ne pose pas la
     migration qui les créerait : c'est la 3.4 en entier.

     ⚠️ **LES TROIS QUESTIONS ONT ÉTÉ TRANCHÉES LE 2026-08-04, AVANT DÉMARRAGE** — § Décisions.
     La plus lourde : **l'AC4 est livré à MOITIÉ et c'est assumé.** « Lisibles » : oui.
     « Directement actionnables » : non, l'action EST la story 3.6. La sous-tâche reste décochée
     avec sa raison, et rien n'est jeté. Ne la re-coche pas, ne la contourne pas. -->

## Story

As a membre configurant le foyer (Florian),
I want une grille de menu jour × repas lisible et confortable,
So that je planifie la semaine sans me battre avec un défilement horizontal forcé.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-3.5`.

**AC1 — La grille existe, collation comprise**
**Given** l'écran du menu
**When** il s'affiche
**Then** il présente une grille jour × repas incluant le repas **collation** — déjà admis par la
base (`meal_type` accepte `snack`) et donc rendu à l'écran (FR-15)

**AC2 — Aucun défilement horizontal, à aucune largeur**
**Given** la grille du menu affichée sur un écran contraint
**When** elle est rendue
**Then** elle **n'impose aucun défilement horizontal forcé** (NFR-3/UX-DR10), quelle que soit la
largeur d'écran

**AC3 — Naviguer entre les semaines**
**Given** une semaine donnée
**When** Florian navigue entre les semaines
**Then** la grille reflète le menu de la semaine sélectionnée sans perdre les autres semaines

**AC4 — La semaine vide est lisible**
**Given** une semaine sans aucun repas planifié
**When** la grille du menu s'affiche
**Then** les cases vides sont lisibles et directement actionnables, sans message d'erreur ni zone
ambiguë

> **⚠️ AC1 dit « jour × repas » et la base en admet QUATRE** — `meal_type in ('breakfast',
> 'lunch', 'dinner', 'snack')` (`initial_schema.sql:180`). L'AC ne nomme explicitement que la
> collation parce que c'est celle qui manquait au prototype ; il n'autorise pas pour autant à
> laisser tomber le petit-déjeuner. Voir piège n°5.

> **⚠️ L'AC4 est le seul critère de cette story qui ne sera livré qu'à MOITIÉ, et c'est une
> décision datée, pas un oubli.** « Lisibles » : livré. « Directement actionnables » : l'action
> est d'assigner une recette, c'est-à-dire la story **3.6** en entier — et la seconde moitié du
> critère (« sans zone ambiguë ») interdit de poser d'ici là une case focalisable qui ne mènerait
> nulle part. **Tranché par Florian le 2026-08-04**, option (a) — voir § Décisions et piège n°6.

> **⚠️ AC3 n'est pas démontrable sur une base vide, et rien dans cette story ne peut la remplir.**
> Assigner une recette à une case, c'est la story **3.6**. La seule façon de voir une grille
> pleine au 2026-08-04 est d'**amorcer des lignes à la main sur le stack local** — la Task 5 en
> porte le SQL. Sans cet amorçage, le parcours à l'écran ne démontre que la moitié de l'AC3.

## Tasks / Subtasks

- [x] **Task 1 — `lib/menu/semaine.ts` : tout le calendaire, pur et testé** (AC1, AC3)
      <!-- C'est ici que va l'essentiel du risque de cette story, et c'est le seul endroit
           qu'un test peut tenir (NFR-10 interdit le harnais de composants). Le JSX, lui,
           s'éprouve à l'œil. -->

  - [x] Phase rouge **constatée** avant l'implémentation — consigne la commande et le compte de
        tests en échec
        <!-- La story 3.3 a laissé cette case vide faute d'avoir consigné quoi que ce soit, et
             `git show --stat` ne pouvait pas corroborer non plus : module et tests dans le même
             commit. Si tu la coches, produis la preuve ; sinon laisse-la vide avec sa raison
             (règle §1 de `project-context.md`). -->

  - [x] `type JourISO = string` — **toute date circule en `"AAAA-MM-JJ"`, jamais en `Date`**
        (piège n°1)
  - [x] `lundiDeLaSemaine(jour: JourISO): JourISO` — l'ISO 8601 met le lundi en tête. ⚠️
        `getUTCDay()` rend `0` pour **dimanche**, pas pour lundi
  - [x] `joursDeLaSemaine(lundi: JourISO): JourISO[]` — sept jours, dans l'ordre
  - [x] `semaineVoisine(lundi: JourISO, pas: -1 | 1): JourISO`
  - [x] `aujourdhuiAParis(): JourISO` — ⚠️ **`Europe/Paris`, écrit en dur** (piège n°2)
  - [x] `estJourISO(v: string | null): boolean` — garde de saisie, sur le modèle d'`estUuid`.
        ⚠️ **Un aller-retour, pas un `Date.UTC` qui ne lève pas** (piège n°7)
  - [x] `formaterJourCourt(jour)` / `formaterPlageDeSemaine(lundi)` — ⚠️ **locale `"fr-FR"`
        écrite en dur** et `timeZone: "UTC"`, même raison que `LOCALE` dans `lib/recettes/lecture.ts`
  - [x] Tests : le lundi d'un dimanche · le lundi d'un lundi · un passage de mois · un passage
        d'année · une année bissextile · `estJourISO` sur `"2026-13-45"`, `""`, `null`,
        `"04/08/2026"` · le pas ±1 de part et d'autre d'un changement d'heure

- [x] **Task 2 — `lib/menu/menu.ts` : lire les cases d'une semaine** (AC1, AC3)
  - [x] `casesDeLaSemaine(supabase, lundi: JourISO): Promise<CaseDeMenu[]>`. ⚠️ **Le client en
        PARAMÈTRE**, jamais construit ici — motif de `lib/foyer/membres.ts`, `lib/recettes/recettes.ts`,
        et c'est ce qui rend la fonction réutilisable par le dashboard (Epic 5) et le MCP (Epic 7)
  - [x] `.gte("meal_date", lundi).lte("meal_date", dimanche)` — l'index
        `idx_meal_plan_household_date` porte exactement sur `(household_id, meal_date)`
  - [x] ⚠️ **Aucun filtre `household_id`** : `meal_plan_all` s'en charge, et l'écrire à la main
        laisserait croire que c'est lui qui protège (motif de `recettesDuFoyer`)
  - [x] La jointure vers le titre : `select("id, meal_date, meal_type, servings, recipes(id, title)")`.
        ⚠️ **La RLS s'applique aussi à la ressource jointe** — c'est ce que la Task 6 mesure.
        ⚠️ **`recipes` est une ressource EMBARQUÉE** : selon ce que supabase-js infère, elle se
        type en objet **ou en tableau**. Ne présume pas — regarde ce que `npm run typecheck` te
        dit, et normalise dans `versCaseDeMenu` pour que le JSX ne voie qu'une seule forme
  - [x] ⚠️ **Lève sur `error`, rend `[]` sur zéro ligne.** Une semaine vide est l'état NOMINAL de
        l'AC4, pas une panne (même distinction que `rayonsDuFoyer` et `recettesDuFoyer`)
  - [x] ⚠️ **Un ordre déterministe, et à trois critères** : `.order("meal_date")`,
        `.order("meal_type")`, puis `.order("created_at")` — sans le dernier, deux recettes dans
        la même case bougent d'un rechargement à l'autre (piège n°5 bis, et c'est la leçon exacte
        de `recettesDuFoyer` et de `rayonsDuFoyer`)
  - [x] ⚠️ **Le regroupement rend une LISTE par case, pas une recette.** `Map<jour, Map<repas,
        CaseDeMenu[]>>` ou équivalent — un `Map<clé, CaseDeMenu>` perdrait des lignes en silence
        (piège n°5 bis)
  - [x] `REPAS` : les **quatre** `meal_type` avec leur libellé français, dans l'ordre de la
        journée (piège n°5). Une **constante**, pas une chaîne recopiée dans le JSX
  - [x] ⚠️ **Pas de fichier de test pour ce module, et c'est cohérent** — `recettes.ts`,
        `ingredients.ts` et `rayons.ts` n'en ont pas non plus : un faux client prouverait le
        mapping, jamais l'isolation, et c'est `test:isolation` qui porte ce contrôle. **Si tu en
        écris un, dis ce qu'il prouve que la Task 6 ne prouve pas.**

- [x] **Task 3 — `/menu` : l'écran** (AC1, AC2, AC3)
  - [x] `app/menu/page.tsx` — Server Component. ⚠️ **`searchParams` est une `Promise`**
        (`strictRouteTypes`, `next.config.ts:5-13`)
  - [x] **Aucun `"use client"`, aucun `useState`.** La semaine vit dans l'URL (`?semaine=AAAA-MM-JJ`),
        pas dans un état React — voir piège n°7 pour les trois choses que ça règle gratuitement
  - [x] **Sans `?semaine=`, c'est la semaine EN COURS** — celle qui contient `aujourdhuiAParis()`
        (décision 3 du 2026-08-04). ⚠️ **C'est aussi la valeur de repli de toute saisie invalide**
        (piège n°7) : un seul chemin, pas deux
  - [x] `export const metadata = { title: "Mon menu · NutriClaude" }`
  - [x] La grille : **un seul DOM, jamais deux structures masquées par media query** (piège n°3)
  - [x] Les repères de navigation : semaine précédente / suivante, et le retour à la semaine
        courante. Des `<Link>`, pas des boutons — ce sont des destinations
  - [x] ⚠️ **Pas d'abricot sur « aujourd'hui »** (piège n°4)
  - [x] La structure de titres : `<h1>` l'écran, `<h2>` chaque jour. ⚠️ **Pas de `<table>`** —
        un tableau ne se replie pas en colonne unique sans mentir sur sa structure, et l'AC2 est
        justement un critère de repli. Sept `<section>` avec leur `<h2>`, et chaque case porte le
        nom de son repas **en texte**, pas seulement par sa position dans la colonne : c'est ce
        qui la rend compréhensible une fois empilée
  - [x] ⚠️ **Le nom du repas doit rester lisible à TOUTES les largeurs.** L'étiquette de ligne
        (« Midi ») en marge gauche disparaît à l'empilement — c'est ce que fait la maquette
        (`:59`), et c'est ce qui oblige sa version mobile à réécrire « Midi · Buddha bowl » dans
        chaque case. Un seul DOM veut dire : l'étiquette vit **dans** la case, à toutes les
        largeurs
  - [x] `app/menu/loading.tsx` — squelette à la forme de la grille. ⚠️ **Aucun AC ne le demande** ;
        c'est le motif posé deux fois par l'Epic 3 et la conséquence de l'absence de `layout.tsx`
        (voir § Project Structure Notes). Si tu ne le poses pas, **écris pourquoi**

- [ ] **Task 4 — La case vide** (AC4 — **livré à moitié, décision 1 du 2026-08-04**)
      <!-- DÉBLOQUÉE. Florian a tranché l'option (a) le 2026-08-04 : la 3.5 livre la case vide
           LISIBLE, et l'affordance d'assignation reste à la 3.6. Voir § Décisions. -->

  - [x] Une case sans repas **se lit** : elle dit qu'il n'y a rien de prévu, en français, sans
        message d'erreur
  - [x] Une case vide reste **dimensionnée et nommée** comme celle que la 3.6 rendra actionnable
        (`min-h-touch`, le nom de son repas en texte) — c'est ce qui fait qu'aucune ligne ne sera
        jetée
  - [ ] ⚠️ **RESTERA DÉCOCHÉE : « directement actionnables ».** Décision 1 du 2026-08-04 —
        assigner une recette EST la story 3.6, et la seconde moitié de l'AC4 (« sans zone
        ambiguë ») interdit de poser d'ici là une case focalisable qui ne mène nulle part.
        **Ne la coche pas, et ne la « répare » pas** par un `<button disabled>` ou un
        `tabIndex={0}` décoratif : ce serait exactement la zone ambiguë écartée
        <!-- Reportée à la story 3.6, qui doit la ROUVRIR en la citant (règle §5) et non la
             supposer close. À consigner dans `deferred-work.md`. -->
  - [x] Consigner ce demi-critère dans `deferred-work.md`, daté, avec sa raison — c'est le
        pendant de la case décochée, du côté du suivi
  - [x] Une case **remplie** montre le ou les titres de recette, et chacun mène à
        `/recettes/[id]` — cette destination existe depuis la story 3.3, elle n'est pas à
        inventer. ⚠️ **Le ou LES : voir piège n°5 bis.** Une case à deux recettes doit se lire
        comme deux recettes, pas en écraser une

- [ ] **Task 5 — Le parcours à l'écran, dans les deux thèmes** (AC1, AC2, AC3, AC4)
      <!-- ⛔ NON FAITE, ET C'EST LA CONDITION DE FUSION DE CETTE STORY.
           L'agent n'a pas joué le parcours : il aurait fallu basculer `.env.local` — qui pointe
           sur la PRODUCTION — vers le stack local, ouvrir une session, amorcer des cases et
           juger un rendu. La règle §7 de `project-context.md` range précisément ça dans « ce
           qu'aucune porte automatique ne voit », et la story 3.3 l'a consigné comme RAPPORTÉ
           PAR FLORIAN, jamais mesuré par l'agent.

           ⚠️ L'AC2 est LE critère de cette story et il n'est PAS démontré. Ce qui est établi :
           toutes les classes émettent bien du CSS (mesuré dans le bundle), `grid-cols-7` emploie
           `minmax(0,1fr)` — donc les colonnes peuvent se réduire — et les titres portent
           `break-words`. Ça rend le débordement improbable ; ça ne le mesure pas. La différence
           entre « improbable » et « mesuré » est exactement ce que cette story a écrit partout
           ailleurs.

           ⚠️ Non démontré non plus : les deux thèmes, le squelette au réseau bridé, l'anneau de
           focus, et le rendu réel de `subgrid` au navigateur. -->

  - [ ] Stack local, `localhost:3333`. ⚠️ **`.env.local` pointe sur la PRODUCTION** : bascule et
        **restaure en comparant l'empreinte SHA-256**, en consignant les deux commandes
  - [ ] **Amorce des cases à la main** — sans ça l'AC3 n'est démontrable qu'à moitié :
        ```sql
        -- Sur le stack local UNIQUEMENT. Remplace les identifiants.
        insert into meal_plan_entries (household_id, recipe_id, meal_date, meal_type, servings)
        values ('<foyer>', '<recette-A>', '2026-08-03', 'lunch',     2),
               ('<foyer>', '<recette-A>', '2026-08-03', 'snack',     2),
               ('<foyer>', '<recette-A>', '2026-08-06', 'dinner',    4),
               ('<foyer>', '<recette-B>', '2026-08-06', 'dinner',    4),  -- MÊME case, 2 recettes
               ('<foyer>', '<recette-A>', '2026-08-09', 'breakfast', 2),
               ('<foyer>', '<recette-A>', '2026-08-12', 'dinner',    2);  -- semaine SUIVANTE
        ```
        L'avant-dernière ligne démontre le piège n°5 bis (rien n'interdit deux recettes dans la
        même case) ; la dernière démontre « sans perdre les autres semaines » : navigue, reviens,
        et les deux semaines sont toujours là
  - [ ] Une recette au **titre très long** dans une case — c'est le cas qui casse l'alignement
        des lignes et qui fait déborder en largeur. ⚠️ **Le pire cas est un titre long dans une
        case à deux recettes**, au grand écran : c'est lui qui dit si `subgrid` tient
  - [ ] ⚠️ **La largeur, mesurée et pas regardée** : `document.documentElement.scrollWidth <=
        document.documentElement.clientWidth` à **390 px**, **320 px** et **200 % de zoom**.
        C'est l'AC2 en entier, et c'est un nombre, pas une impression
  - [ ] Les **quatre** repas visibles, sur une semaine où une seule case est remplie
  - [ ] Les deux thèmes au réglage système, **remis après** —
        `osascript -e 'tell application "System Events" to tell appearance preferences to set
        dark mode to true'` puis `false` (`project-context.md`)
  - [ ] Le squelette **réseau bridé** : c'est celui de la grille qui s'affiche, pas un écran blanc
  - [ ] Anneau de focus mesuré dans le DOM (`document.activeElement`), pas à l'œil
  - [x] Les six portes : `npm run typecheck`, `npm run lint`, `npm test`,
        `npm run test:isolation`, `npm run build`, `npm run check:migrations`

- [x] **Task 6 — L'isolation de la première lecture de `meal_plan_entries`** (AD-17, NFR-5)
  - [x] `supabase/tests/isolation.test.ts` — « A ne lit pas les cases de menu de B »
  - [x] ⚠️ **Et le test qui compte vraiment : « A ne lit pas le TITRE d'une recette de B à
        travers la jointure du menu ».** C'est une **nouvelle forme de lecture** dans ce dépôt —
        une ressource jointe par PostgREST — et le projet a déjà payé une fois de croire qu'une
        garde couvrait une forme qu'elle ne couvrait pas (`seed_default_aisles`, invisible aux
        onze tests d'alors parce qu'ils portaient tous sur des tables)
  - [x] ⚠️ **Vérifie la dent** : retire `meal_plan_all` sur la base locale, et regarde tomber.
        Une mutation qui ne fait rien tomber peut être un **no-op** plutôt qu'un test sans dent
        (leçon de la story 3.2 sur le `with check` d'une politique `FOR ALL`)

- [x] **Task 7 — Les textes que ce commit rend faux** (hors AC, mais dû dans le MÊME commit)
  - [x] `app/page.tsx:36-39` — « Les courses **et le menu** arrivent. » devient faux. ⚠️ C'est le
        défaut de **texte d'annonce périmé** que les stories 1.6, 1.7, 2.1 et 2.2 ont chacune eu à
        réparer : **il se répare avec l'écran, jamais après** (piège n°8)
  - [x] `app/page.tsx` — un `<Link href="/menu">` « **Mon menu** ». Première personne pour ce qui
        NOMME (`project-context.md`), et la phrase au-dessus reste **neutre** : c'est le piège du
        voisinage, et l'accueil est l'écran qui l'a fait naître
  - [x] `app/recettes/page.tsx:23-25` — « la grille du menu (stories 3.5 et 3.6) » ne vaut plus
        que pour la 3.6
  - [x] `supabase/tests/isolation.test.ts:539-543` — « Aucun écran n'expose encore le menu
        (stories 3.5 et 3.6) » devient faux ; la conséquence qu'il fige, elle, reste vraie

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où | Ce que ça implique |
|---|---|---|
| La table du menu, ses colonnes, son index | `initial_schema.sql:175-188` | **Aucune migration.** `meal_date`, `meal_type`, `servings`, `notes`, cascade sur `recipes` |
| L'isolation du menu | `meal_plan_all`, `initial_schema.sql:316-318` | `FOR ALL`, `using` **et** `with check`. **Rien à écrire** |
| Les types générés | `lib/supabase/types.ts:176-226` | `meal_plan_entries` y est déjà. **Aucun `supabase gen types` à relancer** |
| La cascade recette → case de menu | `isolation.test.ts:537-561` | Déjà mesurée. Ne la re-teste pas, **corrige son commentaire** (Task 7) |
| Lien vers une recette en lecture | `/recettes/[id]` (story 3.3) | La destination d'une case remplie **existe** |
| Squelette de chargement | `app/recettes/loading.tsx`, `app/recettes/[id]/loading.tsx` | Le motif est écrit **deux fois**. Rien à inventer |
| Gabarit d'écran, tokens, classes | `app/globals.css`, `max-w-2xl` des écrans recettes | Compose. `titre-ecran`, `titre-section`, `hint`, `btn`, `btn-quiet`, `card`, `border-card-border`, `min-h-touch` |
| Garde de session + profil | `app/_lib/garde.ts` — `requireProfile()` | Le proxy protège déjà toute route hors `PUBLIC_ROUTES` : `/menu` est protégée **sans une ligne** |
| Garde de saisie, motif | `lib/recettes/saisie.ts` — `estUuid` | Le modèle d'`estJourISO` |
| Formatage localisé | `lib/recettes/lecture.ts:16-23` — `const LOCALE = "fr-FR"` | Et **pourquoi** il est écrit en dur. Reprends la raison, pas seulement la ligne |

⚠️ **Cet écran n'écrit rien.** Aucun `createNavigateurClient`, aucun `useSoumission`, aucun
`Notice`, aucune région de statut, aucune Server Action. Si tu en poses un, tu as glissé dans la
story 3.6.

### Piège n°1 — La date est un piège de fuseau, et il est MESURÉ

`meal_date` est un `date` Postgres : **pas d'heure, pas de fuseau**. Toute conversion par un
`Date` JavaScript construit en heure locale décale d'un jour la moitié de l'année.

**Mesuré le 2026-08-04**, `node -e`, machine en `Europe/Paris` :

```
new Date(2026, 7, 4).toISOString()   →  "2026-08-03T22:00:00.000Z"   ← LE 3, pas le 4
new Date("2026-08-04").toISOString() →  "2026-08-04T00:00:00.000Z"   ← correct
```

Le premier est le geste naturel (« je construis la date du 4 août ») et il produit le 3. En
hiver le décalage est d'une heure au lieu de deux — **le défaut change de saison sans changer de
nature**, et rien à l'écran ne le dit : la grille affiche simplement le repas du mardi sur la
case du lundi.

**La règle, et elle n'a pas d'exception dans cette story :** une date est une **chaîne
`"AAAA-MM-JJ"`. Pour calculer, `Date.UTC(...)` et les accesseurs `getUTC*`, jamais les
accesseurs locaux, jamais `new Date(a, m, j)`.** Pour formater, `Intl.DateTimeFormat` avec
`timeZone: "UTC"`.

⚠️ **`getUTCDay()` rend `0` le DIMANCHE.** L'ISO 8601 et la grille mettent le **lundi** en tête.
Le décalage se fait `(jour + 6) % 7`, et le cas qui le trahit est un dimanche : sans le décalage,
le lundi calculé est celui de la semaine **suivante**. Teste-le.

### Piège n°2 — « aujourd'hui » se calcule à Paris, pas là où tourne le serveur

L'écran est rendu **côté serveur**. La CI et le poste tournent en `Europe/Paris` — **mesuré :
`Intl.DateTimeFormat().resolvedOptions().timeZone` rend `Europe/Paris`** — mais Vercel exécute
en **UTC**. Entre minuit et 2 h du matin heure française, le serveur est encore la veille : la
semaine par défaut et le jour marqué « aujourd'hui » seraient tous deux faux, **et le poste ne le
reproduirait jamais**.

La réponse est native, sans dépendance (NFR-10), et **mesurée le 2026-08-04** :

```js
new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date())        //  →  "2026-08-04"
```

`fr-CA` parce que c'est la locale qui rend nativement l'ordre `AAAA-MM-JJ` — pas une astuce, une
propriété de la locale.

⚠️ C'est la famille de défaut n°7-b de `project-context.md` : *la CI tourne sur le runtime du
poste ; Vercel en construit un autre.* Ici ce n'est même pas le runtime, c'est le fuseau — et
aucune porte automatique ne le voit.

### Piège n°3 — L'AC2 se tient par la STRUCTURE, pas par un media query qui duplique

La maquette `mockups/grille-menu.html:61-63` rend **deux DOM complets** et en masque un selon la
largeur (`.grid{display:none}` / `.stack{display:block}`). **Ne reprends pas ça.** Deux
structures, c'est deux fois le contenu à maintenir, deux fois les cases à câbler en 3.6, et un
lecteur d'écran qui traverse la copie masquée si le masquage bouge.

**Le spine le dit lui-même** : *« En cas de conflit entre une maquette et ce document, ce
document fait foi — les maquettes illustrent, elles ne décident pas »* (`DESIGN.md:275`).

**Le DOM qui marche à toutes les largeurs sans être dupliqué : sept sections « jour », chacune
portant ses quatre cases.** En colonne unique sur téléphone (les sept jours empilés, chacun avec
ses repas), en sept colonnes au grand écran. C'est déjà ce que fait la moitié « stack » de la
maquette, à ceci près qu'elle est la SEULE nécessaire.

⚠️ **L'alignement des lignes entre colonnes, au grand écran, se règle par `subgrid`** — sans lui,
une case portant « Curry de pois chiches aux épinards » grandit et décale toute sa colonne.
**Mesuré le 2026-08-04 sur `tailwindcss@4.3.3` de ce dépôt** : `grid-rows-subgrid`,
`grid-cols-subgrid`, `row-span-4` et `md:grid-cols-7` émettent bien leur CSS. Non vérifié au
navigateur — c'est la Task 5 qui le fera.

⚠️ **`overflow-x: auto` n'est PAS une réponse à l'AC2.** L'AC dit « n'impose aucun défilement
horizontal forcé » : un conteneur qui défile *est* le défilement qu'on interdit, il le range
seulement dans une boîte. La réponse est que le contenu se **replie**.

### Piège n°4 — La maquette met de l'abricot sur « aujourd'hui ». UX-DR2 l'interdit

`grille-menu.html:34` (`.dayhead.today{color:var(--acc-strong)}`) et `:39` colorent le jour
courant en abricot. **UX-DR2 réserve l'abricot à l'action courses** — compteur, coche, tuile
Courses, bouton d'ajout — et l'anneau de focus est sa seule autre exception, déjà globale dans
`globals.css:236-239`. Marquer un jour de calendrier en abricot est **décoratif**, donc banni.

Et ce n'est pas qu'une règle de discipline : `--accent-strong` **ne bascule pas entre les
thèmes**, et `globals.css:170-182` explique pourquoi il n'est même pas publié comme utilitaire —
`text-accent` rendait **1,90:1** sur une carte blanche.

**Marque « aujourd'hui » autrement** : la graisse, un libellé explicite, une bordure de contrôle.
Et **jamais par la seule couleur** (UX-DR5 en fait une règle générale du produit).

⚠️ Même remarque pour le bouton « 🛒 Générer la liste » de la maquette : il est en abricot parce
qu'il *est* l'action courses. Il appartient à l'**Epic 4** (FR-16/FR-17) et n'a rien à faire ici.

### Piège n°5 — La grille montre QUATRE repas, pas deux

La maquette n'affiche que **Midi** et **Soir**. La base en admet **quatre** :

```sql
meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'))
```

L'AC1 ne nomme que la collation parce que c'est celle dont UX-DR10 constate l'absence — pas parce
que le petit-déjeuner serait facultatif. **N'en rends que trois et tu crées un état stockable et
non affichable** : l'Epic 7 ouvre une seconde surface (MCP) sur la même base, et un
`meal_type = 'breakfast'` posé depuis Claude disparaîtrait du web **en silence**.

C'est la **règle §3** de `project-context.md`, du côté de l'affichage : quand la base pose une
énumération, l'écran la couvre **en entier** ou il ment.

⚠️ Le seul endroit qui décide de l'ordre et des libellés est la constante `REPAS` de
`lib/menu/menu.ts`. Une chaîne « Midi » recopiée dans le JSX est une seconde source de vérité.

⚠️ **L'ordre est chronologique — petit-déj, midi, collation, soir** — parce que la collation est un
goûter d'après-midi et qu'une grille de journée se lit dans l'ordre où on mange. La ranger après le
soir la ferait lire comme un appendice. **Tranché par Florian le 2026-08-04** (décision 2) : les
quatre repas, dans cet ordre. La grille de la 3.6 en hérite.

### Piège n°5 bis — Une case peut porter PLUSIEURS recettes, et rien ne l'en empêche

**La contrainte `unique(household_id, meal_date, meal_type, recipe_id)` n'existe pas en base.**
Elle est nommément l'**AC2 de la story 3.6** (AD-6), et elle n'a pas encore été écrite. Vérifie-le
toi-même plutôt que de me croire :

```
grep -rln "meal_plan" supabase/migrations/    # → un SEUL fichier : initial_schema.sql
```

Mesuré le 2026-08-04 : sept occurrences, toutes dans `initial_schema.sql` (la table `:175`,
l'index `:187`, la RLS `:244` et `:315-318`, la génération de liste `:548`). **Aucune n'est un
`unique`.** Les treize migrations postérieures ne touchent pas la table.

**Trois conséquences, et elles sont toutes pour ton écran :**

1. **Une case (jour × repas) peut légitimement porter 2, 3, *n* recettes.** « Soir : gratin +
   salade » est un menu normal, et la 3.6 n'interdira que le **doublon de la même recette**, pas
   la pluralité. Un modèle qui suppose « au plus une recette par case » perd des lignes **en
   silence** : la case en affiche une, la base en a trois, et la génération de liste de l'Epic 4
   comptera les trois.
2. **La même recette peut même y être deux fois aujourd'hui**, la contrainte n'étant pas là. Ne
   déduplique pas toi-même — ce serait masquer l'état que la 3.6 doit trouver.
3. **L'ordre à l'intérieur d'une case doit être déterministe.** Sans troisième critère de tri,
   Postgres rend deux lignes ex æquo dans l'ordre qu'il choisit ce jour-là, et la case « bouge
   toute seule » d'un rechargement à l'autre. C'est **exactement** la leçon déjà écrite deux fois
   dans le dépôt — `recettesDuFoyer` (`lib/recettes/recettes.ts:56-61`) pour les titres homonymes,
   `rayonsDuFoyer` pour les `sort_order` ex æquo.

⚠️ Ça change aussi le squelette et la hauteur de case : une case n'a pas de hauteur fixe connue.
C'est ce qui rend `subgrid` (piège n°3) utile plutôt que décoratif.

### Piège n°6 — L'AC4 dit « actionnables » et rien n'existe encore pour agir

Assigner une recette à une case est la story **3.6** — entière. La 3.5 livrée seule n'a donc
aucune destination à donner à une case vide, et un élément focalisable qui ne fait rien est
exactement la « **zone ambiguë** » que la seconde moitié de l'AC4 interdit.

C'est le même interdit que celui déjà écrit dans `project-context.md` : **« jamais “Réessaie” sur
une condition non transitoire — un conseil qui ne peut pas fonctionner enferme l'utilisateur dans
une boucle »**. Une case qui invite à cliquer et ne répond pas est de cette famille.

**Tranché par Florian le 2026-08-04 — option (a), § Décisions :** la 3.5 livre la case vide
**lisible**, dimensionnée et nommée ; l'affordance reste à la 3.6. **L'AC4 est donc livré à
moitié, et la sous-tâche reste décochée avec sa raison.** C'est la règle §1 appliquée aux
critères — une case vide honnête vaut mieux qu'une case cochée à tort.

⚠️ **La tentation à laquelle il ne faut pas céder** : un `<button disabled>`, un `tabIndex={0}`
sans destination, un `title="Bientôt"`. Chacun re-coche la case sans livrer l'action, et chacun
EST la zone ambiguë qu'on écarte.

### Piège n°7 — `?semaine=` est une saisie libre, arrivée par l'URL

Mettre la semaine dans l'URL plutôt que dans un `useState` règle trois choses d'un coup, et
gratuitement : le rechargement garde la semaine, le bouton Retour du navigateur fait la
navigation entre semaines **sans qu'on l'écrive**, et l'écran reste un rendu serveur pur
(AD-13 : pas de `"use client"` sans cause).

⚠️ **Mais un paramètre d'URL est une saisie**, au même titre qu'un champ. `/menu?semaine=lol`,
`?semaine=2026-13-45`, `?semaine=` ou dix `?semaine=` empilés doivent tous **retomber sur la
semaine courante**, jamais planter, jamais afficher `Invalid Date`.

⚠️ **Et `Date.UTC` ne t'aidera pas à valider — il ne lève pas, il déborde. Mesuré le
2026-08-04 :**

```
new Date(Date.UTC(2026, 12, 45)).toISOString()  →  "2027-02-14T00:00:00.000Z"
```

Un « 45 janvier 2027 » devient tranquillement le 14 février. **La validation se fait par
aller-retour** : reconstruire la chaîne depuis la date obtenue et exiger l'égalité. Même esprit
qu'`estUuid` — une garde de forme avant tout aller-retour réseau.

⚠️ **`searchParams` est une `Promise`** (`strictRouteTypes`). Le typer en objet compile et rend
`undefined` à l'exécution : `next.config.ts:5-13` documente précisément ce bug silencieux.

⚠️ **Normalise avant de rendre.** Un `?semaine=2026-08-06` (un jeudi) désigne bien une semaine ;
l'écran affiche celle de son lundi. Ne recrache pas la valeur reçue.

### Piège n°8 — Trois textes deviennent faux avec ce commit, et un quatrième était déjà faux

Le premier est le plus visible et c'est **le défaut le plus répété du dépôt** — les stories 1.6,
1.7, 2.1 et 2.2 l'ont chacune réparé après coup :

```
app/page.tsx:36-39  « Tout est prêt : le foyer, les rayons, les recettes.
                      Les courses ET LE MENU arrivent. »
```

Le menu n'arrive plus, il est là. Et le fichier porte **déjà** deux commentaires qui racontent
cette exacte erreur (`:26-29`, `:30-35`). **Répare-le dans le même commit que l'écran.**

⚠️ **Le bouton « Mon menu » qui l'accompagne rouvre le piège du voisinage** (`project-context.md`) :
la phrase qui surplombe des libellés à la première personne reste **neutre** — c'est la phrase
qu'on neutralise, jamais le libellé qu'on retourne au tutoiement.

Les deux autres : `app/recettes/page.tsx:23-25` (« la grille du menu (stories 3.5 et 3.6) ») et
`supabase/tests/isolation.test.ts:539-543` (« Aucun écran n'expose encore le menu »).

⚠️ **Un quatrième est déjà faux et n'est PAS de ton ressort** : `app/page.tsx:24` rend
`{nom ?? "Chez toi"}` — un repli à la deuxième personne dix-huit lignes au-dessus de « Mon
foyer ». Reporté par la revue du 2026-08-02 (`deferred-work.md:554-561`). **Ne le corrige pas
en passant** : c'est une décision de microcopy sur trois écrans, et déborder rendrait ta propre
revue plus difficile. La règle est celle que le dépôt applique depuis la 3.2.

### Piège n°9 — La maquette porte quatre choses qui ne sont pas de cette story

`mockups/grille-menu.html` illustre l'écran **fini**, pas le tien :

| Dans la maquette | Où ça vit vraiment |
|---|---|
| Les étiquettes dans les cases (`rapide`, `végé`, `batch`) | **Story 3.4** — et elle n'est pas faite. Aucune colonne, aucune table |
| « Pour **2** personnes » avec ses boutons `−` / `+` (`:69`) | **Story 3.6** — c'est `servings` |
| « 🛒 Générer la liste — 23 ingrédients » et sa note (`:111-116`) | **Epic 4**, FR-16/FR-17 |
| La barre de navigation Liste / Menu / Recettes / Rayons (`:67`) | **Aucune story.** Le produit n'a pas de barre de navigation, et en poser une est une décision de composition qui n'a pas été prise |

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Assigner une recette à une case, retirer, changer le nombre de personnes | **Story 3.6** — c'est son intégralité |
| La contrainte `unique(household_id, meal_date, meal_type, recipe_id)` (AD-6) | **Story 3.6**, dont c'est l'AC2 nommément. Elle n'existe pas encore en base |
| Dédupliquer, fusionner ou masquer les doublons d'une case | **Personne, et surtout pas cet écran** — la 3.6 pose la contrainte ; masquer l'état la priverait de ce qu'elle doit trouver (piège n°5 bis) |
| Étiquettes, filtre, recherche | **Story 3.4**, sautée. Rien n'existe |
| Générer la liste depuis le menu | **Epic 4** — `generate_grocery_list_from_menu` est déjà en base et **n'est appelée par rien** ; ne l'appelle pas |
| Le menu du jour sur le dashboard | **Epic 5** (FR-44) — mais `casesDeLaSemaine` est écrite pour y resservir |
| Realtime, propagation entre appareils | **Epic 4** (AD-8) |
| La colonne `notes` de `meal_plan_entries` | **Aucune story.** Elle existe, rien ne la lit, rien ne l'écrit |
| Une barre de navigation globale | **Aucune story** — voir piège n°9 |
| Une migration, quelle qu'elle soit | **Rien.** Voir § Project Structure Notes |

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement pour ce que l'application **dit**, première personne pour ce qui **nomme**
(`project-context.md`). **Mots bannis :** synchronisation, jeton/token, API, MCP, pont, Supabase,
RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre de l'écran, titre d'onglet, bouton d'accueil | **« Mon menu »** | « Le menu » · « Planning » · « Planificateur » |
| Lien de retour | **« ← Retour »** — cet écran est de premier niveau, comme `/rayons` et `/recettes` (`app/recettes/page.tsx:43-45` porte la justification) | « ← Accueil » sur un sous-écran |
| La semaine affichée | « La semaine du 3 au 9 août » | « Semaine 32 » · « S32 » · « 2026-W32 » |
| Semaine précédente / suivante | « ← La semaine d'avant » · « La semaine d'après → » | « Préc. » · « ‹ » seul · « Prev » |
| Retour à la semaine courante | « Cette semaine » | « Aujourd'hui » (ça désigne un jour, pas une semaine) |
| Les quatre repas | « Petit-déj » · « Midi » · « Soir » · « Collation » | « Breakfast » · « Lunch » · « Dinner » · « Snack » · « Goûter » (la base dit `snack`, l'AC dit **collation**) |
| Une case sans repas | « Rien de prévu » | « Vide » · « — » · « Aucune donnée » · « null » |
| Une semaine entièrement vide | « Tu n'as encore rien prévu cette semaine. » | « Aucun résultat » · « 0 repas » |
| Le jour courant | « aujourd'hui », en toutes lettres | un point de couleur seul |
| Panne de lecture | `error.tsx` est le dernier filet | **jamais** « Réessaie » sur autre chose qu'un transitoire |

⚠️ **`tabular-nums` sur tout chiffre** (UX-DR12) : les numéros de jour d'une colonne à l'autre,
sinon la grille tremble.

⚠️ **Les noms de jours viennent d'`Intl`, pas d'un tableau écrit à la main** — mais avec la
locale `"fr-FR"` **écrite en dur** et `timeZone: "UTC"`. C'est exactement la leçon de
`lib/recettes/lecture.ts:16-23` : `toLocaleDateString()` sans argument suit la locale du
**navigateur**, et le produit est en français par NFR-8, pas par coïncidence de configuration.
Vérifié le 2026-08-04 : `Intl.DateTimeFormat("fr-FR", {weekday:"long", timeZone:"UTC"})` rend
« mardi » (minuscule — la majuscule est à ta charge si tu la veux).

**Pas d'abricot** hors de l'anneau de focus (piège n°4).

**DESIGN.md ne spécifie pas la composition de cet écran** (`:329` range explicitement la grille de
menu hors de son périmètre). Mais il tranche ce qui compte ici : *« Le menu et les recettes
(surface web) peuvent respirer au grand écran »* (`:249`, repris en `EXPERIENCE.md:158`). La
contrainte du magasin est celle de l'écran **liste**, pas celui-ci — ce qui n'ôte rien à l'AC2,
qui est un critère de **repli**, pas de compacité.

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — rien à écrire, donc rien à garder : `meal_plan_all` filtre la lecture. Jamais
  de `SUPABASE_SERVICE_KEY` (le seul appelant légitime est le harnais d'isolation, comme témoin
  négatif)
- **AD-13** — rendu serveur **pur**. Pas de client-direct parce qu'il n'y a pas d'écriture, pas de
  `"use client"` parce que la navigation est une navigation, pas un état
- **AD-16** — menu partagé entre tous les membres ; foyer **symétrique**, aucun rôle
- **AD-17** — l'isolation se prouve par un test **exécuté** : c'est la Task 6, et c'est dû parce
  que cette story ouvre la première lecture applicative de la table
- **NFR-3 / UX-DR10** — le critère de cette story, mesuré et pas regardé (Task 5)
- **NFR-8 / NFR-9** — français, aucun jargon, aucun message technique brut
- **NFR-10** — **aucune dépendance nouvelle.** Ni `date-fns`, ni `dayjs`, ni `luxon`, ni
  `react-calendar`. `Intl` et `Date.UTC` sont natifs et suffisent — c'est ce que les mesures de
  cette story établissent
- **UX-DR11** — cibles ≥ 44px (`min-h-touch`), contraste AA **sur les fonds réels**, anneau de
  focus, 200 % de zoom sans défilement horizontal
- **AR-MIGRATIONS** — sans objet : aucune migration (voir ci-dessous)

### Standards de test

**Comptes mesurés le 2026-08-04 sur `795678e`** (`origin/main`, story 3.3 fusionnée) :

1. **`npm test`** — glob `lib/**/*.test.ts`. **C'est là que va la Task 1, et c'est le vrai filet
   de cette story** : tout le calendaire est pur, donc entièrement testable, et c'est précisément
   là que vivent les deux pièges qui décalent un jour sans rien dire
2. **`npm run test:isolation`** — glob `supabase/tests/**/*.test.ts`, **39 tests** au dernier
   décompte du fichier. La Task 6 en ajoute
3. **Le manuel** — le JSX reste intestable sans dépendance (NFR-10). **L'AC2 et l'AC4 se
   vérifient là**, et nulle part ailleurs. L'AC2 s'y vérifie par un **nombre** (`scrollWidth`),
   pas par une impression

⚠️ **`node --test` sur un glob vide rend 0.** Un fichier mal nommé rend la CI verte sans une
assertion. Les deux jobs comptent les fichiers avant de lancer — **si tu ajoutes un contrôle,
réponds à : « que se passe-t-il s'il ne trouve rien à contrôler ? »**

⚠️ **Vérifie les dents.** Et souviens-toi de la leçon de la 3.2 : une mutation qui ne fait rien
tomber peut être un **no-op** plutôt qu'un test sans dent.

### Project Structure Notes

```
app/menu/
  page.tsx                    +  L'ÉCRAN. Server Component, aucun "use client"
  loading.tsx                 +  Le squelette (aucun AC ne l'exige — voir Task 3)
app/
  page.tsx                    ~  la phrase :36-39 devient fausse, + le lien « Mon menu »
  recettes/page.tsx           ~  le commentaire :23-25 devient à moitié faux
lib/menu/
  semaine.ts + semaine.test.ts  +  tout le calendaire, pur
  menu.ts                     +  casesDeLaSemaine + la constante REPAS
supabase/tests/
  isolation.test.ts           ~  2 tests ajoutés (Task 6) ; commentaire :539-543 à corriger
deferred-work.md              ~  ce que cette story laisse derrière
supabase/migrations/          AUCUNE
lib/supabase/types.ts         INCHANGÉ — meal_plan_entries y est déjà (:176-226)
lib/supabase/proxy.ts         INCHANGÉ — /menu est protégée par défaut, hors PUBLIC_ROUTES
app/globals.css               INCHANGÉ par défaut — grid/subgrid sont des utilitaires
package.json                  INTACT — aucune dépendance (NFR-10)
```

⚠️ **Aucune migration, et c'est vérifiable en une phrase** : la table, sa contrainte de
`meal_type`, son index et sa politique RLS sont posés depuis `initial_schema.sql` du 2026-05-02,
et `lib/supabase/types.ts` les porte déjà. **Si tu te retrouves à écrire une migration, arrête-toi
et relis les Frontières** — la seule qui manque à l'Epic 3 (l'unicité d'assignation, AD-6) est
nommément l'AC2 de la story 3.6.

⚠️ **`app/menu/` n'a pas de `layout.tsx`, et c'est ce qui rend `loading.tsx` nécessaire ici.**
La leçon est écrite deux fois dans le dépôt (`app/recettes/[id]/loading.tsx:1-13`,
`deferred-work.md:514`) : un `loading.tsx` de segment **enveloppe tous ses enfants**, et
l'absence de `loading.tsx` sur un segment neuf ne remonte à **aucun** parent — il n'y a pas de
`app/loading.tsx`. Sans fichier, `/menu` affiche un écran blanc pendant sa lecture.

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session.** Quatre règles mordent ici :

- **§1 — Ne consigner comme vérifié que ce qui a été exécuté, en citant la commande.** Cette story
  distingue partout le **mesuré** du **déduit** ; fais pareil. Les quatre mesures de dates et la
  compilation `subgrid` sont datées et reproductibles, exprès.
- **§2 — Un commentaire explique un pourquoi, jamais un état de la base.** C'est le piège n°8 : ce
  commit rend trois textes faux, et c'est **dans ce commit** qu'ils se réparent.
- **§3 — Une énumération ne peut pas gagner contre une catégorie.** Ici, côté affichage : les
  quatre `meal_type` (piège n°5).
- **§7 — Ce qu'aucune porte automatique ne voit.** L'AC2 en entier. `typecheck`, `lint`, `test` et
  `build` sont tous verts sur une grille qui déborde de l'écran.

**Une case vide honnête vaut mieux qu'une case cochée à tort.** Toutes les stories depuis la 1.5
en ont laissé ; la revue l'a préféré à chaque fois.

### Intelligence git

`origin/main` est à **`795678e`** — « Consulter une recette en lecture (Story 3.3) », PR #19,
fusionnée le 2026-08-02. **Aucune PR ouverte** (`gh pr list --state open`, vérifié le 2026-08-04).
**Branche depuis `origin/main`.**

⚠️ **Le poste est resté sur `feat/recettes-lecture`, qui a 5 commits non écrasés et 1 commit de
retard sur `origin/main`.** C'est la branche déjà fusionnée en écrasement — ne branche pas depuis
elle : `git fetch origin && git switch -c feat/menu-grille origin/main`.

⚠️ **La story 3.3 est fusionnée avec le statut `review`, et c'est délibéré** — elle s'est fermée
en DATANT ce qui restait ouvert (trois cases vides assumées), conformément à la règle §6 bis.
Ce n'est pas un travail en attente qui te bloquerait.

**14 migrations** en place ; cette story n'en ajoute aucune, donc rien à horodater, rien à
régénérer, et `npm run check:migrations` n'a rien de neuf à contrôler.

⚠️ **`main` est protégée** : `verify` et `isolation` requis, `strict`, push direct interdit. Depuis
`vercel.json`, un commit sur `main` applique les migrations en production — **sans objet ici**,
mais fusionner reste mettre en ligne, et le déploiement de `main` se regarde réussir.

Conventional Commits, corps en français ; branche → PR → **squash merge** CI verte. Versions à ne
pas bouger : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`,
`@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5`. Node 24.

### Environnement de test

⚠️ **`localhost:3333`, jamais `127.0.0.1:3333`** — Next 16 bloque ses ressources de développement
en cross-origin, l'hydratation échoue, et **rien ne le dit dans le navigateur**, seulement dans la
sortie du serveur.

⚠️ **`.env.local` pointe sur la PRODUCTION.** Bascule pour le parcours et **restaure à l'identique
en comparant l'empreinte SHA-256**, en consignant les deux sorties. Cette story **amorce des
lignes en base** (Task 5) : c'est le stack local, et lui seul.

⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION.** Un écran qui lit s'y regarde
sans risque ; l'amorçage de la Task 5, jamais.

⚠️ **Après `db reset`, Kong garde l'ancienne adresse du conteneur d'authentification** :
`AuthRetryableFetchError`, `/auth/v1/health` en 502 alors que `auth` est sain. Remède :
`docker restart supabase_kong_nutriclaude`. **Ça ressemble à une régression et ça n'en est pas
une.**

⚠️ **Le thème se contrôle au réglage système**, pas dans les outils de développement — une
émulation ne prouve rien (`globals.css:68` lit `prefers-color-scheme`). `osascript`, et **remets
le réglage après**.

⚠️ **L'automatisation de navigateur n'alimente pas l'état React par la frappe** quand la fenêtre
n'est pas au premier plan (artefact mesuré à la 3.2). **Sans portée sur cette story** : l'écran
n'a aucun champ — sa navigation est faite de liens, qui se cliquent normalement.

### References

- [Source: epics.md#Story-3.5] — user story et 4 AC, cités verbatim ; [#FR-15], [#NFR-3],
  [#UX-DR10], [#UX-DR11], [#UX-DR12], [#NFR-8], [#NFR-10]
- [Source: epics.md#Story-3.6] — ce que cette story **ne fait pas**, et la contrainte AD-6 qui lui
  appartient
- [Source: …/ARCHITECTURE-SPINE.md] — AD-1, AD-2, AD-6, AD-8, AD-13, AD-16, AD-17 ; § Capability →
  Architecture Map (`meal_plan_entries` y est cartographiée sur FR-15)
- [Source: …/DESIGN.md:249, :275, :329] et [EXPERIENCE.md:158] — « le menu et les recettes peuvent
  respirer au grand écran » ; la grille de menu hors périmètre de composition ; **le spine prime
  sur la maquette**
- [Source: …/mockups/grille-menu.html] — illustre l'écran FINI. Les lignes `:34`, `:39`, `:61-63`,
  `:67`, `:69`, `:111-116` portent chacune quelque chose qui n'est pas de cette story
- [Source: _bmad-output/project-context.md] — chargé à chaque session, c'est lui qui fait foi
- [Source: supabase/migrations/20260502000000_initial_schema.sql:175-188] — la table, ses quatre
  `meal_type`, son index ; [:316-318] — `meal_plan_all` ; [:513-572] —
  `generate_grocery_list_from_menu`, **qui n'est appelée par rien et ne l'est pas ici**
- [Source: lib/supabase/types.ts:176-226] — les types sont déjà générés
- [Source: lib/recettes/recettes.ts:43-67] — le motif de lecture : client en paramètre, pas de
  filtre `household_id`, tri secondaire, `error` vs zéro ligne
- [Source: lib/recettes/lecture.ts:16-23] — `LOCALE` écrite en dur, **et pourquoi**
- [Source: lib/recettes/saisie.ts] — `estUuid`, le modèle d'une garde de forme
- [Source: app/recettes/[id]/loading.tsx] et [app/recettes/loading.tsx] — le motif du squelette,
  écrit deux fois : `bg-card-border` (pas `bg-gray-200`), `aria-hidden`, contraste porté par la
  couleur et non l'animation
- [Source: app/page.tsx:26-39] — la phrase à réparer, et les deux commentaires qui racontent
  déjà ce défaut
- [Source: app/recettes/page.tsx:43-45] — « Retour » sans destination nommée, acceptable sur un
  écran de premier niveau **et seulement là**
- [Source: next.config.ts:5-13] — `strictRouteTypes` et le bug silencieux qu'il attrape ;
  [:20-70] — la CSP et son échéance Epic 6
- [Source: supabase/tests/isolation.test.ts:1-37] — la posture du fichier, le témoin négatif, la
  vérification des dents ; [:537-561] — la cascade recette → menu, **déjà mesurée**
- [Source: deferred-work.md:490-621] — la CSP revérifiée le 2026-08-02, les cinq reports de la
  revue de la 3.3, dont **le repli « Chez toi » de l'accueil, à ne pas corriger en passant**
- [Source: 3-3-…md] — les pièges d'outillage (Kong, `.env.local`, l'automatisation), la forme des
  décisions prises avant démarrage
- **Sondes exécutées le 2026-08-04, machine `Europe/Paris`, `node -e`** — (1)
  `new Date(2026,7,4).toISOString()` rend `2026-08-03T22:00:00.000Z` ; (2)
  `new Date("2026-08-04").toISOString()` rend `2026-08-04T00:00:00.000Z` ; (3)
  `Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",…})` rend `2026-08-04` ; (4)
  `new Date(Date.UTC(2026,12,45)).toISOString()` rend `2027-02-14T00:00:00.000Z` ; (5)
  `Intl.DateTimeFormat("fr-FR",{weekday:"long",timeZone:"UTC"})` rend « mardi » ; (6)
  `Intl.DateTimeFormat().resolvedOptions().timeZone` rend `Europe/Paris`
- **Sonde exécutée le 2026-08-04** — `npx @tailwindcss/cli` sur ce dépôt (`tailwindcss@4.3.3`)
  émet bien `.grid-rows-subgrid{grid-template-rows:subgrid}`, `.grid-cols-subgrid`, `.row-span-4`
  et `.md\:grid-cols-7`. **Émission mesurée ; rendu navigateur non vérifié** — c'est la Task 5

---

## Décisions de Florian — 2026-08-04

Les trois questions ont été tranchées **avant démarrage**, conformément aux recommandations. Elles
ne se rouvrent pas en revue sans un fait nouveau.

### 1. L'AC4 est livré à MOITIÉ, et c'est écrit — option (a)

L'AC4 demande deux choses. **« Lisibles »** : livré entièrement. **« Directement actionnables »** :
l'action est d'assigner une recette, c'est-à-dire la story 3.6 en entier — et la seconde moitié de
l'AC4, « sans zone ambiguë », interdit de poser dès maintenant une case focalisable qui ne mènerait
nulle part.

**Les deux autres options ont été écartées, et pour des raisons qui restent valables :** *(b)* une
case focalisable menant à une route que la 3.6 remplira produirait un 404 en attendant, ou un écran
bouchon à jeter — la famille « un conseil qui ne peut pas fonctionner » que le produit s'interdit
depuis le rayon supprimé qui répondait « Réessaie » indéfiniment. *(c)* fusionner 3.5 et 3.6
donnerait une story deux fois plus grosse, dont la revue adversariale devient deux fois plus
difficile — exactement ce que le dépôt évite depuis la 3.2.

⚠️ **Ce que ça veut dire concrètement, et ce n'est pas négociable en cours d'implémentation :**

- **La sous-tâche « actionnable » de la Task 4 reste DÉCOCHÉE, avec sa raison et sa date.** Ce
  n'est pas un oubli à rattraper : c'est la règle §1 appliquée aux critères plutôt qu'aux cases —
  **une case vide honnête vaut mieux qu'une case cochée à tort.** Toutes les stories depuis la 1.5
  en ont laissé, et la revue l'a préféré à chaque fois.
- **Aucune ligne n'est jetée.** La 3.6 posera l'affordance sur la case que la 3.5 aura dessinée,
  dimensionnée (`min-h-touch`) et nommée.
- ⚠️ **Ne « répare » pas cette décision en posant un `<button disabled>` ou un `tabIndex={0}`
  décoratif.** Ce serait précisément la zone ambiguë qu'on écarte, et ça re-cocherait la case sans
  livrer l'action.

⚠️ **C'est aussi la règle §5 en germe** : une prémisse (« la 3.6 le fera ») sert ici à reporter la
moitié d'un critère. **La story 3.6 doit la rouvrir en la citant**, pas la supposer close.

### 2. Quatre repas, dans l'ordre de la journée

**Petit-déj · Midi · Collation · Soir.** Les quatre `meal_type` que la base admet, dans l'ordre où
on mange.

**Quatre** parce que la base les admet et que l'Epic 7 ouvrira une seconde surface (MCP) capable de
les écrire : n'en rendre que trois créerait un état stockable et non affichable, qui disparaîtrait
du web en silence (piège n°5). Coût assumé : **28 cases par semaine** au lieu de 21.

**Cet ordre-là** parce que la collation est un goûter d'après-midi ; la ranger après le soir la
ferait lire comme un appendice.

⚠️ **Un seul endroit décide** — la constante `REPAS` de `lib/menu/menu.ts`. Une chaîne « Midi »
recopiée dans le JSX serait une seconde source de vérité. **Et la grille de la 3.6 hérite de ce
choix** : il est pris une fois, ici.

### 3. La semaine en cours, par défaut

Lundi → dimanche, ISO 8601, la semaine qui contient `aujourdhuiAParis()`. L'alternative — « la
semaine prochaine », puisqu'on planifie avant de faire les courses — a été écartée : elle surprend
au premier chargement, et se rattrape de toute façon en un clic.

⚠️ **« En cours » se calcule à Paris, pas là où tourne le serveur** — c'est le piège n°2, et c'est
cette décision qui le rend structurel plutôt qu'anecdotique : le défaut ne se verrait qu'entre
minuit et 2 h du matin, en production, et jamais sur le poste.

⚠️ **C'est aussi la valeur de repli de toute saisie `?semaine=` invalide** (piège n°7) : garbage,
vide, `2026-13-45` ou paramètre répété retombent tous là, sans message d'erreur.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (`claude-opus-5`), 2026-08-04.

### Debug Log References

#### Phase rouge, constatée (Task 1)

`npm test` à **2026-08-04 15:08:41 CEST**, tests écrits, module absent :
**160 tests · 159 pass · 1 fail** — l'échec étant `lib/menu/semaine.test.ts` qui ne se charge pas.
C'est le constat qu'une preuve du passé demande ; il ne prouve pas encore les dents, d'où la
mutation ci-dessous.

#### Les dents de `semaine.ts`, par mutation

Trois mutations jouées sur le stack, module restauré entre chacune.

| Mutation | Résultat |
|---|---|
| `(getUTCDay() + 6) % 7` → `getUTCDay()` | 179 → **174 pass, 5 fail** |
| Validation par `isNaN` seul, sans l'aller-retour | 179 → **178 pass, 1 fail** |
| `timeZone: FUSEAU` → `timeZone: "UTC"` | 179 → **177 pass, 2 fail** |
| *(restauré)* | **179 / 179** |

#### Les dents de l'isolation, et le piège du no-op

⚠️ **La première mutation ne prouvait rien, et c'est la leçon de la story 3.2 qui l'a signalé.**
Supprimer `meal_plan_all` rend la table **plus** restrictive (RLS active sans politique = tout
refusé) : « A ne lit pas les cases de B » reste vert **gratuitement**.

| Mutation sur `meal_plan_entries` | Résultat |
|---|---|
| `drop policy meal_plan_all` | 60 → **58 pass, 2 fail** — mais PAS le test de lecture |
| Politique remplacée par `using (true) with check (true)` | 60 → **59 pass, 1 fail** — c'est celui-là |
| *(restaurée, et `pg_policies` recontrôlé identique au dépôt)* | **60 / 60** |

#### Sondes exécutées

1. **Type de la ressource embarquée, client TYPÉ** — sonde de typage sur `SupabaseClient<Database>` :
   `recipes` est inféré `{ id: string; title: string }`, ni tableau ni nullable.
2. **Type de la même ressource, client NON typé** — `tsc` sur `isolation.test.ts` :
   `{ id: any; title: any; }[]`, c'est-à-dire un **tableau**. Les deux inférences se contredisent.
3. **Forme réelle à l'exécution** — assertion dans « A lit SA semaine de menu de bout en bout » :
   `Array.isArray(recipes) === false`. **C'est un objet.** Aucune des deux inférences ne le disait ;
   seule l'exécution l'établit.
4. **Le trou d'intégrité** — sonde à deux comptes réels sur le stack local : A **peut** poser dans
   son foyer une case pointant une recette de B (`error` nul, une ligne rendue), et la jointure
   rend alors `recipes: null` — **aucun titre ne traverse**. Détail dans `deferred-work.md`.
5. **Émission CSS** — bundle de production inspecté : `lg:grid-rows-subgrid`,
   `lg:grid-rows-[repeat(5,auto)]`, `lg:row-span-5`, `lg:grid-cols-7`, `gap-gutter`, `p-card`,
   `text-eyebrow`, `min-h-touch` émettent tous leur règle. Aucune classe n'échoue en silence.
6. **Faits calendaires** — `new Date(2026,7,4).toISOString()` rend `2026-08-03T22:00:00.000Z` ;
   `Date.UTC(2026,12,45)` rend le 14 février 2027 ; `fr-CA`/`Europe/Paris` rend `2026-08-04`.

#### Les six portes (2026-08-04)

| Porte | Résultat |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ (0 avertissement) |
| `npm test` | ✅ **179 / 179** (159 avant la story) |
| `npm run test:isolation` | ✅ **60 / 60** (57 avant la story) |
| `npm run build` | ✅ `/menu` en route dynamique, `strictRouteTypes` vert |
| `npm run check:migrations` | ✅ — aucune migration ajoutée ; seules les deux exemptions préexistantes |

### Completion Notes List

**Ce qui est livré, et démontré :**

- `lib/menu/semaine.ts` — tout le calendaire, pur, **20 tests neufs** dont les dents sont mesurées.
  Les deux pièges de fuseau sont chacun couverts par un test qui tombe si on les rouvre.
- `lib/menu/menu.ts` — `casesDeLaSemaine`, `grouperParCase`, et la constante `REPAS` (quatre
  repas, ordre chronologique, décision de Florian). Client en paramètre, donc réutilisable par
  l'Epic 5 et l'Epic 7.
- `app/menu/page.tsx` + `loading.tsx` — grille 7 jours × 4 repas, **un seul DOM**, navigation par
  l'URL, aucun `"use client"`.
- **3 tests d'isolation neufs**, dont un qui mesure une forme de lecture que ce dépôt n'avait
  jamais employée : la ressource embarquée de PostgREST.
- Les trois textes rendus faux par ce commit, réparés **dans le même commit**.

**Ce que l'implémentation a APPRIS et qui n'était pas dans la story :**

1. ⚠️ **`meal_plan_all` ne contrôle pas la provenance de `recipe_id`.** Un membre peut poser dans
   son menu une case pointant la recette d'un autre foyer. **Ce n'est pas une fuite** — la RLS
   filtre bien la ressource jointe, mesuré — mais c'est un défaut d'intégrité, et il appartient à
   la story 3.6 qui ouvre l'écriture. Consigné dans `deferred-work.md`.
2. ⚠️ **La garde `ligne.recipes ? … : []` de `casesDeLaSemaine` est du CODE VIVANT**, pas une
   ceinture théorique — c'est le point précédent qui l'établit. Le commentaire qui disait « le cas
   ne devrait jamais survenir » a été réécrit : il était faux.
3. ⚠️ **Deux inférences de type se contredisaient** sur la ressource embarquée (objet côté client
   typé, tableau côté client non typé). Seule une assertion d'exécution tranche, et elle est
   désormais dans la suite d'isolation.
4. Le seuil de la grille est passé de `md` (768 px) à **`lg` (1024 px)** : à 768 px, sept colonnes
   tombent à ~90 px, ce qui n'est pas un débordement mais n'est pas lisible non plus.

**⛔ CE QUI RESTE OUVERT, ET QUI BLOQUE LA FUSION :**

- **Le parcours à l'écran (Task 5) n'a pas eu lieu.** L'AC2 — « aucun défilement horizontal », le
  critère central de cette story — **n'est pas démontré**. Ce qui est établi tient du raisonnement
  appuyé sur des mesures statiques (toutes les classes émettent, `minmax(0,1fr)` autorise la
  réduction, `break-words` est posé), pas de l'observation. Restent également non observés : les
  deux thèmes, le squelette au réseau bridé, l'anneau de focus, et le rendu de `subgrid`.
- **La sous-tâche « directement actionnables » de l'AC4 reste décochée**, par décision de Florian
  du 2026-08-04 (option a). Reportée à la story 3.6, **à rouvrir en la citant**.

*Aucune de ces deux lignes n'est un oubli : la première demande une paire d'yeux, la seconde une
story. Les deux sont datées plutôt qu'effacées (règle §6 bis).*

### File List

**Créés**

- `lib/menu/semaine.ts`
- `lib/menu/semaine.test.ts`
- `lib/menu/menu.ts`
- `app/menu/page.tsx`
- `app/menu/loading.tsx`
- `_bmad-output/implementation-artifacts/3-5-planifier-le-menu-de-la-semaine-sans-defilement-horizontal.md`

**Modifiés**

- `app/page.tsx` — la phrase d'annonce périmée, et le lien « Mon menu »
- `app/recettes/page.tsx` — le commentaire d'en-tête devenu à moitié faux
- `supabase/tests/isolation.test.ts` — 3 tests neufs + le commentaire de la cascade menu
- `_bmad-output/implementation-artifacts/deferred-work.md` — le trou d'intégrité, le demi-AC4, 3 reports
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut de la story

**Intacts, et vérifiés comme tels** : `supabase/migrations/` (aucune migration due),
`lib/supabase/types.ts` (les types de `meal_plan_entries` existaient déjà), `lib/supabase/proxy.ts`
(`/menu` est protégée par défaut), `app/globals.css`, `package.json` (NFR-10).

### Review Findings

## Change Log

| Date | Quoi |
|---|---|
| 2026-08-04 | Story créée. Statut `backlog` → `ready-for-dev`. Trois questions posées, dont une bloquante sur la Task 4 |
| 2026-08-04 | **Les trois questions tranchées par Florian, avant démarrage.** (1) Option (a) — l'AC4 est livré à moitié, la sous-tâche « actionnable » reste décochée avec sa raison, la 3.6 la referme. (2) Quatre repas : petit-déj · midi · collation · soir. (3) Semaine en cours par défaut. Task 4 débloquée ; **les sept tâches sont ouvertes** |
| 2026-08-04 | **Implémentée sur `feat/menu-grille`** (branchée sur `795678e`). 5 fichiers créés, 5 modifiés. 20 tests unitaires neufs (159 → 179), 3 tests d'isolation neufs (57 → 60), dents mesurées par mutation sur les deux suites. Six portes vertes. ⛔ **Task 5 non faite : le parcours à l'écran, donc l'AC2, n'est PAS démontré** — c'est la condition de fusion. La sous-tâche « actionnable » de l'AC4 reste décochée par décision. |
