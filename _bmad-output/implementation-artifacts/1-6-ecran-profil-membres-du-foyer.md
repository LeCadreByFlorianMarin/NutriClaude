---
baseline_commit: 6f00fad
---

# Story 1.6: Écran profil & membres du foyer

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a membre du foyer,
I want consulter et modifier mon prénom affiché et voir les autres membres,
so that le foyer soit lisible comme un espace partagé à plusieurs personnes.

## Acceptance Criteria

**AC1 — Consulter**
**Given** un membre authentifié rattaché à un foyer
**When** il ouvre l'écran profil
**Then** il voit son prénom affiché, modifiable, et la liste des autres membres du foyer (FR-42, FR-43)

**AC2 — Modifier**
**Given** un membre qui modifie son prénom affiché
**When** il enregistre
**Then** le nouveau prénom est persisté et visible par les autres membres

**AC3 — Les appareils sont annoncés, pas promis**
**Given** l'écran profil
**When** il est affiché en v1
**Then** la zone « appareils rattachés » est présente mais annoncée comme à venir (sa gestion réelle arrive avec les identités d'appareil de l'Epic 5) — aucune fonctionnalité d'appareil n'est promise ici

**AC4 — Le ton**
**Given** n'importe quel libellé de cet écran
**When** il est rendu
**Then** il respecte le ton français familier et n'affiche aucun mot banni (synchronisation, jeton, API, etc. — NFR-9)

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.6 — cité verbatim]

> ⚠️ **C'est la story qui rend le partage *visible*.** La 1.5 a prouvé en base que deux humains se voient ; ici, ils se voient à l'écran. C'est aussi la dernière story fonctionnelle de l'Epic 1 : après elle, il ne reste que les fondations de thème (1.7).

## Tasks / Subtasks

- [x] **Task 1 — L'écran vit sur `/foyer`, pas ailleurs** (AC: 1)
  - [x] **N'ouvre pas de route `/profil`.** `app/foyer/page.tsx` porte déjà le commentaire écrit par la Story 1.4 : *« la Story 1.6 y ajoutera le prénom modifiable et la liste des membres, sur cette même route »*. Une seconde route dupliquerait la garde, le titre et le nom du foyer pour rien
  - [x] La page reste un **Server Component** avec `requireProfile()` en tête. Elle a déjà le profil (`id`, `household_id`, `display_name`) : **ne re-interroge pas `profiles` pour toi-même**
  - [x] Composer l'écran dans cet ordre : nom du foyer (h1) → ton prénom → les membres → l'invitation (`InviteCard`, **inchangé**) → les appareils
  - [x] `InviteCard.tsx`, `actions.ts` et `invitation.ts` **ne doivent pas être touchés**. Ils sont corrects et vérifiés par la Story 1.4
  - [x] Ne touche pas `PUBLIC_ROUTES` : `/foyer` est déjà protégée
  - [x] Retirer le commentaire d'annonce devenu faux dans `page.tsx` une fois la greffe faite

- [x] **Task 2 — Lire les membres** (AC: 1)
  - [x] `app/foyer/membres.ts` — module serveur, sur le modèle exact de `invitation.ts` (fonction `async`, retourne un type nommé, aucune JSX)
  - [x] `select("id, display_name").order("created_at")` sur `profiles`. **Aucun filtre `household_id` à la main** — la RLS s'en charge, et l'ajouter laisserait croire que c'est lui qui protège (même raisonnement que `invitation.ts`)
  - [x] La requête **te ramène toi aussi** (`profiles_select_own_household` : `household_id = current_household_id() or id = auth.uid()`). C'est voulu : afficher les deux membres et marquer le sien se lit mieux qu'une liste « des autres » vide quand on est seul
  - [x] `order("created_at")` ascendant : le créateur du foyer en premier, les arrivants ensuite. Un ordre stable évite que la liste danse d'un rendu à l'autre
  - [x] **N'affiche aucune date** (« membre depuis… ») : lire l'horloge pendant le rendu est interdit (constat de la Story 1.4), et rien ne le demande

- [x] **Task 3 — Prénom modifiable** (AC: 1, 2)
  - [x] `app/foyer/DisplayNameForm.tsx` — Client Component, un seul champ, prérempli avec le prénom courant reçu en prop
  - [x] `supabase.from("profiles").update({ display_name }).eq("id", profil.id)` **depuis le navigateur** via `lib/supabase/client.ts` — client-direct, comme les Stories 1.3 et 1.5, **pas** une Server Action comme la 1.4. Voir « Le piège n°2 »
  - [x] ⚠️ **N'envoie que `display_name` dans le payload.** Jamais l'objet profil entier, jamais `household_id`. Voir « Le piège n°1 » — c'est la règle la plus importante de cette story
  - [x] ⚠️ **Enchaîner `.select("display_name").maybeSingle()`** sur l'`update`. Sans lecture de retour, un refus de la RLS ne rend **aucune erreur** : zéro ligne touchée, `error` à `null`, et l'écran annoncerait un succès qui n'a pas eu lieu. Voir « Le piège n°3 »
  - [x] `trim()` avant envoi ; refuser un prénom vide ou tout en espaces avec un message français. La colonne est `not null` mais **accepte la chaîne vide** — la base ne te protégera pas
  - [x] Empêcher la double soumission (bouton désactivé), confirmation en `aria-live`, cibles ≥ 44px, anneau de focus visible, **aucune couleur d'alerte** (la palette arrive en 1.7)
  - [x] Après succès : `router.refresh()` pour que la liste des membres et l'accueil reflètent le nouveau prénom. **`revalidatePath` n'existe pas côté client** — ne le cherche pas
  - [x] Ne pas rediriger : on reste sur l'écran, on confirme sur place

- [x] **Task 4 — Les appareils, annoncés et rien de plus** (AC: 3)
  - [x] Une zone visible, titrée, avec une phrase qui dit que ça arrive. C'est tout
  - [x] ⚠️ **`device_credentials` n'existe pas dans le schéma gelé** — vérifié. Aucune requête possible, aucune table à créer, aucune migration. Voir « Le piège n°4 »
  - [x] Aucun bouton, aucun champ, aucun compteur : une zone qui *paraît* interactive est une promesse non tenue
  - [x] Le mot **« jeton » est banni** (NFR-9), et « appairage » est du jargon. Parle d'écrans et de téléphones

- [x] **Task 5 — Vérifier le partage à l'écran** (AC: 1, 2)
  - [x] ✅ **Le second membre existe** : compte `flomarin88+nc3@gmail.com`, profil « Temoin3 », membre du foyer « Marin » (confirmé par Florian le 2026-07-27). **Tu as les deux sessions dont l'AC2 a besoin — ne crée pas de compte supplémentaire**
  - [x] Depuis la session de **Florian** : l'écran montre **2 membres**, le sien marqué comme tel
  - [x] Modifier le prénom, enregistrer, **recharger** : le nouveau prénom tient. Vérifier aussi l'accueil (`/`) — le « Salut … » doit suivre
  - [x] Depuis la session du **second membre** : le nouveau prénom de Florian est visible. **C'est l'AC2, et elle ne se vérifie que depuis l'autre session** → *vérifié par Florian en fenêtre privée : « Flo » et « Temoin3 »*
  - [ ] Vérifier l'état à un seul membre (session d'un compte seul dans son foyer, ou en supprimant temporairement le second) : l'écran ne doit pas afficher une liste vide sans explication → *écarté explicitement — exige la session de `+nc1`/`+nc2` ; la branche est écrite, elle n'est pas observée*
  - [x] Consigner le prénom avant/après dans le Dev Agent Record

- [x] **Task 6 — Vérification** (AC: 1, 2, 3, 4)
  - [x] `npm run typecheck` · `npm run lint` · `npm run build` → succès sans avertissement
  - [x] `git status --short supabase/` vide — **aucune migration**
  - [x] `git diff app/foyer/InviteCard.tsx app/foyer/actions.ts app/foyer/invitation.ts` → **vide**
  - [x] Grep des mots bannis dans les chaînes rendues (NFR-9) ; aucun `force-dynamic` ; aucune dépendance ajoutée
  - [ ] `/foyer` en anonyme → `/login` ; connecté sans profil → `/onboarding` → *anonyme vérifié ; « connecté sans profil » écarté explicitement — il exigerait un compte neuf, que cette story interdit de créer*
  - [x] Consigner tous les résultats dans le Dev Agent Record

## Dev Notes

### Le piège n°1 — la politique d'écriture sur `profiles` n'a pas de `with check`

```sql
create policy profiles_update_own on profiles for update
  using (id = auth.uid());
```

Aucun `with check`. En PostgreSQL, quand il est omis, **c'est l'expression `using` qui sert aussi de contrôle sur la ligne écrite**. Le contrôle porte donc uniquement sur `id` : **toutes les autres colonnes de ta propre ligne sont librement modifiables — `household_id` compris.**

Concrètement, un `update` qui embarquerait `household_id` déplacerait le membre dans un autre foyer, sans qu'aucune politique ne s'y oppose (il faudrait connaître l'uuid cible ; à l'échelle du foyer, la portée est nulle — mais la discipline, elle, est à ta charge).

**Ce que ça t'impose, et ce n'est pas négociable :**

```ts
// ✅ le seul champ que cette story a le droit d'écrire
.update({ display_name: prenomNet })

// ❌ jamais — un spread embarque household_id
.update({ ...profil, display_name: prenomNet })
```

Corriger la politique demanderait une migration sur une base gelée : **hors périmètre**. Consigne l'observation dans `deferred-work.md`.

### Le piège n°2 — client-direct, comme la 1.3 et la 1.5

Trois précédents coexistent dans ce dépôt : la 1.3 et la 1.5 appellent leur fonction **depuis le navigateur**, la 1.4 passe par une **Server Action** — et cette Server Action vit dans le fichier voisin (`app/foyer/actions.ts`). La proximité va te tenter. Résiste.

AD-13 nomme comme irréductible serveur « le callback magic-link, l'**émission** de jetons d'appareil + invitations ». **Renommer sa propre ligne n'est ni l'un ni l'autre** : c'est une écriture ordinaire, protégée par la RLS sur `id = auth.uid()`, exactement comme la création de foyer et le rachat d'invitation.

**Verdict : client-direct, via `lib/supabase/client.ts`.** `app/foyer/actions.ts` reste réservé à l'émission d'invitation et n'a rien à recevoir ici.

Conséquence pratique : la page est rendue côté serveur, donc **`router.refresh()` après succès** — c'est ce qui rejoue le Server Component et met à jour la liste des membres et le « Salut … » de l'accueil. Le motif exact est déjà écrit dans `JoinHouseholdForm.tsx` (lignes 84-85).

### Le piège n°3 — un `update` refusé ne rend aucune erreur

C'est la version « écriture » du piège qui a déjà mordu trois fois sur ce dépôt.

```ts
const { error } = await supabase.from("profiles").update({ display_name }).eq("id", id);
// error === null même si la RLS a refusé, même si aucune ligne ne correspond
```

Un `update` qui ne touche **aucune** ligne est un succès du point de vue de PostgREST. L'écran afficherait « c'est noté » sans que rien ne soit écrit — le pire des retours, parce qu'il est indétectable à l'usage jusqu'au rechargement.

**Le remède, en une ligne :**

```ts
const { data, error } = await supabase
  .from("profiles")
  .update({ display_name: prenomNet })
  .eq("id", profil.id)
  .select("display_name")
  .maybeSingle();

if (error || !data) { /* échec */ }
```

`maybeSingle()` plutôt que `single()` : zéro ligne devient `data === null`, un cas à traiter, pas une exception à décoder.

### Le piège n°4 — la table des appareils n'existe pas

`device_credentials` figure dans l'ERD de l'architecture (AD-9) mais **pas dans la migration initiale** — vérifié par grep sur le schéma gelé. Elle naîtra avec l'Epic 5.

Donc : pas de requête, pas de `count`, pas de « 0 appareil rattaché » (qui serait une affirmation invérifiable), pas de table à créer. **Du texte, et rien d'autre.** L'AC3 ne demande pas plus, et elle interdit explicitement d'en promettre davantage.

### Ce que la RLS te donne gratuitement, et qu'il ne faut pas doubler

```sql
create policy profiles_select_own_household on profiles for select
  using (household_id = current_household_id() or id = auth.uid());
```

Un `select` nu sur `profiles` rend **exactement** les membres du foyer courant. Ajouter `.eq("household_id", profil.household_id)` ne change rien au résultat et déplace la lecture de la sécurité : quelqu'un croira un jour que c'est ce filtre qui protège. `invitation.ts` porte déjà le commentaire qui explique ce choix — reprends-le, ne le réinvente pas.

Le `or id = auth.uid()` a une raison d'être héritée de la 1.5 : il permet à quelqu'un de lire sa propre ligne avant que `current_household_id()` ne résolve. Sans conséquence ici, où l'appelant est toujours membre.

### `updated_at` se pose tout seul

```sql
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
```

Ne l'écris pas dans le payload — ce serait une colonne de plus dans un `update` dont le piège n°1 exige qu'il n'en porte qu'une.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Gérer réellement les appareils (lister, révoquer) | **Epic 5**, Story 5.7 — ici, une annonce, rien de plus |
| Renommer le **foyer** | *hors périmètre* — non couvert, tracé dans `deferred-work.md` depuis la 1.3 |
| Quitter ou changer de foyer | **hors périmètre v1** — non modélisé (`profiles.household_id` non-null) |
| Retirer un membre du foyer | *hors périmètre* — aucune politique RLS ne l'autorise |
| Les autres champs de `profiles` (calories, restrictions, préférences) | *hors périmètre v1* — colonnes héritées du prototype, aucun FR ne les appelle |
| Générer / annuler un code | **Story 1.4** (fait) — `InviteCard` est intégré tel quel |
| Tokens de couleur, thème clair/sombre | **Story 1.7** |
| Propagation temps réel du changement de prénom | **Epic 4** (AD-8) — ici, l'autre membre le voit à son prochain chargement |
| Un lien « Retour » depuis `/foyer` | *hors périmètre* — décision de Florian, 2026-07-27. On repart avec le bouton « précédent » du navigateur. **Ne l'ajoute pas de toi-même** |
| Framework de test | **Story 4.15** |

### Microcopy imposée (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Zone prénom | « Ton prénom » | « Informations du profil » |
| Aide sous le champ | « C'est ce que les autres voient. » | « Nom d'affichage public » |
| Bouton | « Enregistrer » | « Sauvegarder les modifications » |
| Confirmation | « C'est noté. » | « Profil mis à jour avec succès » |
| Champ vide | « Il faut un prénom. » | « Ce champ est obligatoire » |
| Échec | « Ça n'a pas marché. Réessaie dans un instant. » | le message brut de la base |
| Titre des membres | « Qui est là » | « Membres du foyer (2) » |
| Soi-même dans la liste | « Toi » | « (vous) », « (moi) », « Propriétaire » |
| Foyer à un seul membre | « Tu es seul ici pour l'instant. Donne un code à quelqu'un, juste en dessous. » | « Aucun autre membre » |
| Zone appareils | « Les appareils » + « L'écran de la cuisine et les téléphones se rattacheront ici. Bientôt. » | « Gestion des appareils (à venir) », toute mention de jeton ou d'appairage |

Pas de rôles, pas de hiérarchie : le foyer n'a ni administrateur ni propriétaire, et rien en base n'en modélise. Écrire « Propriétaire » inventerait un concept que le produit n'a pas.

### Contraintes d'architecture applicables

- **AD-16** — l'écran **profil / membres / appareils** est une surface web (FR-42) ; les données sont partagées entre tous les membres (FR-43). Un appareil n'est **jamais** promu membre : il n'a rien à faire dans la liste des membres
- **AD-13** — modifier son prénom n'est pas de l'irréductible serveur : client-direct (voir piège n°2). **N'ajoute pas `force-dynamic`**
- **AD-2** — RLS non contournable, **jamais de clé de service**. L'écriture est autorisée par `profiles_update_own`, avec le trou décrit au piège n°1 que ta discipline compense
- **AD-1** — toute règle métier vit en Postgres. Il n'y en a aucune ici : c'est un `update` d'une colonne, pas une fonction SQL. **N'invente pas de RPC**
- **AD-8** — la propagation temps réel appartient à l'Epic 4. L'autre membre voit le nouveau prénom à son prochain chargement, et c'est suffisant pour l'AC2
- **AR-MIGRATIONS** — schéma **déployé et gelé**. `git status --short supabase/` doit rester vide

### Standards de test

**Aucun framework de test, et il ne faut pas en introduire ici.** Vérification exécutable et manuelle : `typecheck`, `lint`, `build`, les greps, et surtout les **Tasks 5 et 6**.

L'AC2 a une particularité : **elle ne se prouve pas depuis la session qui modifie.** Voir son propre prénom changer ne montre que la persistance ; « visible par les autres membres » exige la seconde session — celle de « Temoin3 », qui existe. Ne coche pas l'AC2 sur la foi de la politique RLS : ouvre la seconde session et regarde.

⚠️ **Pièges d'outillage établis :** `npm run build | grep …` ne rend jamais la main (rediriger vers un fichier) ; après suppression d'une route, purger `.next` avant de conclure à une régression du `typecheck`.

### Project Structure Notes

```
app/
  foyer/
    page.tsx                ~  + prénom, membres, appareils (garde l'invitation)
    DisplayNameForm.tsx     +  champ unique, update client-direct, aria-live
    membres.ts              +  lecture des membres (modèle : invitation.ts)
    InviteCard.tsx             INCHANGÉ — `git diff` doit être vide
    actions.ts                 INCHANGÉ — l'émission d'invitation n'est pas concernée
    invitation.ts              INCHANGÉ
  page.tsx                  ~  le lien vers /foyer ne parle plus que d'inviter
lib/
  supabase/client.ts           utilisé ici (client-direct)
  supabase/queries.ts          inchangé — `requireProfile()` rend déjà `display_name`
proxy.ts                       inchangé — `/foyer` reste protégée
supabase/                      INTACT — aucune migration
```

**Le lien de l'accueil est une vraie modification, pas un détail.** `app/page.tsx:37` dit « Inviter quelqu'un chez toi ». Après cette story, `/foyer` n'est plus l'écran d'invitation mais l'écran du foyer : le libellé doit suivre (« Ton foyer », ou équivalent). C'est aujourd'hui **le seul chemin de navigation vers cette page** — s'il ment, l'écran est invisible.

### Intelligence des stories précédentes

- **Les appels Supabase ne lèvent pas, ils retournent `{ data, error }`.** Ce piège a mordu trois fois sur ce dépôt. **Teste `error` explicitement** — et pour un `update`, teste aussi `data` (piège n°3)
- **Le typage mord** : les clients sont paramétrés `<Database>`. `profiles.Update` accepte `display_name?: string` — un nom de colonne erroné échoue au `typecheck`, pas à l'exécution
- **La lecture d'horloge est interdite pendant le rendu** (constat de la Story 1.4). Rien n'en demande ici : n'affiche pas de date
- **Motifs à reprendre plutôt qu'à réinventer** : `JoinHouseholdForm.tsx` pour le formulaire client-direct complet (état `busy`, table `MESSAGES`, `aria-live`, `router.refresh()`, classes ad hoc) ; `invitation.ts` pour un module de lecture serveur ; `InviteCard.tsx` pour le retour visuel en `aria-live`
- **Il n'existe aucune classe de composant réutilisable** (`.btn`, `.input`, `.card` ont disparu avec le prototype et reviennent en 1.7). Recopie les classes utilitaires des formulaires existants — l'uniformité prime sur l'élégance jusqu'à la 1.7
- **Mesure au lieu de supposer.** Trois affirmations déduites se sont révélées fausses sur ce projet (les modèles d'email, le format du code, le commentaire « base32 » du schéma). Exécute, puis écris ce que tu as vu

### Intelligence git

`6f00fad` est la base. Convention : **Conventional Commits**, corps en français ; branche dédiée → PR → **squash merge** CI verte. La CI rejoue `typecheck`, `lint`, `build` sur Node 22.

**Le serveur de développement écoute sur le port 3333.**

Les cinq derniers commits montrent un rythme constant : une story = une branche = une PR squashée, aucune migration depuis `initial_schema`, aucune dépendance ajoutée depuis le socle. Ne romps ni l'un ni l'autre.

### État vérifié de l'environnement (2026-07-27)

- Foyer **« Marin »** réel, profil « Florian », 11 rayons, invitation **`388B626A`** — **4 usages restants** (un a servi à la Story 1.5), valable 7 jours à partir du 2026-07-27
- Le foyer « Marin » compte **deux membres** : « Florian » et « Temoin3 » (`flomarin88+nc3@gmail.com`), laissé par la Story 1.5 et **toujours en place au 2026-07-27, confirmé par Florian**. C'est lui qui rend l'AC2 vérifiable — il n'y a aucun compte à créer pour cette story
- Deux autres résidus existent, **dans leurs propres foyers** : `+nc1` (« Foyer temoin ») et `+nc2` (« Foyer temoin 2 »). Ils ne servent à rien ici et ne doivent pas être confondus avec un membre de « Marin »
- Les adresses `flomarin88+xxx@gmail.com` arrivent toutes dans la même boîte
- Production en ligne, envoi d'emails opérationnel, `http://localhost:3333/**` autorisé en redirection

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10**).

**Aucune bibliothèque nouvelle n'est requise par cette story** — ni date, ni formulaire, ni état. Un champ, un bouton, un `update`. Si tu ressens le besoin d'ajouter une dépendance, c'est que tu as pris un mauvais chemin.

```ts
// membres.ts — la RLS filtre, pas la requête
const { data } = await supabase
  .from("profiles")
  .select("id, display_name")
  .order("created_at");
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6] — user story et 4 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/prds/prd-nutriclaude-2026-07-21/prd.md#FR-42] — « consulter et modifier son prénom affiché, voir les autres membres, et gérer les appareils rattachés » ; la gestion des appareils est renvoyée à l'Epic 5 par [epics.md#Requirements-Traceability]
- [Source: …/ARCHITECTURE-SPINE.md#Invariants-&-Rules] — AD-16, AD-13, AD-2, AD-1, AD-8
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md#Voice-and-Tone] — tutoiement, mots bannis, test d'acceptation de la conjointe
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md] — **l'écran profil/membres est explicitement hors périmètre** : « aucune identité visuelle n'a été élicitée pour ces écrans web ; ils héritent des tokens mais leur composition n'est pas spécifiée ». Il n'y a donc **pas de maquette à suivre** — compose sobrement, sur le modèle des écrans déjà livrés
- [Source: _bmad-output/implementation-artifacts/1-5-rejoindre-un-foyer-via-un-code-d-invitation.md] — motif client-direct, second membre de test, `router.refresh()`
- [Source: _bmad-output/implementation-artifacts/1-4-generer-un-code-d-invitation.md] — écran `/foyer`, `InviteCard`, l'annonce de cette story dans `page.tsx`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — « le nom du foyer n'est modifiable nulle part ; la Story 1.6 ne couvre que le prénom affiché »
- **Schéma déployé, lu directement** : `profiles` (30-43), `profiles_select_own_household` / `profiles_update_own` / `profiles_insert_own` (257-263), trigger `profiles_updated_at` (588-590), **absence de `device_credentials`**. **Ne pas toucher**

## Décisions de Florian (2026-07-27)

Les deux questions ouvertes à la création de la story ont été tranchées. **Ce ne sont plus des questions : ce sont des contraintes.**

1. **Le second membre reste en place.** « Temoin3 » n'a pas été supprimé et sert de second membre pour vérifier l'AC2. Ne crée aucun compte, et **ne le supprime pas** en fin de story — contrairement aux résidus des stories précédentes, celui-ci a une fonction.
2. **Pas de lien « Retour » sur `/foyer`.** Le bouton « précédent » du navigateur suffit. Ne l'ajoute pas au nom de l'ergonomie : c'est un périmètre refusé, pas un oubli.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

### Vérification (2026-07-27)

| Commande | Résultat |
|---|---|
| `npm run typecheck` · `lint` · `build` | exit 0, **0 avertissement** |
| `git status --short supabase/` | vide |
| `git diff app/foyer/{InviteCard.tsx,actions.ts,invitation.ts}` | **vide — les trois fichiers de la 1.4 sont intacts** |
| `git diff package.json package-lock.json` | vide — **aucune dépendance** |
| `grep force-dynamic app/ lib/` | aucun |
| Sortie du `build` | `/foyer` en `ƒ` (dynamique), sans directive — `cookies()` suffit, comme prévu |

**Mots bannis (NFR-9).** Le grep remonte `supabase`, `RLS`, `API` uniquement dans des **imports, identifiants et commentaires**. Aucune chaîne rendue n'en contient. Les libellés livrés sont : « Ton prénom », « C'est ce que les autres voient. », « Enregistrer », « Un instant… », « Il faut un prénom. », « Ça n'a pas marché. Réessaie dans un instant. », « C'est noté. », « Qui est là », « Toi », « Tu es seul ici pour l'instant… », « Faire venir quelqu'un », « Les appareils », « L'écran de la cuisine et les téléphones se rattacheront ici. Bientôt. », « Ton foyer ».

**Contrôle d'accès, sans cookie :**

| Requête | Résultat |
|---|---|
| `curl /foyer` | `307` → `/login?next=%2Ffoyer` |
| `curl /` | `307` → `/login?next=%2F` |

**Parcours réel, session de Florian, foyer « Marin » :**

| Geste | Résultat |
|---|---|
| Ouverture de `/foyer` | **2 membres** : « Florian » marqué **« Toi »**, puis « Temoin3 ». Invitation `388B626A`, 4 usages |
| Prénom → `"   "` (trois espaces), Enregistrer | **« Il faut un prénom. »** — la liste affiche toujours « Florian », rien n'a été écrit |
| Prénom → `Flo`, Enregistrer | **« C'est noté. »**, et la liste passe à **« Flo »** sans rechargement — c'est `router.refresh()` |
| Rechargement de `/` | **« Salut Flo. »** — le prénom tient, et le lien vers l'écran dit désormais **« Ton foyer »** |

Le cas des trois espaces n'est pas un détail : la colonne est `not null` mais **accepte la chaîne vide**, donc la base aurait laissé passer un prénom invisible. C'est le garde-fou client qui le refuse.

⚠️ **Un piège d'outillage découvert ici, à consigner** : le gestionnaire de mots de passe du navigateur ouvre une liste de suggestions au-dessus du champ (`autoComplete="given-name"`), qui **intercepte le premier clic sur « Enregistrer »**. Le clic paraît sans effet. `Échap` referme la liste. Sans conséquence pour un utilisateur réel — mais toute vérification automatisée future sur ce formulaire s'y fera prendre.

**L'AC2 fermée depuis l'autre session.** Se connecter en « Temoin3 » dans ce navigateur aurait remplacé la session de Florian (même profil Chrome, même magasin de cookies). **Florian l'a donc ouverte lui-même en fenêtre privée** et rapporte voir **« Flo » et « Temoin3 »** — le prénom modifié depuis l'autre compte, visible chez le voisin. C'est le seul critère de cette story qui ne se vérifie pas depuis sa propre session, et il est vérifié.

**Retour à l'état initial, qui refait la preuve.** Le prénom a ensuite été remis à **« Florian »** depuis l'écran : seconde écriture, second « C'est noté. », liste remise à jour. La base est rendue telle qu'elle a été trouvée. Au passage, la validation **au clavier** (`Entrée` dans le champ) fonctionne comme le clic.

**Ce qui n'est PAS vérifié, et pourquoi :**

- **L'état à un seul membre** (`membres.length <= 1`). Il demande la session d'un compte seul dans son foyer (`+nc1` ou `+nc2`). La branche est écrite et compile, elle n'est pas **observée**. **Écartée explicitement** plutôt que cochée à tort.
- **« Connecté sans profil → `/onboarding` »** — exigerait un compte neuf, que cette story interdit de créer. **Écarté explicitement**, pas oublié. Le chemin passe par `requireProfile()`, inchangé et vérifié en 1.3 et 1.5.

### Completion Notes List

**Les six tâches sont livrées, à deux sous-tâches près, délibérément laissées vides.** Aucune migration, aucune dépendance, aucun fichier de la 1.4 touché.

**Les deux branches non cochées le sont honnêtement.** « Un seul membre » demanderait la session d'un compte seul dans son foyer ; « connecté sans profil » demanderait un compte neuf, que la story interdit de créer. Les deux sont écrites et compilent, aucune n'est **observée** — et je ne les présente pas comme telles.

**L'écran a été greffé sur `/foyer`, comme la Story 1.4 l'avait réservé** — pas de route `/profil`. La page reste un Server Component ; seul le formulaire de prénom est client.

**Le piège n°1 est traité par construction** : le payload de l'`update` ne contient que `display_name`, écrit en une seule expression. Il n'y a nulle part dans le code un objet profil qui pourrait fuiter dans un spread.

**Le piège n°3 aussi** : `.select("display_name").maybeSingle()` est enchaîné, et `data` est testé autant qu'`error`. Le message « C'est noté. » n'apparaît que si une ligne a réellement été rendue par la base.

**Le piège n°2 a été tranché comme la story le prescrivait** : client-direct, malgré la Server Action qui vit dans le fichier voisin. Renommer sa propre ligne n'est pas de l'émission.

**La zone « appareils » ne fait rien**, comme l'AC3 l'exige : un titre, une phrase, aucun bouton. `device_credentials` n'existe pas dans le schéma — il n'y avait rien à interroger.

**Le lien de l'accueil a suivi** : « Inviter quelqu'un chez toi » → « Ton foyer ». C'est le seul chemin de navigation vers cet écran ; le laisser mentir l'aurait rendu à moitié invisible.

**Écart de méthode assumé — pas de TDD**, la story l'interdisant (tests planifiés en Story 4.15).

**État laissé en base : inchangé.** Le prénom de Florian est revenu à « Florian » après le contrôle. Le foyer « Marin » compte toujours deux membres et l'invitation `388B626A` a toujours ses 4 usages — cette story n'en consomme aucun.

**Un piège d'outillage nouveau, à ajouter à la liste du dépôt** : sur un champ `autoComplete="given-name"`, la liste de suggestions du gestionnaire de mots de passe se dessine **par-dessus le bouton** et avale le premier clic. `Échap` la referme, ou `Entrée` dans le champ soumet directement. Deux vérifications ont paru échouer avant que la cause soit identifiée. Sans effet pour un utilisateur réel.

### File List

**Nouveaux**
- `app/foyer/membres.ts` — lecture des membres du foyer (RLS-filtrée, ordre stable)
- `app/foyer/DisplayNameForm.tsx` — champ unique, `update` client-direct à un seul champ, lecture de retour, `router.refresh()`

**Modifiés**
- `app/foyer/page.tsx` — quatre sections : prénom, membres, invitation, appareils
- `app/page.tsx` — libellé du lien vers `/foyer`

**Inchangés, vérifiés**
- `app/foyer/InviteCard.tsx`, `app/foyer/actions.ts`, `app/foyer/invitation.ts` — **`git diff` vide**
- `lib/supabase/*`, `proxy.ts`, `app/onboarding/*`, `app/login/*`
- `package.json`, `package-lock.json` — **aucune dépendance ajoutée**
- `supabase/` — **aucune migration**

## Change Log

| Date | Changement |
|---|---|
| 2026-07-27 | Story créée. Statut → `ready-for-dev` |
| 2026-07-27 | Questions tranchées par Florian : « Temoin3 » reste en place comme second membre (AC2 vérifiable en l'état) ; aucun lien « Retour » sur `/foyer` |
| 2026-07-27 | Implémentation et vérification : écran foyer à quatre sections, prénom modifiable en client-direct à un seul champ, membres lus sous RLS, zone appareils annoncée. AC2 fermée depuis la session du second membre (« Flo » visible chez Temoin3), prénom remis à « Florian ». Deux branches d'affichage écartées explicitement. Statut → `review` |
