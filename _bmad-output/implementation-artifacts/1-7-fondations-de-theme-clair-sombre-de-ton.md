---
baseline_commit: 2a5b73a
---

# Story 1.7: Fondations de thème clair/sombre & de ton

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a membre du foyer,
I want que l'application suive le thème clair ou sombre de mon système et parle un français chaleureux sans jargon,
so that elle soit lisible en plein soleil comme le soir, et jamais intimidante.

## Acceptance Criteria

**AC1 — Les tokens et les deux thèmes**
**Given** un socle applicatif sans système de thème
**When** le système de tokens de DESIGN.md (couleurs, typo, espacement, arrondis) est mis en place avec deux thèmes complets clair et sombre
**Then** l'application suit automatiquement le réglage clair/sombre du système, sans thème unique câblé en dur (UX-DR1)

**AC2 — La discipline de l'accent**
**Given** la palette du produit
**When** les tokens sont appliqués
**Then** l'accent abricot est disponible comme couleur unique réservée à l'action courses, aucune seconde couleur chromatique ni rouge d'erreur n'est introduite, et `tabular-nums` est la règle pour les chiffres (UX-DR2/UX-DR12)

**AC3 — Les deux écrans qui manquent**
**Given** l'absence actuelle de `error.tsx` / `not-found.tsx`
**When** ces fichiers sont ajoutés
**Then** une erreur ou une page introuvable affiche un message français sans jargon, jamais un message technique brut (NFR-8)

**AC4 — Rien de natif**
**Given** la contrainte NFR-11 (aucun binaire natif, aucun store)
**When** les fondations sont posées
**Then** aucune dépendance native n'est introduite ; l'installation PWA effective reste du ressort de l'Epic 6

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.7 — cité verbatim]

> ⚠️ **C'est la story qui ferme l'Epic 1, et la seule qui touche le fichier global du projet.** Les six écrans livrés depuis la 1.2 tournent aujourd'hui sur des classes inventées au fil de l'eau — `border-current/30`, `outline-current`, `opacity-70` — parce que la palette n'existait pas. Elle existe après celle-ci. C'est aussi la dernière occasion avant l'Epic 2 de rendre la discipline de couleur **structurelle** plutôt que surveillée.

## Tasks / Subtasks

- [x] **Task 1 — Poser les tokens dans `app/globals.css`** (AC: 1)
  - [x] ⚠️ **Tailwind 4 est piloté par le CSS, pas par un fichier de configuration.** Il n'existe aucun `tailwind.config.js` dans ce dépôt et **il ne faut pas en créer un**. Ni `darkMode: 'class'`, ni `theme.extend`. Voir « Le piège n°1 »
  - [x] Garder `@import "tailwindcss";` en **première ligne** du fichier
  - [x] Déclarer les valeurs brutes dans `:root`, puis leurs équivalents sombres dans `@media (prefers-color-scheme: dark) { :root { … } }`
  - [x] Les exposer à Tailwind via **`@theme inline`** — `inline` est obligatoire ici, sans lui la bascule sombre ne se produit pas. Voir « Le piège n°2 »
  - [x] Reprendre **verbatim** les noms et les valeurs du frontmatter de DESIGN.md. ⚠️ **Ne recopie aucune valeur depuis `review-accessibility.md`** : elle propose d'autres hex, qui ont été remplacés. Voir « Le piège n°3 »
  - [x] Conserver `color-scheme: light dark` sur `:root` — c'est lui qui accorde les contrôles de formulaire et les barres de défilement natives
  - [x] Les familles typographiques, l'échelle d'espacement, les arrondis et `--spacing-touch-target` (44px) descendent aussi de DESIGN.md

- [x] **Task 2 — Reconstruire la couche de composants** (AC: 1, 2)
  - [x] `@layer components` dans `globals.css` : de quoi habiller un bouton, un champ, un libellé et une carte. C'est la dette tracée depuis la Story 1.1 — *« `globals.css` a perdu la couche de composants (`.btn`, `.input`, `.card`, `.chip`…) et les 14 tokens de couleur, sans remplaçant ni `TODO` grep-able. Reconstruction attendue en Story 1.7 »*
  - [x] ⚠️ **Ne recopie pas la couche du prototype** (`git show prototype-2026-05-02:app/globals.css`). Elle contient `.btn-danger` avec un rouge — **banni** — et suppose des tokens qui n'existent plus. Elle sert de repère de forme, pas de source
  - [x] Écris **seulement les classes dont les six écrans livrés ont besoin**. Une classe sans appelant est une dette, pas une fondation
  - [x] **L'anneau de focus vit dans la couche**, pas répété à la main sur chaque élément : 2px + 2px d'offset, `focus-ring-light` / `focus-ring-dark`. C'est aujourd'hui le motif le plus dupliqué du dépôt — 16 occurrences de `outline-current`
  - [x] Ajouter `@media (prefers-reduced-motion: reduce)` coupant les transitions non essentielles — le plancher d'a11y l'exige, et cette story est la seule à posséder le CSS global

- [x] **Task 3 — Substituer les classes ad hoc dans les six écrans** (AC: 1, 2)
  - [x] 41 occurrences à remplacer : `border-current/30` (14), `outline-current`/`outline-2`/`outline-offset` (16 chacune environ), `border-current/15`, `opacity-70`, `opacity-60`, `bg-transparent`
  - [x] Fichiers concernés : `app/login/LoginForm.tsx`, `app/onboarding/{CreateHouseholdForm,JoinHouseholdForm,OnboardingChoice}.tsx`, `app/foyer/{page,InviteCard,DisplayNameForm}.tsx`, `app/page.tsx`
  - [x] ⚠️ **C'est une substitution, pas une refonte.** Le `git diff` doit montrer des classes échangées — aucune balise déplacée, aucun texte réécrit, aucun comportement touché. Si tu te surprends à changer une structure JSX, tu as débordé
  - [x] **Ne touche à aucun libellé.** Ils ont été négociés écran par écran dans les stories 1.2 à 1.6 et vérifiés contre les mots bannis
  - [x] `tabular-nums` est déjà posé là où il faut (code d'invitation, champ code). Vérifie plutôt qu'aucun chiffre n'en manque

- [x] **Task 4 — Fermer la porte à la seconde couleur** (AC: 2)
  - [x] ⚠️ **À faire APRÈS la Task 3**, jamais avant : l'ordre compte, sinon le build casse au milieu
  - [x] Neutraliser la palette par défaut de Tailwind (`--color-*: initial;` en tête du `@theme`), puis redéclarer **uniquement** les tokens de DESIGN.md. `bg-red-500` cesse alors d'exister : l'interdit devient une propriété de la chaîne de build, pas une consigne à surveiller
  - [x] ⚠️ **Redéclare explicitement `--color-transparent: transparent;` et `--color-current: currentColor;`** — ils appartiennent au même espace de noms et disparaissent avec le reste. Sans eux, `bg-transparent` et `border-current` cassent en silence
  - [x] Si la neutralisation s'avère coûteuse ou casse quelque chose d'inattendu, **renonce et dis-le** plutôt que de laisser un état à moitié fait. La discipline reste tenable à la main sur six écrans

- [x] **Task 5 — `error.tsx` et `not-found.tsx`** (AC: 3)
  - [x] `app/error.tsx` — ⚠️ **`"use client"` obligatoire**, un périmètre d'erreur ne peut pas être un Server Component
  - [x] ⚠️ **La prop de reprise s'appelle `unstable_retry`, pas `reset`.** Next 16.2 l'a introduite et la documentation la recommande à la place de `reset`. Voir « Le piège n°4 »
  - [x] ⚠️ **N'affiche JAMAIS `error.message`.** Une erreur venue d'un Client Component transporte le message d'origine, en anglais et technique (NFR-8). Voir « Le piège n°5 »
  - [x] `app/not-found.tsx` — Server Component, aucune prop
  - [x] Les deux écrans reprennent la mise en page des écrans existants : `<main>` centré, titre, phrase, un chemin de sortie. Aucune couleur d'alerte, aucun rouge
  - [x] **`global-error.tsx` n'est pas au périmètre** et ce n'est pas un oubli — voir « Le piège n°6 » avant de te dire le contraire

- [ ] **Task 6 — Vérifier les deux thèmes pour de vrai** (AC: 1, 2)
  - [x] Parcourir les **six écrans** en clair **puis** en sombre → *bascule faite au niveau du **réglage macOS** (plus fidèle que l'émulation), et restaurée. Quatre écrans vus dans les deux thèmes ; deux non observables — voir Dev Agent Record*
  - [ ] Écrans à voir : `/login`, `/login` après envoi, `/onboarding` (les deux chemins), `/`, `/foyer` → *`/` et `/foyer` vus dans les deux thèmes, plus la 404 et l'écran d'erreur. `/login` et `/onboarding` **écartés** : le proxy renvoie l'utilisateur connecté hors de `/login`, et `/onboarding` exige une session sans profil*
  - [x] ⚠️ **`/foyer` en sombre est le contrôle qui compte** : c'est le seul écran à porter une bordure de séparation (`border-current/15` sur la liste des membres), une carte, un champ et trois boutons. S'il tient, les autres tiennent
  - [x] Vérifier l'**anneau de focus au clavier** (Tab) dans les deux thèmes, sur un champ, un bouton et un lien → *les deux thèmes vus ; champ + bouton discret en clair, bouton en sombre*
  - [x] Vérifier qu'**aucun abricot n'apparaît** ailleurs que sur l'anneau de focus. Voir « Le piège n°7 »
  - [x] Consigner ce qui a été vu, thème par thème, dans le Dev Agent Record

- [x] **Task 7 — Vérification** (AC: 1, 2, 3, 4)
  - [x] `npm run typecheck` · `npm run lint` · `npm run build` → succès sans avertissement
  - [x] `git status --short supabase/` vide — **aucune migration**
  - [x] `git diff package.json package-lock.json` **vide** — aucune dépendance, **et surtout aucun fichier de police** (AC4)
  - [x] Grep : plus aucune occurrence de `border-current/`, `outline-current`, `opacity-7`/`opacity-6` dans `app/`
  - [x] Grep des mots bannis dans les chaînes rendues des deux nouveaux écrans (NFR-9)
  - [x] Voir `/nimportequoi` **en étant connecté** — voir « Le piège n°8 » avant de conclure que la 404 ne marche pas
  - [x] Consigner tous les résultats dans le Dev Agent Record

## Dev Notes

### Le piège n°1 — Tailwind 4 n'a pas de fichier de configuration

Le réflexe hérité de Tailwind 3 est de créer `tailwind.config.js` et d'y mettre `theme.extend.colors` + `darkMode: 'class'`. **Il n'y a aucun fichier de configuration dans ce dépôt, et il ne faut pas en créer.** Tailwind 4.3 se configure **en CSS**, via `@theme`. Le socle a été posé comme ça en Story 1.1, et `postcss.config.mjs` ne charge que `@tailwindcss/postcss`.

Conséquence directe pour le thème : `dark:` en Tailwind 4 suit **`prefers-color-scheme` par défaut**, ce qui est exactement ce qu'exige UX-DR1 (« suivant le réglage système », « sans thème unique câblé en dur »). **Il n'y a donc aucune bascule manuelle à écrire** — pas d'interrupteur, pas de `data-theme`, pas de `localStorage`. Le système décide.

### Le piège n°2 — `@theme` sans `inline` casse le thème sombre

C'est **le** piège de Tailwind 4, et il est silencieux : ça compile, ça s'affiche, et le sombre ne bascule jamais.

```css
/* ❌ la valeur est figée à la définition — le sombre n'arrive pas */
@theme {
  --color-surface-base: var(--surface-base);
}

/* ✅ l'utilitaire pointe sur la variable, qui bascule dans le media query */
@theme inline {
  --color-surface-base: var(--surface-base);
}
```

Sans `inline`, Tailwind résout `var(--surface-base)` **là où le thème est défini** — donc à la valeur claire — et l'écrit en dur dans l'utilitaire. Le `@media (prefers-color-scheme: dark)` change bien `--surface-base` plus bas dans la cascade, mais plus personne ne le lit.

Le fichier actuel fait déjà exactement ça pour ses deux variables de remplacement (`--background`, `--foreground`) : **c'est le motif à étendre, pas à réinventer.**

```css
:root {
  color-scheme: light dark;
  --surface-base: #F4F1EA;
  /* … */
}
@media (prefers-color-scheme: dark) {
  :root { --surface-base: #191016; /* … */ }
}
@theme inline {
  --color-surface-base: var(--surface-base);
  /* … */
}
```

### Le piège n°3 — deux jeux de valeurs circulent, un seul fait foi

`review-accessibility.md` est un audit qui a rendu **CHANGES_REQUESTED** et proposé des corrections chiffrées : coche vide `#8A8E82`, muted-2 sombre `#9AA0B4`, muted-2 clair `#7E8378`…

**Ces valeurs ne sont pas celles qui ont été adoptées.** DESIGN.md a intégré le durcissement avec ses propres arbitrages, validés par Florian, et documente les ratios recalculés :

| Token | Valeur **adoptée** (DESIGN.md) | Valeur *proposée* par l'audit — à ignorer |
|---|---|---|
| `checkbox-empty` | **#83887B** (3,64:1 sur carte blanche) | #8A8E82 / #767B6E |
| `checkbox-empty-dark` | **#828AA3** (4,77:1 sur verre) | #7A8299 |
| `muted-2` | **#8B9083** | #7E8378 |
| `muted-2-dark` | **#8990A5** | #9AA0B4 |
| `offline-text` | **#7E6224** (5,20:1) | — |

**Le frontmatter de DESIGN.md est la seule source.** L'audit décrit l'état *d'avant* ; sa section « Fix » est une suggestion qui a été dépassée. Lire l'audit pour comprendre *pourquoi* un token vaut ce qu'il vaut est utile ; en recopier une valeur est une régression.

### Le piège n°4 — la prop d'`error.tsx` a changé de nom en Next 16.2

```tsx
// ❌ le réflexe, et ce que rendra n'importe quel exemple d'avant 2026
export default function Error({ error, reset }) { … }

// ✅ Next 16.2+ (installé : 16.2.12)
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) { … }
```

`unstable_retry` a été ajoutée en **v16.2.0** et la documentation la recommande explicitement à la place de `reset` : elle **refait la requête** et re-rend le segment, là où `reset` se contente de vider l'état du périmètre sans re-fetcher. Pour une page qui lit le foyer en base, c'est toute la différence entre « réessayer » et « réafficher la même erreur ».

`reset` existe encore et n'est pas déprécié — mais la doc dit *« In most cases, you should use `unstable_retry()` instead »*. Suis-la.

⚠️ Le préfixe `unstable_` est celui de Next, pas un avertissement à contourner. Ne cherche pas une variante « stable » : il n'y en a pas dans cette version.

### Le piège n°5 — `error.message` n'est pas également sûr des deux côtés

La documentation Next est précise, et la nuance compte :

- Erreur venue d'un **Server Component** → message générique + `digest`. Next protège déjà.
- Erreur venue d'un **Client Component** → **le message d'origine est transmis tel quel**.

Or ce dépôt a **quatre Client Components qui parlent à la base** (`LoginForm`, `CreateHouseholdForm`, `JoinHouseholdForm`, `DisplayNameForm`). Une exception qui y remonterait afficherait un message en anglais, technique, directement à l'écran — exactement ce que NFR-8 interdit.

**Règle : `error.message` ne franchit jamais le JSX.** Le journaliser dans un `useEffect` est permis (la console n'est pas l'écran) ; l'afficher ne l'est pas. `digest` non plus : c'est un identifiant technique.

Le dépôt applique déjà cette discipline partout — `LoginForm.tsx` traduit chaque code Supabase avec un repli générique, et ne rend jamais le brut. `error.tsx` est le dernier filet, pas l'exception.

### Le piège n°6 — pourquoi `global-error.tsx` est délibérément absent

Le réflexe consciencieux est d'ajouter les trois fichiers d'un coup. **Ne le fais pas ici**, pour une raison documentée :

> *« `global-error` et la page 500 intégrée rendent leur propre document et **n'incluent pas tes styles globaux** »*

`global-error.tsx` remplace le layout racine, écrit ses propres `<html>` et `<body>`, et **ne reçoit pas `globals.css`**. Il ne verrait donc **aucun** des tokens que cette story vient de poser : il faudrait lui écrire une seconde palette en styles inline, en double, qui divergerait au premier changement.

L'AC3 nomme deux fichiers, pas trois. **Écarte-le explicitement et consigne-le** dans `deferred-work.md` : une erreur dans le layout racine reste aujourd'hui non habillée, et c'est un choix, pas un trou.

### Le piège n°7 — l'abricot n'a rien à faire dans l'Epic 1

L'AC2 dit que l'accent est **« disponible »**, pas qu'il est employé. La tentation sera de peindre le bouton « Enregistrer » ou « Rejoindre » en abricot, parce que la couleur existe enfin et que ça ferait joli.

**DESIGN.md l'interdit, et c'est le cœur de sa discipline :**

> *« L'abricot est réservé à l'action courses (le compteur, la coche, la provenance, la tuile Courses). Partout ailleurs, tout est neutre. Une pastille abricot veut toujours dire "ça concerne tes courses" — jamais "c'est joli". »*

Aucun écran de l'Epic 1 n'est une action courses. Connexion, création de foyer, invitation, profil : **tout est neutre**.

**La seule exception, explicitement nommée par DESIGN.md, est l'anneau de focus** — *« c'est le seul autre usage légitime de l'abricot (surfaces de saisie), car un focus courses reste dans le registre courses »*. `focus-ring-light` #C2410C en clair, `focus-ring-dark` #FFA94D en sombre.

Corollaire : si tu emploies un accent porteur de **texte sur fond clair**, c'est `accent-text-light` (#C2410C) et jamais `accent-strong` (#F5912B), qui tombe à ~2:1 — sous AA. `accent-strong` est réservé aux **aplats**.

### Le piège n°8 — la 404 est invisible aux visiteurs anonymes

Tu vas tester `not-found.tsx` en ouvrant `/nimportequoi` dans une fenêtre privée, voir arriver `/login`, et conclure que le fichier ne marche pas.

Il marche. **Le proxy passe avant le routage** : toute route non publique sans session part sur `/login?next=<chemin>`, y compris une route qui n'existe pas. `PUBLIC_ROUTES` ne contient que `/login` et `/auth/callback`.

**Il faut être connecté pour voir la page introuvable.** Vérifié par `curl` en Story 1.6 : `/foyer` sans cookie rend `307 → /login?next=%2Ffoyer`. Une URL inexistante suit le même chemin.

**Ne « corrige » pas ça** en ouvrant les routes inconnues dans le proxy : ce serait affaiblir le contrôle d'accès pour embellir un écran d'erreur.

### Ce que les six écrans utilisent aujourd'hui, et ce que ça devient

Audit exécuté sur `app/**/*.tsx` — **aucune couleur de la palette Tailwind par défaut n'est employée** (ni `bg-white`, ni `text-gray-500`, ni le moindre `red`). C'est ce qui rend la Task 4 réalisable sans casse.

| Motif actuel | Occurrences | Devient |
|---|---|---|
| `border-current/30` | 14 | bordure de carte / de champ, tokenisée |
| `outline-2 outline-offset-2 outline-current` | ~16 | l'anneau de focus de la couche de composants |
| `bg-transparent` (champs) | 6 | surface de champ tokenisée |
| `opacity-70` / `opacity-60` | 4 | `muted` (texte porteur) ou l'état désactivé de la couche |
| `border-current/15` | 1 | séparateur de la liste des membres |

⚠️ **`opacity-70` sur un texte porteur d'information doit disparaître, pas être traduit en opacité.** Le plancher d'a11y est explicite : *« provenance icône `#7D849C`@opacity .7 → 2,86:1 → FAIL »*. Une opacité réductrice sur un gris le fait tomber sous le seuil. Les deux usages actuels (`app/page.tsx` « Ton foyer est prêt… », `app/foyer/page.tsx` la phrase des appareils) sont du **texte porteur** → `muted`, qui tient AA sur les fonds réels.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| `global-error.tsx` | *écarté* — ne reçoit pas les styles globaux (piège n°6) |
| Un interrupteur clair/sombre manuel | *hors périmètre* — UX-DR1 dit « suivant le réglage système » |
| Les composants de la liste (coche, carte-rayon, ligne-article, pastille pending) | **Epics 2 et 4** — leurs tokens sont posés ici, leur JSX non |
| La tuile Courses, le compteur géant, le bandeau hors-ligne | **Epics 4 et 5** — tokens posés, surfaces à venir |
| Le manifeste PWA, les icônes, le service worker | **Epic 6** (FR-35) — l'AC4 le dit explicitement |
| Une webfont arrondie pour Android | *hors périmètre* — décision de Florian, 2026-07-27. **Aucun fichier de police.** Voir « Les décisions de Florian » |
| Toute refonte de mise en page ou de libellé | *hors périmètre* — la Task 3 est une substitution de classes |
| Framework de test | **Story 4.15** |

### Microcopy des deux nouveaux écrans (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache. Ajoute-leur, pour ces écrans-là : *erreur 500*, *exception*, *serveur*, *code d'état*.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre d'erreur | « Ça a coincé. » | « Une erreur est survenue » |
| Corps d'erreur | « On ne sait pas trop pourquoi. Tu peux réessayer. » | « Erreur interne du serveur (500) » |
| Bouton de reprise | « Réessayer » | « Recharger la page » |
| Titre de 404 | « Il n'y a rien ici. » | « 404 — Page non trouvée » |
| Corps de 404 | « Cette adresse ne mène nulle part. » | « La ressource demandée est introuvable » |
| Retour | « Revenir chez toi » | « Retour à l'accueil » |

Le ton de l'erreur est le test le plus sévère du produit : c'est le moment où l'envie d'être technique est la plus forte, et le moment où la conjointe est le plus susceptible de refermer l'app. **Aucun chiffre, aucun code, aucun anglais.**

### Contraintes d'architecture applicables

- **UX-DR1** — tokens de DESIGN.md, deux thèmes complets suivant le système, aucun thème câblé en dur. Le `#0f1117` du prototype est mort avec lui
- **UX-DR2** — l'abricot réservé à l'action courses (piège n°7). `accent-strong` pour les aplats, `accent-text-light` pour le texte sur clair
- **UX-DR12** — tutoiement, mots bannis, `tabular-nums` sur tout chiffre
- **NFR-8** — jamais un message technique brut. `error.tsx` est le dernier filet (piège n°5)
- **NFR-11** — aucun binaire natif. Étendu ici par prudence : **aucun fichier de police embarqué** sans arbitrage de Florian
- **NFR-1** — le hors-ligne est un mode nominal : sa teinte est ambre, jamais rouge. Les tokens `offline-*` se posent maintenant, la surface arrive en Epic 4
- **AD-13** — Next est une coquille. Rien ici ne touche au contrat Postgres
- **AR-MIGRATIONS** — schéma **gelé**. Cette story ne parle à aucune base ; `git status --short supabase/` doit rester vide

### Standards de test

**Aucun framework de test, et il ne faut pas en introduire ici.** La vérification est **visuelle et manuelle**, et c'est la première story du projet où c'est intrinsèque : un thème ne se prouve pas par `typecheck`.

Ce qui compte : **les six écrans, dans les deux thèmes, plus le focus au clavier**. Douze passages, plus les deux nouveaux écrans. La bascule se fait dans les outils de développement (*Rendering → Emulate CSS media feature `prefers-color-scheme`*), sans toucher aux réglages du système.

Ce que tu ne peux pas prouver ici : les ratios de contraste **calculés** de DESIGN.md. Ils ont été audités et recalculés en amont (`review-accessibility.md` puis durcissement). Ton travail est de **transcrire fidèlement**, pas de recalculer — et surtout pas de « corriger » une valeur qui te paraîtrait pâle.

⚠️ **Pièges d'outillage établis :** `npm run build | grep …` ne rend jamais la main (rediriger vers un fichier) ; après suppression d'une route, purger `.next` avant de conclure à une régression du `typecheck` ; sur un champ `autoComplete`, la liste de suggestions du gestionnaire de mots de passe se dessine **par-dessus le bouton** et avale le premier clic (`Échap` la referme).

### Project Structure Notes

```
app/
  globals.css              ~~ RÉÉCRIT — tokens, deux thèmes, couche de composants, reduced-motion
  error.tsx                +  "use client", unstable_retry, jamais error.message
  not-found.tsx            +  Server Component, aucune prop
  layout.tsx                  probablement inchangé — vérifie juste que `antialiased` et la
                              structure flex survivent aux nouveaux fonds
  page.tsx                 ~  substitution de classes
  login/{page,LoginForm}.tsx           ~  substitution
  onboarding/*.tsx                     ~  substitution (4 fichiers)
  foyer/{page,InviteCard,DisplayNameForm}.tsx  ~  substitution
lib/                          INCHANGÉ — cette story ne parle à aucune base
proxy.ts                      INCHANGÉ — surtout pas pour arranger la 404 (piège n°8)
supabase/                     INTACT — aucune migration
package.json                  INTACT — aucune dépendance, aucune police
```

Il n'existe **qu'un seul fichier CSS** dans le projet, et c'est voulu. N'en crée pas un second : un `theme.css` importé à côté rendrait l'ordre de cascade dépendant de l'ordre d'import, pour aucun gain à cette taille.

### Intelligence des stories précédentes

- **Les six écrans ont été écrits en sachant que cette story arrivait.** Chacun porte le commentaire *« aucune couleur d'alerte n'existe encore, et le rouge d'erreur est banni du produit (UX-DR1) »* au-dessus de son message d'erreur. Ces commentaires deviennent faux : **mets-les à jour**, ne les laisse pas mentir comme l'annonce de la 1.6 l'avait fait dans `page.tsx`
- **La discipline « structurelle plutôt que surveillée » est la marque de ce projet.** AD-2 dénoue la tension d'isolation « structurellement, pas par vigilance » ; la Story 1.6 a réglé le trou de `profiles` par un payload à un seul champ. La Task 4 est la version couleur de cette idée
- **Motifs à reprendre plutôt qu'à réinventer** : `LoginForm.tsx` pour la traduction d'erreur avec repli générique ; `app/page.tsx` pour un `<main>` centré minimal — c'est la forme dont `error.tsx` et `not-found.tsx` ont besoin
- **Mesure au lieu de supposer.** Quatre affirmations déduites se sont révélées fausses sur ce projet (les modèles d'email, le format du code, le commentaire « base32 » du schéma, l'idée qu'un `update` refusé lève une erreur). Ouvre les deux thèmes et regarde
- **Une case vide honnête vaut mieux qu'une case cochée à tort.** Les stories 1.5 et 1.6 ont laissé des sous-tâches non cochées avec leur raison écrite ; la revue l'a préféré

### Intelligence git

`2a5b73a` est la base — **`main`, propre**. Les Stories 1.5 et 1.6 y ont été fusionnées (#9 puis #11) le 2026-07-27 : plus aucune PR n'est ouverte, plus aucune pile à démêler. Branche directement depuis `main`.

⚠️ **Deux branches locales périmées traînent** : `feat/story-1-6-profil-membres` (historique d'avant rebasage, aussi présente sur le distant) et `feat/story-1-6-ecran-profil` (fusionnée). Elles ne servent plus à rien — ne branche pas depuis elles, et ne t'étonne pas de les voir.

Convention : **Conventional Commits**, corps en français ; branche dédiée → PR → **squash merge** CI verte. La CI rejoue `typecheck`, `lint`, `build` sur Node 22.

**Le serveur de développement écoute sur le port 3333.**

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3` (+ `@tailwindcss/postcss@4.3.3`), `typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10**).

**Vérifié sur la documentation en ligne au 2026-07-27 :**

- **Tailwind 4** — `@theme` déclare des tokens *et* génère les utilitaires correspondants ; `:root` sert aux variables qui ne doivent pas devenir des utilitaires. `@theme inline` fait pointer l'utilitaire sur la variable au lieu d'en figer la valeur — **obligatoire pour tout token qui bascule** (piège n°2)
- **Next 16.2.12** — `unstable_retry` ajoutée en v16.2.0 (`reset` toujours présent mais non recommandé) ; `error.tsx` doit être un Client Component ; `error.message` n'est masqué que pour les erreurs venues du serveur ; `global-error` ne reçoit pas les styles globaux

**Aucune bibliothèque nouvelle n'est requise.** Ni gestionnaire de thème, ni `next-themes`, ni `clsx`, ni `tailwind-merge`, ni police. Si tu ressens le besoin d'ajouter une dépendance, relis le piège n°1 : la réponse est dans le CSS.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7] — user story et 4 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#UX-Design-Requirements] — UX-DR1 (tokens & double thème), UX-DR2 (discipline de l'accent), UX-DR12 (microcopy, `tabular-nums`)
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md] — **frontmatter = la source unique des tokens** ; sections *Colors*, *Typography*, *Shapes*, *Elevation & Depth*, *Do's and Don'ts*, *Lacunes & hypothèses*
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md#Accessibility-Floor] — focus 2px + offset sur tout focusable, `prefers-reduced-motion`, contraste jugé sur les fonds **réels**, jamais de dépendance à la seule couleur
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/review-accessibility.md] — **à lire pour le raisonnement, jamais pour les valeurs** (piège n°3)
- [Source: …/ARCHITECTURE-SPINE.md#Consistency-Conventions] — « messages techniques jamais rendus bruts ; `error.tsx`/`not-found.tsx` obligatoires »
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — la couche de composants perdue en 1.1, dont la reconstruction est explicitement assignée à cette story
- [Source: _bmad-output/implementation-artifacts/1-6-ecran-profil-membres-du-foyer.md] — pièges d'outillage, motif de vérification manuelle
- **Documentation en ligne, consultée le 2026-07-27** : `tailwindcss.com/docs/theme` (`@theme` / `@theme inline`) ; `nextjs.org/docs/app/api-reference/file-conventions/error` (`unstable_retry`, Client Component, `error.message`, `global-error` sans styles globaux)

## Les décisions de Florian (2026-07-27)

Les deux questions ouvertes à la création de la story ont été tranchées. **Ce ne sont plus des questions : ce sont des contraintes.**

1. **Aucun fichier de police.** DESIGN.md laissait ouverte une webfont arrondie de secours pour Android, *« à confirmer sous contrainte de légèreté PWA (NFR-10/11) »*. **Tranché : on garde le stack système, et rien d'autre.**

   Conséquence à assumer, pas à réparer : `ui-rounded` rend nativement sur Apple, **n'existe pas sur Android**, et les titres y retomberont sur la sans-serif système — plus plats, mais lisibles. C'est une dégradation acceptée. **N'embarque ni Nunito, ni Figtree, ni `next/font`**, et ne « corrige » pas la rondeur manquante par un `font-weight` plus lourd ou un `letter-spacing` compensatoire : la déclaration reste celle de DESIGN.md, telle quelle. Le sujet se rouvrira à l'Epic 6, quand la PWA sera réellement installée sur un Android — **consigne-le dans `deferred-work.md`.**

2. **Branche depuis `main`.** Les Stories 1.5 et 1.6 ont été fusionnées avant celle-ci, précisément pour éviter une pile de trois PR sur un périmètre qui réécrit `globals.css` et touche les six écrans. `main` est propre, aucune PR n'est ouverte.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

### Vérification (2026-07-27)

| Commande | Résultat |
|---|---|
| `npm run typecheck` · `lint` · `build` | exit 0, **0 avertissement** |
| `git status --short supabase/` | vide — **aucune migration** |
| `git diff package.json package-lock.json` | vide — **aucune dépendance** |
| `find app public -name "*.woff*|*.ttf|*.otf"` · `grep next/font` | **aucun fichier de police, aucun chargeur de police** (AC4) |
| `grep -rE 'border-current|outline-current|opacity-[67]0|bg-transparent' app` | **aucune** — les 41 occurrences ont disparu |
| `grep force-dynamic app lib` | aucun |
| Palette Tailwind par défaut dans `app/` | **aucune occurrence** |
| `grep accent app/**/*.tsx` | **aucun usage de l'accent dans les écrans** — il ne vit que dans l'anneau de focus, via le CSS |

**Preuve au niveau du CSS compilé**, plus solide qu'un simple coup d'œil :

| Contrôle | Résultat |
|---|---|
| Tokens de couleur Tailwind par défaut émis | **aucun** — pas de `--color-red-*`, `--color-gray-*`… La neutralisation a pris |
| Les 17 variables brutes de DESIGN.md | toutes présentes |
| `@media (prefers-color-scheme: dark)` | présent, avec `--surface-base:#191016` et les deux halos radiaux |
| Compilation de `.btn` | `border-color:var(--card-border);background-color:var(--surface-card);color:var(--text)` — **les utilitaires pointent sur les variables, ils ne figent pas la valeur claire.** C'est la preuve directe que le piège n°2 est évité |
| `:focus-visible` | `outline:2px solid var(--focus-ring);outline-offset:2px` |
| `prefers-reduced-motion:reduce` | présent |

**Parcours visuel — bascule au niveau du réglage macOS**, et non par émulation des outils de développement : c'est le réglage système que l'AC1 nomme. L'état initial (clair) a été relevé avant, et restauré après.

| Écran | Clair | Sombre |
|---|---|---|
| `/foyer` — le contrôle qui compte (carte, champ, trois boutons, séparateur) | ✅ | ✅ |
| `/` | ✅ | ✅ |
| `/nimportequoi` → page introuvable | ✅ | ✅ |
| Écran d'erreur | ✅ | ✅ |

En sombre, le fond porte bien sa base aubergine, le halo terracotta en haut-gauche et le prune en bas-droite ; les cartes sont en verre translucide. En clair, le blanc cassé chaud avec le radial blanc en haut-gauche, cartes en blanc pur et ombre douce.

**Anneau de focus au clavier** — vérifié dans les deux thèmes : **abricot `#FFA94D` en sombre**, **abricot brûlé `#C2410C` en clair**, 2px avec dégagement. Vu sur un bouton (sombre), sur un champ et sur un bouton discret (clair). La règle étant unique et globale (`:focus-visible`), elle ne dépend pas du type d'élément.

**L'écran d'erreur, éprouvé pour de vrai.** Une route jetable `app/boom` a été créée le temps du contrôle : un **Client Component** qui lève à l'hydratation avec un message anglais explicite. C'est le cas exact du piège n°5 — Next masque les messages venus du serveur, mais **transmet ceux des Client Components tels quels**, et ce dépôt en a quatre qui parlent à la base. Testé sur un **build de production** (port 3334), pour que la surcouche de développement ne masque rien :

```
messageTechniqueVisible : false
presentDansLeDOM        : false
texteAffiche            : "Ça a coincé.\n\nOn ne sait pas trop pourquoi. Tu peux réessayer.\n\nRéessayer"
```

La chaîne technique n'est **nulle part dans le DOM**, pas seulement invisible à l'œil. La route jetable a été supprimée (`app/boom` absent, build final sans route `/boom`).

**Ce qui n'est PAS vérifié à l'écran, et pourquoi :**

- **`/login` et `/login` après envoi** — le proxy renvoie un utilisateur connecté hors des pages d'authentification ; les voir exigerait de détruire la session de Florian et un nouveau lien par email. Le balisage rendu a été contrôlé **sans session** (`curl`) : `input mt-2`, `btn mt-4 w-full`, `label`, `notice mt-4` — **exactement les classes de la couche déjà vues rendues dans les deux thèmes sur `/foyer`**. C'est une déduction solide, pas une observation : je ne la présente pas autrement.
- **`/onboarding`, les deux chemins** — exige une session **sans profil**, donc un compte neuf. **Écarté explicitement.**
- **Zoom 200 % sans défilement horizontal** — laissé au *finalize* par EXPERIENCE.md, et les surfaces concernées (liste, compteur 48px) n'existent pas encore.

### Completion Notes List

**Les sept tâches sont livrées, à deux sous-tâches de vérification près, délibérément laissées vides.** Aucune migration, aucune dépendance, aucun fichier de police.

**Le piège n°2 est évité et prouvé, pas supposé.** Le CSS compilé montre `.btn` pointant sur `var(--card-border)` / `var(--surface-card)` / `var(--text)` : les utilitaires suivent les variables, ils ne figent pas la valeur claire. C'est le seul contrôle qui distingue un double thème qui marche d'un double thème qui compile.

**La discipline de couleur est devenue structurelle.** `--color-*: initial` retire la palette de Tailwind du build : `bg-red-500` n'existe plus, il ne peut plus être écrit par distraction. Le CSS compilé ne contient aucun token de couleur par défaut. C'est la version couleur de ce qu'AD-2 fait pour l'isolation — dénouer plutôt que surveiller. `--color-transparent` et `--color-current` ont bien dû être redéclarés, comme la story l'annonçait.

**L'anneau de focus est une règle globale, pas une classe.** Les 16 répétitions de `outline-2 outline-offset-2 outline-current` sont remplacées par un unique `:focus-visible`. Une classe pouvait être oubliée sur un nouvel élément ; une règle globale, non — et le plancher d'a11y exige « tout élément focusable ».

**L'abricot n'apparaît nulle part ailleurs que sur cet anneau**, conformément au piège n°7. Aucun bouton n'est peint : aucun écran de l'Epic 1 n'est une action courses. Les tokens `accent-*`, `checkbox-*` et `offline-*` sont posés et attendent les Epics 2 à 5 — c'est ce que l'AC2 demande (« disponible »), pas davantage.

**La Task 3 est restée une substitution.** Les remplacements ont été appliqués par un script à comptes vérifiés (21 motifs, chacun avec son nombre d'occurrences attendu, assertion à l'appui) : aucune balise déplacée, aucun libellé touché. Cinq commentaires devenus faux — ceux qui annonçaient que « la palette n'existe pas encore » — ont été mis à jour plutôt que laissés à mentir.

**Écart de méthode assumé — pas de TDD**, la story l'interdisant (tests planifiés en Story 4.15).

**Deux pièges d'outillage rencontrés, dont un déjà connu :**
- Le `typecheck` a échoué sur un validateur périmé sous `.next/` après suppression de la route jetable — **exactement le piège documenté**. `rm -rf .next` l'a réglé.
- Purger `.next` pendant qu'un serveur de développement tourne le laisse répondre `Internal Server Error` sur tout. Ce n'était pas une régression : il fallait le redémarrer.

**État du système laissé intact.** Le réglage d'apparence de macOS était en clair au départ, il a été basculé en sombre pour le contrôle, puis **remis en clair**.

### File List

**Nouveaux**
- `app/error.tsx` — Client Component, `unstable_retry`, message français, `error.message` jamais rendu
- `app/not-found.tsx` — Server Component, invisible aux visiteurs anonymes par construction

**Modifiés**
- `app/globals.css` — réécrit : tokens des deux thèmes, palette Tailwind neutralisée, couche de composants, focus global, `prefers-reduced-motion`
- `app/page.tsx`, `app/login/LoginForm.tsx`, `app/onboarding/{CreateHouseholdForm,JoinHouseholdForm,OnboardingChoice}.tsx`, `app/foyer/{page,InviteCard,DisplayNameForm}.tsx` — substitution des classes ad hoc, mise à jour des commentaires périmés

**Créés puis supprimés**
- `app/boom/page.tsx` — route jetable qui lève, le temps d'éprouver `error.tsx`. Absente du livrable

**Inchangés, vérifiés**
- `app/layout.tsx`, `lib/**`, `proxy.ts` — le proxy en particulier : la 404 invisible en anonyme est un comportement, pas un défaut
- `package.json`, `package-lock.json` — **aucune dépendance, aucune police**
- `supabase/` — **aucune migration**

## Change Log

| Date | Changement |
|---|---|
| 2026-07-27 | Story créée. Statut → `ready-for-dev` |
| 2026-07-27 | Questions tranchées par Florian : aucun fichier de police (stack système, rondeur perdue sur Android assumée) ; base = `main` après fusion des Stories 1.5 et 1.6. `baseline_commit` → `2a5b73a` |
| 2026-07-27 | Implémentation et vérification : tokens des deux thèmes posés d'après DESIGN.md, palette Tailwind neutralisée, couche de composants reconstruite, 41 classes ad hoc substituées, `error.tsx` et `not-found.tsx` ajoutés. Bascule clair/sombre vérifiée au réglage système sur quatre écrans ; message technique prouvé absent du DOM. Deux écrans d'authentification écartés explicitement. Statut → `review` |
