---
baseline_commit: ac03895dbfb2fb22f99ee1a6dc1058d1cd068d47
---

# Story 1.3: Créer un foyer à l'inscription

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a nouvel utilisateur sans foyer,
I want créer mon foyer au moment de mon inscription,
so that je dispose d'un espace partagé où vivront la liste, les recettes, les rayons et le menu.

## Acceptance Criteria

**AC1 — Création atomique**
**Given** un utilisateur authentifié dont le profil n'est rattaché à aucun foyer
**When** il choisit « créer un foyer » et confirme
**Then** un foyer est créé et son profil y est rattaché en une seule opération atomique (`create_household_with_profile`), via une migration additive respectant la discipline de migrations établie ici (AR-MIGRATIONS)

**AC2 — L'isolation prend effet**
**Given** un foyer fraîchement créé
**When** l'utilisateur accède à l'application
**Then** il est reconnu comme membre de ce foyer et l'isolation RLS s'applique (aucune donnée d'un autre foyer n'est lisible — NFR-5)

**AC3 — Pas de double création**
**Given** un utilisateur qui a déjà un foyer
**When** il se reconnecte
**Then** aucun nouvel appel de création n'est déclenché et il retrouve son foyer existant

*Note : l'amorçage du jeu de rayons par défaut (FR-11) est traité en Epic 2, pour les foyers créés ici comme pour les existants.*

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.3 — cité verbatim]

> ⚠️ **La note ci-dessus est fausse sur le fait, et l'AC1 est trompeuse sur la migration.** Deux corrections vérifiées dans le schéma déployé, à lire **avant** de coder : la RPC amorce déjà les rayons (piège n°1), et **aucune migration n'est nécessaire** (piège n°4). N'essaie de corriger ni l'un ni l'autre dans la base — elle est gelée.

## Tasks / Subtasks

- [x] **Task 0 — Générer les types de la base** (AC: 1)
  - [x] Décidé par Florian le 2026-07-26 : **on arrête d'écrire `lib/supabase/types.ts` à la main.** Cette story est la première à appeler une fonction Postgres — sans types générés, `supabase.rpc(…)` n'est vérifié par rien, ni le nom, ni les paramètres, ni le retour
  - [x] Prérequis : `npx supabase login`, puis `npx supabase link --project-ref <ref>` (le ref est lisible dans `NEXT_PUBLIC_SUPABASE_URL`). Le projet **n'est pas encore relié** — aucun `supabase/config.toml` n'existe. Ce lien sert aussi à la Task 5 → *le `login` a été fait par Florian ; le `link` s'est révélé inutile, le projet l'étant déjà depuis mai (état dans `supabase/.temp/`)*
  - [x] `npx supabase gen types typescript --linked > lib/supabase/types.ts` — **remplace** le fichier écrit à la main, ne le complète pas
  - [x] Vérifier que le fichier généré contient bien `Functions` avec `create_household_with_profile`, ses deux arguments et son retour `string`. **Si `Functions` est vide, la génération a échoué** — arrête-toi plutôt que de continuer sans filet
  - [x] Câbler le type sur les trois clients : `createBrowserClient<Database>`, `createServerClient<Database>` dans `server.ts` (les deux fabriques) et dans `proxy.ts`. C'est ce qui rend la RPC de la Task 4 réellement typée
  - [x] **Ne commite pas de secret** : `supabase link` écrit `supabase/config.toml` (sans secret) et peut créer `supabase/.temp/` — déjà ignoré par git. Vérifier `git status` avant de commiter
  - [x] ⚠️ **Aucune migration, aucune écriture en base.** `gen types` est en lecture seule. `git status --short supabase/migrations/` doit rester vide

- [x] **Task 1 — Garde d'appartenance au foyer** (AC: 2, 3)
  - [x] Recréer `lib/supabase/queries.ts` avec `requireProfile()` — dette explicitement différée par la revue 1.1 aux « stories 1.3+ », et c'est ici qu'elle échoit
  - [x] Signature attendue : fonction serveur qui lit la session, puis `profiles` pour `auth.uid()`, et retourne le profil. **Trois issues distinctes** : pas de session → `redirect("/login")` ; session mais pas de profil → `redirect("/onboarding")` ; profil → le retourner
  - [x] **Ne mets pas cette garde dans le proxy.** Elle exige une requête base à chaque requête HTTP, ce que le proxy — conçu avec un délai de 3 s et une bascule hors-ligne — ne peut pas absorber. C'est une garde **de page**, appelée par les Server Components qui lisent des données de foyer
  - [x] Consulter le prototype comme référence de forme, jamais de contenu : `git show prototype-2026-05-02:lib/supabase/queries.ts`

- [x] **Task 2 — Écran d'accueil qui aiguille** (AC: 2, 3)
  - [x] `app/page.tsx` — remplace le texte d'attente du socle. Server Component qui appelle `requireProfile()` : un utilisateur sans profil part vers `/onboarding`, un membre voit une page d'accueil minimale nommant son foyer
  - [x] Se contenter du minimum : le foyer et le prénom affiché. **Aucune surface métier ici** — la liste, le menu et les recettes appartiennent aux epics 2 à 4
  - [x] Vérifier dans la sortie de `next build` que la route est bien `ƒ` (dynamique) et non `○`. **Sans ajouter `force-dynamic`**, interdit par AD-13

- [x] **Task 3 — Écran d'onboarding** (AC: 1)
  - [x] `app/onboarding/page.tsx` — Server Component. **Route protégée** : ne l'ajoute surtout pas à `PUBLIC_ROUTES`
  - [x] Garde d'entrée : un utilisateur qui a **déjà** un profil est renvoyé à `/` (c'est la moitié de l'AC3)
  - [x] `app/onboarding/CreateHouseholdForm.tsx` — Client Component, **deux champs** : le nom du foyer et le prénom affiché. La RPC les exige tous les deux (voir piège n°2). Les deux sont obligatoires et non vides après `trim()`
  - [x] Structurer l'écran pour que la Story 1.5 puisse y greffer « rejoindre avec un code » **sans réécriture**, mais **ne construis pas ce chemin maintenant**
  - [x] Cibles ≥ 44px, anneau de focus visible, aucune couleur d'alerte — mêmes contraintes qu'en 1.2, mêmes classes utilitaires ad hoc (les tokens arrivent en 1.7)

- [x] **Task 4 — Appel de la RPC** (AC: 1, 3)
  - [x] `supabase.rpc("create_household_with_profile", { p_household_name, p_display_name })` **depuis le navigateur** via `lib/supabase/client.ts` — client-direct (AD-13). Ce n'est ni un jeton ni une invitation : ce n'est pas de l'irréductible serveur
  - [x] La fonction est `security definer` : elle crée le foyer **et** le profil en une transaction. **N'écris jamais toi-même dans `households` puis `profiles`** — deux écritures séparées ne sont pas atomiques et laisseraient un foyer orphelin en cas d'échec
  - [x] Empêcher la double soumission (bouton désactivé pendant l'appel). Et **traiter `Profile already exists` comme un succès** : c'est la course des deux clics, l'état visé est atteint
  - [x] Traduire les erreurs, **jamais rendre le message brut** (NFR-8) — la RPC lève en anglais (`Not authenticated`, `Profile already exists`). Voir « Microcopy imposée »
  - [x] Après succès, rediriger vers `/`. Ne recharge pas la session : `current_household_id()` prend effet immédiatement (piège n°3)

- [x] **Task 5 — Établir la discipline de migrations** (AC: 1)
  - [x] **Aucune migration à écrire dans cette story** — voir piège n°4. La RPC existe, elle est déployée, elle fait exactement ce que l'AC1 demande
  - [x] Ce que l'AC1 réclame réellement, c'est la **convention** que l'Architecture Spine laisse ouverte (`Deferred` → « Discipline de migration incrémentale … à établir »). L'écrire dans `docs/migrations.md` : nommage horodaté, caractère strictement additif, procédure d'application au projet déployé, et vérification qu'un fichier appliqué n'est plus jamais modifié
  - [x] Mentionner que le projet n'est **pas encore relié** au CLI Supabase en local (`supabase link` non joué, aucun `supabase/config.toml`) — c'est le préalable à toute migration future
  - [x] Référencer ce document depuis `README.md`, à côté de `docs/configuration.md`

- [ ] **Task 6 — Vérifier l'isolation pour de vrai** (AC: 2)
  - [x] Une fois le foyer créé, contrôler avec **la session du navigateur** (jamais de clé de service, AD-2) que `current_household_id()` renvoie désormais l'identifiant du foyer
  - [x] Vérifier que `select * from aisles` rend **11 lignes** — celles que la RPC a amorcées (piège n°1). C'est la preuve exécutable que l'isolation fonctionne : ces lignes ne sont visibles que parce que la politique RLS résout le foyer
  - [ ] **Le contrôle qui compte vraiment (NFR-5)** : créer un **second** compte, lui faire créer un **second** foyer, et vérifier depuis la session du premier qu'aucune ligne du second n'est lisible — ni `households`, ni `profiles`, ni `aisles`. Deux comptes sont possibles : le foyer en compte deux
  - [x] Consigner les résultats dans le Dev Agent Record

- [x] **Task 7 — Vérification** (AC: 1, 2, 3)
  - [x] `npm run typecheck` · `npm run lint` · `npm run build` → tous en succès, sans avertissement
  - [x] `git status --short supabase/migrations/` vide — **aucune migration**. *(Le contrôle porte sur `migrations/`, plus sur `supabase/` : la Task 0 y ajoute légitimement `config.toml`.)*
  - [x] Preuve que le typage mord réellement : introduire volontairement une faute dans l'appel RPC (paramètre mal nommé) et vérifier que `npm run typecheck` **échoue**, puis rétablir. Sans cette contre-épreuve, rien ne dit que les types générés sont branchés
  - [x] Grep des mots bannis dans les chaînes rendues (NFR-9) et absence de `force-dynamic`
  - [x] Parcours manuel : nouveau compte → connexion → arrivée sur `/onboarding` → saisie des deux noms → arrivée sur `/` nommant le foyer
  - [x] Parcours AC3 : se déconnecter puis se reconnecter → arrivée **directe** sur `/`, aucun appel de création. Et `/onboarding` visité à la main → renvoi vers `/`

## Dev Notes

### ⚠️ Cette story est bloquée tant que la 1.2 n'est pas vérifiable

La Story 1.2 est livrée en code mais reste `in-progress` : `.env.local` contenait les valeurs d'exemple, et la configuration Supabase (modèles d'email, adresses autorisées) n'est pas faite. **Rien de cette story-ci n'est testable sans une session réelle.**

Écrire le code est possible ; le vérifier ne l'est pas. Les prérequis sont dans **`docs/configuration.md`**. Si tu attaques cette story et que la connexion ne fonctionne toujours pas, **arrête-toi et signale-le** plutôt que de cocher des tâches non vérifiées.

### Le piège n°1 — la RPC amorce déjà les 11 rayons

La note de l'AC renvoie l'amorçage des rayons à l'Epic 2. **Le schéma déployé dit le contraire.** Vérifié :

```sql
-- supabase/migrations/20260502000000_initial_schema.sql:353-385
create or replace function create_household_with_profile(
  p_household_name text,
  p_display_name   text
) returns uuid … as $$
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from profiles where id = v_user_id)
    then raise exception 'Profile already exists'; end if;

  insert into households (name) values (p_household_name)
    returning id into v_household_id;
  insert into profiles (id, household_id, display_name)
    values (v_user_id, v_household_id, p_display_name);

  perform seed_default_aisles(v_household_id);   -- ← ici
  return v_household_id;
end; $$;
```

`seed_default_aisles` insère **11 rayons français** — Fruits & Légumes, Boucherie, Poissonnerie, Crémerie, Boulangerie, Épicerie sèche, Conserves, Surgelés, Boissons, Hygiène & Entretien, Autre — avec leur émoji et leur ordre de parcours, en `on conflict (household_id, name) do nothing`.

**Trois conséquences :**

1. **N'ajoute aucun amorçage.** Il est déjà là, et il est correct.
2. **Ne le retire pas non plus** : la base est gelée, et ces rayons sont le comportement attendu de FR-11.
3. **C'est un atout pour ta vérification** : après la création, 11 lignes `aisles` doivent être visibles. C'est la preuve exécutable la plus simple que l'isolation RLS fonctionne (Task 6).

La Story 2.1 (« amorcer un jeu de rayons par défaut ») devra donc composer avec des foyers **déjà** amorcés. Ce n'est pas ton problème ici, mais ça mérite d'être tracé.

### Le piège n°2 — la RPC exige deux noms, l'AC n'en mentionne aucun

L'AC1 dit « il choisit *créer un foyer* et confirme ». La signature réelle exige `p_household_name` **et** `p_display_name`, tous deux `not null` en base (`households.name`, `profiles.display_name`).

**Il faut donc deux champs, et l'AC ne le dit pas.** Un écran à un seul bouton ne peut pas satisfaire la RPC. Deux champs, obligatoires, non vides après `trim()` — la base accepterait une chaîne vide, pas nous.

Le prénom affiché saisi ici est **le même** que celui de l'écran profil de la Story 1.6 (`profiles.display_name`, FR-42). Ne crée pas un second concept.

Ton : on demande le prénom, pas un « nom d'utilisateur ». Le nom du foyer est celui de la maisonnée, pas un identifiant.

### Le piège n°3 — `current_household_id()` prend effet immédiatement

Réflexe naturel et faux : « le foyer est dans le jeton, il faut rafraîchir la session ». **Non.**

```sql
create or replace function current_household_id() … as $$
  select household_id from profiles where id = auth.uid()
$$;
```

La fonction lit la table `profiles` **à chaque appel**. Dès que la ligne existe, toutes les politiques RLS résolvent le foyer — sans nouveau jeton, sans reconnexion, sans rien invalider. Une simple redirection vers `/` suffit après la création.

Corollaire pour la Story 1.2 : c'est aussi pour cela qu'un utilisateur fraîchement connecté et sans profil obtient `NULL` sans que rien ne casse.

### Le piège n°4 — il n'y a aucune migration à écrire

L'AC1 dit « via une migration additive respectant la discipline de migrations établie ici ». Lu vite, on écrit une migration. **Il n'y a rien à migrer** : `create_household_with_profile` existe, est déployée, et fait exactement ce que l'AC décrit.

Ce que la formule réclame, c'est la seconde moitié de la phrase — **la discipline**, laissée ouverte par l'Architecture Spine (`Deferred` : « une seule migration initiale existe ; l'outillage/convention de migrations additives est **à établir** avant le schéma du Lot 1 »). Cette story est le premier moment où le sujet se pose. C'est la Task 5.

**N'écris pas une migration vide « pour la forme ».** Elle serait un mensonge dans l'historique du schéma. Et surtout, ne récris pas la fonction existante : `create or replace` sur une base gelée est exactement ce qu'AR-MIGRATIONS interdit.

### Ce que la garde d'appartenance doit et ne doit pas faire

C'est la dette que la revue 1.1 a différée « dès l'Epic 1, stories 1.3+ ». Aujourd'hui, **une session valide suffit à franchir le proxy** : rien ne vérifie l'appartenance à un foyer. Sans conséquence tant qu'aucune route ne lit de données ; cette story ouvre la première.

**Où elle va :** dans les Server Components qui lisent des données de foyer, via `requireProfile()`.

**Où elle ne va pas : le proxy.** Le proxy tourne sur *chaque* requête ; y ajouter une lecture base coûterait un aller-retour par navigation et entrerait en conflit direct avec sa bascule hors-ligne à 3 s (NFR-1). Le proxy vérifie l'*authentification* ; l'*appartenance* est affaire de page.

**Ce n'est pas un contrôle de sécurité.** La sécurité, c'est la RLS et elle seule (AD-2) : un utilisateur sans profil ne peut de toute façon rien lire, `current_household_id()` valant `NULL`. `requireProfile()` est un **aiguillage d'expérience** — il évite d'afficher une page vide à qui n'a pas encore de foyer. Ne le présente pas comme une barrière, et n'en déduis jamais qu'on peut assouplir la RLS.

### Une observation sur la RLS, à ne pas traiter ici

`households_insert` autorise **tout utilisateur authentifié** à insérer une ligne `households` en direct :

```sql
create policy households_insert on households for insert
  with check (auth.uid() is not null);
```

Le commentaire du schéma l'assume (« la création du profil est l'étape qui filtre »). Conséquence réelle : quelqu'un peut créer des foyers orphelins sans profil rattaché — inaccessibles, invisibles, mais présents. À l'échelle de deux personnes, c'est sans portée.

**Ne le corrige pas** : ce serait une migration, la base est gelée, et aucun document ne le prescrit. C'est noté pour que la revue ne le redécouvre pas comme un oubli.

### Microcopy imposée (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache. Le parcours d'onboarding n'a **pas** été maquetté (EXPERIENCE.md le note explicitement) : tu as la liberté de composition, pas celle du ton.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre de l'écran | « On installe ta cuisine » | « Onboarding » / « Configuration » |
| Champ nom du foyer | « Le nom de chez toi » — ex. « Chez les Marin » | « Nom de l'organisation » |
| Champ prénom | « Ton prénom » | « Nom d'utilisateur » |
| Bouton | « C'est parti » | « Créer le foyer » / « Valider » |
| Champ vide | « Il manque le nom de chez toi. » | « Champ requis » |
| `Not authenticated` | *ne pas afficher* — rediriger vers `/login` | le message brut |
| `Profile already exists` | *ne pas afficher* — c'est un succès, on continue | le message brut |
| Autre échec | « Ça n'a pas marché. Réessaie dans un instant. » | l'`error.message` de la base |

Une fois le foyer créé, la page d'accueil peut le nommer simplement : « Chez les Marin » et le prénom. Pas de tableau de bord, pas de compteur — il n'y a encore rien à compter.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Générer un code d'invitation | **Story 1.4** |
| Rejoindre un foyer avec un code (`redeem_household_invite`) | **Story 1.5** |
| Écran profil, modification du prénom, liste des membres | **Story 1.6** |
| Tokens de couleur, thème, `error.tsx`, `not-found.tsx` | **Story 1.7** |
| Gérer, réordonner ou amorcer les rayons | **Epic 2** |
| Quitter ou changer de foyer | **hors périmètre v1** — non modélisé (`profiles.household_id` est `not null`, aucun chemin de départ n'existe) |
| Framework de test | **Story 4.15** |

### Contraintes d'architecture applicables

- **AD-16** — le foyer est l'unité d'isolation ; un humain le **crée** ou le **rejoint**. Un appareil n'est jamais promu membre
- **AD-2** — RLS non contournable, **jamais de clé de service**. Toute vérification passe par une session réelle
- **AD-1** — toute règle métier vit en Postgres. L'atomicité de la création est dans la RPC, pas dans du TypeScript
- **AD-13** — Next = coquille ; Server Actions réduites au callback de connexion et à l'émission de jetons/invitations. La création de foyer **n'en fait pas partie** : client-direct. **N'ajoute pas `force-dynamic`**
- **AR-MIGRATIONS** — schéma **déployé et gelé**. `git status --short supabase/migrations/` doit rester vide. `supabase gen types` est en lecture seule et ne le contredit pas ; `supabase link` n'ajoute qu'un `config.toml`
- **NFR-5** — isolation appliquée à la donnée. C'est la première story où elle devient observable : profites-en pour la prouver (Task 6)

### Standards de test

**Aucun framework de test, et il ne faut pas en introduire ici.** Les tests sont planifiés en Story 4.15. AD-17 nomme bien une famille « tests de RLS », mais son propre texte prévoit de les **déférer explicitement** hors du Lot 1 — ce qui est le cas.

La vérification attendue est **exécutable et manuelle** : `typecheck`, `lint`, `build`, les greps, les deux parcours de la Task 7, et surtout **le contrôle d'isolation à deux comptes** de la Task 6. Ce dernier est le plus important de la story : c'est la seule preuve que NFR-5 tient.

⚠️ **Piège d'outillage, toujours valable.** `npm run build | grep …` ne rend jamais la main (les workers Turbopack gardent la sortie ouverte). **Rediriger vers un fichier.**

### Project Structure Notes

```
app/
  page.tsx              ~  aiguillage via requireProfile()
  onboarding/
    page.tsx            +  Server Component, garde d'entrée
    CreateHouseholdForm.tsx  +  Client Component, deux champs
  login/                   inchangé (Story 1.2)
  auth/callback/           inchangé (Story 1.2)
lib/
  supabase/
    queries.ts          +  requireProfile() — dette 1.1 soldée
    types.ts            ~  REMPLACÉ par `supabase gen types` (Task 0)
    client.ts           ~  typé <Database>
    server.ts           ~  typé <Database> sur les deux fabriques
    proxy.ts            ~  typé <Database> — seule modification tolérée ici
proxy.ts                   inchangé — n'ajoute PAS /onboarding aux routes publiques
docs/
  migrations.md         +  discipline de migrations (Task 5)
supabase/
  config.toml           +  créé par `supabase link` (sans secret)
  migrations/              INTACT — aucune migration
```

### Intelligence de la story précédente (1.2)

- **`.env.local` contenait les valeurs d'exemple** — découvert en 1.2. Vérifie-le en premier : c'est le genre de chose qui fait perdre une heure à débugger du code correct.
- **Les appels Supabase ne lèvent pas, ils retournent `{ data, error }`.** Vrai aussi pour `supabase.rpc()`. Un `try/catch` seul ne verrait rien passer — **teste `error` explicitement**. C'est le même piège qui avait mordu en 1.1 avec `getUser()`.
- **Une redirection n'hérite de rien.** Motif de bug récurrent sur ce dépôt (revue 1.1 sur le proxy, Task 4 de la 1.2). Si tu retournes une réponse construite à la main, vérifie ce qu'elle porte.
- **Mesure au lieu de supposer.** La 1.2 a levé son point de vigilance avec une sonde temporaire de dix lignes plutôt qu'un raisonnement. La Task 6 est du même ordre : deux comptes, une requête, une preuve.
- **`app/login/page.tsx` montre le motif à suivre** : Server Component qui `await searchParams`, validation, puis délégation à un Client Component. `LoginForm.tsx` montre la gestion d'erreur par code traduit et le style ad hoc conforme à la frontière 1.7. **Copie ces motifs plutôt que d'en inventer.**

### Intelligence git

`ac03895` (`feat(auth): Connexion par lien email, sans mot de passe (#2)`) est la base de cette story.

- **Convention établie et à suivre** : Conventional Commits, scope en tête, corps en français. Branche dédiée → PR → **squash merge** une fois la CI verte.
- **La CI rejoue exactement `typecheck`, `lint`, `build`** (`.github/workflows/ci.yml`) sur Node 22, avec des variables Supabase factices. Si ces trois commandes passent en local, la CI passe.
- Le prototype reste consultable — `git show prototype-2026-05-02:app/onboarding/page.tsx` et `:lib/supabase/queries.ts`. **Référence de forme, pas de contenu** : sa palette est bannie par UX-DR1 et son chemin d'écriture est inversé par AD-13.

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10** — `eslint-config-next` embarque un plugin incompatible et `npm run lint` ne linterait plus rien).

`experimental.strictRouteTypes` est actif : `params` et `searchParams` sont des `Promise`, et l'oubli d'un `await` échoue au build.

Appel d'une fonction Postgres depuis le client Supabase :

```ts
const { data, error } = await supabase.rpc("create_household_with_profile", {
  p_household_name: nomDuFoyer,
  p_display_name: prenom,
});
```

Les noms de paramètres portent le préfixe `p_` : ce sont ceux de la signature SQL, ils ne sont pas négociables. Le retour `data` est l'`uuid` du foyer créé. Une exception `raise` côté Postgres arrive dans `error`, avec son message anglais dans `error.message` — **à traduire, jamais à rendre**.

Une fois la Task 0 faite, ces noms cessent d'être une convention de politesse : le client est typé `<Database>`, et une faute de frappe sur `p_household_name` **échoue au typecheck**. C'est tout l'intérêt de générer les types avant d'écrire l'appel, et non l'inverse.

### État vérifié de l'environnement (2026-07-26)

Mesures directes, pour t'éviter de rejouer un diagnostic déjà fait :

- **Production en ligne** — `nutri.florianmarin.me`, TLS actif, variables d'environnement posées, contrôle d'accès fonctionnel
- **`.env.local` renseigné** avec les vraies clés du projet `ywoubvebmlhtomwgouci`. Le serveur local parle au backend réel : `/login` rend 200, `/menu` redirige en conservant sa destination
- **Un compte existe** : `flomarin88@gmail.com`, créé le 2026-07-26 à 19:52 UTC, **sans profil ni foyer**. C'est exactement le sujet de cette story — ce compte est ton cas de test nominal
- ⚠️ **Le quota d'envoi d'emails était épuisé** en fin de journée (`429 over_email_send_rate_limit`, 2 emails/heure). Si tu dois te reconnecter pour tester, garde en tête que tu n'as que deux liens par heure. Le contenu de cette story se teste **avec la session déjà ouverte**, sans nouvel email

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] — user story et 3 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements-Inventory] — FR-40, FR-42, FR-43 ; NFR-5, NFR-8, NFR-9, NFR-10
- [Source: …/ARCHITECTURE-SPINE.md#Invariants-&-Rules] — AD-1, AD-2, AD-13, AD-16
- [Source: …/ARCHITECTURE-SPINE.md#Deferred] — « discipline de migration incrémentale … à établir » (objet de la Task 5)
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md#Voice-and-Tone] — tutoiement, mots bannis
- [Source: …/EXPERIENCE.md#Lacunes-&-hypothèses] — FR-40/41 explicitement **non maquettés** : liberté de composition
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — « rétablir la garde d'appartenance au foyer », échue ici
- [Source: _bmad-output/implementation-artifacts/1-2-authentification-par-magic-link-sans-mot-de-passe.md] — verrous de configuration, motifs de code à reprendre
- [Source: docs/configuration.md] — prérequis externes sans lesquels rien n'est testable
- **Schéma déployé, lu directement** (`supabase/migrations/20260502000000_initial_schema.sql`) : `create_household_with_profile` (353-385), `seed_default_aisles` (11 rayons, `on conflict do nothing`), `current_household_id()` (48-56), politiques RLS `households_*` et `profiles_*` (247-263), `aisles unique (household_id, name)`. **Ne pas toucher**

## Questions pour Florian

*Les deux questions ouvertes ont été tranchées le 2026-07-26. Conservées ici pour la traçabilité de la décision.*

1. ~~**Le nom du foyer, on le demande ou on l'invente ?**~~ — **on le demande.** Deux champs à l'inscription, le nom du foyer et le prénom. C'est ce que décrit la Task 3.
2. ~~**`supabase gen types` ?**~~ — **oui, et dans cette story** (Task 0). Le typage manuel s'arrête ici. Conséquence à assumer : la story s'élargit d'un cran, et la génération exige de relier le projet au CLI Supabase — ce que la Task 5 demandait de toute façon de documenter.

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Claude Code) — 2026-07-26

### Debug Log References

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | succès, **0 avertissement** |
| `git status --short supabase/migrations/` | vide |

**Modes de rendu** (`next build`), sans aucun `force-dynamic` :

```
┌ ƒ /                 dynamique — lit la session
├ ○ /_not-found
├ ƒ /auth/callback
├ ƒ /login
└ ƒ /onboarding       dynamique — lit la session
```

**Contrôle d'accès** (serveur local, anonyme) — la nouvelle route est bien protégée :

| Requête | Résultat |
|---|---|
| `/onboarding` | `307 → /login?next=%2Fonboarding` |
| `/onboarding/foo` | `307 → /login?next=%2Fonboarding%2Ffoo` |

**Greps de non-régression** : aucun mot banni dans les chaînes rendues (NFR-9) ; aucun `force-dynamic` (AD-13) ; aucun `outline-none`/`outline-hidden`/`tap-highlight` (UX-DR11) ; **aucune écriture directe dans `households` ou `profiles`** — tout passe par la fonction Postgres.

**Génération des types** (Task 0). Deux premières tentatives en échec :

```
LegacyGenTypesUnexpectedStatusError
"Your account does not have the necessary privileges to access this endpoint"
```

Diagnostic — message **trompeur** : ce n'est pas un défaut de droits sur le projet, mais l'**absence de jeton d'accès** (`~/.supabase/` ne contenait que de la télémétrie). `gen types --linked` passe par l'API de gestion, qui exige `supabase login`, commande interactive hors de portée d'un agent. Après le `login` de Florian, la génération passe : **724 lignes, exit 0**.

Contenu vérifié : 10 tables, la vue `grocery_list_by_aisle`, et les 7 fonctions — dont `create_household_with_profile` avec exactement `{ p_display_name: string; p_household_name: string }` et `Returns: string`.

À noter : `supabase link` **n'a pas eu à être rejoué**. Le projet était relié depuis mai, l'état persistant dans `supabase/.temp/` (ignoré par git). Aucun `config.toml` n'a donc été créé, et `git status --short supabase/` reste vide — la Task 0 n'a laissé aucune trace dans ce répertoire.

**Contre-épreuve du typage** — trois fautes introduites volontairement, chacune rétablie ensuite :

| Faute injectée | Résultat |
|---|---|
| `p_household_nam` (paramètre mal nommé) | `TS2561` — « does not exist in type `{ p_display_name: string; p_household_name: string }` » |
| `create_household_typo` (fonction inexistante) | `TS2345` — l'union des 7 fonctions réelles est énumérée |
| `dispay_name` (colonne inexistante) | `TS2322` — « column 'dispay_name' does not exist on 'profiles' » |

`typecheck` sort en **1** dans les trois cas, et en **0** après rétablissement. Le générique n'est pas décoratif : il est branché et il mord.

**Tentatives d'obtention d'un lien de connexion**, à 20:47 et 20:51 UTC : `429 over_email_send_rate_limit` les deux fois. Le compte ayant été créé à 19:52, la fenêtre de reconstitution est **plus longue qu'une heure** — bon à savoir pour les stories suivantes.

### Vérification en conditions réelles (2026-07-27)

Le service d'envoi d'emails dédié étant en place, tout le parcours a pu être joué depuis le navigateur, sur le serveur local branché au projet réel.

| Étape | Constat |
|---|---|
| Lien de connexion ouvert | `verifyOtp` réussit, `/auth/callback` redirige vers `/` |
| `/` sans foyer | `requireProfile()` aiguille vers `/onboarding` — **l'aiguillage fonctionne** |
| Champs remplis d'espaces | « Il manque le nom de chez toi. », aucune navigation, bouton réarmé — le `trim()` fait ce que le `required` du navigateur ne fait pas |
| Formulaire soumis (« Marin » / « Florian ») | arrivée sur `/`, titre **« Marin »**, « Salut Florian. » |
| `/onboarding` revisité avec un foyer | **1 saut** de redirection vers `/` — AC3 |

**État en base après création**, lu avec la session du navigateur (jamais de clé de service) :

| Appel | Résultat |
|---|---|
| `rpc/current_household_id` | `200` / un uuid — **il valait `null` avant**, c'est l'AC2 |
| `households`, `profiles` | 1 ligne chacune |
| **`aisles`** | **11 lignes** |
| `household_invites` | 0 ligne (attendu, Story 1.4) |

**Les 11 rayons confirment le piège n°1** : la note de l'acceptation renvoyait leur amorçage à l'Epic 2, alors que la fonction déployée le fait déjà. Rien n'a été ajouté côté client. C'est aussi la preuve exécutable la plus simple de l'isolation : ces lignes ne sont visibles que parce que la politique RLS résout désormais un foyer.

**Ce qui reste : le contrôle à deux comptes.** Il exige un second compte, donc une première connexion — or le modèle d'email « Confirm sign up » est resté celui par défaut et ne porte pas notre lien. Deux modèles conformes sont livrés dans `docs/email-templates/` ; tant qu'ils ne sont pas collés, aucun nouveau compte ne peut entrer. **C'est la dernière chose qui manque à cette story.**

**Un piège d'outillage découvert.** Après suppression d'une route temporaire, `npm run typecheck` sort en **2** alors que le fichier n'existe plus : le validateur généré sous `.next/dev/types/` le référence encore. `rm -rf .next tsconfig.tsbuildinfo` puis revérification à froid — tout repasse à 0. À connaître avant de croire à une régression.

### Completion Notes List

**Livré : les tasks 0 à 5 en entier. Bloquées : la task 6 et deux contrôles de la task 7.** Un seul verrou subsiste.

**Le verrou n°1 est levé.** `supabase login` étant interactif, la Task 0 avait dû être laissée de côté ; Florian l'a exécuté et la génération a suivi immédiatement. Les trois clients sont désormais typés `<Database>`, et le type `Profile` est **dérivé du schéma** (`Pick<…["profiles"]["Row"], …>`) plutôt que réécrit : une colonne renommée en base casse le typage au lieu de diverger en silence. Les deux conversions `as` devenues inutiles ont été retirées.

**Verrou n°2 — le quota d'envoi d'emails.** Tester le parcours exige une session **sur l'origine testée**. La session existante vit sur le domaine de production ; ni `localhost` ni un déploiement de prévisualisation ne la partagent. Obtenir une session ailleurs suppose un nouveau lien, refusé par le quota.

> Une solution a été écartée délibérément : transplanter le cookie de session du domaine de production vers `localhost`. Techniquement faisable, mais elle ferait transiter un jeton d'accès vivant par la conversation. Le bénéfice ne vaut pas le risque.

**L'implémentation ne réplique aucune règle métier.** L'atomicité vit dans la fonction Postgres, appelée telle quelle. Vérifié par grep : aucun `insert` sur `households` ni `profiles` dans le code applicatif. C'est le piège que la story signalait — deux écritures séparées laisseraient un foyer orphelin si la seconde échouait.

**La garde a été factorisée plutôt que dupliquée.** Une première version avait `getCurrentProfile()` et `requireProfile()` répétant la même séquence, et surtout incapables de distinguer « pas de session » de « pas de profil » — les deux rendaient `null`. Refondu autour de `getMembership()`, qui retourne `{ signedIn, profile }` : `requireProfile()` en dérive les deux redirections, et l'écran d'inscription au foyer en dérive la sienne (déjà un profil → retour à l'accueil). Trois aiguillages, une seule lecture.

**`redirect()` de Next lève une exception que le framework intercepte.** Elle est documentée dans le code pour la même raison qui a mordu deux fois sur ce dépôt : un `try/catch` bien intentionné l'avalerait, et la redirection ne se produirait jamais.

**Un écart de forme assumé.** La Task 3 demandait de structurer l'écran pour que la Story 1.5 puisse y greffer « rejoindre avec un code » sans réécriture. `app/onboarding/page.tsx` rend directement le formulaire de création : la 1.5 devra y introduire un choix. Mais `CreateHouseholdForm.tsx` reste intact dans l'opération — seule la page change, et c'est bien une greffe, pas une réécriture.

**Écart de méthode assumé — pas de TDD.** Le workflow impose un cycle red-green-refactor ; la story l'interdit explicitement (aucun framework de test, planifiés en Story 4.15, NFR-10 proscrit tout outil supplémentaire). La story fait autorité. Vérification exécutable et manuelle, comme prescrit. **Aucune dépendance ajoutée.**

**Ce qui reste à faire :**

1. Une session sur l'origine à tester — soit un lien de connexion quand le quota le permettra, soit un déploiement en production, où la session existe déjà
2. Les tasks 6 et 7 : parcours complet, parcours de non-répétition, et **surtout** le contrôle d'isolation à deux comptes, qui est la seule preuve de NFR-5

### File List

**Nouveaux**
- `lib/supabase/queries.ts` — `getMembership()` et `requireProfile()`
- `app/onboarding/page.tsx`
- `app/onboarding/CreateHouseholdForm.tsx`
- `docs/migrations.md`

**Modifiés**
- `app/page.tsx` — contenu intégralement remplacé (le texte d'attente du socle disparaît)
- `README.md` — renvoi vers `docs/migrations.md`

**Modifiés (Task 0)**
- `lib/supabase/types.ts` — **remplacé par la sortie de `supabase gen types`** (724 lignes). N'est plus à éditer à la main
- `lib/supabase/client.ts` — `createBrowserClient<Database>`
- `lib/supabase/server.ts` — `createServerClient<Database>` sur les deux fabriques
- `lib/supabase/proxy.ts` — `createServerClient<Database>`. **Seule modification apportée à ce fichier** : la garde d'appartenance n'y a pas été mise, conformément à la story

**Inchangés, vérifiés**
- `proxy.ts` (racine) — `git diff` vide
- `package.json`, `package-lock.json` — **aucune dépendance ajoutée**
- `supabase/migrations/` — **aucune migration**

## Change Log

| Date | Changement |
|---|---|
| 2026-07-26 | Story créée. Statut → `ready-for-dev` |
| 2026-07-26 | Deux questions tranchées par Florian : le nom du foyer est demandé à l'inscription (deux champs), et `supabase gen types` entre dans le périmètre — nouvelle Task 0, clients typés `<Database>`, contrôle de non-régression sur `supabase/migrations/` resserré. État vérifié de l'environnement consigné |
| 2026-07-26 | Implémentation : garde d'appartenance, accueil qui aiguille, écran d'inscription au foyer, appel de la fonction Postgres, discipline de migrations. Tasks 1 à 5 complètes ; task 0 bloquée (`supabase login` interactif), tasks 6 et 7 partiellement bloquées (quota d'emails). Statut maintenu `in-progress` |
| 2026-07-27 | Task 0 débloquée par le `supabase login` de Florian : types générés (724 lignes, 7 fonctions), générique `<Database>` câblé sur les trois clients, `Profile` dérivé du schéma, conversions `as` retirées. Contre-épreuve du typage passée sur trois fautes injectées. Reste la vérification de bout en bout |
| 2026-07-27 | Parcours vérifié de bout en bout en conditions réelles : foyer « Marin » créé via le formulaire, `current_household_id()` résout, 11 rayons amorcés, AC3 constaté. Modèles d'email conformes livrés dans `docs/email-templates/`. Reste le contrôle d'isolation à deux comptes, bloqué tant que le modèle d'inscription n'est pas remplacé |
