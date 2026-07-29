# Prochaines étapes

_Journal opérationnel, tenu à jour à la main. Source : rétrospective Epic 1 du 2026-07-28
(`epic-1-retro-2026-07-28.md`) et les trois rapports de revue `epic-1-code-review-pass{1,2,3}-*.md`._

**État au 2026-07-28** — Epic 1 clos (7/7 stories). `test` 49/49 · `typecheck` ✅ ·
`lint --max-warnings 0` ✅ · `build` ✅. Branche `feat/story-1-7-theme`, travail des trois passes
commité (`fa0ccbf`, 79 fichiers), **non poussée**.

---

## 0. À faire d'abord, indépendamment du reste

- [x] **Commiter le travail des trois passes de revue.** Fait le 2026-07-28 — `fa0ccbf`, 79 fichiers,
      +4139/-724, un seul commit. Les passes ne sont pas séparables : chacune a rouvert les fichiers
      de la précédente (`app/foyer/page.tsx` est touché par les trois), et aucun état intermédiaire
      ne compile. Les quatre portes ont été rejouées sur l'arbre avant de commiter.
      La branche n'est pas poussée.

- [ ] **Pousser la dernière migration.** Les quatre autres sont appliquées ; celle-ci a été écrite
      après le dernier `db push`.

      ```sql
      -- contrôler AVANT de pousser (la contrainte échouera sur une ligne vide)
      select id, name from households where btrim(name) = '';
      ```
      ```bash
      npx supabase db push && npx supabase migration list
      ```
      Fichier : `supabase/migrations/20260728152418_require_non_blank_household_name.sql`
      Ne change pas la forme du schéma → pas de régénération de types nécessaire.

---

## 1. Clore l'Epic 1 pour de bon

Ces deux points sont les seuls contrôles de l'Epic 1 qu'aucun test ne peut porter. L'epic est marqué
`done`, ce qui ne les annule pas.

- [x] **Relire les sept écrans dans les deux thèmes** — fait le 2026-07-29, **six sur sept**.
      `/` · `/login` · `/foyer` · `/auth/bascule` · `error` · `not-found` vus en clair **et** en
      sombre, en basculant l'apparence macOS (le thème suit `prefers-color-scheme`,
      `globals.css:68` — donc la bascule système est le vrai contrôle, pas une simulation).

      **`/onboarding` n'a pas pu être relu**, dans aucun thème. Il exige l'état `sans-foyer` :
      connecté avec un profil il redirige vers `/` (`onboarding/page.tsx:19`), déconnecté il
      redirige vers `/login` (307 mesuré). Le voir demande un compte sans profil — c'est-à-dire
      exactement l'environnement de test du §2. **À reprendre dès qu'il existe.**

      Trois défauts trouvés, tous corrigés et tous invisibles à la lecture du code :
      1. `/foyer` affichait **« Ton prénom » deux fois** — la passe 3 a ajouté un `<h2>` au-dessus
         d'un `<label>` qui portait déjà ces mots. Le `<label>` passe en `.sr-only`.
      2. **`autoFocus` était encore sur les trois champs** (`LoginForm`, `CreateHouseholdForm`,
         `JoinHouseholdForm`) alors que la passe 3 le consigne « traité ». Zéro sur trois. Vu à
         l'anneau de focus abricot posé sur le champ email au chargement de `/login`.
      3. **« tu cliques, tu es connecté »** était toujours à l'écran (passe 3 : « traité » ; seul
         le `/foyer` l'était). Et la passe avait **introduit** le même défaut dans l'écran qu'elle
         écrivait : `Non, laisser ${prénom} connecté` sur `/auth/bascule`.

      Ce que ça confirme du §4 : les deux constats faussement « traités » sont le motif que la
      rétrospective a nommé, et aucune des quatre portes ne pouvait les voir.
      ```bash
      npm run dev   # port 3333
      ```

- [ ] **Nettoyer les comptes témoins en production** — `+nc1`, `+nc2`, `+nc3`, leurs foyers et leurs
      rayons. Aucune politique RLS ne permet de les supprimer depuis l'application : ça se fait
      depuis le tableau de bord Supabase (*Authentication → Users*, puis les foyers orphelins).

---

## 2. Préalable bloquant à l'Epic 2

- [x] **Ouvrir un environnement de test Supabase** — fait le 2026-07-29, `supabase start` local
      (gratuit, isolé, repart de zéro à chaque `db reset` ; pas de branche Supabase, qui suppose un
      plan payant). `supabase/config.toml` est versionné, **ports décalés en 5532x** : les valeurs
      par défaut heurtaient un autre stack Supabase local déjà en service.

- [x] **Écrire les tests d'isolation à deux comptes** — fait, `supabase/tests/isolation.test.ts`,
      **11 tests, 11 au vert**, lancés par `npm run test:isolation`. Zéro dépendance ajoutée :
      `@supabase/supabase-js` était déjà là, le reste est du `node:test`.

      Le critère de fin est tenu : A ne lit aucune ligne de B — foyers, profils, rayons,
      invitations — y compris en nommant l'UUID cible, et ne peut ni s'y déplacer, ni renommer, ni
      y écrire, ni y supprimer. Le chemin légitime reste couvert (un troisième compte rejoint A par
      son code et ne voit que A).

      **Dents vérifiées** : le `with check` de `profiles_update_own` retiré à la main sur la base
      locale, la suite tombe de 11/11 à **6/11**. Cinq tests, pas un — c'est le rayon de souffle
      décrit en passe 1, `current_household_id()` suivant la colonne réécrite.

      ⚠️ Hors du glob de `npm test`, délibérément : ces tests exigent un stack debout, et ils
      **lèvent** quand il est absent au lieu de passer en silence.

- [ ] **Pousser `20260729094500_grant_table_privileges.sql`** — la découverte du jour, et elle
      seule justifie le §2 en entier. **Aucune migration n'accordait de privilège de table.** Le
      schéma s'en remettait aux privilèges par défaut de Supabase, permissifs quand le projet a été
      créé et qui ne le sont plus : sur un stack neuf, `anon`/`authenticated`/`service_role`
      n'obtiennent que `Dxtm` (ni SELECT, ni INSERT, ni UPDATE, ni DELETE). Chaque lecture directe
      rendait `42501 permission denied` ; seules les fonctions `security definer` répondaient, ce
      qui masquait le trou — l'inscription marchait, et rien d'autre.

      Autrement dit : **la chaîne de migrations ne reproduisait pas la production.** Une branche,
      un nouveau projet, une restauration de sauvegarde auraient rendu une application morte.
      Invisible tant qu'il n'existait qu'un environnement.

      La migration devrait être un **no-op sur la production**, qui possède déjà ces privilèges —
      sa requête de contrôle, en en-tête du fichier, sert précisément à le confirmer avant de
      pousser.

---

## 3. Réviser l'Epic 2 avant d'en créer la première story

⚠️ **Ne pas lancer `create-story` sur la 2.1 en l'état** — tu réimplémenterais du code qui tourne
déjà en production.

- [ ] **Réviser la story 2.1.** `seed_default_aisles()` existe depuis le squelette initial : onze
      rayons français avec icône et `sort_order` distinct, appelée par
      `create_household_with_profile`, idempotente (`on conflict do nothing`), isolation RLS complète
      (`aisles_all` porte `using` **et** `with check`). Trois des quatre critères sont déjà tenus.

      Ce qui reste réellement : **rien n'appelle la fonction hors création de foyer**, donc un foyer
      existant dépourvu de rayons ne peut pas être ré-amorcé.

- [ ] **Trancher le recouvrement 2.1 / 2.2.** Le cas « foyer dépourvu de rayons » de l'AC2 de la 2.1
      ne peut survenir que si quelqu'un les a tous supprimés — c'est-à-dire le dernier critère de la
      story 2.2. Les deux stories se recouvrent sans le dire.

- [ ] **Reformuler l'objectif de l'Epic 2.** Aucun code applicatif ne lit les rayons aujourd'hui :
      ils existent en base depuis le début sans avoir jamais été affichés. L'epic n'est pas
      « construire les rayons » mais « les rendre visibles et modifiables ».

---

## 4. Règles à appliquer dès la première story de l'Epic 2

Issues des trois motifs de défaut de l'Epic 1. Elles ne coûtent rien à l'écriture et ont chacune
un défaut réel derrière elles.

- **Ne consigner comme vérifié que ce qui a été exécuté**, en citant la commande. Une déduction
  s'écrit « déduit », jamais « vérifié ». *(Deux affirmations de vérification fausses en deux
  stories, rattrapées par hasard.)*
- **Un commentaire explique un *pourquoi*, jamais un état de la base.** Un état se vérifie ; s'il
  doit être écrit, il porte sa date et le fichier qui fait foi. *(Trois commentaires devenus faux,
  dont deux écrits pendant la revue elle-même.)*
- **Une prémisse qui sert à reporter un défaut doit être rouverte** avant d'être invoquée une
  seconde fois. *(« Base gelée » a couvert le trou NFR-5 pendant tout l'epic.)*
- **Aucune migration sans sa requête de contrôle** en en-tête.
- **Décisions par lots de quatre**, avec constat reproduit, options chiffrées et recommandation
  assumée. 33 sur 33 ont fonctionné ainsi.
- **Revue adversariale par story**, pas en fin d'epic *(décision de Florian : environnement de test
  **et** revue)*. Trois des six défauts majeurs de l'Epic 1 ont été introduits par une passe de
  revue et attrapés par la suivante — revoir plus tôt, c'est empiler moins.

---

## 5. À réévaluer après l'Epic 2

- **Le rythme de revue est-il tenable ?** Trois passes de six couches, c'est un investissement de
  socle. « Par story » le répartit, ne le réduit pas. À trancher avec des chiffres, pas une
  impression — et on aura enfin de quoi mesurer, puisqu'on aura des tests d'isolation.
- **Le JSX reste intestable** sans dépendance (NFR-10). La parade — extraire le pur vers `lib/` — a
  fonctionné trois fois ; sa limite n'est pas encore atteinte.
