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
