---
baseline_commit: ac03895dbfb2fb22f99ee1a6dc1058d1cd068d47
---

# Story 1.3: Créer un foyer à l'inscription

Status: ready-for-dev

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

- [ ] **Task 1 — Garde d'appartenance au foyer** (AC: 2, 3)
  - [ ] Recréer `lib/supabase/queries.ts` avec `requireProfile()` — dette explicitement différée par la revue 1.1 aux « stories 1.3+ », et c'est ici qu'elle échoit
  - [ ] Signature attendue : fonction serveur qui lit la session, puis `profiles` pour `auth.uid()`, et retourne le profil. **Trois issues distinctes** : pas de session → `redirect("/login")` ; session mais pas de profil → `redirect("/onboarding")` ; profil → le retourner
  - [ ] **Ne mets pas cette garde dans le proxy.** Elle exige une requête base à chaque requête HTTP, ce que le proxy — conçu avec un délai de 3 s et une bascule hors-ligne — ne peut pas absorber. C'est une garde **de page**, appelée par les Server Components qui lisent des données de foyer
  - [ ] Consulter le prototype comme référence de forme, jamais de contenu : `git show prototype-2026-05-02:lib/supabase/queries.ts`

- [ ] **Task 2 — Écran d'accueil qui aiguille** (AC: 2, 3)
  - [ ] `app/page.tsx` — remplace le texte d'attente du socle. Server Component qui appelle `requireProfile()` : un utilisateur sans profil part vers `/onboarding`, un membre voit une page d'accueil minimale nommant son foyer
  - [ ] Se contenter du minimum : le foyer et le prénom affiché. **Aucune surface métier ici** — la liste, le menu et les recettes appartiennent aux epics 2 à 4
  - [ ] Vérifier dans la sortie de `next build` que la route est bien `ƒ` (dynamique) et non `○`. **Sans ajouter `force-dynamic`**, interdit par AD-13

- [ ] **Task 3 — Écran d'onboarding** (AC: 1)
  - [ ] `app/onboarding/page.tsx` — Server Component. **Route protégée** : ne l'ajoute surtout pas à `PUBLIC_ROUTES`
  - [ ] Garde d'entrée : un utilisateur qui a **déjà** un profil est renvoyé à `/` (c'est la moitié de l'AC3)
  - [ ] `app/onboarding/CreateHouseholdForm.tsx` — Client Component, **deux champs** : le nom du foyer et le prénom affiché. La RPC les exige tous les deux (voir piège n°2). Les deux sont obligatoires et non vides après `trim()`
  - [ ] Structurer l'écran pour que la Story 1.5 puisse y greffer « rejoindre avec un code » **sans réécriture**, mais **ne construis pas ce chemin maintenant**
  - [ ] Cibles ≥ 44px, anneau de focus visible, aucune couleur d'alerte — mêmes contraintes qu'en 1.2, mêmes classes utilitaires ad hoc (les tokens arrivent en 1.7)

- [ ] **Task 4 — Appel de la RPC** (AC: 1, 3)
  - [ ] `supabase.rpc("create_household_with_profile", { p_household_name, p_display_name })` **depuis le navigateur** via `lib/supabase/client.ts` — client-direct (AD-13). Ce n'est ni un jeton ni une invitation : ce n'est pas de l'irréductible serveur
  - [ ] La fonction est `security definer` : elle crée le foyer **et** le profil en une transaction. **N'écris jamais toi-même dans `households` puis `profiles`** — deux écritures séparées ne sont pas atomiques et laisseraient un foyer orphelin en cas d'échec
  - [ ] Empêcher la double soumission (bouton désactivé pendant l'appel). Et **traiter `Profile already exists` comme un succès** : c'est la course des deux clics, l'état visé est atteint
  - [ ] Traduire les erreurs, **jamais rendre le message brut** (NFR-8) — la RPC lève en anglais (`Not authenticated`, `Profile already exists`). Voir « Microcopy imposée »
  - [ ] Après succès, rediriger vers `/`. Ne recharge pas la session : `current_household_id()` prend effet immédiatement (piège n°3)

- [ ] **Task 5 — Établir la discipline de migrations** (AC: 1)
  - [ ] **Aucune migration à écrire dans cette story** — voir piège n°4. La RPC existe, elle est déployée, elle fait exactement ce que l'AC1 demande
  - [ ] Ce que l'AC1 réclame réellement, c'est la **convention** que l'Architecture Spine laisse ouverte (`Deferred` → « Discipline de migration incrémentale … à établir »). L'écrire dans `docs/migrations.md` : nommage horodaté, caractère strictement additif, procédure d'application au projet déployé, et vérification qu'un fichier appliqué n'est plus jamais modifié
  - [ ] Mentionner que le projet n'est **pas encore relié** au CLI Supabase en local (`supabase link` non joué, aucun `supabase/config.toml`) — c'est le préalable à toute migration future
  - [ ] Référencer ce document depuis `README.md`, à côté de `docs/configuration.md`

- [ ] **Task 6 — Vérifier l'isolation pour de vrai** (AC: 2)
  - [ ] Une fois le foyer créé, contrôler avec **la session du navigateur** (jamais de clé de service, AD-2) que `current_household_id()` renvoie désormais l'identifiant du foyer
  - [ ] Vérifier que `select * from aisles` rend **11 lignes** — celles que la RPC a amorcées (piège n°1). C'est la preuve exécutable que l'isolation fonctionne : ces lignes ne sont visibles que parce que la politique RLS résout le foyer
  - [ ] **Le contrôle qui compte vraiment (NFR-5)** : créer un **second** compte, lui faire créer un **second** foyer, et vérifier depuis la session du premier qu'aucune ligne du second n'est lisible — ni `households`, ni `profiles`, ni `aisles`. Deux comptes sont possibles : le foyer en compte deux
  - [ ] Consigner les résultats dans le Dev Agent Record

- [ ] **Task 7 — Vérification** (AC: 1, 2, 3)
  - [ ] `npm run typecheck` · `npm run lint` · `npm run build` → tous en succès, sans avertissement
  - [ ] `git status --short supabase/` vide — **aucune migration**
  - [ ] Grep des mots bannis dans les chaînes rendues (NFR-9) et absence de `force-dynamic`
  - [ ] Parcours manuel : nouveau compte → connexion → arrivée sur `/onboarding` → saisie des deux noms → arrivée sur `/` nommant le foyer
  - [ ] Parcours AC3 : se déconnecter puis se reconnecter → arrivée **directe** sur `/`, aucun appel de création. Et `/onboarding` visité à la main → renvoi vers `/`

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
- **AR-MIGRATIONS** — schéma **déployé et gelé**. `git status --short supabase/` doit rester vide
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
    client.ts              inchangé
    server.ts              inchangé
    proxy.ts               INCHANGÉ — la garde ne va pas là
proxy.ts                   inchangé — n'ajoute PAS /onboarding aux routes publiques
docs/
  migrations.md         +  discipline de migrations (Task 5)
supabase/                  INTACT — aucune migration
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

1. **Le nom du foyer, on le demande ou on l'invente ?** La base l'exige (`households.name` est `not null`), mais l'AC ne le mentionne pas. Je pars sur **on le demande** — un champ « le nom de chez toi », parce qu'il apparaîtra plus tard sur l'écran profil et dans l'invitation. L'alternative serait de le dériver du prénom (« Chez Florian ») et de le rendre modifiable en 1.6. Dis-moi si tu préfères ça : c'est un champ de moins à l'inscription.
2. **`supabase gen types`** — troisième fois que la question revient. Cette story est la première à appeler une RPC : sans types générés, `data` est `any` et la signature n'est vérifiée par rien. Le coût d'une divergence silencieuse commence ici. Story de maintenance dédiée ?

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Changement |
|---|---|
| 2026-07-26 | Story créée. Statut → `ready-for-dev` |
