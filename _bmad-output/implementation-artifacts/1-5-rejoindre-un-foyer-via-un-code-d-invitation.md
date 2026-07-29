---
baseline_commit: 55b4dd24c7cf1fbcf2d50c25afc04f7e10575c91
---

# Story 1.5: Rejoindre un foyer via un code d'invitation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a nouvel utilisateur invité (la conjointe),
I want rejoindre un foyer existant en saisissant le code reçu,
so that je partage la liste et tout le reste sans rien avoir à configurer.

## Acceptance Criteria

**AC1 — Rejoindre**
**Given** un utilisateur authentifié sans foyer et un code d'invitation valide
**When** il saisit le code et confirme
**Then** son profil est rattaché au foyer correspondant (`redeem_household_invite`) et il accède immédiatement aux données partagées du foyer (FR-43)

**AC2 — Code invalide**
**Given** un code expiré, épuisé (usages atteints) ou inexistant
**When** l'utilisateur le saisit
**Then** un message clair en français explique que le code n'est plus valable et invite à en redemander un, sans exposer d'erreur technique

**AC3 — Le compteur ne dérape pas**
**Given** un code valablement utilisé jusqu'à sa limite d'usages
**When** un usage supplémentaire est tenté
**Then** il est refusé et le compteur d'usages ne devient jamais négatif

[Source: _bmad-output/planning-artifacts/epics.md#Story-1.5 — cité verbatim]

> ⚠️ **C'est la story qui ferme la boucle du foyer partagé.** La 1.4 produit un code que personne ne peut encore utiliser ; à la fin de celle-ci, ta conjointe entre pour de bon. C'est aussi le premier moment où deux humains partagent des données — et donc où FR-43 devient observable.

## Tasks / Subtasks

- [x] **Task 1 — Choix à l'entrée du foyer** (AC: 1)
  - [x] `app/onboarding/page.tsx` — offrir deux chemins : **créer un foyer** ou **rejoindre avec un code**. La Story 1.3 a été écrite pour recevoir cette greffe
  - [x] **`CreateHouseholdForm.tsx` ne doit pas être réécrit** — il est déjà correct. Seule la page change, pour proposer le choix et rendre l'un ou l'autre formulaire
  - [x] Garde d'entrée inchangée : pas de session → `/login` ; déjà un profil → `/`
  - [x] Le choix par défaut : **créer**. Rejoindre est le cas de la personne invitée, qui sait qu'elle a un code — elle le cherchera. Ne fais pas l'inverse
  - [x] Prévoir le retour : depuis « j'ai un code », on doit pouvoir revenir à « créer »

- [x] **Task 2 — Formulaire de rachat** (AC: 1, 2)
  - [x] `app/onboarding/JoinHouseholdForm.tsx` — Client Component, **deux champs** : le code et le prénom affiché. La fonction exige les deux
  - [x] **Normaliser le code avant envoi** : `trim()`, retrait des espaces internes, `toUpperCase()`. Voir « Le piège n°1 » — sans ça, un code recopié avec une minuscule échoue sans raison compréhensible
  - [x] Ne pas imposer de longueur maximale dans le champ : normalise et laisse la base juger. Un `maxLength` figerait un format qui n'est pas le tien
  - [x] `autoComplete="off"`, `autoCapitalize="characters"`, et un affichage en majuscules pour que ce qu'on voit corresponde à ce qui part
  - [x] Empêcher la double soumission (bouton désactivé) et **traiter `Profile already exists` comme un succès** — même raisonnement qu'en 1.3
  - [x] Cibles ≥ 44px, anneau de focus visible, aucune couleur d'alerte

- [x] **Task 3 — Appel de la fonction** (AC: 1, 2)
  - [x] `supabase.rpc("redeem_household_invite", { p_code, p_display_name })` **depuis le navigateur** via `lib/supabase/client.ts` — **client-direct, comme la Story 1.3, et PAS une Server Action comme la 1.4**. Voir « Le piège n°2 »
  - [x] **Aucune pré-validation du code n'est possible** : un utilisateur sans foyer ne peut pas lire `household_invites` (voir « Le piège n°3 »). Le seul chemin est d'appeler la fonction et d'interpréter l'erreur
  - [x] Traduire **chaque** message en français, jamais le rendre brut (NFR-8). Les cinq levées possibles sont listées en Dev Notes
  - [x] Après succès, rediriger vers `/`. Ne recharge pas la session : `current_household_id()` résout immédiatement

- [x] **Task 4 — Vérifier le partage réel (FR-43)** (AC: 1)
  - [x] Avec un second compte, rejoindre le foyer « Marin » à l'aide d'un code généré par la Story 1.4
  - [x] Depuis la session du **nouveau membre**, vérifier qu'il voit : **2 profils** (le sien et celui de Florian), **11 rayons** (ceux du foyer, pas de nouveaux), et le foyer « Marin »
  - [x] ⚠️ **Vérifier qu'aucun rayon n'a été créé en double.** `redeem_household_invite` **n'amorce pas** de rayons, contrairement à `create_household_with_profile` — l'arrivant hérite de ceux du foyer. Si tu en comptes 22, quelque chose a été ajouté qui n'aurait pas dû l'être
  - [x] Depuis la session de **Florian**, vérifier qu'il voit désormais **2 profils** lui aussi
  - [x] Vérifier que `uses_remaining` du code est passé de 5 à **4**

- [x] **Task 5 — Vérifier les refus** (AC: 2, 3)
  - [x] Code inexistant (par exemple `ZZZZZZZZ`) → message français distinct, aucune erreur technique à l'écran
  - [x] Code **en minuscules** correspondant à un vrai code → doit **réussir** grâce à la normalisation. C'est la preuve que le piège n°1 est traité
  - [ ] Code expiré : impossible à produire sans attendre 7 jours → **écarter explicitement** et le déclarer, plutôt que de simuler. La branche est la même que « épuisé » côté code → *écarté, comme la story l'autorise*
  - [ ] Code épuisé : le seul chemin réaliste est d'épuiser un code à 5 usages, ce qui demande 5 comptes. **Écarter et déclarer.** À défaut, vérifier au moins que le message existe et que le chemin d'erreur est câblé → *écarté ; le câblage est vérifié par le cas « inconnu », qui emprunte le même chemin de traduction*
  - [x] **AC3, ce qui est réellement vérifiable** : après le rachat de la Task 4, `uses_remaining` vaut 4 et non 6 ni -1. Lire « Le piège n°4 » avant de cocher

- [x] **Task 6 — Vérification** (AC: 1, 2, 3)
  - [x] `npm run typecheck` · `npm run lint` · `npm run build` → succès sans avertissement
  - [x] `git status --short supabase/migrations/` vide — **aucune migration**
  - [x] Grep des mots bannis dans les chaînes rendues (NFR-9) ; aucun `force-dynamic`
  - [x] `/onboarding` en anonyme → redirigé vers `/login` ; avec un profil → renvoyé vers `/`
  - [x] Consigner tous les résultats dans le Dev Agent Record

## Dev Notes

### Le piège n°1 — le code est comparé **exactement**, sans normalisation

```sql
select household_id, uses_remaining, expires_at
  into v_household_id, v_uses_left, v_expires_at
from household_invites where code = p_code;
```

Pas de `upper()`, pas de `trim()`. Or les codes émis par la Story 1.4 sont en **majuscules hexadécimales** (`388B626A`). Conséquences :

- `388b626a` → `Invalid invite code`
- ` 388B626A` (espace collé au copier-coller) → `Invalid invite code`
- `388B 626A` (recopié à la main en deux blocs) → `Invalid invite code`

**Ces trois cas sont exactement ce que fera une personne à qui on dicte un code au téléphone.** La normalisation côté client n'est donc pas une politesse : sans elle, l'AC2 affichera « ce code n'est plus valable » à quelqu'un qui a saisi le bon code, et le produit paraîtra cassé.

`p_code.replace(/\s+/g, "").toUpperCase()` avant l'appel. Rien de plus, rien de moins.

### Le piège n°2 — client-direct, contrairement à la Story 1.4

Deux précédents contradictoires existent maintenant dans ce dépôt : la 1.3 appelle sa fonction **depuis le navigateur**, la 1.4 passe par une **Server Action**. Ne tire pas au sort.

AD-13 nomme comme irréductible serveur « le callback magic-link, l'**émission** de jetons d'appareil + invitations ». **Racheter une invitation n'est pas l'émettre.** L'opération est le miroir exact de `create_household_with_profile` : elle crée le profil de l'appelant et le rattache à un foyer.

**Verdict : client-direct, via `lib/supabase/client.ts`**, comme la Story 1.3. Si un jour une raison sérieuse impose le serveur ici, elle devra valoir aussi pour la création de foyer — les deux vont ensemble.

### Le piège n°3 — impossible de valider le code avant de l'utiliser

Le réflexe est de vérifier d'abord que le code existe, puis de l'échanger. **La RLS l'interdit**, et le schéma le dit lui-même :

```sql
-- Note: redeeming an invite is done via a SECURITY DEFINER function below
-- because the redeemer doesn't yet belong to the target household.
```

`invites_select_own` filtre sur `household_id = current_household_id()`. Un utilisateur sans foyer obtient `NULL` : il ne voit **aucune** invitation, pas même celle qui le concerne. Toute tentative de pré-lecture rendra un tableau vide et te fera conclure à tort que le code est faux.

**Il n'y a qu'un seul chemin : appeler la fonction et lire l'erreur.** C'est pour cela que la traduction des messages porte tout le poids de l'AC2.

### Les cinq levées possibles, et ce qu'on en montre

La fonction lève dans cet ordre. Le message arrive dans `error.message`, **en anglais, jamais à afficher** :

| Levée SQL | Quand | Ce qu'on montre |
|---|---|---|
| `Not authenticated` | pas de session | *ne pas afficher* — rediriger vers `/login` |
| `Profile already exists` | l'appelant a déjà un foyer | *ne pas afficher* — c'est un succès (double clic), on continue vers `/` |
| `Invalid invite code` | code inconnu | « Ce code ne correspond à rien. Vérifie ce que tu as saisi. » |
| `Invite expired` | passé `expires_at` | « Ce code a expiré. Demande-lui d'en créer un nouveau. » |
| `Invite has no uses remaining` | compteur à zéro | « Ce code a déjà servi trop de fois. Demande-lui d'en créer un nouveau. » |

**Distinguer « inconnu » de « expiré/épuisé » est délibéré.** Les deux appellent des gestes différents : re-saisir dans un cas, redemander un code dans l'autre. Cela révèle marginalement si un code existe — sans portée pour un foyer de deux personnes, et le gain d'utilisabilité l'emporte largement.

### Le piège n°4 — l'AC3 n'est pas garantie sous concurrence, et tu ne peux pas la corriger

L'AC3 demande que le compteur « ne devienne jamais négatif ». Regarde la séquence réelle :

```sql
select … uses_remaining … from household_invites where code = p_code;  -- (1) lecture SANS verrou
if v_uses_left <= 0 then raise exception …; end if;                     -- (2) contrôle
insert into profiles …;                                                -- (3)
update household_invites set uses_remaining = uses_remaining - 1 …;     -- (4) décrément
```

**La lecture (1) ne pose aucun verrou** (`for update` absent). Deux personnes différentes qui rachètent le dernier usage au même instant lisent toutes deux `1`, passent toutes deux le contrôle (2), créent leurs profils, et décrémentent : le compteur tombe à **-1**.

**Ce que ça veut dire pour toi :**

- **L'AC3 est vraie en usage séquentiel** — c'est-à-dire dans tous les cas réels d'un foyer de deux personnes. C'est ce que tu peux et dois vérifier.
- **Elle n'est pas garantie sous concurrence réelle**, et le corriger exigerait un `for update` dans la fonction, donc **une migration sur une base gelée** — hors périmètre, et interdit ici.
- **Ne prétends pas l'avoir prouvée.** Déclare ce que tu as mesuré (le compteur passe de 5 à 4) et **consigne la course dans `deferred-work.md`**, comme exigence pour le jour où le produit sortirait du foyer.

### Ce que le rachat ne fait pas — et qu'il ne faut pas « réparer »

`create_household_with_profile` appelle `seed_default_aisles`. **`redeem_household_invite` ne l'appelle pas**, et c'est correct : l'arrivant rejoint un foyer qui a déjà ses rayons. Les amorcer à nouveau créerait des doublons — ou serait absorbé par le `on conflict (household_id, name) do nothing`, ce qui masquerait l'erreur.

L'asymétrie entre les deux fonctions est **voulue**. Ne l'uniformise pas.

### Ce que cette story rend enfin observable

C'est la première fois que **deux humains partagent des données**. Les politiques RLS le prévoyaient depuis le début, sans que rien ne l'exerce :

```sql
create policy profiles_select_own_household on profiles for select
  using (household_id = current_household_id() or id = auth.uid());
```

Après le rachat, **chaque membre voit les deux profils**. C'est FR-43 qui devient vérifiable, et c'est le cœur de la Task 4. Jusqu'ici, toutes les vérifications d'isolation montraient que deux foyers ne se voient pas ; celle-ci montre l'inverse — que deux membres **du même** foyer se voient bien.

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Écran profil, prénom modifiable, liste affichée des membres | **Story 1.6** — cette story vérifie le partage en base, elle ne l'affiche pas |
| Générer un code | **Story 1.4** (fait) |
| Annuler / révoquer un code | *hors périmètre* — décision de Florian, 2026-07-27 |
| Quitter ou changer de foyer | **hors périmètre v1** — non modélisé |
| Tokens de couleur, thème | **Story 1.7** |
| Framework de test | **Story 4.15** |

### Microcopy imposée (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Choix à l'entrée | « Tu montes ta cuisine, ou tu rejoins quelqu'un ? » | « Créer / Rejoindre une organisation » |
| Bouton du second chemin | « J'ai un code » | « Rejoindre via code d'invitation » |
| Champ code | « Le code qu'on t'a donné » | « Code d'invitation (8 caractères) » |
| Champ prénom | « Ton prénom » | « Nom d'utilisateur » |
| Bouton | « Rejoindre » | « Valider le code » |
| Champ vide | « Il manque le code. » | « Champ requis » |
| Retour au premier chemin | « Finalement, je crée le mien » | « Annuler » |

Le ton de cet écran compte plus que partout ailleurs : **c'est le tout premier écran que verra la conjointe**, et le test d'acceptation du produit est « elle ne configure rien ». Si elle hésite ici, c'est raté.

### Contraintes d'architecture applicables

- **AD-16** — le foyer se **rejoint** par magic link + code à durée et usages limités. Un appareil n'est jamais promu membre
- **AD-13** — le rachat **n'est pas** de l'émission : client-direct (voir piège n°2). **N'ajoute pas `force-dynamic`**
- **AD-2** — RLS non contournable, **jamais de clé de service**. La fonction est `security definer` **par nécessité** — c'est le seul moyen pour un non-membre d'agir sur ce foyer, et c'est déjà en place
- **AD-1** — toute règle métier vit en Postgres. Validité, expiration et décompte sont dans la fonction : n'en réimplémente aucun morceau en TypeScript
- **AR-MIGRATIONS** — schéma **déployé et gelé**. `git status --short supabase/migrations/` doit rester vide

### Standards de test

**Aucun framework de test, et il ne faut pas en introduire ici.** Vérification exécutable et manuelle : `typecheck`, `lint`, `build`, les greps, et surtout les **Tasks 4 et 5**.

Sois précis sur ce que tu déclares : deux branches d'erreur (expiré, épuisé) ne sont pas raisonnablement reproductibles. **Écarte-les explicitement plutôt que de les cocher** — la revue préférera une case vide honnête à une case cochée à tort.

⚠️ **Pièges d'outillage établis :** `npm run build | grep …` ne rend jamais la main (rediriger vers un fichier) ; après suppression d'une route, purger `.next` avant de conclure à une régression du `typecheck`.

### Project Structure Notes

```
app/
  onboarding/
    page.tsx                  ~  propose le choix créer / rejoindre
    CreateHouseholdForm.tsx      INCHANGÉ — il est déjà correct
    JoinHouseholdForm.tsx     +  code + prénom, normalisation, rpc client-direct
  foyer/                         inchangé (Story 1.4) — utile pour produire un code
lib/
  supabase/client.ts             utilisé ici (client-direct)
  supabase/queries.ts            inchangé
proxy.ts                         inchangé — `/onboarding` reste protégée
supabase/                        INTACT — aucune migration
```

### Intelligence des stories précédentes

- **Les appels Supabase ne lèvent pas, ils retournent `{ data, error }`.** Ce piège a mordu trois fois sur ce dépôt. **Teste `error` explicitement.**
- **Le typage mord** : les clients sont paramétrés `<Database>`. `redeem_household_invite` y figure avec `Args: { p_code: string; p_display_name: string }` et `Returns: string` — une faute de frappe échoue au `typecheck`.
- **La lecture d'horloge est interdite pendant le rendu** (constat de la Story 1.4 : *« Cannot call impure function during render »*). Si tu as besoin de l'heure, sors-la du corps du composant — `app/foyer/invitation.ts` montre le motif.
- **Motifs à reprendre plutôt qu'à réinventer** : `CreateHouseholdForm.tsx` pour la gestion d'erreur par code traduit, la double soumission et les classes ad hoc ; `app/foyer/InviteCard.tsx` pour un Client Component qui déclenche une action et rend un retour en `aria-live`.
- **Mesure au lieu de supposer.** Deux affirmations déduites se sont révélées fausses sur ce projet (les modèles d'email, le format du code). Exécute, puis écris ce que tu as vu.

### Intelligence git

`55b4dd2` est la base. Convention : **Conventional Commits**, corps en français ; branche dédiée → PR → **squash merge** CI verte. La CI rejoue `typecheck`, `lint`, `build` sur Node 22.

**Le serveur de développement écoute sur le port 3333.**

### État vérifié de l'environnement (2026-07-27)

- Foyer **« Marin »** réel, profil « Florian », 11 rayons, et une invitation valide **`388B626A`** (5 usages, 7 jours) émise par la Story 1.4 — **utilisable directement pour la Task 4**
- Production en ligne, service d'envoi d'emails dédié opérationnel, modèles conformes, `http://localhost:3333/**` autorisé dans les URL de redirection
- Un résidu de test peut subsister : compte `flomarin88+nc2@gmail.com` et foyer « Foyer temoin 2 ». **Ne le réutilise pas pour rejoindre « Marin »** — il a déjà un profil, et la fonction lèvera `Profile already exists`. Il faut un compte **sans foyer**
- Les adresses `flomarin88+xxx@gmail.com` arrivent toutes dans la même boîte : c'est ainsi qu'ont été créés les comptes de test précédents

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`, `typescript@6.0.3`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10**).

```ts
const { data, error } = await supabase.rpc("redeem_household_invite", {
  p_code: codeNormalise,
  p_display_name: prenom,
});
// data = l'uuid du foyer rejoint
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5] — user story et 3 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements-Inventory] — FR-40, FR-43 ; NFR-5, NFR-8, NFR-9
- [Source: …/ARCHITECTURE-SPINE.md#Invariants-&-Rules] — AD-16, AD-13, AD-2, AD-1
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md#Voice-and-Tone] — tutoiement, mots bannis, test d'acceptation de la conjointe
- [Source: _bmad-output/implementation-artifacts/1-4-generer-un-code-d-invitation.md] — format du code, invitation en cours, motifs de code
- [Source: _bmad-output/implementation-artifacts/1-3-creer-un-foyer-a-l-inscription.md] — motif client-direct, garde d'onboarding
- **Schéma déployé, lu directement** : `redeem_household_invite` (387-434) — ordre exact des levées, absence de `for update`, absence d'amorçage de rayons ; commentaire RLS sur la nécessité du `security definer` (272-273) ; `household_invites` (59-68). **Ne pas toucher**

## Questions pour Florian

1. **Faut-il distinguer « code inconnu » de « code expiré/épuisé » ?** Je le fais, parce que les deux appellent des gestes différents — re-saisir, ou redemander un code. Ça révèle marginalement qu'un code existe ; sans portée pour un foyer de deux personnes. Dis-le si tu préfères un message unique.
2. **Un compte de test sans foyer sera nécessaire** pour vérifier le rachat (Task 4). Je peux en créer un via une adresse `+quelquechose`, comme les précédents — ça laissera un troisième résidu à nettoyer. Ou bien **tu utilises l'occasion pour faire entrer ta conjointe pour de vrai** : c'est exactement le parcours, et ça ne laisse aucun résidu. Dis-moi ce que tu préfères avant l'implémentation.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Vérification (2026-07-27)

| Commande | Résultat |
|---|---|
| `npm run typecheck` · `lint` · `build` | exit 0, **0 avertissement** |
| `git status --short supabase/` | vide |
| `git diff app/onboarding/CreateHouseholdForm.tsx` | **vide — le formulaire de création n'a pas été touché** |

**Parcours complet, avec un troisième compte de test.** Après connexion, arrivée sur `/onboarding` proposant les deux chemins (« C'est parti » par défaut, « J'ai un code » en second).

| Saisie | Résultat |
|---|---|
| `ZZZZZZZZ` | reste sur `/onboarding`, message « Ce code ne correspond à rien. Vérifie ce que tu as saisi. » |
| **`388b 626a`** — minuscules **et** espace | **réussite**, arrivée sur `/` titrée « Marin » |

La seconde ligne est le cœur de cette story. Le code réel est `388B626A` ; saisi comme le ferait quelqu'un à qui on le dicte au téléphone, il **aurait été rejeté** par la base sans la normalisation, et l'utilisateur aurait vu « ce code ne correspond à rien » alors qu'il avait le bon.

**FR-43 devient observable — c'est la première fois.** Depuis les **deux** sessions, après le rachat :

| Depuis… | `profiles` visibles | `households` | `aisles` | invitation |
|---|---|---|---|---|
| **Temoin3** (l'arrivant) | `["Florian","Temoin3"]` | `["Marin"]` | **11** | `388B626A : 4` |
| **Florian** | `["Florian","Temoin3"]` | `["Marin"]` | **11** | `388B626A : 4` |

Trois choses s'y lisent :

1. **Deux humains se voient** dans le même foyer. Toutes les vérifications précédentes montraient que deux foyers ne se voient *pas* ; celle-ci montre l'inverse, et c'est FR-43.
2. **11 rayons, pas 22.** `redeem_household_invite` n'amorce rien, l'arrivant hérite — l'asymétrie avec la création est intacte, rien n'a été « réparé ».
3. **Le compteur est passé de 5 à 4**, et l'arrivant voit désormais l'invitation qu'il a utilisée (il est membre).

### Completion Notes List

**Livré : les six tâches, à deux sous-tâches près, délibérément laissées vides.** Aucune migration, aucune dépendance ajoutée.

**Les deux branches non cochées le sont honnêtement.** « Code expiré » demanderait d'attendre sept jours ; « code épuisé » demanderait cinq comptes. La story autorisait explicitement à les écarter plutôt qu'à les simuler. Leur chemin de traduction est le même que celui du cas « inconnu », qui lui est vérifié — mais **ce n'est pas une preuve, et je ne la présente pas comme telle.**

**L'AC3 n'est vérifiée que dans sa moitié séquentielle**, comme la story le prévoyait : le compteur passe de 5 à 4, jamais à 6 ni à -1. La course décrite dans le piège n°4 reste ouverte — la lecture du compteur ne pose aucun verrou, et deux rachats simultanés du dernier usage le feraient tomber à -1. **Irréparable sans migration sur une base gelée**, donc consignée dans `deferred-work.md`. Je ne prétends pas avoir prouvé l'AC3 en entier.

**Le piège n°2 a été tranché comme la story le prescrivait** : client-direct, à l'image de la création de foyer, et non Server Action comme l'émission d'invitation. Racheter n'est pas émettre.

**La greffe s'est faite sans réécriture**, comme la Story 1.3 l'avait prévu. `CreateHouseholdForm.tsx` est inchangé au caractère près — vérifié par `git diff`. Un composant `OnboardingChoice` porte le choix ; les deux formulaires restent autonomes.

**Un choix d'ergonomie assumé.** « Créer » reste le défaut, « J'ai un code » est le second chemin. La personne invitée sait qu'elle a un code et le cherchera ; celle qui découvre le produit, non. L'inverse aurait fait buter tout nouvel arrivant sur un champ qu'il ne peut pas remplir.

**Question 1 de la story, non tranchée par Florian, implémentée selon la recommandation** : « code inconnu » et « code plus valable » donnent deux messages distincts, parce qu'ils appellent deux gestes différents — re-saisir, ou redemander un code. Cela révèle marginalement qu'un code existe ; sans portée à cette échelle. Facile à fusionner si l'arbitrage change.

**Écart de méthode assumé — pas de TDD**, la story l'interdisant (tests planifiés en Story 4.15).

**Résidu de test à retirer.** Compte `flomarin88+nc3@gmail.com`, profil « Temoin3 », **membre du foyer « Marin »**. ⚠️ Celui-ci est différent des précédents : il n'a pas son propre foyer, il est **dans le tien**. Le supprimer depuis *Authentication → Users* emporte son profil par cascade, sans toucher au foyer. Le compteur de l'invitation restera à 4 — sans conséquence.

### File List

**Nouveaux**
- `app/onboarding/JoinHouseholdForm.tsx` — code + prénom, normalisation, appel client-direct
- `app/onboarding/OnboardingChoice.tsx` — bascule entre les deux chemins

**Modifiés**
- `app/onboarding/page.tsx` — rend le choix au lieu du seul formulaire de création

**Inchangés, vérifiés**
- `app/onboarding/CreateHouseholdForm.tsx` — **`git diff` vide**
- `lib/supabase/*`, `proxy.ts`, `app/foyer/*`, `app/page.tsx`
- `package.json`, `package-lock.json` — **aucune dépendance ajoutée**
- `supabase/` — **aucune migration**

### File List

## Change Log

| Date | Changement |
|---|---|
| 2026-07-27 | Story créée. Statut → `ready-for-dev` |
| 2026-07-27 | Implémentation et vérification : choix créer/rejoindre, normalisation du code (un code dicté en minuscules avec espace fonctionne), FR-43 observable — deux membres se voient dans « Marin », 11 rayons partagés, compteur 5→4. Deux branches d'erreur écartées explicitement. Statut → `review` |

---

## Amendement du 2026-07-28 — revue de code Epic 1, passe 2

**L'AC3 est désormais satisfaite, y compris sous concurrence.** Les Completion Notes concluaient que
« la course décrite dans le piège n°4 reste ouverte » et qu'elle était « irréparable sans migration
sur une base gelée ». `20260727161200_guard_invite_use_count.sql`, appliquée en production le
2026-07-28, fusionne le contrôle et le décrément en `update … where uses_remaining > 0 returning
household_id` : deux rachats simultanés du dernier usage ne peuvent plus tous deux aboutir, et le
compteur ne peut plus devenir négatif. La prémisse « base gelée » elle-même a été réécrite — voir
`deferred-work.md`.

**Deux défauts trouvés dans le formulaire, corrigés :**
- `Profile already exists` était traité comme un succès muet, au motif de « deux soumissions
  concurrentes ». Le raisonnement était inversé : ce message signifie que le profil **existait avant**
  la requête ; une vraie course échoue sur la clé primaire. Conséquence — quelqu'un qui avait déjà un
  foyer voyait sa saisie effacée et son ancien foyer s'afficher, sans un mot. Il est maintenant
  distingué (`lib/foyer/erreurs.ts`), annoncé, puis l'utilisateur est ramené chez lui.
- `Not authenticated` n'était traité nulle part, contrairement à la microcopie imposée par cette
  story (« *ne pas afficher* — **rediriger vers `/login`** »). Il tombait dans « Réessaie dans un
  instant », message que l'utilisateur pouvait suivre indéfiniment sans que rien ne change.

**La normalisation du code a été étendue** : elle ne retirait que les espaces. Les codes étant
hexadécimaux, `O→0` et `I/L→1` sont des corrections sans perte possible, et les séparateurs
(`388B-626A`, tel qu'on écrit un code sur un tableau) sont désormais retirés.
