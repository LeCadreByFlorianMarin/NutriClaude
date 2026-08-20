# Travaux différés

## Deferred from: code review of 1-1-poser-le-socle-applicatif-next-16 (2026-07-26)

**À traiter dans la Story 1.2 (authentification magic link) — ce sont des exigences dures, pas des suggestions :**

- **Valider `next` avant toute redirection.** Le proxy génère `/login?next=<pathname>`, toujours sûr. Mais rien n'empêche un attaquant de forger `/login?next=https://evil.com` : dès qu'un `router.replace(next)` sera câblé, c'est un open redirect. Le prototype faisait exactement ça (`LoginForm.tsx:11`). Exiger un chemin relatif (`/^\/(?!\/)/`).
- **Appliquer les en-têtes anti-cache dans les Route Handlers.** `lib/supabase/server.ts` ignore le 2ᵉ paramètre `_headers` de `setAll` — correct pour un Server Component qui ne peut pas écrire d'en-têtes, mais **un Route Handler le peut**. Quand `/auth/callback` sera posé, sa réponse portera un cookie d'auth sans protection anti-cache (NFR-5).
- **Confirmer le rendu dynamique** avant la première page lisant des données de foyer. Le prototype posait `force-dynamic` sur chaque page authentifiée ; le socle n'a rien. En App Router l'usage de `cookies()` bascule automatiquement en dynamique, ce qui couvre le cas — mais il faut le vérifier explicitement plutôt que de le supposer.
- **Rétablir `PUBLIC_ROUTES` en cohérence** avec les routes réellement créées (`/signup` et `/auth/callback` sont listées mais n'existent plus).

**À traiter dès les stories 1.3+ :**

- **Rétablir la garde d'appartenance au foyer.** `lib/supabase/queries.ts` (`requireProfile`) exigeait un profil et un `household_id` ; il a été supprimé. Aujourd'hui une session seule suffit à franchir le proxy. Sans conséquence tant qu'aucune route de données n'existe, mais c'est le socle de l'isolation par foyer (AD-2, NFR-5).

**Robustesse, sans échéance :**

- **Valider les variables d'environnement au démarrage.** Absentes, `createServerClient` lève et **toutes** les routes retournent 500, y compris `/login` — aucune page de secours. Motif hérité du prototype (assertions `!`).
- **Comportement quand Supabase est injoignable.** `getUser()` n'a aucun timeout : blocage mesuré de 25,5 s par requête. Arbitrage sécurité/disponibilité à trancher (voir la décision ouverte dans la story).
- **`catch {}` trop large dans `lib/supabase/server.ts`** — avale toute défaillance d'écriture de cookie, pas seulement le cas Server Component. Motif officiel Supabase, pas d'API stable pour distinguer le contexte.

**Dette de conception tracée :**

- **`globals.css` a perdu la couche de composants** (`.btn`, `.input`, `.card`, `.chip`…) et les 14 tokens de couleur, sans remplaçant ni `TODO` grep-able. Reconstruction attendue en **Story 1.7**. Toute story livrée avant devra inventer des classes ad hoc.
- **Quatre modules `lib/` sans importeur** (`supabase/{server,client,types}.ts`, `dates.ts`). Mise en place volontaire pour 1.2+, mais `types.ts` — typé à la main — divergera silencieusement de la base gelée. `supabase gen types` reste la bonne réponse (question ouverte de la story).
- **`postcss` n'est plus que transitif** via `@tailwindcss/postcss` alors que `postcss.config.mjs` en dépend. Casse silencieusement si Tailwind change son arbre.
- **12 vulnérabilités « high »** remontées par `npm audit`, toutes transitives en dev-dependencies. Une partie disparaîtra avec le correctif ESLint ; le reste (`postcss`, `sharp` via Next) relève d'une story de maintenance.

**Notes pour la réimplémentation des surfaces supprimées :**

- Deux bugs réels ont disparu avec le prototype, à ne pas recopier : `<>…</>` sans `key` dans le `map()` de la grille menu, et `<input type="checkbox" checked={false}>` en dur dans `GroceryGroup.tsx` qui ignorait `it.status`.
- Les RPC `generate_grocery_list_from_menu`, `create_household_with_profile` et `redeem_household_invite` **existent dans la base gelée**, mais leur seul point d'appel documenté a été supprimé. Reconstituer les signatures depuis `supabase/migrations/20260502000000_initial_schema.sql`, sans modifier la base.
- Le prototype reste consultable : `git show prototype-2026-05-02:<chemin>`.

## Deferred from: stories 1.2 et 1.3 (2026-07-27)

**Résidu de test à retirer de la base :**

- ~~Le contrôle d'isolation NFR-5 a laissé un compte `flomarin88+nc1@gmail.com`, son foyer « Foyer temoin » et ses 11 rayons. Aucune politique RLS n'autorise la suppression de `households` ni de `profiles` — le ménage se fait depuis le tableau de bord (*Authentication → Users*, puis le foyer orphelin). Sans conséquence tant que ça reste.~~ **— SUPPRIMÉ en production le 2026-07-29.** Plus aucun compte témoin ne subsiste : le nettoyage laisse le seul foyer « Marin » et le seul compte de Florian. Les contrôles d'isolation se font désormais sur le stack local (`npm run test:isolation`), plus jamais en production.

**Dette de vérification :**

- **Aucune revue de code adversariale sur les stories 1.2 et 1.3**, contrairement à la 1.1 qui en avait reçu une à trois couches et y avait trouvé 21 constats dont 2 de gravité haute. Les deux stories ont été écrites *et* vérifiées par le même modèle. La couverture manuelle est réelle et mesurée, mais elle ne remplace pas un regard indépendant. **À rattraper par un `code-review` mené par un autre modèle**, idéalement avant que l'Epic 2 ne s'appuie dessus.

**Observations sans action, tracées pour ne pas être redécouvertes :**

- **`households_insert` autorise tout utilisateur authentifié** à insérer une ligne `households` en direct, sans profil rattaché. Le schéma l'assume (« la création du profil est l'étape qui filtre »). Permet des foyers orphelins, invisibles et inaccessibles. Sans portée à l'échelle de deux personnes ; corriger exigerait une migration sur une base gelée.
- **Le nom du foyer n'est modifiable nulle part.** La Story 1.6 ne couvre que le prénom affiché. « Marin » restera tel quel jusqu'à ce qu'une story ouvre le sujet.
- **Un cookie `sb-<ref>-auth-token-code-verifier` subsiste** après connexion : le client navigateur le pose systématiquement en préparant un flux PKCE, que notre chemin par `token_hash` ne consomme jamais. Sans effet.
- **Piège d'outillage** : après suppression d'une route, `npm run typecheck` échoue sur un validateur périmé sous `.next/dev/types/`. Purger `.next` avant de conclure à une régression.

## Deferred from: story 1.4 (2026-07-27)

**Exigence dure pour l'Epic 5 — ne pas la découvrir en chemin :**

- **`generate_household_invite` devra vérifier explicitement que l'appelant est un humain.** L'AC3 de la story 1.4 exige qu'une identité d'appareil ne puisse pas émettre d'invitation. Aujourd'hui c'est vrai **par effet de bord** : `current_household_id()` ne résout le foyer que depuis `profiles`, donc une identité non-humaine obtient `NULL` et la fonction lève. Or AD-9 prévoit d'étendre cette fonction au **claim du jeton** (`auth.jwt()`). Le jour où l'Epic 5 le fera, un appareil obtiendra un `household_id` et pourra **émettre des invitations** — exactement ce que l'AC3 interdit. La garde devra alors être explicite, par exemple `exists (select 1 from profiles where id = auth.uid())`.

**Résidu de test à retirer de la base :**

- ~~Compte `flomarin88+nc2@gmail.com`, foyer « Foyer temoin 2 », ses 11 rayons et son invitation `4A1EA59C`. Créés pour prouver l'isolation des invitations. Aucune politique n'autorise leur suppression depuis l'application : *Authentication → Users*, supprimer l'utilisateur, puis le foyer orphelin.~~ **— SUPPRIMÉ en production le 2026-07-29.** Plus aucun compte témoin ne subsiste : le nettoyage laisse le seul foyer « Marin » et le seul compte de Florian. Les contrôles d'isolation se font désormais sur le stack local (`npm run test:isolation`), plus jamais en production.

**Choix assumés, à ne pas prendre pour des oublis en revue :**

- **Aucune annulation d'invitation** (décision de Florian, 2026-07-27). `invites_delete_own` reste inutilisé. Conséquence : générer un nouveau code **n'invalide pas l'ancien**, et plusieurs codes peuvent rester valables sept jours en parallèle.
- **Rien ne purge les invitations expirées.** Sans conséquence à cette échelle.
- Le commentaire du schéma décrit le code comme « 8-char base32 » : **c'est faux**, il est hexadécimal. Le commentaire vit dans une migration appliquée, donc non modifiable.

## Deferred from: story 1.5 (2026-07-27)

**Course non traitée dans `redeem_household_invite` — l'AC3 n'est vraie qu'en séquentiel :**

- ~~La fonction lit `uses_remaining` **sans verrou**~~ — **CLOS le 2026-07-28** par `20260727161200_guard_invite_use_count.sql`, appliquée en production : contrôle et décrément fusionnés en `update … where uses_remaining > 0 returning household_id`. L'AC3 de la story 1.5 (« le compteur d'usages ne devient jamais négatif ») est donc satisfaite **y compris sous concurrence**. L'argument « irréparable sans migration sur une base gelée » qui fondait ce report ne tient plus : voir la réécriture d'AR-MIGRATIONS ci-dessous.

**Résidu de test à retirer de la base :**

- ~~Compte `flomarin88+nc3@gmail.com`, profil « Temoin3 ». ⚠️ **Différent des précédents** : il n'a pas son propre foyer, il est **membre du foyer « Marin »**. Le supprimer depuis *Authentication → Users* emporte son profil par cascade sans toucher au foyer. Le compteur de l'invitation `388B626A` restera à 4 — sans conséquence.~~ **— SUPPRIMÉ en production le 2026-07-29.** Plus aucun compte témoin ne subsiste : le nettoyage laisse le seul foyer « Marin » et le seul compte de Florian. Les contrôles d'isolation se font désormais sur le stack local (`npm run test:isolation`), plus jamais en production.

**Choix assumés, à ne pas prendre pour des oublis :**

- **« Code inconnu » et « code plus valable » donnent deux messages distincts** (question laissée sans réponse, implémentée selon la recommandation). Les deux appellent des gestes différents — re-saisir, ou redemander un code. Révèle marginalement qu'un code existe ; facile à fusionner si l'arbitrage change.
- **Deux branches d'erreur ne sont pas vérifiées** : « code expiré » demanderait d'attendre sept jours, « code épuisé » cinq comptes. Écartées explicitement plutôt que simulées.
- **« Créer » reste le chemin par défaut** à l'entrée du foyer, « J'ai un code » le second. L'inverse ferait buter tout nouvel arrivant sur un champ qu'il ne peut pas remplir.

## Deferred from: story 1.6 (2026-07-27)

**Trou d'isolation dans la politique d'écriture de `profiles` — discipline applicative, pas garde en base :**

- ~~`profiles_update_own` est déclarée `using (id = auth.uid())` **sans `with check`**~~ — **CLOS le 2026-07-28** par `20260727154504_restrict_profile_household_update.sql`, appliquée en production : la politique porte désormais `with check (id = auth.uid() and household_id = current_household_id())`, ce qui gèle `household_id`. La garde n'est plus « la discipline du code applicatif » mais Postgres. `app/foyer/DisplayNameForm.tsx` a été corrigé en conséquence — son commentaire affirmait encore le contraire, et la migration le citait comme preuve que son correctif était sûr : les deux documents se contredisaient.

**Piège d'outillage, pour ne pas le redécouvrir :**

- Sur un champ `autoComplete="given-name"`, la liste de suggestions du gestionnaire de mots de passe du navigateur se dessine **par-dessus le bouton de soumission** et **avale le premier clic**. Deux vérifications ont paru échouer avant que la cause soit identifiée. `Échap` referme la liste ; `Entrée` dans le champ soumet directement. Sans effet pour un utilisateur réel, mais toute vérification pilotée par navigateur sur un formulaire de ce type s'y fera prendre.

**Choix assumés, à ne pas prendre pour des oublis en revue :**

- **Deux branches d'affichage ne sont pas observées** : l'état « un seul membre » (demanderait la session d'un compte seul dans son foyer) et « connecté sans profil → `/onboarding` » (demanderait un compte neuf, que la story interdisait de créer). Écartées explicitement plutôt que cochées.
- **Le prénom est le seul champ de `profiles` exposé.** Les colonnes nutritionnelles héritées du prototype (`daily_calories`, `restrictions`, `preferences`…) restent sans surface — aucun FR de la v1 ne les appelle.
- **Aucun lien de retour sur `/foyer`** (décision de Florian, 2026-07-27). On y arrive par l'accueil, on en repart par le bouton « précédent ».
- **Le changement de prénom ne se propage pas en temps réel** : l'autre membre le voit à son prochain chargement. La propagation Realtime (AD-8) appartient à l'Epic 4.

## Deferred from: story 1.7 (2026-07-27)

**Exigence pour l'Epic 6 — la rondeur des titres n'existe pas sur Android :**

- Décision de Florian (2026-07-27) : **aucun fichier de police n'est embarqué**, on s'en tient au stack système (NFR-11, légèreté PWA). `ui-rounded` rend nativement sur Apple mais **n'existe pas sur Android** : les titres et, plus tard, le gros compteur y retomberont sur la sans-serif système — plus plats, mais lisibles. DESIGN.md laissait la webfont de secours ouverte « à confirmer au *finalize* ». **À rouvrir à l'Epic 6**, quand la PWA sera réellement installée sur un Android et qu'on pourra juger sur pièce plutôt que sur principe. Ne pas compenser entre-temps par un `font-weight` plus lourd ou un `letter-spacing` bricolé.

**Trou d'habillage assumé — l'erreur du layout racine reste nue :**

- **`global-error.tsx` n'est pas posé**, et c'est un choix. Il remplace le layout racine, rend ses propres `<html>`/`<body>`, et **ne reçoit pas `globals.css`** : il ne verrait aucun token. L'habiller exigerait une seconde palette en styles inline, qui divergerait au premier changement. Conséquence : une erreur survenant dans le layout racine (ou la page 500 intégrée) s'affiche sans le thème du produit. Sans portée tant que le layout reste aussi mince qu'aujourd'hui ; à réveiller le jour où il portera de la logique.

**Ce que la neutralisation de la palette implique pour la suite :**

- `--color-*: initial` retire la palette par défaut de Tailwind du build. **Toute couleur employée à partir de maintenant doit être un token de DESIGN.md** — `bg-red-500`, `text-gray-400` ou `bg-white` ne génèrent plus rien et échoueront silencieusement (classe inconnue, aucun style). Ce n'est pas un bug : c'est la garde. Un besoin de couleur non couvert par DESIGN.md est un sujet de design, pas un contournement CSS. `--color-transparent` et `--color-current` sont redéclarés explicitement.

**Choix assumés, à ne pas prendre pour des oublis en revue :**

- **Deux écrans n'ont pas été vus dans les deux thèmes** : `/login` (le proxy renvoie l'utilisateur connecté ailleurs) et `/onboarding` (exige une session sans profil). Leur balisage a été contrôlé sans session et n'emploie que des classes de la couche déjà vues rendues ailleurs — c'est une déduction, pas une observation.
- **L'échelle typographique de DESIGN.md n'est pas appliquée aux écrans existants.** Seules les familles le sont. Les tailles nommées (`counter` 48px, `title` 19px, `eyebrow` 11px…) décrivent des composants de liste et de dashboard qui n'existent pas encore ; DESIGN.md place d'ailleurs explicitement les écrans d'authentification, d'invitation et de profil **hors de son périmètre**. Les forcer aurait été une refonte, pas une substitution.
- **Les tokens sans appelant sont volontaires** : `checkbox-*`, `offline-*`, `accent-soft`, `accent-ink`, `muted-2` attendent les Epics 2 à 5. L'AC2 demande que l'accent soit « disponible », pas employé.

## Deferred from: code review of Epic 1 — passe 1/3 (infrastructure) (2026-07-27)

**Décision d'environnement — ~~à trancher avant l'Epic 2~~ CLOSE le 2026-07-29 :**

- ~~**Ouvrir une branche Supabase ou un `supabase start` local.**~~ **Fait** : `supabase start` local, `supabase/config.toml` versionné (ports décalés en 5532x, les défauts heurtaient un autre stack local). Les tests d'isolation existent — `supabase/tests/isolation.test.ts`, 11 au vert, `npm run test:isolation`, hors du glob unitaire parce qu'ils exigent un stack debout. Dents vérifiées : le `with check` de `profiles_update_own` retiré à la main fait tomber la suite à 6/11. **NFR-5 est désormais prouvé par un test, et non plus par un contrôle manuel qui laissait des débris en production.**

  Le texte d'origine reste sous cette ligne, parce que ce qu'il annonçait s'est vérifié au-delà de la prédiction. Il disait qu'un second environnement aurait attrapé le trou `profiles_update_own`. Il en a attrapé un autre, que personne n'avait vu : **aucune migration n'accordait de privilège de table**. Le schéma s'en remettait aux privilèges par défaut de Supabase, permissifs à la création du projet et qui ne le sont plus — sur un stack neuf, `anon`/`authenticated`/`service_role` n'obtiennent que `Dxtm`, et chaque lecture directe rend `42501 permission denied`. Seules les fonctions `security definer` répondaient, ce qui masquait le trou. La chaîne de migrations ne reproduisait donc pas la production : une branche, un nouveau projet ou une restauration de sauvegarde auraient rendu une application morte. Fermé par `20260729094500_grant_table_privileges.sql`.

  > _Texte d'origine (2026-07-27)_ — Il n'existe qu'un seul projet Supabase, et il *est* la production. Conséquence : **aucun test d'isolation RLS n'est possible** sans écrire dans la base réelle — et c'est précisément la famille de tests qui aurait attrapé le trou `profiles_update_own` corrigé ce jour. La preuve du coût est déjà au dossier : trois comptes témoins (`+nc1`, `+nc2`, `+nc3`), deux foyers et onze rayons chacun, abandonnés en production parce qu'aucune politique RLS ne permet de les supprimer depuis l'application. NFR-5 est l'exigence non négociable du produit, et c'est la seule qu'on ne sait pas vérifier.

**Reporté, avec la raison :**

- **Les liens de connexion peuvent être consommés par un analyseur d'emails avant le clic humain** (`app/auth/callback/route.ts`). Outlook SafeLinks, la prévisualisation Gmail/Proton, une passerelle d'entreprise, ou un simple double-tap : le premier GET consomme l'OTP, l'humain reçoit `lien-expire` et redemande un lien qui sera scanné à son tour. *Reporté : la parade (fenêtre d'idempotence, ou interstitiel de sécurité GET) n'est pas triviale, et le risque est marginal sur des boîtes personnelles.*
- **`AuthRetryableFetchError` est reconnu par son nom de chaîne** (`lib/auth/panne.ts`). C'est un nom de classe interne à `@supabase/auth-js` : renommé dans une version mineure, le mode hors-ligne retomberait silencieusement en « pas de session » et déconnecterait tout le foyer à chaque incident. *Reporté : c'est le seul signal que la librairie expose. Le test `panne.test.ts` épingle la chaîne pour qu'une montée de version le fasse voir.*
- **Le proxy traverse tous les assets, y compris `public/`** (`proxy.ts`). *Reporté — décision assumée et documentée, mais **à rouvrir avant l'Epic 6** : `/manifest.webmanifest` est déjà proxifié, et un jeu d'icônes PWA fera payer un aller-retour `getUser()` par fichier, plafonné à 3 s. Le test `proxy-matcher.test.ts` fige la conséquence et échouera le jour où l'exclusion sera ajoutée.*
- **La destination est perdue à la toute première connexion.** Lien profond capturé par le proxy, honoré par le callback, puis `requireProfile` n'y trouve pas de profil et part vers `/onboarding`, qui ne porte pas le `next` et dont les deux formulaires codent `router.replace("/")` en dur. *Reporté : ne concerne que le tout premier passage d'un membre.*
- **`next` est capturé depuis les requêtes RSC** (`lib/supabase/proxy.ts`). Le matcher n'exclut que `_next/static/` et `_next/image/`, donc un `?_rsc=…` finit dans l'URL de connexion et survit à l'aller-retour email. *Reporté : cosmétique.*
- **Les en-têtes anti-cache ne couvrent pas les Server Actions** (`lib/supabase/server.ts`). La fabrique de Server Component ignore le second paramètre de `setAll`. *Reporté : Next n'expose pas d'API pour poser des en-têtes de réponse depuis une Server Action, et leurs réponses sont des POST — non mises en cache par un CDN. Le commentaire du fichier reste à corriger le jour où l'API existera.*
- **Pas de `Content-Security-Policy`** (`next.config.ts`). Les quatre autres en-têtes de sécurité sont posés. *Reporté : Next 16 exige un nonce par requête pour ses scripts inline, ce qui se règle dans le proxy et demande une vérification en conditions réelles.* **⚠️ Échéance RÉÉCRITE le 2026-08-01 (décision de Florian) — nouvelle cible : l'Epic 6, avec la story PWA.** L'ancienne disait « l'epic qui introduit du contenu libre saisi par le membre (recettes, articles) ». Cet epic est arrivé, la story 3.1 a ouvert les recettes, et **il n'a pas ouvert de surface XSS** : React échappe tout ce qu'il rend, il n'y a ni `dangerouslySetInnerHTML`, ni parseur Markdown, ni rendu HTML brut, et NFR-10 interdit la dépendance qui en apporterait un. La nouvelle échéance n'est pas un report de plus : la CSP exige un nonce **dans le proxy**, et l'entrée voisine note déjà que le matcher du proxy est à rouvrir avant l'Epic 6 pour les icônes PWA — les deux travaux touchent le même fichier pour la même raison. *Réécrire l'échéance plutôt que la laisser passer en silence : une prémisse qui sert à reporter un défaut se rouvre avant d'être réinvoquée (`project-context.md` §5) — c'est elle qui a couvert le trou `profiles_update_own` pendant tout l'Epic 1.*
- **Rien ne détecte la dérive entre `lib/supabase/types.ts` et le schéma déployé.** *Reporté : l'étape CI (`supabase gen types --linked` puis `git diff --exit-code`) suppose un `SUPABASE_ACCESS_TOKEN` en secret du dépôt, donc une décision d'infrastructure. En attendant, le rappel « régénérer dans le même commit » vit dans `.github/pull_request_template.md`.*

**Corrections d'entrées devenues fausses :**

- ~~« `lib/supabase/types.ts` est écrit à la main »~~ — **faux depuis la story 1.3** : le fichier est généré (en-tête `__InternalSupabase / PostgrestVersion`, 724 lignes). Ce qui reste vrai, c'est l'absence de contrôle de dérive, tracée ci-dessus.
- ~~« `postcss` n'est plus que transitif »~~ — **faux** : `package.json` le redéclare en devDependency directe (`postcss: 8.5.23`).
- ~~« Rétablir `PUBLIC_ROUTES` en cohérence (`/signup` listée mais n'existe plus) »~~ — **clos** : `epics.md` est aligné sur `/login`, `/auth/callback`, `/auth/bascule`.
- ~~« Valider les variables d'environnement au démarrage »~~ — **clos** : `lib/supabase/env.ts`.
- ~~« `getUser()` n'a aucun timeout »~~ — **clos** : `withTimeout` dans `lib/auth/panne.ts`, appliqué au proxy **et** à la couche données. Le timer perdant est désormais annulé.
- ~~« Aucune revue de code adversariale sur les stories 1.2 et 1.3 »~~ — **en cours** : la passe 1/3 de cette revue les couvre côté infrastructure. Les passes 2 et 3 (métier, UI) restent à mener.

**Constats renvoyés à la passe 2 (couche métier) :**

- **Les messages d'exception plpgsql, en anglais, sont l'API** — `JoinHouseholdForm.tsx` fait du `String.includes` sur `Invalid invite code`, `Invite expired`, `no uses remaining` ; deux fichiers le font sur `Profile already exists`. `docs/migrations.md` bénit `create or replace function` comme mécanisme d'évolution normal, sans mentionner le texte des messages comme contrat consommé. Une reformulation anodine fait retomber trois erreurs distinctes sur « Ça n'a pas marché », invisible au `typecheck` comme en CI.
- **La validité d'une invitation est définie deux fois, avec deux horloges** — `app/foyer/invitation.ts` refait `expires_at > now` et `uses_remaining > 0` en JS (`new Date()`), là où `redeem_household_invite` les évalue en `now()` Postgres.

## Deferred from: code review of Epic 1 — passe 2/3 (couche métier) (2026-07-28)

### AR-MIGRATIONS réécrit — la prémisse « base gelée » n'existe plus

L'énoncé cité comme contrainte dure dans les stories 1.1 à 1.6 — « schéma **déployé et gelé**, aucune
migration, `git status --short supabase/` doit rester vide » — est **caduc depuis le 2026-07-28** :
quatre migrations existent, dont deux appliquées en production.

**Nouvel énoncé.** Le schéma évolue par migrations **strictement additives et disciplinées**, au sens
de `docs/migrations.md` : un fichier déjà appliqué ne se modifie jamais, une correction est une
nouvelle migration, et toute PR qui touche `supabase/migrations/` répond aux quatre questions du
template de pull request. « Gelé » voulait dire « on ne touche pas au schéma pendant l'Epic 1 » ;
cela ne voulait pas dire « le schéma ne peut plus changer », et `docs/migrations.md` décrivait déjà
la discipline réelle.

**Renoncements qui s'adossaient à cette prémisse — à rouvrir ou à confirmer explicitement :**

- ~~Course sur `uses_remaining`~~ — **rouvert et corrigé** (voir plus haut).
- ~~`profiles_update_own` sans `with check`~~ — **rouvert et corrigé** (voir plus haut).
- **`households_insert` autorise tout utilisateur authentifié** à insérer une ligne sans profil
  rattaché, ce qui permet des foyers orphelins invisibles. Le renoncement invoquait « une migration
  sur une base gelée ». **Toujours ouvert**, mais l'argument doit changer : c'est désormais un
  arbitrage de valeur, pas une impossibilité.
- **Le nom du foyer n'est modifiable nulle part.** Aucune story ne le couvre. Sans rapport avec les
  migrations, mais le constat prend du poids maintenant qu'un nom de foyer est borné à 60 caractères
  et qu'une saisie malheureuse est définitive pour tout le foyer.

### Reporté, avec la raison

- ~~Le `as never` dans `lib/foyer/invitation.ts`~~ — **CLOS le 2026-07-28** : migrations poussées,
  types régénérés, contournement retiré. Un enseignement en est sorti : **Postgres perd l'information
  `not null` à travers une vue**, si bien que les types générés de `household_invites_valides`
  déclarent les trois colonnes nullables. Le type écrit à la main le masquait ; le type généré l'a
  révélé, et `invitation.ts` teste désormais explicitement. À savoir pour toute vue future.
- **Les SQLSTATE personnalisés.** `lib/foyer/erreurs.ts` lit déjà `error.code` en priorité, mais les
  fonctions plpgsql lèvent encore sans `errcode`. La bascule est prête côté application (table
  `PAR_CODE`, vide aujourd'hui) et ne demandera aucune coordination le jour venu.
- **Aucun test ne couvre les Server Actions ni les lectures de `lib/foyer/`.** Elles prennent
  désormais leur client en paramètre, donc un faux client suffirait. Ce qui manque, c'est le faux
  lui-même (`lib/supabase/faux.ts`). ⚠️ Il devra porter en tête un avertissement : **il ne modélise
  pas la RLS**, et un test de `membresDuFoyer` avec ce faux prouve le mapping, jamais l'isolation.
- **Le glob de test s'arrête à `lib/`.** Décision assumée et désormais écrite : **les tests vivent
  sous `lib/`**. C'est ce qui a motivé le déplacement de `invitation.ts` et `membres.ts`. Un test
  déposé sous `app/` ne s'exécuterait pas et la CI resterait verte — à savoir.
- **`app/error.tsx` est le seul écran d'une panne Supabase.** Les trois routes lèvent désormais de
  façon cohérente sur `inverifiable`, mais « Ça a coincé » ne dit pas *ce qui* a coincé. Un état
  hors-ligne explicite est du ressort de la passe 3 (UI) ou de l'Epic 4.

## Deferred from: code review of Epic 1 — passe 3/3 (UI & thème) (2026-07-28)

### À faire à la main, et que rien n'automatise

- **Reparcourir les sept écrans dans les deux thèmes.** La vérification visuelle de la story 1.7
  portait sur six écrans et sur un `/foyer` qui a depuis changé trois fois. `/auth/bascule` n'a
  jamais été vu. Aucun test ne peut porter ce contrôle — il reste manuel, et c'est le dernier de
  l'Epic 1 dans ce cas.
- **UNE migration reste à contrôler puis pousser** — `20260728152418_require_non_blank_household_name.sql`
  (écrite après le dernier `db push`). Requête de contrôle en en-tête du fichier :
  `select id, name from households where btrim(name) = '';`
  Elle ne change pas la forme du schéma : pas de régénération de types nécessaire.
  Les quatre autres migrations sont appliquées en production.

### Reporté, avec la raison

- **Pas de `Content-Security-Policy`.** Les quatre autres en-têtes de sécurité sont posés depuis la
  passe 1. Next 16 exige un nonce par requête pour ses scripts inline, ce qui se règle dans le proxy
  et demande une vérification en conditions réelles. À traiter avec l'epic qui introduit du contenu
  libre saisi par le membre.
- **`maxLength` tronque un collage en silence.** Ni compteur, ni message, alors qu'une région de
  statut est juste en dessous. Corriger proprement suppose de décider ce qu'on affiche (« 40
  caractères maximum » avant ou après la troncature) — c'est un choix de copie, pas un correctif.
- **La redirection automatique de 1500 ms après « Tu as déjà un foyer ».** Ni lisible par un lecteur
  d'écran, ni annulable (WCAG 2.2.1). La bonne forme est un bouton « Aller à mon foyer » plutôt qu'un
  minuteur — à faire quand cet écran sera retravaillé.
- **`app/error.tsx` ne distingue pas les causes.** Il a gagné une seconde sortie et le focus sur son
  titre, mais « Ça a coincé » couvre aussi bien une panne d'authentification qu'une erreur de
  lecture. Un état hors-ligne explicite relève de l'Epic 4.
- **Tokens `accent-*`, `checkbox-*`, `offline-*` sans appelant.** Ils attendent les écrans listes de
  l'Epic 2, qui les nomme. Les alias qui basculent restent publiés ; les valeurs brutes ne le sont
  plus.
- **`--font-rounded` n'existe pas sur Android.** Reporté à l'Epic 6 depuis la story 1.7 — et
  désormais **réel** : jusqu'à cette passe, aucun titre ne demandait la famille arrondie, donc la
  dégradation n'avait lieu nulle part, y compris sur Apple.
- **Aucun test ne couvre le JSX.** Décision inchangée : tester des composants exigerait une
  dépendance, ce que NFR-10 interdit. La parade reste d'extraire le pur — ce que cette passe a fait
  pour `versCleMessage` et `lienDeConfirmation`, les deux dernières fonctions pures qui vivaient dans
  des `.tsx`.

### Corrections d'entrées devenues fausses

- ~~« Seules les familles typographiques sont posées »~~ — les familles **et** l'échelle
  typographique le sont désormais, ainsi que les tokens d'espacement nommés.
- ~~« `households.name` protégé par le client »~~ — jamais écrit tel quel, mais un commentaire du
  code l'affirmait à l'envers. Une contrainte `check` existe maintenant en base.

## Deferred from: story 2.1 (2026-07-29)

**Exigence dure pour la story 2.3 — supprimer un rayon détruit ses règles :**

- `product_aisle_map.aisle_id` est `references aisles(id) **on delete cascade**`
  (`20260502000000_initial_schema.sql:120`). Supprimer un rayon efface donc **en silence toutes ses
  règles mot-clé**. Sans portée aujourd'hui : aucune règle n'existe, la story 2.3 les crée. Le jour
  où elle existera, la phrase de confirmation de suppression (« Ce rayon disparaît de ton
  parcours. ») devra le dire — sans quoi Florian perdra un apprentissage sans jamais l'avoir su.
  ⚠️ Ce n'est pas un défaut du schéma : c'est le bon comportement (une règle qui pointe vers un rayon
  disparu n'a pas de sens). C'est l'**information** qui manque, pas la cascade.

**Reporté, avec la raison :**

- **`resolve_aisle_id` reste la seule fonction du schéma sans `set search_path = public`.** Constat de
  `epic-2-revision-2026-07-29.md` §7. Elle n'est pas `security definer` — elle s'exécute avec les
  droits de l'appelant, donc **aucune escalade de privilège** n'est à la clé ; la portée est une
  résolution de nom inattendue. *Non corrigée ici : cette story ne touche pas cette fonction, et la
  révision réserve la correction « à la story qui la touche » — ce sera la 2.3 ou la 4.16.*
- ~~**`docs/migrations.md` est périmé sur un point.** Sa section « Ce que ce projet n'a pas » affirme
  encore *« `supabase db reset` ne doit jamais servir sur ce projet … il n'y a pas d'environnement de
  développement séparé : un seul projet, qui est la production »*. **Faux depuis le 2026-07-29** : le
  stack local existe, et `db reset` y est l'outil normal — il a servi trois fois pendant cette story.
  L'interdiction ne vaut que pour le distant. *Non corrigé ici pour ne pas mêler une réécriture de
  documentation à une story de fonctionnalité ; à reprendre dans une passe propre.*~~
  **CADUC — et l'entrée était fausse au moment où elle a été écrite.** Le commit `03a9a09`, celui-là
  même qui porte ce report, réécrit `docs/migrations.md` de fond en comble, section « Ce que ce
  projet a, et n'a pas » comprise. Le report a été rédigé d'après l'intention du début de story,
  puis n'a pas suivi la décision prise en cours de route (migrations appliquées au déploiement), qui
  rendait la réécriture inévitable. Relevé par la revue du 2026-07-29.
  **La leçon, et elle est plus large que ce point :** un report se relit au moment de commiter, pas
  au moment de le penser. Une entrée « non corrigé ici » dans le commit qui corrige est exactement la
  même famille que les trois commentaires devenus faux de l'Epic 1 — un état de la base écrit dans
  un fichier qui ne le voit pas changer.
- **Le bouton « Remettre les rayons de départ » n'existe que dans l'état vide** (décision de la
  story, AC5). L'ouvrir à un parcours déjà personnalisé est une ligne de code, mais inviterait à
  réintroduire onze rayons qu'on vient de supprimer. À rouvrir si l'usage le demande.

**Pièges d'outillage, pour ne pas les redécouvrir :**

- **Next 16 bloque ses ressources de développement en cross-origin.** Servir sur `localhost:3333` et
  naviguer sur `127.0.0.1:3333` fait refuser `/_next/webpack-hmr` et les fragments clients : **la
  page ne s'hydrate pas**, les formulaires partent en GET natif, et rien ne le dit à l'écran. Le
  message n'apparaît que dans la sortie du serveur de développement. Utiliser `localhost` — surtout
  **ne pas** ajouter `allowedDevOrigins` à `next.config.ts`, qui est l'un des trois fichiers dont
  toute modification exige un contrôle sur le déploiement de la PR.
- **Le stack local utilise les modèles d'email par défaut de Supabase.** Les modèles du produit
  (`docs/email-templates/`, qui concatènent `&token_hash={{ .TokenHash }}&type=magiclink`) vivent dans
  le tableau de bord de **production**. En local, le lien reçu dans Mailpit (`:55324`) pointe vers
  `/auth/v1/verify` avec le `site_url` par défaut : il faut récupérer le `token=` et construire à la
  main `http://localhost:3333/auth/callback?token_hash=<jeton>&type=magiclink&next=%2F`.
- **Basculer `.env.local` vers le stack local est nécessaire pour toute vérification à l'écran.** Les
  variables passées en préfixe de commande **ne suffisent pas** : `NEXT_PUBLIC_*` est figé à la
  compilation depuis le fichier d'environnement chargé, et le bundle continuait de porter la
  référence de production. Sauvegarder, remplacer, **restaurer** — et le contrôler par un `diff`.

**Choix assumés, à ne pas prendre pour des oublis en revue :**

- **Aucune mise à jour optimiste sur cet écran.** Écriture puis `router.refresh()`, donc un temps de
  latence entre le geste et son reflet. L'optimisme et l'outbox d'AD-5 concernent les surfaces liste,
  au supermarché ; un écran de configuration au calme n'en a pas besoin, et une copie locale de la
  liste divergerait dès que l'autre membre écrit (pas de Realtime avant l'Epic 4).
- **Un rayon créé se place APRÈS « Autre »** (`sort_order` 1009 contre 999). C'est la lecture
  littérale de l'AC1 (« en fin de parcours ») ; la story 2.2 rendra le déplacement trivial. Question
  ouverte posée à Florian dans le fichier de story.
- **L'écran est visible des deux membres du foyer.** EXPERIENCE.md le classe « surface de Florian
  uniquement », mais `profiles` n'a aucune colonne de rôle et toute la RLS passe par
  `current_household_id()`, qui est par foyer. Aucun contrôle applicatif n'a été inventé : il serait
  faux (contournable à un appel direct près) et contredirait AD-2. Décision de produit ouverte,
  tracée dans `sprint-status.yaml`.
- **L'état vide n'a été vu qu'en thème clair.** La liste, le panneau d'édition et l'anneau de focus
  l'ont été dans les deux. Que l'état vide tienne en sombre est une **déduction** — il n'emploie que
  `.btn`, `text-base` et `.hint`, tous vus rendus en sombre sur le même écran — et non une
  observation. Écrit comme tel plutôt que coché.

## Deferred from: migrations appliquées au déploiement (2026-07-29)

**Décision de Florian :** plus aucune migration poussée à la main. Le déploiement Vercel de `main`
les applique ; en local, on ne joue que sur le stack `supabase start`. Mécanisme : `vercel.json` →
`scripts/migrer-au-deploiement.mjs`, exécuté **après** `next build`.

**~~À contrôler au premier déploiement~~ — contrôlé le 2026-07-31, et la prédiction était fausse :**

- ~~**La connexion depuis un conteneur de construction Vercel vers Supabase n'a jamais été jouée.**~~
  **Jouée le 2026-07-30, échouée, corrigée le 07-31.** L'attente portait sur le port — pooler de
  session (`5432`) contre pooler de transaction (`6543`) — et une garde couvrait déjà ce cas. Le point
  de rupture réel était l'**hôte** : `SUPABASE_DB_URL` portait la connexion directe
  `db.<ref>.supabase.co`, qui ne publie plus qu'un enregistrement `AAAA` et n'est donc joignable qu'en
  IPv6, quand un conteneur de construction Vercel n'en a pas. Les deux hôtes écoutant tous deux sur
  `5432`, la garde du port ne pouvait pas le voir. Garde sur l'hôte ajoutée, et le mode de défaillance
  documenté dans `docs/migrations.md` § « Le premier déploiement réel, et ce qu'il a démenti ».
  **Ce que ça coûte de retenir :** l'échec n'a rien signalé pendant 23 h, la PR #14 restant fusionnée
  mais non servie. *« Les quatre portes ne voient pas le déploiement »* était juste — c'est bien le
  journal de construction qui fait foi, et personne ne l'a regardé.

**Ce que ce mécanisme ne rattrape pas, et qu'il faut savoir :**

- **Une restauration Vercel ne défait pas une migration.** Elle remet le code, jamais le schéma.
  L'additivité stricte (AR-MIGRATIONS) passe de bonne manière à **condition de sûreté** : elle est ce
  qui rend une restauration survivable.
- **Fusionner une PR applique sa migration.** Il n'y a plus de geste entre l'approbation et la
  production : la revue est le dernier contrôle humain. Une migration qu'on ne veut pas appliquer
  tout de suite ne se retient plus en ne la poussant pas — elle se retient en ne fusionnant pas.
- **Deux déploiements de production simultanés** pourraient tenter la même migration ; la clé de la
  table d'historique en ferait échouer un, donc il ne serait pas promu. Sans portée à ce rythme.

**Conséquence non évidente, déjà appliquée :** `gen types` passe de `--linked` à `--local`. Le distant
n'a plus les migrations au moment où l'on génère, si bien que `--linked` rendrait les types du schéma
*d'avant* et `tsc` validerait contre un schéma que la production n'aura plus. Corrigé dans
`docs/migrations.md` et dans le gabarit de PR.

**Reporté, avec la raison :**

- **La CLI Supabase est épinglée dans le script (`2.110.0`), pas en dépendance de développement.**
  L'ajouter à `package.json` ferait télécharger son binaire à chaque `npm ci` de la CI, pour un outil
  dont seuls le déploiement et le poste de Florian ont besoin (NFR-10). Conséquence assumée : un
  `npx supabase` local non versionné peut différer de celle du déploiement. Monter le numéro est un
  commit délibéré.
- **Rien ne vérifie en CI qu'une migration déjà appliquée n'a pas été modifiée.** La règle reste
  humaine, portée par le gabarit de PR. Elle prend du poids maintenant que la fusion applique : une
  migration éditée après coup ne serait pas rejouée sur le distant, et le dépôt mentirait en silence.

## Deferred from: code review of 2-1-gerer-ses-rayons (2026-07-29)

- **Une migration à horodatage antérieur bloque tous les déploiements suivants.** `scripts/migrer-au-deploiement.mjs:109` lance `supabase db push` sans `--include-all` ni `migration repair`. Deux branches ouvertes dans un ordre et fusionnées dans l'autre suffisent : la CLI refuse d'insérer une migration antérieure à la dernière appliquée en distant, le déploiement échoue, et **chaque déploiement suivant échoue aussi** — y compris ceux qui ne touchent aucune migration — jusqu'à une intervention manuelle sur la base. Le script ne distingue pas ce cas d'une migration réellement fautive. Conséquence de la conception retenue le 2026-07-29, pas un défaut du code ; à documenter dans `docs/migrations.md`, qui liste les autres limites et pas celle-ci.
- **Deux déploiements de production concurrents ne sont pas sérialisés.** Aucun `pg_advisory_lock`, aucun `--dry-run` préalable. Deux PR fusionnées à quelques secondes d'écart lancent deux `db push` sur la même base ; le perdant échoue sur un objet déjà créé alors que la migration *est* appliquée — déploiement rouge sans cause réelle. Corollaire : un « Redeploy » **avec reconstruction** d'un déploiement antérieur aux migrations réclame `supabase migration repair` et échoue, ce qui bloque le chemin de secours « revenir au code d'avant ». Le « Instant Rollback » de Vercel, qui ne reconstruit pas, n'est pas concerné. Faible fréquence sur un projet à un développeur.
- **`useSoumission` : ré-entrance et ré-annonce des messages identiques.** Deux points préexistants, partagés par tous les écrans du produit, découverts en revuant `/rayons` : (a) `occupe` n'est jamais lu à l'intérieur de `soumettre` (`app/_lib/useSoumission.ts:38-50`) — c'est un drapeau de rendu, pas un verrou, donc deux actions parties dans la même fenêtre de repeinture s'exécutent toutes les deux et la dernière écrase la clé de message de l'autre ; (b) `refuser` (`:26-29`) ne passe pas par `setCle(undefined)` avant de poser sa clé, contrairement à `soumettre` — deux refus identiques consécutifs ne changent donc pas le contenu du `<p aria-live>`, et un lecteur d'écran ne les annonce qu'une fois. À traiter dans le hook, pas dans les écrans.
- **Aucune borne de longueur en base sur `aisles.name` et `aisles.icon`.** `MAX_NOM_RAYON = 40` et `maxLength={16}` ne vivent que dans le navigateur ; les deux colonnes sont `text` sans contrainte. Un `POST` REST direct insère un nom d'un mégaoctet ou une icône de 5000 diacritiques, qui casseraient l'affichage pour tous les membres du foyer. Préexistant, atteignable seulement hors interface, et de la même famille que la contrainte `check` ajoutée par cette story — à traiter le jour où l'on écrit une migration de bornes sur les champs libres (`profiles.display_name` et `households.name` ont le même trou).
- **Le bouton « Remettre les rayons de départ » reste réservé à l'état vide, et l'arête qui va avec.** Décision de Florian du 2026-07-29, conforme à ce que la story prescrivait : montrer le bouton sur un parcours déjà personnalisé inviterait à réintroduire onze rayons qu'on vient de supprimer. La conséquence assumée : supprimer dix des onze rayons laisse un état où le bouton est invisible et où **le seul moyen de le faire réapparaître est de supprimer le onzième**. Ressaisir à la main ne rend pas l'ordre du parcours, `sort_order` n'étant pas éditable avant la story 2.2. **À l'intention de la 2.2** : une fois le déplacement possible, l'arête perd sa portée — c'est le moment de vérifier qu'on n'a plus besoin d'y revenir.
- **L'unicité des noms de rayon reste sensible à la casse.** `unique (household_id, name)` compare octet à octet : « boucherie » et « Boucherie » coexistent dans le même foyer, sans `23505`, donc sans message. Décision de Florian du 2026-07-29 : la revue ne traite que la forme Unicode (`.normalize("NFC")` ajouté dans `lib/texte.ts`), pas la casse. La rendre insensible exige un index sur `lower(name)`, donc une migration qui change le comportement d'unicité **pour tout le produit** — `profiles.display_name` et `households.name` portent la même question — et les tests d'isolation à rejouer. À trancher avec son coût, comme la distinction Florian/conjointe.

## Deferred from: story 3-1-creer-et-editer-une-recette (2026-08-01)

**À l'intention de la story 3.6 (assigner recettes et personnes aux cases du menu) — ce n'est pas une suggestion :**

- **La suppression d'une recette vide des cases du menu, en silence.** `meal_plan_entries.recipe_id` est `on delete cascade` (`20260502000000_initial_schema.sql:178`). La story 3.1 a introduit la suppression d'une recette avec sa confirmation en deux temps, et cette confirmation dit aujourd'hui « Elle disparaît de ton répertoire. » — ce qui est **vrai maintenant et faux dès la 3.5** : la grille du menu n'existe pas encore, donc il n'y a rien à avertir. **Dès qu'une recette peut être assignée à une case, la confirmation doit dire qu'elle est au menu** (« Elle est au menu de mardi et de jeudi. »), sinon supprimer efface des repas planifiés sans le dire. C'est précisément parce que cette arête n'a aucun coût aujourd'hui que la suppression a été livrée en 3.1 plutôt que reportée — l'arête est le prix de ce choix, et elle est datée ici pour ne pas être découverte à l'écran.
- **`grocery_list_items.recipe_id` est `on delete set null`** (`:202`) : un article de liste issu d'une recette supprimée **perd sa provenance** sans disparaître. Correct, et sans portée avant l'Epic 4 — mais la story 4.6 (provenance de chaque article) doit savoir qu'un `recipe_id` nul peut vouloir dire « recette supprimée » et pas seulement « ajout manuel ».

**Reporté, avec la raison :**

- **Aucune borne de longueur en base sur `recipes.title`, `description` et `instructions`.** `MAX_TITRE = 80`, `MAX_DESCRIPTION = 300` et `MAX_INSTRUCTIONS = 5000` ne vivent que dans le navigateur ; les trois colonnes sont `text` sans contrainte. Exactement le même trou que celui déjà tracé pour `aisles.name`, `aisles.icon`, `profiles.display_name` et `households.name` — *à traiter le jour où l'on écrit une migration de bornes sur les champs libres*, et désormais cinq tables au lieu de quatre. Atteignable seulement hors interface.
- **Un temps de préparation ou de cuisson négatif est accepté par la base.** `prep_time_min` et `cook_time_min` n'ont pas de contrainte, et l'écran pose seulement `min={0}` — qui n'est pas une frontière. C'est **délibéré et non un oubli** : `servings` a reçu sa contrainte parce qu'il est *consommé par un calcul* (`generate_grocery_list_from_menu` divise par lui), là où les deux temps ne sont qu'affichés. Inventer un contrôle applicatif sans contrepartie en base contredirait AD-1/AD-2 ; ajouter une troisième contrainte sortirait du périmètre de la story. À rouvrir si un écran se met à calculer avec ces temps.
- **Le repli `borne === "" ? null` de `normaliserTexte` et `normaliserMultiligne` est inatteignable** pour tout `maximum >= 1` : le `trim()` qui précède garantit que le premier caractère n'est pas un blanc, donc la tranche le contient toujours. Il reste — il est inoffensif et défensif — mais il ne fait pas ce qu'un lecteur pressé lui prête. Figé par un test dans `lib/texte.test.ts` plutôt que retiré, pour ne pas toucher à `normaliserTexte`, qui est du code livré hors périmètre de cette story.
- **Le répertoire n'est pas trié par un index.** `recettesDuFoyer` range par `title` ; `idx_recipes_household` porte sur `(household_id, created_at desc)`. Sans portée à l'échelle d'un foyer (des dizaines de recettes), et un index sur `(household_id, title)` serait un coût d'écriture pour un gain nul. À rouvrir si le répertoire dépasse quelques milliers de lignes, ce que le produit n'envisage pas.
## Deferred from: story 2.2 (2026-07-31)

**Refermé par cette story — l'arête que la 2.1 lui avait adressée.** L'entrée « Le bouton *Remettre
les rayons de départ* reste réservé à l'état vide » demandait de vérifier ici que son arête perdait
sa portée. **Elle la perd, et c'est mesuré** : l'ordre du parcours est désormais entièrement
ressaisissable — flèches et glisser — donc supprimer dix rayons sur onze n'enferme plus dans un état
irréparable. Il reste à retaper les noms, mais c'était déjà vrai et ce n'est pas ce que l'entrée
signalait. Le bouton reste réservé à l'état vide, conformément à la décision de Florian du
2026-07-29 : **rien à rouvrir**.

**Reporté, avec la raison :**

- **Le glisser n'a pas de défilement automatique en bord d'écran.** Limite assumée et annoncée dès
  l'écriture de la story, pas découverte après coup : on ne peut donc glisser un rayon qu'à
  l'intérieur de la zone visible. Les longs trajets passent par les flèches monter/descendre, qui
  couvrent le cas sans limite — c'est précisément la complémentarité des deux mécanismes. Un
  défilement automatique demande une boucle d'animation, une zone morte en bord d'écran et une
  recalibration des centres mesurés au début du geste ; à traiter le jour où la liste dépassera
  franchement un écran, ce qu'onze rayons ne font pas.
- **La géométrie du glisser se fige au `pointerdown` : défiler la page pendant qu'on tire décale la
  cible.** Les centres des lignes sont mesurés une seule fois, en coordonnées de fenêtre, et c'est ce
  qui garantit que l'index visé n'oscille pas. Corollaire : si l'utilisateur défile *pendant* le
  geste, les mesures se décalent d'autant. Sans défilement automatique, le seul défilement possible
  est délibéré, et le trait d'insertion montre en permanence où le rayon atterrira — l'écart est donc
  visible avant le relâchement, jamais subi. Compenser exigerait de relire `window.scrollY` à chaque
  `pointermove` ; à faire en même temps que le défilement automatique, pas avant.
- **Le chemin TACTILE du glisser n'a pas été observé.** Le mécanisme qui le conditionne est vérifié —
  `touch-action: none` est bien appliqué sur la poignée et sur elle seule (mesuré dans les styles
  calculés), et les gestionnaires sont agnostiques au `pointerType`. Mais le geste lui-même n'a été
  joué qu'à la **souris**. Un vrai doigt sur un vrai iPhone reste à faire : c'est le seul chemin où
  `touch-action` et le défilement concurrent existent, et c'est exactement la classe d'erreur qui a
  fait écarter `draggable` HTML5. **À faire par Florian avant la fusion.**
- **La latence mesurée l'a été contre un Supabase LOCAL.** 81 ms médians par déplacement sur le build
  de production, 771 ms pour remonter un rayon du onzième rang au premier. Le trajet réseau vers un
  projet distant n'y est pas : en production réelle, compter le temps d'aller-retour en plus. La
  décision « pas de mise à jour optimiste » repose sur ce chiffre — s'il se dégrade nettement en
  production, c'est la question 2 de la story qui se rouvre, avec `useOptimistic` pour réponse.
- **`indexCibleDuGlisser` compare des centres, pas des bords.** Conséquence : tirer une ligne
  *haute* (nom sur deux lignes) au-dessus d'une ligne *basse* demande de dépasser le centre de
  celle-ci, ce qui peut sembler exiger un pixel de plus qu'attendu. Le trait d'insertion le rend
  visible en continu, donc l'écart s'observe avant de relâcher. Un modèle par bords serait plus
  fidèle mais demande de gérer les recouvrements ; sans portée tant que les hauteurs restent proches.

---

## Deferred from: code review of 3-2-gerer-les-ingredients-d-une-recette (2026-08-03)

Revue adversariale à trois couches sur `d270c47..8f91f52`. ⚠️ **Story déjà EN PRODUCTION**,
fusionnée sans revue — la troisième d'affilée. Six constats réels mais préexistants, hérités, ou
sans case cochée à tort.

- **`aisle_keyword` : champ libre, partagé, consommé par un calcul, et sans aucune contrainte.**
  La migration `20260802112511` argumente sur quinze lignes que `name` doit descendre en base parce
  qu'« un champ libre partagé par tout le foyer descend en base (AD-1/AD-2), et le contrôle
  navigateur ne voit pas les appels REST directs ». **Le même argument s'applique mot pour mot à
  `aisle_keyword`**, qui est le troisième repli de `resolve_aisle_id`
  (`initial_schema.sql:498-507`) — donc consommé par un calcul, le critère exact invoqué pour
  justifier `quantity >= 0`. Ni contrainte, ni test, ni mention dans le tableau « Frontières ».
  *Scénario : un appel REST pose `aisle_keyword = ''` ou une chaîne d'invisibles ; en Epic 4 la
  résolution de rayon se comporte de travers sans qu'aucune surface ne le montre.*
  *Reporté : même famille que la décision de Florian du 2026-08-02 (« pas de limite pour
  l'instant ») sur `description` et `instructions` — voir la PR #19. À rouvrir ensemble.*

- **`prochainOrdreIngredient` recrée les ex æquo qu'il est censé résorber.** `max(ordre) + 10`
  est calculé sur la liste reçue en propriétés. Deux ajouts concurrents — deux membres, ou deux
  soumissions avant l'arrivée du `router.refresh()` — calculent le **même** `max + 10`. Le tri
  secondaire `created_at` sauve l'affichage, mais `ordreApresDeplacement` part alors d'un ordre
  affiché que `sort_order` seul ne reproduit pas. ⚠️ Le commentaire de la migration affirme le
  contraire (« renuméroter TOUT plutôt qu'échanger est ce qui rend les positions uniques ») — vrai
  du réordonnancement, faux de l'ajout. *Reporté : fenêtre étroite, conséquence cosmétique.*

- **`prochainOrdreIngredient` n'a aucun test**, alors que le piège du `Math.max()` sur liste vide
  (`-Infinity`) est nommément désigné par le piège n°5 de la story et gardé par un simple
  commentaire. C'est la seule fonction pure de cette story qui échappe au filet TDD.
  *Reporté : ni Task 3 ni Task 4 ne l'exigeaient, donc aucune case n'est cochée à tort.*

- **`statutListe` est sans `reserve`.** Il surplombe la liste **et** le formulaire d'ajout : quand
  « C'est retiré. » apparaît, toute la liste descend sous le doigt — le cas exact que
  `project-context.md` décrit pour justifier `reserve`. *Reporté : hérité de `ListeRayons`, à
  traiter sur les deux écrans à la fois.*

- **`break-all` coupe les mots français au caractère** (« oign/ons ») là où l'écran de lecture
  emploie `break-words`. *Reporté : hérité de `ListeRayons`, et déjà consigné pour le `<h1>` de
  l'écran de lecture (PR #19). Même décision à prendre, sur les trois écrans.*

- **`docs/migrations.md` fige « neuf fonctions » comme contrôle de régénération** alors que les
  Completion Notes admettent que `lib/supabase/types.ts` a été **édité à la main**. Le contrôle ne
  prouve donc plus qu'une régénération a eu lieu, seulement qu'une main a écrit neuf lignes.
  ⚠️ *La couche d'audit a MESURÉ que le bloc recopié est identique au généré
  (`supabase gen types --local` + `diff`, écart strictement limité à `__InternalSupabase` ↔
  `graphql_public`) : le compte est donc exact aujourd'hui.* *Reporté : la faiblesse est celle du
  contrôle, pas de la donnée.*

---

## Deferred from: story 3-3-consulter-une-recette-en-lecture (2026-08-02)

**La CSP : prémisse REVÉRIFIÉE au moment où elle est réinvoquée, et elle tient.**

L'échéance de la `Content-Security-Policy` a été repoussée à l'**Epic 6, avec la story PWA**, le 2026-08-01, au motif que « cet epic n'a pas ouvert de surface XSS ». **Cette affirmation portait sur l'écriture** ; la story 3.3 est celle qui *lit* du texte écrit par le membre, et c'est donc elle qui devait la revérifier — règle §5 de `project-context.md` : *une prémisse qui sert à reporter un défaut se rouvre avant d'être réinvoquée*.

**Contrôlé le 2026-08-02, sur l'arbre complet :**

| Contrôle | Résultat |
|---|---|
| `dangerouslySetInnerHTML`, `innerHTML`, `__html` dans `app/` et `lib/` | **aucune occurrence** — la seule est dans un commentaire qui les interdit |
| Parseur Markdown, sanitizer, bibliothèque HTML parmi les 14 dépendances | **aucune** |
| Rendu des champs écrits par le membre (`titre`, `description`, `nom` d'ingrédient, `instructions`) | **expressions React**, donc échappées |
| Mise en forme des instructions | **`white-space: pre-wrap`** — du CSS, vérifié émis dans le build |

**La prémisse tient : cette story n'ouvre aucune surface XSS.** L'échéance Epic 6 reste valide, et pour la raison déjà écrite — la CSP exige un nonce dans le proxy, que l'Epic 6 rouvre de toute façon pour les icônes PWA.

⚠️ **Ce qui reste vrai et n'a pas changé** : le cookie de session Supabase est lisible en JavaScript (`httpOnly: false`, imposé par la librairie) et dure 400 jours. Une XSS exfiltrerait un jeton porteur authentique que la RLS honorerait. Les quatre autres en-têtes (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`) sont posés ; **seule une CSP fermerait ce risque-là.**

⚠️ **La prochaine story qui rend du texte de membre doit refaire ce contrôle**, pas le supposer fait. Il tient en une commande : `grep -rn "dangerouslySetInnerHTML\|innerHTML\|__html" app/ lib/`.

**Reporté, avec la raison :**

- **La quantité s'affiche encore avec un point sur l'ÉCRAN D'ÉDITION** (`app/recettes/[id]/modifier/IngredientsRecette.tsx`, la ligne repliée affiche `{i.quantite}` brut). Le membre tape « 0,5 » — `normaliserQuantite` accepte explicitement la virgule française — et la ligne lui répond « 0.5 ». `formaterQuantite` (`lib/recettes/lecture.ts`) existe désormais et règle le cas ; *reporté parce que déborder sur l'écran d'une autre story rend sa propre revue plus difficile*. Une ligne à changer, et le module est déjà là.
- ~~**Aucun `loading.tsx` sur `/recettes/[id]`.**~~ **ANNULÉ le 2026-08-02 par la revue adversariale — la prémisse était fausse.** Le report disait « `app/recettes/loading.tsx` ne couvre pas cette route ». **C'est l'inverse, et c'est mesuré** : il n'y a aucun `layout.tsx` sous `app/recettes/`, donc le `loading.tsx` du segment enveloppe tous ses enfants, et `.next/server/app/recettes/[id]/page.js` charge bien son module. Le membre voyait donc le squelette **du répertoire** avant sa recette. `app/recettes/[id]/loading.tsx` est posé (option (a), décision de Florian). ⚠️ Ce report est conservé **barré plutôt que supprimé** : c'est la trace d'une affirmation consignée sans être vérifiée, et c'est ce que la règle §1 demande de rendre visible.
- **`generateMetadata` refait une lecture de la recette.** Next met en cache les requêtes d'un même rendu, mais notre client Supabase n'est pas instrumenté pour ça : la métadonnée et le composant lisent deux fois. Sans portée sur un écran de configuration ; à rouvrir seulement si un écran chaud adopte le même motif.

---

## Deferred from: code review of 3-3-consulter-une-recette-en-lecture (2026-08-02)

Revue adversariale à trois couches sur `8f91f52..cfcc75e`. Cinq constats réels, mais
préexistants ou hors du périmètre de la story — reportés pour ne pas faire déborder une
revue sur du code qu'elle n'a pas mandat de juger.

- **`break-all` sur le `<h1>` de titre d'écran coupe les mots français au caractère.**
  `word-break: break-all` coupe **même quand le mot tiendrait à la ligne suivante**,
  contrairement au `break-words` employé deux lignes plus bas sur la description et sur les
  instructions. La justification écrite du motif (`app/page.tsx:22-23`) porte sur un nom de
  foyer « sans garantie d'espace où couper » ; `saisie.ts:22-25` décrit au contraire un titre
  de recette comme « une phrase courte » de 80 caractères, avec des espaces. À 390 px et 200 %
  de zoom, « Curry de pois chiches » se rend « Curry de pois chic / hes ».
  *Reporté parce que c'est le motif déjà en place sur `app/page.tsx:24` et
  `FormulaireRecette.tsx:330` : le changer ici seul créerait l'incohérence qu'on reproche.*
  À traiter comme une décision de `titre-ecran`, sur les trois écrans à la fois.

- ~~**« ← Retour » subsiste sur trois écrans.**~~ **RETIRÉ le 2026-08-02 : ce constat était FAUX,
  et le code portait déjà la réponse.** La revue avait lu la colonne « n'écris jamais » de la table
  Microcopy (« ← Retour », motif : *deux parents possibles*) et conclu à une violation sur
  `app/foyer/page.tsx:56`, `app/rayons/page.tsx:36` et `app/recettes/page.tsx:47`. Or
  `app/recettes/page.tsx:43-45` porte le commentaire qui tranche : *« "Retour" sans destination
  nommée est acceptable ICI, et seulement ici : cet écran n'a qu'un parent possible. Les
  sous-écrans en ont deux — l'accueil et ce répertoire — et nomment donc le leur. »* Les trois
  écrans sont de premier niveau et pointent tous vers `/`. **L'interdiction ne vise que les
  sous-écrans**, et elle est respectée.
  ⚠️ **Conservé barré plutôt que supprimé, et c'est le point.** C'est un faux positif d'une passe
  de revue — la famille de défaut que la règle §6 nomme (« la passe de correction doit être revue
  à son tour ») et que l'Epic 1 a payée trois fois. La revue a énoncé une règle sans lire la
  justification que le code portait à six lignes du constat.
  ⚠️ **Le message du commit `c6ab0b2` répète cette erreur** (« la passe est INCOMPLÈTE : ← Retour
  subsiste sur trois écrans »). Non réécrit — un message de commit est un document historique, au
  même titre que les tables de microcopy des stories livrées. **C'est cette entrée-ci qui fait
  foi.**

- **Le piège du « voisinage » n'est pas refermé sur l'accueil.** `app/page.tsx:24` rend
  `{nom ?? "Chez toi"}` — le repli **nomme le foyer du membre à la deuxième personne**, dix-huit
  lignes au-dessus du bouton « Mon foyer » (`:42`). Deux libellés voisins, la même chose nommée,
  deux personnes différentes. C'est le cas exact décrit par le paragraphe que `cfcc75e` vient
  d'ajouter à `project-context.md:219-223`, sur l'écran qui a servi d'exemple, et pour un état
  que le produit atteint réellement (`app/foyer/page.tsx:65` affiche « Sans nom »). Même
  famille : `app/not-found.tsx:26` « Revenir chez toi ».
  *Reporté parce que hors périmètre de la story 3.3.*

- **Course entre les deux lectures de l'écran de recette.** Si l'autre membre supprime la
  recette entre `recetteParId` (`page.tsx:72`) et `ingredientsDeRecette` (`:76`), la suppression
  cascade sur `recipe_ingredients` et la seconde lecture rend `[]` **sans erreur**. L'écran rend
  alors intégralement une recette qui n'existe plus, et une recette qui avait dix ingrédients
  annonce « Tu n'as pas encore mis d'ingrédients. » avec un lien « Les ajouter » qui mène à un
  404. Même famille : l'onglet peut porter le titre au-dessus de « Il n'y a rien ici. ».
  Le projet traite déjà cette course **côté écriture** (`FormulaireRecette` → `"disparue"`, en
  contrôlant `data` autant qu'`error`) ; côté lecture, zéro ligne est indistinguable de
  « recette vide ». *Reporté : fenêtre étroite, écran en lecture seule, aucune perte de donnée.*

- **Un texte fait de marques combinantes traverse `normaliserMultiligne`.** `\p{Mn}` n'est ni
  dans `INVISIBLES_HORS_SAUT_DE_LIGNE` (`lib/texte.ts:109-110`) ni retiré par `trim()`. Des
  instructions valant `"́́́"` sont donc non vides pour le JSX et **invisibles à
  l'œil** : le titre « Comment on la fait » s'affiche au-dessus d'un paragraphe vide — le titre
  orphelin qu'AC3 bannit. À mesurer en complément : le même texte comme **titre** passerait
  probablement `recipes_titre_non_vide`, dont l'expression est `[^[:graph:]]` plus une
  énumération, et les marques combinantes sont `graph` — ce qui rendrait `<h1>` et `<title>`
  vides à l'œil. *Reporté : saisie délibérée, préexistant à cette story.*
  ⚠️ C'est la **règle §3** qui mord ici (une énumération ne peut pas gagner contre une
  catégorie) — sur `INVISIBLES` **et** sur la contrainte SQL, qui doivent rester d'accord.

### Ajouts de la résolution des décisions (2026-08-02)

- **Aucune contrainte en base sur le texte libre ni sur les temps — reporté par Florian,
  « pas de limite pour l'instant ».**
  `20260801124553_require_valid_recipe_fields.sql:80-87` ne pose que `recipes_titre_non_vide`
  et `recipes_servings_positif`. Ce qui reste **non contraint côté base** : `description`,
  `instructions` (ni contenu ni longueur), `prep_time_min` et `cook_time_min` (ni signe ni
  borne). Les gardes existantes — `MAX_TITRE=80`, `MAX_DESCRIPTION=300`, `MAX_INSTRUCTIONS=5000`,
  `normaliserMultiligne`, et les attributs `min={0}` de `FormulaireRecette.tsx:394,408` — vivent
  **toutes dans le navigateur**.
  *Modèle de menace, et il est écrit par le code lui-même* (`lib/recettes/saisie.ts:17-21`) :
  « un champ libre partagé par tout le foyer, qu'aucun autre membre ne peut corriger, ne doit
  pas pouvoir casser les écrans de chacun ». L'écriture est **client-direct** — le membre
  possède sa clé anon et son jeton de session, `recipes_all` ne contrôle que `household_id` —
  et l'**Epic 7 ouvre une seconde surface (MCP) sur la même base**. Un `PATCH` PostgREST direct
  suffit à poser 2 Mo d'instructions ou `prep_time_min = -30`.
  ⚠️ **Deux choses distinctes sous un seul report.** « Pas de limite » répond aux bornes de
  **longueur**. Le signe des temps est une **validité**, pas une limite de taille : `-30` est
  stockable aujourd'hui et `formaterTemps` l'imprimera tel quel (`lib/recettes/lecture.ts:73-74`).
  Signalé à Florian au moment de la décision ; gardé ici faute d'arbitrage séparé.
  ⚠️ **La migration `20260801124553` a EXPLICITEMENT refusé une contrainte sur les deux temps**,
  au motif qu'ils « ne sont qu'affichés » — c'est-à-dire en désignant l'écran de la story 3.3,
  qui n'existait pas encore. C'est la **règle §5** : une prémisse qui sert à reporter un défaut
  se rouvre avant d'être réinvoquée. Elle vient d'être réinvoquée ; la rouvrir reste dû.
  *AD-1 / AD-2 : la règle métier vit en Postgres, jamais dans la vigilance d'une surface.*

- **`/recettes/[id]/modifier` hérite du squelette de la FICHE.** Effet de bord **mesuré** de la
  pose de `app/recettes/[id]/loading.tsx` (résolution de la décision 1) : `modifier` étant un
  enfant de `[id]`, son build charge le même module
  (`.next/server/app/recettes/[id]/modifier/page.js` → `app_recettes_[id]_loading_tsx_090cap9._.js`).
  C'est un progrès — il affichait jusque-là le squelette du **répertoire**, avec un champ
  « Ajouter une recette » sans rapport — mais ce n'est toujours pas sa forme : l'écran d'édition
  est un formulaire (titre, description, portions, deux temps, instructions, ingrédients).
  *Reporté : poser un `[id]/modifier/loading.tsx` est un travail réel (forme, deux thèmes,
  vérification réseau bridé) sur l'écran d'une AUTRE story, et déborder rendrait sa propre revue
  plus difficile.* Le motif est désormais écrit deux fois dans le dépôt, il n'y a rien à
  inventer.

---

## Deferred from: story 3-5-planifier-le-menu-de-la-semaine-sans-defilement-horizontal (2026-08-04)

**L'AC4 est livré à MOITIÉ, par décision de Florian, et la story 3.6 doit le rouvrir.**

L'AC4 demande que les cases vides soient « lisibles **et directement actionnables** ». « Lisibles » est livré. « Directement actionnables » ne l'est pas : l'action est d'assigner une recette, c'est-à-dire la story 3.6 en entier — et la seconde moitié du même critère (« sans zone ambiguë ») interdit de poser d'ici là une case focalisable qui ne mènerait nulle part. Option (a), tranchée le 2026-08-04 avant démarrage.

⚠️ **C'est une prémisse qui sert à reporter la moitié d'un critère — règle §5.** La story 3.6 doit la **rouvrir en la citant**, pas la supposer close. Ce qui l'attend est déjà en place : la case est dimensionnée, nommée, et n'a besoin que de sa destination. Rien n'est à jeter.

---

**LE TROU : rien n'oblige `meal_plan_entries.recipe_id` à désigner une recette du MÊME foyer.**

⚠️ **Mesuré le 2026-08-04**, sonde exécutée sur le stack local avec deux comptes réels :

| Question | Réponse mesurée |
|---|---|
| A peut-elle poser dans SON menu une case pointant une recette de B ? | **OUI** — `error` nul, une ligne rendue |
| Le titre de B traverse-t-il la jointure `recipes(id, title)` ? | **NON** — PostgREST rend `recipes: null` |

`meal_plan_all` ne contrôle que `household_id` (`initial_schema.sql:316-318`), jamais la provenance de `recipe_id` ; et une contrainte de clé étrangère s'applique **sans égard pour la RLS**. L'écriture étant client-direct (le membre possède sa clé anon et son jeton) et l'Epic 7 ouvrant une seconde surface sur la même base, un `POST` PostgREST direct suffit.

**Ce n'est donc PAS une fuite d'isolation** — NFR-5 tient, la RLS filtre bien la ressource embarquée, et c'est la première fois que ce dépôt le mesure sur cette **forme** de lecture (une jointure, pas une table). C'est un défaut d'**intégrité référentielle** : un foyer peut se fabriquer une case de menu qui ne s'affichera jamais, et que la génération de liste de l'Epic 4 traversera sans rien y trouver.

**Conséquence déjà prise en charge côté lecture** : `casesDeLaSemaine` écarte les lignes dont la jointure rend `null` (`lib/menu/menu.ts`). Cette garde est du **code vivant**, pas une précaution théorique — c'est la sonde qui l'établit.

*Reporté : la story 3.5 ne fait que LIRE. Le trou est à l'écriture, et c'est la story 3.6 qui l'ouvre — c'est elle qui doit le fermer, en même temps qu'elle pose la contrainte `unique(household_id, meal_date, meal_type, recipe_id)` d'AD-6 que son AC2 nomme. Les deux vivent dans la même migration.*

⚠️ **AD-1 / AD-2 : la règle métier vit en Postgres, jamais dans la vigilance d'une surface.** La garde de `casesDeLaSemaine` protège l'affichage, elle ne referme rien. La forme attendue est un `with check` qui exige que la recette appartienne au foyer courant — ou une contrainte équivalente.

**Reporté, avec la raison :**

- **Le squelette de `/menu` n'a pas été regardé au réseau bridé.** Il est écrit sur le motif déjà posé deux fois dans le dépôt et le build charge bien son module, mais la story 3.3 a appris qu'un squelette se juge à l'œil et pas au raisonnement. *Reporté avec le parcours à l'écran, qui n'a pas eu lieu — voir les cases décochées de la Task 5.*
- **`servings` est lu et n'est pas affiché.** `casesDeLaSemaine` le rend (`personnes`), l'écran l'ignore : le nombre de personnes appartient à la story 3.6, qui le rend modifiable en même temps qu'elle l'affiche. *Reporté volontairement — c'est une frontière de story, pas un oubli.*
- **La colonne `notes` de `meal_plan_entries` n'est lue par personne.** Elle existe depuis le squelette, aucune story ne la réclame. *À réveiller si un besoin apparaît ; sinon elle est candidate à la suppression au titre de NFR-10.*

---

## Deferred from: story 3-6-assigner-recettes-et-nombre-de-personnes-aux-cases-du-menu (2026-08-04)

### Ce que cette story REFERME — trois entrées, citées et non effacées

**1. La moitié d'AC4 de la story 3.5 — FERMÉE.** L'entrée disait : « la case est dimensionnée,
nommée, et n'a besoin que de sa destination. Rien n'est à jeter. » C'est exactement ce qui s'est
passé : la case vide est devenue un `<Link>` vers `/menu/[jour]/[repas]`, et le `min-h-touch`
posé d'avance a servi tel quel. **Vérifié à l'écran le 2026-08-04**, et la cible mesure bien
44 px dans le DOM. L'objection qui avait fait écarter cette forme à l'époque — « elle mènerait à
un 404 en attendant » — est levée par la construction de la destination.

**2. Le trou de provenance de `recipe_id` — FERMÉ**, par le volet 2 de
`20260804144217_contraindre_les_assignations_de_menu.sql` : le `with check` de `meal_plan_all`
exige désormais que la recette appartienne au foyer courant. **Mesuré** : la pose rend `42501`,
et le test `isolation.test.ts` qui assurait le contraire a été inversé dans le même commit.

⚠️ **Ce qui RESTE ouvert, et c'est la limite assumée de la forme retenue** : une politique RLS ne
lie ni le rôle de service ni une fonction `security definer`. C'est une frontière de RLS, pas une
contrainte. AD-2 interdisant `SUPABASE_SERVICE_KEY` côté application, le seul porteur est le
harnais d'isolation — délibérément, et c'est ce qui permet encore de mesurer que la RLS filtre la
ressource embarquée. **Si une surface future traversait la RLS, cette prémisse se rouvrirait**
(règle §5). La clé étrangère composite, qui n'aurait pas cette limite, a été écartée le
2026-08-04 : deux clés étrangères vers `recipes` rendraient l'embarquement PostgREST ambigu
(`PGRST201`) et casseraient `casesDeLaSemaine`, donc la grille livrée. *Ce dernier point est
**déduit** de la documentation PostgREST, non mesuré.*

**3. `servings` lu et non affiché — FERMÉ** par l'AC4 : chaque case montre « N pers. ».

**4. Le squelette de `/menu` au réseau bridé — TOUJOURS OUVERT pour la GRILLE.** Celui de la
route `/menu/[jour]/[repas]`, lui, **a été observé** le 2026-08-04 par une sonde de latence
temporaire (4 s côté serveur, retirée aussitôt) : 9 blocs, `aria-hidden="true"`, et **aucune
grille 7 colonnes** — c'est bien son squelette et pas celui du segment parent. Le squelette de la
grille elle-même n'a pas été rejoué.

---

### Ce que cette story LAISSE

- **Les formulaires du produit partent en GET natif avant hydratation.** Observé le 2026-08-04
  sur `/menu/[jour]/[repas]` : une soumission déclenchée avant que React ait hydraté recharge la
  page avec les champs en query string, au lieu d'appeler le gestionnaire. **Ce n'est pas propre
  à cette story** — c'est la fenêtre pré-hydratation, commune à tous les formulaires client du
  produit (`ListeRecettes`, `DisplayNameForm`, `ListeRayons`…), et `project-context.md` la
  mentionne déjà comme symptôme du piège `127.0.0.1`. *Reporté : la traiter demande une décision
  de conception (Server Action de repli, ou bouton désactivé jusqu'à hydratation) qui porte sur
  tous les écrans, pas sur celui-ci.*

- **`min` et `required` produisent un message de navigateur EN ANGLAIS** partout où un formulaire
  ne porte pas `noValidate`. Mesuré le 2026-08-04 : « Value must be greater than or equal to 1. »
  — hors ton, hors région `aria-live`, et il empêche le gestionnaire d'être appelé, donc rend le
  message français **inatteignable**. Corrigé sur les trois formulaires de cette story
  (`noValidate` + validation applicative). ⚠️ **Le même trou existe ailleurs et n'a pas été
  touché** : `ListeRecettes.tsx` (`required` sur le titre), `IngredientsRecette.tsx` (`required`
  sur le nom), `FormulaireRecette.tsx`. *Reporté volontairement — déborder sur trois écrans
  d'autres stories rendrait la revue de celle-ci plus difficile, et c'est la règle que le dépôt
  applique depuis la 3.2.*

- **Le champ « Combien » d'`IngredientsRecette` n'a toujours pas `disabled={occupe}`**
  (`:775-783`), alors que le commentaire du composant (`:741-748`) affirme que tous les champs le
  portent. Mesuré le 2026-08-04 en relisant le motif avant de le reprendre. *Autre écran, autre
  story — signalé, pas corrigé.*

- **Le filtre et la recherche du sélecteur de recettes appartiennent à la story 3.4**, sautée et
  toujours due. Le `<select>` liste tout le répertoire, rangé par titre. Sans portée à l'échelle
  d'un foyer aujourd'hui ; ça deviendra inconfortable bien avant que ce soit un défaut.

- **La colonne `notes` de `meal_plan_entries` n'est toujours lue par personne.** Inchangé.

- **Le réglage du foyer est lu à l'ouverture d'un formulaire, et n'est pas propagé.** Si l'autre
  membre le change pendant qu'un formulaire est ouvert, la valeur proposée reste l'ancienne. Sans
  portée (elle est *proposée*, pas décisive), et la propagation temps réel est l'Epic 4 (AD-8).

- **Le compte de repas de la confirmation de suppression peut être périmé** — il est celui du
  rendu, et l'autre membre peut mettre la recette au menu entre l'affichage et le clic. C'est une
  information, pas une garde : la suppression reste la même. Le dire vaut mieux que se taire.

---

## Deferred from: code review of story-3.6 (2026-08-04)

Revue adversariale à trois couches en contexte vierge. ⚠️ **Menée par le modèle qui a implémenté
la story** — la règle §6 en demande un autre ; les sous-agents à contexte vierge sont une
atténuation, pas un équivalent, et cette limite est datée ici plutôt que tue.

- **Aucun test positif sur `households_update`.** La story affirmait « rien à ajouter, un test de
  plus serait de la redondance » en citant `isolation.test.ts:214-223` — qui n'éprouve que le
  **refus** (« A ne peut pas renommer le foyer de B »). Les quatre tests neufs de
  `contraintes.test.ts` passent par le rôle de service, qui traverse la RLS : ils ne couvrent pas
  la politique non plus. **La revue a comblé la mesure** (`set_config('request.jwt.claims', …)` +
  `set local role authenticated`) : le chemin **fonctionne** — `UPDATE 1` sur sa propre ligne,
  puis refus du `0` par `households_default_servings_positif`. Ce n'est donc pas un bug, mais un
  invariant qui restait **affirmé et non mesuré** sur le seul chemin d'écriture neuf du foyer,
  dans un dépôt dont la règle §4 dit l'inverse. *À transformer en test le jour où `households`
  gagne une seconde écriture.*

- **Aucune borne haute sur le nombre de personnes.** `analyserPersonnes("2147483647")` est
  accepté, et les deux contraintes ne posent que `> 0`. Un foyer réglé à 2 147 483 647 personnes
  verrait ce nombre partir au **numérateur** de la mise à l'échelle de
  `generate_grocery_list_from_menu` — la conséquence exacte que le volet 3 de la migration se
  donne pour mission d'écarter à l'autre bout de la division. *Préexistant dans sa forme :
  `recipes_servings_positif` a la même. À traiter avec lui, pas séparément.*

- **`ajouter` : zéro ligne sans erreur retombe sur « Réessaie » sans aucune trace console.** Le
  `console.error` est sous `if (error)`, donc un `insert` accepté dont le `returning` ne rend
  rien serait muet côté journal. *Atteignabilité non démontrée : le `using` et le `with check` de
  `meal_plan_all` couvrent la même condition.*

- **L'écran d'un repas n'affiche jamais l'année.** `formaterJourLong` rend « Jeudi 31 décembre ».
  C'est le seul écran du produit atteignable **exclusivement par son URL** (favori, lien
  partagé), et rien n'y distingue deux 31 décembre. *Sans conséquence tant qu'on y arrive par la
  grille, qui porte la plage de semaine avec son année.*

- **Une soumission avant hydratation part en GET natif et jette la saisie.** Aggravé par
  `noValidate`, présent dans le HTML rendu côté serveur : il désarme aussi le blocage natif que
  `required` aurait opposé **avant** hydratation. *Motif préexistant (`DisplayNameForm`,
  `ListeRecettes`), mais ce diff en ajoute deux instances, dont une sur un `<select>` qui perd un
  choix et non un texte retapable.*

- **Le repli « aucune recette au répertoire » vit sur l'écran de destination, pas sur la case.**
  La case invite toujours à « Mettre une recette » même quand le répertoire est vide ; c'est
  `AssignerRepas` qui dit « Tu n'as encore aucune recette. » et donne le chemin. Défendable — la
  grille ne lit pas le répertoire — mais ce n'est pas littéralement ce que la sous-tâche décrit.

- ⚠️ **Une empreinte SHA-256 n'est PAS une preuve de restauration valable pour `.env.local`.**
  Le fichier porte `VERCEL_OIDC_TOKEN`, un jeton de **12 heures** que la CLI Vercel réécrit
  toute seule : l'empreinte consignée par la story (`8aa793a6…`) ne correspondait déjà plus au
  fichier quelques minutes plus tard (`c3f894e7…`), **sans que rien n'ait touché aux clés
  Supabase**. La preuve juste est de comparer les seules lignes qui décident — 
  `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` — et non le fichier entier.
  *À corriger dans le gabarit de PR et dans les stories à venir, qui prescrivent toutes le
  SHA-256 du fichier complet.*

- **Le résidu de l'AC2 de la story 3.5 : le zoom 200 % n'a jamais été joué comme un zoom.**
  La story 3.6 a mesuré l'absence de débordement à 1440 px, à 528 px (viewport réel minimal
  atteignable dans Chrome), et avec le conteneur forcé à 390 / 320 / 195 px. **Ce qui n'a PAS été
  éprouvé** : un viewport réel de 390 ou 320 px, et surtout **un zoom à 200 %, qui double la
  taille du texte** — l'axe qui compte le plus pour le pire cas (un titre de 80 caractères dans
  une piste à 1/7 de largeur). L'écart était écrit dans la case de la Task 8, mais le Change Log
  affirmait « PARCOURS À L'ÉCRAN JOUÉ EN ENTIER » sans réserve et rien n'en gardait trace ici.
  ⚠️ **La story referme donc la prémisse de la 3.5 en en laissant une moitié** — c'est la règle
  §5, et le geste juste est de la DATER plutôt que de la taire. *À jouer sur un vrai appareil, ou
  avec un outillage qui sait forcer le viewport (le pilotage par extension ne le peut pas : la
  fenêtre Chrome ne descend pas sous ~528 px, et le document d'un iframe est inaccessible depuis
  le contexte d'extension).*

- **Le refus nommé du `23514` sur `/foyer` n'est pas écrit.** `PersonnesForm` rend `"echec"` pour
  toute erreur base, donc « Réessaie dans un instant. » sur une violation de
  `households_default_servings_positif`. **Décision de Florian du 2026-08-05 : décocher la case
  plutôt qu'écrire le traducteur**, le chemin étant aujourd'hui inatteignable depuis l'écran
  (`analyserPersonnes` refuse déjà le `<= 0` et le hors-bornes) et l'accord des deux bornes étant
  mesuré par `contraintes.test.ts`. *À écrire le jour où une seconde surface écrit dans
  `households` — ce sera alors du code avec un appelant.*

- **Le retour du focus après un `router.refresh()` n'est pas démontré.** Après un enregistrement
  réussi — le seul geste de l'écran suivi d'un rafraîchissement — `document.activeElement` était
  `<body>` au lieu du bouton de la ligne repliée. ⚠️ **La mesure n'est pas concluante** :
  `document.hasFocus()` valait `false`, la fenêtre étant en arrière-plan pendant le pilotage,
  et c'est l'artefact que `project-context.md` documente. Les trois autres gestes (Annuler,
  armer la confirmation, Non) ont rendu le focus dans les **mêmes** conditions — l'API marche
  donc — mais eux ne déclenchent pas de rafraîchissement. L'hypothèse à éprouver : `fermer()`
  consomme la ref au changement d'`enEdition`, puis l'arrivée des nouvelles propriétés remonte
  la liste et perd le focus posé, la ref étant déjà désarmée. *À rejouer à la main, fenêtre au
  premier plan. Le motif copié (`IngredientsRecette`) porte le même enchaînement : si le défaut
  est réel, il est plus large que cette story.*

---

## Deferred from: story 4-1-modele-canonique-de-la-ligne-d-article-isolation-rls (2026-08-05)

*Première story de l'Epic 4. Elle pose la clé canonique, le tombstone, la provenance
polymorphe et retire le DELETE dur aux surfaces. Ce qu'elle laisse est **daté et adressé**,
jamais effacé (règle §6 bis).*

### ⛔ `generate_grocery_list_from_menu` est CASSÉE — pour la story 4.7

**Mesuré le 2026-08-05**, index canonique en place, sur le stack local. La fonction
(`20260502000000:527-580`) échoue en `23505` sur **deux chemins distincts** :

1. **L'acheté survivant.** Son `delete … where status = 'pending'` ne retire pas les articles
   `bought`. Un acheté de même clé canonique survit, et l'INSERT nu qui suit heurte l'index.
2. **Le `group by` trop fin.** Elle groupe par `ri.name, ri.unit, ri.product_id,
   ri.aisle_keyword` : deux ingrédients de même nom et même unité mais de `product_id`
   différents sortent en **deux lignes de même clé canonique**.

Et elle fait un **DELETE dur**, que le critère AC4 de la 4.1 proscrit.

*Reporté sur décision de Florian du 2026-08-05.* La casse est **dormante** : la fonction n'a
**aucun point d'appel** — mesuré, `grep -rn "generate_grocery_list" --include=*.ts` ne rend
que des commentaires. Et la réparer correctement — UPSERT-incrémente sur la clé canonique,
tombstone au lieu du DELETE, génération non destructive, compte des articles ajoutés (FR-17,
AD-6) — **est la story 4.7 en entier**. Une demi-réparation dans la 4.1 aurait été jetée.

⚠️ **La 4.7 hérite donc de trois choses, pas d'une** : les deux `23505`, et le fait que le
critère « jamais de DELETE dur » n'est aujourd'hui tenu **que pour les surfaces**. Une
politique RLS ne lie ni le rôle de service ni une fonction `security definer` détenue par
`postgres` — c'est écrit au volet 6 de `20260805092611`, pas déduit.

### L'index d'idempotence de `source_ref` — pour l'Epic 6

`grocery_list_items.source_ref` **existe** depuis la 4.1. Son unicité, non :

```sql
create unique index … on grocery_list_items (household_id, source_ref)
  where source_ref is not null;
```

*Reporté délibérément.* AD-12 fait de cette colonne l'idempotence du pont Google (« un rejeu
ne réinsère pas »), et l'index appartient à la story qui écrit le pont — poser une contrainte
d'unicité sur une colonne que personne ne remplit encore la rendrait invérifiable. ⚠️ **Ce
n'est pas un oubli : c'est le point n°4 du § « Ce qui est dû » de la story 4.1, écrit pour
qu'il ne soit pas posé en silence.**

### `added_by` est SUPPLANTÉE — pour la story 4.6

La 4.1 pose `actor_kind` / `actor_id` (provenance polymorphe, AD-9), qui remplacent
`added_by` (FK vers `auth.users`). **La colonne n'est PAS supprimée** : `drop column` est
interdit sans décision explicite et sauvegarde vérifiée (`docs/migrations.md`).

La story 4.6 possède le chemin de lecture de la provenance et tranchera son sort — trois temps
(nouvelle forme, migration des données, retrait) ou conservation.

⚠️ **Rappel de l'entrée du 2026-08-01, toujours valable** : `grocery_list_items.recipe_id` est
`on delete set null`, donc un `recipe_id` nul peut vouloir dire « recette supprimée » et pas
seulement « ajout manuel ». La 4.6 doit distinguer les deux, et `actor_kind` ne le lui dira pas.

### `quantity >= 0` et le miroir applicatif de la clé — pour la story 4.4

Deux choses que la 4.1 a délibérément laissées :

- **La contrainte de positivité sur `quantity`.** Le critère du projet est « la valeur est-elle
  consommée par un CALCUL ? » — elle l'est, mais l'agrégation qui la consomme est la 4.4. La
  poser dans la 4.1 aurait contraint un champ que personne n'écrit encore. *C'est le même
  raisonnement que `recipe_ingredients_quantite_positive` (`20260802112511`), à un epic de
  distance.* ⚠️ **`>= 0` et non `> 0`** : une quantité nulle n'a pas de sens mais n'est pas
  dangereuse.
- **Le `normaliserNomArticle` côté client.** La 4.1 mesure l'accord entre `normaliserTexte`
  (nu) et `grocery_list_items_nom_non_vide` ; l'enveloppe de domaine appartient au premier
  écran qui ajoute un article. ⚠️ **Elle n'a PAS à recalculer la clé canonique** — celle-ci vit
  dans l'expression de l'index, côté serveur, et un miroir applicatif serait une seconde source
  de vérité (AD-1/AD-6).

### Ce que la story 4.1 a MESURÉ et qui vaut pour toutes les suivantes

- **`with check` sur `grocery_update` n'est pas ce qui refuse un déplacement inter-foyers.**
  Mesuré : c'est la politique **SELECT** — Postgres exige que le nouvel état d'une ligne mise à
  jour reste visible à celui qui la modifie. Le `with check` est gardé comme ceinture, et aucun
  test ne le fait tomber à lui seul. ⚠️ **À rouvrir si `grocery_select` s'assouplit un jour**
  (dashboard Epic 5, pont Epic 6) : ce jour-là, c'est lui qui restera debout.
- **`unaccent` est `STABLE`, ses DEUX formes.** Le contournement répandu (« employer
  `unaccent(regdictionary, text)`, elle est IMMUTABLE ») est **faux sur PG 17.6**. D'où
  `public.strip_accents`, et la promesse d'immutabilité documentée au volet 1 de la migration.
  ⚠️ **`reindex index grocery_list_items_cle_canonique;` après toute montée de version MAJEURE
  de Postgres** — c'est la contre-mesure, et rien ne la déclenchera tout seul.
- **`g.*` dans une vue est un piège dormant.** Postgres fige l'expansion à la création : les
  colonnes ajoutées ensuite n'y apparaissent jamais, et rejouer le corps d'origine échoue
  (`cannot change name of view column`). `grocery_list_by_aisle` porte désormais une liste
  explicite. ⚠️ **Aucune autre vue du schéma n'a été auditée sur ce point** —
  `household_invites_valides` (`20260728133837`) reste à vérifier.

---

## Deferred from: code review of story-4.1 (2026-08-05)

*Revue adversariale à trois couches sur `20260805092611`. Tout ce qui suit a été **MESURÉ**
(`docker exec -i supabase_db_nutriclaude psql`, chaque sonde en `begin … rollback`). Les
constats bloquants et les correctifs restent dans le fichier de story ; ces trois-là sont
reportés parce qu'ils appartiennent à une story qui possède le chemin d'écriture concerné.*

### `deleted_at` accepte une date future, et `(status, deleted_at)` n'est contraint par rien — pour la 4.5 / 4.10

**Mesuré** : `insert … (deleted_at) values ('2999-01-01Z')` → accepté. `insert … (deleted_at,
status) values (now() + interval '100 years', 'bought')` → accepté. Une ligne peut donc être
simultanément achetée et supprimée, ou supprimée dans le futur.

La vue `grocery_list_by_aisle` teste `deleted_at is null`, **jamais** `deleted_at <= now()` :
un tombstone daté de 2999 fait disparaître la ligne **immédiatement** et reste indiscernable
d'un tombstone posé maintenant.

*Reporté* : la 4.5 possède le chemin d'écriture du tombstone et la 4.10 l'arbitrage LWW — c'est
là que la question « un tombstone futur veut-il dire quelque chose ? » se tranche. La contrainte
candidate est `check (deleted_at is null or deleted_at >= created_at)`.
⚠️ **La fenêtre bon marché se referme à la 4.4** (table encore vide) : après, c'est une
migration de données.

### `unit` n'est normalisé nulle part, contrairement à `name` — pour l'Epic 6 / la 4.4

**Mesuré** : `insert … (unit) values (normalize('pièce', NFD))` → `23514
grocery_list_items_unite_fermee`, sur une unité que le membre a pourtant **choisie dans une
liste fermée**. `name` traverse `normalize(name, NFC)` dans l'expression de l'index ; `unit` ne
traverse rien — ni dans `grocery_list_items_unite_fermee`, ni dans la clé canonique.

Les 7 jetons faux du test de `contraintes.test.ts` sont tous en NFC : le cas n'est mesuré par
rien.

*Reporté* : sans conséquence tant que l'unité vient d'un sélecteur d'écran. À rouvrir quand le
**pont Google** écrira (AD-12 : « l'ingestion normalise vers le vocabulaire fermé ») — un texte
dont personne ne contrôle la forme Unicode. Correctif candidat : `normalize(unit, NFC)` dans les
deux expressions, ou un test qui **fige** le refus actuel comme voulu.

### ⛔ Les articles ACHETÉS ne sont rendus par aucune surface — pour la story 4.5

*Décision de Florian du 2026-08-06, à la contextualisation de la story 4.2.*

`grocery_list_by_aisle` filtre `status = 'pending' and deleted_at is null`. Or :

- **FR-3** — « Les articles achetés **restent consultables et récupérables**. »
- **`DESIGN.md:283`** décrit un séparateur « **Dans le panier** » qui sépare, *à l'intérieur d'un
  rayon*, les articles à prendre (en haut) des articles déjà cochés (repoussés en bas).
- **`DESIGN.md:279`** décrit l'état acheté : « libellé **barré** + muted (reste lisible pour
  permettre la récupération, FR-3) ».

La story **4.1** avait laissé le filtre en écrivant : « **La vue ne change PAS son filtre
`status = 'pending'`** : c'est le périmètre de la **4.2 / 4.5**. » Sans dire laquelle.

**Tranché : c'est la 4.5.** Motif — **cocher est la story 4.3**. Tant que rien ne coche, aucun
article n'est `bought` : un panier livré en 4.2 serait **vide et invérifiable**, donc un critère
non démontrable. La 4.5 possède le chemin d'écriture du tombstone et l'archivage des achetés ;
elle arrive après la 4.3 et pourra l'éprouver.

⚠️ **Ce que la 4.5 devra trancher, et qui n'est PAS décidé ici** : élargir la vue (⚠️
`create or replace view` n'autorise l'ajout de colonnes **qu'en fin** — mesuré story 4.1, M8), ou
une seconde lecture. ⚠️ **Une seconde source de lecture heurterait l'AC3 de la 4.2** (« aucune
surface ne calculant son propre regroupement ») : le contrat n'en prévoit qu'une.

⚠️ **Conséquence visible en attendant** : le ratio `n/total` de chaque carte-rayon vaut **`0/n`**,
puisque `pris` se calculerait sur des articles que la vue ne rend pas. C'est écrit dans la Task 2
de la 4.2 pour qu'un relecteur n'y voie pas un défaut.

### ⛔ `recipe_ingredients_nom_non_vide` garde le trou que la 4.1 vient de fermer — pour la 4.x recettes

**Mesuré le 2026-08-05.** La regex d'invisibles de `20260802112511:84` laisse passer **241**
points de code `Default_Ignorable`/`Cf`, en deux plages :

- **U+180F** — voisin immédiat de la plage `᠋-᠎` déjà énumérée, ajouté par
  **Unicode 14** après la rédaction de la regex ;
- **U+E0100–U+E01EF** — les sélecteurs de variante supplémentaires.

La revue de la story 4.1 a **étendu** la forme dans `20260805092611` (mesuré : 0 survivant), mais
`20260802112511` **n'est pas retouchée** — elle est appliquée, et une migration appliquée ne se
retouche plus (`docs/migrations.md`). Les deux formes divergent donc à partir d'aujourd'hui.

**Ce qui reste ouvert côté recettes** : un nom d'ingrédient composé uniquement de ces points de
code passe `recipe_ingredients_nom_non_vide`. Sans conséquence d'unicité là-bas — aucune clé
canonique n'est bâtie sur `recipe_ingredients.name` — mais c'est le même défaut, et il porte le
jour où l'Epic 4 ingérera les ingrédients (`generate_grocery_list_from_menu`, story 4.7).

⚠️ **Et la règle §3 n'est pas satisfaite pour autant.** C'est la troisième rédaction d'une
énumération que ce dépôt sait perdante : Postgres n'a pas de propriété Unicode dans ses
expressions rationnelles, donc ce n'est pas une victoire, c'est un report **mesuré**. La
prochaine version d'Unicode rouvrira l'écart. Le seul contrôle qui le dira est le test d'accord
client ↔ base de `contraintes.test.ts` — et il ne le dira que pour `grocery_list_items`.

### La régénération de `lib/supabase/types.ts` n'est pas reproductible — pour qui touchera au schéma

**Mesuré le 2026-08-05, en revue de la story 4.1.** Le premier jet de la story emportait deux
changements sans rapport avec sa migration : `__InternalSupabase: { PostgrestVersion: "14.5" }`
**supprimé**, et un schéma `graphql_public` entier **ajouté**. Ni l'un ni l'autre ne vient du
schéma — PostgREST tourne toujours en v14.5 (mesuré :
`public.ecr.aws/supabase/postgrest:v14.5`).

**La cause : deux CLI Supabase coexistent sur le poste, et rien ne dit laquelle employer.**

| Chemin | Version mesurée |
|---|---|
| `/opt/homebrew/bin/supabase` | **2.100.0** |
| `npx supabase` | **2.111.0** |

`package.json` n'épingle aucune version (décision de Florian du 2026-08-05 : ne pas en ajouter,
NFR-10), et l'en-tête des migrations prescrit `npx supabase gen types` — donc *la plus récente du
jour*. La story 4.1 a été corrigée en régénérant avec la version d'origine, mais **le problème
n'est pas résolu, il est circonscrit** : la prochaine personne qui régénérera produira un
troisième diff sans rapport avec son travail, et ne saura pas pourquoi.

**Ce que la revue a fait** : l'en-tête de `20260805092611` porte désormais la commande **exacte**
— `npx -y supabase@2.106.0 gen types typescript --local --schema public` — et le fichier a été
régénéré avec elle. `graphql_public` a disparu du diff, qui est retombé de **53 insertions / 4
suppressions à 26 / 5**.

⚠️ **CE QUI N'A PAS PU ÊTRE REFERMÉ, ET C'EST MESURÉ, PAS SUPPOSÉ.** Aucune version de CLI ne
reproduit la ligne de base :

| Version | Lit `config.toml` ? | `graphql_public` | bloc `__InternalSupabase` |
|---|---|---|---|
| 2.103.0 · 2.104.0 · 2.105.0 | **non** — `invalid keys: local_smtp` | — | — |
| 2.106.0 · 2.107.0 | oui | oui (évitable par `--schema public`) | **non** |
| 2.111.0 | oui | oui | non |

La ligne de base porte le bloc `__InternalSupabase: { PostgrestVersion: "14.5" }` ; plus aucune
CLI lisant ce `config.toml` ne l'émet. Sa **suppression subsiste donc dans le diff de la story
4.1** — 5 lignes, sans conséquence mesurée (`typecheck` et `lint` verts), mais sans rapport avec
elle. La restaurer à la main dans un fichier généré aurait été reperdu à la régénération
suivante, et aurait de toute façon contredit la ligne 663 du même fichier, que la CLI émet
toujours : `type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">` — une omission
d'une clé qui n'existe plus. **C'est une incohérence du générateur, pas du dépôt.**

⚠️ **Ce que ça coûtera si personne ne le reprend** : la commande épinglée ne vit que dans l'en-tête
d'**une** migration. La prochaine personne qui régénérera depuis une autre story emploiera la
commande nue, et `graphql_public` entrera dans le contrat PostgREST que la story **4.12** doit
geler sans qu'aucune story l'ait décidé. Les pistes, à arbitrer : un script `gen:types` dans
`package.json` portant la commande épinglée (**aucune dépendance ajoutée** — `npx -y` la tire à
la demande, donc NFR-10 tient), figer la version dans `.github/workflows/ci.yml` via
`supabase/setup-cli@v1`, ou épingler la CLI en `devDependencies`.

### Rien n'attache `actor_id` à l'appelant — pour la 4.6

**Mesuré** : `grocery_insert` porte `with check (household_id = current_household_id())` et **rien
d'autre** ; `grocery_update` de même. Un membre peut donc attribuer un article à **un autre
membre de son foyer** — la provenance de FR-7 est auto-déclarée par le client, alors que
l'écriture est client-direct (AD-13).

*Reporté sur décision de Florian du 2026-08-05, en revue de la story 4.1.* C'est le seul des
quatre invariants trouvés en revue que la 4.1 n'a pas les éléments de trancher :

- la forme correcte dépend de l'**Epic 5**, où `actor_kind = 'device'` rend `auth.uid()`
  dépourvu de sens — un appareil n'est jamais une FK `profiles` (AD-9/NFR-6) ;
- **aucune surface n'écrit encore** `actor_kind`/`actor_id` (mesuré) ;
- se tromper de forme ici coûterait une migration corrective sur une table peuplée.

La candidate est `with check (actor_kind is distinct from 'profile' or actor_id = auth.uid())`.
La story **4.6** possède le chemin de lecture de la provenance et tranchera.
⚠️ **À ne pas confondre avec `check ((actor_kind is null) = (actor_id is null))`**, qui est
posée par la 4.1 : celle-là dit que la provenance est un **couple**, celle-ci dirait **qui** a le
droit de le remplir. Deux questions distinctes.

### `strip_accents` est exposée en RPC appelable par `anon` — pour la 4.12

**Mesuré** : `has_function_privilege('anon', 'public.strip_accents(text)', 'execute')` → `t`.
C'est un effet de l'`alter default privileges … grant all on functions to anon, authenticated,
service_role` de `20260729094500`, sur lequel le volet 1 de `20260805092611` s'appuie
**explicitement** pour ne pas écrire de `grant`.

`lib/supabase/types.ts` l'enregistre désormais dans `Functions` : la primitive entre donc dans
le contrat PostgREST. Aucune ligne de la story 4.1 ne **décide** qu'elle doit être appelable
sans session — c'est hérité, pas choisi.

*Reporté* : sans danger (fonction pure, `strict`, `immutable`, n'expose aucune donnée). La story
**4.12** gèle le contrat versionné : c'est elle qui doit trancher si cette primitive interne en
fait partie, ou si elle mérite un `revoke execute … from anon`.

## Deferred from: code review of 2-4-composant-carte-rayon (2026-08-06)

*Revue adversariale à quatre couches. Ce qui suit est **réel et non actionnable maintenant** — soit
pré-existant, soit propriété d'une autre story. Les correctifs de la 2.4 elle-même sont dans son
fichier, § Review Findings.*

### ⛔ Le ratio `n/total` est inatteignable depuis la vue qu'il cite — `total` RÉTRÉCIT

**Mesuré le 2026-08-06.** `grocery_list_by_aisle` filtre `status = 'pending'`
(`20260805092611_poser_le_modele_canonique_de_la_liste.sql:625`). `deferred-work.md` note déjà que
le ratio vaudra `0/n` tant que la 4.3 n'a pas posé la coche — ⚠️ **mais la conséquence est plus
mordante que ça, et elle n'était pas écrite** : parce qu'un article coché **sort de la vue**,
`total` diminue à chaque coche. Le ratio parcourt `0/4 → 0/3 → 0/2 → …`, il n'affiche **jamais**
`1/4`. Un compteur qui décroît des deux côtés n'apprend rien au membre.

Or `DESIGN.md:283` décrit l'inverse : un séparateur « Dans le panier » qui repousse les achetés
**en bas du même rayon**, donc toujours comptés. Le `n/total` d'UX-DR4 suppose cette lecture.

**Pour la 4.5** (qui possède l'archivage des achetés) — et ⚠️ **à signaler à la 4.2**, qui prévient
son relecteur qu'il verra des `0/n` sans dire que le dénominateur bouge aussi. Le commentaire de
`lib/rayons/carte.ts:47-51` présente `0/n` comme un état transitoire bénin ; c'est un contrat que
la source citée ne peut pas honorer.

### ⚠️ `break-all` hache les noms français qui ont pourtant des espaces où couper

`app/_lib/CarteRayon.tsx:106`, et **c'est un motif pré-existant** : `ListeRayons.tsx:935` fait
pareil, et la story 2.4 le prescrivait explicitement. Mais les rayons semés portent des espaces
(« Fruits & Légumes », « Hygiène & Entretien », « Épicerie sèche ») : `break-all` les ignore et
coupe à un caractère arbitraire.

Le précédent invoqué — `InviteCard.tsx:126` — est un code hexadécimal de 8 caractères, qui n'a
**aucune** opportunité de coupure. C'est la situation inverse. `overflow-wrap: anywhere`
(`wrap-anywhere`) protège du cas sans coupure possible **sans** mutiler le cas courant.

⚠️ **Transverse** : le changer touche les deux fichiers, donc la story 2.2. À grouper avec un
passage typographique, pas à faire au fil d'une story de composant.

### ⚠️ `<h2>` est figé dans un composant que trois surfaces doivent monter

`app/_lib/CarteRayon.tsx:106`. Le commentaire affirme que tout consommateur rend un `<h1>`
au-dessus — rien ne l'impose. La **tuile Courses du dashboard** (`DESIGN.md:277`, Epic 5) porte
déjà son propre titre : le même composant produira une hiérarchie juste sur `/courses` et cassée
sur le dashboard, **en silence**.

⚠️ Le raisonnement que la story tient pour `id` (« l'ajouter plus tard obligerait à toucher les
trois appelants ») vaut mot pour mot pour un `niveauDeTitre` et n'a pas été appliqué. **Pour l'Epic
5**, ou pour la 4.17 si elle arrive d'abord.

### ⚠️ Aucun `dir="auto"` ni isolation bidi sur un nom en champ libre

`app/_lib/CarteRayon.tsx:106`. Le document est `<html lang="fr">` sans `dir`. Un nom arabe ou
hébreu, ou mêlant chiffres et ponctuation, se rend contre la direction de base : la ponctuation
finale saute du mauvais côté, et un `U+202E` non terminé retourne la suite du titre.

⚠️ **Pré-existant et transverse** — tout champ libre du produit est concerné, pas cette carte.
Produit francophone : faible priorité, mais le champ accepte n'importe quel texte.

### ⚠️ Une icône de plus d'un glyphe déborde la pastille de 24 px sans rognage

`app/_lib/CarteRayon.tsx:89-94` : `size-6 shrink-0`, aucun `overflow-hidden`. La propriété est
typée `string | null`, pas « un point de code ». `normaliserIcone` réduit à un grapheme **à
l'écriture**, ce qui couvre le chemin normal — mais une séquence ZWJ rendue en deux glyphes par une
plateforme qui ne la connaît pas peindra hors de la boîte, par-dessus le `<h2>`.

*Reporté* : le chemin d'écriture protège le cas réel. À refermer d'un `overflow-hidden` le jour où
la pastille sera retouchée.

---

## Deferred from: code review of story-2.4 (2026-08-07, seconde passe)

*Seconde passe adversariale, sur la passe de correction elle-même (règle §6). Les trois derniers
points étaient DÉJÀ reportés le 2026-08-07 : ils sont re-mesurés ici, pas rouverts.*

### ⚠️ Le thème sombre : la bordure, seul séparateur, mesure 1,30:1

`app/globals.css` (`--card-border`, `--card-shadow`) et `app/_lib/CarteRayon.tsx:93`. **Mesuré** en
sRGB sur les trois arrêts de `--surface-base-image` sombre, `--card-shadow` valant `none` :
`--card-border` rend **1,30–1,33:1 vs la page** et **1,14–1,15:1 vs la carte** ; `--surface-card`
rend 1,14–1,16:1.

⚠️ **La story déclare le piège n°1 « refermé par construction ». Mesuré, il ne l'est qu'en CLAIR**,
où l'ombre `0 6px 18px` relaie la bordure. En sombre il n'y a aucune seconde affordance, et
WCAG 1.4.11 demande 3:1. Le parcours à l'œil du 2026-08-07 a bien vu les cartes se détacher — sur
**sept cartes de sonde bien espacées**, pas sur la pile serrée que la 4.2 rendra.

*Reporté* : les tokens sont pré-existants et transverses (toute carte du produit est concernée).
~~**À rouvrir à la story 4.2**, qui est la première à empiler des cartes-rayon.~~

> ✅ **ROUVERTE ET REFERMÉE LE 2026-08-12** — décision de Florian, en seconde passe de revue de la
> story 4.2. **Cette entrée est SUPERSÉDÉE** par « ⛔ En thème SOMBRE, rien sur l'écran liste
> n'atteint les 3:1 d'une frontière » (§0 du relevé du 2026-08-12, en fin de fichier), qui la
> remplace pour la suite.
>
> ⚠️ **Deux de ses trois chiffres étaient faux, dans le sens sévère** : la sonde ne compositait pas
> `--surface-card` sous la bordure (`background-clip: border-box`). Bordure/page vaut **1,538–1,586**
> et non 1,30–1,33 ; bordure/carte **1,352–1,360** et non 1,14–1,15. Seul `carte/page`
> (1,14–1,16) est confirmé.
>
> ⛔ **Mais la pile serrée a révélé pire que ce que cette entrée soupçonnait** : le séparateur réel
> de deux cartes voisines n'est pas la bordure, c'est la **gouttière de 14 px de fond de page**, à
> **1,138:1**. Le défaut tient donc, avec un autre coupable. **Règle §5 : cette prémisse ne peut plus
> couvrir le défaut.**

### ⚠️ Le `<section>` de la carte n'a aucun nom accessible : ce n'est pas une `region`

`app/_lib/CarteRayon.tsx:92`. Ni `aria-label` ni `aria-labelledby`. Par HTML-AAM, un `<section>`
sans nom accessible prend le rôle `generic`, pas `region` : le regroupement n'existe pas pour une
aide technique. Le composant a soigné la navigation par titres (`<h2>`) et laissé la navigation par
régions vide — sur un écran qui empilera dix cartes, c'est le mode de parcours naturel qui manque.

⚠️ Le correctif naturel (`aria-labelledby` vers un `id` du `<h2>`) emploierait précisément la
propriété `id` que le contrat exige et que personne ne lit.

*Reporté* : **story 4.13**, le plancher d'accessibilité de la liste.

### ⚠️ Le ratio `.sr-only` est FRÈRE du `<h2>`, donc absent de la navigation par titres

`app/_lib/CarteRayon.tsx:155-165`. Le couple `aria-hidden` + jumeau `.sr-only` est correct — c'est
son **rattachement** qui manque. En mode « titre suivant », qui est la façon de survoler une liste
de rayons, l'utilisateur entend « Fruits & légumes » et **jamais** « 3 sur 4 pris ».

*Reporté* : **story 4.13**. À traiter avec le point précédent — les deux se corrigent ensemble.

### ⚠️ `nomDeRayon("À classer")` est indiscernable du repli

`lib/rayons/carte.ts:130`. **Mesuré** : `nomDeRayon("À classer") === nomDeRayon(null)`. Rien ne
réserve ce nom en base — `aisles` ne porte qu'un `unique (household_id, name)`. Un membre qui
nomme un rayon « À classer » obtient deux cartes titrées « À CLASSER », et la seule chose qui les
distinguerait — `id` — n'est lue par rien. La 4.17 triera l'une en fin de parcours et pas l'autre,
sans que l'écran le dise.

*Reporté* : **story 4.17**, qui possède le libellé et le groupe « À classer ».

### ⚠️ `ListeRayons.tsx` affiche l'icône SANS passer par `iconeDeRayon`

`app/rayons/ListeRayons.tsx:932` fait `{rayon.icone ?? ""}`. La même icône échappe donc, sur l'écran
des rayons, aux nettoyages que la story 2.4 vient de canoniser pour la carte. Deux surfaces, deux
traitements de la même donnée — c'est la forme d'invariant que la règle §4 veut mesurée.

*Reporté* : pré-existant et hors du diff de la 2.4. À refermer quand `/rayons` sera retouché, ou
par un test qui mesure que les deux surfaces s'accordent.

### ⛔ U+FE0F n'est pas exclu d'`INVISIBLES_HORS_JOINTURE` : les emoji composés sont démembrés

`lib/texte.ts:58-59`. Le sélecteur de variante U+FE0F est `Cf` **et** `Default_Ignorable`, donc dans
la plage ; l'anticipation négative n'exclut que ZWJ (U+200D) et ZWNJ (U+200C). **Mesuré** :

| entrée | rendu | conséquence |
|---|---|---|
| `❤️` (U+2764 U+FE0F) | `❤` | glyphe **texte** noir, plus l'emoji |
| `🏳️‍🌈` | `🏳‍🌈` | séquence **non-RGI**, rendue en 2 glyphes |
| `👨‍❤️‍👨` | `👨‍❤‍👨` | non-RGI, 3 glyphes |
| `1️⃣` | `1⃣` | cassé |
| `🏴󠁧󠁢󠁳󠁣󠁴󠁿` (Écosse) | `🏴` | les 6 caractères de tag retirés |
| `🧑‍🍳` | inchangé | ✅ le seul cas testé — et le seul emoji composé **sans** VS16 |

⛔ **La racine est à la SAISIE, pas à l'affichage.** `normaliserIcone` (`lib/rayons/saisie.ts:32`)
emploie la même plage : un membre qui choisit ❤️ **enregistre déjà ❤**. `iconeDeRayon` ne fait que
réappliquer une transformation déjà subie — d'où le report plutôt qu'un correctif dans la 2.4.

✅ **Le semis est hors d'atteinte** — vérifié, les 11 icônes de `seed_default_aisles` sont des
pictogrammes à un seul point de code, sans VS16.

⚠️ **Ce qui rend le défaut invisible** : les claviers iOS et Android insèrent VS16 automatiquement
pour tout symbole à présentation texte par défaut, et le test unique de la classe (`🧑‍🍳`) est
précisément celui qui n'en porte pas. Aucune porte ne le voit.

*Reporté* : **décision de Florian du 2026-08-07** (option B). Transverse — le correctif touche
`lib/texte.ts`, `lib/rayons/saisie.ts`, leurs tests et le test d'accord client/base. Story dédiée à
créer. ⚠️ Règle §3 : la correction s'écrit par **exclusion de catégorie**, jamais en énumérant les
points de code à garder.

---

## Deferred from: dev-story 4.2 (2026-08-07)

### ⛔ `generate_grocery_list_from_menu` fait SEGFAUTER PostgreSQL — et le test qui la garde passe pour la mauvaise raison

**Découvert en implémentant la story 4.2**, parce que ses nouveaux tests d'isolation
étaient les premiers à s'exécuter APRÈS celui de la génération. Hors périmètre de la
4.2 : la fonction appartient à la story **4.7**.

**Mesuré le 2026-08-07, sur le stack LOCAL** (rien n'a été vérifié en production, et
rien n'est affirmé à son sujet) :

| Sonde | Résultat |
|---|---|
| Journal du conteneur `supabase_db_nutriclaude` | `LOG: server process (PID …) was terminated by **signal 11: Segmentation fault**`, puis `database system was not properly shut down; automatic recovery in progress` |
| Sonde à **deux** appels RPC par un membre authentifié | **delta de exactement 2 segfaults** — un par appel, déterministe |
| L'erreur réellement rendue par l'appel | `{"code":"PGRST001","details":"no connection to the server","message":"Database client error. Retrying the connection."}` |
| Suite d'isolation, mes 3 tests placés APRÈS | 95 pass / 3 fail, systématiquement |
| Les mêmes 3 tests lancés SEULS | **3 pass / 0 fail** |
| Suite d'isolation SANS mes 3 tests | 86 pass / **9 fail** — le crash frappait déjà, il n'était pas vu |
| Redémarrage du conteneur `db` | **ne corrige rien** — 8 segfauts de plus après |

**Deux défauts distincts, et le second est le plus insidieux :**

1. ⛔ **Un membre authentifié ordinaire fait tomber le serveur de base de données**
   avec sa seule clé anon et son jeton. Sur le stack local, c'est un déni de service
   à un appel RPC près.

2. ⛔ **Le test `« un membre authentifié ne peut PAS appeler la génération de liste »`
   ne mesure pas ce qu'il croit.** Il assertionne `error !== null` **sans regarder
   lequel** : l'erreur non nulle qu'il observe est celle du CRASH (`PGRST001`), pas un
   refus de permission. Il conclut « aucune surface ne peut plus l'atteindre » sur la
   foi d'un segfault. ⚠️ **C'est le motif récidiviste du dépôt** — la revue de la
   story 4.1 avait déjà trouvé « deux tests qui ne mesuraient pas ce qu'ils
   croyaient », et `project-context.md` §1 en fait une règle.

⚠️ **Et la suite le CACHAIT par construction** : ce test était le **dernier** du
fichier, donc le crash tombait après sa dernière assertion et la suite rendait 95/95
verts. Il a fallu qu'une story ajoute des tests **après** lui pour que ça se voie.
C'est la forme exacte du piège « `node --test` sur un glob vide rend 0 » que
`project-context.md` documente : *une porte qui ne peut pas signaler son propre
échec*.

**Contournement en place, et il est écrit** : les tests de la 4.2 sont placés **avant**
celui de la génération, avec un encadré qui dit pourquoi (`isolation.test.ts`). Ce
n'est pas une correction — c'est un ordre d'exécution choisi pour qu'un test mesure
autre chose qu'un crash.

**À faire, story 4.7 (ou une story dédiée) :**
- diagnostiquer le segfault (`prosrc` de la fonction, plan d'exécution, version
  PostgreSQL 17.6 du stack local) ;
- **resserrer l'assertion du test existant** pour qu'il exige le code d'erreur d'un
  refus de permission (`42501`) plutôt que « une erreur, n'importe laquelle » — sans
  quoi il continuera de passer sur un crash ;
- vérifier si le défaut existe en production, **sans l'y déclencher**.

---

## Deferred from: code review of 4-2-lecture-client-direct-de-la-liste-groupee-par-rayon (2026-08-07)

*Revue adversariale à trois couches (Blind Hunter, Edge Case Hunter, Acceptance Auditor) plus les
grilles `/clean-code`, `/clean-architecture` et `/tdd`. Six constats reportés — aucun n'est causé par
la story 4.2, mais chacun devient atteignable ou visible à cause d'elle.*

### 1. `aisle_id` renseigné avec `aisle_name` nul rendrait DEUX cartes « À classer »

**Adressé aux stories 4.4 et 4.18** — celles qui ouvrent le chemin d'écriture de `aisle_id`.

**Mesuré.** La politique `grocery_insert` (volet 6 de la migration `20260805092611`) ne vérifie que
`household_id = current_household_id()`. Elle **ne vérifie jamais que `aisle_id` appartient au même
foyer**, et la FK est un simple `references aisles(id) on delete set null` — aucune contrainte de
cohérence croisée.

La vue étant `security_invoker = true`, son `left join aisles` est filtré par la RLS d'`aisles` :
une ligne dont `aisle_id` pointe un rayon invisible à l'invocateur ressort avec `aisle_id`
**renseigné** et `aisle_name` / `aisle_icon` / `aisle_sort` **nuls**. `grouperParRayon` regroupe par
`rayonId`, donc en fait un groupe distinct ; `nomDeRayon(null)` rend « À classer » ; `rayonOrdre`
nul le place en dernier, **juste à côté du vrai groupe « À classer »**.

⛔ **Deux cartes au titre identique, articles répartis entre elles** — le défaut même que
`grouperParRayon` existe pour empêcher, atteint par un autre chemin. La clé React diffère, donc
**rien ne le signale**.

⚠️ **Inatteignable aujourd'hui, et c'est la seule raison du report** : rien n'écrit `aisle_id` depuis
une surface, `product_aisle_map` est vide et `resolve_aisle_id` rend toujours `null`. C'est le même
trou de cohérence croisée que `meal_plan_entries` a eu ; il n'a pas été refermé pour `aisle_id`.

### 2. Quantité `0` ou négative s'affiche telle quelle

**Adressé à la story 4.4**, qui possède déjà la contrainte de positivité.

**Mesuré.** `quantity numeric(8,2)` **ne reçoit délibérément aucune contrainte de positivité** —
c'est écrit en toutes lettres dans l'en-tête de la migration (`20260805092611:306`), et reporté à la
4.4. `formaterQuantite(0)` rend la **chaîne** `"0"`, qui est *truthy* : elle survit au
`filter(Boolean)` de `ListeCourses.tsx:231` et l'écran affiche « 0 kg » ; `-3` affiche « -3 kg ».

⚠️ Le garde du dépôt sur ce motif (`formaterTemps`, `=== null` et jamais `if (!temps)`) est
correctement repris par `formaterQuantite` — il ne couvre simplement pas ce cas-ci.

### 3. Ni le début ni la fin de la lecture ne sont annoncés aux aides techniques

**Adressé à la story 4.13** (plancher d'accessibilité de la liste).

**Mesuré.** Le squelette porte `aria-hidden="true"` (correct, cohérent avec `app/menu/loading.tsx`),
et le `<Notice reserve>` — seule région `role="status" aria-live="polite"` de l'écran — ne
transporte **que** `echec`. Il reste vide pendant tout le chargement **et le reste après**, la liste
apparaissant hors de la région live. Ni `aria-busy`, ni jumeau `sr-only` de transition.

Conséquence : un lecteur d'écran arrive sur `/courses`, lit « Ma liste » puis « Rangée dans l'ordre
de ton magasin. », puis **plus rien** — le squelette est masqué, la région de statut est vide. Une
seconde plus tard le contenu existe, mais rien ne l'annonce. C'est la première lecture
client-direct du produit, donc la première fois que le contenu arrive **après** le rendu.

⚠️ **Le remède tient en une ligne** dans le `Notice` déjà monté :
`{echec ?? (enChargement ? "Je charge ta liste…" : null)}`. **Reporté par périmètre, pas par
difficulté** — à arbitrer avec la 4.13 plutôt qu'à laisser tomber.

### 4. `.order("aisle_sort")` diverge du `coalesce(…, 9999)` de la vue, et le test qui prétend mesurer l'accord ne l'atteint pas

**Sans story assignée** — à reprendre avec la 4.12 (versionnage du contrat) ou la 4.15 (filet de
vérification nommé).

**Mesuré.** `.order()` sans `nullsFirst` n'émet **aucun modificateur** — vérifié dans
`node_modules/@supabase/postgrest-js` (`nullsFirst === void 0 ? "" : …`) — donc Postgres applique
NULLS LAST. La vue, elle, applique `coalesce(a.sort_order, 9999)`, qui place les nuls **à égalité
avec un rayon légitimement classé à 9999**, puis départage par nom d'**article**.

À `sort_order = 10000` (aucune borne en base ; la colonne est écrivable par la surface), la vue
place « À classer » **avant** ce rayon et la requête explicite **après**.

⚠️ **Sans conséquence visible** — `comparerGroupes` retrie côté client, et son écart aux nuls est
délibéré. Ce qui est en défaut, c'est le **test** : `isolation.test.ts:1975-1981` affirme mesurer
l'accord entre l'`ORDER BY` de la vue et le tri explicite d'`articlesDuFoyer`, mais n'emploie que
5 / 20 / 20 / 42 — il passerait quand même. Règle §4 : l'invariant qu'il affirme tenir n'est pas
celui qu'il mesure.

### 5. Le `after()` des tests d'isolation ignore ses erreurs de ménage

**Pré-existant** (`isolation.test.ts:110-123`, seulement reformaté par la 4.2).

**Mesuré.** `await admin.auth.admin.deleteUser(compte.id)` et `await admin.from("households")
.delete()…` — aucun résultat n'est lu, aucune assertion. Le client Supabase rend un objet
`{ error }` plutôt que de lever.

Conséquence, et elle est actuelle : le test de génération étant le dernier, le `after()` s'exécute
sur une base **en récupération** après le segfault. Les deux boucles échouent, la suite reste verte,
et **chaque exécution laisse deux comptes `auth.users` et deux foyers orphelins** sur le stack
local. Le symptôme n'apparaîtra que le jour où quelqu'un comptera les lignes — ou expliquera une
dérive de `db reset`.

### 6. Deux assertions `notEqual(error, null)` sans SQLSTATE

**Pré-existant** (`isolation.test.ts` ~`:758` « un appel anonyme est refusé », ~`:1135` « les gardes
de cardinal et de doublon »), seulement reformatées par la 4.2.

Les deux assertionnent qu'**une** erreur existe sans regarder laquelle, là où les tests voisins de
la même famille exigent `P0001` / `23505`. Pour `:758`, l'assertion d'état qui suit (« rien n'a
bougé ») serait vraie aussi si la fonction n'existait pas.

⛔ **C'est la même famille que le défaut mesuré sur `generate_grocery_list_from_menu`** (entrée
précédente de ce fichier) : un test qui observe l'erreur d'un crash en croyant observer un refus.
Le remède est déjà écrit dans le dépôt — `lib/foyer/erreurs.ts`, motif « SQLSTATE d'abord ».
**`notEqual(error, null)` seul ne prouve jamais qu'un refus est le bon refus.**

### 7. Une session navigateur absente ou expirée rend « Ta liste est vide. », sans erreur

**Adressé aux stories 4.13 (plancher d'accessibilité) et 4.14 (hors-ligne)**, qui possèdent les
états dégradés de cet écran.

✅ **Reporté sur décision de Florian du 2026-08-07, en revue de la 4.2. Motif :** *« la 4.2 est une
lecture pure ; distinguer “vide” de “pas de session” relève du plancher d'accessibilité (4.13) ou du
hors-ligne (4.14), qui possèdent les états dégradés de cet écran. »*

**Mesuré.** La politique `grocery_select` est ancrée sur `current_household_id()`. Sans profil, la
fonction vaut `NULL`, donc le prédicat ne retient aucune ligne : **zéro ligne, HTTP 200,
`error === null`** — c'est ce que le dépôt mesure déjà lui-même (« zéro ligne est un succès
PostgREST, pas une erreur », et le test d'appel anonyme qui obtient `data: []`).

`requireProfile()` (`app/courses/page.tsx`) est une garde **serveur** : elle ne dit rien de la
session dont dispose le client navigateur. Aucune branche de `ListeCourses` ne distingue « 0 ligne »
de « 0 ligne parce que je ne suis personne » — le membre voit sa liste pleine annoncée comme vide,
sans erreur ni recours.

⚠️ **Faible atteignabilité** : il faut une divergence entre la session du rendu serveur et celle de
l'`useEffect` (jeton expiré entre les deux, cookie non propagé). Aucune occurrence mesurée.

⛔ **Mais c'est structurel à la PREMIÈRE lecture client-direct du produit**, et les stories 4.8
(cache local) et 4.11 (temps réel) rafraîchiront ce même état — elles en hériteront.

⚠️ **À cadrer avant d'écrire du code** : un contrôle de session côté client frôle le contrôle
d'accès applicatif qu'AD-2 et AD-16 interdisent. La RLS reste seule garante ; ce qui manque est un
état d'**interface**, pas une garde de sécurité.

---

## Deferred from: code review of 4-2-lecture-client-direct-de-la-liste-groupee-par-rayon — SECONDE PASSE (2026-08-12)

*Seconde revue adversariale à trois couches, portant sur la **passe de correction** du 2026-08-07 —
règle §6, « et la passe de correction doit être revue à son tour ». **Sept** constats reportés. Deux
d'entre eux (n°0 et n°6) sont nés de décisions tranchées par Florian pendant la revue ; les cinq
autres deviennent atteignables ou visibles à cause de cette story.*

### 0. ⛔ En thème SOMBRE, rien sur l'écran liste n'atteint les 3:1 d'une frontière

**Né de la mesure D-4 du 2026-08-12.** ⚠️ **Reporté parce que le correctif déborde la story** :
relever `--card-border` en sombre touche **toute carte de l'application** et les cinq écrans
existants — c'est `DESIGN.md` qui décide, pas la 4.2. **À trancher avant la story 4.3**, qui ajoutera
l'état coché sur ces mêmes cartes.

⚠️ **Ceci REFERME et REMPLACE la prémisse « À rouvrir à la story 4.2 »** posée le 2026-08-07 (entrée
de la story 2.4, plus haut dans ce fichier). Elle a été rouverte, mesurée, et ne peut plus être
réinvoquée pour couvrir ce défaut — **règle §5**.

**Mesuré le 2026-08-12** — calcul WCAG 2.x (luminance relative sRGB, compositing `source-over`) sur
les tokens du bloc `@media (prefers-color-scheme: dark)` d'`app/globals.css`. Script
`d4-contraste.mjs`, exécuté.

| Fond de page | carte / fond | bordure / carte | bordure / fond |
|---|---|---|---|
| `#211318` (haut) | 1,149:1 | **1,359:1** | 1,561:1 |
| `#191016` (55 %) | 1,138:1 | **1,352:1** | 1,538:1 |
| `#2a1512` (bas) | 1,155:1 | **1,360:1** | 1,571:1 |
| `#2a1512` + halo prune | 1,171:1 | **1,355:1** | 1,586:1 |

⚠️ **LES CHIFFRES DU REPORT D'ORIGINE ÉTAIENT FAUX, ET DANS LE SENS SÉVÈRE — corrigés ici.** Le
report annonçait « bordure **1,30–1,33:1** vs la page » et « **1,14–1,15:1** vs la carte ». Sa sonde
n'avait **pas composité le verre de carte sous la bordure** : or `background-clip` vaut `border-box`
par défaut, donc `--surface-card` peint bien sous la bordure, dont l'alpha effectif est
`1 − (1−0,055)(1−0,1) = 0,1495` et non `0,1`.

| Grandeur | Report du 2026-08-07 | Mesure du 2026-08-12 | Verdict |
|---|---|---|---|
| bordure / page | 1,30–1,33:1 | **1,538–1,586:1** | corrigé **vers le haut** |
| bordure / carte | 1,14–1,15:1 | **1,352–1,360:1** | corrigé **vers le haut** |
| carte / page | 1,14–1,16:1 | **1,138–1,171:1** | ✅ confirmé |

✅ **La conclusion ne bouge pas d'un pouce** : la bordure est moins mauvaise qu'annoncé, et
**aucune des trois grandeurs n'approche les 3:1**. Le report avait raison sur le défaut, faux sur
son ampleur.

⛔ **Et la pile serrée change la NATURE du défaut, dans le sens que le report n'avait pas prévu.**
Sur sept cartes bien espacées, la bordure est le séparateur. Sur la pile de la 4.2, **ce qui sépare
deux cartes voisines, c'est 14 px de FOND DE PAGE** (`gap-gutter`), et `carte / gouttière` mesure
**1,138:1** — soit **moins que la bordure elle-même**. Le séparateur réel de cet écran était le
maillon le plus faible des trois, et personne ne le regardait.

WCAG 1.4.11 exige **3:1** d'une frontière nécessaire à la compréhension de l'interface. Sur cet
écran, cette frontière porte l'**AC1 lui-même** : si l'on ne voit pas où finit un rayon et où
commence le suivant, le groupement par rayon — tout le livrable de la story — ne se lit plus.

⚠️ **Ce qui n'est PAS affirmé ici, et qui reste à faire** : savoir si le défaut **se voit**. La
structure typographique de l'en-tête de carte (pastille d'emoji, nom de rayon en capitales, ratio)
porte peut-être assez de séparation pour que la frontière basse ne compte pas. **C'est un jugement
d'œil, il n'a pas été fait**, et rien de ce qui précède ne prétend le contraire — le calcul dit que
le contraste est insuffisant, pas que la carte est illisible.

### 6. Le nom d'ARTICLE est rendu brut, quand le nom de RAYON est normalisé à l'affichage

**Adressé à la story 4.4**, décision de Florian du 2026-08-12. *Raison du report : la 4.4 ouvre le
chemin d'écriture du nom d'article et possédera `normaliserNomArticle` ; scinder la normalisation
entre deux stories ferait diverger la valeur écrite de la valeur affichée, qui est exactement le
défaut à éviter.* ⚠️ **Le périmètre de la 4.4 doit inclure le côté AFFICHAGE** — c'est une story
d'écriture, elle n'ajouterait pas spontanément un présentateur.

`app/courses/ListeCourses.tsx:282` rend `{article.nom}` tel quel. À 30 px de là, `CarteRayon` fait
passer le nom de rayon par `nomDeRayon` → `normaliserTexte` (NFC, `\p{Cf}\p{Cc}\p{Cn}`, rognage,
bornage), **au motif explicite que « la carte reçoit son nom d'une vue »**
(`lib/rayons/carte.ts:145-149`). Le nom d'article ne reçoit rien.

`grocery_list_items_nom_non_vide` n'exige qu'**un** caractère `[:graph:]` après dépouillement. Deux
déclencheurs atteignables une fois l'écriture ouverte : un **U+202E (RLO)** dans le nom inverse
l'ordre bidi du reste de la ligne — **la quantité change de côté** ; un **U+00A0** en tête rend une
indentation qu'un `trim()` retirerait. Une forme NFD s'affiche correctement mais diverge de la clé
canonique d'AD-7.

⚠️ **Inatteignable aujourd'hui** : rien n'écrit d'article depuis une surface.

### 1. Les groupes de rayons se trient sur le nom BRUT et s'affichent avec le nom NORMALISÉ

**Sans story assignée** — à reprendre avec l'**Epic 7** (le serveur MCP est annoncé consommateur de
`lib/liste/groupement.ts`) ou la **4.12** (contrat de liste versionné).

**Mesuré.** `comparerGroupes` (`lib/liste/groupement.ts:135`) départage les ex æquo par
`(a.nom ?? "").localeCompare(b.nom ?? "", "fr")` — sur la valeur **telle qu'elle sort de la vue**.
`CarteRayon` affiche ce même nom via `nomDeRayon()` → `normaliserNomRayon()`, qui rogne, compose en
NFC, retire les invisibles et borne à 40 caractères. La table `aisles` ne porte **aucune contrainte
d'espacement ni de longueur** (seule `aisles_name_non_vide` existe), et `lib/rayons/carte.ts` le
documente lui-même comme la raison d'être de son enveloppe.

Deux rayons ex æquo à `sort_order = 20`, l'un enregistré `" Zèbre"` (espace de tête) et l'autre
`"Abricot"` : le tri compare `" Zèbre"` à `"Abricot"` et place Zèbre **avant** ; l'écran affiche
« ABRICOT » puis « ZÈBRE » sous une carte rangée avant elle. ⛔ **L'ordre visible contredit l'ordre
calculé**, sans rien à l'écran qui l'explique — et c'est précisément le déterminisme que ce tri
secondaire existe pour garantir.

⚠️ **Inatteignable par l'application** : `prochainOrdre` rend `max+10` et `reorder_aisles`
renumérote au pas de 10, donc elle ne produit pas d'ex æquo, et le formulaire `/rayons` normalise à
la saisie. Le déclencheur est une **surface qui n'a pas normalisé** — MCP, écriture client-direct,
import futur.

⚠️ **Distinct de la divergence déjà écrite** à `groupement.ts:78-84` (`localeCompare(…, "fr")` ici
contre la collation Postgres de `rayonsDuFoyer`) : celle-là porte sur la **méthode** de comparaison,
celle-ci sur la **valeur** comparée. Les deux se referment par le même geste — trier sur la valeur
normalisée.

### 2. La divergence U+FE0F entre `/rayons` et `/courses` est passée de théorique à OBSERVABLE

**Adressé à la story dédiée U+FE0F** déjà créée par le report du 2026-08-07 (voir plus haut dans ce
fichier). ⚠️ **Le correctif reste hors périmètre** ; ce qui est neuf ici, c'est le fait, et il n'est
écrit nulle part.

**Mesuré.** `/courses` est le **premier écran du produit à monter `CarteRayon`** — `app/globals.css`
l'annonçait : « son composant existe mais aucun écran ne le monte encore — la story 4.2 sera le
premier ». C'est donc le premier endroit où `iconeDeRayon` s'exécute réellement. Or
`app/rayons/ListeRayons.tsx:933` rend l'icône **brute** : `{rayon.icone ?? ""}`.

⛔ **À partir de cette story, la même icône de rayon peut s'afficher différemment sur deux écrans du
produit** — VS16 retiré et réduction au premier grapheme sur `/courses`, valeur brute sur `/rayons`.
Le semis (11 icônes à un point de code) reste hors d'atteinte, mesuré ; le déclencheur est une icône
écrite par autre chose que le formulaire `/rayons`.

Le report d'origine notait « à refermer par un test qui mesure que les deux surfaces s'accordent » :
ce test n'existe toujours pas, et il a maintenant deux surfaces réelles à comparer.

### 3. La quantité est le seul chiffre de l'écran sans jumeau `sr-only`

**Adressé à la story 4.13** (plancher d'accessibilité de la liste), avec le report déjà daté sur
l'annonce de début et de fin de lecture — même écran, même famille, même story.

`app/courses/ListeCourses.tsx:302-305` rend `2 cs`, `1 cc`, `500 g` tels quels. Un lecteur d'écran
annonce « deux c s », « un c c ». Le compteur (`:242`) et le ratio de la carte-rayon ont chacun leur
jumeau `.sr-only`, **tous deux ajoutés après un défaut mesuré** ; la quantité n'en a pas. C'est la
classe que `review-accessibility.md:65` compte en défaut pour « 3/4 » sans label.

⚠️ La 4.13 posera de toute façon « ligne entière = la cible, avec son `aria-label` » : le remède y
est structurel plutôt qu'additif, ce qui est la raison du report.

### 4. Le garde `Children.count(children) > 0` de la 2.4 est neutralisé par l'enveloppe `<ul>` de la 4.2

**Adressé à la story 4.17** (« À classer » toujours visible), qui est celle qui construira des
groupes vides.

`app/courses/ListeCourses.tsx:185` passe à `CarteRayon` un **élément unique** — le `<ul>` qui
enveloppe les lignes — donc `Children.count(children)` vaut invariablement **1** face à
`app/_lib/CarteRayon.tsx:202`. Le garde ne se déclenche jamais depuis cet appelant : un groupe vide
rendrait le `<div class="mt-2">` (8 px de marge) sous un `<ul>` vide, ce que le correctif de la 2.4
existe précisément pour empêcher.

⚠️ **Inatteignable aujourd'hui** — `grouperParRayon` ne produit pas de groupe vide (mesuré par
`groupement.test.ts`). Mais `GroupeDeRayon` est un type **exporté**, et l'en-tête de la story 4.2
affirme le contraire de ce que son code fait : « C'est exactement l'idiome de la Task 2. »

⚠️ **Se referme avec le correctif P2-5 de la seconde passe**, qui porte le même cas vide côté tri
(`comparerGroupes` non exportée, donc l'`ordre` du groupe n'est mesuré par rien). Les deux ont le
même déclencheur et la même story propriétaire.

### 5. Deux portes sur `formaterQuantite`, et rien d'automatique ne défend la bonne

**Sans story assignée** — se referme le jour où le dernier appelant historique migre.

Conséquence **assumée** de la décision D-5 (Florian, 2026-08-07), qui a déplacé `formaterQuantite`
vers `lib/quantite.ts` avec ré-export depuis `lib/recettes/lecture.ts:27`. Le ré-export est bien
fondé et ne casse rien — **mesuré** : `app/recettes/[id]/page.tsx:9` importe encore par l'ancienne
porte, et `typecheck` / `lint` passent.

Ce qui manque est la garde : le docblock règle le problème par une **consigne** — « les nouveaux
l'importent depuis `@/lib/quantite` » — que ni `tsc --noEmit`, ni `eslint --max-warnings 0`, ni le
typage ne défendent. C'est exactement la forme de garantie que `lib/rayons/carte.ts` a déjà appris à
ne pas tenir pour acquise : « rien d'automatique ne défendra cet invariant ».

## Deferred from: code review of 4-5-supprimer-archiver-les-achetes-vider-la-liste (2026-08-19)

*Revue adversariale à trois couches (Blind Hunter, Edge Case Hunter, Acceptance Auditor), lancées
en parallèle sans contexte. ⚠️ Même modèle que l'implémentation — la règle §6 recommande un autre
LLM ; les convergences entre couches indépendantes sont donc le signal le plus fiable de la passe.
Les correctifs de la 4.5 elle-même sont dans son fichier, § Review Findings.*

### `basculerStatut` n'exclut pas les lignes tombstonées — pour la 4.10

**Mesuré le 2026-08-19** : sur une ligne tombstonée, `update … set status='bought'` rend `UPDATE 1`,
`error: null`. `lib/liste/basculer.ts` ne filtre pas `deleted_at is null`.

La 4.5 est la première story à écrire des tombstones : elle **rend ce chemin atteignable** sans
l'avoir créé. Scénario : B archive ou vide pendant que l'écran de A, chargé avant (pas de temps réel
avant la 4.11), affiche encore la ligne ; A tape la case. L'écran garde sa coche optimiste sur un
article que la base a retiré, jusqu'au prochain montage — et l'`UPDATE` écrase `intent_at`,
c'est-à-dire l'arbitre du LWW.

*Reporté* : le correctif interagit avec l'arbitrage, que la **4.10** possède.

### Le rollback d'un geste de masse écrase un ajout ou une coche concurrents — pour la 4.11

`app/courses/ListeCourses.tsx:265` capture `const precedent = articles` **avant** l'attente réseau,
et `:285` le rétablit en cas d'échec. Or `occupe` ne désactive ni la case à cocher ni le formulaire
d'ajout. Ajouter « Lait » pendant un vidage qui échoue le fait **disparaître de l'écran** alors
qu'il est en base ; cocher pendant ce temps perd la coche à l'écran alors qu'elle est persistée.

*Reporté* : la réconciliation entre état local et serveur est la **4.11** (propagation temps réel).

### Aucune relecture après un geste de masse — pour la 4.11

Le filtre optimiste ne retire que ce que l'écran connaît ; la fonction agit sur tout le foyer. Si
l'autre membre a coché depuis le chargement, `archiver_les_achetes()` rend **plus** que ce qui a
disparu à l'écran, et des articles restent affichés « à prendre » alors qu'ils sont tombstonés. Le
commentaire de `ListeCourses.tsx:238` n'envisage que le sens inverse.

*Reporté* : **4.11**.

### La borne haute laisse une fenêtre de 24 h — pour la 4.10

`grocery_list_items_tombstone_borne_haute` refuse `now() + 25 h` (mesuré, `23514`) et **accepte**
`now() + 23 h` (mesuré). Le raisonnement écrit dans la migration — « un tombstone fait disparaître
la ligne immédiatement ET gagne tout arbitrage LWW » — reste entièrement vrai dans cette fenêtre.
La symétrie avec la borne basse est argumentée ; la conséquence résiduelle ne l'est pas.

*Reporté* : la **4.10** possède l'arbitrage.

### `revoke all … from public` ne ferme rien — pré-existant, pour la 4.12

**Mesuré** : `has_function_privilege('anon','public.vider_la_liste()','execute')` → `t`. Cause :
`pg_default_acl` (posé par `20260729094500`) réaccorde `execute` **nominativement** à `anon`,
`authenticated` et `service_role` ; `revoke … from public` ne retire que le pseudo-rôle PUBLIC.

L'en-tête de `20260817160000` documente donc une garantie de privilège qui n'existe pas — et c'est
le mécanisme qui rend possible la décision D-1 (fuite inter-foyers sous un rôle qui contourne la
RLS). ⚠️ Le garde-fou `P0001` tient pour `anon` (mesuré : « Aucun foyer »), pas pour `service_role`.

*Reporté* : pré-existant à cette story ; la **4.12** gèle le contrat et doit trancher quelles
primitives y entrent.

## Deferred from: story 4-6-provenance-de-chaque-article + sa revue (2026-08-20)

*⛔ **Cette section existe parce qu'elle manquait.** La story 4.6 affirmait à TROIS endroits — dont
deux commentaires dans la migration livrée — avoir reporté ici. Le fichier n'avait pas été touché.
La revue adversariale du 2026-08-20 l'a mesuré (`git status` : 0 modification). C'est la règle §2
appliquée à un registre : un commentaire qui décrit un état faux est pire que pas de commentaire,
parce que c'est sur lui que la story suivante s'appuie.*

### `added_by` : son retrait passe à la 4.7 — CLÔT le report de la 4.1

La 4.1 écrivait « la story 4.6 tranchera son sort ». **Elle a tranché : conservation.**

**Mesuré le 2026-08-20** : `added_by` est **nulle sur les 15 lignes** — rien à migrer. Son unique
écrivain est `generate_grocery_list_from_menu` (`initial_schema:557`), c'est-à-dire la fonction qui
segfaute. La retirer aurait demandé de toucher cette fonction, que la 4.6 ne touche pas.

*Reporté* : la **4.7** réécrit la génération. C'est elle qui doit retirer la colonne, dans le même
commit que la réécriture de son seul écrivain.

### `recipe_id` quand une ligne vient de PLUSIEURS recettes — pour la 4.7

**Mesuré** : `generate_grocery_list_from_menu` agrège `group by ri.name, ri.unit, ri.product_id,
ri.aisle_keyword` **à travers toutes les recettes du menu**. Une ligne de liste vient donc de N
recettes, pour un `recipe_id` qui est un `uuid` unique. « La recette d'origine » n'existe pas au
singulier.

⚠️ **La revue a corrigé l'argument de la 4.6 sur ce point** : le modèle porte parfaitement le cas
**mono-recette** (`case when count(distinct r.id) = 1 then min(r.id) end`), qui est le cas courant
et celui que l'AC1 vise (« `recipe_id` **s'il** vient d'une recette »). Ce n'est donc pas une
impossibilité, c'est un **arbitrage** — la 4.6 le présentait comme une impossibilité, ce qui
surdimensionnait sa justification. Le report reste fondé par la **propriété** : la fonction est
cassée et appartient à la 4.7.

*À trancher par la 4.7* : première recette, aucune, ou une table de liaison.

### ⛔ La ceinture d'`actor_id` ne tient que sur `insert` — le fermer demande un TRIGGER

La 4.1 écrivait « la story 4.6 tranchera ». **Elle a tranché : ceinture posée sur `insert` seul**
(`grocery_insert`, migration `20260820140000`).

**Mesuré en revue le 2026-08-20** : la ceinture est contournable en une requête de plus.

    insert … actor_id=<autre membre>   →  42501, refusé          (la ceinture tient)
    update … set actor_id=<autre>      →  UPDATE 1                (elle ne couvre pas)
    insert … actor_kind='device',
             actor_id=<uuid libre>     →  INSERT 0 1              (elle ne s'applique pas)

**Pourquoi elle n'est PAS posée sur `update`, et c'est mécanique** : une politique `with check`
juge la ligne **nouvelle**, et RLS **ne peut pas comparer l'ancienne à la nouvelle**. Or cocher,
retirer ou archiver l'article d'un **co-membre** laisse `actor_id` à sa valeur d'origine, qui n'est
pas `auth.uid()`. **Mesuré en revue** : la politique candidate posée sur `update` fait échouer
`update … set status='bought'` de B sur l'article de A — elle casserait la story 4.3, sur une liste
que le produit veut partagée (AD-16).

*Reporté* : le seul outil qui voit `OLD` et `NEW` est un **trigger**. À poser par la story qui
possédera l'arbitrage des champs — la **4.10** est la candidate naturelle, puisqu'elle traite déjà
de ce qui a le droit d'écraser quoi.

### ⛔ `actor_id` n'a AUCUNE clé étrangère — pour l'Epic 5

**Mesuré** : `\d grocery_list_items` liste cinq FK (`added_by`, `aisle_id`, `household_id`,
`product_id`, `recipe_id`) — **aucune sur `actor_id`**. `update … set actor_kind='device',
actor_id='deadbeef-…'` → `UPDATE 1`.

L'en-tête de `20260820140000` présente le trou comme circonscrit à `actor_kind = 'device'`, en
attendant `device_credentials`. ⚠️ **C'est plus large que ça** : `actor_id` accepte n'importe quel
`uuid` dans les deux cas, et `'device'` suffit à faire sauter la ceinture avec l'identifiant d'une
**personne**.

*Reporté* : l'**Epic 5** pose `device_credentials` (AD-9). Elle trouvera alors des lignes `profile`
dont l'`actor_id` ne désigne aucun profil — c'est un resserrement de contrainte sur table peuplée,
que `docs/migrations.md` range parmi les gestes « à traiter avec méthode ».

### ⚠️ La course du cache de schéma PostgREST — pour qui touchera signature ou vue

**Cause PROBABLE, déduite et non mesurée**, d'un test d'isolation rouge une fois puis jamais
reproduit (4.6). Une migration qui change une **signature de fonction** ou les **colonnes d'une
vue** invalide le cache de schéma de PostgREST ; le rechargement est **asynchrone**, déclenché par
`NOTIFY` depuis `pgrst_ddl_watch` / `pgrst_drop_watch` (vérifié : les deux event triggers existent).
La séquence prescrite par `docs/migrations.md` — `db reset` puis `npm run test:isolation` — court
contre ce rechargement. Un cache périmé rend `PGRST202` sur le RPC, ou `column … does not exist` sur
la lecture : un rouge unique, jamais reproductible.

⚠️ **La même course existe en production**, où la migration s'applique quelques secondes avant la
mise en ligne. Ni la migration ni `scripts/migrer-au-deploiement.mjs` n'émettent
`notify pgrst, 'reload schema'` ni n'attendent le rechargement.

*Reporté* : à instruire par la première story qui retouche une signature ou une vue. Piste : émettre
le `notify` en fin de migration, ou faire attendre le script de déploiement.

### ⚠️ Les six surfaces sont posées avant leurs stories

`grocery_list_items_surface_fermee` énumère `web, dashboard, voix, dictee, pont, mcp`. **Trois
appartiennent à des epics non commencés** (5 le dashboard, 6 le pont, 7 MCP), alors que l'en-tête de
la migration défend le vocabulaire fermé en écrivant « **chacune arrive avec sa story** ».

*Reporté, sans échéance* : sans conséquence tant qu'aucun jeton n'est mal choisi. ⚠️ Mais retirer un
jeton plus tard suppose de resserrer un `check` sur une table peuplée. Le coût est payé d'avance.
