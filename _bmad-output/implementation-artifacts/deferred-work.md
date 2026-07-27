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

- Le contrôle d'isolation NFR-5 a laissé un compte `flomarin88+nc1@gmail.com`, son foyer « Foyer temoin » et ses 11 rayons. Aucune politique RLS n'autorise la suppression de `households` ni de `profiles` — le ménage se fait depuis le tableau de bord (*Authentication → Users*, puis le foyer orphelin). Sans conséquence tant que ça reste.

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

- Compte `flomarin88+nc2@gmail.com`, foyer « Foyer temoin 2 », ses 11 rayons et son invitation `4A1EA59C`. Créés pour prouver l'isolation des invitations. Aucune politique n'autorise leur suppression depuis l'application : *Authentication → Users*, supprimer l'utilisateur, puis le foyer orphelin.

**Choix assumés, à ne pas prendre pour des oublis en revue :**

- **Aucune annulation d'invitation** (décision de Florian, 2026-07-27). `invites_delete_own` reste inutilisé. Conséquence : générer un nouveau code **n'invalide pas l'ancien**, et plusieurs codes peuvent rester valables sept jours en parallèle.
- **Rien ne purge les invitations expirées.** Sans conséquence à cette échelle.
- Le commentaire du schéma décrit le code comme « 8-char base32 » : **c'est faux**, il est hexadécimal. Le commentaire vit dans une migration appliquée, donc non modifiable.

## Deferred from: story 1.5 (2026-07-27)

**Course non traitée dans `redeem_household_invite` — l'AC3 n'est vraie qu'en séquentiel :**

- La fonction lit `uses_remaining` **sans verrou** (`for update` absent), contrôle `<= 0`, insère le profil, puis décrémente. Deux personnes rachetant le **dernier** usage au même instant lisent toutes deux `1`, passent toutes deux le contrôle, et décrémentent : le compteur tombe à **-1**, ce que l'AC3 interdit. Vérifié en séquentiel (5 → 4) ; la concurrence reste ouverte. Corriger exige un `for update` dans la fonction, donc une **migration sur une base gelée**. Sans portée à l'échelle d'un foyer de deux personnes ; à traiter le jour où le produit sortirait de la famille.

**Résidu de test à retirer de la base :**

- Compte `flomarin88+nc3@gmail.com`, profil « Temoin3 ». ⚠️ **Différent des précédents** : il n'a pas son propre foyer, il est **membre du foyer « Marin »**. Le supprimer depuis *Authentication → Users* emporte son profil par cascade sans toucher au foyer. Le compteur de l'invitation `388B626A` restera à 4 — sans conséquence.

**Choix assumés, à ne pas prendre pour des oublis :**

- **« Code inconnu » et « code plus valable » donnent deux messages distincts** (question laissée sans réponse, implémentée selon la recommandation). Les deux appellent des gestes différents — re-saisir, ou redemander un code. Révèle marginalement qu'un code existe ; facile à fusionner si l'arbitrage change.
- **Deux branches d'erreur ne sont pas vérifiées** : « code expiré » demanderait d'attendre sept jours, « code épuisé » cinq comptes. Écartées explicitement plutôt que simulées.
- **« Créer » reste le chemin par défaut** à l'entrée du foyer, « J'ai un code » le second. L'inverse ferait buter tout nouvel arrivant sur un champ qu'il ne peut pas remplir.

## Deferred from: story 1.6 (2026-07-27)

**Trou d'isolation dans la politique d'écriture de `profiles` — discipline applicative, pas garde en base :**

- `profiles_update_own` est déclarée `using (id = auth.uid())` **sans `with check`**. En PostgreSQL, l'expression `using` sert alors aussi de contrôle sur la ligne écrite : le contrôle ne porte donc que sur `id`, et **toutes les autres colonnes de sa propre ligne restent librement modifiables — `household_id` compris**. Un membre qui connaîtrait l'uuid d'un autre foyer pourrait s'y déplacer par un simple `update`. Sans portée réelle à cette échelle (les uuid ne se devinent pas, et il n'y a qu'un foyer), mais **rien en base n'empêche l'écriture** : c'est la discipline du code applicatif qui tient, en n'envoyant jamais que `display_name` dans le payload. Corriger exige un `with check (id = auth.uid())` dans la politique, donc une **migration sur une base gelée**. À traiter le jour où un second foyer existera, ou avant toute story qui écrirait d'autres colonnes de `profiles`.

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
