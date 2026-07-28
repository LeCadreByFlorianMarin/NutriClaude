# Prochaines étapes

_Journal opérationnel, tenu à jour à la main. Source : rétrospective Epic 1 du 2026-07-28
(`epic-1-retro-2026-07-28.md`) et les trois rapports de revue `epic-1-code-review-pass{1,2,3}-*.md`._

**État au 2026-07-28** — Epic 1 clos (7/7 stories). `test` 49/49 · `typecheck` ✅ ·
`lint --max-warnings 0` ✅ · `build` ✅. Branche `feat/story-1-7-theme`, **67 fichiers non commités**.

---

## 0. À faire d'abord, indépendamment du reste

- [ ] **Commiter le travail des trois passes de revue.** 67 fichiers touchés, dont 27 nouveaux, non commités. Tant que ça reste dans l'arbre de travail, une erreur de manipulation efface trois
      passes de revue.

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

- [ ] **Relire les sept écrans dans les deux thèmes** — clair *puis* sombre.
      `/` · `/login` · `/onboarding` · `/foyer` · `/auth/bascule` · `error` · `not-found`
      À regarder en priorité : `/foyer` (trois groupes au lieu de cinq sections, carte d'invitation
      remaniée), `/login` (le bouton principal existe enfin visuellement), et `/auth/bascule` —
      **jamais vu dans aucun thème**.
      ```bash
      npm run dev   # port 3333
      ```

- [ ] **Nettoyer les comptes témoins en production** — `+nc1`, `+nc2`, `+nc3`, leurs foyers et leurs
      rayons. Aucune politique RLS ne permet de les supprimer depuis l'application : ça se fait
      depuis le tableau de bord Supabase (*Authentication → Users*, puis les foyers orphelins).

---

## 2. Préalable bloquant à l'Epic 2

- [ ] **Ouvrir un environnement de test Supabase** — branche Supabase, ou `supabase start` local.

      C'est le seul angle mort qu'aucune revue ne couvre. **NFR-5 — l'isolation entre foyers, la
      seule chose que ce produit ne peut pas se permettre de casser — n'est vérifiable par aucun
      test** tant qu'il n'existe qu'un projet et qu'il *est* la production. Le trou `with check` sur
      `profiles_update_own` a vécu tout l'Epic 1 ; un test à deux comptes l'aurait vu le premier
      jour. Le coût de son absence est déjà au dossier : trois comptes témoins abandonnés en
      production, précisément parce qu'il fallait des comptes réels pour contrôler l'isolation.

- [ ] **Écrire les tests d'isolation à deux comptes**, une fois l'environnement disponible.
      Critère de fin : un membre du foyer A ne lit aucune ligne du foyer B, prouvé par un test.
      ⚠️ Le faux client Supabase (`lib/supabase/faux.ts`, à écrire) **ne modélise pas la RLS** — un
      test de `membresDuFoyer` avec un faux prouve le mapping, jamais l'isolation. Le noter en tête
      du fichier.

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
