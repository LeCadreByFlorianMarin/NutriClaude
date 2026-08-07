---
baseline_commit: fb7b5c40aaff471c3802941e19957eb1c28d75a9
---

# Story 2.4: Composant carte-rayon

Status: done

<!-- ✅ Fermée le 2026-08-07 après DEUX passes de revue adversariale à quatre couches :
     · 1ʳᵉ passe — 3 décisions, 19 correctifs, 5 reports ;
     · 2ᵉ passe, SUR LA PASSE DE CORRECTION (règle §6) — 3 décisions, 15 correctifs, 7 reports.

     ⚠️ **CE QUI RESTE OUVERT, DATÉ PLUTÔT QU'EFFACÉ (règle §6 bis)** :
     le composant n'a toujours **aucun appelant en production**. Le parcours à l'œil a eu lieu sur
     une route jetable, ce qui tient l'AC3 — mais le composant **en situation**, dans la vraie
     liste, sous un vrai `<h1>`, avec de vraies données, reste à voir. C'est la story 4.2.
     Et entre les deux, aucune porte ne garde ce JSX.

     ⛔ **ET LA 2ᵉ PASSE L'A PROUVÉ PLUTÔT QUE PRÉDIT** : ses deux défauts de code neufs étaient
     tous les deux dans ce JSX — `Boolean([])` vaut vrai, et une jointure orpheline peignait la
     pastille abricot vide. Aucune porte automatique ne voyait ni l'un ni l'autre. C'est le
     quatrième epic d'affilée que le défaut décisif sort de là. -->

<!-- ⚠️ CE QUE LA 2ᵉ PASSE ENSEIGNE ET QUI DÉPASSE CETTE STORY :

     1. **Un correctif appliqué au code et oublié au registre reste un défaut.** Les trois constats
        survivants de la 1ʳᵉ passe étaient exactement de cette forme — l'écart n°2 réaffirmait les
        deux choses que l'en-tête déclarait corrigées.
     2. **Une correction peut surestimer sa propre portée.** « La divergence est devenue
        inexprimable » : mesuré, elle se réécrit en une ligne sous 216 tests verts.
     3. **Une formulation conditionnelle sur son propre statut se périme à la seconde où ce statut
        change** — le correctif « déblocage PARTIEL tant que la 2.4 n'est pas `done` » a rouvert la
        contradiction qu'il fermait, dès que la 2.4 est passée `done`.
     4. ⛔ **Des couches de revue parallèles qui écrivent dans l'arbre se fabriquent mutuellement
        des preuves.** Deux constats ont été rejetés pour ça. Une couche qui construit doit le
        faire hors de l'arbre. -->

<!-- ⚠️ CE QUE LA REVUE A CORRIGÉ ET QUI VAUT POUR LES PROCHAINES STORIES — trois commentaires
     affirmaient un état de la base de code, et les trois étaient FAUX (règle §2) :
       · « seed_default_aisles pose une icône sur les onze rayons » → « À classer » n'a pas de
         ligne `aisles`, aucun semis ne peut lui en poser une ;
       · « muted-2 est mesuré à 2,46:1 » → valeur d'avant l'arbitrage, puisée dans le document que
         `globals.css:5-9` interdit explicitement de citer ;
       · « le déstructurer sans le lire ferait échouer lint » → `eslint.config.mjs` pose `^_`.
     Aucun n'était détectable par une porte automatique. C'est le quatrième epic d'affilée. -->


<!-- LA PLUS PETITE STORY DU DÉPÔT, ET LA PLUS INHABITUELLE. Quatre choses à savoir :

     1. ⛔ **ELLE DÉBLOQUE LA STORY 4.2**, qui est arrêtée en attendant (décision de Florian du
        2026-08-06). C'est la seule raison pour laquelle elle passe devant la 2.3.

     2. ⚠️ **ELLE N'A AUCUN CONSOMMATEUR, ET C'EST TOUT SON PROBLÈME.** Un composant sans appelant
        est une dette dans ce dépôt. Son AC3 dit qu'il s'éprouve « sans liste ni base » — mais
        mesuré, `npm test` ne globe que `lib/**/*.test.ts` et **aucun test de composant n'existe
        dans le dépôt**. Voir § Décision D1 : c'est LA question de cette story.

     3. ⚠️ **LA PRÉMISSE QUI L'A GARDÉE DANS L'EPIC 2 EST PÉRIMÉE.** `epic-2-revision-2026-07-29.md`
        §5-D2 la justifie ainsi : « il est bâtissable et **visible sur l'écran des rayons** ».
        Écrit le 2026-07-29 — **avant que cet écran existe**. Celui qui a été construit rend des
        LIGNES avec poignée de glisser, pas des cartes. Règle §5 : la prémisse se rouvre.

     4. ⚠️ **ELLE LIVRE UNE CARTE, ET LA CARTE EST UN PIÈGE EN THÈME SOMBRE.** Mesuré :
        `--card-shadow: none` sur sombre, `--surface-card` = 5,5 % de blanc. La bordure est le SEUL
        séparateur. C'est exactement ce qui a rendu la ligne tirée invisible à la story 2.2 —
        « le troisième epic d'affilée où le défaut décisif est trouvé par l'œil ». -->

## Story

As a membre,
I want que chaque rayon se présente partout de la même façon,
So that l'écran des rayons, la liste et le dashboard parlent le même langage visuel.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-2.4`.

**AC1 — La forme**
**Given** le composant carte-rayon
**When** il reçoit un rayon et un compte d'articles
**Then** il présente son icône emoji (`aria-hidden`), son nom en eyebrow et le ratio `n/total`
(UX-DR4)

**AC2 — Les cas de bord sont des rayons de première classe**
**Given** un rayon sans article, et le rayon « À classer »
**When** ils sont rendus
**Then** le composant les traite comme des rayons de première classe, sans casse d'affichage

**AC3 — La preuve**
**Given** que le composant reçoit ses chiffres en propriétés
**When** il est éprouvé
**Then** il l'est **sans liste ni base** — c'est ce qui le rend démontrable dans cet epic, là où les
critères qui exigeaient une liste ont été déplacés en Epic 4. Le composant est réutilisé tel quel
par les stories 4.2 et 4.17.

---

> **⚠️ L'AC1 dit « quand il reçoit un rayon ET un compte d'articles ».** Le ratio est donc
> conditionné à recevoir un compte — l'AC ne dit pas ce qui se passe sans. C'est la moitié de la
> décision **D2**, et ça décide si le composant peut se monter sur `/rayons`, où il n'y a pas
> d'articles.

> **⛔ L'AC3 dit « il est éprouvé sans liste ni base ». Mesuré : le dépôt n'a AUCUN moyen
> d'éprouver un composant.** `npm test` globe `lib/**/*.test.ts` ; les 22 fichiers de test portent
> tous sur des fonctions pures de `lib/` ou sur la base. ⚠️ **Et le dépôt n'a pas de framework de
> test du tout** — `sprint-change-proposal-2026-07-26.md:466` : « **Aucun framework de test** —
> planifié en Story 4.15 ». `project-context.md:130-134` en tire la règle opératoire : « ni harnais
> de test de composants ». **Décision D1** — et sans elle, l'AC3 est un vœu.

> **⚠️ Ce que ces trois critères NE disent PAS et qui est dû quand même** : le token `--text-qty`
> que le ratio réclame et qui n'existe pas, et le fait que la story 4.2 attend un contrat de props
> précis. Les deux sont au § Ce qui est dû sans être écrit.

---

## Ce qui est MESURÉ — le 2026-08-06, sur `fb7b5c4`

*Règle §1 : ce qui suit a été **exécuté**. Ce qui est déduit est dit « déduit ».*

| # | Question | Réponse **mesurée** |
|---|---|---|
| M1 | Le composant existe-t-il ? | **NON.** `grep -rn CarteRayon app lib` → aucune occurrence. *(Le fichier de story, lui, existe désormais : `sprint-status.yaml:303` → `ready-for-dev`.)* |
| M2 | Le dépôt peut-il tester un composant ? | ⛔ **NON.** `package.json:15` → `node --test "lib/**/*.test.ts"`. **22** fichiers dans `lib/` (fonctions pures) + **2** dans `supabase/tests/` (base). **Zéro `.test.tsx`, zéro test de composant** |
| M3 | Que contient `app/_lib/` ? | `Notice.tsx`, `EcranMessage.tsx` (composants) et `garde.ts`, `libelles.ts`, `useSoumission.ts` (fonctions). C'est l'emplacement des primitives partagées |
| M4 | `/rayons` peut-il l'accueillir ? | ⚠️ **Pas sans le refondre.** `ListeRayons.tsx` rend des `<li>` avec poignée de glisser et flèches ↑↓ — une **ligne**, pas une carte. Et `app/rayons/page.tsx:20-23` exclut explicitement la carte-rayon : « Le ratio suppose des articles, et il n'y en a pas encore » |
| M5 | Pourquoi la story est-elle restée dans l'Epic 2 ? | `epic-2-revision-2026-07-29.md` §5-D2 : « il est bâtissable et **visible sur l'écran des rayons** ». ⚠️ **Écrit le 2026-07-29, avant que cet écran existe** — la 2.1 l'a construit ensuite, en lignes |
| M6 | La carte en thème sombre | ⛔ `--card-shadow: **none**` (`globals.css:82`, « sur sombre, la profondeur vient du verre, pas de l'ombre ») et `--surface-card: rgba(255,255,255,.055)`. **La bordure est le SEUL séparateur** |
| M7 | Le token du ratio | ⛔ **`--text-qty` N'EXISTE PAS.** `globals.css:156-167` s'arrête à `eyebrow / meta / body / title`, et `:151-155` le dit : « les variantes arriveront avec les écrans qui les portent ». `DESIGN.md:278` exige `{typography.qty}` pour le ratio |
| M8 | La classe `.card` convient-elle ? | **NON.** `globals.css:361` → `rounded-lg` (20px) + `p-4`. `DESIGN.md:266` veut `rounded-md` (14px) pour les cartes-rayon, et `p-card` (12px). Le gabarit juste est celui de `app/menu/page.tsx:76` |
| M9 | Qui attend ce composant ? | La story **4.2**, arrêtée en attendant (décision de Florian du 2026-08-06), et la **4.17** pour le groupe « À classer » |
| M10 | `aisles.icon` peut-il être nul ? | **OUI** — colonne nullable, et la vue rend `aisle_icon = null` pour un article sans rayon (mesuré story 4.2). `ListeRayons.tsx:933` fait déjà `{rayon.icone ?? ""}` |
| M11 | Les deux suites | `npm test` **198 / 198**, `npm run test:isolation` **95 / 95** — exécutées |

---

## Décisions à trancher

### ⛔ D1 — Comment cette story se démontre-t-elle ? *(la question centrale)*

**Le contexte, et il n'est pas anodin.** L'Epic 2 a été **révisé le 2026-07-29 précisément parce
qu'il contenait trois stories indémontrables** :

> « Écrites telles quelles, elles ne sont pas "difficiles à tester" : elles sont **indémontrables**.
> On peut les implémenter et les cocher, mais la seule preuve possible serait une déduction — c'est
> exactement ce que `next-steps.md` §4 interdit depuis l'Epic 1. »

La 2.4 a été **gardée** dans l'epic sur la promesse qu'elle, elle serait démontrable — « visible sur
l'écran des rayons » (M5). ⚠️ **Cette promesse est périmée** : l'écran construit ensuite rend des
lignes réordonnables, pas des cartes.

| Option | Ce que ça coûte |
|---|---|
| **(a) — DÉFAUT PRESCRIT.** Extraire la logique pure dans `lib/rayons/carte.ts` (le libellé du ratio, l'`aria-label`, le repli d'icône nulle), la **tester dans `npm test`**, et livrer le JSX sans consommateur | Respecte le motif du dépôt à la lettre : `lib/rayons/saisie.ts` est testé, `ListeRayons.tsx` ne l'est pas. ⚠️ **Mais le JSX reste non éprouvé jusqu'à la 4.2**, et l'AC3 n'est donc tenu qu'à moitié — **il faut l'écrire, pas le maquiller** |
| (b) Monter la carte sur `/rayons`, ratio omis faute d'articles | Donne un consommateur immédiat et un parcours à l'écran. ⚠️ **Exige de trancher D2 (ratio optionnel)** et de décider si la carte **remplace** la ligne de la story 2.2 — ce qui toucherait son glisser, ses flèches et son test d'isolation. ⛔ **Et elle poserait de l'abricot sur un écran de CONFIGURATION** : UX-DR2 (`epics.md:153`) énumère ses usages légitimes — compteur, coche, provenance active, tuile Courses, pastille « arrive… », bouton d'ajout, anneau de focus — et **la pastille de carte-rayon n'y figure pas**. Argument de plus pour (a) |
| (c) Étendre le glob de test à `app/` et écrire un vrai test de composant | Tiendrait l'AC3 pleinement. ⛔ **Exige un framework de rendu, et le dépôt n'en a aucun** — `sprint-change-proposal-2026-07-26.md:466` (« Aucun framework de test — planifié en Story 4.15 ») et `project-context.md:130-134` (« ni harnais de test de composants »). ⚠️ **Ce n'est PAS une lecture de NFR-10**, qui porte sur le coût de possession (`epics.md:115`) : c'est une décision de projet, et seul Florian peut la rouvrir |

⚠️ **Quelle que soit l'option, la conséquence s'écrit** : si la preuve visuelle est reportée à la
4.2, la story se ferme **en le datant** (règle §6 bis), jamais en laissant croire que l'AC3 est
tenu.

### ⚠️ D2 — Le contrat de props

La story 4.2 attend un composant précis, et la 4.17 puis la 4.18 en hériteront. **Trois points à
figer maintenant** — les changer plus tard touchera trois stories :

⚠️ **BLOC MIS À JOUR AU CONTRAT RÉELLEMENT LIVRÉ (seconde passe, 2026-08-07).** Il portait encore
`pris?: number` et un `children` **requis**, alors que la revue du 2026-08-06 avait élargi les deux
et que la story 4.2 avait été corrigée. Les stories 4.17 et 4.18 lisent CE bloc : le laisser périmé
leur aurait fait écrire un appel qui ne compile pas (`TS2741` sur le rayon vide de l'AC2).
Le type est **exporté** sous le nom `ProprietesCarteRayon` — l'importer plutôt que le recopier.

```ts
export type ProprietesCarteRayon = {
  id: string | null;        // ⚠️ point 1 — `null` = « À classer »
  nom: string | null;       // ⚠️ point 4 — voir piège n°4
  icone: string | null;     // M10 : nullable
  pris?: number | null;     // ⚠️ point 2 — `null` compte comme absent
  total: number;
  children?: React.ReactNode; // ⚠️ point 3 — vide est un cas nominal (AC2)
};
```

1. **`id` inclus ?** — **DÉFAUT PRESCRIT : oui.** La story **4.18** (corriger le rayon d'un article)
   en aura besoin, et l'ajouter plus tard changerait la signature chez trois consommateurs.
   ⚠️ `null` est une valeur légitime : c'est « À classer ».
2. **`pris` optionnel ?** — **DÉFAUT PRESCRIT : oui**, ce qui rend l'option D1-(b) possible sans
   rien casser. Sans `pris`, la carte n'affiche pas de ratio. ⚠️ **Conforme à l'AC1**, qui
   conditionne le ratio à « recevoir un compte d'articles ».
4. **`nom` nullable ?** — **DÉFAUT PRESCRIT : oui**, avec le repli dans `lib/rayons/carte.ts`.
   ⚠️ Sans ça, la story 4.2 se retrouverait avec `nom: null` face à une prop `string` — voir
   piège n°4, c'est un trou mesuré entre les deux stories.
3. **`children` plutôt qu'une liste d'articles typée** — **DÉFAUT PRESCRIT : `children`.** C'est ce
   qui tient l'AC3 « sans liste ni base » : le composant ne connaît pas le type `ArticleDeListe`,
   qui appartient à `lib/liste/` (story 4.2).

---

## Ce qui est dû sans être écrit dans les AC

### 1. Le token `--text-qty` — le ratio ne peut pas s'écrire sans lui

**Mesuré (M7).** `DESIGN.md:278` prescrit `{typography.qty}` pour le ratio ; `globals.css` ne le
publie pas. Un utilitaire Tailwind inconnu **ne génère rien et échoue EN SILENCE** — c'est le piège
`bg-gray-200` que tout le dépôt documente.

À poser dans `@theme` : **12px**, `line-height 1.4`. Le `tabular-nums` s'écrit sur l'élément
(voir Task 3). **`DESIGN.md:239`** vise cette story au mot près : « `tabular-nums` partout où un
chiffre s'affiche — compteurs, quantités, **ratios n/total des rayons**, horloge. Les colonnes de
chiffres ne doivent jamais sautiller quand la valeur change » — et le ratio change à chaque coche
(story 4.3).

⚠️ **`globals.css:151-155` prévoit explicitement ce moment** : « seuls les rôles que l'Epic 1
emploie sont posés — les variantes arriveront **avec les écrans qui les portent** ». C'est cet
écran.

⚠️ **`text-meta` fait déjà 12px** : si la décision est de s'en contenter, **l'écrire** plutôt que de
laisser croire que `{typography.qty}` a été honoré.

### 2. Le contrat attendu par la story 4.2

La 4.2 est **arrêtée en attendant celle-ci** et sa Task 2 dit : « si le contrat de props diverge de
ce que la 4.2 attend, **le signaler plutôt que l'adapter en place** ». Le § Décision D2 fige ce
contrat ; toute divergence doit être répercutée dans le fichier de la 4.2 **dans le même commit**.

---

## Tasks / Subtasks

- [x] **Task 1 — La logique pure** (AC1, AC2, AC3) — `lib/rayons/carte.ts`
      <!-- ⚠️ C'est le seul endroit du dépôt où ce composant peut être ÉPROUVÉ (M2). Le glob de
           `npm test` est `lib/**/*.test.ts` : ce qui vit dans `app/` n'est testé par rien. -->
  - [x] `libelleRatio({ pris, total })` → la chaîne visible (`"3/4"`) et l'`aria-label`
        <!-- ⚠️ Paramètres NOMMÉS, corrigé le 2026-08-07 : deux nombres positionnels de même type
             rendaient l'inversion indétectable, `libelleRatio(4, 3)` rendant « 3/3 ». -->
        <!-- ⛔ Et l'annonce ne passe PAS par `aria-label` : un `<span>` nu porte le rôle
             `generic`, *name-prohibited* en ARIA 1.2. Jumeau `.sr-only`, motif `InviteCard`. -->
        (`"3 sur 4 pris"`), **fixé par `review-accessibility.md:65`** : « ratio
        `aria-label="3 sur 4 pris"` »
        ⚠️ **Rendre les deux depuis la même fonction**, jamais deux chaînes construites séparément :
        c'est l'invariant qui se périmerait en silence (règle §4)
  - [x] Le cas **`total = 0`** — un rayon sans article (AC2). **DÉFAUT PRESCRIT : pas de ratio du
        tout** (ni visible, ni `aria-label`) : `0/0` n'apprend rien.
        ⚠️ **Mais `pris = 0` avec `total > 0` rend bien `0/4`** — la story 4.2 le dit à son
        relecteur (`4-2-…md:370-373`), et rendre `""` là contredirait les deux stories
  - [x] Le cas **`pris` absent** (D2, point 2) — pas de ratio, et l'`aria-label` non plus
  - [x] `lib/rayons/carte.test.ts` — les trois cas ci-dessus, plus le rayon « À classer »

- [x] **Task 2 — Le composant** (AC1, AC2) — `app/_lib/CarteRayon.tsx`
  - [x] Le contrat de props de la **décision D2**, à l'identique
  - [x] En-tête : pastille `rounded-sm` **`bg-accent-soft`** portant l'emoji, nom en
        `text-eyebrow uppercase`, ratio aligné à droite
        ⛔ **LE RATIO EST EN `text-muted`, JAMAIS `text-muted-2`.** `EXPERIENCE.md:145` nomme le
        « ratio n/total » parmi les textes d'info secondaire en muted, et `review-accessibility.md:57`
        classe le défaut **[high]** : `muted-2` mesure **3,27:1 sur clair** et **5,14:1 sur sombre**
        (⚠️ **valeurs recalculées à la seconde passe du 2026-08-07** sur les couleurs réellement en
        vigueur, `--muted-2: #8b9083` / `#8990a5`, `globals.css:56,85`. Ce bloc affichait 2,46:1 et
        4,41:1 — les valeurs d'AVANT l'arbitrage, que `globals.css:5-9` interdit de citer, et que
        l'en-tête de cette story déclarait déjà corrigées),
        sous AA dans les deux thèmes. ⚠️ **`text-muted-2` existe et compile** (`globals.css:190`) —
        rien ne t'arrêtera si tu l'écris
        ⚠️ **L'emoji est `aria-hidden`** (AC1, UX-DR4) — le nom est déjà en texte juste à côté, et
        le lire deux fois n'apporte rien. Motif exact : `ListeRayons.tsx:930-934`
        ⚠️ **L'icône peut être nulle** (M10) : `{icone ?? ""}`, **largeur fixe** pour que les noms
        restent alignés d'une carte à l'autre — `ListeRayons.tsx:932` emploie `w-6 shrink-0 text-center`
        ⚠️ **`bg-accent-soft` est le SEUL abricot de ce composant**, et il est explicitement
        spécifié (`DESIGN.md:150-151`). Voir piège n°3
  - [x] Gabarit : `rounded-md border border-card-border bg-surface-card p-card`, **plus
        `box-shadow: var(--card-shadow)`**
        ⚠️ **PAS la classe `.card`** (M8) : elle est en `rounded-lg` (20px) + `p-4`.
        ⛔ **ET LE GABARIT DE `app/menu/page.tsx:76` N'A PAS D'OMBRE — c'est une case de menu, pas
        une carte-rayon.** `DESIGN.md:149` donne à la carte-rayon
        `shadow-light: 0 6px 18px rgba(60,50,30,.06)`, valeur **identique** à `--card-shadow`
        (`globals.css:45`). Le copier tel quel priverait la carte de son séparateur en thème CLAIR —
        le miroir exact du piège n°1
  - [x] **`<h2>` porte le nom du rayon** — la 4.2 rend un `<h1>` d'écran au-dessus, et un saut de
        niveau casserait la navigation au lecteur d'écran. Motif : `app/menu/page.tsx:281-286`
  - [x] `children` rendus dans un conteneur explicite — **la 4.2 y injectera un `<ul>` de `<li>`**
        (`4-2-…md:445-447`). Sans conteneur nommé ici, l'espacement se décidera deux fois
  - [x] ⚠️ **Un rayon SANS article doit se rendre sans casse** (AC2) : `children` vide est un cas
        nominal, pas une erreur

  **Le squelette, pour qu'il ne se reconstruise pas à partir de trois citations dispersées :**

  ```tsx
  <section className="rounded-md border border-card-border bg-surface-card p-card"
           style={{ boxShadow: "var(--card-shadow)" }}>   {/* clair : l'ombre ; sombre : la bordure */}
    <div className="flex items-center gap-2">
      {/* Pastille : dimension à trancher — `size-6` la rend carrée et centrée.
          ⚠️ Si `icone` est nulle, une pastille abricot VIDE s'affiche : masquer la
          pastille en gardant la gouttière, ou poser un emoji de repli. À décider. */}
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-sm bg-accent-soft">
        {icone ?? ""}
      </span>
      {/* `min-w-0` + `break-all` : nom en champ libre, aucune garantie d'espace où couper */}
      <h2 className="text-eyebrow min-w-0 flex-1 break-all uppercase">{nom}</h2>
      {/* `tabular-nums` sur l'élément — il ne se porte pas sur le token (Task 3) */}
      {ratio && (
        <span className="text-qty text-muted tabular-nums" aria-label={ratio.pourLecteur}>
          {ratio.visible}
        </span>
      )}
    </div>
    <div className="mt-2">{children}</div>
  </section>
  ```

  ⚠️ **`ratio` vient de `libelleRatio()` (Task 1)** — un seul objet portant les deux chaînes, jamais
  deux constructions séparées.
  ⚠️ **Les dimensions de la pastille ne sont données NULLE PART** — ni dans `DESIGN.md`, ni dans
  UX-DR4. `ListeRayons.tsx:932` n'en est pas un modèle : son `<span>` **n'a pas de fond**, donc sa
  largeur seule suffisait. Sur fond coloré, il faut une hauteur.

- [x] **Task 3 — Le token** (§ Ce qui est dû, point 1)
  - [x] **DÉFAUT PRESCRIT : poser le token.** `--text-qty: 12px` **et**
        `--text-qty--line-height: 1.4` (`DESIGN.md:99-104`), dans **`@theme` SEUL**
        ⛔ **PAS dans `@theme inline`** : mesuré, ce bloc ne contient que des `--color-*`
        (`globals.css:183-200`). Un rôle typographique y serait une entrée morte
        ⛔ **`tabular-nums` NE SE PORTE PAS SUR LE TOKEN** : Tailwind 4 n'expose pas
        `font-variant-numeric` comme modificateur de `--text-*`. C'est un **utilitaire à écrire sur
        l'élément** — et l'y oublier échoue en silence, exactement comme `bg-gray-200`
  - [x] ⚠️ **Se rabattre sur `text-meta` n'est PAS iso-spec** : il est à `line-height 1.5`, la
        spécification dit 1.4. Si c'est le choix, **l'écrire comme un écart**, pas comme une
        équivalence

- [x] **Task 4 — La démonstration** (AC3) — *forme tranchée par **D1***
  - [ ] ~~Si D1-(a) : le parcours visuel est **reporté à la 4.2**, et c'est **écrit** dans les notes
        de complétion — pas maquillé~~ ⛔ **DÉCOCHÉ À LA SECONDE PASSE DU 2026-08-07** : la case
        enregistrait un énoncé que son propre commentaire déclare renversé deux lignes plus bas. Le
        report n'a PAS eu lieu — Florian a tranché pour la route jetable. C'est la forme exacte du
        correctif `[medium]` de la passe précédente sur la Task 5, reproduite ici. Règle §1 : une
        case vide honnête vaut mieux qu'une case cochée à tort.
        → ⚠️ **RENVERSÉ À LA REVUE DU 2026-08-07.** Florian a tranché pour la route jetable
        plutôt que le report : le parcours a donc eu lieu ici (Task 5). Le report reste vrai pour
        ce qu'une route de sonde ne peut pas prouver — le composant **en situation**, dans la
        vraie liste, avec de vraies données. C'est la 4.2.
  - [ ] Si D1-(b) : monter la carte sur `/rayons`, et ⚠️ **mesurer que le glisser et les flèches de
        la story 2.2 fonctionnent toujours** (`npm run test:isolation`, plus le parcours au doigt)
        → **NON RETENUE.** D1 n'a pas été tranchée par Florian ; le défaut prescrit (a) s'applique.

- [x] **Task 5 — Les deux thèmes, et c'est la porte qui compte ici**
  - [x] ⛔ **Le thème SOMBRE est le cas dangereux** (M6, piège n°1). `--card-shadow: none` et
        `--surface-card` à 5,5 % de blanc : **la bordure est le seul séparateur**. Une carte sans
        `border-card-border` y est invisible
  - [x] ⚠️ **Au réglage SYSTÈME, jamais dans les outils de développement** — `globals.css:68` lit
        `prefers-color-scheme`, et une émulation ne prouve rien. Sur macOS :
        `osascript -e 'tell application "System Events" to tell appearance preferences to set dark
        mode to false'` — **et le remettre après**
        → ✅ **FAIT À LA REVUE DU 2026-08-07**, une fois les correctifs appliqués. Une route
        jetable `app/sonde-2-4/` a monté SEPT cartes (nominale, « À classer » à trois valeurs
        nulles, rayon vide, sans `pris`, nom long sans espace, et deux voisines dont une sans
        icône), parcourues aux **deux réglages système** puis supprimée avant le commit.
        ⚠️ `/sonde-2-4` a dû être ajoutée temporairement à `PUBLIC_ROUTES` de
        `lib/supabase/proxy.ts` — **restauré, `git diff` vide sur ce fichier**.
        ⚠️ **Et un dossier préfixé `_` n'est PAS une route** : `app/_probe/` rendait 404, Next
        traitant ces dossiers comme privés. D'où le nom sans tiret bas.
  - [x] ⚠️ **Contraste sur le fond RÉEL**, pas sur la base pleine : la carte est du verre
        translucide sur sombre (`EXPERIENCE.md:143`)
        → ✅ **FAIT** — à l'œil, sur le rendu réel des deux thèmes. Les cartes se détachent du fond
        en sombre par leur bordure, et en clair par leur ombre. ⚠️ **Constaté à l'œil, pas
        calculé** : aucun ratio de contraste n'a été mesuré au pixel.

- [x] **Task 6 — Les portes, puis les statuts**
  - [x] `npm run lint` · `npm run typecheck` · `npm test` (**198 attendus au minimum**, plus ceux de
        la Task 1) · `npm run test:isolation` (**95 attendus au minimum**)
  - [x] ⚠️ **Aucune migration** : cette story ne touche pas la base. `check:migrations` reste à
        16 / 14 / 2 / 0, et `lib/supabase/types.ts` n'est pas régénéré
  - [x] ⛔ **LE CONTRAT DE LA 4.2 DIVERGE DÉJÀ DE D2 — ce n'est pas conditionnel.** Mesuré :
        `4-2-…md:150-154` porte `CarteRayon({ nom, icone, pris, total, children })` — **sans `id`**,
        et avec **`pris` requis**. Réécrire ce bloc **dans le même commit**, et y ajouter
        `lib/rayons/carte.ts` aux notes de structure : rien dans la 4.2 ne dit aujourd'hui que la
        seule partie testée du composant vit là
  - [x] `Status` du fichier de story, **puis** `sprint-status.yaml`. Règle §6 bis : **le fichier
        fait foi**. ⚠️ **Et débloquer la 4.2** : son entrée de suivi dit qu'elle attend celle-ci

---

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Besoin | Où c'est déjà | Piège si tu le refais |
|---|---|---|
| L'emoji décoratif + largeur fixe | `ListeRayons.tsx:930-934` | Le lire au lecteur d'écran : le nom est déjà en texte (UX-DR4) |
| Le repli d'icône nulle | `ListeRayons.tsx:933` — `{rayon.icone ?? ""}` | Un `?` optionnel casse l'alignement des noms |
| Le gabarit de carte | `app/menu/page.tsx:76` | `.card` est en `rounded-lg` + `p-4`, pas ce qu'il faut (M8) |
| Le `<h2>` de section | `app/menu/page.tsx:281-286` | Sauter un niveau de titre |
| Le motif de test pur | `lib/ordre.test.ts`, `lib/rayons/saisie.test.ts` | Écrire le test à côté du composant : il ne serait exécuté par rien (M2) |
| Le nom de rayon en champ libre | `ListeRayons.tsx:935` — `break-all` | Un nom long déborde ; il n'y a aucune garantie d'espace où couper |
| Les tokens d'espacement | `globals.css:146-149` — `p-card` (12px), `gap-gutter` (14px) | Recopier `p-4` : `DESIGN.md:247` fixe 12px pour le padding de carte |

### Piège n°1 — La carte est invisible en thème sombre si la bordure manque

**Mesuré (M6).** `--card-shadow: none` sur sombre, et le commentaire de `globals.css:82` dit
pourquoi : « la profondeur vient du **verre**, pas de l'ombre ». Or le verre, c'est
`rgba(255,255,255,0.055)` — 5,5 % de blanc sur `#191016`.

**Ce n'est pas théorique** : la story 2.2 s'y est fait prendre. Ses notes de complétion :

> « La ligne tirée était **transparente en thème sombre** — `--surface-card` vaut 5 % de blanc,
> `--card-shadow` vaut `none`. Deux noms superposés, illisibles. **Cinq portes vertes, zéro
> signal.** C'est le troisième epic d'affilée où le défaut décisif est trouvé par l'œil. »

⚠️ **`border border-card-border` n'est donc pas de la décoration** : c'est le seul séparateur en
sombre. Et le contrôle se fait au **réglage système**, pas dans les outils de développement.

### Piège n°2 — Le composant n'a aucun appelant, et le dépôt traite ça comme une dette

C'est le cœur de la décision D1, et il faut le regarder en face plutôt que le contourner :

- `npm test` ne le voit pas (M2) ;
- `npm run typecheck` **ne compile pas un composant que rien n'importe** — il vérifiera sa syntaxe,
  pas son usage ;
- `npm run lint` pourrait même le signaler comme inutilisé.

**Ce que ça veut dire concrètement** : entre cette story et la 4.2, **une régression sur ce
composant ne serait détectée par rien**. C'est pourquoi la Task 1 extrait tout ce qui peut l'être
dans `lib/` — c'est la seule partie qui aura un filet.

### Piège n°3 — L'abricot, et une règle du dépôt qui dit le contraire

`bg-accent-soft` sur la pastille d'emoji est **explicitement spécifié** (`DESIGN.md:150-151`), et
UX-DR2 autorise l'abricot sur la surface courses.

⛔ **Mais `project-context.md:247` dit aujourd'hui, sans nuance** : « **Pas d'abricot** hors de
l'anneau de focus : UX-DR2 le réserve à l'action courses. » Le dev agent charge ce fichier à chaque
session et y lira un ordre contradictoire.

⛔ **CETTE STORY POSE L'ABRICOT EN PREMIER — TOUJOURS**, puisqu'elle est le prérequis dur de la 4.2.
Le « si » n'a pas de branche fausse : **c'est elle qui corrige `project-context.md:247`**, et qui
**retire la tâche du fichier de la 4.2** (`4-2-…md:465-468`, qui la revendique aujourd'hui). Sinon
elle sera faite deux fois, ou pas du tout.

⚠️ **Et rien d'autre en abricot** : ni le nom du rayon, ni le ratio, ni la bordure de carte (`seule
la tuile Courses du dashboard porte la bordure abricot`, `DESIGN.md:277`).

### Piège n°4 — « À classer » n'est pas un cas spécial pour ce composant

L'AC2 demande que « À classer » soit traité **comme un rayon de première classe**. Concrètement :
c'est un rayon dont `id` est `null` et dont `icone` peut l'être aussi. **Le composant n'a rien à
savoir de plus** — pas de branche `if (nom === "À classer")`, pas de style particulier.

⚠️ **Le groupe « À classer » lui-même est la story 4.17** : sa position en fin de parcours, son
non-repli, son effacement quand il est vide. Ce composant ne fait que ne pas le casser.

⚠️ **Et son nom vient de la base**, pas du code : `seed_default_aisles` amorce un rayon `Autre` à
`sort_order` 999, et un article sans rayon rend `aisle_name = null`.

⛔ **MAIS PERSONNE NE POSSÈDE LE REPLI DE CE LIBELLÉ, ET C'EST UN TROU RÉEL.** Mesuré : la 4.2 type
son groupe `nom: string | null` (`4-2-…md:328-333`), le contrat D2 exige `nom: string`, et la 4.2
**ne peut pas attendre la 4.17** puisqu'elle est bloquée par cette story. À l'implémentation, `nom`
sera `null` face à une prop `string`.

**DÉFAUT PRESCRIT : le repli vit dans `lib/rayons/carte.ts`** (Task 1), donc testable, et la prop
devient `nom: string | null`. ⚠️ **La 4.17 gardera le dernier mot sur le libellé** — c'est un repli
technique, pas une décision de microcopy.

### Frontières — ce que cette story ne fait pas

| Hors périmètre | Sa story |
|---|---|
| Les règles mot-clé → rayon, l'écran qui les gère | 2.3 |
| La lecture de la liste, le groupement, l'écran `/courses` | 4.2 |
| Cocher — donc le ratio qui **bouge** | 4.3 |
| Le groupe « À classer » comme groupe de première classe (position, non-repli) | 4.17 |
| Déplacer un article vers un autre rayon | 4.18 |
| La ligne-article (coche, quantité, provenance) | 4.2 (libellé + quantité), 4.3/4.13 (coche), 4.6 (provenance) |
| La tuile Courses du dashboard, avec sa bordure abricot | Epic 5 |
| **Le repli/dépli d’une carte** — ⚠️ UX-DR4 dit que « À classer » n’est jamais repliée **par défaut**, ce qui présuppose que les cartes se replient. **Aucune story actuelle ne le spécifie.** Si le besoin arrive, le contrat gagnera une prop : **à signaler, jamais à improviser** | *(non attribuée)* |

⚠️ **Si tu te retrouves à lire la base, à importer `lib/liste/` ou à écrire une chaîne « À
classer », arrête-toi et relis l'AC3.**

### Contraintes d'architecture applicables

- **AD-1** — « chaque surface est un **adaptateur mince**, jamais un dépôt de règles ». Ce composant
  est l'exemple pur : il reçoit, il rend, il ne décide de rien
- **UX-DR4** — « emoji `aria-hidden` + nom en eyebrow capitales + ratio `n/total` ; ordre des cartes
  = parcours magasin ; "À classer" jamais repliée par défaut ». ⚠️ **L'ordre et le non-repli ne sont
  PAS de ce composant** — ils appartiennent à qui le monte (4.2, 4.17)
- **UX-DR11** — plancher d'accessibilité : anneau de focus (déjà global, `globals.css:236-239`),
  contraste **sur les fonds réels**, colonne unique à 200 % de zoom
- **UX-DR12** — `tabular-nums` sur tout chiffre. Le ratio change à chaque coche (4.3) : sans lui, il
  sautille
- **`project-context.md:130-134`** — « Aucune dépendance nouvelle (NFR-10) : ni bibliothèque de
  glisser-déposer, ni sélecteur d'emoji, ni gestionnaire de formulaire, **ni harnais de test de
  composants** ». ⚠️ **C'est cette ligne, pas NFR-10 lui-même**, qui ferme l'option D1-(c) — NFR-10
  (`epics.md:115`) porte sur le coût de possession. La décision d'origine est
  `sprint-change-proposal-2026-07-26.md:466`
- **NFR-3** — l'écran liste est en colonne unique sans défilement horizontal. Un nom de rayon long
  ne doit pas élargir la carte : `min-w-0` sur le conteneur flex, `break-all` sur le nom

### Standards de test

**Comptes MESURÉS le 2026-08-06 sur `fb7b5c4`** : `npm test` **198 / 198**,
`npm run test:isolation` **95 / 95**.

**Où va quoi :**

1. **`lib/rayons/carte.test.ts`** (`npm test`) — la logique pure : le libellé du ratio et son
   `aria-label`, `total = 0`, `pris` absent. **C'est la seule preuve automatique que cette story
   peut produire** (M2).
2. **Rien dans `test:isolation`** — ce composant ne touche pas la base. ⚠️ **Sauf si D1-(b)** : le
   monter sur `/rayons` exige de vérifier que les sept tests de réordonnancement de la 2.2 passent
   toujours.

⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs comptent les fichiers avant de lancer.

⚠️ **Vérifie les dents.** Retire `tabular-nums`, ou le `aria-hidden` de l'emoji : est-ce qu'un test
tombe ? **Non — et c'est le point.** Ce composant est en très grande partie hors de portée des
tests, et c'est exactement pourquoi le parcours à l'œil (Task 5) n'est pas optionnel ici.

### Project Structure Notes

```
lib/rayons/
  carte.ts                    +  NOUVEAU — la logique pure du ratio (la SEULE partie testable)
  carte.test.ts               +  NOUVEAU — dans `npm test`
app/_lib/
  CarteRayon.tsx              +  NOUVEAU — le composant, props seules
app/globals.css               ~  `--text-qty` (§ dû, point 1), ou la décision écrite de s'en passer
app/rayons/                   ⚠️ TOUCHÉ SEULEMENT si D1-(b) — et alors la story 2.2 est concernée
_bmad-output/…/4-2-….md       ~  seulement si le contrat de props diverge de D2
supabase/                     ⛔ INTACT — aucune migration, aucun test d'isolation
package.json                  INTACT — aucune dépendance (NFR-10)
```

⚠️ **Si tu écris une requête Supabase, tu as quitté le périmètre.** L'AC3 dit « sans liste ni base ».

### Intelligence des stories précédentes

**Story 2.2** (`2-2-reordonner-le-parcours-par-manipulation-directe.md`), la plus proche :

- ⛔ **Le défaut décisif a été trouvé à l'œil, pas par les tests** — la ligne transparente en thème
  sombre, « cinq portes vertes, zéro signal ». Piège n°1.
- ⚠️ **Une erreur de diagnostic consignée plutôt qu'effacée** : la story a d'abord attribué un échec
  au groupement des mises à jour de React, alors que la page avait simplement défilé. Le correctif a
  été gardé, mais **son commentaire réécrit** parce qu'il affirmait un scénario *mesuré* alors qu'il
  était seulement *raisonné*. C'est la règle §1, enfreinte puis réparée.
- ⚠️ **Les flèches ne sont pas un doublon du glisser** (WCAG 2.5.7) — si D1-(b) touche `/rayons`,
  **ne les prends pas pour de la redondance**.

**Story 4.1**, la plus récente : sa revue a trouvé **deux affirmations que la story déclarait
tenues et qui ne l'étaient pas**. Le motif vaut ici : l'AC3 de cette story est celui qu'il est le
plus facile de cocher à tort.

### Intelligence git

| Commit | Ce qu'il enseigne |
|---|---|
| `fb7b5c4` feat(liste) (4.1) | La revue adversariale a trouvé un critère déclaré tenu et défait par une RPC. **Un critère se mesure, il ne se déclare pas** |
| `9c127d4` feat(menu) (3.6) | Le squelette désaligné (44px rendus, ~40px au squelette) : **une valeur de style qu'aucun test ne tient se périme en silence** |
| `86fafe7` feat(rayons) (2.2) | Fusionnée sans revue adversariale, puis six défauts d'usage — **tous dans du JSX qu'aucun test n'exécute**. ⚠️ **C'est exactement la nature de cette story** |

### Environnement de test

- **Aucun stack requis pour la Task 1** : la logique pure se teste sans base ni réseau
- **Le serveur de développement écoute sur 3333**, et l'hôte compte : `localhost:3333`, jamais
  `127.0.0.1:3333`
- ⚠️ **Le thème se contrôle au réglage système** (piège n°1), et se remet après
- ⚠️ **Rien à démontrer sur la prévisualisation Vercel** tant que le composant n'a pas de
  consommateur (D1)

### Ce que tu sais déjà, et où ça vit

**`_bmad-output/project-context.md` est chargé à chaque session.** Quatre règles mordent ici :

- **§1** — ne consigner comme vérifié que ce qui a été exécuté. ⚠️ **L'AC3 est le critère le plus
  facile à cocher à tort de tout le dépôt** : « éprouvé » ne veut pas dire « écrit »
- **§4** — un invariant entre deux endroits se **mesure**. Ici : le libellé visible du ratio et son
  `aria-label`, qui doivent venir de la même fonction
- **§7** — ce qu'aucune porte automatique ne voit : **le rendu**. Cette story est presque
  entièrement dans cet angle mort
- **⚠️ `project-context.md:247` contredit cette story sur l'abricot** — voir piège n°3

### References

- `_bmad-output/planning-artifacts/epics.md#Story-2.4` — les trois AC, verbatim ; UX-DR4
  (`:155`), UX-DR11 (`:162`), UX-DR12
- `_bmad-output/planning-artifacts/epic-2-revision-2026-07-29.md` — **§3** (pourquoi trois stories
  étaient indémontrables) et **§5-D2** (pourquoi celle-ci est restée dans l'epic — ⚠️ prémisse
  périmée, M5)
- `_bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md` — `:266`
  (`rounded-md`), `:278` (l'en-tête de carte, verbatim), `:150-151` (la pastille voilée abricot),
  `:277` (la bordure abricot est réservée à la tuile Courses), `:247` (les espacements)
- `_bmad-output/planning-artifacts/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md` — `:103`
  (carte-rayon), `:143` (contraste sur les fonds réels)
- `.../review-accessibility.md` — `:65` : l'`aria-label` du ratio, « 3 sur 4 pris ».
  ⚠️ **Ne pas y puiser de valeurs de couleur** (`globals.css:5-9`)
- `_bmad-output/implementation-artifacts/4-2-lecture-client-direct-de-la-liste-groupee-par-rayon.md`
  — **le consommateur**, sa Task 2 et sa décision D1 (2026-08-06)
- `_bmad-output/implementation-artifacts/2-2-reordonner-le-parcours-par-manipulation-directe.md` —
  les notes de complétion, et le défaut de thème sombre
- `app/globals.css` — `:79-82` (le verre et l'ombre absente), `:146-149` (les espacements),
  `:151-167` (les rôles typographiques et ce qui manque), `:361` (`.card`)
- `app/rayons/ListeRayons.tsx:930-935` — l'emoji `aria-hidden`, la largeur fixe, le `break-all`
- `app/menu/page.tsx:76` — le gabarit de carte exact ; `:281-286` — le `<h2>` de section
- `_bmad-output/project-context.md` — les règles de méthode

---

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code, `dev-story`), 2026-08-06.

### Debug Log References

Toutes les commandes ci-dessous ont été **exécutées**. Ce qui ne l'a pas été est dit tel quel.

| Commande | Résultat |
|---|---|
| `npm test` | **207 / 207** à l'implémentation (198 avant, **+9**) · **216 / 216** après la revue du 2026-08-07 (**+9** de plus) |
| `npm run test:isolation` | **95 / 95** — inchangé, et c'est l'attendu : cette story ne touche pas la base |
| `npm run typecheck` | vert |
| `npm run lint` | vert (`--max-warnings 0`) |
| `npm run check:migrations` | **16 / 14 / 2 exemptées / 0 sans** — inchangé, aucune migration |
| `npm run build` | réussi, et il a servi de **mesure** : voir « les classes existent » ci-dessous |
| **Banc des mutations** | ⚠️ **La commande manquait à ce tableau, et c'est le défaut §1 que la revue a relevé** : « quatre passages au banc » était consigné comme mesuré sans dire comment. Procédé réel, à l'implémentation comme à la revue : `cp lib/rayons/carte.ts <sauvegarde>` · `perl -0pi -e '<mutation>' lib/rayons/carte.ts` · `npm test` · restauration + `diff` vérifié vide |
| `npm run dev` + parcours | **2026-08-07** — route jetable `app/sonde-2-4/`, sept cartes, aux deux réglages système (`osascript … set dark mode to true/false`), à 390 px et en large. Route et modification de `PUBLIC_ROUTES` **supprimées, `git diff` vide** |

**Seconde passe de revue — 2026-08-07.** Toutes exécutées après application des 15 correctifs :

| Commande | Résultat |
|---|---|
| `npm test` | **220 / 220** (+4 : invisible intérieur du nom, bornage du nom, jointure orpheline, réduction au premier grapheme) |
| `npm run test:isolation` | **95 / 95** — inchangé, cette story ne touche toujours pas la base |
| `npm run typecheck` · `npm run lint` | verts (`--max-warnings 0`) |
| `npm run check:migrations` | **16 / 14 / 2 exemptées / 0 sans** — inchangé |
| `npm run build` | réussi |
| **Banc des mutations** | `cp` · `perl -0pi` · `npm test` · restauration + `diff` vérifié vide. **M1** `nomDeRayon` revenu à la rédaction d'avant (sans bornage) → **attrapé, 219/220** · **M2** `iconeDeRayon` idem (jointure orpheline, pas de réduction) → **attrapé, 218/220** · **M3** `total <= 0` → `=== 0` → **attrapé, 219/220** · **M4** annonce reconstruite à part du visible → ⛔ **SURVIT, 220/220** — et c'est désormais **écrit comme tel** dans `carte.ts` : une convention, pas une garantie |

### Completion Notes List

**Ce qui a été livré** — trois fichiers, aucune dépendance, aucune migration :

1. `lib/rayons/carte.ts` — `libelleRatio()` et `nomDeRayon()`, les deux seules parties du composant
   qu'un test peut tenir ;
2. `app/_lib/CarteRayon.tsx` — le composant, props seules, aucune lecture ;
3. `--text-qty` dans `app/globals.css` (12px / 1.4).

**D1 et D2 n'ayant pas été tranchées par Florian, les DÉFAUTS PRESCRITS ont été appliqués** :
logique pure extraite et testée, JSX livré sans consommateur, preuve visuelle reportée à la 4.2.

---

**⚠️ L'AC3 N'EST TENU QU'À MOITIÉ, ET IL FAUT LE LIRE AVANT DE FERMER CETTE STORY.**

Il dit « il est éprouvé sans liste ni base ». Ce qui est éprouvé :

- **la logique pure** — 18 tests après la revue (9 à l'implémentation), et un banc des dents
  **rejoué et corrigé le 2026-08-07** :

  | Mutation | Verdict |
  |---|---|
  | le bornage des chiffres retiré | **attrapée** — « valeur incohérente » + « compte négatif » |
  | le repli du nom retiré | **attrapée** — « un rayon SANS nom » + « nom vide ou fait de blancs » |
  | un rayon vide rend un ratio quand même | **attrapée** — « un rayon VIDE n'a pas de ratio » |
  | `total <= 0` → `total === 0` | **attrapée** depuis la revue — 215/216. ⚠️ **Survivait avant** : aucun test ne couvrait un total négatif |
  | le nom rendu NON nettoyé | **attrapée** depuis la revue — 215/216. ⚠️ **Survivait avant** |
  | le garde entier-fini retiré | **attrapée** depuis la revue — 215/216 |
  | `iconeDeRayon` rend l'icône brute | **attrapée** depuis la revue — 215/216 |
  | **l'annonce reconstruite à part du visible** | ⛔ **SURVIT — 216/216, et aucun test ne peut l'attraper.** Un doublon numériquement équivalent rend les mêmes valeurs ; aucune assertion ne distingue deux implémentations équivalentes |
  | `null` ne compte plus comme absent | ⛔ **survit — mutant ÉQUIVALENT** : le garde entier-fini le rattrape derrière, le comportement est inchangé |

  ⛔ **C'EST LA CORRECTION LA PLUS IMPORTANTE DE CETTE PASSE, ET ELLE PORTE SUR UN FAIT
  CONSIGNÉ COMME MESURÉ.** Le tableau d'origine annonçait « quatre passages, tous propres » et
  attribuait l'un d'eux à l'invariant central — l'annonce et le visible venant du même appel. C'était
  **faux** : le mutant qui reconstruit l'annonce à partir des mêmes nombres bornés laissait la suite
  entière verte (mesuré). Ce que ce test attrapait était le **bornage**, que la ligne 1 revendiquait
  déjà. Il y avait trois mutations indépendantes, pas quatre, et l'invariant qui justifie l'existence
  du module n'en faisait pas partie.

  ⚠️ **La réponse n'est pas un test de plus — il n'en existe pas.** `libelleRatio` DÉRIVE désormais
  `pourLecteur` de `visible` : la divergence est devenue inexprimable. **L'invariant est tenu par
  construction, pas par une assertion**, et les commentaires qui prétendaient le contraire dans trois
  fichiers ont été corrigés.

- **l'existence réelle des classes** — le dépôt documente qu'un utilitaire Tailwind inconnu échoue
  **en silence**, et ce composant en emploie trois neuves. Mesuré dans la feuille construite
  (`.next/static/chunks/453_ky_drl4ob.css`) : ⚠️ **la revue a recompté — le composant emploie 23
  utilitaires distincts, pas 14**, et les 23 sont bien générés. Le chiffre d'origine sous-déclarait
  le périmètre de sa propre sonde (règle §1) ; la conclusion, elle, tenait. Dont
  `.text-qty{font-size:var(--text-qty);line-height:var(--tw-leading,var(--text-qty--line-height))}`
  et `.bg-accent-soft{background-color:var(--accent-soft)}`. ⚠️ **Avec un contrôle négatif** :
  `.bg-gray-200` est bien **absent**, ce qui prouve que la sonde a des dents.

- **les deux thèmes, au niveau des valeurs** — extraites de la même feuille :

  | | clair | sombre |
  |---|---|---|
  | `--card-shadow` | `0 6px 18px #3c321e0f` | **`none`** |
  | `--surface-card` | `#fff` | `#ffffff0e` (5,5 %) |
  | `--card-border` | `#14141412` | `#ffffff1a` |

  La carte porte **et** l'ombre **et** la bordure : le clair est tenu par la première, le sombre par
  la seconde. C'est le piège n°1, refermé par construction.

✅ **LE RENDU A ÉTÉ ÉPROUVÉ LE 2026-08-07, ET LE PARI DE LA REVUE A PAYÉ.** Les notes d'origine
concluaient ici que le rendu « ne pouvait pas » être éprouvé faute de consommateur. **C'était une
prémisse, pas une contrainte** : Florian a tranché pour une route jetable (`app/sonde-2-4/`, sept
cartes, supprimée avant le commit), parcourue aux deux réglages système.

⛔ **Et elle a immédiatement justifié son coût** — la revue avait trouvé, dans ce même JSX que
« rien ne pouvait éprouver », **deux défauts que les 207 tests, le typecheck, le lint et le build
laissaient passer** :

| Défaut | Pourquoi aucune porte ne le voyait |
|---|---|
| ⛔ L'`aria-label` du ratio posé sur un `<span>` nu — rôle `generic`, *name-prohibited* en ARIA 1.2 | Les trois classes existaient, le type était juste, l'attribut compilait. **La mesure « 14 utilitaires sur 14 générés » prouvait que les classes existent, pas qu'elles sont sur les bons éléments.** Le dépôt avait déjà payé cette leçon sur `InviteCard`, et la solution — `.sr-only` — était déjà écrite |
| ⚠️ La pastille ET la gouttière retirées quand l'icône est nulle | La note d'écart la disait « sans portée en pratique — `seed_default_aisles` pose une icône sur les onze rayons ». ⛔ **Réfuté par la story elle-même** : la vue fait un `left join`, donc « À classer » rend `aisle_icon = null` et n'a aucune ligne `aisles`. **La seule carte structurellement sans icône est la première que la 4.2 affichera.** Et `normaliserIcone` rend `null` sur champ vide |

Ce qui a été **vu**, aux deux thèmes : les cartes se détachent (l'ombre en clair, la bordure en
sombre — piège n°1 refermé), les noms de deux cartes voisines s'alignent qu'elles aient une icône
ou non, le rayon vide tient debout sans ratio ni corps, le rayon sans `pris` n'affiche pas de
ratio, et un nom de 49 caractères sans espace s'enroule dans la carte à 390 px **sans défilement
horizontal** (NFR-3).

⚠️ **Ce que la sonde NE prouve PAS** : le composant **en situation** — dans la vraie liste, avec de
vraies données, sous le `<h1>` d'un écran réel. C'est la story 4.2, et c'est le seul report qui
reste.

⚠️ **Et entre cette story et la 4.2, une régression sur ce JSX ne sera détectée par rien** :
`npm test` ne le voit pas, et aucun appelant ne valide son contrat. C'est le motif de `86fafe7`
(la story 2.2, fusionnée sans revue, six défauts d'usage ensuite, tous dans du JSX qu'aucun test
n'exécute). ⚠️ **`id` reste le meilleur exemple** : exigé de tous les appelants, lu par personne,
validé par aucune porte jusqu'à la 4.18.

---

**Trois écarts à la story, tous délibérés et tous écrits :**

1. **La Task 3 a été faite AVANT la Task 2.** Le JSX de la Task 2 emploie `text-qty`, que la Task 3
   pose : l'écrire dans l'autre ordre aurait produit une classe inexistante, et le dépôt documente
   que ça échoue en silence.
2. **`id` avait été OMIS du contrat au premier jet**, alors que D2 le prescrit pour la story 4.18.
   Rattrapé. ⚠️ **Il est dans le type et le corps l'ignore** : `CarteRayon.tsx` le déstructure en
   `id: _id`, et `eslint.config.mjs` pose `varsIgnorePattern: "^_"` — `npm run lint` est vert.
   Le type l'exige des appelants, le corps l'ignore, et **rien ne le valide** jusqu'à la 4.18.
   ⛔ **CORRIGÉ À LA SECONDE PASSE DU 2026-08-07.** Cet écart disait « n'est déstructuré par rien »
   et « le déstructurer sans le lire ferait échouer `lint --max-warnings 0` » : **les deux étaient
   faux, et les deux avaient déjà été relevés par la passe du 2026-08-06**, qui les a corrigés dans
   le code sans les corriger ici. C'est le motif de cette seconde passe en entier — un correctif
   appliqué au code et oublié au registre.
3. ~~**La pastille n'est PAS rendue quand l'icône est nulle**~~ — ⛔ **RENVERSÉ À LA REVUE DU
   2026-08-07.** L'écart posait un faux dilemme : la story n'offrait que deux issues (« masquer la
   pastille **en gardant la gouttière**, ou poser un emoji de repli ») et l'implémentation en avait
   pris une troisième, retirant la boîte entière. Sa justification — « sans portée en pratique,
   `seed_default_aisles` pose une icône sur les onze rayons » — était **réfutée par la story
   elle-même** (M10, piège n°4) : le groupe « À classer » n'a aucune ligne `aisles`, donc aucun
   semis ne peut lui poser d'icône, et `normaliserIcone` rend `null` sur champ vide pour tout rayon
   créé par un membre.
   **Correctif : la boîte de 24 px est toujours rendue, `bg-accent-soft` seulement s'il y a une
   icône.** Les deux exigences tiennent ensemble — la gouttière de la story, et l'interdit UX-DR2
   sur l'abricot vide. ✅ **Vérifié à l'œil** aux deux thèmes : deux cartes voisines dont l'une n'a
   pas d'icône alignent leurs noms.

4. **Le nettoyage de l'icône a été extrait dans `lib/rayons/carte.ts`** (`iconeDeRayon`), ajouté à
   la revue. ⚠️ **Ce n'était pas de la symétrie gratuite** : le garde était une vérité nue, donc
   `icone=" "` peignait le carré abricot vide que le commentaire disait éviter. En le déplaçant, la
   décision « la pastille s'affiche-t-elle ? » devient **testable**, là où elle vivait dans le JSX
   qu'aucun test n'atteint.

---

**Ce que cette story débloque et referme ailleurs :**

- ✅ **La story 4.2 est débloquée, PLEINEMENT** — la 2.4 est revue et `done` dans son fichier comme
  dans le suivi, donc la condition que le déblocage « partiel » attendait est **remplie**.
  ⛔ **CORRIGÉ À LA SECONDE PASSE DU 2026-08-07, et le correctif précédent avait créé la
  contradiction qu'il croyait fermer.** La passe du 2026-08-06 avait aligné cette ligne sur le
  suivi en écrivant « déblocage PARTIEL tant que la 2.4 n'est pas `done` » ; puis la 2.4 est passée
  `done` et le suivi a été réécrit en « DÉBLOCAGE COMPLET ». Résultat : les deux documents se
  contredisaient de nouveau, **en sens inverse**, et la règle §6 bis faisait cette fois de la story
  — la moins exacte — celle qui fait foi. ⚠️ **Leçon : une formulation conditionnelle sur son propre
  statut se périme à la seconde où ce statut change.** L'état s'écrit, la condition ne se recopie pas. Le contrat livré est bien celui qu'elle annonce (`id`, `nom` et `icone`
  nullables, `pris` optionnel, `children`) — vérifié champ par champ. ⚠️ **Deux ajustements de
  contrat issus de la revue à répercuter** : `pris` accepte désormais `null` autant qu'`undefined`,
  et `children` est **optionnel** (il était requis, ce qui faisait du rayon vide de l'AC2 une erreur
  de typage chez l'appelant — mesuré `TS2741`).
- ✅ **`project-context.md` a été corrigé dans le même commit.** Il interdisait l'abricot « hors de
  l'anneau de focus » ; cette story pose le premier abricot du produit, donc c'est elle qui lève
  l'interdit — en le bornant, pas en l'effaçant. La tâche a été retirée du fichier de la 4.2, qui la
  revendiquait aussi.

### File List

| Fichier | État |
|---|---|
| `lib/rayons/carte.ts` | **nouveau** — `libelleRatio`, `nomDeRayon`, `iconeDeRayon`. ⚠️ **2ᵉ passe** : `nomDeRayon` et `iconeDeRayon` sont désormais des **enveloppes** de `lib/rayons/saisie.ts` (décision D2) — le fichier n'importe plus `lib/texte.ts` |
| `lib/rayons/carte.test.ts` | **nouveau** — **22 tests** (18 + 4 à la 2ᵉ passe), banc des mutations rejoué deux fois |
| `app/_lib/CarteRayon.tsx` | **nouveau** — le composant, et `ProprietesCarteRayon` exporté. ⚠️ **2ᵉ passe** : importe `Children` de React pour garder le corps (`Boolean([])` vaut vrai) |
| `app/globals.css` | modifié — le token `--text-qty` |
| `_bmad-output/project-context.md` | modifié — l'interdit sur l'abricot, borné |
| `_bmad-output/implementation-artifacts/2-4-composant-carte-rayon.md` | modifié — ce fichier |
| `_bmad-output/implementation-artifacts/4-2-…md` | modifié — le contrat de props (Task 6) ⚠️ **absent de cette liste jusqu'à la revue du 2026-08-07**, alors que la Task 6 imposait de le réécrire dans le même commit |
| `_bmad-output/implementation-artifacts/deferred-work.md` | modifié — les cinq constats reportés par la revue |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | modifié — statut |

⚠️ **Créés puis SUPPRIMÉS pendant la revue, à ne pas chercher dans l'arbre** : `app/sonde-2-4/page.tsx`
(la route jetable) et une entrée temporaire dans `PUBLIC_ROUTES` de `lib/supabase/proxy.ts`. Les deux
sont retirés, `git diff` vide sur `proxy.ts`.

⚠️ **Aucun fichier sous `supabase/`**, `package.json` intact, `lib/supabase/types.ts` non régénéré.

### Review Findings

**Revue adversariale du 2026-08-06** — quatre couches parallèles (Blind Hunter,
Edge Case Hunter, Acceptance Auditor, plus une couche `clean-code` / `clean-architecture` / `tdd`
demandée à l'invocation). ⚠️ **Toutes les affirmations ci-dessous marquées « mesuré » ont été
exécutées par la passe de revue**, sondes et mutations comprises ; les fichiers ont été restaurés
et vérifiés identiques après chaque mutation.

✅ **Ce que la revue a CONFIRMÉ, et c'est inhabituel dans ce dépôt** : les six commandes du
Debug Log reproduisent toutes (`npm test` 207/207, isolation 95/95, typecheck, lint,
`check:migrations` 16/14/2/0, build), le contrat D2 correspond champ par champ chez les deux
stories, le token est bien dans `@theme` et non `@theme inline`, `text-muted` et non `muted-2`,
et la carte porte **et** l'ombre **et** la bordure. Les défauts sont là où la story avait elle-même
prédit qu'ils seraient : dans le JSX que rien n'exécute.

#### Décisions à trancher

- [x] [Review][Decision] **L'AC3 n'a AUCUNE preuve pour sa moitié rendue, et la story est en `review`** — La logique pure est éprouvée (9 tests). Mais l'AC1 (`aria-hidden` sur l'emoji, nom en eyebrow, ratio) et l'AC2 (rayon vide, « À classer ») n'ont **aucune preuve d'aucune nature** : pas de test, et la Task 5 (parcours à l'œil dans les deux thèmes) est reportée. La mesure « les classes existent dans la feuille construite » prouve que les utilitaires sont *générés*, pas qu'ils sont *sur les bons éléments* — et le constat `[Patch]` sur l'`aria-label` en est la démonstration : trois classes valides sur un élément qui ne porte pas le rôle attendu. **Option A** — produire la preuve avant de fermer : route jetable montée sous `npm run dev` (`localhost:3333`), quatre cartes (icône + `pris`, sans icône, `children` vide, sans `pris`), les deux thèmes au réglage système, route supprimée avant le commit. **Option B** — fermer en datant la condition ouverte (règle §6 bis) et laisser la 4.2 la refermer.
- [x] [Review][Decision] **`pris`/`total` et `children` sont deux sources de vérité que le composant ne peut pas rapprocher** — L'AC3 lui interdit de connaître le type des articles, donc si la 4.2 filtre les enfants et calcule `total` sur la liste non filtrée, la carte annonce « 3 sur 5 pris » au-dessus de 4 lignes et **aucune porte ne le voit**. Second état invalide représentable : `pris: 3, total: 0`, où le ratio disparaît en silence. C'est la forme d'invariant que la règle §4 veut mesurée ; ici il n'est même pas affirmé. **Le correctif touche le contrat D2 gelé** (`compte?: { pris: number; total: number }`), donc les stories 4.2, 4.17 et 4.18 — d'où la décision.
- [x] [Review][Decision] **`lib/rayons/carte.ts` n'est pas du domaine : c'est un présentateur, et sa place a été décidée par le glob de test** — Le fichier l'écrit lui-même (`:8-9`) : « parce que c'est la seule partie du composant qu'un test peut tenir ». Le contenu confirme la couche : `pourLecteur` est une chaîne d'`aria-label`, « À classer » est de la microcopie, et `:28` prescrit depuis le cercle intérieur comment le cercle extérieur doit rendre. Le dépôt a déjà `app/_lib/libelles.ts` pour la copie partagée. Risque : qu'un lecteur ultérieur lise `lib/rayons/` comme « les règles métier des rayons » et y dépose une vraie politique à côté d'un `aria-label`. **Option A** — nommer la couche (`presentation-carte.ts`, ou une ligne d'en-tête). **Option B** — retirer la contorsion à la racine : `"test": "node --test \"{lib,app}/**/*.test.ts\""`. ⚠️ **Mesuré : c'est un glob, pas un harnais — NFR-10 intact.** Mais `node --test` refuse un `.tsx` (`ERR_UNKNOWN_FILE_EXTENSION`, mesuré), donc ça n'ouvre que les helpers purs de `app/`, pas les composants.

#### Correctifs

- [x] [Review][Patch] **[high] L'`aria-label` du ratio est sur un `<span>` sans rôle — le défaut que cette story existe pour fermer n'est pas fermé** [`app/_lib/CarteRayon.tsx:120-125`] — Un `<span>` nu porte le rôle `generic`, **name-prohibited en ARIA 1.2** : le nom accessible retombe sur le texte, et le lecteur d'écran annonce « trois barre oblique quatre ». ⛔ **Le dépôt a déjà payé cette leçon et écrit le remède** : `app/globals.css:393-397` — « `aria-label` est ignoré sur un `<p>` (le rôle `paragraph` est *name-prohibited* en ARIA 1.2) » — et `app/foyer/InviteCard.tsx:122-134` implémente le motif sanctionné (`aria-hidden` + jumeau `.sr-only`). ⚠️ **Conséquence** : tout le type `RatioDeRayon`, l'invariant phare de la Task 1, testé et documenté dans trois fichiers, alimente un attribut qui n'atteint personne. Correctif : `aria-hidden` sur le span visible + `<span className="sr-only">{ratio.pourLecteur}</span>`. La classe existe déjà (`globals.css:399`).
- [x] [Review][Patch] **[high] L'invariant central n'est tenu par aucun test, et le « banc des dents » le déclare tenu** [`lib/rayons/carte.test.ts:16-19`] — ⚠️ **Mutation EXÉCUTÉE** : remplacer `pourLecteur: \`${borne} sur ${total} pris\`` par `pourLecteur: \`${Math.min(Math.max(pris, 0), total)} sur ${total} pris\`` — c'est-à-dire construire l'annonce **séparément** du visible, exactement ce que l'invariant interdit — rend **207 pass / 0 fail**. La suite mesure des *valeurs*, jamais la source commune : tout doublon aujourd'hui correct survit, et c'est précisément le doublon qui se périmerait ensuite. ⛔ **Le tableau des notes de complétion (`:572-577`) est donc inexact** : sa ligne 2 (« l'annonce construite à part du visible ») n'est vraie que d'un mutant qui abandonne *aussi* le bornage — ce que la ligne 1 revendique déjà. Il y a trois mutations indépendantes, pas quatre, et l'invariant central n'en fait pas partie. ⚠️ **Le banc ne figure pas non plus au Debug Log** alors qu'il est consigné comme mesuré (règle §1). Correctif : rendre le doublon **structurellement impossible** — dériver l'une de l'autre — puis corriger le tableau et les trois commentaires qui affirment qu'un test tient l'invariant.
- [x] [Review][Patch] **[medium] La pastille ET la gouttière disparaissent quand l'icône est nulle, et la justification écrite est réfutée par la story elle-même** [`app/_lib/CarteRayon.tsx:88-95`] — La story prescrivait `largeur fixe` (`:210-211`) et son squelette n'offrait que deux issues : « masquer la pastille **en gardant la gouttière**, ou poser un emoji de repli » (`:236-237`). L'implémentation a pris une troisième voie. ⛔ **La note d'écart 3 la justifie par « sans portée en pratique — `seed_default_aisles` pose une icône sur les onze rayons »** — or **mesuré**, la vue fait un `left join` (`20260805092611:625`) et rend `aisle_icon = null` pour le groupe « À classer », qui n'a pas de ligne `aisles` : `seed_default_aisles` ne peut pas le couvrir. Et `normaliserIcone` (`lib/rayons/saisie.ts:32-38`) rend `null` sur champ vide, donc tout rayon créé par un membre peut être sans icône. **La seule carte structurellement sans icône est celle que la 4.2 doit rendre en premier.** ⚠️ **Défaut jumeau** : le garde est une vérité nue (`icone ?`), pas un `.trim()` comme pour `nom` — `icone=" "` rend l'aplat abricot vide que le commentaire dit éviter. Correctif : toujours rendre la boîte de 24 px, n'y poser `bg-accent-soft` que s'il y a une icône, et rogner comme `nomDeRayon` le fait.
- [x] [Review][Patch] **[medium] Le bornage laisse passer `NaN`, l'infini, le non-entier et `null`** [`lib/rayons/carte.ts:61-67`] — ⚠️ **Sonde EXÉCUTÉE** : `libelleRatio(NaN, 4)` → `"NaN/4"` / « NaN sur 4 pris » ; `(3, NaN)` → `"NaN/NaN"` (`NaN <= 0` est faux, le garde tombe) ; `(3, Infinity)` → `"3/Infinity"` ; `(2.5, 4)` → `"2.5/4"` ; `(3, 1e21)` → `"3/1e+21"` ; **`(null, 4)` → `"0/4"`** — le garde est `=== undefined`, donc un `null` venu d'une colonne de comptage devient « zéro pris » au lieu de « pas de ratio », l'inverse de ce que l'AC1 prescrit. La raison d'être écrite de la fonction (`:52-55`) est « on borne, et le défaut reste chez celui qui a mal compté » : elle ne tient pas pour le seul cas où un compte calculé ailleurs dérape vraiment. Correctif : `Number.isInteger` sur les deux, et traiter `null` comme `undefined`.
- [x] [Review][Patch] **[medium] `children` est requis, donc le rayon vide de l'AC2 ne compile pas** [`app/_lib/CarteRayon.tsx:51`] — ⚠️ **Mesuré** : `<CarteRayon id={null} nom="X" icone={null} total={0} />` rend `TS2741: Property 'children' is missing`. L'AC2 appelle ce cas « un rayon de première classe » et le commentaire `:135-136` le dit « nominal » — mais l'appelant doit écrire `<></>` pour le satisfaire. ⚠️ Et `:138` rend `<div className="mt-2">` sans condition : un rayon vide paie 8 px de marge sous rien. Correctif : `children?: React.ReactNode`.
- [x] [Review][Patch] **[medium] La Task 5 est cochée `[x]` alors que ses deux sous-tâches vérifiantes portent « ⛔ PAS FAIT »** [`2-4-composant-carte-rayon.md:279-292`] — Les raisons sont écrites honnêtement dans le corps, ce qui est le bon réflexe, mais **la case parente enregistre une porte franchie qui ne l'a pas été** (règle §1). Même forme, plus bénigne, pour la Task 4 (`:272`). Correctif : décocher la parente, garder les raisons.
- [x] [Review][Patch] **[medium] L'état du dépôt est affirmé dans trois fichiers, sans date ni fichier qui fait foi** [`lib/rayons/carte.ts:5-9`, `lib/rayons/carte.test.ts:9-14`, `app/_lib/CarteRayon.tsx:12-18`] — Les trois répètent en entier « le glob de `npm test` est `lib/**/*.test.ts`, aucun `.test.tsx`, aucun framework installé ». C'est un **état**, pas un pourquoi : la règle §2 exige alors la date et le fichier qui fait foi, et aucune des trois copies n'en porte. Le jour où la story 4.15 pose le harnais, les trois deviennent fausses d'un coup. ⚠️ **C'est le motif exact des « cinq commentaires devenus faux » que `project-context.md` consigne, dont quatre écrits pendant une revue.** Correctif : une seule copie, datée, citant `package.json` comme source.
- [x] [Review][Patch] **[medium] Deux trous de couverture, tous deux mesurés par mutation survivante** [`lib/rayons/carte.test.ts:43-47`, `:95-99`] — ⚠️ **Exécuté** : (1) `total <= 0` → `total === 0` rend **207/207 verts** — aucun test ne couvre un `total` négatif, où le mutant rendrait `"-3/-3"` ; (2) `return propre ? nom : "À classer"` (nom **non rogné**) rend **207/207 verts** — le cas mixte `"  Fruits  "`, où la fonction rogne réellement, n'est vérifié nulle part. Correctif : deux assertions.
- [x] [Review][Patch] **[low] Un ratio de contraste est cité depuis un document que `globals.css` interdit explicitement de citer** [`app/_lib/CarteRayon.tsx:111-112`] — Le commentaire dit « `muted-2` est mesuré à 2,46:1 sur clair ». ⚠️ **Mesuré** : la valeur livrée est `--muted-2: #8b9083` (`globals.css:56`), soit **3,27:1** ; 2,46:1 correspond à `#a2a79a`, la valeur *d'avant l'arbitrage*. Or `globals.css:5-9` l'écrit noir sur blanc : « `review-accessibility.md` propose d'AUTRES valeurs : ce sont celles d'avant l'arbitrage, elles ont été remplacées. **Ne pas y puiser.** » La conclusion (employer `muted`) reste juste ; la preuve invoquée est périmée.
- [x] [Review][Patch] **[low] Le commentaire de `id` énonce une contrainte de lint que la configuration du dépôt réfute** [`app/_lib/CarteRayon.tsx:39-41`] — Il affirme « le déstructurer sans le lire ferait échouer `lint --max-warnings 0` ». ⚠️ **Mesuré** : `eslint.config.mjs:32-35` pose `argsIgnorePattern: "^_"` et `varsIgnorePattern: "^_"` ; déstructurer `id: _id` passe `npm run lint` **vert** (exécuté). La conséquence réelle n'est pas celle qui est écrite : c'est qu'une propriété **obligatoire n'est validée par rien** — ni test, ni typecheck, ni lint — jusqu'à la 4.18. Un appelant qui y passerait l'`id` de l'article ne serait repris par aucune porte.
- [x] [Review][Patch] **[low] Un nom fait uniquement de caractères de largeur nulle contourne le repli et rend un `<h2>` invisible** [`lib/rayons/carte.ts:90`] — ⚠️ **Sonde exécutée** : `String.prototype.trim` retire les blancs et `U+FEFF`, mais **pas** `U+200B`–`U+200D` ni `U+2060` — `nomDeRayon("​")` rend `"​"`. La base l'interdit, mais la fonction déclare elle-même (`:86-87`) ne pas pouvoir supposer d'où vient sa valeur. ⚠️ Et c'est la règle §3 : une catégorie, pas une énumération — `lib/texte.ts` porte déjà le prédicat.
- [x] [Review][Patch] **[low] Une transposition d'arguments produit un résultat plausible plutôt qu'une erreur** [`lib/rayons/carte.ts:57-60`] — ⚠️ **Mesuré** : `libelleRatio(4, 3)` rend `{visible: "3/3", pourLecteur: "3 sur 3 pris"}`. Deux nombres positionnels de même type, et le bornage **transforme l'erreur d'appel en résultat crédible** — exactement le « défaut visible que le membre ne pourrait pas s'expliquer » qu'il était censé prévenir. D2 annonce trois appelants. Correctif : objet de paramètres.
- [x] [Review][Patch] **[low] Les tests déréférencent avec `!` au lieu d'assurer** [`lib/rayons/carte.test.ts:38-40`, `:64-66`, `:70-71`] — Une régression vers `null` rapporte `Cannot read properties of null` au lieu de nommer le comportement tombé. ⚠️ Un `assert.deepEqual(libelleRatio(3, 4), { visible: "3/4", pourLecteur: "3 sur 4 pris" })` serait plus court, échouerait proprement, **et épinglerait en prime qu'aucun champ n'est apparu sur `RatioDeRayon`** — l'invariant que le fichier dit être sa raison d'être.
- [x] [Review][Patch] **[low] « 14 utilitaires sur 14 » sous-déclare la portée de la sonde** [`2-4-composant-carte-rayon.md:579-584`] — ⚠️ **Mesuré** : le composant emploie **23 utilitaires distincts**, tous présents dans la feuille construite. La conclusion tient et le contrôle négatif sur `.bg-gray-200` a bien des dents ; c'est le chiffre qui doit dire 23/23 ou nommer son périmètre (règle §1).
- [x] [Review][Patch] **[low] Le `File List` omet `4-2-…md`, que la Task 6 imposait de réécrire dans le même commit** [`2-4-composant-carte-rayon.md:637-647`] — Sa réécriture a bien eu lieu (contrat `:150-156` et tâche abricot `:469-473`, vérifiés) et les notes de complétion la revendiquent (`:632-633`) ; seule la liste ne la porte pas.
- [x] [Review][Patch] **[low] La story déclare « 4.2 débloquée » là où `sprint-status.yaml` enregistre la version honnête** [`2-4-composant-carte-rayon.md:628`] — Le suivi dit « **DÉBLOCAGE PARTIEL** […] tant que la 2.4 n'est pas `done` ». ⚠️ **Règle §6 bis : le fichier de story fait foi** — donc c'est la formulation la *moins* exacte qui gagne.
- [x] [Review][Patch] **[low] Le garde-fou de `globals.css` a été assoupli dans le hunk même qui l'aurait enfreint** [`app/globals.css:8-14`] — « Seuls les rôles que l'Epic 1 **emploie** sont posés » est devenu « Les rôles arrivent avec les écrans qui les portent ». La première formulation excluait un token sans consommateur livré ; la seconde n'exclut rien — et `--text-qty` n'a pour consommateur qu'un composant qu'aucun écran ne monte (D1-(a)).
- [x] [Review][Patch] **[low] Un commentaire faux par copier-coller : « la carte reçoit ses chiffres » pour une fonction qui reçoit un nom** [`lib/rayons/carte.ts:86-87`, `lib/rayons/carte.test.ts:96-97`] — Le raisonnement de `libelleRatio` recopié tel quel sous `nomDeRayon`.
- [x] [Review][Patch] **[low] Le contrat de props est un type littéral en ligne, non exporté, pour trois consommateurs annoncés** [`app/_lib/CarteRayon.tsx:29-52`] — Les stories 4.2, 4.17 et 4.18 doivent s'y conformer sans pouvoir le nommer, et la JSDoc qui justifie `id` vit dans un type anonyme qu'aucun IDE ne présentera comme un contrat.

#### Reportés

- [x] [Review][Defer] **Le ratio `n/total` est inatteignable depuis la vue qu'il cite : `total` RÉTRÉCIT** [`supabase/migrations/20260805092611_…sql:625`] — reporté, appartient aux stories 4.2 / 4.5
- [x] [Review][Defer] **`break-all` hache les noms français qui ont des espaces où couper** [`app/_lib/CarteRayon.tsx:106`] — reporté, motif pré-existant et prescrit par la story
- [x] [Review][Defer] **`<h2>` est figé dans un composant que trois surfaces doivent monter** [`app/_lib/CarteRayon.tsx:106`] — reporté, mord à l'Epic 5
- [x] [Review][Defer] **Aucun `dir="auto"` ni isolation bidi sur un nom en champ libre** [`app/_lib/CarteRayon.tsx:106`] — reporté, pré-existant et transverse
- [x] [Review][Defer] **Une icône de plus d'un glyphe déborde la pastille de 24 px sans rognage** [`app/_lib/CarteRayon.tsx:89-94`] — reporté, `normaliserIcone` réduit à l'écriture

#### Écartés comme bruit (5)

`--text-qty` faisant doublon avec `--text-meta` (la story a pesé et tranché, et l'écart de
`line-height` est écrit) · les citations à numéro de ligne qui rouillent (norme du dépôt, y compris
`project-context.md`) · `box-shadow` en style en ligne plutôt qu'une classe `.carte-rayon` (prescrit
par la story ; l'argument CSP est spéculatif) · un ratio à sept chiffres forçant le défilement
horizontal (non atteignable pour des courses) · l'explication `tabular-nums` écrite deux fois (les
deux publics diffèrent).

---

**Revue adversariale du 2026-08-07 — SECONDE PASSE, sur la passe de correction elle-même**
(règle §6 : « et la passe de correction doit être revue à son tour »). Quatre couches parallèles
et aveugles : Blind Hunter, Edge Case Hunter, Acceptance Auditor, et une couche
`clean-code` / `clean-architecture` / `tdd`.

✅ **Ce que cette passe a CONFIRMÉ — la première passe tient mieux que la moyenne du dépôt** :
**16 des 19 correctifs sont réellement fermés dans le code**, les six portes du Debug Log
reproduisent au chiffre près (`npm test` **216/216**, isolation **95/95**, typecheck, lint,
`check:migrations` 16/14/2/0, build), et le banc des mutations **rejoue 9 mutants sur 9 exactement
comme le tableau l'annonce, survivants compris**. Le contrat D2 correspond champ par champ à celui
que la 4.2 déclare attendre, le `File List` est exact (9 fichiers déclarés = 9 au `git diff --stat`),
le token est bien dans `@theme`, et la correction de `project-context.md` est **bornée et non
effacée** — son chiffre `1,90:1` est vérifié exact.

⛔ **DEUX CONSTATS DE COUCHE ONT ÉTÉ REJETÉS POUR CONTAMINATION CROISÉE, ET C'EST À CONSIGNER.**
L'Acceptance Auditor a conclu, artefacts `.next/` à l'appui, que la route jetable de la Task 5
s'appelait `app/sonde-revue/` et non `app/sonde-2-4/` — donc que le registre mentait sur sa seule
preuve d'AC3. **Mesuré : c'est le Blind Hunter de CETTE passe qui a créé `app/sonde-revue/` et lancé
`next build` pendant la revue.** Son constat jumeau (un `typecheck` en `TS2307` après `build`) a la
même origine. Vérifié après coup : `git status` vide, aucune trace versionnée, `.next/` sans artefact
de sonde, `app/` sans route de sonde. ⚠️ **Leçon opératoire : des couches parallèles qui écrivent
dans l'arbre se fabriquent mutuellement des preuves.** Une couche qui construit doit le faire hors
de l'arbre, ou la passe suivante doit dater ses artefacts avant de les lire.

#### Décisions à trancher

- [x] [Review][Decision] ✅ **TRANCHÉ le 2026-08-07 par Florian → OPTION A** : corriger les trois commentaires, ne pas déplacer le fichier. La contrainte réelle (`node --test` refuse un `.tsx`) est écrite, `lib/` cesse d'être présenté comme le seul emplacement testable, et la garde de comptage CI n'est pas touchée. ⚠️ **Le rangement par couche reste donc un écart assumé** : un présentateur vit dans le même composant qu'une passerelle et une normalisation de saisie. À rouvrir si la 4.15 pose le harnais. **La place de `lib/rayons/carte.ts` est justifiée par une croyance MESURÉE FAUSSE** — Les trois copies du commentaire affirment que `lib/` est « le seul endroit du dépôt où ce qui sert un composant peut être éprouvé ». ⚠️ **Sonde EXÉCUTÉE** : un fichier `app/_lib/__probe.test.ts` (un `.ts`, pas un `.tsx`) importé et lancé par `node --test "app/**/*.test.ts"` rend **pass 1 / fail 0**. La contrainte réelle est que `node --test` refuse un `.tsx` — **pas** que `lib/` soit le seul emplacement testable. Le dépôt a déjà `app/_lib/garde.ts` et `app/_lib/libelles.ts`. Conséquence de couche : un présentateur (`pourLecteur` est un `aria-label`, « À classer » est de la microcopie) cohabite avec une passerelle (`rayons.ts`) et une normalisation de saisie (`saisie.ts`) — trois raisons de changer dans un seul composant (CCP). **Option A** — corriger les trois commentaires et rien d'autre (coût nul, règle §1 satisfaite). **Option B** — déplacer `carte.ts`/`carte.test.ts` vers `app/_lib/` et étendre le glob : `"test": "node --test \"lib/**/*.test.ts\" \"app/**/*.test.ts\""`. ⛔ **Alors étendre AUSSI la garde de comptage** `.github/workflows/ci.yml` (`find lib -name '*.test.ts'`), sinon on rouvre le trou « `node --test` sur un glob vide rend 0 » que `project-context.md` documente.
- [x] [Review][Decision] ✅ **TRANCHÉ le 2026-08-07 par Florian → OPTION A** : `iconeDeRayon`/`nomDeRayon` deviennent des **enveloppes** des fonctions de `saisie.ts`/`texte.ts`. Un seul nettoyage, une seule vérité. ⚠️ **Absorbe le correctif de la jointure orpheline** (P3), qui devient sans objet : `nettoyerIcone` applique déjà `JOINTURES_AU_BORD`. **`iconeDeRayon`/`nomDeRayon` reprennent la MOITIÉ d'un nettoyage déjà écrit et testé, en citant le fichier qui contient la correction manquante** — `lib/rayons/saisie.ts` fait `normalize("NFC")` → `INVISIBLES_HORS_JOINTURE` → `trim()` → `JOINTURES_AU_BORD` (icône) et `normaliserTexte(saisie, 40)` (nom, avec bornage par points de code). `carte.ts` fait les deux du milieu et **omet NFC, les jointures au bord, et le bornage**. Or son JSDoc écrit « Même choix que `lib/rayons/saisie.ts` ». C'est « Motifs à reprendre, jamais à réinventer » + §4 (un invariant entre deux fichiers se mesure). **Option A** — faire de `iconeDeRayon`/`nomDeRayon` des enveloppes des fonctions de `saisie.ts`/`texte.ts`. **Option B** — garder le nettoyage partiel et **l'écrire comme un choix daté**, avec un test exécuté qui mesure ce sur quoi les deux s'accordent et ce sur quoi ils divergent. ⚠️ L'option A rend le patch P3 sans objet.
- [x] [Review][Decision] ✅ **TRANCHÉ le 2026-08-07 par Florian → OPTION B** : la racine est reportée à une story dédiée (elle vit dans `lib/texte.ts` et mord à la SAISIE, donc hors du périmètre de la 2.4) ; **seul le commentaire de `carte.ts` qui affirme le contraire de ce qui est mesuré est corrigé ici**. Entrée datée ajoutée à `deferred-work.md`. **U+FE0F n'est pas exclu d'`INVISIBLES_HORS_JOINTURE` : la MAJORITÉ des emoji composés sont démembrés** — ⚠️ **MESURÉ** : `iconeDeRayon("❤️")` → `"❤"` (U+2764 seul, glyphe **texte** noir, plus l'emoji) ; `iconeDeRayon("🏳️‍🌈")` → séquence **non-RGI**, rendue en 2 glyphes ; `iconeDeRayon("1️⃣")` → `"1⃣"` ; `iconeDeRayon("🏴󠁧󠁢󠁳󠁣󠁴󠁿")` → `"🏴"` (les 6 caractères de tag retirés). Le sélecteur de variante U+FE0F est `Cf` **et** `Default_Ignorable`, donc dans la plage ; l'exclusion ne couvre que ZWJ/ZWNJ. ⛔ **C'est exactement ce que `carte.ts:142-144` jure ne pas faire**, et le seul test de la classe (`🧑‍🍳`) est le seul emoji composé **sans** VS16 : il passe pour une raison qui ne se généralise pas, alors que les claviers iOS/Android insèrent VS16 automatiquement. ✅ **Le semis est hors d'atteinte** — vérifié, les 11 icônes de `seed_default_aisles` sont des pictogrammes à un seul point de code. ⚠️ **Mais la racine est PRÉ-EXISTANTE et transverse** : `normaliserIcone` emploie la même plage, donc un membre qui choisit ❤️ **enregistre déjà ❤** — le défaut est à la SAISIE, dans `lib/texte.ts`, pas dans ce diff. **Option A** — corriger `INVISIBLES_HORS_JOINTURE` dans `lib/texte.ts` (transverse : touche `saisie.ts`, ses tests, et le test d'accord client/base). **Option B** — reporter à une story dédiée et ne corriger ici que le commentaire qui affirme le contraire de ce qui est mesuré.

#### Correctifs

- [x] [Review][Patch] **[medium] `children = []` est VRAI : la marge sous rien est bien payée, et le commentaire deux lignes au-dessus affirme l'inverse** [`app/_lib/CarteRayon.tsx:177`] — ⚠️ **Mesuré sur le HTML prérendu** d'une carte à `children = []` : `…</div><div class="mt-2"></div></section>`. Le commentaire `:174-175` dit « le conteneur n'est alors **pas rendu du tout**, pour ne pas payer une marge sous rien ». Or l'idiome que la 4.2 emploiera est `{articles.map(…)}`, qui rend `[]` pour un rayon vide — et l'**AC2 fait du rayon vide un cas nominal**. ⛔ **Trois couches aveugles l'une à l'autre l'ont trouvé indépendamment.** Correctif : `{React.Children.count(children) > 0 ? <div className="mt-2">{children}</div> : null}` (vérifié : `React.Children.count([]) === 0`), et corriger le commentaire.
- [x] [Review][Patch] **[medium] « la dérivation rend la divergence inexprimable » est une affirmation, pas une mesure — et elle tombe en une ligne** [`lib/rayons/carte.ts:34-39`, `:96-102`, repris verbatim dans `carte.test.ts`] — ⚠️ **Mutation EXÉCUTÉE, par deux couches indépendamment** : remplacer `pourLecteur: \`${visible.replace("/", " sur ")} pris\`` par une construction parallèle `\`${borne} sur ${total} pris\`` rend **216 pass / 0 fail**. Le fichier a raison de dire qu'aucune assertion ne distingue deux implémentations équivalentes — mais il en conclut « inexprimable », ce qui est faux : la divergence s'écrit en une ligne, sous cinq portes vertes. ⛔ **C'est la correction phare de la passe du 2026-08-07 qui surestime sa propre portée**, et c'est §4 à l'envers (un invariant affirmé par un commentaire). Correctif : ramener la formulation à « convention qui rend la divergence moins probable ; rien ne l'empêche », ou rendre la relation réellement structurelle (une fabrique unique paramétrée par le séparateur).
- [x] [Review][Patch] ✅ **ABSORBÉ par la décision D2-A** — l'enveloppe `normaliserIcone` applique déjà `JOINTURES_AU_BORD`, donc ce correctif n'a pas eu à être écrit séparément. Test de non-régression ajouté quand même (`carte.test.ts`, « une jointure ORPHELINE ne peint pas de pastille abricot vide »), et le mutant qui revient à la rédaction d'avant est **attrapé** (218/220). **[medium] Une jointure orpheline rend `iconeDeRayon` truthy → pastille abricot VIDE, le défaut exact que la fonction existe pour empêcher** [`lib/rayons/carte.ts:147`] — ⚠️ **Mesuré, puis vu sur le HTML prérendu** : `iconeDeRayon("‍")` → `"‍"` (non nul, donc vrai) → `<span … class="… bg-accent-soft">[ZWJ]</span>`, un carré abricot de 24 px sans contenu visible. Idem `"‌"` et `"  ‍  "` (`trim()` ne retire pas les jointures). Le JSDoc `:136-140` revendique précisément d'empêcher ça, et UX-DR2 interdit l'abricot décoratif *a fortiori* vide. Le test `:181-189` ne couvre que U+200B, qui est bien retiré. ✅ **Le dépôt a déjà écrit et payé le remède** : `JOINTURES_AU_BORD = /^[‌‍]+|[‌‍]+$/g` (`lib/rayons/saisie.ts:75`, « au bord, une jointure ne porte aucun sens »). Correctif : **exporter** cette constante plutôt que la recopier, l'appliquer, et ajouter les quatre cas au test. ⚠️ Chemin du formulaire fermé par `normaliserIcone` ; la voie ouverte est l'écriture directe et le serveur MCP de l'Epic 7, `aisles.icon` étant un `text` nu sans contrainte.
- [x] [Review][Patch] **[medium] Deux mutants survivent : le nettoyage des invisibles INTÉRIEURS n'est tenu par aucun test** [`lib/rayons/carte.test.ts`] — ⚠️ **Mutations EXÉCUTÉES** : en ancrant `INVISIBLES` (resp. `INVISIBLES_HORS_JOINTURE`) aux bords de chaîne dans chacune des deux fonctions, la suite reste **216 pass / 0 fail** dans les deux cas. Les tests existants n'emploient que des chaînes *entièrement* invisibles, qu'un nettoyage de bord réduit déjà à `""`. Le comportement réel est global : `nomDeRayon("Fruits​légumes")` → `"Fruitslégumes"`, et rien ne le tient. Correctif : deux assertions, une par fonction. ✅ À l'inverse, les mutants sur le garde entier, le plafonnement et le choix `INVISIBLES` vs `HORS_JOINTURE` sont bien **tués** — cette moitié de la suite est solide.
- [x] [Review][Patch] **[medium] Le `<h2>` invoque une borne de 40 caractères que RIEN ne garantit à cet endroit** [`app/_lib/CarteRayon.tsx:129-130`] — ⚠️ **Mesuré** : `MAX_NOM_RAYON = 40` (`lib/rayons/saisie.ts:8`) s'applique **à la saisie client**, jamais en base — `grep` sur `supabase/migrations/` ne trouve de contrainte de longueur que sur `grocery_list_items.name (<= 200)` ; `aisles` n'a que `aisles_name_non_vide`. La carte reçoit son nom d'une vue. ⛔ **Et le même fichier écrit deux fonctions plus bas « la carte reçoit son nom en propriété : elle ne peut pas supposer d'où il vient » (`carte.ts:119-121`)** — les deux affirmations ne peuvent pas être vraies ensemble. Correctif : retirer la prémisse du commentaire, ou borner réellement dans `nomDeRayon` et le tester.
- [x] [Review][Patch] **[medium] Le correctif « une seule copie, datée » n'est appliqué qu'à un tiers** [`lib/rayons/carte.ts:13`, `carte.test.ts:10`, `app/_lib/CarteRayon.tsx:56`] — Le `[Review][Patch] [medium]` du 2026-08-07 prescrivait « **une seule copie, datée**, citant `package.json` comme source ». ⚠️ **Mesuré : les trois copies subsistent**, et **seule `carte.ts:13` porte la date** (« état au 2026-08-07 »). Les trois citent bien `package.json`, ce qui est la moitié du correctif. Le jour où la 4.15 pose le harnais, deux commentaires sur trois deviendront faux sans date pour les dater. ⚠️ **Et la décision D1 ci-dessus rend leur contenu faux dès aujourd'hui.** Correctif : dater les deux autres, ou les réduire à un renvoi vers la version datée.
- [x] [Review][Patch] **[low] `pris === null` est une branche MORTE, et le test qui la nomme passe pour une autre raison** [`lib/rayons/carte.ts:90`, `carte.test.ts`] — ⚠️ **Mutation EXÉCUTÉE** : réduire le garde à `if (pris === undefined) return null;` rend **216 pass / 0 fail**. Raison **vérifiée** : `Number.isInteger(null)` vaut `false`, donc la garde d'entier suivante attrape déjà `null`. Le test « un compte NUL n'est pas un compte de zéro » passe donc pour une raison différente de celle qu'il annonce, et l'invariant « `null` ≠ 0 » n'est tenu par aucune ligne dédiée. ⚠️ **Le dépôt a un antécédent exact** : la revue de la 4.1 a trouvé « deux tests qui ne mesuraient pas ce qu'ils croyaient ». Correctif : garder la branche explicite pour l'intention **en écrivant qu'elle est redondante**, ou la retirer et renommer le test.
- [x] [Review][Patch] **[low] L'écart n°2 des notes de complétion réaffirme les DEUX choses que la passe précédente déclare avoir corrigées** [`2-4-composant-carte-rayon.md`, § Écarts, point 2] — Il dit « Il est dans le type et **n'est déstructuré par rien** : le déstructurer sans le lire ferait échouer `lint --max-warnings 0` ». ⚠️ **Mesuré** : (a) `app/_lib/CarteRayon.tsx:65` **le déstructure** (`id: _id`) ; (b) `eslint.config.mjs` pose `varsIgnorePattern: "^_"` et `npm run lint` est vert. C'est **la troisième des « trois affirmations FAUSSES »** que l'en-tête de cette story revendique avoir corrigées : le correctif a été appliqué dans le code (`:20-22` dit maintenant la bonne conséquence) et **oublié dans le fichier de story**.
- [x] [Review][Patch] **[low] Le bloc D2 — « le contrat figé », que les 4.17 et 4.18 liront — porte encore l'ancien contrat** [`2-4-composant-carte-rayon.md`, § Décision D2, et Task 1] — ⚠️ **Mesuré** : D2 porte toujours `pris?: number` et `children: React.ReactNode` (**requis**), quand le livré et la 4.2 portent `pris?: number | null` et `children?`. Les notes de complétion signalent bien les deux ajustements et la 4.2 a été corrigée — **seul le bloc D2, qui est la source citée par les stories suivantes, reste périmé**. Même forme à la Task 1, qui prescrit encore `libelleRatio(pris, total)` positionnel là où le correctif a livré un objet de paramètres.
- [x] [Review][Patch] **[low] Le fichier de story affiche encore les deux ratios `muted-2` que son propre en-tête déclare corrigés** [`2-4-composant-carte-rayon.md`, Task 2] — L'en-tête liste parmi les affirmations fausses corrigées : « `muted-2` est mesuré à 2,46:1 » → « valeur d'avant l'arbitrage ». ⚠️ **Mesuré : la Task 2 porte toujours « `muted-2` mesure 2,46:1 sur clair et 4,41:1 sur sombre »**, et les valeurs réellement en vigueur (`--muted-2: #8b9083` / `#8990a5`, `globals.css:56,85`) donnent **3,27:1** et **5,14:1**. La correction a été appliquée au commentaire de code et pas au fichier de story. La conclusion (employer `muted`) reste juste ; c'est la preuve qui est périmée, et puisée dans le document que `globals.css:5-9` interdit de citer.
- [x] [Review][Patch] **[low] Un déréférencement `!` sans assurance subsiste** [`lib/rayons/carte.test.ts:109`] — `assert.equal(libelleRatio({ pris: -2, total: 4 })!.visible, "0/4")`. Une régression vers `null` y rapportera `Cannot read properties of null` au lieu de nommer le comportement tombé. Les autres sites du correctif du 2026-08-07 sont bien fermés (`deepEqual`, ou assurance préalable) ; celui-ci a été manqué.
- [x] [Review][Patch] **[low] Story et `sprint-status.yaml` se contredisent À NOUVEAU sur le déblocage de la 4.2, en sens INVERSE du correctif** [`2-4-composant-carte-rayon.md`, § Ce que cette story débloque] — La story dit maintenant « un déblocage **PARTIEL** tant que la 2.4 n'est pas `done` », alors que `sprint-status.yaml` dit « ✅ **DÉBLOCAGE COMPLET le 2026-08-07** : la 2.4 est revue et `done` » et porte bien `2-4-composant-carte-rayon: done`. Le correctif a aligné la story sur l'**ancien** état du suivi, puis le suivi a bougé : **c'est de nouveau la formulation la moins exacte qui fait foi** (règle §6 bis). ⚠️ Le correctif d'origine a créé la condition de sa propre réouverture.
- [x] [Review][Patch] **[low] Une case `[x]` de la Task 4 coche un énoncé que son annotation déclare renversé** [`2-4-composant-carte-rayon.md`, Task 4] — La sous-tâche cochée dit « le parcours visuel est **reporté à la 4.2**, et c'est écrit dans les notes de complétion », immédiatement suivie de « → ⚠️ **RENVERSÉ À LA REVUE** : Florian a tranché pour la route jetable **plutôt que le report** ». La raison est écrite honnêtement — mais la case coche un énoncé faux, ce qui est la forme exacte du correctif `[medium]` du 2026-08-07 sur la Task 5.
- [x] [Review][Patch] **[low] Le JSDoc de `id` justifie la propriété par un argument qui ne tient pas** [`app/_lib/CarteRayon.tsx:14-23`] — Il dit « l'ajouter [en 4.18] obligerait à toucher les trois appelants ». **Faux pour une propriété OPTIONNELLE** : `id?: string | null` ajouté en 4.18 compile chez les trois appelants sans une ligne de changement ; seul le nouvel appelant la renseigne. La propriété est donc payée **requise** sans nécessité, ce qui force la liaison morte `id: _id` (`:65`) — et le JSDoc admet lui-même que « rien ne le valide, ni test, ni typecheck, ni lint ». Correctif : soit `id?: string | null`, soit retirer du JSDoc l'argument qui ne tient pas.

#### Reportés

- [x] [Review][Defer] **Le thème sombre : la bordure, présentée comme le SEUL séparateur, mesure 1,30:1** [`app/globals.css`, `app/_lib/CarteRayon.tsx:93`] — reporté, tokens pré-existants, mord à la 4.2
- [x] [Review][Defer] **`<section>` sans nom accessible : la carte n'est pas une `region`** [`app/_lib/CarteRayon.tsx:92`] — reporté, plancher d'accessibilité = story 4.13
- [x] [Review][Defer] **Le ratio `.sr-only` est FRÈRE du `<h2>`, donc absent de la navigation par titres** [`app/_lib/CarteRayon.tsx:155-165`] — reporté, story 4.13
- [x] [Review][Defer] **`nomDeRayon("À classer")` est indiscernable du repli** [`lib/rayons/carte.ts:130`] — reporté, la story 4.17 possède le libellé
- [x] [Review][Defer] **`app/rayons/ListeRayons.tsx:932` affiche `rayon.icone ?? ""` SANS passer par `iconeDeRayon`** [`app/rayons/ListeRayons.tsx:932`] — reporté, pré-existant et hors du diff ; la même icône y échappe aux nettoyages que ce diff canonise
- [x] [Review][Defer] **`iconeDeRayon` ne borne pas la longueur → débordement de la pastille de 24 px** [`lib/rayons/carte.ts:148`] — reporté, **déjà reporté le 2026-08-07** et re-mesuré ici (`iconeDeRayon("Fromagerie")` → 10 caractères dans un `size-6` sans `overflow-hidden`)
- [x] [Review][Defer] **`break-all`, `<h2>` figé, absence de `dir="auto"`** [`app/_lib/CarteRayon.tsx:106`, `:134`] — reportés, **déjà reportés le 2026-08-07**, confirmés par deux couches

#### Écartés comme bruit (6)

La route de sonde « mal nommée » (`sonde-revue` vs `sonde-2-4`) et son `TS2307` — **contamination
mesurée par une couche de cette passe**, voir l'encadré ci-dessus · `total ≥ 1e21` rendu en notation
exponentielle (non atteignable pour des courses ; le dépôt a écarté le jumeau exact le 2026-08-07) ·
`pris` non-`number` au runtime (le typage couvre ; aucun composant du dépôt ne valide ses propriétés
à l'exécution) · `bg-accent-soft` à 1,12:1 sur clair (la valeur est **prescrite** par `DESIGN.md`,
ce n'est pas une décision du code) · `--text-qty` livré sans consommateur et la règle de `globals.css`
réécrite (**correctif vérifié appliqué** : l'exception est désormais nommée ET datée) · la verbosité
des commentaires en tant que telle (la plupart expliquent un *pourquoi* payé par un défaut réel).

---

## Change Log

| Date | Qui | Quoi |
|---|---|---|
| 2026-08-07 | code-review (2ᵉ passe) | **Revue de la passe de correction elle-même** (règle §6). Quatre couches parallèles et aveugles. **27 constats : 3 décisions tranchées par Florian, 15 correctifs appliqués, 7 reportés, 6 écartés.** ✅ **La passe précédente tient : 16 des 19 correctifs sont réellement fermés, les six portes reproduisent au chiffre près, et le banc rejoue 9 mutants sur 9 comme annoncé.** ⛔ **Les trois défauts qui restaient sont tous du même type — corrigés dans le code, oubliés dans le registre.** Et le plus emblématique porte sur la correction phare de la passe précédente : « la dérivation rend la divergence inexprimable » est **faux**, mesuré par deux couches indépendamment — la construction parallèle se réécrit en une ligne sous 216 tests verts. Le commentaire dit maintenant ce qui est vrai : une convention que rien n'automatise. ⛔ **Deux défauts de code neufs, tous deux dans le JSX que rien n'exécute** : **(1)** `Boolean([])` vaut **vrai**, donc `{children ? …}` rendait un `<div class="mt-2">` vide — et le cas n'est pas marginal, c'est l'idiome `{articles.map(…)}` de la 4.2 sur le rayon vide que l'AC2 déclare nominal ; trois couches l'ont trouvé séparément. **(2)** `iconeDeRayon("‍")` peignait le carré abricot vide que la fonction existe pour empêcher. ✅ **D2 : `iconeDeRayon`/`nomDeRayon` deviennent des enveloppes de `saisie.ts`** — elles en réimplémentaient la moitié tout en écrivant « même choix que `lib/rayons/saisie.ts` ». ⚠️ **Un défaut de racine reporté et mesuré** : U+FE0F n'est pas exclu d'`INVISIBLES_HORS_JOINTURE`, donc ❤️ rend ❤ et 🏳️‍🌈 est démembré — **à la SAISIE**, pas à l'affichage. ⛔ **Et une leçon de méthode consignée : deux constats de couche ont été REJETÉS pour contamination croisée** — une couche de cette passe avait créé `app/sonde-revue/` et lancé un build, fabriquant la « preuve » que le registre mentait sur sa sonde. Portes : `npm test` **220/220** (+4), isolation **95/95**, typecheck, lint, `check:migrations` 16/14/2/0, build, banc des mutations 4 mutations dont 3 attrapées. |
| 2026-08-07 | code-review | **Revue adversariale à quatre couches, puis fermeture.** 27 constats : **3 décisions** tranchées par Florian, **19 correctifs** appliqués, **5 reportés**, 5 écartés. ⛔ **Les deux défauts majeurs étaient dans le JSX qu'aucune porte n'exécute — exactement où la story avait prédit qu'ils seraient** (piège n°2, et le relevé git sur `86fafe7`). **(1)** L'`aria-label` du ratio était posé sur un `<span>` nu — rôle `generic`, *name-prohibited* en ARIA 1.2 : tout le type `RatioDeRayon`, testé et documenté trois fois, alimentait un attribut qui n'atteignait aucun lecteur d'écran. Le dépôt avait déjà payé cette leçon sur `InviteCard` et écrit le remède (`.sr-only`). **(2)** Le « banc des dents » annonçait quatre passages propres ; **mesuré, l'un d'eux était faux** — le mutant qui reconstruit l'annonce à part du visible laisse la suite entière verte, et aucun test ne peut l'attraper. `libelleRatio` DÉRIVE désormais `pourLecteur` de `visible` : l'invariant est tenu **par construction**, et le tableau dit maintenant lequel des neuf mutants survit et pourquoi. ⚠️ **Trois commentaires affirmaient un état faux** (voir l'en-tête). ✅ **Florian a tranché pour une route jetable plutôt que le report**, ce qui a tenu la moitié rendue de l'AC3 et validé les deux correctifs à l'œil, aux deux réglages système. Portes : `npm test` **216/216** (+9), isolation **95/95**, typecheck, lint, `check:migrations` 16/14/2/0, build, et **23 utilitaires sur 23** générés avec contrôle négatif. |
| 2026-08-06 | dev-story | **Implémentée.** Trois fichiers, aucune dépendance, aucune migration. **D1 et D2 non tranchées → défauts prescrits appliqués** : logique pure extraite dans `lib/rayons/carte.ts` (9 tests, **quatre passages au banc des dents, tous propres**), JSX livré sans consommateur. ⚠️ **L'AC3 n'est tenu qu'à moitié, et c'est écrit** : le rendu n'est éprouvé par rien puisque aucun écran ne monte le composant — deux sous-tâches laissées VIDES avec leur raison, parcours à l'œil reporté à la 4.2. **Ce qui a pu être mesuré l'a été** : 14 utilitaires Tailwind sur 14 réellement générés (avec contrôle négatif sur `.bg-gray-200`), et les valeurs des deux thèmes extraites de la feuille construite — la carte porte l'ombre pour le clair ET la bordure pour le sombre. `npm test` 207/207 (+9), isolation 95/95 inchangée. **La story 4.2 est débloquée** et `project-context.md` corrigé dans le même commit. |
| 2026-08-06 | create-story (validation) | **Passe de validation en contexte neuf.** ⛔ **Deux absences coûteuses** : la **couleur du ratio** n'était pas écrite — or `review-accessibility.md:57` classe `muted-2` en défaut **[high]** (2,46:1 sur clair) et nomme le ratio ; et l'**ombre en thème CLAIR** manquait — la story passait trente lignes sur le piège du thème sombre en reproduisant son miroir, le gabarit copié de `menu/page.tsx:76` n'ayant pas de `box-shadow`. ⛔ **Trois incohérences avec la 4.2, toutes réelles** : le contrat de props divergeait **déjà** (pas d'`id`, `pris` requis), **personne ne possédait le repli du libellé « À classer »** (`nom: null` face à une prop `string`), et la correction de `project-context.md:247` était revendiquée par les deux stories. ⚠️ **Une chaîne de citation corrigée** : l'interdiction du harnais de test vient de `project-context.md:130-134` et de `sprint-change-proposal-2026-07-26.md:466`, **pas de NFR-10**, qui porte sur le coût de possession. ⚠️ **Et un squelette JSX commenté ajouté** — le composant n'était décrit nulle part, il fallait le reconstruire depuis trois citations dispersées. |
| 2026-08-06 | create-story | Contextualisation, déclenchée par la décision D1 de la story 4.2 (2026-08-06) qui confie ce composant à la 2.4. Onze mesures. **Trois invalident le cadrage** : le dépôt n'a aucun moyen d'éprouver un composant (`npm test` ne globe que `lib/`), la prémisse qui a gardé cette story dans l'Epic 2 — « visible sur l'écran des rayons » — est **périmée** (l'écran construit ensuite rend des lignes, pas des cartes), et le token `--text-qty` que le ratio exige **n'existe pas**. Deux décisions ouvertes, chacune avec son défaut prescrit. |
