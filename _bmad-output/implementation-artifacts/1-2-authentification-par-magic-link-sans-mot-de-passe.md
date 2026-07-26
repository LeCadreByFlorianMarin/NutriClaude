---
baseline_commit: c8e8fb54e528e044b93f01633b7ffedeaabe1a32
---

# Story 1.2: Authentification par magic link sans mot de passe

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a membre du foyer,
I want me connecter par un simple lien envoyé par email, sans mot de passe,
so that je n'aie rien à retenir ni à configurer — le test d'acceptation « elle ne configure rien ».

## Acceptance Criteria

**AC1 — Aucun mot de passe, nulle part**
**Given** un socle applicatif sans authentification
**When** l'authentification est réalignée sur Supabase Auth en magic link (AD-11) et le chemin mot de passe retiré
**Then** aucun écran ne demande ni ne crée de mot de passe

**AC2 — Demander un lien**
**Given** un utilisateur qui saisit son email sur l'écran de connexion
**When** il valide
**Then** un email contenant un lien de connexion lui est envoyé, et un message français lui indique d'aller consulter sa boîte (sans jargon technique, NFR-8/NFR-9)

**AC3 — Ouvrir le lien**
**Given** un lien de connexion valide reçu par email
**When** l'utilisateur l'ouvre et que `auth/callback` traite le retour
**Then** il est authentifié et redirigé vers l'application ; un lien expiré ou déjà utilisé affiche un message clair et propose d'en redemander un

**AC4 — La fondation de l'isolation**
**Given** un utilisateur authentifié
**When** sa session est active
**Then** `current_household_id()` résout son foyer depuis son profil (`profiles.id = auth.uid()`), fondation de l'isolation (AD-2)

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.2 — cité verbatim]

> ⚠️ **Lis l'AC4 correctement avant de coder.** `current_household_id()` **existe déjà** en base et **fonctionne déjà**. L'AC4 n'est pas « créer un profil » — c'est **vérifier que la chaîne cookie → session → `auth.uid()` → `profiles` → `household_id` est intacte** une fois l'auth posée. Voir « Le piège n°1 » en Dev Notes : un utilisateur qui vient de se connecter pour la première fois **n'a pas de profil** et `current_household_id()` renvoie `NULL`. C'est l'état **attendu** à la fin de cette story ; la Story 1.3 le résout. **N'invente pas de trigger, de RPC ni d'écran d'onboarding pour combler ce trou.**

## Tasks / Subtasks

- [ ] **Task 0 — Prérequis de configuration Supabase (hors code, à faire AVANT de tester)** (AC: 2, 3)
  - [ ] Dans le tableau de bord Supabase → **Authentication → URL Configuration** : renseigner `Site URL` (l'URL de production Vercel) et ajouter aux **Redirect URLs** les motifs `http://localhost:3000/**` et `https://<domaine-prod>/**` (+ `https://*-<scope>.vercel.app/**` pour les previews). **Le motif doit être en `/**`** : notre `emailRedirectTo` porte une query string, un motif exact la ferait rejeter
  - [ ] **Vérifier d'abord que les modèles d'email sont éditables** (Authentication → Emails). Si l'éditeur est en lecture seule, le projet n'est pas antériorisé et **toute cette story est bloquée** → voir « Envoi des emails » en Dev Notes, la parade est un SMTP personnalisé. **Constate-le avant d'écrire une ligne de code**
  - [ ] Éditer **les DEUX modèles d'email** (voir Dev Notes « Le piège n°2 ») : *Magic Link* **et** *Confirm sign up*
  - [ ] **Ajouter l'adresse email de la conjointe comme membre de l'organisation Supabase** (Organization → Team). Sans SMTP personnalisé, Supabase **refuse de livrer** à toute adresse hors équipe : sans cette étape, elle ne recevra jamais de lien — et ça ne se verra pas en testant avec le compte de Florian
  - [ ] Prendre acte du plafond de **2 emails/heure par projet** du service par défaut : tenable en usage réel (2 personnes, sessions durables), **serré pendant le développement**. Voir « Envoi des emails » en Dev Notes

- [x] **Task 1 — Écran de connexion** (AC: 1, 2)
  - [x] `app/login/page.tsx` — Server Component. Remplace intégralement la page d'attente actuelle. Lit `searchParams` (**typé `Promise<…>`**, cf. Dev Notes « strictRouteTypes ») pour récupérer `next` et un éventuel code d'erreur, et rend `<LoginForm next={safeNext} error={errorCode} />`
  - [x] `app/login/LoginForm.tsx` — Client Component (`"use client"`). Un champ email + un bouton. **Aucun champ mot de passe, aucun lien « mot de passe oublié », aucune route `/signup`** (AC1)
  - [x] Appelle `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })` via `lib/supabase/client.ts` — **client-direct, pas de Server Action** (AD-13 : les Server Actions sont réduites à l'irréductible serveur, ici le seul irréductible est le callback)
  - [x] `emailRedirectTo` = `` `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` `` — **toujours avec le paramètre `next`**, valant `/` par défaut (le modèle d'email concatène en `&`, il lui faut une query string déjà ouverte)
  - [x] Ne pas passer `shouldCreateUser: false` : la création de compte à la première connexion **est** le parcours d'inscription (FR-40 ; la création du foyer arrive en 1.3)
  - [x] Après envoi, basculer sur un état « va voir ta boîte mail » en français, **sans jargon** (voir « Microcopy imposée »)
  - [x] Gérer les erreurs de `signInWithOtp` **par code, jamais en rendant `error.message` brut** (NFR-8). Cas à couvrir : email invalide, et `over_email_send_rate_limit` (Supabase n'autorise qu'une demande toutes les **60 s**)

- [x] **Task 2 — Validation de `next` (exigence dure, héritée de la revue 1.1)** (AC: 3)
  - [x] Écrire **un seul** utilitaire partagé, par exemple `lib/auth/safe-next.ts`, exportant `safeNext(value: string | undefined): string` qui retourne `value` s'il correspond à `/^\/(?!\/)/`, sinon `"/"`
  - [x] L'appliquer **aux deux extrémités** : sur `app/login/page.tsx` (avant de le mettre dans `emailRedirectTo`) **et** sur `app/auth/callback/route.ts` (avant de rediriger). La valeur revient par l'email : elle est hostile par construction
  - [x] Vérifier que `/login?next=https://evil.com`, `//evil.com` et `/\evil.com` mènent tous à `/` — c'est exactement ce que faisait le prototype (`LoginForm.tsx:11`, `router.replace(next)` sans contrôle). **Ne le recopie pas**

- [x] **Task 3 — Route de retour `/auth/callback`** (AC: 3, 4)
  - [x] `app/auth/callback/route.ts` — Route Handler `GET`. **Chemin imposé : `/auth/callback`**, pas `/auth/confirm` (la documentation Supabase emploie `/auth/confirm` ; ici l'AC3 et l'allowlist `PUBLIC_ROUTES` du proxy nomment `/auth/callback`)
  - [x] Lit `token_hash`, `type` et `next` de l'URL, puis `supabase.auth.verifyOtp({ type, token_hash })` — **`verifyOtp`, pas `exchangeCodeForSession`** (voir Dev Notes « Le piège n°3 » : le choix de flux est *la* décision de cette story)
  - [x] Succès → `NextResponse.redirect(new URL(safeNext(next), request.url))`
  - [x] Échec ou paramètres manquants → `NextResponse.redirect` vers `/login?error=lien-expire`. **Jamais l'`error.message` de Supabase dans l'URL ni à l'écran** — un code, que la page de connexion traduit (NFR-8/NFR-9)
  - [x] **Les en-têtes anti-cache doivent être posés sur la réponse de redirection** (dette explicite de la revue 1.1, NFR-5) — voir Task 4

- [ ] **Task 4 — En-têtes anti-cache dans le Route Handler** (AC: 3)
  - [x] `lib/supabase/server.ts` ignore aujourd'hui le 2ᵉ paramètre `_headers` de `setAll`, avec une justification qui ne vaut **que pour un Server Component**. Un **Route Handler**, lui, peut écrire des en-têtes — et `/auth/callback` est précisément la réponse qui pose le cookie de session
  - [x] Exposer une fabrique dédiée au Route Handler (dans `lib/supabase/server.ts`) qui **capture** les en-têtes fournis par `setAll` et permet de les appliquer sur la réponse retournée. Ne pas les écrire en dur : ils doivent venir du 2ᵉ paramètre
  - [x] Laisser `createClient()` (Server Component) **inchangée**, `_headers` compris, avec son commentaire — la raison qui l'y justifie est toujours vraie
  - [ ] **Vérifier empiriquement** que la redirection 307 de `/auth/callback` porte **à la fois** le `set-cookie` de session **et** les trois en-têtes. Les mutations de `cookies()` d'un Route Handler devraient être fusionnées par Next sur la réponse retournée — **mesure-le, ne le suppose pas**. Si le `set-cookie` manque, pose les cookies directement sur l'objet réponse. C'est le motif exact de bug trouvé en revue 1.1 sur les redirections du proxy → *mécanisme prouvé par sonde ; le tir réel sur `/auth/callback` exige une session, donc `.env.local` renseigné. **Bloqué**, voir Completion Notes*

- [ ] **Task 5 — Cohérence du contrôle d'accès** (AC: 3)
  - [x] `lib/supabase/proxy.ts` : `PUBLIC_ROUTES` liste déjà `["/login", "/auth/callback"]` en correspondance **exacte**. Vérifier qu'aucune des deux routes n'est désormais fantôme (c'était un constat de revue en 1.1) — les deux existent après cette story, **il n'y a rien à modifier**. Ne rajoute pas `/signup`
  - [ ] Vérifier que l'exemption `pathname !== "/auth/callback"` fonctionne réellement : un utilisateur **déjà** authentifié qui ouvre un lien de connexion doit atteindre le Route Handler, **pas** être renvoyé à `/` → *exige une session. **Bloqué***
  - [x] `/login` étant en correspondance exacte, `/login?next=…` passe (la query ne fait pas partie du pathname) — le confirmer au curl

- [x] **Task 6 — Confirmer le rendu dynamique** (AC: 4)
  - [x] Dette explicite de la revue 1.1 : confirmer, **sans ajouter `export const dynamic = "force-dynamic"`** (interdit par AD-13), qu'aucune page lisant la session n'est prérendue en statique. Preuve = la sortie de `next build` (`ƒ` dynamique / `○` statique)
  - [x] `/login` peut légitimement rester statique : c'est une coquille dont le formulaire est client. `/auth/callback` est un Route Handler, toujours dynamique. Écrire la conclusion dans le Dev Agent Record

- [ ] **Task 7 — Vérifier l'AC4 de bout en bout** (AC: 4)
  - [ ] Vérifier la chaîne **sans écrire de profil** : se connecter, puis exécuter `select auth.uid(), current_household_id();` **avec la session du navigateur** (client Supabase du navigateur, ou requête PostgREST portant le jeton de session — jamais avec la clé de service, AD-2)
  - [ ] Résultat attendu pour un utilisateur **neuf** : `auth.uid()` renvoie l'uuid, `current_household_id()` renvoie **`NULL`**. **C'est le succès**, pas un échec — il n'existe aucun trigger créant `profiles`, et c'est la Story 1.3 qui le crée
  - [ ] Vérifier le cas positif en insérant **manuellement** (via le tableau de bord, hors code applicatif, hors migration) un `households` + un `profiles` pour cet utilisateur, puis reconstater que `current_household_id()` renvoie bien l'uuid du foyer. **Cette insertion est un artefact de test : ne la commite pas, ne la transforme pas en migration** (AR-MIGRATIONS)

- [ ] **Task 8 — Vérification** (AC: 1, 2, 3, 4)
  - [x] `npm run typecheck` → 0 erreur · `npm run lint` → 0 erreur · `npx next build` → succès sans avertissement
  - [x] Grep de non-régression : aucune occurrence de `signInWithPassword`, `password`, `signUp(` dans `app/` et `lib/` (AC1)
  - [x] Grep des mots bannis dans les chaînes rendues : `synchronis`, `jeton`, `token`, `API`, `MCP`, `pont`, `Supabase`, `RLS`, `cache` (NFR-9)
  - [ ] Parcours manuel complet : `/menu` anonyme → `/login?next=%2Fmenu` → saisie email → message « va voir ta boîte » → clic sur le lien reçu → arrivée sur `/menu` authentifié → *moitié anonyme vérifiée au curl ; à partir de la saisie d'email, **bloqué** (Task 0 + `.env.local`)*
  - [ ] Parcours d'échec : rouvrir **le même lien** une seconde fois → `/login?error=lien-expire` avec un message français et la possibilité d'en redemander un → *la branche de rejet est vérifiée au curl avec un jeton bidon ; le rejeu d'un **vrai** lien reste **bloqué***
  - [x] `git status --short supabase/` vide (AC2 de la story 1.1, toujours vrai : **aucune migration dans cette story**)

## Dev Notes

### Ce que cette story est, et n'est pas

Elle pose **le seul chemin d'entrée humain** du produit. À la fin, un humain peut se connecter — et c'est tout. Il n'a **pas** de foyer, donc **aucune donnée** ne lui est accessible (la RLS y veille : toutes les politiques sont ancrées sur `current_household_id()`, qui vaut `NULL`). L'application authentifiée reste la page d'accueil minimale du socle.

**Hors périmètre, à ne surtout pas préempter :**

| N'implémente pas | Appartient à |
|---|---|
| Création de foyer / de profil, RPC `create_household_with_profile`, écran d'onboarding | **Story 1.3** |
| Code d'invitation (`generate_household_invite`) | **Story 1.4** |
| Rejoindre un foyer (`redeem_household_invite`) | **Story 1.5** |
| Écran profil, prénom affiché, liste des membres | **Story 1.6** |
| Tokens de couleur, thème clair/sombre, `error.tsx`, `not-found.tsx` | **Story 1.7** |
| Framework de test | **Story 4.15** |

### Le piège n°1 — `current_household_id()` renvoie `NULL` après la première connexion

Fait vérifié dans le schéma déployé :

```sql
-- supabase/migrations/20260502000000_initial_schema.sql:30-56
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete restrict,
  display_name text not null,
  …
);

create or replace function current_household_id() … as $$
  select household_id from profiles where id = auth.uid()
$$;
```

**Il n'existe AUCUN trigger sur `auth.users` créant une ligne `profiles`.** Vérifié : les seuls triggers du schéma sont `profiles_updated_at` et `recipes_updated_at`. Les deux seules fabriques de profil sont les RPC `create_household_with_profile` et `redeem_household_invite` — **stories 1.3 et 1.5**, et toutes deux lèvent `Profile already exists` si un profil existe déjà.

Conséquences pour toi :

1. **N'ajoute pas de trigger `handle_new_user`.** C'est le réflexe le plus courant des tutoriels Supabase, et ici il serait faux : `profiles.household_id` est `not null`, il n'existe aucun foyer par défaut à rattacher, et il court-circuiterait la logique de 1.3/1.5. Ce serait de surcroît une migration, interdite ici (AR-MIGRATIONS).
2. **Ne fais échouer aucune page** parce que le profil est absent. « Authentifié sans foyer » est un état légitime pendant tout l'intervalle 1.2 → 1.3.
3. Le proxy laisse aujourd'hui passer toute session valide, profil ou pas. La garde d'appartenance au foyer (ex-`requireProfile()`) est **explicitement différée aux stories 1.3+** ; ne la rétablis pas ici, il n'y aurait rien à garder.

### Le piège n°2 — `signInWithOtp` sur un email inconnu n'envoie PAS le modèle « Magic Link »

`shouldCreateUser` vaut `true` par défaut : un email inconnu déclenche une **inscription**, et Supabase envoie alors le modèle **« Confirm sign up »**, pas le modèle « Magic Link ». Si tu n'édites qu'un seul des deux, **la première connexion de chaque personne est cassée** — c'est-à-dire exactement le parcours de Florian, puis exactement celui de sa conjointe. Le bug ne se voit pas en re-testant avec ton propre compte, déjà créé.

Les deux modèles doivent devenir :

```html
<!-- Authentication → Emails → Magic Link -->
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">Se connecter à NutriClaude</a></p>

<!-- Authentication → Emails → Confirm sign up -->
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Se connecter à NutriClaude</a></p>
```

- `{{ .RedirectTo }}` porte notre `emailRedirectTo`, **query string comprise** — d'où le `&` de concaténation, et d'où l'obligation que `emailRedirectTo` contienne **toujours** `?next=…` (sinon l'URL produite est invalide).
- `type` est écrit **en dur et différemment dans chaque modèle** : c'est la seule façon fiable de le transmettre, et `verifyOtp` refuse un `type` qui ne correspond pas au jeton.
- Le libellé du lien respecte le ton : pas de « magic link », pas d'anglais.

`EmailOtpType` (vérifié dans `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:693`) vaut `'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | (string & {})`. **Le `(string & {})` final fait que TypeScript accepte n'importe quelle chaîne** : le typage ne te protégera pas d'un `type` bidon venu de l'URL. Valide-le explicitement contre la liste `['magiclink', 'signup']` avant de le passer à `verifyOtp`.

### Le piège n°3 — `verifyOtp` et non `exchangeCodeForSession` : la décision structurante

Deux flux sont possibles, et l'immense majorité des exemples en ligne mélange les deux.

| | **PKCE — `?code=` + `exchangeCodeForSession`** | **`token_hash` + `verifyOtp`** ✅ retenu |
|---|---|---|
| Modèle d'email | `{{ .ConfirmationURL }}` par défaut | à éditer (ci-dessus) |
| Lien ouvert sur un **autre appareil** que celui qui l'a demandé | **échoue** — le `code_verifier` est stocké dans le navigateur émetteur | **fonctionne** |
| Recommandation Supabase pour l'auth côté serveur | — | oui |

**Le critère décisif est le multi-appareil.** Florian demande un lien depuis son ordinateur et l'ouvre sur son téléphone ; sa conjointe reçoit l'invitation sur un appareil et la consulte sur un autre. Avec PKCE, ces parcours échouent en silence avec un message incompréhensible — c'est-à-dire l'échec direct du test d'acceptation « elle ne configure rien ». **`token_hash` est donc imposé, et avec lui l'édition des deux modèles d'email de la Task 0.**

Le coût assumé : la configuration vit **hors du dépôt**, dans le tableau de bord Supabase. Documente-la dans le Dev Agent Record — c'est le seul endroit où elle sera retrouvable.

### Le piège n°4 — les scanners d'emails consomment les liens à usage unique

Certains fournisseurs et passerelles de sécurité **préchargent** les URL des emails entrants. Un lien Supabase étant à usage unique, il peut être consommé avant même le clic de l'utilisateur, qui voit alors « lien déjà utilisé ». Le phénomène est massif en environnement d'entreprise, marginal sur Gmail/iCloud personnels.

**Ne construis pas de parade dans cette story** (page intermédiaire, jeton dans le fragment d'URL) : rien ne la prescrit, et le foyer cible est sur des boîtes personnelles. Mais l'AC3 exige déjà le message clair et le « redemande un lien » — **c'est justement cette porte de sortie qui rend le phénomène supportable**. Traite-la sérieusement : c'est le vrai chemin d'échec du produit, pas un cas limite théorique.

### Les trois dettes de la revue 1.1 que cette story doit solder

Elles sont écrites dans `deferred-work.md` comme des **exigences dures**, pas des suggestions :

1. **Valider `next`** avant toute redirection (Task 2) — sans quoi `/login?next=https://evil.com` devient un open redirect exploitable dès que le `next` est consommé.
2. **En-têtes anti-cache dans le Route Handler** (Task 4) — sans quoi la réponse qui pose le cookie de session est cachable par le CDN Vercel, et la session d'un membre peut être servie à un autre (NFR-5).
3. **Confirmer le rendu dynamique** (Task 6) — sans ajouter `force-dynamic`, interdit par AD-13.

La quatrième (« rétablir `PUBLIC_ROUTES` en cohérence ») **est déjà soldée** : les correctifs de revue ont retiré `/signup` et l'allowlist ne contient plus que `/login` et `/auth/callback`. Task 5 ne fait que le constater.

### Décision tranchée : garder `getUser()` dans le proxy

Le hors-périmètre de la Story 1.1 renvoyait à cette story l'arbitrage `getClaims()` vs `getUser()`. **Verdict : ne touche pas à `lib/supabase/proxy.ts`.**

- `getClaims()` ne vérifie le JWT localement (WebCrypto, sans appel réseau) **que si le projet a activé les clés de signature asymétriques**. Sinon il interroge le serveur d'auth exactement comme `getUser()` : zéro gain, et un changement de comportement gratuit.
- Le proxy actuel contient une gestion de panne à **trois formes** (timeout 3 s, `AuthRetryableFetchError` retourné sans lever, exception) écrite et **mesurée empiriquement** en revue 1.1. La remplacer invaliderait cette vérification et rouvrirait le risque de déconnecter tout le foyer à la moindre panne réseau.
- `getClaims()` ne détecte pas une session révoquée avant l'expiration du JWT (jusqu'à 1 h).

À revisiter le jour où les clés asymétriques seront activées sur le projet — pas ici.

### Piège de typage — `searchParams` est une `Promise`

`experimental.strictRouteTypes: true` est **actif** (`next.config.ts`, posé en revue 1.1). En Next 16, `params` et `searchParams` sont asynchrones :

```tsx
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  …
}
```

Bonne nouvelle : grâce à `strictRouteTypes`, une erreur ici **est détectée au build** au lieu de produire un `undefined` silencieux à l'exécution. C'est la première story qui en bénéficie.

### Microcopy imposée (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier, aucun jargon. **Mots bannis à l'écran :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache. « magic link » est de la même famille : ne l'écris pas à l'écran.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Invite de saisie | « Ton adresse email » | « Identifiant » |
| Bouton | « Envoie-moi un lien » | « Envoyer le magic link » |
| Après envoi | « C'est parti. Va voir ta boîte mail, le lien t'attend. » | « Email envoyé avec succès » |
| Lien expiré / déjà utilisé | « Ce lien n'est plus bon. On t'en envoie un autre ? » | « Token expired / OTP invalide » |
| Trop de demandes (60 s) | « Attends une minute avant d'en redemander un. » | « 429 rate limit exceeded » |
| Email refusé | « Cette adresse n'a pas l'air valide. » | l'`error.message` brut |

### Frontière Story 1.7 — ce que tu peux et ne peux pas styler

Le système de tokens de `DESIGN.md` arrive en **Story 1.7**. `globals.css` n'a aujourd'hui que quatre valeurs en dur héritées du scaffold et **aucune couche de composants** (`.btn`, `.input`, `.card` ont disparu avec le prototype, sans remplaçant — dette tracée).

Tu vas donc devoir écrire des classes utilitaires Tailwind ad hoc pour le champ et le bouton. **C'est attendu et assumé.** Trois interdits fermes, qui survivront à la 1.7 :

- **Aucun thème câblé en dur** — ni `color-scheme: dark`, ni fond fixe (UX-DR1)
- **Aucune couleur d'accent, aucun rouge d'erreur** — la palette n'existe pas encore, et le rouge d'erreur est banni du produit (UX-DR1/UX-DR2). Le message d'erreur se distingue par le texte, pas par la couleur
- **Anneau de focus visible sur le champ et le bouton** — jamais `outline-none` ni `-webkit-tap-highlight-color: transparent` sans remplacement (UX-DR11, finding `[high]` de la revue d'accessibilité). En Tailwind 4, l'équivalent de l'ancien `outline-none` est `outline-hidden` : n'utilise ni l'un ni l'autre ici

Cibles tactiles **≥ 44px** sur le champ et le bouton (UX-DR11). `<html lang="fr">` est déjà posé.

### Contraintes d'architecture applicables

- **AD-11** — magic link, sans mot de passe. Invariant **produit**, pas une préférence technique
- **AD-13** — Next = coquille ; Server Actions/Route Handlers réduites à l'irréductible serveur. Ici l'irréductible est **`/auth/callback` et lui seul**. La demande de lien passe par le client navigateur. **N'ajoute pas `export const dynamic = "force-dynamic"`**
- **AD-2** — RLS non contournable, **jamais de `SUPABASE_SERVICE_KEY`**. Aucune vérification de l'AC4 ne doit passer par une clé de service
- **AD-1** — toute règle métier vit en Postgres. Cette story n'introduit **aucune** règle métier en TypeScript
- **AR-MIGRATIONS** — schéma **déployé et gelé**. **Aucune migration.** `git status --short supabase/` doit rester vide
- **Conventions** — `lib/supabase/{client,server,proxy}.ts` (table Consistency Conventions de l'architecture) ; `app/auth/callback/route.ts` est nommément prévu dans l'arborescence source de l'Architecture Spine
- **NFR-5** — isolation appliquée au niveau de la donnée. Le seul lien avec cette story : ne pas casser la chaîne cookies/session dont dépend `auth.uid()`

### Standards de test

**Aucun framework de test dans le dépôt, et il ne faut pas en introduire ici.** Les tests sont planifiés en **Story 4.15** ; AD-17 ne nomme que deux familles (RLS, convergence), et la vérification par magic link n'en relève pas. NFR-10 (« aucun outil en plus ») pousse dans le même sens.

La vérification attendue est **exécutable et manuelle** : `typecheck`, `lint`, `build`, les greps de non-régression, et les deux parcours manuels (succès et lien rejoué) de la Task 8.

⚠️ **Piège d'outillage hérité de la 1.1, toujours valable.** `npm run build 2>&1 | grep …` **ne rend jamais la main** : les workers Turbopack gardent le descripteur de sortie ouvert et `grep` n'atteint jamais l'EOF, alors que le build se termine en ~2 s. **Redirige vers un fichier plutôt que de piper**, ou lance en arrière-plan.

### Project Structure Notes

Arborescence à la fin de cette story (`+` nouveau, `~` modifié) :

```
app/
  layout.tsx                    inchangé
  page.tsx                      inchangé
  globals.css                   inchangé (tokens = Story 1.7)
  login/
    page.tsx              ~     Server Component, lit searchParams
    LoginForm.tsx         +     Client Component, signInWithOtp
  auth/
    callback/route.ts     +     GET, verifyOtp + en-têtes anti-cache
lib/
  auth/safe-next.ts       +     validation du paramètre next
  supabase/
    client.ts                   inchangé — premier importeur réel
    server.ts             ~     + fabrique Route Handler (headers capturés)
    proxy.ts                    INCHANGÉ — voir « garder getUser() »
    types.ts                    inchangé
proxy.ts                        inchangé
supabase/                       INTACT — aucune migration
```

`lib/supabase/client.ts` était jusqu'ici sans aucun importeur (dette tracée en revue 1.1). Cette story lui en donne un : **c'est le moment de vérifier qu'il fonctionne réellement**, il n'a jamais été exécuté.

### Contexte projet

`_bmad-output/project-context.md` est un squelette vide (« _Documented after discovery phase_ ») : aucune règle de code projet supplémentaire à respecter au-delà de ce qui est cité ici.

### Intelligence de la story précédente (1.1)

Enseignements directement réutilisables :

- **Vérifie le comportement réel avant de conclure.** La 1.1 a livré un `Promise.race` correct mais incomplet, parce que `getUser()` **ne lève pas** en cas de panne réseau — il retourne `{ user: null, error }`. La leçon vaut ici : `verifyOtp` et `signInWithOtp` **retournent** `{ data, error }`, ils ne lèvent pas. Un `try/catch` seul ne verra rien passer. **Teste `error` explicitement.**
- **Une redirection ne conserve pas ce qui a été posé ailleurs.** Le bug `[HAUTE]` de la 1.1 : `setAll` posait cookies et en-têtes sur `supabaseResponse`, et les redirections retournaient un `NextResponse.redirect` neuf qui n'en héritait pas. **Toutes les réponses de `/auth/callback` sont des redirections** — c'est exactement le même terrain.
- **Le Dev Agent Record a été corrigé sur 7 points inexacts en revue.** Déclare ce que tu as réellement fait : fichiers *modifiés* vs *créés*, ajouts hors liste de tâches, et ce que tu n'as **pas** pu observer.
- **Écart de méthode assumé — pas de TDD.** Le workflow `dev-story` impose un cycle red-green-refactor ; la story l'interdit explicitement (aucun framework de test, voir « Standards de test »). La story fait autorité.

### Intelligence git

Quatre commits. `c8e8fb5` (`feat(socle): Replace prototype with clean Next 16 foundation (#1)`) est la base de cette story et l'unique commit applicatif réel — les trois autres sont l'initialisation et le prototype abandonné.

- **Convention de message établie : Conventional Commits**, en français après le préfixe, avec un scope (`feat(socle):`). Suis-la.
- **Travail sur branche dédiée puis PR** : `c8e8fb5` est arrivé par la PR #1 depuis `feat/story-1-1-socle-next16`. Reproduis ce schéma.
- Le prototype reste consultable : `git show prototype-2026-05-02:app/login/LoginForm.tsx` montre l'ancien formulaire mot de passe **et** l'open redirect à ne pas recopier. À consulter comme contre-exemple, jamais comme modèle.

### Informations techniques à jour (vérifiées le 2026-07-26)

Versions **installées**, à ne pas bouger dans cette story :

| Paquet | Version | Note |
|---|---|---|
| `next` | 16.2.12 | `experimental.strictRouteTypes: true` actif |
| `react` / `react-dom` | 19.2.8 | |
| `@supabase/ssr` | 0.12.3 | signature `setAll(cookies, headers)` **confirmée** dans `dist/module/types.d.ts` |
| `@supabase/supabase-js` | 2.110.8 | impose Node ≥ 22 (`engines` déjà posé) |
| `typescript` | 6.0.3 | TS 7 volontairement non adopté |
| `eslint` | 9.39.5 | **ne remonte pas en 10** : `eslint-config-next@16.2.12` embarque `eslint-plugin-react@7.37.5`, incompatible avec l'API de contexte d'ESLint 10 — `npm run lint` sort en code 2 et ne lint rien. Mesuré en revue 1.1 |

Faits Supabase Auth vérifiés dans les paquets installés et la documentation courante :

- `verifyOtp({ type, token_hash })` et `exchangeCodeForSession(authCode)` existent tous deux (`auth-js/dist/module/GoTrueClient.d.ts:840` et suivants)
- Un lien est **à usage unique**, expire par défaut en **1 h**, et une nouvelle demande n'est possible qu'après **60 s**
- Le 2ᵉ paramètre de `setAll` porte exactement : `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, `Pragma: no-cache`, avec le commentaire de la librairie : *« Responses that set auth cookies must not be cached by CDNs or reverse proxies, otherwise one user's session token can be served to a different user. »*
### Envoi des emails — le service par défaut suffit, à trois conditions

Décision de Florian : **le foyer compte exactement 2 personnes physiques, on reste sur le service d'email par défaut de Supabase.** Pas de SMTP personnalisé. Trois conséquences à connaître, dont une potentiellement bloquante :

1. **Livraison restreinte à l'équipe du projet.** Sans SMTP personnalisé, Supabase Auth *refuse* de livrer à une adresse qui n'est pas membre de l'organisation. → **L'email de la conjointe doit être ajouté à l'équipe de l'organisation** (Task 0). C'est la seule action requise, et son oubli ne se voit pas en testant avec le compte de Florian.

2. **Plafond de 2 emails/heure par projet**, partagé entre inscriptions, invitations et liens de connexion. En usage réel c'est indolore : deux personnes, des sessions durables, une connexion épisodique. **En développement, c'est serré** — deux essais et tu es bloqué une heure. Organise-toi : vérifie le parcours d'échec (lien rejoué) **avant** de brûler tes demandes, et sers-toi du même lien reçu pour tester plusieurs fois la route de callback. Si le plafond devient réellement le goulot d'étranglement des stories 1.2 → 1.5, **signale-le plutôt que de contourner** : un SMTP personnalisé (Resend, palier gratuit) est une configuration de 5 minutes, mais c'est la décision de Florian, pas la tienne.

3. ⚠️ **Risque à lever en premier — l'édition des modèles d'email.** Depuis le **3 juin 2026**, un **nouveau** projet en palier gratuit sur le service d'email par défaut **ne peut plus modifier ses modèles d'email d'authentification**. Les projets créés **avant** cette date sont antériorisés et conservent l'édition. Ce projet a été créé autour du **2 mai 2026** (migration `20260502000000`, premier commit du 2026-05-02) : il devrait donc être antériorisé — **mais c'est une déduction, pas une mesure**. Or toute la conception de cette story repose sur l'édition des deux modèles (piège n°2). **Ouvre l'éditeur de modèles avant d'écrire du code.** S'il est en lecture seule, arrête-toi et remonte-le : la seule parade est un SMTP personnalisé, et c'est un arbitrage de Florian.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] — user story et 4 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements-Inventory] — FR-40, NFR-5, NFR-8, NFR-9, NFR-10, NFR-11 ; UX-DR1, UX-DR2, UX-DR11, UX-DR12
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1] — frontières des stories 1.3 à 1.7
- [Source: …/architecture/architecture-nutriclaude-2026-07-23/ARCHITECTURE-SPINE.md#Invariants-&-Rules] — AD-1, AD-2, AD-11, AD-13, AD-16, AD-17
- [Source: …/ARCHITECTURE-SPINE.md#Consistency-Conventions] — `lib/supabase/{client,server,proxy}.ts`, forme d'erreur, auth/autorisation
- [Source: …/ARCHITECTURE-SPINE.md#Structural-Seed] — `app/auth/callback/route.ts` prévu dans l'arborescence source
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md#Voice-and-Tone] — tutoiement, mots bannis, tableau à faire / à éviter
- [Source: …/EXPERIENCE.md#Accessibility-Floor] — cibles ≥ 44px, anneau de focus, pas de dépendance à la seule couleur
- [Source: …/DESIGN.md:286] — spécification de l'anneau de focus
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — les trois exigences dures léguées par la revue 1.1
- [Source: _bmad-output/implementation-artifacts/1-1-poser-le-socle-applicatif-next-16.md] — Review Findings, Completion Notes, pièges d'outillage
- [Source: supabase/migrations/20260502000000_initial_schema.sql:30-56, 353-434] — `profiles`, `current_household_id()`, `create_household_with_profile`, `redeem_household_invite` — **schéma déployé, à ne pas toucher**
- **Mesures directes du dépôt (2026-07-26)** : `@supabase/ssr@0.12.3/dist/module/types.d.ts:16-45` (signature `SetAllCookies`) ; `@supabase/auth-js/dist/module/lib/types.d.ts:693` (`EmailOtpType`) ; absence de tout trigger sur `auth.users` dans la migration initiale ; `lib/supabase/proxy.ts:8` (`PUBLIC_ROUTES`) ; `next.config.ts` (`strictRouteTypes`)
- **Documentation Supabase consultée le 2026-07-26** : [Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) · [Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) · [Custom SMTP — livraison restreinte à l'équipe du projet](https://supabase.com/docs/guides/auth/auth-smtp) · [changelog du 2026-06-03 — édition des modèles d'email en palier gratuit](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) · [discussion #28947 — `signInWithOtp` envoie le modèle « Confirm signup »](https://github.com/orgs/supabase/discussions/28947) · [discussion #41618 — liens consommés par les scanners d'emails](https://github.com/orgs/supabase/discussions/41618)

## Questions pour Florian

1. ~~**Envoi des emails / SMTP personnalisé ?**~~ — **tranché le 2026-07-26 : on fait simple, le foyer compte 2 personnes physiques, on reste sur le service d'email par défaut.** L'unique action qui en découle est d'ajouter l'email de la conjointe à l'équipe de l'organisation Supabase (Task 0). Le plafond de 2 emails/heure est accepté. **Un point reste à lever par le dev, et il est bloquant s'il tombe mal** : l'édition des modèles d'email est réservée aux projets créés avant le 3 juin 2026 sur le service par défaut. Ce projet date du 2 mai 2026, il devrait passer — à constater dans le tableau de bord avant de coder (voir « Envoi des emails » en Dev Notes).
2. **`supabase gen types`** — question déjà posée en 1.1 et restée ouverte. `lib/supabase/types.ts` est écrit à la main et divergera silencieusement de la base gelée. Sans conséquence ici (aucune table lue), mais la Story 1.3 sera la première à en souffrir. Story de maintenance dédiée ?
3. **Parade aux scanners d'emails** — hors périmètre ici (piège n°4), et le message « redemande un lien » suffit pour des boîtes personnelles. À réveiller si tu constates réellement des liens consommés avant ton clic.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code) — 2026-07-26

### Debug Log References

Vérifications exécutées, toutes reproductibles :

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | succès, **aucun avertissement**, `✓ strictRouteTypes`, `ƒ Proxy (Middleware)` |
| `git status --short supabase/` | vide — base non touchée |

**Contrôle d'accès et route de retour** (serveur de développement, curl anonyme) :

| Requête | Résultat |
|---|---|
| `/` | `307 → /login?next=%2F` |
| `/menu` | `307 → /login?next=%2Fmenu` |
| `/menu?week=2026-01-05` | `307 → /login?next=%2Fmenu%3Fweek%3D2026-01-05` — query encapsulée |
| `/login` · `/login?next=%2Fmenu` | `200` — correspondance exacte, la query ne gêne pas |
| `/login/foo` | `307` — toujours protégé |
| `/auth/callback` (sans paramètre) | `307 → /login?error=lien-expire` |
| `/auth/callback?token_hash=bogus&type=magiclink` | `307 → /login?error=lien-expire` |
| `/auth/callback?token_hash=bogus&type=signup` | `307 → /login?error=lien-expire` |
| `/auth/callback?token_hash=bogus&type=recovery` | `307 → /login?error=lien-expire` — type non émis, rejeté avant tout appel |
| `/auth/callback?type=magiclink` (sans `token_hash`) | `307 → /login?error=lien-expire` |

**Validation de `next`**, lue dans la charge utile réellement rendue à la page :

| `?next=` | Valeur reçue par le formulaire |
|---|---|
| `https://evil.com` | `/` |
| `//evil.com` | `/` |
| `/\evil.com` | `/` |
| `/menu` | `/menu` |

*Note : la chaîne `evil.com` apparaît une fois dans le HTML, uniquement dans l'état de routeur que Next sérialise lui-même (champs `c` et `q` de la charge Flight, écho de l'URL courante). Elle n'est ni une destination, ni un `href`, ni consommée par notre code.*

**Rendu dynamique** (`next build`), sans aucun `force-dynamic` :

```
┌ ○ /                 (statique — ne lit rien)
├ ○ /_not-found
├ ƒ /auth/callback    (Route Handler)
└ ƒ /login            (dynamique : `await searchParams`)
```

Conclusion de la Task 6 : `/login` est **dynamique**, contrairement à ce que la story anticipait — l'`await searchParams` suffit à l'y basculer. Aucune page authentifiée n'est prérendue. La dette est soldée sans toucher à `next.config.ts`.

⚠️ **Piège d'outillage confirmé (hérité de la 1.1).** `npm run build | grep …` ne rend jamais la main. Toutes les commandes ci-dessus ont été redirigées vers un fichier.

### Completion Notes List

**Ce qui est livré : les tasks 1, 2, 3 et 6 en entier, les tasks 4, 5 et 8 en partie. Les tasks 0 et 7 ne sont pas commencées.** Deux verrous, tous deux hors de portée d'un agent, détaillés plus bas.

**Le verrou n°1 — `.env.local` contient encore les valeurs d'exemple.** Découvert en tentant de vérifier l'AC4 : `NEXT_PUBLIC_SUPABASE_URL` vaut littéralement `https://your-project-ref.supabase.co` (NXDOMAIN) et la clé vaut `your-anon-key`. **L'application n'a jamais été connectée au projet Supabase déployé.**

Conséquence rétrospective à connaître : les vérifications de gating de la Story 1.1 passaient pour une raison **voisine mais différente** de celle annoncée. Sans backend joignable, `getUser()` échoue, le proxy bascule en « session non vérifiable », ne trouve aucun cookie de session et redirige — le résultat observé était juste, le chemin emprunté n'était pas celui d'un vrai « pas de session ». Cela ne remet pas en cause le code de la 1.1, mais **aucune session n'a jamais existé sur ce dépôt**, ce qui explique que les deux dettes soldées ici n'aient pu être observées plus tôt.

**Le verrou n°2 — la configuration du tableau de bord Supabase (Task 0).** Hors de portée : pas d'accès. Les quatre points restent entiers, et l'un d'eux peut invalider la conception (édition des modèles d'email).

**Le point de vigilance de la story est levé — par une mesure, pas par une supposition.** La story exigeait de *mesurer* que le `set-cookie` survit sur un `NextResponse.redirect` construit à la main dans un Route Handler, plutôt que de le supposer. Une sonde temporaire reproduisant exactement la forme de `/auth/callback` (cookie posé via `cookies()`, en-tête posé sur la réponse, redirection construite à la main) a rendu :

```
HTTP/1.1 307 Temporary Redirect
location: http://localhost:3000/
set-cookie: probe-cookie=valeur; Path=/
x-probe-header: pose
```

**Les deux survivent.** Next fusionne bien les mutations de `cookies()` sur la réponse retournée, et les en-têtes posés directement sont conservés. Aucun contournement n'est nécessaire : `createRouteHandlerClient` + `applyAuthHeaders` sont la bonne forme. La sonde et l'allowlist temporaire qui la rendait joignable ont été retirées — `git diff` sur `lib/supabase/proxy.ts` est vide, le fichier est **rigoureusement identique** à `c8e8fb5`.

**Ce qui n'a pas pu être observé, et qui doit l'être avant de clore la story.** La sonde prouve le *transport* : si `setAll` pose un cookie, il arrive. Elle ne prouve pas le *déclenchement* : que `verifyOtp` réussisse et appelle réellement `setAll` avec ses trois en-têtes. C'est exactement la moitié d'AC4 que la Story 1.1 avait déjà dû laisser en suspens, pour la même raison — il faut une session réelle. **C'est le seul angle mort de sécurité restant (NFR-5), et c'est la première chose à mesurer une fois les verrous levés.**

**Trois écarts assumés par rapport à la lettre de la story, tous déclarés :**

1. **`safeNext` rejette aussi la barre oblique inversée.** La story prescrit `/^\/(?!\/)/` ; l'implémentation est `/^\/(?![/\\])/`. Motif : plusieurs navigateurs normalisent `/\evil.com` en `//evil.com`, ce que la regex de la story laisserait passer. Vérifié : les trois formes hostiles retombent bien sur `/`. **Plus strict que demandé, jamais moins.**
2. **Un message d'échec de plus que la table de microcopy.** `email_address_not_authorized` (l'adresse n'est pas rattachée au projet) reçoit « Cette adresse n'est pas encore autorisée pour NutriClaude. » Sans ce cas, la toute première tentative de la conjointe afficherait « Ça n'a pas marché », message qui n'oriente vers rien. C'est précisément l'écueil que le service d'envoi par défaut rend probable.
3. **`next` n'est pas conservé sur le chemin d'échec.** La story prescrit littéralement `/login?error=lien-expire`, suivi à la lettre. Conséquence mineure : après un lien expiré, la reconnexion ramène à l'accueil et non à la destination initialement visée. Trivial à ajouter (`safeNext` a déjà validé la valeur) — laissé tel quel pour ne pas dévier de la spécification sans mandat.

**Écart de méthode assumé — pas de TDD.** Le workflow `dev-story` impose un cycle red-green-refactor. La story l'interdit explicitement : aucun framework de test dans le dépôt, tests planifiés en Story 4.15, AD-17 ne couvre pas ce périmètre, NFR-10 proscrit tout outil supplémentaire. La story fait autorité — c'est ce que le workflow commande lui-même en la désignant comme guide d'implémentation. La vérification est donc exécutable et manuelle, comme prescrit. **Aucune dépendance n'a été ajoutée** : `package.json` est inchangé.

**Style et frontière 1.7.** Le champ et les deux boutons utilisent des utilitaires Tailwind neutres (`border-current/30`, `min-h-11` = 44px, `focus-visible:outline-2 outline-offset-2 outline-current`). Aucun token de couleur, aucun thème câblé, aucun rouge : le message d'échec ne se distingue que par le texte. Vérifié par grep : aucun `outline-none`, aucun `outline-hidden`, aucun `tap-highlight`. Ces classes ad hoc sont la dette annoncée par la story, à reprendre en 1.7.

**Sur l'AC4.** Le raisonnement de la story est confirmé côté schéma : la migration déployée ne contient que deux triggers (`profiles_updated_at`, `recipes_updated_at`), donc **aucun** ne crée de `profiles`. Aucun trigger n'a été ajouté, aucune migration écrite. La vérification exécutable de la chaîne `auth.uid()` → `profiles` → `household_id` reste **entièrement à faire** (Task 7).

### File List

**Nouveaux**
- `lib/auth/safe-next.ts`
- `app/login/LoginForm.tsx`
- `app/auth/callback/route.ts`

**Modifiés**
- `app/login/page.tsx` — contenu intégralement remplacé (la page d'attente du socle disparaît)
- `lib/supabase/server.ts` — ajout de `createRouteHandlerClient()` ; `createClient()` **inchangée**, `_headers` et commentaire compris

**Inchangés, vérifiés**
- `lib/supabase/proxy.ts`, `proxy.ts` — `git diff` vide (une allowlist temporaire y a été posée pour une sonde, puis retirée)
- `lib/supabase/client.ts` — premier importeur réel, mais code inchangé
- `package.json`, `package-lock.json` — **aucune dépendance ajoutée**
- `next.config.ts`, `tsconfig.json`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- `supabase/migrations/` — **aucune migration**

## Change Log

| Date | Changement |
|---|---|
| 2026-07-26 | Story créée. Statut → `ready-for-dev` |
| 2026-07-26 | Question 1 tranchée par Florian (« on fait simple, 2 utilisateurs physiques ») : service d'email par défaut conservé, pas de SMTP personnalisé. Task 0 précisée (ajout de la conjointe à l'équipe de l'organisation, vérification préalable de l'éditeur de modèles) |
| 2026-07-26 | Implémentation : écran de connexion, validation de `next`, route `/auth/callback` en `verifyOtp`, fabrique de client Route Handler avec report des en-têtes anti-cache. Tasks 1, 2, 3, 6 complètes ; 4, 5, 8 partielles ; 0 et 7 bloquées (configuration Supabase absente + `.env.local` en valeurs d'exemple). Statut maintenu `in-progress` |
