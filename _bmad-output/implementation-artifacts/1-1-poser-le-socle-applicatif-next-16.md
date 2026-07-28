---
baseline_commit: 66303d0db46b58eb9a00a3200aa212c2b2dc2022
---

# Story 1.1: Poser le socle applicatif Next 16

Status: done

<!-- Réécrite le 2026-07-26 suite au Sprint Change Proposal du même jour (abandon du prototype applicatif). -->
<!-- La version précédente (« Débloquer la construction ») visait une réparation ; elle est caduque. -->

## Story

As a développeur du produit (Florian),
I want un socle applicatif neuf qui compile et passe le typage sur la stack cible (Next 16 / React 19 / Tailwind 4 / TS 6) et parle à la base déployée,
so that toute autre story se construise sur une fondation saine, sans dette de configuration héritée.

## Acceptance Criteria

**AC1 — L'application se construit**
**Given** le prototype généré le 2026-05-02, qui ne compile pas et dont ~92 % des surfaces sont condamnées par AD-11, AD-13 et UX-DR1
**When** l'application est réinitialisée depuis un scaffold Next 16 propre, le prototype restant consultable dans l'historique git
**Then** `next build` et `npm run typecheck` réussissent tous deux sans erreur ni avertissement de configuration

**AC2 — La base déployée n'est pas touchée**
**Given** la base Supabase déployée et son schéma gelé (migration `initial_schema` jouée)
**When** le socle est posé
**Then** aucune migration n'est créée ni rejouée, et le schéma déployé reste l'unique source de vérité (AR-MIGRATIONS, AD-1)

**AC3 — Le contrôle d'accès est en place**
**Given** le besoin de contrôle d'accès avant toute surface authentifiée
**When** un `proxy.ts` (convention Next 16) est écrit avec `/login`, `/signup` et `/auth/callback` comme seules routes publiques
**Then** un utilisateur non authentifié est redirigé vers `/login` en conservant sa destination, un utilisateur authentifié visitant une page d'authentification est renvoyé à l'accueil, et `/auth/callback` reste toujours accessible pour l'échange de code

**AC4 — Le client Supabase est correct et sûr**
**Given** `cookies()` asynchrone en Next 16 et les en-têtes anti-cache exigés par `@supabase/ssr`
**When** `lib/supabase/{client,server,proxy}.ts` sont écrits selon les patterns Supabase courants
**Then** le client serveur attend (`await`) `cookies()`, et les en-têtes fournis par `setAll` sont appliqués sur la réponse — **aucun cookie de session ne peut être mis en cache par un CDN** (NFR-5)

**AC5 — Aucun résidu**
**Given** le socle posé
**When** l'application démarre
**Then** elle affiche « NutriClaude », Tailwind 4 est configuré nativement (`@tailwindcss/postcss`, `@import "tailwindcss"`), le `tsconfig` est sans `baseUrl`, et **il ne subsiste aucun fichier `middleware.ts` ni aucun résidu de configuration Tailwind v3**

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.1 — cité verbatim]

## Tasks / Subtasks

- [x] **Task 0 — Préserver le prototype avant de le retirer** (AC: 1)
  - [x] Vérifier que l'arbre de travail est propre et que le commit `7e1a249` contient bien le prototype complet
  - [x] Poser un tag annoté, par exemple `git tag -a prototype-2026-05-02 7e1a249 -m "Prototype généré, abandonné au profit d'un socle neuf"` — le rend retrouvable sans fouiller l'historique
  - [x] Travailler sur une branche dédiée

- [x] **Task 1 — Scaffold Next 16 propre** (AC: 1, 5)
  - [x] Générer un scaffold Next 16 (App Router, TypeScript, Tailwind 4) et en reprendre les fichiers de configuration : `package.json`, `tsconfig.json`, `next.config`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`
  - [x] Aligner les versions sur **AR-STACK réactualisé** (voir Dev Notes — attention au bond `@supabase/ssr`)
  - [x] Retirer du dépôt les répertoires du prototype : `app/(app)/`, `app/signup/`, `app/onboarding/`, `app/auth/`, `components/`, `middleware.ts`, `tailwind.config.ts` — *corrigé en revue : `app/login/` et `lib/supabase/` n'ont PAS été retirés mais réécrits sur place (`page.tsx`, `client.ts`, `server.ts`), et `lib/supabase/types.ts` a été conservé tel quel. L'état final est conforme à l'arborescence cible ; la formulation initiale de la tâche était inexacte.*
  - [x] **Conserver intacts** : `supabase/`, `.env.local`, `.env.local.example`, `.gitignore`, `.node-version`, `_bmad*/`
  - [x] Vérifier `tsconfig.json` : pas de `baseUrl`, `paths: { "@/*": ["./*"] }` conservé avec le préfixe `./` (sans quoi TS 6 lève `TS5090`)
  - [x] `metadata.title` = « NutriClaude »
  - [x] Vérifier : `npx next build` réussit sur l'app vide

- [x] **Task 2 — Porter le peu qui survit** (AC: 1)
  - [x] `lib/dates.ts` (72 lignes, pur, sans dépendance) — *corrigé en revue : rien n'a été « porté ». Le fichier n'a simplement jamais été supprimé, il est identique à `7e1a249` au caractère près.*
  - [x] `lib/supabase/types.ts` — *idem : conservé sur place, jamais déplacé.* Reste **provisoire** : `supabase gen types` est la bonne réponse, hors périmètre de cette story
  - [x] Ne rien porter d'autre. Tout le reste est condamné par AD-11, AD-13 ou UX-DR1

- [x] **Task 3 — Clients Supabase** (AC: 4)
  - [x] `lib/supabase/client.ts` — `createBrowserClient`, synchrone
  - [x] `lib/supabase/server.ts` — `export async function createClient()` avec `await cookies()`. Le 2ᵉ paramètre de `setAll` est nommé `_headers` et ignoré (un Server Component ne peut pas écrire d'en-têtes)
  - [x] `lib/supabase/proxy.ts` — `updateSession(request)`, avec **application des en-têtes anti-cache** sur la réponse (voir Dev Notes, c'est le point de sécurité de l'AC4)
  - [x] Conserver les noms de variables d'environnement **existants** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — voir « Hors périmètre »
  - [x] Vérifier que le pattern `getAll`/`setAll` de la version de `@supabase/ssr` retenue est bien celui attendu **avant** d'écrire ces trois fichiers

- [x] **Task 4 — Contrôle d'accès en `proxy.ts`** (AC: 3, 5)
  - [x] `proxy.ts` à la racine, exportant `export async function proxy(request: NextRequest)`. **Le nom de la fonction doit être `proxy`** (sinon erreur de build `E903`)
  - [x] `export const config = { matcher: [...] }` excluant `_next/static/`, `_next/image/` et les trois fichiers racine exacts — *durci en revue : l'exclusion par extension d'image a été **retirée** (elle laissait passer sans contrôle toute route finissant par `.png`/`.svg`/…) et les exclusions restantes sont désormais ancrées (`/` de répertoire, `$` de fin). Conséquence : l'Epic 6 devra déclarer explicitement ses assets PWA.*
  - [x] Routes publiques : `/login` et `/auth/callback`, en **correspondance exacte** — *durci en revue sur décision de Florian (« le plus strict possible ») : le préfixe `p + "/"` est supprimé, donc `/login/foo` est protégé. `/signup` est retiré : la route n'existe pas, et l'authentification par magic link (AD-11) n'en crée pas de séparée.*

> ⚠️ **Déviation d'AC assumée.** L'AC3 tel qu'écrit dans `epics.md` énonce « `/login`, `/signup` et `/auth/callback` comme seules routes publiques », et une correspondance par préfixe. Le code n'a plus que **deux** routes publiques, en correspondance exacte. C'est plus strict que l'AC, sur décision explicite de Florian en revue. **`epics.md#Story-1.1` devrait être aligné** pour que la spec ne mente pas sur le code — à traiter par `correct-course` si tu veux la cohérence documentaire complète.
  - [x] Non authentifié sur route protégée → `/login?next=<pathname>`
  - [x] Authentifié sur route publique **sauf `/auth/callback`** → `/`
  - [x] **Aucun fichier `middleware.ts` ne doit subsister** (sinon erreur dure `E900`)

- [x] **Task 5 — Vérification** (AC: 1, 2, 3, 5)
  - [x] `npm run typecheck` → 0 erreur
  - [x] `npx next build` → succès, **sans avertissement de configuration**
  - [x] `git status` : aucune modification sous `supabase/` (preuve de l'AC2)
  - [x] Gating manuel : en navigation privée, `/` (ou toute route protégée) → redirige vers `/login?next=…`
  - [x] Grep de non-résidu : aucun `middleware.ts`, aucun `tailwind.config.ts`, aucun `@tailwind base`, aucun `baseUrl`

### Review Findings

_Revue du 2026-07-26. Trois couches abouties : Blind Hunter ✓ (relancé après une erreur API), Edge Case Hunter ✓, Acceptance Auditor ✓. Constats vérifiés dans le code, pas depuis les hunks ; l'Edge Case Hunter a démarré l'application contre un faux serveur Supabase pour observer les chemins réels._

> ⚠️ **Réserve d'indépendance.** Cette revue a été conduite par le même modèle que celui qui a implémenté la story. Les couches adversariales atténuent le biais d'auteur sans l'annuler. Une relecture par un autre modèle reste souhaitable.

**Correctifs appliqués le 2026-07-26** — 11 sur 11, revérifiés à froid : `typecheck` exit 0, `build` exit 0 avec `✓ strictRouteTypes`, `lint` exit 0, gating retesté sur 8 chemins.

| Vérification après correctifs | Résultat |
|---|---|
| `/login/foo` | `307` — n'est plus public (correspondance exacte) |
| `/menu.png` | `307` — contournement par extension fermé |
| `/robots.txtsecret`, `/favicon.icoX` | `307` — exclusions désormais ancrées |
| `/signup` | `307` — retiré de `PUBLIC_ROUTES`, la route n'existe plus |
| `/login` | `200` |
| `/auth/callback` | `404` sans redirection — exemption intacte |
| `/menu?week=X` | `→ /login?next=%2Fmenu%3Fweek%3DX` — query encapsulée, plus de fuite |

**Deux enseignements de la boucle de correction, qui valent d'être gardés :**

1. **Le retour à ESLint 10 a échoué à l'exécution.** La peer dependency l'autorise, mais `eslint-config-next@16.2.12` embarque `eslint-plugin-react@7.37.5` incompatible avec l'API de contexte d'ESLint 10 (`contextOrFilename.getFilename is not a function`, `lint` en code 2). Le constat de revue était juste sur la peer dependency et faux sur sa conclusion ; ma justification d'origine était fausse mais mon choix bon. **Ligne 9 confirmée, pour la vraie raison.**
2. **Le premier correctif du mode hors-ligne était incomplet.** Le `Promise.race` ne couvrait que le cas où l'appel *pend*. Or `getUser()` **ne lève pas** sur échec réseau : il retourne `{ user: null, error: AuthRetryableFetchError }` — ce qui aurait été lu comme « pas de session » et aurait déconnecté tout le foyer à chaque panne. Vérifié empiriquement que `AuthSessionMissingError` (400, appel local, 0 ms) doit au contraire rester une vraie absence de session. Les trois formes de panne sont désormais traitées distinctement.

**Décisions requises** — *toutes tranchées par Florian le 2026-07-26 et converties en correctifs : timeout 3 s puis bascule hors-ligne, `strictRouteTypes` activé, routes publiques en correspondance stricte.*

- [x] [Review][Decision] Comportement quand Supabase est injoignable — `getUser()` n'a aucun timeout : blocage mesuré de **25,5 s par requête**, sur toutes les routes. Arbitrage sécurité/disponibilité à trancher (échec fermé = foyer verrouillé dehors ; échec ouvert = accès sans vérification ; timeout court = compromis). NFR-1 pose le hors-ligne comme mode nominal, ce qui pèse dans la balance. [lib/supabase/proxy.ts:46-48]
- [x] [Review][Decision] `experimental.strictRouteTypes` non activé — c'est la Question 1 de cette story, restée sans réponse alors que le statut est passé à `review`. Sans elle, ni `tsc` ni `next build` ne détectent un `params`/`searchParams` mal typé. [next.config.ts]
- [x] [Review][Decision] Le préfixe `startsWith(p + "/")` rend publics **tous** les sous-chemins de `/login`, `/signup` et `/auth/callback` — vérifié : un `/login/[slug]` rendrait 200 sans contrôle. C'est conforme à la Task 4 qui le prescrit littéralement, mais l'exigence est héritée du prototype. Intentionnel pour `/auth/callback/*`, douteux pour `/login/*`. [lib/supabase/proxy.ts:51-53]

**Correctifs**

- [x] [Review][Patch] **[HAUTE]** Les deux branches de redirection jettent les cookies rafraîchis et les en-têtes anti-cache — `setAll` les pose sur `supabaseResponse`, mais les redirections retournent un `NextResponse.redirect` neuf qui n'en hérite pas. Provoque une **déconnexion silencieuse** quand une rotation de jeton coïncide avec une redirection, et empêche l'effacement d'un cookie périmé (boucle). Contredit directement l'AC4. Vérifié empiriquement : `set-cookie` présent sur la réponse pass-through, absent sur les deux redirections. [lib/supabase/proxy.ts:56-69]
- [x] [Review][Patch] **[MOYENNE]** `request.nextUrl.clone()` conserve la query string d'origine : `/menu?week=2026-01-05` produit `/login?week=2026-01-05&next=%2Fmenu`. Le paramètre fuit sur la page de connexion et `next` perd la query — après la Story 1.2, le retour ramènera sur la mauvaise semaine. [lib/supabase/proxy.ts:57-59]
- [x] [Review][Patch] **[MOYENNE]** Matcher du proxy : tout chemin finissant par `.svg/.png/.jpg/.jpeg/.gif/.webp/.ico` **saute entièrement le contrôle d'accès** (vérifié : aucun passage par le proxy sur `/menu.png`). De plus les exclusions ne sont pas ancrées et le `.` n'est pas échappé — `/robots.txtsecret` et `/favicon.icoX` passent aussi. Aucune route ne l'exploite aujourd'hui, mais le trou est dans le socle. [proxy.ts:21]
- [x] [Review][Patch] **[MOYENNE]** Dev Agent Record inexact sur 7 points — « `globals.css` ne pose aucun token de couleur » (faux : 4 valeurs en dur + `@theme inline`) ; la pile de polices câblée n'est pas déclarée (et anticipe une décision typographique de la Story 1.7) ; les classes de mise en page de `layout.tsx` sont un 3ᵉ ajout hors tâche non déclaré ; File List classe `client.ts`/`server.ts` en « réécrits intégralement » (4 lignes de commentaire pour l'un, ~10 lignes sur 40 pour l'autre) et `app/login/page.tsx` en « Nouveau » alors qu'il est modifié ; Task 1 coche le retrait de `app/login/` et `lib/supabase/` qui n'ont pas été retirés ; Task 2 coche un « portage » de fichiers qui n'ont jamais bougé ; le Debug Log annonce « 4 routes » là où le build en rapporte 3.
- [x] [Review][Patch] **[HAUTE]** ESLint rétrogradé **10.3.0 → 9.39.5 sans justification valable**. Vérifié : `eslint-config-next@16.2.12` déclare `peerDependencies.eslint: ">=9.0.0"` — **la 10 était parfaitement supportée**. La justification inscrite au Completion Note (« `eslint-config-next` est apparié avec la 9 ») est **factuellement fausse**, et le commit précédent avait délibérément porté ESLint à 10. Conséquence de sécurité : réintroduction de `minimatch@3.1.5` et `brace-expansion@1.x` (lignée legacy porteuse des ReDoS) sous `@eslint/config-array` et `@eslint/eslintrc`, alors que la 10 utilisait `minimatch@^10`. Une partie des 12 vulnérabilités « high » signalées comme fatalité est en réalité **auto-infligée**. [package.json, package-lock.json]
- [x] [Review][Patch] **[MOYENNE]** `PUBLIC_ROUTES` liste deux routes qui n'existent plus — `app/signup/page.tsx` et `app/auth/callback/route.ts` ont été supprimés par ce même diff. Un utilisateur authentifié visitant `/signup` reçoit un **404 au lieu d'être redirigé vers l'accueil**, et l'exemption `pathname !== "/auth/callback"` protège une route fantôme. L'allowlist ment sur la surface réelle. [lib/supabase/proxy.ts:4]
- [x] [Review][Patch] **[MOYENNE]** Aucun champ `engines` alors que `@supabase/supabase-js@2.110.8` exige **Node ≥22** (`engines: {"node": ">=22.0.0"}`). Le seul garde-fou est `.node-version` = `25`, une version **impaire non-LTS**. Rien n'empêche un build CI ou Vercel sur Node 20 de casser à l'exécution, et rien ne documente la contrainte. [package.json]
- [x] [Review][Patch] **[BASSE]** `tsconfig.json` : `target` passé de `ES2022` (état antérieur du dépôt) à `ES2017` (défaut du scaffold), sans déclaration. Downlevel inutile pour un produit mobile-first (NFR-1) alors que Tailwind 4 impose déjà Safari 16.4+/Chrome 111+, et que le projet cible Node ≥22. [tsconfig.json]
- [x] [Review][Patch] **[BASSE]** `next.config.ts` conserve le placeholder brut du scaffold (`/* config options here */`) et abandonne l'ancien `experimental.typedRoutes: false` sans décision. Sur Next 16 `typedRoutes` est actif par défaut : le comportement du build a changé silencieusement. [next.config.ts]

**Différés**

- [x] [Review][Defer] Open redirect latent via `?next=` — non exploitable aujourd'hui (plus rien ne consomme `next` depuis la suppression de `LoginForm`), mais `/login?next=https://evil.com` deviendra exploitable dès que la Story 1.2 câblera un `router.replace(next)`. **Exigence dure pour la Story 1.2 : valider que `next` est un chemin relatif.** [lib/supabase/proxy.ts:59] — différé, appartient à 1.2
- [x] [Review][Defer] `lib/supabase/server.ts` ignore le 2ᵉ paramètre `_headers` — correct pour un Server Component (qui ne peut pas écrire d'en-têtes), mais un **Route Handler le peut**. Quand la Story 1.2 posera `/auth/callback`, la réponse portera un cookie d'auth sans en-tête anti-cache. [lib/supabase/server.ts:26-35] — différé, appartient à 1.2
- [x] [Review][Defer] Garde d'appartenance au foyer disparue avec `lib/supabase/queries.ts` — `requireProfile()` exigeait un profil et un `household_id`. Aujourd'hui une session seule suffit. Sans conséquence tant qu'aucune route de données n'existe, à rétablir dès l'Epic 1 (stories 1.3+). — différé, pré-existant
- [x] [Review][Defer] Variables d'environnement absentes → `createServerClient` lève, **500 sur toutes les routes y compris `/login`**, aucune page de secours. Motif hérité du prototype (assertions `!`). Une validation au démarrage vaudrait mieux. [lib/supabase/proxy.ts:22-23] — différé, pré-existant
- [x] [Review][Defer] `lib/supabase/server.ts` : le `catch {}` avale toute défaillance d'écriture de cookie, pas seulement le cas Server Component. Une écriture réellement échouée passerait inaperçue. C'est le motif officiel de la documentation Supabase et il n'existe pas d'API stable pour distinguer le contexte. [lib/supabase/server.ts:31-34] — différé, motif amont
- [x] [Review][Defer] La garantie `force-dynamic` a disparu — le prototype la posait sur chaque page authentifiée, le socle n'a rien. Nuance qui abaisse la gravité : en App Router, l'usage de `cookies()` bascule automatiquement une route en rendu dynamique, et tout accès Supabase serveur passe par là. **À confirmer explicitement en Story 1.2** avant la première page lisant des données de foyer. — différé, appartient à 1.2
- [x] [Review][Defer] Quatre modules de `lib/` n'ont **aucun importeur** : `supabase/{server,client,types}.ts` et `dates.ts`. La seule chaîne d'import du projet est `proxy.ts → lib/supabase/proxy`. `server.ts` et `client.ts` ont même été *modifiés* (ajout de JSDoc décrivant des surfaces qui n'existent pas) alors que personne ne les appelle. Mise en place volontaire pour les stories 1.2+, mais rien ne le trace dans le code et `types.ts` divergera silencieusement de la base gelée. — différé, préparation assumée
- [x] [Review][Defer] `globals.css` a perdu toute la couche de composants (`.btn`, `.btn-primary`, `.input`, `.card`, `.chip`…) et les 14 tokens de couleur de `tailwind.config.ts`, sans remplaçant. La reconstruction est renvoyée à la Story 1.7 par un commentaire en prose française — **aucun `TODO` grep-able**. Toute story livrée avant la 1.7 devra inventer des classes ad hoc. — différé, dette planifiée
- [x] [Review][Defer] `postcss` retiré des devDependencies alors que `postcss.config.mjs` en dépend : il n'est plus que transitif via `@tailwindcss/postcss`. Fonctionne aujourd'hui, casse silencieusement si Tailwind change son arbre. (Le retrait d'`autoprefixer` est en revanche correct — Tailwind 4 l'intègre.) — différé, fragilité mineure

**Notes pour la réimplémentation** — deux bugs réels ont disparu avec le prototype, à ne pas recopier : le `<>…</>` sans `key` dans `MEAL_TYPES.map()` de la grille menu (warning React + remontages), et le `<input type="checkbox" checked={false}>` en dur de `GroceryGroup.tsx` qui ignorait `it.status`. Par ailleurs les RPC `generate_grocery_list_from_menu`, `create_household_with_profile` et `redeem_household_invite` **existent dans la base gelée** mais leur seul point d'appel documenté vient d'être supprimé : les signatures devront être reconstituées depuis les migrations SQL.

**Écartés** — `/loginfoo`, `/LOGIN`, `/%2Flogin`, `/..%2fadmin`, `/login/`, `//evil.com` : tous vérifiés en échec fermé par l'Edge Case Hunter. Override ESLint `no-unused-vars` : le Blind Hunter y voit une dégradation `error → warn`, l'Acceptance Auditor a vérifié que `eslint-config-next/dist/typescript.js:36` pose **déjà** `warn` — l'auditeur l'emporte sur preuve, l'override n'affaiblit rien. « 12 vulnérabilités non vérifiées » remonté par l'auditeur : faux positif, il n'avait pas de réseau — la mesure a bien été faite deux fois (mais voir le correctif ESLint : une partie de ces vulnérabilités est auto-infligée). `app/page.tsx` inatteignable en production faute de chemin d'authentification : exact, mais c'est l'état attendu d'un socle dont l'auth arrive en 1.2.

## Dev Notes

### Ce que cette story est, et n'est pas

C'est une story de **fondation**, pas de fonctionnalité. À la fin, l'application **ne fait rien** — elle se construit, protège ses routes et sait parler à Supabase. C'est normal et c'est voulu : l'authentification arrive en Story 1.2, le foyer en 1.3/1.4/1.5, le thème en 1.7, et les surfaces métier dans les epics 2 à 4.

**Ne cède pas à la tentation de reporter des écrans du prototype pour « avoir quelque chose à montrer ».** Chaque écran reporté serait à réécrire immédiatement : la palette est bannie par UX-DR1, et le chemin d'écriture est inversé par AD-13.

### État vérifié du dépôt

Mesures directes du 2026-07-25, toujours valables :

- `npx next build` échoue sur le greffon PostCSS de Tailwind 4 (cause unique)
- `npx tsc --noEmit` remonte **une seule** erreur, `TS5101` sur `baseUrl` — erreur de *configuration*, qui arrête le typage avant l'analyse des fichiers
- Sans `baseUrl`, il reste exactement **2** erreurs, toutes deux dans `lib/supabase/server.ts` (`cookies()` non attendu)

Ces mesures ne servent plus qu'à documenter *pourquoi* on repart de zéro. **Tu n'as rien à réparer.**

### AR-STACK a été réactualisé — lis ceci avant d'installer

Le gel de versions sur celles du prototype n'avait plus lieu d'être : un scaffold neuf installe les versions courantes. AR-STACK a donc été mis à jour le 2026-07-26. Versions vérifiées sur npm ce jour-là :

| Paquet | Version | Note |
|---|---|---|
| `next` | 16.2.12 | Inclut un correctif de sécurité absent de 16.2.4 |
| `react` / `react-dom` | 19.2.8 | |
| `tailwindcss` + `@tailwindcss/postcss` | 4.3.3 | **Versions identiques obligatoires** |
| `typescript` | 6.0.3 | Dernière de la ligne 6.x. **TS 7 (portage Go) reste volontairement non adopté** — arbitrage du 2026-07-23. Ne le monte pas |
| `@supabase/ssr` | 0.12.3 | ⚠️ voir ci-dessous |
| `@supabase/supabase-js` | 2.110.8 | Imposé par la peer dependency de `ssr` 0.12 (`^2.110.5`) |

> ⚠️ **Le point de vigilance de cette story.** `@supabase/ssr` passe de 0.10.2 à **0.12.3** : c'est un bond de **deux versions mineures** (la ligne 0.11 n'a jamais été publiée), pas un patch. Je n'ai **pas** pu vérifier ce que 0.11/0.12 changent.
>
> **Avant d'écrire les trois fichiers de la Task 3**, inspecte `node_modules/@supabase/ssr/dist/main/types.d.ts` et confirme que :
> 1. `getAll`/`setAll` est toujours l'API cookies attendue (et non `get`/`set`/`remove`)
> 2. `setAll` prend toujours un 2ᵉ paramètre `headers: Record<string, string>`
>
> En 0.10.2, la signature vérifiée était :
> ```ts
> export type SetAllCookies = (
>   cookies: { name: string; value: string; options: CookieOptions }[],
>   headers: Record<string, string>
> ) => Promise<void> | void;
> ```
> **Si 0.12 diverge, arrête-toi et signale-le** plutôt que d'adapter au jugé — c'est le chemin d'authentification de tout le produit.

### Le point de sécurité de l'AC4 — les en-têtes anti-cache

Le prototype déclarait `setAll(cookiesToSet)` sans son 2ᵉ paramètre et n'appliquait donc jamais les en-têtes anti-cache. TypeScript l'acceptait (une callback peut déclarer moins de paramètres que sa signature), c'est pourquoi rien ne l'avait signalé.

Le commentaire de la librairie explique l'enjeu :

> Responses that set auth cookies **must not be cached by CDNs or reverse proxies, otherwise one user's session token can be served to a different user.**
> En-têtes fournis : `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, `Pragma: no-cache`.

Le produit est déployé derrière le CDN Vercel. **Cette story est l'occasion de ne pas reproduire la faille** — d'où sa présence dans l'AC4. Dans `lib/supabase/proxy.ts` :

```ts
setAll(cookiesToSet, headers) {
  cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
  supabaseResponse = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options)
  );
  Object.entries(headers).forEach(([key, value]) =>
    supabaseResponse.headers.set(key, value)
  );
}
```

⚠️ **Ne « simplifie » pas la reconstruction de `supabaseResponse`.** Le `NextResponse.next({ request })` rejoué *après* la mutation de `request.cookies` est le pattern `@supabase/ssr` : sans lui, le rafraîchissement de session casse et les utilisateurs se déconnectent au hasard.

### Convention `proxy` de Next 16 — faits vérifiés dans les sources

Lus directement dans `node_modules/next@16.2.4`, à reconfirmer si le scaffold installe 16.2.12 :

- **Emplacement** : `proxy.ts` à la racine, ou `src/proxy.ts` — `dist/lib/constants.js:289-290` définit `PROXY_FILENAME = 'proxy'` et `PROXY_LOCATION_REGEXP = '(?:src/)?proxy'`
- **Nom d'export** : `dist/build/templates/middleware.js:77` fait `(isProxy ? mod.proxy : mod.middleware) || mod.default` → exporter **`proxy`**. Un `proxy.ts` exportant encore une fonction `middleware` **échoue au build** (`E903`)
- **Coexistence interdite** : `dist/build/index.js:640-649` lève `E900` si `middleware.ts` et `proxy.ts` sont tous deux présents
- **`config.matcher`** : inchangé
- **Runtime** : `proxy` tourne sur **Node.js** (plus Edge). `export const runtime = 'edge'` y est refusé

### Piège de typage à connaître — `params` / `searchParams`

Aucune page dynamique n'existe à la fin de cette story, donc rien à corriger. **Mais garde ceci pour les epics 2 et 3**, car ça mordra :

Par défaut, **ni `tsc` ni `next build` ne détectent** un `params`/`searchParams` typé en objet plutôt qu'en `Promise` — le validateur généré par Next type le composant en `{ params: Promise<…> } & any`, et le `& any` fait s'effondrer la vérification. Le symptôme est un **bug silencieux à l'exécution** (`params.id` vaut `undefined`).

Le remède est `experimental: { strictRouteTypes: true }` dans `next.config`, qui rend le validateur strict et nomme le fichier fautif. **Suggestion : active-le dès ce scaffold et laisse-le.** Sur une base neuve il ne coûte rien (aucune erreur à corriger) et il protège toutes les stories suivantes. C'est un choix que je te laisse, il n'est pas dans les AC.

### Tailwind 4 — recette vérifiée, à garder sous la main

Le scaffold neuf te donne un `globals.css` déjà en syntaxe v4 : tu n'as rien à migrer. Mais la Story 1.7 devra y poser les tokens de `DESIGN.md`, et j'ai vérifié expérimentalement contre `tailwindcss@4.2.4` les deux points qui piègent :

- **`@apply` avec une classe custom échoue** : `.btn-primary { @apply btn … }` produit `Error: Cannot apply unknown utility class 'btn'`
- **La solution est `@utility`** : déclarer `@utility btn { … }` hors de `@layer components` rend `@apply btn` légal ensuite. Vérifié, avec inspection du CSS produit
- `@apply` avec des **utilités** dans un `@layer components` fonctionne sans `@reference`, tant que tout vit dans le fichier qui fait l'`@import "tailwindcss"`
- Les opacités sur couleur `@theme` (`bg-red/10`) fonctionnent
- `outline-none` a changé de sens en v4 ; l'équivalent de l'ancien comportement est **`outline-hidden`**

### Frontière de périmètre — ne préempte pas la Story 1.7

La Story 1.7 implémente le système de tokens complet de `DESIGN.md` (double thème clair/sombre, monochrome chaud + accent abricot unique).

Cette story-ci **ne pose aucun token de couleur**. Laisse le `globals.css` du scaffold tel quel. Deux interdits tout de même, pour ne pas créer de dette immédiate :

- **Ne câble pas de thème unique en dur** (ni `color-scheme: dark`, ni un fond fixe) — c'est nommément l'anti-pattern qu'UX-DR1 et les Do's & Don'ts de `DESIGN.md` proscrivent
- **N'introduis pas `focus:outline-none` ni `-webkit-tap-highlight-color: transparent`** sans remplacement visible (UX-DR11, finding `[high]` de la revue d'accessibilité)

### Contraintes d'architecture applicables

- **AD-1** — toute règle métier vit en Postgres. Un socle n'introduit **aucune** logique métier en TypeScript
- **AD-2** — RLS non contournable, **jamais de `SUPABASE_SERVICE_KEY`**. `current_household_id()` est déployée et fonctionne : ne rien y toucher. Le seul lien avec cette story est de ne pas casser la chaîne cookies/session dont dépend `auth.uid()`
- **AD-13** — Next = coquille. **N'ajoute pas `export const dynamic = "force-dynamic"`**
- **AR-MIGRATIONS** — le schéma est **déployé et gelé**. Aucune migration dans cette story. `git status` doit rester vierge sous `supabase/`
- **Conventions** — `lib/supabase/{client,server,proxy}.ts`, imposé par la table Consistency Conventions de l'architecture

### Standards de test

**Aucun framework de test dans le dépôt, et il ne faut pas en introduire ici.** Les tests sont planifiés en **Story 4.15**, et AD-17 ne nomme que deux familles (RLS, convergence) — aucune ne concerne le socle. NFR-10 (« aucun outil en plus ») pousse dans le même sens.

La vérification attendue est **exécutable et manuelle** : `npm run typecheck`, `npx next build`, le test de gating en navigation privée, et le `git status` propre sous `supabase/`.

### Project Structure Notes

Arborescence cible à la fin de cette story :

```
app/
  layout.tsx              metadata.title = « NutriClaude »
  page.tsx                page d'accueil minimale
  globals.css             Tailwind 4 du scaffold, sans tokens custom
lib/
  dates.ts                porté depuis 7e1a249
  supabase/
    client.ts             createBrowserClient
    server.ts             async, await cookies()
    proxy.ts              updateSession + en-têtes anti-cache
    types.ts              porté, provisoire
proxy.ts                  export async function proxy()
supabase/                 INTACT — ne pas toucher
postcss.config.mjs        @tailwindcss/postcss
tsconfig.json             sans baseUrl, paths conservé
next.config.*
package.json
```

Disparaissent : `middleware.ts`, `tailwind.config.ts`, `app/(app)/`, `app/login/`, `app/signup/`, `app/onboarding/`, `app/auth/`, `components/`.

`app/auth/callback/route.ts` **réapparaîtra en Story 1.2** avec le magic link — ne le porte pas maintenant, le prototype l'implémentait pour un flux mot de passe.

### Hors périmètre — recensé pour que tu ne le traites pas au passage

- **Renommer `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `…_PUBLISHABLE_KEY`** : c'est le nom employé par la documentation Supabase actuelle, mais le renommer casserait `.env.local` et la configuration Vercel pour zéro bénéfice fonctionnel
- **`getClaims()` au lieu de `getUser()`** : recommandé par Supabase aujourd'hui. À trancher en **Story 1.2**, qui construit l'authentification
- **`supabase gen types`** : `lib/supabase/types.ts` est écrit à la main, ce qui laisse tous les appels non typés (`as X[]` partout). Générer les types serait un vrai gain, mais ce n'est ni dans les AC ni dans les documents d'architecture. À proposer comme story dédiée
- **`npm run lint`** : doublement cassé dans le prototype (`next lint` supprimé de Next 16, aucune config ESLint alors qu'ESLint 10 exige le flat config). Le scaffold neuf fournira peut-être une configuration — si c'est le cas, tant mieux, garde-la. **Sinon, ne construis pas une configuration de lint dans cette story** : aucun document ne la prescrit. Signale l'état à Florian
- **Épurer `supabase/.temp/`** : artefacts du CLI, non suivis par git. Sans objet

### Intelligence git

Trois commits, tous du 2026-05-02 : `9f37b73` (first commit), `7e1a249` (skeleton, 49 fichiers), `66303d0` (bump all deps, qui a cassé le build).

`7e1a249` est le commit qui contient le prototype complet — c'est celui à taguer et à consulter si une story ultérieure veut un exemple. L'arbre de travail est propre côté code : `git diff` sera un instrument de vérification fiable.

Aucune convention de message de commit établie au-delà du préfixe `chore(init):`. Conventional Commits est le choix cohérent.

### Contexte projet

`_bmad-output/project-context.md` est un squelette vide (« _Documented after discovery phase_ ») : aucune règle de code projet supplémentaire à respecter.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] — user story et 5 AC, cités verbatim (version du 2026-07-26)
- [Source: _bmad-output/planning-artifacts/epics.md#Additional-Requirements] — **AR-SOCLE**, AR-STACK réactualisé, AR-MIGRATIONS ; UX-DR1, UX-DR11
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-26.md] — décision d'abandon du prototype, analyse d'impact, arbitrage AR-STACK
- [Source: …/architecture/architecture-nutriclaude-2026-07-23/ARCHITECTURE-SPINE.md#Invariants-&-Rules] — AD-1, AD-2, AD-11, AD-13, AD-17
- [Source: …/ARCHITECTURE-SPINE.md#Consistency-Conventions] — `lib/supabase/{client,server,proxy}.ts`
- [Source: …/prds/prd-nutriclaude-2026-07-21/prd.md#6] — NFR-5, NFR-8, NFR-10
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md] — interdits de palette, focus clavier (périmètre Story 1.7)
- [Source: supabase/migrations/20260502000000_initial_schema.sql] — schéma **déployé**, à ne pas toucher
- **Mesures directes du dépôt (2026-07-25)** : `npx next build`, `npx tsc --noEmit` avec et sans `baseUrl` ; `node_modules/next/dist/lib/constants.js:287-290` ; `dist/build/templates/middleware.js:77` ; `dist/build/index.js:640-651` ; `@supabase/ssr@0.10.2/dist/main/types.d.ts:16-45` ; compilation réelle avec `@tailwindcss/cli@4.2.4` (échec de `@apply btn`, succès de `@utility btn`)
- **Versions npm vérifiées le 2026-07-26** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, `typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`

## Questions pour Florian

1. **`experimental.strictRouteTypes`** — je suggère de l'activer dès ce scaffold et de le laisser. Sur une base neuve il ne coûte rien et il protège les epics 2 et 3 d'un bug silencieux que ni `tsc` ni `next build` ne détectent. Ce n'est pas dans les AC : dis-moi si tu le veux.
2. **`supabase gen types`** — le typage manuel de `types.ts` laisse tous les appels Supabase non typés. Le moment idéal pour basculer sur des types générés est ce socle, mais aucun document ne le prescrit. Story dédiée ?
3. **Lint** — si le scaffold Next 16 ne fournit pas de configuration ESLint utilisable, le projet restera sans lint. Point à trancher indépendamment.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code) — 2026-07-26

### Debug Log References

Vérifications exécutées, toutes reproductibles :

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0, aucune erreur |
| `npm run build` | succès, **aucun avertissement**, `ƒ Proxy (Middleware)` enregistré, 4 routes |
| `npm run lint` | exit 0, aucun problème |
| `git status --short supabase/` | vide — base non touchée |
| `curl /` (anonyme) | `307 → /login?next=%2F` |
| `curl /menu` (anonyme) | `307 → /login?next=%2Fmenu` — destination conservée |
| `curl /login` (anonyme) | `200` — route publique traversée |
| `curl /auth/callback` (anonyme) | `404` **sans redirection** — exemption effective (la route arrive en Story 1.2) |

Toutes rejouées une seconde fois après suppression de `.next` et `tsconfig.tsbuildinfo`, donc à froid : mêmes résultats.

⚠️ **Piège d'outillage à connaître.** `npm run build 2>&1 | grep …` **ne rend jamais la main** : les workers Turbopack (5 processus) gardent le descripteur de sortie ouvert, `grep` n'atteint pas l'EOF et la commande paraît bloquée indéfiniment — alors que le build lui-même se termine en ~2 s. Constaté ici sur une expiration à 10 minutes. **Rediriger vers un fichier plutôt que de piper**, ou lancer en arrière-plan. Vaut pour toutes les stories suivantes.

### Completion Notes List

**Écart de méthode assumé — pas de TDD.** Le workflow `dev-story` impose un cycle red-green-refactor. La story l'interdit explicitement (aucun framework de test, tests planifiés en Story 4.15, AD-17 ne couvre pas le socle, NFR-10 proscrit tout outil supplémentaire). J'ai tranché en faveur de la story, ce que les règles du workflow commandent elles-mêmes : le fichier de story est désigné « authoritative implementation guide », implémenter hors tâche est interdit, et une dépendance hors spécification déclenche un HALT. La vérification est donc exécutable et manuelle, comme prescrit.

**Le point de vigilance de la story est levé.** Obligation faite de vérifier `@supabase/ssr` 0.12.3 avant d'écrire les clients : fait, en comparant les `types.d.ts` de 0.10.2 (récupéré via `npm pack`) et 0.12.3. **`GetAllCookies` et `SetAllCookies` sont identiques au caractère près.** Le bond de deux versions mineures est sans rupture pour notre usage. À noter pour éviter une fausse alerte : `GetAllCookies` *paraît* retourner une `Promise` en lecture rapide, mais c'est une union qui accepte aussi le retour synchrone — comportement inchangé depuis 0.10.

**Deux ajouts hors liste de tâches, à valider en revue :**

1. **`app/login/page.tsx`** — page d'attente minimale. Sans elle, la redirection de l'AC3 pointerait vers une route inexistante et l'AC ne serait pas vérifiable de bout en bout. Elle ne préempte pas la Story 1.2 : aucun formulaire, aucun appel d'authentification, juste une destination réelle. **Story 1.2 la remplace intégralement.**
2. **Portée d'`eslint.config.mjs` restreinte** — le flat config du scaffold analysait `_bmad/**` et remontait 13 erreurs sur de l'outillage qui n'est pas du code applicatif. J'ai ajouté les ignores correspondants et `argsIgnorePattern: "^_"` (pour le paramètre `_headers` intentionnellement inutilisé). Ce n'est pas construire une configuration de lint — c'est rendre utilisable celle que le scaffold fournit.

**Le problème du lint cassé est résolu par effet de bord.** Le prototype avait un `lint` doublement mort (`next lint` supprimé de Next 16, aucune config alors qu'ESLint 10 exige le flat config). Le scaffold fournit `eslint.config.mjs` et un script `eslint` : `npm run lint` passe. **Question 3 de la story sans objet.**

> ⚠️ **Justification corrigée en revue (2026-07-26), après vérification empirique.** Ce paragraphe affirmait avoir retenu ESLint **9.39.5** parce que « `eslint-config-next@16.2.12` est apparié avec la 9 ». **Cette raison était fausse** : la peer dependency réelle est `eslint: ">=9.0.0"`, qui autorise la 10.
>
> Mais le choix, lui, est **correct** — pour une autre raison, découverte en tentant le retour à la 10 : `eslint-config-next@16.2.12` embarque `eslint-plugin-react@7.37.5`, incompatible avec l'API de contexte d'ESLint 10. Mesuré :
>
> ```
> TypeError: Error while loading rule 'react/display-name':
> contextOrFilename.getFilename is not a function
>   at eslint-plugin-react/lib/util/version.js:31
> ```
>
> **Avec ESLint 10, `npm run lint` sort en code 2 et ne lint rien du tout.** La ligne 9 est donc imposée par l'amont, pas par un choix discutable. Le bump du commit `66303d0` vers la 10 était en réalité déjà cassé — il n'a jamais pu tourner puisque le projet n'avait alors aucune configuration ESLint.
>
> **Conséquence à assumer, mesurée dans les deux sens :** ESLint 9 → lint fonctionnel, **13 vulnérabilités** (dont 8 via le `minimatch@3.x` des plugins de `eslint-config-next`). ESLint 10 → **5 vulnérabilités**, lint inopérant. Toutes sont en `devDependencies`, jamais expédiées en production. Un lint qui fonctionne l'emporte. **À revisiter dès que `eslint-config-next` embarquera un `eslint-plugin-react` compatible ESLint 10.**

**Ce qui n'a pas pu être observé.** La moitié « en-têtes anti-cache » de l'AC4 est implémentée conformément à l'exemple documenté par la librairie elle-même, et le typage à deux paramètres est validé par `tsc`. Mais ces en-têtes ne sont posés **que lorsqu'un cookie d'auth est effectivement écrit**, ce qui suppose une session réelle — impossible avant la Story 1.2. Le `Cache-Control` observé au curl est celui de Next, pas celui de `setAll`. **À vérifier à nouveau en Story 1.2, une fois le magic link en place.** La moitié `await cookies()` est, elle, bien vérifiée : un appel synchrone échouerait au typecheck.

**Écarts entre le scaffold et AR-STACK, corrigés.** `create-next-app` produit `react 19.2.4` (AR-STACK dit 19.2.8), `typescript ^5` (il faut 6.0.3) et des plages `^` alors que le dépôt épingle en exact. Le `package.json` a été réécrit à la main sur les versions exactes vérifiées via `npm view` le 2026-07-26. `autoprefixer` et `postcss` sont abandonnés : Tailwind 4 les intègre, et le scaffold ne les liste pas.

**Retraits et ajouts par rapport au scaffold.** Retirés : les webfonts Geist (Google Fonts — NFR-10/NFR-11, et l'hypothèse webfont de DESIGN.md n'est pas tranchée) et `lang="en"` → `lang="fr"` (NFR-8). Les assets de marque de Next (`public/*.svg`, `AGENTS.md`, `CLAUDE.md`) n'ont pas été importés.

> ⚠️ **Complété en revue (2026-07-26).** Le retrait des webfonts a été **remplacé** par une pile de polices système écrite en dur dans `body` (`app/globals.css:31-32`) — un *ajout* que ce paragraphe ne déclarait pas, et qui anticipe une décision typographique appartenant à la Story 1.7 (`epics.md#Story-1.7` : « couleurs, **typo**, espacement, arrondis »). De même, `app/layout.tsx:16-17` introduit `h-full antialiased` / `min-h-full flex flex-col`, un embryon de mise en page dont `page.tsx` et `login/page.tsx` dépendent (`flex-1`) — c'est un **troisième** ajout hors liste de tâches, alors que les notes n'en déclaraient que deux. À arbitrer en Story 1.7 ; conservés tels quels pour ne pas changer le rendu maintenant.

**Frontière 1.7 : les interdits sont respectés, mais pas la formulation initiale.**

> ⚠️ **Corrigé en revue (2026-07-26).** Ce paragraphe affirmait que « `globals.css` ne pose aucun token de couleur ». **C'est faux** : le fichier définit quatre valeurs hexadécimales en dur (`#ffffff`, `#171717`, `#0a0a0a`, `#ededed`) et les enregistre comme utilitaires Tailwind via `@theme inline` (`--color-background`, `--color-foreground`). Ce sont bien des tokens. L'*instruction* de la story (« laisse le `globals.css` du scaffold tel quel ») est en revanche respectée — ces lignes sont le défaut de `create-next-app`. Conséquence : la Story 1.7 aura deux tokens à défaire, pas zéro.

Ce qui est vérifié en revanche : `color-scheme: light dark` et `prefers-color-scheme` — **aucun thème unique câblé en dur** (l'anti-pattern nommé par UX-DR1) — et aucun `focus:outline-none` ni `-webkit-tap-highlight-color`.

**Vulnérabilités npm.**

> ⚠️ **Précisé en revue (2026-07-26).** L'affirmation « pas une conséquence de choix faits ici » était trop confortable. La mesure exacte, dans les deux configurations : **13 vulnérabilités avec ESLint 9** (1 basse, 12 hautes), **5 avec ESLint 10** (1 basse, 4 hautes). Huit d'entre elles dépendent donc bien d'un choix — mais ce choix est contraint, ESLint 10 rendant le lint inopérant (voir ci-dessus). Ce n'est pas une fatalité de l'écosystème : c'est un **arbitrage assumé entre un lint fonctionnel et 8 vulnérabilités transitives de dev**.

Détail des 13, toutes en `devDependencies` et donc **jamais expédiées en production** : `brace-expansion` et `minimatch@3.x` via les plugins de `eslint-config-next` (`eslint-plugin-import`, `-jsx-a11y`, `-react`) ; `postcss` et `sharp` tirés par Next ; `@babel/core`. `npm audit` ne propose comme « correctif » que `next@9.3.3` — une rupture majeure absurde. `postcss@8.5.23` est la dernière de sa ligne et reste signalée : aucune version corrigée n'existe. **Story de maintenance quand l'amont bougera.**

**Prototype préservé.** Tag annoté `prototype-2026-05-02` sur `7e1a249`. Consultable par `git show prototype-2026-05-02:<chemin>`.

### File List

_Corrigée en revue (2026-07-26) : trois entrées étaient mal classées — `client.ts` et `server.ts` annoncés « réécrits intégralement » alors qu'il s'agit de modifications ciblées, et `app/login/page.tsx` classé « Nouveau » alors que le fichier préexistait._

**Nouveaux** (aucune version antérieure dans `7e1a249`)
- `proxy.ts`
- `lib/supabase/proxy.ts`
- `next.config.ts`
- `eslint.config.mjs`

**Modifiés**
- `lib/supabase/server.ts` — passage en `async` + `await cookies()`, signature `setAll` à deux paramètres, JSDoc (~10 lignes touchées sur 40)
- `lib/supabase/client.ts` — **4 lignes de JSDoc ajoutées**, corps inchangé au caractère près
- `app/login/page.tsx` — contenu intégralement remplacé (le prototype y avait un formulaire mot de passe), mais le fichier existait déjà
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css` — contenu intégralement remplacé
- `package.json`, `package-lock.json`
- `tsconfig.json`, `postcss.config.mjs`

**Supprimés**
- `middleware.ts`, `tailwind.config.ts`, `next.config.mjs`
- `lib/supabase/middleware.ts`, `lib/supabase/queries.ts`
- `app/(app)/` — 20 fichiers (aisles, grocery, menu, recipes, layout)
- `app/auth/callback/route.ts`, `app/login/LoginForm.tsx`, `app/onboarding/` (2), `app/signup/page.tsx`
- `components/SignOutButton.tsx`

**Inchangés, conservés**
- `supabase/migrations/20260502000000_initial_schema.sql` — **base déployée, non touchée**
- `lib/dates.ts`, `lib/supabase/types.ts`
- `.env.local`, `.env.local.example`, `.gitignore`, `.node-version`

## Change Log

| Date | Changement |
|---|---|
| 2026-07-25 | Story créée sous le titre « Débloquer la construction de l'application » (approche réparation) |
| 2026-07-26 | Story redéfinie en « Poser le socle applicatif Next 16 » — Sprint Change Proposal du 2026-07-26 |
| 2026-07-26 | Implémentation : scaffold Next 16.2.12 neuf, prototype retiré (tag `prototype-2026-05-02`), clients Supabase et contrôle d'accès `proxy.ts` posés. Statut → `review` |
| 2026-07-26 | Revue de code adversariale (3 couches) : 21 constats retenus. 11 correctifs appliqués — contrôle d'accès durci (correspondance exacte, matcher ancré, cookies et en-têtes préservés sur les redirections, timeout 3 s + bascule hors-ligne), `engines` Node ≥22, `target` ES2022, `strictRouteTypes` activé, 7 inexactitudes du Dev Agent Record corrigées. 10 constats différés dans `deferred-work.md`. Statut → `done` |

---

## Amendement du 2026-07-27 — revue de code Epic 1, passe 1

_Ajouté après coup. La story reste `done` : ce qui suit ne rouvre pas le travail, il empêche la story d'affirmer ce qui s'est révélé faux._

**Les preuves de gating de l'AC3 n'ont jamais rencontré de backend.** La story 1.2 a établi que `NEXT_PUBLIC_SUPABASE_URL` valait littéralement `https://your-project-ref.supabase.co` (NXDOMAIN) pendant toute la durée de cette story : « **l'application n'a jamais été connectée au projet Supabase déployé** ». Les `307` du tableau de vérification venaient donc de la branche `cannotVerify` du proxy, et non de `!user && !isPublic`. Le résultat observé était juste ; **le chemin emprunté n'était pas celui qui était annoncé**. Les huit chemins au curl restent valides comme contrôle du *matcher*, pas comme preuve du contrôle d'accès.

**L'AC3 décrivait trois routes publiques, le code en avait deux.** `epics.md` citait `/login`, `/signup` et `/auth/callback` ; `/signup` n'existait plus. La story avait prescrit l'alignement d'`epics.md` puis a été close sans que la ligne bouge. **Corrigé le 2026-07-27** — `epics.md` liste désormais `/login`, `/auth/callback` et `/auth/bascule`.

**`.github/workflows/ci.yml` a été livré par cette story sans figurer dans aucune tâche, aucun AC, ni la File List.** Constat de méthode, sans action : la CI est documentée depuis la story 1.3 et le README.

**Ce que la revue a trouvé dans le code de cette story** — un open redirect dans `safeNext` contournable par tabulation (corrigé, avec test de régression), un `hasSessionCookie` acceptant le cookie PKCE d'un navigateur jamais authentifié (corrigé, avec test), et une CI épinglée sur Node 22 quand Vercel sert du Node 25 (corrigé). Détail complet : `epic-1-code-review-pass1-infra.md`.
