---
baseline_commit: 6acbb045518ddc5631c3dd8fff1cd17fc816b517
---

# Story 1.4: Générer un code d'invitation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a membre d'un foyer (Florian),
I want générer un code d'invitation depuis l'application et le partager,
so that ma conjointe puisse rejoindre le foyer — aujourd'hui la fonction existe en base mais aucun bouton ne l'appelle.

## Acceptance Criteria

**AC1 — Générer**
**Given** un membre d'un foyer sur la surface web
**When** il demande « inviter quelqu'un »
**Then** un code d'invitation est généré (`generate_household_invite`) avec une durée de validité et un nombre d'usages limités, et affiché de façon partageable

**AC2 — Consulter**
**Given** un code généré
**When** le membre consulte l'invitation
**Then** le code, sa date d'expiration et son nombre d'usages restants sont lisibles, sans aucun jargon technique

**AC3 — Refuser les non-membres**
**Given** un membre non autorisé ou une identité d'appareil (non-humaine)
**When** une génération de code est tentée
**Then** elle est refusée — seul un membre humain du foyer peut émettre une invitation (AD-9/AD-16)

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.4 — cité verbatim]

## Tasks / Subtasks

- [x] **Task 1 — Server Action d'émission** (AC: 1, 3)
  - [x] `app/foyer/actions.ts` — `"use server"`. **C'est une Server Action, PAS un appel client-direct.** Ne recopie pas le motif de la Story 1.3 (voir « Le piège n°1 »)
  - [x] Appeler `requireProfile()` **avant** la génération : c'est ce qui matérialise l'AC3 côté application
  - [x] `supabase.rpc("generate_household_invite")` via `lib/supabase/server.ts` → `createClient()`. **Aucun argument** : la fonction n'en prend pas (types générés : `Args: never`)
  - [x] Après succès, relire la ligne créée (`household_invites` filtré sur le code retourné) pour récupérer `expires_at` et `uses_remaining` — **la fonction ne rend que le code**
  - [x] Traduire les erreurs, **jamais rendre le message brut** (NFR-8). La fonction lève `No household for current user` en anglais
  - [x] `revalidatePath("/foyer")` pour que la page affiche l'invitation fraîche

- [x] **Task 2 — Écran foyer** (AC: 1, 2)
  - [x] `app/foyer/page.tsx` — Server Component, **route protégée** (ne pas toucher `PUBLIC_ROUTES`). Appelle `requireProfile()`
  - [x] Lit l'invitation **en cours** : la plus récente dont `expires_at > now()` **et** `uses_remaining > 0`. Rien en base ne fait ce tri — c'est à la requête de le faire (`order` + `limit 1`)
  - [x] ⚠️ **La page ne génère JAMAIS de code à l'affichage.** L'AC1 dit « il demande » : la génération est une action explicite. Une page qui émet à chaque rendu remplirait la table à chaque rafraîchissement
  - [x] Deux états : aucune invitation en cours → un bouton « Inviter quelqu'un » ; une invitation en cours → le code, sa validité, ses usages restants, et le moyen de le copier
  - [x] `app/foyer/InviteCard.tsx` — Client Component pour la copie et le retour visuel. Le reste peut rester serveur
  - [x] Cibles ≥ 44px, anneau de focus visible, aucune couleur d'alerte — mêmes contraintes qu'en 1.2 et 1.3

- [x] **Task 3 — Rendre le code partageable** (AC: 1, 2)
  - [x] Afficher le code **en gros, en majuscules, espacé** — il sera lu à voix haute ou recopié à la main. `tabular-nums` (UX-DR12) et `letter-spacing` généreux
  - [x] Bouton « Copier » via `navigator.clipboard.writeText` + confirmation en `aria-live`. Prévoir le cas où l'API n'est pas disponible : le code reste sélectionnable à la main
  - [x] **N'utilise pas `navigator.share`** : la cible de partage système appartient à l'Epic 6 (FR-33), et rien ici ne la prescrit
  - [x] Exprimer la validité **en français lisible**, pas en horodatage brut : « encore 6 jours », « 5 personnes peuvent encore l'utiliser ». Vérifié : `lib/dates.ts` **ne contient rien d'utilisable ici** (uniquement des utilitaires de grille hebdomadaire pour l'Epic 3) — écris le calcul sur place, quelques lignes suffisent, et n'ajoute **aucune dépendance de date**

- [x] **Task 4 — Vérifier l'AC3 pour de vrai** (AC: 3)
  - [x] Avec la session d'un membre : la génération réussit
  - [x] Avec **la clé publiable seule** (aucune session) : `rpc/generate_household_invite` doit **échouer** — `current_household_id()` vaut `NULL`, la fonction lève. C'est le contrôle de l'AC3 réalisable aujourd'hui
  - [x] Avec la session d'un membre d'un **autre** foyer : le code généré appartient à *son* foyer, et n'est pas lisible depuis le premier. Réutiliser le compte témoin si tu le recrées, ou en créer un
  - [x] Consigner les résultats dans le Dev Agent Record

- [x] **Task 5 — Vérification** (AC: 1, 2, 3)
  - [x] `npm run typecheck` · `npm run lint` · `npm run build` → succès sans avertissement
  - [x] `git status --short supabase/migrations/` vide — **aucune migration**
  - [x] Grep des mots bannis dans les chaînes rendues (NFR-9) ; aucun `force-dynamic`
  - [x] `/foyer` et `/foyer/quoi-que-ce-soit` en anonyme → redirigés vers `/login`
  - [x] Parcours manuel : `/foyer` → « Inviter quelqu'un » → un code apparaît → rafraîchir la page → **le même code**, pas un nouveau
  - [x] Vérifier en base qu'**une seule ligne** a été créée pour un seul clic

## Dev Notes

### Ce que cette story est, et n'est pas

Elle pose le bouton qui manque. **La fonction existe déjà en base, déployée et fonctionnelle** — il n'y a rien à écrire côté Postgres, et rien à migrer.

Elle ne fait **pas** entrer l'invité : saisir le code et rejoindre le foyer, c'est la **Story 1.5** (`redeem_household_invite`). À la fin de cette story-ci, Florian peut produire un code et le lire à voix haute ; personne ne peut encore s'en servir.

| N'implémente pas | Appartient à |
|---|---|
| Saisir un code, rejoindre un foyer | **Story 1.5** |
| Écran profil, prénom modifiable, liste des membres | **Story 1.6** |
| Révoquer / supprimer une invitation | *non demandé* — voir « Ce que la base permet et qu'on ne fait pas » |
| Tokens de couleur, thème | **Story 1.7** |
| Identités d'appareil | **Epic 5** |
| Cible de partage système | **Epic 6** (FR-33) |
| Framework de test | **Story 4.15** |

### Le piège n°1 — c'est une Server Action, pas un appel client-direct

La Story 1.3 appelait sa fonction Postgres **depuis le navigateur**. Le réflexe naturel est de recopier ce motif. **Ici c'est faux.**

AD-13 nomme explicitement l'exception :

> « Server Actions / route handlers réduites à l'irréductible serveur : callback magic-link, **émission de jetons d'appareil + invitations**. »

Et AD-16 : le code d'invitation est « émis depuis le **web** ». L'émission d'une invitation est donc, par décision d'architecture, du travail serveur — au même titre que le callback de connexion.

**En pratique :** `app/foyer/actions.ts` avec `"use server"`, client obtenu par `lib/supabase/server.ts` → `createClient()`. Pas de `lib/supabase/client.ts` sur ce chemin.

### Le piège n°2 — le commentaire du schéma est faux sur le format du code

Le commentaire annonce « 8-char base32 ». Le code réel :

```sql
v_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
```

C'est **8 caractères hexadécimaux en majuscules** — alphabet `0-9A-F`, pas base32. Trois conséquences :

1. **Ne construis rien qui suppose du base32** (pas de validation de format sur un alphabet de 32 caractères).
2. **Bonne nouvelle pour la lisibilité** : l'hexadécimal majuscule ne contient ni `O` ni `I` ni `L`, donc aucune confusion possible avec `0` et `1`. Un code lu à voix haute passe bien. Ne « corrige » pas l'alphabet.
3. **Le code est sensible à la casse au moment de l'échange.** `redeem_household_invite` fait `where code = p_code`, sans `upper()`. Les codes émis sont en majuscules : la Story 1.5 devra normaliser la saisie. **Affiche donc le code en majuscules, sans ambiguïté** — c'est ce qui rendra la 1.5 possible.

### Le piège n°3 — la fonction ne rend que le code

```sql
create or replace function generate_household_invite() returns text
```

Elle ne prend **aucun paramètre** et ne rend **que le code**. Deux conséquences directes sur l'AC :

- **La durée et le nombre d'usages ne sont pas choisis** : ils viennent des valeurs par défaut de la table — `expires_at` = `now() + interval '7 days'`, `uses_remaining` = `5`. L'AC1 (« durée de validité et nombre d'usages limités ») est satisfaite par la base, pas par toi. **N'essaie pas de passer des paramètres**, il n'y en a pas.
- **Pour l'AC2, il faut relire la ligne.** Après la génération, un `select` sur `household_invites` filtré sur le code retourné donne `expires_at` et `uses_remaining`. La RLS l'autorise (`invites_select_own` sur `household_id = current_household_id()`).

Structure exacte de la table, vérifiée dans le schéma déployé :

```sql
create table household_invites (
  code           text primary key,
  household_id   uuid not null references households(id) on delete cascade,
  created_by     uuid references auth.users(id) on delete set null,
  expires_at     timestamptz not null default (now() + interval '7 days'),
  uses_remaining int  not null default 5,
  created_at     timestamptz not null default now()
);
```

### Le piège n°4 — générer n'invalide pas les codes précédents

Chaque appel **insère une ligne de plus**. Rien ne périme ni ne supprime les codes antérieurs : plusieurs codes valides peuvent coexister pour le même foyer, chacun avec ses 5 usages.

Ce n'est pas un défaut à corriger ici (aucun AC ne le demande, et la base est gelée), mais ça impose deux choses :

1. **La page ne doit pas générer à l'affichage.** Sinon chaque rafraîchissement crée un code. C'est l'erreur qui remplirait la table en silence.
2. **Il faut définir « l'invitation en cours »** — l'AC2 parle d'*une* invitation. Retiens la plus récente encore valable :

   ```
   .from("household_invites")
   .select("code, expires_at, uses_remaining")
   .gt("expires_at", new Date().toISOString())
   .gt("uses_remaining", 0)
   .order("created_at", { ascending: false })
   .limit(1)
   .maybeSingle()
   ```

   Pas de filtre sur `household_id` : la RLS s'en charge déjà, et l'ajouter à la main donnerait l'illusion que c'est *lui* qui protège.

### L'AC3 est vraie aujourd'hui — mais pour une raison qui va disparaître

L'AC3 exige qu'une **identité d'appareil** ne puisse pas émettre d'invitation. Or les identités d'appareil (`device_credentials`, AD-9) **n'existent pas encore** : elles arrivent en Epic 5. L'AC est donc satisfaite par construction, et voici pourquoi exactement :

```sql
create or replace function current_household_id() … as $$
  select household_id from profiles where id = auth.uid()
$$;
```

`current_household_id()` ne résout le foyer **que depuis `profiles`** — c'est-à-dire depuis un humain. Une identité non-humaine n'a pas de profil, obtient `NULL`, et `generate_household_invite` lève `No household for current user`.

> ⚠️ **Le trou futur, à tracer.** AD-9 prévoit que `current_household_id()` résolve le foyer **« depuis le profil humain *ou* le claim du jeton »**. Le jour où l'Epic 5 étendra cette fonction, une identité d'appareil obtiendra un `household_id` — et pourra alors **émettre des invitations**, ce que l'AC3 interdit explicitement. La protection actuelle est un effet de bord, pas une garde.
>
> **Rien à faire dans cette story** (la base est gelée, et l'Epic 5 n'existe pas). Mais **consigne-le dans `deferred-work.md`** : quand l'Epic 5 étendra `current_household_id()`, `generate_household_invite` devra vérifier explicitement que l'appelant est un humain (par exemple `exists (select 1 from profiles where id = auth.uid())`).

Ce que tu peux vérifier **aujourd'hui**, c'est la moitié réalisable : sans session, l'appel échoue (Task 4).

### Ce que la base permet et qu'on ne fait pas

`invites_delete_own` existe : un membre **pourrait** supprimer une invitation, donc la révoquer. Aucun AC ne le demande, et la Story 1.6 ne le prévoit pas non plus. **Ne l'implémente pas** — c'est noté pour que la revue ne le prenne pas pour un oubli.

De même, rien ne purge les invitations expirées. Sans conséquence à cette échelle.

### Où poser l'écran — et la frontière avec la Story 1.6

Le contrat d'expérience range le code d'invitation dans la zone **« Foyer & appareils »**, sur le web, aux côtés du prénom, des membres et des appareils. Or l'écran qui porte tout cela est la **Story 1.6** (« Écran profil & membres du foyer »), qui arrive *après*.

**Décision retenue : créer `/foyer` maintenant, avec la seule invitation dedans**, et laisser la Story 1.6 l'enrichir du prénom et de la liste des membres. On évite ainsi un renommage de route, et l'invitation est immédiatement atteignable.

Ajoute un lien discret vers `/foyer` depuis l'accueil — sinon la page est injoignable autrement qu'en tapant l'URL, et l'AC1 (« un membre **demande** ») ne serait pas réalisable dans le produit. Reste sobre : l'accueil n'est pas encore un tableau de bord.

*(Si tu préfères `/profil`, voir la Question 1 — c'est une décision de Florian, pas la tienne.)*

### Microcopy imposée (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache. Ce parcours n'a **pas** été maquetté : liberté de composition, pas de ton.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre de la page | « Ton foyer » | « Gestion du foyer » |
| Bouton de génération | « Inviter quelqu'un » | « Générer un code d'invitation » |
| Présentation du code | « Donne-lui ce code » | « Voici le token d'invitation » |
| Validité | « Encore 6 jours » | « Expire le 02/08/2026 à 14:32 » |
| Usages restants | « 5 personnes peuvent encore s'en servir » | « uses_remaining : 5 » |
| Bouton de copie | « Copier » → « Copié ! » | « Copier dans le presse-papiers » |
| Échec de génération | « Ça n'a pas marché. Réessaie dans un instant. » | le message de la base |
| Aucune invitation | « Personne n'est encore invité. » | « Aucun enregistrement » |

Un mot d'explication au-dessus du code aide vraiment ici : la personne invitée devra créer son accès **avec ce code**, et rien d'autre. Dis-le simplement.

### Frontière Story 1.7 — mêmes contraintes qu'en 1.2 et 1.3

Les tokens de `DESIGN.md` arrivent en 1.7. Continue avec les utilitaires Tailwind ad hoc déjà employés — regarde `app/onboarding/CreateHouseholdForm.tsx` et reprends ses classes plutôt que d'en inventer.

Trois interdits fermes : **aucun thème câblé en dur**, **aucune couleur d'accent ni rouge d'erreur**, **anneau de focus visible** (jamais `outline-none` ni `outline-hidden`).

Le code d'invitation est le premier élément du produit qui mérite d'être *gros*. Tu peux lui donner de la présence par la **taille et l'espacement**, pas par la couleur.

### Contraintes d'architecture applicables

- **AD-16** — le foyer se rejoint par magic link **+ code d'invitation à durée et usages limités**, émis **depuis le web**. Un appareil n'est jamais promu membre
- **AD-13** — **l'émission d'invitations est nommément de l'irréductible serveur.** Server Action, pas client-direct. **N'ajoute pas `force-dynamic`**
- **AD-2** — RLS non contournable, **jamais de clé de service**. Ne filtre pas sur `household_id` à la main comme s'il s'agissait de la protection
- **AD-1** — toute règle métier vit en Postgres. La génération, la durée et le compteur d'usages sont dans la base ; le TypeScript n'en réimplémente rien
- **AD-9 / NFR-6** — un appareil n'est pas une personne. Voir « L'AC3 est vraie aujourd'hui »
- **AR-MIGRATIONS** — schéma **déployé et gelé**. `git status --short supabase/migrations/` doit rester vide

### Standards de test

**Aucun framework de test, et il ne faut pas en introduire ici.** Tests planifiés en Story 4.15. Vérification exécutable et manuelle : `typecheck`, `lint`, `build`, les greps, le parcours de la Task 5, et **surtout la Task 4** — c'est la seule qui touche à l'AC3.

⚠️ **Deux pièges d'outillage établis :**
- `npm run build | grep …` ne rend jamais la main. **Rediriger vers un fichier.**
- Après suppression d'une route, `typecheck` peut échouer sur un validateur périmé sous `.next/dev/types/`. **Purger `.next` avant de conclure à une régression.**

### Project Structure Notes

```
app/
  foyer/
    page.tsx            +  Server Component, requireProfile(), lit l'invitation en cours
    actions.ts          +  "use server" — émission (AD-13)
    InviteCard.tsx      +  Client Component — copie + retour visuel
  page.tsx              ~  lien discret vers /foyer
  onboarding/              inchangé — référence de style
lib/
  supabase/
    queries.ts             inchangé — requireProfile() réutilisé tel quel
    server.ts              inchangé
    client.ts              PAS utilisé sur ce chemin
    types.ts               inchangé (générés — ne pas éditer à la main)
  dates.ts                 SANS rapport (grille hebdo, Epic 3) — ne pas y chercher
proxy.ts                   inchangé — n'ajoute PAS /foyer aux routes publiques
supabase/                  INTACT — aucune migration
```

### Intelligence des stories précédentes (1.2 et 1.3)

- **Les appels Supabase ne lèvent pas, ils retournent `{ data, error }`.** Vrai pour `rpc()` comme pour `select()`. **Teste `error` explicitement** — un `try/catch` seul ne verrait rien passer. Ce piège a mordu deux fois sur ce dépôt.
- **`redirect()` de Next lève une exception que le framework intercepte** — ne l'enveloppe jamais dans un `try/catch`.
- **Le typage mord vraiment** depuis la Story 1.3 : les clients sont paramétrés `<Database>`. Un nom de fonction, de table ou de colonne inexistant **échoue au typecheck**. Sers-t'en : si ça compile, les noms sont bons.
- **Mesure au lieu de supposer.** La 1.2 a livré une affirmation fausse (« les modèles d'email sont configurés ») parce qu'elle était *déduite* et non mesurée. La Task 4 est exactement de ce genre : ne conclus pas que l'AC3 tient parce que le raisonnement est convaincant — exécute l'appel sans session et regarde ce qui revient.
- **Motifs de code à reprendre** : `app/onboarding/page.tsx` (Server Component + garde + délégation à un Client Component), `CreateHouseholdForm.tsx` (gestion d'erreur par code traduit, classes ad hoc conformes à la frontière 1.7).

### Intelligence git

`6acbb04` est la base de cette story. Convention établie : **Conventional Commits**, scope en tête, corps en français ; branche dédiée → PR → **squash merge** une fois la CI verte.

La CI (`.github/workflows/ci.yml`) rejoue exactement `typecheck`, `lint`, `build` sur Node 22. Si les trois passent en local, elle passe.

**Le serveur de développement écoute sur le port 3333** depuis `6acbb04`.

### État vérifié de l'environnement (2026-07-27)

- **Production en ligne** sur `nutri.florianmarin.me`, service d'envoi d'emails dédié opérationnel, modèles d'email conformes
- **Un foyer réel existe** : « Marin », profil « Florian », 11 rayons. `current_household_id()` résout — **tu peux donc générer une invitation immédiatement**, sans rien créer d'abord
- Un compte témoin `flomarin88+nc1@gmail.com` et son « Foyer temoin » ont pu être supprimés depuis le tableau de bord. **Si tu as besoin d'un second foyer pour la Task 4, il faudra le recréer**
- `.env.local` est renseigné, le serveur local parle au projet réel

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10**).

Signature générée pour cette fonction (`lib/supabase/types.ts`) :

```ts
generate_household_invite: { Args: never; Returns: string }
```

`Args: never` signifie **aucun argument**. Écris `supabase.rpc("generate_household_invite")` sans second paramètre ; si le typage réclame autre chose, c'est le signe que tu t'es trompé de fonction.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] — user story et 3 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements-Inventory] — FR-41, FR-40, FR-43 ; NFR-5, NFR-6, NFR-8, NFR-9
- [Source: …/ARCHITECTURE-SPINE.md#Invariants-&-Rules] — **AD-13** (invitations = irréductible serveur), AD-16, AD-9, AD-2, AD-1
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md#Information-Architecture] — zone « Foyer & appareils », surface web
- [Source: …/EXPERIENCE.md#Voice-and-Tone] — tutoiement, mots bannis
- [Source: _bmad-output/implementation-artifacts/1-3-creer-un-foyer-a-l-inscription.md] — motifs de code, garde `requireProfile()`, pièges d'outillage
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — dette de revue, résidus de test
- **Schéma déployé, lu directement** (`supabase/migrations/20260502000000_initial_schema.sql`) : `household_invites` (59-68), `generate_household_invite` (436-455), `current_household_id()` (48-56), politiques `invites_*` (265-273). **Ne pas toucher**

## Questions pour Florian

*Les deux questions ont été tranchées le 2026-07-27, avant implémentation. Conservées pour la traçabilité.*

1. ~~**`/foyer` ou `/profil` ?**~~ — **`/foyer`.** La Story 1.6 enrichira cette même route du prénom et de la liste des membres, sans renommage.
2. ~~**Faut-il pouvoir annuler une invitation ?**~~ — **non, pas pour l'instant.** `invites_delete_own` reste inutilisé. Conséquence assumée et à ne pas traiter comme un défaut en revue : générer un nouveau code **n'invalide pas l'ancien**, et plusieurs codes peuvent rester valables sept jours en parallèle.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Vérification (2026-07-27)

| Commande | Résultat |
|---|---|
| `npm run typecheck` · `lint` · `build` | exit 0, **0 avertissement** |
| `git status --short supabase/` | vide |

**Contrôle d'accès** — `/foyer` et `/foyer/nimporte` en anonyme → `307` vers `/login?next=…`. Route protégée sans toucher au proxy.

**AC3, moitié réalisable aujourd'hui** — appel de `rpc/generate_household_invite` avec la seule clé publiable, sans session :

```
{"code":"P0001","message":"No household for current user"}   [http 400]
```

Et la lecture de `household_invites` sans session rend `[]`.

**AC1 / AC2 — parcours réel.** Un clic sur « Inviter quelqu'un » produit `388B626A` : **8 caractères hexadécimaux majuscules**, ce qui confirme le piège n°2 (le commentaire du schéma annonce « base32 », c'est faux). L'écran affiche « Encore 7 jours. 5 personnes peuvent encore s'en servir. »

**La page n'émet pas au rendu** — trois chargements successifs de `/foyer` puis un rechargement complet : **le même code**, et **une seule ligne en base** pour un seul clic. C'était le risque principal de cette story.

**Isolation des invitations (NFR-5), les deux sens.** Un second foyer a été créé et a généré son propre code :

| Depuis la session… | Invitations visibles | Lecture ciblée du code voisin |
|---|---|---|
| **Florian** (« Marin ») | `["388B626A"]` | `code=eq.4A1EA59C` → **0 ligne** |
| **Témoin 2** | `["4A1EA59C"]` | `code=eq.388B626A` → **0 ligne** |

C'est le contrôle le plus sévère possible sur cette table : `code` **est la clé primaire**, donc l'interroger par sa valeur exacte est la requête la plus directe qui soit — et elle ne rend rien.

**Deux constats de bord, gratuits :**

1. **Le `next` traverse bien l'email jusqu'à une destination autre que `/`.** Le lien portait `next=%2Ffoyer` et le parcours a bien abouti sur `/foyer`. La Story 1.2 n'avait jamais éprouvé que la racine.
2. **Le modèle d'email rend exactement le balisage prévu** — vérifié sur le corps réellement reçu.

### Completion Notes List

**Livré en entier : les cinq tâches.** Aucune migration, aucune dépendance ajoutée, proxy et clients Supabase inchangés.

**Le piège n°1 a été respecté, et il comptait.** L'émission passe par une Server Action (`app/foyer/actions.ts`, `"use server"`), pas par le client navigateur — vérifié par grep : aucun import de `lib/supabase/client` sous `app/foyer/`. C'est l'inverse de la Story 1.3, et l'écart est intentionnel (AD-13 nomme les invitations comme irréductible serveur).

**Un refactor imposé par le linter, qui a amélioré le code.** La première version calculait les jours restants dans le corps du Server Component, avec `Date.now()`. `npm run lint` a refusé : *« Cannot call impure function during render »*. La lecture d'horloge et la requête ont été sorties dans `app/foyer/invitation.ts`, hors du composant. Le résultat est meilleur : la notion d'« invitation en cours » vit désormais dans un seul endroit nommé, réutilisable par la Story 1.6.

**Un écart de forme assumé.** La Task 1 demandait de relire la ligne créée « pour récupérer `expires_at` et `uses_remaining` ». L'action relit bien la ligne par son code exact, mais **ne renvoie pas ces valeurs** : c'est la page qui les lit, après `revalidatePath`. Les afficher depuis deux sources aurait créé deux notions d'« invitation en cours ». La relecture garde tout son sens — elle confirme que la ligne créée est bien **visible sous la RLS du foyer**, ce qui n'allait pas de soi et qui aurait produit un code affiché mais jamais relisible.

**Ce que la base impose, et qu'on n'a pas cherché à contourner.** La fonction ne prend aucun argument : les 7 jours et les 5 usages viennent des valeurs par défaut de la table. L'AC1 est donc satisfaite par le schéma, pas par le client. Rien n'a été réimplémenté en TypeScript.

**Écart de méthode assumé — pas de TDD.** Le workflow impose un cycle red-green-refactor ; la story l'interdit (aucun framework de test, planifiés en Story 4.15). Vérification exécutable et manuelle, comme prescrit.

**Résidu de test à retirer.** Le contrôle d'isolation a créé un compte `flomarin88+nc2@gmail.com`, son foyer « Foyer temoin 2 », ses 11 rayons et son invitation `4A1EA59C`. L'application ne peut pas les supprimer — aucune politique n'autorise le `delete` sur `households` ni `profiles`. Ménage depuis le tableau de bord : *Authentication → Users*, supprimer l'utilisateur, puis le foyer orphelin (la cascade emporte rayons et invitation).

### File List

**Nouveaux**
- `app/foyer/page.tsx` — Server Component, garde `requireProfile()`
- `app/foyer/actions.ts` — Server Action d'émission (AD-13)
- `app/foyer/invitation.ts` — lecture de l'invitation en cours, hors composant
- `app/foyer/InviteCard.tsx` — Client Component : affichage, copie, génération

**Modifiés**
- `app/page.tsx` — lien discret vers `/foyer`, sans quoi l'écran serait injoignable

**Inchangés, vérifiés**
- `lib/supabase/{client,server,proxy,queries,types}.ts`, `proxy.ts` — `git diff` vide
- `package.json`, `package-lock.json` — **aucune dépendance ajoutée**
- `supabase/` — **aucune migration**

### File List

## Change Log

| Date | Changement |
|---|---|
| 2026-07-27 | Story créée. Statut → `ready-for-dev` |
| 2026-07-27 | Deux questions tranchées par Florian avant implémentation : la route est `/foyer` (la Story 1.6 l'enrichira), et l'annulation d'une invitation reste hors périmètre — plusieurs codes valables en parallèle est donc un comportement attendu, pas un défaut |
| 2026-07-27 | Implémentation et vérification complètes : écran `/foyer`, émission en Server Action, code `388B626A` produit et affiché, page non-émettrice au rendu confirmée, isolation des invitations prouvée dans les deux sens. Statut → `review` |
