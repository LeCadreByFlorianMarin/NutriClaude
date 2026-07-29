# Revue de code — Epic 1, passe 1/3 : infrastructure & accès aux données

_Date : 2026-07-27 · Baseline `66303d0` → `b25b17a` (`feat/story-1-7-theme`) · 16 fichiers, 828 lignes de diff_

**Périmètre.** `lib/supabase/*`, `lib/auth/safe-next.ts`, `proxy.ts`, `app/auth/callback/route.ts`,
`.github/workflows/ci.yml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`,
`postcss.config.mjs`. La migration `20260502000000_initial_schema.sql` n'a pas changé de tout l'Epic 1
(elle vient du squelette `7e1a249`) — elle est lue en contexte, et deux constats la visent malgré tout
parce qu'ils sont la cause racine de findings dans le code.

**Couches de revue exécutées.** Blind Hunter (adversarial), Edge Case Hunter, Acceptance Auditor,
plus les grilles `/tdd`, `/clean-code`, `/clean-architecture`. Aucune couche n'a échoué.

**Note de méthode.** Les constats marqués ✅ **vérifié** ont été reproduits par exécution, pas déduits
d'une lecture. Un constat (l'open redirect) était contredit par une des six couches ; la contradiction
a été tranchée par exécution en faveur des trois couches qui le signalaient.

---

## État : passe 1 close le 2026-07-27

**15 décisions tranchées · 19 correctifs appliqués · 4 requalifiés en report · 5 reports confirmés · 4 écartés.**

Vérification finale : `npm test` **18/18** · `typecheck` ✅ · `lint --max-warnings 0` ✅ · `build` ✅.

**Migrations appliquées en production le 2026-07-28 par Florian** — `20260727154504_restrict_profile_household_update.sql` (gèle `household_id`, NFR-5) et `20260727161200_guard_invite_use_count.sql` (ferme la course sur `redeem_household_invite`). Aucune ne change la forme du schéma : `types.ts` n'avait pas à être régénéré.

### Ce qui a changé dans le code

| Fichier | Nature |
|---|---|
| `lib/auth/safe-next.ts` | open redirect fermé — normalisation avant contrôle |
| `lib/auth/session-cookie.ts` | **nouveau** — prédicat ancré, ne confond plus le cookie PKCE |
| `lib/auth/panne.ts` | **nouveau** — `withTimeout` (avec `clearTimeout`) + détection de panne transport |
| `lib/auth/*.test.ts` ×4 | **nouveaux** — 18 tests, zéro dépendance |
| `lib/supabase/queries.ts` | union discriminée à 4 états dont `inverifiable` ; client en paramètre ; plus aucun import Next |
| `lib/supabase/env.ts` | **nouveau** — nomme la variable manquante au lieu de 500 sur tout le site |
| `lib/supabase/server.ts` | `createClient` → `createServerComponentClient` |
| `lib/supabase/client.ts` | `createClient` → `createNavigateurClient` |
| `lib/supabase/proxy.ts` | `PUBLIC_ROUTES` / `AUTH_ENTRY_ROUTES` séparés ; redirection dédupliquée ; `next` honoré |
| `app/_lib/garde.ts` | **nouveau** — le routage web sort de la couche donnée |
| `app/auth/callback/route.ts` | `try/catch`, journalisation, `type=email` accepté, confirmation de bascule |
| `app/auth/bascule/page.tsx` | **nouveau** — confirmation avant d'écraser une session, sans brûler le jeton |
| `app/foyer/actions.ts` | `seDeconnecter()` ; contrat de retour réparé (`redirect()` le cassait) |
| `app/foyer/page.tsx` | bouton de déconnexion |
| `app/onboarding/page.tsx` | aiguillage sur l'union, ne renvoie plus vers `/login` pendant une panne |
| `next.config.ts` | 4 en-têtes de sécurité |
| `.github/workflows/ci.yml` | étape `Test` · `node-version-file` · annulation limitée aux PR · commentaire corrigé |
| `.github/pull_request_template.md` | **nouveau** — porte enfin la checklist de `docs/migrations.md` |
| `package.json` | `test`, `lint --max-warnings 0`, ~~`engines >=25`~~ → `>=24` (2026-07-29) |
| `lib/dates.ts` | **supprimé** — aucun importeur |
| `epics.md`, `docs/configuration.md`, stories 1.1 et 1.2, `deferred-work.md` | affirmations périmées ou fausses corrigées |

### Quatre correctifs requalifiés en report, avec leur raison

Ils sont dans `deferred-work.md`. En résumé : les **Server Actions** ne peuvent pas poser d'en-têtes de
réponse (Next n'expose pas l'API, et leurs réponses sont des POST non mises en cache) ; la **CSP** exige
un nonce par requête et une vérification réelle ; le **contrôle de dérive des types** suppose un secret
GitHub ; le **motif du matcher** ne peut pas être extrait — Next l'analyse statiquement, le build échoue.

---

## Détail des travaux (2026-07-27)

**Migration corrective** — `supabase/migrations/20260727154504_restrict_profile_household_update.sql`.
Écrite, **non appliquée** : `db push` reste à jouer par Florian, sur le projet unique qui est la
production. Régénérer `lib/supabase/types.ts` dans le même commit n'est pas nécessaire ici (une
politique RLS ne change pas la forme du schéma), mais `npx supabase migration list` doit confirmer
l'alignement local/distant.

**Harnais de test** — `node --test`, zéro dépendance ajoutée, NFR-10 respecté.
18 tests sur 4 fichiers (`lib/auth/*.test.ts`), étape `Test` ajoutée à la CI entre Lint et Build.
Dents vérifiées : réintroduire les défauts de `safeNext` et `estCookieDeSession` fait échouer 3 tests,
les corriger les rend verts.

**Deux effets de bord assumés, à connaître :**
- `.github/workflows/ci.yml` passe de `node-version: 22` à `node-version-file: .node-version`.
  Ce n'était plus optionnel : `node --test` n'exécute TypeScript nativement qu'à partir de Node 23.6.
  ~~Bénéfice collatéral — la CI valide enfin le runtime que Vercel exécute réellement.~~
  **FAUX, corrigé le 2026-07-29.** Vercel ne servait pas 25 : il résolvait `engines: >=22.0.0`
  en **24.x**, ce que le journal de build énonce mot pour mot (« Node.js version changed from
  "24.x" »). L'affirmation était une déduction présentée comme un constat.
- ~~`package.json` `engines` passe de `>=22.0.0` à `>=25.0.0`, par cohérence avec ce qui précède.~~
  **Rectifié le 2026-07-29 en `>=24.0.0`, avec `.node-version` ramené à 24.** `>=25.0.0` a fait
  **échouer le déploiement Vercel** (« Found invalid or discontinued Node.js Version ») : Vercel
  plafonne à 24.x. Le plancher invoqué n'existait pas — vérifié par exécution sur Node 24.15.0,
  `npm test` 49/49, `npm run typecheck` et `npm run build` au vert, sans aucun drapeau. Le
  dépouillement de types est actif par défaut depuis 23.6, donc 24 suffisait depuis le début.
  La montée « par cohérence » n'a rien acheté et a coûté la production.
- `tsconfig.json` gagne `allowImportingTsExtensions` — Node résout les spécificateurs tels quels,
  donc les tests importent en `.ts`, ce que `tsc --noEmit` refusait.

**Une extraction tentée puis annulée, à ne pas refaire :** sortir le motif du matcher dans un module
partagé casse le build (« Entry `matcher[0]` need to be static strings »). Next l'analyse
statiquement. Le test le lit donc *depuis* `proxy.ts`, ce qui garde une source de vérité unique.

Vérification finale : `test` 18/18 · `typecheck` ✅ · `lint --max-warnings 0` ✅ · `build` ✅.

---

## Décisions requises

- [x] [Review][Decision] ✅ **RÉSOLU — migration écrite, `db push` à jouer.** **`profiles_update_own` n'a pas de `with check` : `household_id` est librement réinscriptible — NFR-5** — `supabase/migrations/20260502000000_initial_schema.sql:260`. ✅ vérifié. Postgres réutilise l'expression `using` comme contrôle d'écriture quand `with check` est absent ; seul `id = auth.uid()` est donc contraint, et `household_id` ne l'est pas du tout. `current_household_id()` (`:48-56`) se résout par `select household_id from profiles where id = auth.uid()` : un membre qui réécrit sa propre ligne bascule instantanément toute la RLS vers le foyer visé. `app/foyer/DisplayNameForm.tsx:40-48` documente le trou et conclut « la discipline est ici » — c'est-à-dire dans un composant `"use client"` que l'attaquant n'est pas obligé d'exécuter. À l'inverse `lib/supabase/queries.ts:49-53` affirme « La sécurité est assurée par la RLS, et par elle seule ». Exploitation : il faut connaître l'UUID d'un foyer cible ; `redeem_household_invite` le **retourne** (`:432`), donc quiconque a rejoint un foyer une fois le conserve pour toujours — et comme aucun mécanisme de retrait de membre n'existe, il n'y a aucune révocation possible. **Décision :** corriger par une migration additive sur le projet unique qui *est* la production (`alter policy … with check (id = auth.uid() and household_id = current_household_id())` gèle la colonne), ou assumer et tracer.

- [x] [Review][Decision] ✅ **RÉSOLU — `node --test` adopté, 18 tests en CI.** **Zéro test dans le dépôt, et la CI ne garde pas ce qui compte** — `.github/workflows/ci.yml:29-41`. ✅ vérifié : aucun fichier de test, aucun lanceur en dépendance, aucun script `test` ; la CI enchaîne `typecheck`, `lint`, `build`. Le finding ci-dessus est exactement ce qu'un test d'isolation à deux comptes aurait attrapé. Les stories justifient l'absence par NFR-10 (« aucun outil en plus ») — **cet argument est périmé** : `.node-version` vaut `25`, et `node --test` exécute TypeScript nativement, sans dépendance ni transpileur. Unités testables immédiatement sans aucun faux : `lib/auth/safe-next.ts` (pure, zéro import), le matcher de `proxy.ts:30` (donnée inerte), `hasSessionCookie`. **Décision :** adopter `node --test` + une étape CI, ou assumer la vérification manuelle.

- [x] [Review][Decision] ✅ tranché — **Aucune déconnexion possible, sur un produit à appareils partagés** — `grep -rn "signOut\|logout" app lib` → ✅ zéro occurrence, alors que `components/SignOutButton.tsx` **existait dans le prototype et a été supprimé sans remplacement** (visible au diff stat). Le cookie de session `@supabase/ssr` est `httpOnly: false`, `maxAge: 400 jours`. Tablette de cuisine, portable emprunté, téléphone revendu : aucun moyen de fermer la session, et aucun chemin d'administration pour la révoquer (`household_invites` se supprime, `profiles` non). Seul recours : le tableau de bord Supabase. **Décision :** story 1.6 (écran profil) est le porteur naturel — l'y ajouter, ou ouvrir une story dédiée.

- [x] [Review][Decision] ✅ tranché — **La bascule hors-ligne du proxy est annulée par la couche données, un hop plus loin** — `lib/supabase/proxy.ts:122-123` vs `lib/supabase/queries.ts:29-33`. Le proxy détecte trois formes de panne et laisse passer au nom de NFR-1 (« le hors-ligne est un mode nominal »). La page appelle ensuite `getMembership()`, dont le `supabase.auth.getUser()` n'a **ni test d'erreur ni timeout** : il rend `user: null` → `signedIn: false` → `redirect("/login")`. Le membre finit sur l'écran de connexion, exactement le résultat que les 45 lignes de détection de panne du proxy existent pour éviter. Le commentaire `queries.ts:55-57` annonce d'ailleurs le conflit (« entrerait en conflit avec sa bascule hors-ligne ») à l'endroit même où la fonction est restée. **Décision :** comment la couche données signale-t-elle « invérifiable » ? (propager un troisième état, ou déplacer la garde.)

- [x] [Review][Decision] ✅ tranché — **`redeem_household_invite` lit puis décrémente sans verrou** — `supabase/migrations/20260502000000_initial_schema.sql:411-428`. ✅ vérifié : `select … into` sans `for update`, contrôle `uses_left <= 0`, insertion du profil, puis `update … set uses_remaining = uses_remaining - 1`. Un code posté dans une conversation de famille et tapé par trois personnes dans la même seconde : les trois lisent `1`, les trois passent, le compteur finit à `-2`. Un code cru à usage unique a admis trois membres. **Décision :** migration additive (`for update`, ou `update … where uses_remaining > 0 returning`) sur la production, ou acceptation du risque à l'échelle d'un foyer.

- [x] [Review][Decision] ✅ tranché — **Deux documents donnent un verdict opposé sur le seul angle mort de sécurité de l'epic** — la story 1.2 se déclare close sur la vérification des en-têtes anti-cache, en reconnaissant que « la sonde déclenchait l'écriture par `refreshSession()` et non `verifyOtp()` » ; `docs/configuration.md:154` maintient que « leur émission effective lors d'une vraie connexion n'a jamais pu être observée ». `deferred-work.md` ne trace ni l'un ni l'autre. **Décision :** lequel fait foi, et où la dette est-elle tracée ?

- [x] [Review][Decision] ✅ tranché — **La story 1.1 est `done` sur des preuves rétroactivement invalidées** — la story 1.2 établit que `NEXT_PUBLIC_SUPABASE_URL` valait littéralement `https://your-project-ref.supabase.co` (NXDOMAIN) et que « l'application n'a jamais été connectée au projet Supabase déployé ». Les `307` du tableau de gating de la 1.1 venaient donc de la branche `cannotVerify`, pas de `!user && !isPublic` : « le résultat observé était juste, le chemin emprunté n'était pas celui d'un vrai *pas de session* ». La 1.1 reste close avec ses tableaux inchangés. **Décision :** amender la story, ou tracer dans `deferred-work.md`.

- [x] [Review][Decision] ✅ tranché — **Les messages d'exception plpgsql, en anglais, sont l'API — et personne ne l'a écrit** — `app/onboarding/JoinHouseholdForm.tsx:28-34` fait du `String.includes` sur `Invalid invite code`, `Invite expired`, `no uses remaining` ; `CreateHouseholdForm.tsx:56` et `JoinHouseholdForm.tsx:75` sur `Profile already exists`. Or `docs/migrations.md:47` bénit `create or replace function` comme mécanisme normal d'évolution, et sa checklist de revue ne mentionne nulle part le texte des messages comme contrat consommé. Une reformulation anodine fait retomber trois erreurs distinctes sur « Ça n'a pas marché », sans que `typecheck` ni la CI ne bronchent. **Décision :** passer par des `errcode` SQLSTATE et une table de correspondance unique, ou inscrire les messages au contrat dans `docs/migrations.md`.

- [x] [Review][Decision] ✅ tranché — **`lib/supabase/queries.ts` importe `next/navigation` et code en dur `/login` et `/onboarding`** — `queries.ts:1,64-65`. De la politique de routage web dans la couche donnée. Conséquence directe : la seule fonction qui sait lire l'appartenance est inutilisable depuis un serveur MCP ou une Edge Function (Epic 7), et intestable sans le stockage asynchrone de Next. La couture est minuscule — passer le client en paramètre, sortir `redirect()` vers une garde de 4 lignes dans `app/`. **Décision :** maintenant, ou au début de l'Epic 7 ?

- [x] [Review][Decision] ✅ tranché — **La validité d'une invitation est définie deux fois, avec deux horloges** — `app/foyer/invitation.ts:30-31` refait `expires_at > now` et `uses_remaining > 0` en JS (`new Date()`), exactement les contrôles de `redeem_household_invite` (`:418-423`, en `now()` Postgres). Le commentaire ligne 14 dit la vraie cause : « rien en base ne fait ce tri ». Le schéma ne répond pas à « quel est le code courant ? », et l'app comble en réécrivant une règle que le schéma possède déjà. **Décision :** une vue/fonction `current_household_invite` en base (honore le pari « le schéma EST le produit »), ou statu quo assumé.

- [x] [Review][Decision] ✅ tranché — **Un lien magique ouvert sur un navigateur déjà connecté bascule de compte en silence** — `app/auth/callback/route.ts:55-58`. `/auth/callback` est explicitement exempté du renvoi « connecté sur une page d'auth » (`proxy.ts:140`). Tablette de cuisine connectée en tant que A, B ouvre son propre lien : `verifyOtp` écrase le cookie de A sans confirmation ni notification. Aucune comparaison entre l'utilisateur vérifié et la session en place. C'est le scénario central du produit. **Décision :** confirmer avant bascule, ou assumer.

- [x] [Review][Decision] ✅ tranché — **Trois comptes de test abandonnés en production** — `deferred-work.md:39,60,76` recensent `+nc1`, `+nc2`, `+nc3`, deux foyers témoins, onze rayons chacun, qu'aucune politique RLS ne permet de supprimer depuis l'application. Tout contrôle d'isolation mené jusqu'ici a consisté à créer des comptes réels en production et à y laisser des débris. **Décision :** ouvrir une branche Supabase ou un `supabase start` local avant l'Epic 2 — c'est le préalable à la seule famille de tests que NFR-5 exige et qu'on ne peut pas écrire aujourd'hui.

- [x] [Review][Decision] ✅ tranché — **Aucun en-tête de sécurité, et le cookie de session est lisible en JavaScript** — `next.config.ts:3-14` ne contient que `experimental.strictRouteTypes` : pas de `headers()`, pas de CSP, pas de `X-Frame-Options`, pas de HSTS. Le cookie `@supabase/ssr` est `httpOnly: false` avec 400 jours de durée. Une seule XSS (un titre de recette, un nom d'ingrédient importé dans un epic futur) exfiltre un jeton porteur valide, et la RLS autorise tout parce que le jeton est authentique. **Décision :** durcir maintenant, ou tracer pour l'epic qui introduit du contenu saisi affiché.

- [x] [Review][Decision] ✅ tranché — **Le timeout de 3 s abandonne un rafraîchissement en vol** — `lib/supabase/proxy.ts:92-99`. `Promise.race` rend `"timeout"` et retourne `supabaseResponse` tel quel ; quand le `getUser()` abandonné se résout, son `setAll` écrit dans une réponse que personne ne lira. Supabase a consommé et fait tourner le refresh token, le navigateur garde l'ancien : passé la fenêtre de réutilisation, le membre est déconnecté sans raison visible — précisément la panne que l'en-tête du fichier dit prévenir. **Décision :** allonger le délai, rejouer, ou assumer.

- [x] [Review][Decision] ✅ tranché — **Rien ne détecte la dérive entre `lib/supabase/types.ts` et le schéma déployé** — `lib/supabase/client.ts:11-12` et `queries.ts:6-8` fondent leur garantie sur « les types étant générés depuis le schéma déployé ». La CI ne régénère rien et ne compare rien. Une migration poussée sans rejouer `supabase gen types` laisse `tsc` valider contre un schéma qui n'existe plus — la garantie s'inverse : les types ne peuvent pas casser, précisément parce que rien ne les contrôle. **Décision :** ajouter une étape CI de régénération + `git diff --exit-code`, ce qui suppose un jeton Supabase en secret GitHub.

---

## Correctifs

- [x] [Review][Patch] ✅ CORRIGÉ + test de régression — **Open redirect : `safeNext` est contourné par une tabulation ou un retour ligne** [`lib/auth/safe-next.ts:14`] ✅ **vérifié par exécution.** `RELATIVE_PATH = /^\/(?![/\\])/` n'inspecte que le second caractère ; or le parseur d'URL WHATWG **retire tab/LF/CR avant de parser**. Mesuré : `/\t/evil.com` passe la regex, puis `new URL(next, origin)` (`app/auth/callback/route.ts:58`) résout `https://evil.com/`. Idem `\n` et `\r`. La victime reçoit un vrai lien magique, obtient un cookie de session valide, et se fait rediriger vers le domaine attaquant. Le docblock du fichier affirme fermer exactement cette classe. Correctif : normaliser (`value.replace(/[\t\n\r]/g, "")`) **avant** de tester.
- [x] [Review][Patch] ✅ CORRIGÉ — **`getMembership` jette l'erreur PostgREST et la rend comme « pas de foyer »** [`lib/supabase/queries.ts:36-42`] ✅ vérifié : `error` n'est plus destructuré (la version précédente le journalisait). Un 5xx, un timeout ou une erreur de cache de schéma devient `profile: null` → `requireProfile` redirige vers `/onboarding` → `CreateHouseholdForm.tsx:56` reçoit `Profile already exists`, le traite **comme un succès** et repart vers `/` → rebond infini jusqu'à `ERR_TOO_MANY_REDIRECTS`, sans une ligne de log.
- [x] [Review][Patch] ✅ CORRIGÉ + test de régression — **`hasSessionCookie` accepte le cookie PKCE et tout cookie forgé** [`lib/supabase/proxy.ts:15-19`] ✅ vérifié : `startsWith("sb-") && includes("auth-token")` capture aussi `sb-<ref>-auth-token-code-verifier` (confirmé dans `@supabase/auth-js`), écrit dès la *demande* de lien. Le nom n'est jamais validé : `document.cookie = "sb-x-auth-token=junk"` suffit. Correctif : `/^sb-.+-auth-token(\.\d+)?$/`.
- [x] [Review][Patch] ✅ CORRIGÉ (rendu porteur par le harnais) — **La CI valide un Node que la production n'exécute pas** [`.github/workflows/ci.yml:22`] ✅ vérifié : CI épingle `node-version: 22`, `.node-version` vaut `25` — et c'est ce fichier que Vercel lit. Correctif : `node-version-file: .node-version`, qui supprime la double source.
- [x] [Review][Patch] ✅ traité — **`npm run lint` sort en 0 malgré les avertissements** [`package.json:12`] ✅ vérifié (`exit=0`). La seule règle personnalisée du dépôt est en `warn` (`eslint.config.mjs:162-165`) et le ruleset TypeScript de `eslint-config-next` l'est presque entièrement. L'étape Lint de la CI est proche d'un no-op. Correctif : `eslint --max-warnings 0`.
- [x] [Review][Patch] ✅ traité — **L'erreur de `verifyOtp` n'est jamais journalisée, et `type=email` est rejeté** [`app/auth/callback/route.ts:23,51,55-56`] `ACCEPTED_TYPES` refuse `email`, qui est la valeur des modèles Supabase par défaut. Un modèle laissé ou revenu au défaut tue **toutes** les connexions en `/login?error=lien-expire`, indiscernable d'un lien expiré, et `error` est détruit par destructuration sans un seul `console.error` : panne totale de connexion, zéro signal serveur.
- [x] [Review][Patch] ✅ traité — **Aucun `try/catch` dans le callback : un throw rend un 500 brut** [`app/auth/callback/route.ts:39,55`] Si `cookieStore.set` refuse ou si `verifyOtp` lève au lieu de rendre `{ error }`, l'exception s'échappe et Next sert sa page 500 en anglais — alors que toute la mécanique `rejected()` existe pour tenir NFR-8.
- [x] [Review][Patch] ✅ traité — **Variables d'environnement manquantes → 500 sur tout le site, CI verte par construction** [`lib/supabase/proxy.ts:39-41`, `server.ts:17-18,62-63`, `client.ts:16-18`] Les `!` masquent l'absence au `tsc`, et `createServerClient` lève **dans le proxy**, hors du `try` qui n'entoure que `getUser()` : chaque requête 500, `/login` compris, et `app/error.tsx` ne peut rien attraper au niveau proxy. La CI injecte des valeurs factices, donc ne le verra jamais. Correctif : assertion au démarrage avec message explicite.
- [x] [Review][Patch] ✅ traité — **Le `setTimeout` de la course n'est jamais annulé** [`lib/supabase/proxy.ts:92-97`] `Promise.race` abandonne le perdant sans l'annuler : chaque requête rapide laisse un timer de 3 s armé, ce qui maintient la boucle d'événements et prolonge la facturation de l'invocation. Correctif : helper `withTimeout` avec `clearTimeout` en `finally`.
- [x] [Review][Patch] ✅ traité — **`cancel-in-progress` s'applique aussi aux pushes sur `main`** [`.github/workflows/ci.yml:9-11`] Deux merges rapprochés : le run du premier est annulé par le second, et un run annulé se rapporte comme neutre, pas comme échoué. Un commit atterrit sur `main` sans avoir jamais fini sa CI. Correctif : restreindre l'annulation aux `pull_request`.
- [x] [Review][Patch] ✅ traité — **`applyAuthHeaders` ne couvre pas les Server Actions** [`lib/supabase/server.ts:27`] La fabrique de Server Component ignore le second paramètre `setAll`. Le commentaire justifie (« un Server Component ne peut pas écrire d'en-têtes, le proxy s'en charge »), mais les Server Actions, elles, le peuvent et passent par la même fabrique : une réponse rotant le cookie repart avec `Set-Cookie` et sans `Cache-Control: private, no-store` — la condition NFR-5 exacte.
- [x] [Review][Patch] ✅ traité — **Deux documents se contredisent sur `lib/supabase/types.ts`** [`docs/configuration.md:165`, `deferred-work.md:25`] Ils affirment « écrit à la main et divergera silencieusement du schéma », alors que `docs/migrations.md:69` dit « généré, jamais écrit à la main » et que le fichier réel est bien généré (en-tête `__InternalSupabase / PostgrestVersion`). Une dette est ouverte contre un problème déjà résolu. Même péremption sur `deferred-work.md:26` (« `postcss` n'est plus que transitif ») alors que `package.json:33` le redéclare en devDependency directe.
- [x] [Review][Patch] ✅ traité — **`epics.md:300` décrit trois routes publiques, le code en a deux** [`lib/supabase/proxy.ts:9`] L'AC3 de la story 1.1 cite toujours `/login`, `/signup` et `/auth/callback` ; `/signup` n'existe plus. La story 1.1 avait prescrit l'alignement d'`epics.md` puis a été close sans que la ligne bouge.
- [x] [Review][Patch] ✅ traité — **La Task 0 de la story 1.2, cochée, prescrit `localhost:3000`** Le serveur de dev écoute sur 3333 depuis `6acbb04` (`package.json:9`), et `docs/configuration.md:36` comme `README.md:53` ont suivi. Qui applique la story telle qu'elle est close configure une Redirect URL que `emailRedirectTo` ne satisfera jamais en local.
- [x] [Review][Patch] ✅ traité — **La checklist de revue de migrations n'est posée nulle part** [`docs/migrations.md:96-101`] Quatre questions obligatoires pour toute PR touchant `supabase/migrations/`, dont l'isolation vérifiée « avec deux comptes distincts » — et aucun template de pull request dans `.github/`.
- [x] [Review][Patch] ✅ traité — **`lib/dates.ts` est mort** ✅ vérifié : aucun importeur. Vestige du prototype, et il porte des libellés d'IHM français (`DAY_LABELS`, `MONTHS`) dans `lib/`.
- [x] [Review][Patch] ✅ traité — **`updateSession` fait cinq choses en 110 lignes, et duplique son bloc de redirection** [`lib/supabase/proxy.ts:36-146`, blocs `124-126` et `133-135` identiques au caractère près] Son propre en-tête l'annonce (« rafraîchit la session **et** applique le contrôle d'accès »). Les longs commentaires défensifs deviendraient des noms de fonction après extraction de `createProxyClient` / `verifySession` / `decideRoute`. Incohérence associée : `withSessionState` est appliqué aux lignes 126 et 135 mais pas aux retours 123 et 145, alors que son commentaire dit « toute réponse retournée ».
- [x] [Review][Patch] ✅ traité — **Deux `createClient` homonymes de sémantiques opposées** [`lib/supabase/server.ts:13`, `lib/supabase/client.ts:14`] L'une async et cookies Next, l'autre synchrone et navigateur ; seuls les chemins d'import les distinguent, et une erreur d'import est un bug silencieux, pas une erreur de typage. Le fichier est incohérent avec lui-même : la seconde fabrique, elle, s'appelle `createRouteHandlerClient`. Son en-tête (`:6-7`) prétend d'ailleurs couvrir les Route Handlers, alors que la fabrique dédiée existe juste en dessous.
- [x] [Review][Patch] ✅ traité — **`withSessionState` et `applyAuthHeaders` : un concept, deux noms, deux implémentations** [`lib/supabase/proxy.ts:68-76`, `lib/supabase/server.ts:82-87`] Même boucle, même problème, et deux avertissements en gras qui supplient l'auteur futur de ne pas oublier de les appeler — signe d'une API qui devrait rendre l'oubli impossible.
- [x] [Review][Patch] ✅ traité — **`getMembership` rend une paire qui autorise un état impossible** [`lib/supabase/queries.ts:24-27`] `{ signedIn: false, profile: <profil> }` est représentable, d'où le commentaire qui doit affirmer que « les trois cas sont distincts ». Une union discriminée le dirait au compilateur et rendrait `requireProfile` exhaustif.
- [x] [Review][Patch] ✅ traité — **Commentaire périmé et exception codée en dur sur `/auth/callback`** [`lib/supabase/proxy.ts:139-140`] Le commentaire dit « pour l'échange de code », alors que le diff a précisément remplacé `exchangeCodeForSession` par `verifyOtp`. La cause est la confusion de deux notions dans une seule liste : joignable sans session, et écran d'entrée dont un connecté doit être détourné.
- [x] [Review][Patch] ✅ traité — **Un membre connecté sur `/login?next=/foyer` perd sa destination** [`lib/supabase/proxy.ts:140-142`] La branche construit `/` et jette le `next` que les lignes 133-134 s'appliquent à préserver.
- [x] [Review][Patch] ✅ traité — **Le commentaire de `ci.yml:25-26` surinterprète `npm ci`** Il affirme que c'est « la garantie que les versions d'AR-STACK sont respectées » ; `npm ci` ne compare que `package-lock.json` à `package.json`. Une montée de `next` en 16.3 dans les deux passerait sans heurter AR-STACK.

---

## Reporté

- [x] [Review][Defer] **Lien magique consommé par un scanner d'emails avant le clic humain** [`app/auth/callback/route.ts:55`] — reporté. Outlook SafeLinks, prévisualisation Gmail/Proton, passerelle d'entreprise, ou un simple double-tap : le premier GET consomme l'OTP, l'humain reçoit `lien-expire` et redemande un lien qui sera scanné à son tour. La parade (fenêtre d'idempotence, ou interstitiel de sécurité GET) n'est pas triviale.
- [x] [Review][Defer] **`AuthRetryableFetchError` est comparé par nom de chaîne** [`lib/supabase/proxy.ts:104`] — reporté. Si `auth-js` renomme la classe dans une version mineure, le mode hors-ligne retombe silencieusement en « pas de session » et déconnecte tout le foyer à chaque incident : exactement la panne que la story 1.1 déclare corrigée. Rien dans le dépôt n'épingle cette chaîne.
- [x] [Review][Defer] **Le proxy traverse tous les assets, y compris `public/`** [`proxy.ts:26-30`] — reporté, décision assumée et documentée. À rouvrir **avant l'Epic 6** : `/manifest.webmanifest` est déjà proxifié, et un jeu d'icônes PWA fera payer un aller-retour `getUser()` (plafonné à 3 s) par fichier.
- [x] [Review][Defer] **La destination est perdue à la toute première connexion** [`app/auth/callback/route.ts:58` → `queries.ts:65`] — reporté. Lien profond capturé, callback y redirige, `requireProfile` n'y trouve pas de profil et part vers `/onboarding`, qui ne porte pas le `next` et dont les deux formulaires codent `router.replace("/")` en dur.
- [x] [Review][Defer] **`next` est capturé depuis les requêtes RSC** [`lib/supabase/proxy.ts:133-134`] — reporté, cosmétique. Le matcher n'exclut que `_next/static/` et `_next/image/`, donc `?_rsc=…` finit dans l'URL de connexion et survit à l'aller-retour email.

---

## Écarté comme bruit

- `ci.yml` livré par la story 1.1 sans figurer dans sa File List — archéologie de processus, aucune action.
- `rejected` mal nommé (`app/auth/callback/route.ts:46`) — absorbé par le refactor du callback.
- Duplication de la requête « nom du foyer » entre `app/page.tsx` et `app/foyer/page.tsx` — territoire de la passe 2.
- `"use client"` sur `lib/supabase/client.ts` bloquerait une réutilisation MCP — prématuré, l'Epic 7 refera ses propres fabriques.
