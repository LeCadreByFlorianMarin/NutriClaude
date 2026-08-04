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
