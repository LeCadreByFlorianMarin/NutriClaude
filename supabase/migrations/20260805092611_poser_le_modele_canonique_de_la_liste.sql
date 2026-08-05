-- Pose le modèle canonique de la ligne d'article : clé unique par foyer, tombstone,
-- horodatage d'intention, provenance polymorphe — et retire le DELETE dur aux surfaces.
--
-- Story 4.1, première de l'Epic 4. AD-3 (ligne canonique + LWW par champ), AD-4, AD-6, AD-7,
-- AD-9, AD-12, NFR-2, NFR-5. C'est la migration sur laquelle tout l'Epic 4 s'arbitre :
-- `status` (4.3), l'UPSERT-incrémente (4.4), le tombstone (4.5), la provenance (4.6), la
-- génération non destructive (4.7), le LWW (4.10) et le contrat versionné (4.12).
--
-- ⚠️ À CONTRÔLER EN REVUE — trois volets ÉCHOUERONT si une ligne existante les viole, et
-- depuis le 2026-07-29 ils s'appliquent **pendant le déploiement de production**
-- (`vercel.json` → `scripts/migrer-au-deploiement.mjs`). Il n'y a plus de `db push` humain,
-- donc plus de moment pour sonder la base entre l'écriture et l'application.
--
--   -- 0. Le contexte : combien d'articles existe-t-il seulement ?
--   select count(*) as articles, count(*) filter (where status = 'bought') as achetes
--     from grocery_list_items;
--
--   -- 1. Doublons sur la clé canonique (bloqueraient l'index unique du volet 4)
--   --    ⚠️ `unaccent` n'est PAS installée avant cette migration — mesuré sur le stack local
--   --    le 2026-08-05. Sonder le distant AVEC SON SCHÉMA, jamais seulement son nom :
--   select e.extname, n.nspname from pg_extension e
--     join pg_namespace n on n.oid = e.extnamespace where e.extname = 'unaccent';
--   --    ⚠️ Si elle revient dans un schéma AUTRE que `extensions`, lire le § du volet 1
--   --    « CE QUE `if not exists` NE FAIT PAS » — la migration la déplace, mais il faut
--   --    savoir que c'est ce qui va se produire.
--   --    La poser d'abord, dans une transaction annulée, pour que le contrôle ne modifie
--   --    pas la base qu'il contrôle :
--   begin;
--   create extension if not exists unaccent with schema extensions;
--   select household_id,
--          lower(unaccent(regexp_replace(normalize(name, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g'))) as cle,
--          unit, count(*)
--     from grocery_list_items
--    group by 1, 2, 3 having count(*) > 1;
--   rollback;
--
--   -- 2. Unités hors du vocabulaire fermé (bloqueraient le volet 3)
--   select id, unit from grocery_list_items
--    where unit is not null
--      and unit not in ('g', 'kg', 'ml', 'L', 'pièce', 'cs', 'cc', 'pincée');
--
--   -- 3. Noms qui ne montrent rien (bloqueraient le volet 3)
--   --    ⚠️ La forme ci-dessous est celle de la CONTRAINTE, `strip_accents` compris : depuis
--   --    la revue, les deux emploient la même expression, à l'octet près.
--   begin;
--   create extension if not exists unaccent with schema extensions;
--   select id, name from grocery_list_items
--    where lower(unaccent(regexp_replace(normalize(name, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g'))) = '';
--   rollback;
--
--   -- 4. Noms trop longs (bloqueraient le volet 3, contrainte `nom_borne`)
--   select id, length(name) from grocery_list_items where length(name) > 200;
--
--   -- 5. Provenance à moitié remplie (bloquerait le volet 3, contrainte `acteur_couple`)
--   --    Sans objet avant cette migration — les colonnes naissent ici. Écrit pour être
--   --    rejoué tel quel par les stories 4.6 et 5.x, qui les rempliront.
--
-- ⚠️ **LA REQUÊTE 1 EST ÉCRITE EN FORME DE REPLI, ET C'EST DÉLIBÉRÉ.** Elle emploie
-- `unaccent(...)` nu, là où l'index du volet 4 emploie `public.strip_accents(...)` — la
-- fonction que le volet 1 crée. Une requête de contrôle doit être exécutable **avant** la
-- migration qu'elle contrôle ; celle-ci le serait sinon seulement après son propre volet 1.
-- Les deux formes rendent la même chose **en lecture** : c'est uniquement dans un index que la
-- volatilité compte (voir volet 1).
--
-- ⚠️ **EN REVANCHE LA REGEX Y EST COMPLÈTE, ET LA PREMIÈRE RÉDACTION LA SIMPLIFIAIT À TORT.**
-- Elle portait `[^[:graph:]]` seul, « pour rester lisible dans un SQL Editor ». Mesuré en
-- revue le 2026-08-05 : cette simplification **sous-détecte ce que le contrôle existe pour
-- trouver**. `'Sel' || U+3164` face à `'Sel'` donne deux clés distinctes pour la forme
-- simplifiée — donc **zéro doublon rendu** — et une seule clé pour l'index réel, donc
-- `23505` à l'application. « Zéro ligne aux quatre » ne prouvait donc PAS que les volets 3
-- et 4 s'appliqueraient. La lisibilité ne vaut pas un contrôle qui ment.
--
-- ⚠️ **ET LE REPLI NE SUFFISAIT PAS : `unaccent` N'EST PAS INSTALLÉE AVANT CETTE MIGRATION.**
-- Constaté en exécutant le contrôle, pas en le relisant — la première rédaction de cet en-tête
-- affirmait que la forme de repli était exécutable telle quelle, et c'était faux. D'où le
-- `begin / create extension / rollback` de la requête 1 : le contrôle pose l'extension, mesure,
-- et annule, sans laisser de trace dans la base qu'il contrôle.
--
-- ⚠️ **ATTENDU : ZÉRO LIGNE AUX QUATRE.**
--
-- **MESURÉ SUR LE STACK LOCAL le 2026-08-05, avant application** — zéro ligne aux quatre, sur
-- une table à 0 article (`docker exec -i supabase_db_nutriclaude psql -U postgres -d postgres`).
-- C'est une mesure LOCALE, et « local » n'est pas « production » (règle §1).
--
-- **SUR LE DISTANT, C'EST UNE DÉDUCTION, et elle reste à confirmer en revue.** Aucune surface
-- n'a jamais écrit dans `grocery_list_items` — mesuré le 2026-08-05 :
-- `grep -rn "grocery_list" --include=*.ts --include=*.tsx` ne rend que `lib/supabase/types.ts`,
-- et le seul écrivain possible, `generate_grocery_list_from_menu`, n'a aucun point d'appel.
-- **Si l'une des requêtes rend des lignes, corriger les données avant de fusionner, et
-- n'assouplir aucun volet pour les accommoder.**
--
-- ⚠️ **UN SEUL FICHIER POUR HUIT VOLETS, DÉLIBÉRÉMENT.** `supabase db push` n'est pas atomique
-- sur un LOT de fichiers : sur deux migrations dont la seconde échoue, la première est
-- appliquée et enregistrée. Les huit volets servent la même story et se contrôlent par la même
-- requête ; les séparer multiplierait les points d'échec partiel sans rien gagner.
--
-- ⚠️ **CETTE MIGRATION CHANGE LA FORME DU SCHÉMA** — six colonnes, six colonnes de vue et une
-- fonction. `lib/supabase/types.ts` est régénéré dans le même commit, après
-- `npx supabase db reset`, par **exactement** :
--
--   npx -y supabase@2.106.0 gen types typescript --local --schema public
--
-- ⚠️ `--local` et non `--linked` : le distant n'a pas encore la migration au moment où l'on
-- génère.
-- ⚠️ **LA VERSION ET `--schema public` SONT ÉPINGLÉS ICI PARCE QUE LA COMMANDE NUE DÉRIVE.**
-- Mesuré en revue le 2026-08-05 : `npx supabase gen types` sans version résout la CLI la plus
-- récente du jour (2.111.0), qui emporte deux changements sans aucun rapport avec le schéma —
-- `__InternalSupabase: { PostgrestVersion: "14.5" }` supprimé, et un schéma `graphql_public`
-- entier ajouté au contrat que la story 4.12 devra geler. PostgREST, lui, n'a pas bougé :
-- toujours `v14.5` (mesuré sur le conteneur). Le premier jet de cette story portait donc
-- 53 insertions / 4 suppressions là où le schéma n'en justifie que 26 / 5.
-- ⚠️ **ET CE N'EST PAS ENTIÈREMENT REFERMÉ.** Aucune CLI capable de lire le `config.toml`
-- actuel ne reproduit la ligne de base : ≤ 2.105.0 échouent sur la clé `local_smtp`, et
-- ≥ 2.106.0 n'émettent plus le bloc `__InternalSupabase`. Sa disparition subsiste donc dans le
-- diff — elle est **écrite** plutôt que laissée croire, et le problème de reproductibilité est
-- daté dans `deferred-work.md`. Deux CLI coexistent sur le poste : `/opt/homebrew/bin/supabase`
-- en 2.100.0 et `npx supabase` en 2.111.0.
--
--
-- VOLET 1 — L'EXTENSION `unaccent` ET SON ENVELOPPE IMMUTABLE (AD-3, décision D1)
--
-- La clé canonique d'AD-3 est `(household_id, nom normalisé, unité)`. Ce que « normalisé » veut
-- dire a été tranché par Florian le 2026-08-05, **contre la recommandation** : la clé plie
-- **aussi les accents**. Elle fusionne donc la casse, la forme Unicode, les invisibles, les
-- espaces et les accents. « Crème fraîche », « creme fraiche » et « CRÈME FRAÎCHE » sont une
-- seule ligne, de clé `cremefraiche`.
--
-- Ce que la décision achète : le membre qui tape vite, sans accents, sur un téléphone à une
-- main dans un magasin, retombe sur la ligne existante. C'est LE geste du produit, et c'est
-- aussi ce que produiront la dictée et le pont Google — un texte dont personne ne contrôle
-- l'accentuation (AD-12).
--
-- ⚠️ **L'ENVELOPPE EST OBLIGATOIRE, ET LE CONTOURNEMENT CONNU EST FAUX ICI.** La sagesse
-- commune dit d'employer `unaccent(regdictionary, text)`, « qui est IMMUTABLE ». **Mesuré le
-- 2026-08-05 sur le PostgreSQL 17.6 du stack local : les DEUX formes sont `STABLE`.**
--
--   select proname, pg_get_function_arguments(oid), provolatile from pg_proc
--    where proname = 'unaccent';
--   -- unaccent(text)                = s
--   -- unaccent(regdictionary, text) = s
--
-- Or une expression `STABLE` ne peut pas indexer. D'où `strip_accents`, déclarée `immutable`.
--
-- ⚠️ **`immutable` EST ICI UNE PROMESSE, PAS UN CONSTAT — et c'est le coût de la décision.**
-- `unaccent` est `STABLE` parce que son dictionnaire est un **fichier sur disque**
-- (`unaccent.rules`), rechargeable, et remplaçable par une montée de version de Postgres. En
-- déclarant l'enveloppe `immutable`, on jure au planificateur qu'elle rendra toujours la même
-- chose pour la même entrée — vrai **tant que le dictionnaire ne bouge pas**.
--
-- Le jour où il bouge : l'index de clé canonique contient des clés calculées avec l'ancien
-- dictionnaire, Postgres ne les recalcule pas, et une recherche par la clé peut **manquer une
-- ligne qui existe** — sans erreur, sans log, sans rien.
--
--   Contre-mesure : `reindex index grocery_list_items_cle_canonique;`
--
-- ⚠️ **ET ELLE SE DÉCLENCHE SUR TROIS CHEMINS, PAS UN — la première rédaction n'en citait
-- qu'un.** Trouvé en revue le 2026-08-05 :
--   1. une montée de version **majeure** de Postgres (le dictionnaire `unaccent.rules`) ;
--   2. **un `create or replace function public.strip_accents(...)`** par une migration
--      ultérieure. Mesuré : avec l'index en place, remplacer le corps de la fonction rend
--      `CREATE FUNCTION` **sans le moindre avertissement**, et l'index garde ses clés
--      périmées. C'est le chemin le PLUS probable, et c'était le seul non écrit ;
--   3. une montée de **glibc/ICU sans montée majeure de Postgres** : la base est en
--      `en_US.UTF-8`, et `lower()` comme `[:graph:]` dépendent du ctype, pas seulement du
--      dictionnaire.
-- ⚠️ Rien ne déclenche cette contre-mesure tout seul. `contraintes.test.ts` porte le seul
-- test qui tombera le jour où la promesse sera fausse, et il le dira en toutes lettres.
--
-- C'est le contournement standard, employé partout, et le risque est petit à cette échelle. Il
-- est écrit ici pour être revu, pas pour être oublié. ⚠️ Que le dictionnaire de Supabase ne
-- bougera pas est une **hypothèse**, pas une mesure — `contraintes.test.ts` porte le seul test
-- qui tombera le jour où elle sera fausse, et il le dira en toutes lettres.
--
-- ⚠️ **`with schema extensions` n'est pas décoratif.** Mesuré : sans lui, l'extension atterrit
-- dans `public`, alors que les quatre déjà posées (`pg_net`, `pgcrypto`, `uuid-ossp`,
-- `pg_stat_statements`) vivent toutes dans `extensions`. Un schéma divergent entre le local et
-- la production est exactement le défaut que `20260729094500` a été écrite pour fermer.
--
-- ⚠️ **CE QUE `if not exists` NE FAIT PAS — ET LA PREMIÈRE RÉDACTION LE SUPPOSAIT.**
-- `create extension if not exists unaccent with schema extensions` est un **NO-OP** si
-- l'extension existe déjà **ailleurs** : la clause `with schema` n'est PAS appliquée, et
-- l'extension reste où elle est. Mesuré de bout en bout en revue le 2026-08-05 :
--
--   create extension unaccent with schema public;   -- l'état hypothétique du distant
--   create extension if not exists unaccent with schema extensions;
--   -- NOTICE: extension "unaccent" already exists, skipping   → toujours dans `public`
--   create or replace function public.strip_accents(...) ...
--   -- ERROR: text search dictionary "extensions.unaccent" does not exist
--
-- Et ça se produirait **pendant un déploiement Vercel**, sans `db push` humain pour l'arrêter
-- — le scénario même qui justifie « un seul fichier, huit volets » plus haut. D'où la garde
-- `do $$ … $$` du volet 1, qui déplace l'extension au lieu de laisser la migration mourir
-- deux lignes plus bas sur un message qui ne dit rien d'utile.
-- ⚠️ **Le déplacement est possible parce que l'extension est RELOCALISABLE** — mesuré,
-- `pg_extension.extrelocatable = t`. Ce n'est pas vrai de toutes les extensions.
-- ⚠️ **Et rien ne référence `unaccent` non qualifiée ailleurs** (mesuré : aucune autre
-- migration ne l'emploie), donc le déplacement ne casse aucun objet existant.
--
-- ⚠️ **Le dictionnaire est cité PLEINEMENT QUALIFIÉ et la fonction n'a PAS de `set
-- search_path`.** Une expression d'index ne doit dépendre d'aucun `search_path` : deux sessions
-- aux chemins différents produiraient deux clés pour la même ligne, et l'index serait faux sans
-- que rien ne le dise. Une clause `set` aurait le même effet en apparence, mais elle empêche
-- l'inlining et masque le raisonnement ; la qualification pleine le rend explicite.
--
-- ⚠️ **AUCUN `grant` N'EST ÉCRIT ICI, et c'est vérifié plutôt que supposé.**
-- `20260729094500:66-71` porte `alter default privileges in schema public grant all on
-- functions to anon, authenticated, service_role`, écrite exactement pour que « chaque nouvelle
-- fonction ne rejoue pas le même défaut en silence ».
--
--
-- VOLET 2 — LES SIX COLONNES DU MODÈLE CANONIQUE (AD-3, AD-9, AD-12)
--
-- ⚠️ **`actor_id` N'EST PAS UNE CLÉ ÉTRANGÈRE VERS `profiles`.** La provenance de FR-7 est
-- **polymorphe** : `(actor_kind ∈ {profile, device}, actor_id)`. AD-9/NFR-6 — un appareil n'est
-- jamais promu membre, donc jamais une FK `profiles`. Poser la FK « pour bien faire » rendrait
-- l'Epic 5 impossible sans migration corrective.
--
-- ⚠️ **`intent_at` EST `not null`, ET C'EST LE POINT LE PLUS FACILE À RATER.** C'est l'arbitre
-- du LWW d'AD-3. Une comparaison contre `null` rend `null` — donc « ni plus récent ni plus
-- ancien », donc un arbitrage silencieusement sans gagnant. Le défaut `now()` est l'horloge
-- SERVEUR : honnête pour une écriture directe, et remplacé par l'horloge du geste dès que
-- l'outbox existe (story 4.9).
--
-- ⚠️ **`intent_at` N'EST PAS `updated_at`.** AD-3, mot pour mot : « le serveur garde, par champ
-- mutable, la valeur dont l'intention est la plus récente — **pas** l'heure d'arrivée.
-- `updated_at` serveur reste l'horodatage d'affichage/Realtime, **pas l'arbitre** ». Un cochage
-- fait à 09:00 et flushé à 09:30 ne doit pas écraser une modification de quantité faite à
-- 09:05. Les confondre coûterait la story 4.10.
--
-- ⚠️ **`deleted_at` reste NULLABLE** : c'est un tombstone, son absence est l'état normal.
--
-- ⚠️ **`source_ref` NAÎT ICI, SON UNICITÉ NON.** AD-12 fait de cette colonne l'idempotence du
-- pont Google (`unique (household_id, source_ref) where source_ref is not null`). Cet index
-- appartient à l'Epic 6, avec le pont qui l'écrit. Il est **daté dans `deferred-work.md`**, pas
-- posé en silence ici.
--
-- ⚠️ **`added_by` N'EST PAS SUPPRIMÉE**, bien qu'`actor_kind`/`actor_id` la supplantent :
-- `drop column` est interdit sans décision explicite et sauvegarde vérifiée
-- (`docs/migrations.md`). La story 4.6 possède le chemin de lecture de la provenance et
-- tranchera son sort. Daté dans `deferred-work.md`.
--
--
-- VOLET 3 — LES SIX CONTRAINTES (AD-7, AD-9, AD-3)
--
-- ⚠️ **TROIS D'ENTRE ELLES ONT ÉTÉ AJOUTÉES EN REVUE le 2026-08-05**, sur décision de
-- Florian, pendant que la table est encore VIDE — `nom_borne`, `acteur_couple` et
-- `intention_bornee`. Chacune ferme un invariant que la revue a mesuré ouvert, et chacune
-- coûterait une migration de données à partir de la story 4.4. Leur raison d'être est écrite
-- au-dessus de chacune, dans le corps.
--
-- ── `grocery_list_items_unite_fermee` ────────────────────────────────────────
-- Aucun critère de la story ne la nomme, et elle est due quand même : `unit` est un **morceau
-- de la clé canonique**. Une unité libre fragmente la clé — « L », « l » et « litre » feraient
-- trois lignes de lait. `lib/recettes/unites.ts` le dit déjà en toutes lettres (« ce n'est pas
-- une liste d'affichage, c'est un contrat avec l'Epic 4 »), et `recipe_ingredients_unite_fermee`
-- (`20260802112511:78`) en est la jumelle côté recettes. L'accord entre `UNITES` et cette
-- contrainte est **mesuré** par `contraintes.test.ts`, pas affirmé (règle §4).
--
-- ⚠️ Elle ne coûte rien MAINTENANT — la table est vide — et coûterait une migration de données
-- à partir de la story 4.4. C'est la seule fenêtre.
--
-- ── `grocery_list_items_nom_non_vide` — la SIXIÈME de cette famille ──────────
-- Après `display_name`, `households.name`, `aisles.name`, `recipes.title` et
-- `recipe_ingredients.name`. Même motif : un champ libre partagé par tout le foyer descend en
-- base (AD-1/AD-2), et le contrôle navigateur ne voit pas les appels REST directs.
--
-- ⚠️ **ICI ELLE PORTE DAVANTAGE QU'AILLEURS** : un nom entièrement invisible produirait une clé
-- canonique **vide**, donc un seul emplacement par foyer et par unité pour tous les articles
-- fantômes — et le second rendrait `23505` sur un ajout que le membre croit normal. C'est
-- pourquoi la contrainte et la clé emploient **la même expression, à l'octet près**.
-- ⚠️ **CE N'ÉTAIT PAS VRAI À LA PREMIÈRE RÉDACTION, QUI L'AFFIRMAIT DÉJÀ.** Mesuré en revue :
-- la contrainte n'appliquait que `regexp_replace(name, …)`, quand la clé appliquait en plus
-- `normalize(NFC)` et `strip_accents`. Un nom fait uniquement de diacritiques combinants
-- (`chr(768)`) passait donc la contrainte et produisait une clé **vide** — 106 points de code
-- `[:graph:]` sont dans ce cas. La contrainte porte désormais l'expression entière, et
-- `contraintes.test.ts` le **mesure** au lieu de l'affirmer (règle §4).
--
-- La regex a été **extraite par script** de `20260802112511:84` (et non `:83`, qui porte
-- `check (` — corrigé en revue), jamais retapée.
--
-- ⚠️ **ELLE A DEPUIS DIVERGÉ DE SA SOURCE, ET C'EST ÉCRIT PLUTÔT QUE DÉCOUVERT.** La revue du
-- 2026-08-05 a mesuré que **241** points de code `Default_Ignorable`/`Cf` survivaient à la
-- forme d'origine, en exactement deux plages : **U+180F** — voisin immédiat de la plage
-- `\u180B-\u180E` déjà énumérée, ajouté par Unicode 14 — et **U+E0100–U+E01EF**. Trois
-- « Creme fraiche » indiscernables à l'œil coexistaient dans le même foyer et la même unité.
-- La forme d'ici les couvre (mesuré : 0 survivant, et un seul caractère de plus retiré,
-- U+180F, qui est bien `Default_Ignorable`).
-- ⚠️ **`20260802112511` N'EST PAS RETOUCHÉE** : elle est appliquée, et une migration appliquée
-- ne se retouche plus (`docs/migrations.md`). Les deux formes divergent donc à partir
-- d'aujourd'hui, et `recipe_ingredients_nom_non_vide` garde le trou que celle-ci vient de
-- fermer. Daté dans `deferred-work.md`, pas tu.
-- ⚠️ **ET LA RÈGLE §3 RESTE VRAIE** : c'est la troisième rédaction d'une énumération que ce
-- dépôt sait perdante. Postgres n'a pas de propriété Unicode dans ses expressions
-- rationnelles ; ce n'est donc pas une victoire, c'est un report mesuré. La prochaine version
-- d'Unicode rouvrira l'écart, et le seul contrôle qui le dira est le test d'accord
-- client ↔ base de `contraintes.test.ts`.
-- ⚠️ Les `\uXXXX` qu'elle contient sont des échappées de l'analyseur d'EXPRESSIONS
-- RATIONNELLES de Postgres, pas de l'analyseur de chaînes — la lecture naïve est plausible et
-- fausse. Mesuré et démontré dans l'en-tête de `20260801124553`.
--
-- ── `grocery_list_items_acteur_connu` ────────────────────────────────────────
-- `actor_kind` n'ayant pas de clé étrangère à laquelle s'adosser (provenance polymorphe), le
-- seul endroit où son vocabulaire peut vivre est une contrainte. Sans elle, `actor_kind` est un
-- champ texte libre que n'importe quel appel REST remplit à sa guise.
--
-- ⚠️ **`quantity` NE REÇOIT PAS de contrainte de positivité ici, et c'est délibéré.** Le critère
-- du projet est « la valeur est-elle consommée par un CALCUL ? » — elle l'est, mais l'agrégation
-- qui la consomme est la story 4.4. La contraindre ici porterait sur un champ que personne
-- n'écrit encore. Daté dans `deferred-work.md`, adressé à la 4.4.
--
--
-- VOLET 4 — L'INDEX UNIQUE CANONIQUE (AD-3, FR-5) — le cœur de la story
--
-- C'est lui qui fait qu'« il n'existe jamais deux lignes à fusionner ». Toute l'agrégation de
-- FR-5 (« ajouter un article déjà présent additionne les quantités ») s'appuie dessus : sans
-- clé unique, l'UPSERT-incrémente de la story 4.4 n'a pas de cible.
--
-- ⚠️ **`create unique index`, ET NON `alter table … add constraint unique`.** Une contrainte de
-- table n'accepte ni expression, ni `nulls not distinct`. Ce n'est pas une préférence de style :
-- c'est la seule forme qui exprime le critère.
--
-- ⚠️ **`nulls not distinct` EST LE POINT QUI TUERAIT LE CRITÈRE EN SILENCE S'IL MANQUAIT.**
-- Mesuré le 2026-08-05 : avec un index unique ORDINAIRE, deux articles de même nom et d'unité
-- NULLE sont acceptés — deux lignes, aucune erreur, rien qui le signale. Or un article ajouté
-- **sans unité** est le cas nominal de l'ajout vocal et de l'ajout manuel rapide. Le critère
-- serait donc faux précisément là où il compte. PostgreSQL 15+ ; le local et la production sont
-- en 17.6.
--
-- ⚠️ **L'ORDRE DES QUATRE OPÉRATIONS N'EST PAS COMMUTATIF :**
--   1. `normalize(name, NFC)`  — composer AVANT de mesurer. Mesuré : sans lui, « crème » en NFC
--      et en NFD font deux lignes. C'est le défaut exact que `lib/texte.ts` documente pour
--      `unique(household_id, name)` sur les rayons.
--   2. `regexp_replace(...)`   — retirer les invisibles (et, incidemment, les espaces).
--   3. `strip_accents(...)`    — plier les accents (décision D1).
--   4. `lower(...)`            — plier la casse EN DERNIER : `unaccent` préserve la casse
--      (« Épinard » → « Epinard »), c'est `lower` qui la traite.
--
-- ⚠️ **CONSÉQUENCE ASSUMÉE : LES ESPACES ORDINAIRES DISPARAISSENT DE LA CLÉ.** `[:graph:]` les
-- exclut, donc « lait entier » et « laitentier » sont la même ligne. Plus agressif que
-- nécessaire, sans danger — personne ne tape la seconde forme délibérément — mais écrit plutôt
-- que découvert.
--
-- ⚠️ **INDEX TOTAL, PAS PARTIEL — aucun `where deleted_at is null`.** AD-3 le dit dans sa clause
-- *Prevents* : « l'id sur lequel s'arbitre LWW/tombstone doit rester stable ». Un tombstone
-- **garde donc sa clé**. Conséquence pour les stories 4.5 et 4.7, et il faut la lire maintenant
-- plutôt que la redécouvrir en production : **« rajouter un article supprimé » est un UPDATE
-- (`deleted_at` remis à nul), jamais un INSERT.** Une surface qui ferait un INSERT rendrait
-- `23505` sur un geste parfaitement légitime. AD-6 le dit déjà pour la génération : un article
-- tombstoné n'est ressuscité que si l'intention de génération est postérieure à l'intention de
-- suppression.
--
-- ⚠️ **ET LE TOMBSTONE N'EST PAS LE SEUL CAS — TROUVÉ EN REVUE, ÉCRIT POUR 4.2 / 4.4 / 4.5.**
-- Un article **ACHETÉ** occupe la clé lui aussi. Mesuré : avec un `('Lait', 'L', 'bought')` en
-- place, `insert ('Lait', 'L', 'pending')` rend `23505`. Or la vue `grocery_list_by_aisle`
-- filtre `status = 'pending' and deleted_at is null` : **la ligne qui occupe la clé est
-- invisible dans la seule source de lecture prévue par la story 4.2.** Une surface qui lit la
-- vue et écrit par INSERT recevra donc `23505` en désignant un article que sa propre lecture
-- affirme absent, et le message d'erreur ne dira rien d'utile au membre.
-- **La règle, pour toutes les stories suivantes : lire la TABLE, pas la vue, avant tout ajout
-- — et ajouter est un UPDATE dès que la clé est occupée, quel que soit le `status`.**
--
-- ⚠️ **LA COLONNE `name` GARDE SA CASSE, SES ACCENTS ET SA MISE EN FORME.** La normalisation vit
-- dans l'EXPRESSION DE L'INDEX, jamais dans la donnée. On n'écrase jamais ce que le membre a
-- tapé : « Crème fraîche » s'affiche « Crème fraîche ».
--
-- ⚠️ **`strip_accents` EST dans `nom_non_vide`, et la première rédaction disait l'inverse.**
-- Elle affirmait que « plier les accents ne peut pas vider un nom qui montrait quelque chose ».
-- Mesuré en revue le 2026-08-05 : **c'est faux** — `strip_accents(chr(768))` rend la chaîne
-- vide, et 106 points de code `[:graph:]` sont dans ce cas. Les deux expressions partagent
-- donc désormais **tout**, pas seulement la regex, et c'est la seule forme qui rende vraie la
-- promesse du volet 3 : ce que la contrainte accepte ne peut pas produire une clé vide.
--
-- ⚠️ **CE QUE CET INDEX CASSE, ET QUI EST DATÉ PLUTÔT QUE TU.**
-- `generate_grocery_list_from_menu` (`20260502000000:527-580`) devient capable d'échouer en
-- `23505` sur DEUX chemins, mesurés le 2026-08-05 :
--   1. son `delete … where status = 'pending'` ne retire pas les articles ACHETÉS ; un acheté
--      de même clé survit, et l'INSERT nu qui suit heurte l'index ;
--   2. son `group by ri.name, ri.unit, ri.product_id, ri.aisle_keyword` peut produire DEUX
--      lignes de même clé canonique (deux `product_id` différents).
-- Elle n'est PAS réparée ici — décision de Florian du 2026-08-05 : la réparer correctement
-- (UPSERT-incrémente non destructif, tombstone au lieu du DELETE, compte des articles ajoutés)
-- **est la story 4.7 en entier**, et une demi-réparation ici serait jetée. La casse est
-- dormante : la fonction n'a **aucun point d'appel** (mesuré). Entrée datée dans
-- `deferred-work.md`, adressée à la 4.7.
--
--
-- VOLET 5 — `updated_at` POSÉ SERVEUR, À L'INSERTION COMME À LA MISE À JOUR (AD-3)
--
-- `set_updated_at()` existe depuis le squelette et sert déjà `profiles` et `recipes` — mesuré :
-- ce sont les deux seuls triggers du schéma. Elle est réemployée telle quelle, jamais réécrite.
--
-- ⚠️ Rappel du volet 2 : `updated_at` est l'horodatage d'AFFICHAGE et de Realtime, `intent_at`
-- est l'arbitre. Le trigger ne touche qu'`updated_at`.
--
--
-- VOLET 6 — LA RLS, ET LE DELETE QUI DISPARAÎT (NFR-5, AD-2, AD-3)
--
-- Le critère de tombstone d'AD-3 dit « **jamais** par DELETE dur ». Écrire « on ne supprime pas,
-- on tombstone » dans le code applicatif est exactement le mode de défaillance qu'AD-1 et AD-2
-- interdisent : *la règle métier vit en Postgres, jamais dans la vigilance d'une surface*.
--
-- Et ce n'est pas théorique : l'écriture de la liste sera **client-direct** (AD-13), donc le
-- membre possède sa clé anon et son jeton. Un `DELETE` PostgREST direct suffit — c'est
-- exactement la forme d'appel qui a révélé le trou de `meal_plan_entries` le 2026-08-04.
--
-- `grocery_all … for all` couvrait `select`, `insert`, `update` ET `delete`. Elle est remplacée
-- par trois politiques nommées ; **l'absence de politique DELETE est le mécanisme** — la RLS
-- refuse par défaut ce qu'aucune politique n'autorise.
--
-- ⚠️ **C'EST UN RESSERREMENT, PAS UNE DESTRUCTION**, et il ne casse aucun consommateur : mesuré
-- le 2026-08-05, aucun code applicatif ne touche cette table.
--
-- ⚠️ **CE QUE CETTE FORME NE FAIT PAS** : une politique ne lie ni le rôle de service, ni une
-- fonction `security definer`. `generate_grocery_list_from_menu` est `security definer`
-- détenue par `postgres` : son DELETE dur traverse la RLS par construction.
--
-- ⚠️ **ET LA PREMIÈRE RÉDACTION EN CONCLUAIT « le critère est tenu pour les SURFACES » —
-- C'ÉTAIT FAUX, ET LA REVUE L'A MESURÉ.** Cette fonction *est* une surface : PostgREST
-- l'expose en RPC, et `execute` lui était accordé à `anon` et `authenticated`. Un membre
-- ordinaire effaçait donc sa liste en dur, tombstones compris, par un simple appel. **Le
-- volet 8 ferme ce second chemin** — lire son en-tête, il porte la mesure.
--
-- ⚠️ **LES CASCADES NE SONT PAS CONCERNÉES** : `on delete cascade` depuis `households` et
-- `on delete set null` depuis `recipes`/`aisles`/`products` sont des contraintes d'intégrité
-- référentielle, pas des ordres soumis à la RLS.
--
-- ⚠️ **`for update` PORTE `using` ET `with check` — MAIS LE SECOND N'EST PAS CE QUI TIENT LE
-- DÉPLACEMENT INTER-FOYERS, ET LA PREMIÈRE RÉDACTION DE CE COMMENTAIRE L'AFFIRMAIT À TORT.**
-- `using` décide quelles lignes sont modifiables, `with check` ce que la ligne a le droit de
-- devenir. Mesuré le 2026-08-05, en `set local role authenticated` avec un claim JWT forgé :
--
--   with check (true) + grocery_select using (household_id = …)  →  42501, déplacement REFUSÉ
--   with check (true) + grocery_select using (true)              →  déplacement ACCEPTÉ
--   with check (true) + grocery_select supprimée                 →  déplacement refusé
--
-- Autrement dit, c'est la politique **SELECT** qui refuse la ligne d'arrivée : Postgres exige
-- que le nouvel état d'une ligne mise à jour reste visible à celui qui la modifie.
--
-- `with check` est donc ici une **ceinture en plus des bretelles**, et il est gardé pour la
-- raison qu'employait déjà `20260804144217` à propos d'une égalité redondante : il **dit ce que
-- la règle EXIGE**, au lieu de dépendre d'une propriété d'une politique voisine que personne ne
-- mesure ici. Le jour où `grocery_select` s'assouplit — pour un dashboard, pour le pont — c'est
-- lui qui reste debout.
--
-- ⚠️ **Conséquence pour les tests** : « A ne peut pas déplacer son article chez B » mesure le
-- RÉSULTAT, pas ce `with check`. Aucun test ne le fait tomber à lui seul, et c'est écrit dans
-- `isolation.test.ts` plutôt que laissé croire.
--
--
-- VOLET 7 — LA VUE, QUI MONTRERAIT SINON LES ARTICLES SUPPRIMÉS
--
-- La vue filtre `status = 'pending'` et ignorerait `deleted_at` : mesuré le 2026-08-05, un
-- article tombstoné y apparaît. C'est un défaut que le volet 2 INTRODUIT ; le laisser à la story
-- 4.2 serait laisser derrière soi une vue qui ment.
--
-- ⚠️ **`g.*` NE SE REJOUE PAS, ET C'EST LA RAISON DE LA LISTE EXPLICITE.** Postgres FIGE
-- l'expansion de `g.*` à la création de la vue. Mesuré : les colonnes ajoutées ensuite n'y
-- apparaissent jamais, et rejouer le corps d'origine ÉCHOUE :
--
--   ERROR: cannot change name of view column "aisle_name" to "deleted_at"
--
-- `create or replace view` n'autorise que l'ajout de colonnes **en fin**. Les onze premières
-- colonnes gardent donc l'ordre exact de l'existant, les trois `aisle_*` restent en 12/13/14, et
-- les six neuves viennent après. La forme implicite était déjà un piège dormant : elle est
-- remplacée définitivement.
--
-- ⚠️ **`security_invoker = true` EST CONSERVÉ.** Sans lui, la vue s'exécuterait avec les droits
-- de son propriétaire et **traverserait la RLS** — les foyers ne seraient plus isolés en
-- lecture.
--
-- ⚠️ **LE FILTRE `status = 'pending'` NE CHANGE PAS.** Rendre les articles achetés relève des
-- stories 4.2 / 4.5.

-- Volet 1 — l'extension et son enveloppe immutable
--
-- ⚠️ LA GARDE CI-DESSOUS N'EST PAS DECORATIVE, et elle a ete ecrite en revue.
-- `create extension if not exists … with schema` est un NO-OP si l'extension existe deja
-- AILLEURS : elle n'est pas deplacee, et la ligne suivante echoue alors en
-- `text search dictionary "extensions.unaccent" does not exist` — au milieu du deploiement.
-- Mesure en revue le 2026-08-05, de bout en bout. `extrelocatable = t` : le deplacement est
-- possible, et il vaut mieux qu'un deploiement bloque.
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'unaccent';

  if v_schema is not null and v_schema <> 'extensions' then
    raise notice '`unaccent` etait dans le schema %, elle est deplacee vers `extensions`.', v_schema;
    execute 'alter extension unaccent set schema extensions';
  end if;
end $$;

create extension if not exists unaccent with schema extensions;

create or replace function public.strip_accents(p_texte text)
returns text
language sql
immutable
parallel safe
strict
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p_texte) $$;

-- Volet 2 — les six colonnes du modèle canonique
alter table grocery_list_items
  add column actor_kind text,
  add column actor_id   uuid,
  add column source_ref text,
  add column intent_at  timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;

-- Volet 3 — les six contraintes
alter table grocery_list_items
  add constraint grocery_list_items_unite_fermee
  check (unit is null or unit in ('g', 'kg', 'ml', 'L', 'pièce', 'cs', 'cc', 'pincée'));

-- ⚠️ LA MEME EXPRESSION QUE LA CLE DU VOLET 4, aux octets pres — pas seulement la meme
-- regex. La premiere redaction n'appliquait que `regexp_replace(name, …)` tout en affirmant
-- que « la contrainte et la cle emploient le meme predicat ». MESURE EN REVUE le 2026-08-05 :
-- c'etait faux, et le defaut que cette contrainte existe pour fermer restait donc ouvert —
-- un nom fait uniquement de diacritiques combinants (`chr(768)`) passait la contrainte et
-- produisait une cle canonique VIDE. 106 points de code `[:graph:]` sont dans ce cas.
alter table grocery_list_items
  add constraint grocery_list_items_nom_non_vide
  check (
    lower(public.strip_accents(
      regexp_replace(normalize(name, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g')
    )) <> ''
  );

-- ⚠️ ELLE EMPECHE UN PLANTAGE BTREE, ELLE NE PORTE PAS LA REGLE PRODUIT.
-- Mesure en revue : un nom incompressible de 3840 caracteres rend `54000`
-- (`index row size 3880 exceeds btree version 4 maximum 2704`) — et le defaut est
-- INTERMITTENT selon l'entropie du nom, `repeat('a', 3000)` passant grace a la compression
-- d'index. Le plafond produit (`MAX_NOM_ARTICLE`) appartient a la story 4.4, avec
-- `normaliserNomArticle` et le premier ecran d'ajout ; 200 est volontairement PLUS LARGE que
-- les 120 du client, pour que le desaccord reste dans le sens benin (« le client refuse, la
-- base accepterait »), jamais l'inverse.
-- ⚠️ C'est la PREMIERE contrainte de longueur du schema, et c'est une rupture assumee :
-- aucune autre colonne n'est dans une EXPRESSION D'INDEX UNIQUE, or c'est exactement ce qui
-- rend `54000` atteignable ici.
alter table grocery_list_items
  add constraint grocery_list_items_nom_borne
  check (length(name) <= 200);

alter table grocery_list_items
  add constraint grocery_list_items_acteur_connu
  check (actor_kind is null or actor_kind in ('profile', 'device'));

-- ⚠️ AD-9 : LA PROVENANCE *EST* LE COUPLE. Mesure en revue le 2026-08-05, les deux
-- moities passaient : `('profile', null)` et `(null, gen_random_uuid())`. Une moitie seule
-- n'est pas une provenance degradee, c'est une provenance illisible pour la story 4.6 — un
-- type sans identite, ou une identite sans type.
-- ⚠️ CE QU'ELLE NE DIT PAS : QUI a le droit de remplir le couple. Rien n'attache encore
-- `actor_id` a l'appelant, donc un membre peut attribuer un article a un autre membre de son
-- foyer. C'est DATE pour la story 4.6 (`deferred-work.md`, 2026-08-05) et non oublie : la
-- forme correcte depend de l'Epic 5, ou `actor_kind = 'device'` rend `auth.uid()` sans objet.
alter table grocery_list_items
  add constraint grocery_list_items_acteur_couple
  check ((actor_kind is null) = (actor_id is null));

-- ⚠️ GARDE-FOU SUR L'ARBITRE DU LWW, PAS POLITIQUE DE LWW. Mesure en revue :
-- `insert … (intent_at) values ('infinity')` etait accepte, et l'ecriture etant client-direct
-- (AD-13), une intention forgee gagnait DEFINITIVEMENT tout arbitrage futur — 4.5, 4.9, 4.10.
-- La borne est volontairement GENEREUSE (un jour) pour qu'une horloge d'appareil legerement
-- en avance ne soit jamais refusee ; la politique, elle, reste la story 4.9 (l'horloge du
-- geste) et la 4.10 (l'arbitrage).
-- ⚠️ Une contrainte qui emploie `now()` n'est evaluee qu'A L'ECRITURE : elle ne se
-- revalide jamais sur les lignes existantes, et c'est precisement ce qu'on veut ici.
alter table grocery_list_items
  add constraint grocery_list_items_intention_bornee
  check (intent_at <= now() + interval '1 day');

-- Volet 4 — l'index unique canonique
create unique index grocery_list_items_cle_canonique
  on grocery_list_items (
    household_id,
    lower(public.strip_accents(
      regexp_replace(normalize(name, NFC), '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180F\u2800\u3164\uFE00-\uFE0F\uFFA0\U000E0100-\U000E01EF]', '', 'g')
    )),
    unit
  ) nulls not distinct;

-- Volet 5 — `updated_at` pose serveur, A L'INSERTION COMME A LA MISE A JOUR
--
-- ⚠️ `before update` SEUL NE TENAIT PAS LE TITRE DE CE VOLET. Mesure en revue le
-- 2026-08-05 : `insert … (updated_at) values ('1970-01-01Z')` conservait la valeur du client
-- (`pg_trigger.tgtype = 19` = ROW|BEFORE|UPDATE), et `lib/supabase/types.ts` expose bien
-- `updated_at?` en `Insert`. Or AD-3 fait d'`updated_at` l'horodatage de Realtime : une
-- lecture incrementale `where updated_at > dernier_vu` aurait rate la ligne POUR TOUJOURS.
create trigger grocery_list_items_updated_at
  before insert or update on grocery_list_items
  for each row execute function set_updated_at();

-- Volet 6 — la RLS, et le DELETE qui disparaît
drop policy grocery_all on grocery_list_items;

create policy grocery_select on grocery_list_items for select
  using (household_id = current_household_id());

create policy grocery_insert on grocery_list_items for insert
  with check (household_id = current_household_id());

create policy grocery_update on grocery_list_items for update
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- Volet 7 — la vue, qui montrerait sinon les articles supprimés
create or replace view grocery_list_by_aisle
  with (security_invoker = true) as
  select
    g.id, g.household_id, g.name, g.quantity, g.unit, g.product_id,
    g.aisle_id, g.recipe_id, g.added_by, g.status, g.created_at,
    a.name       as aisle_name,
    a.icon       as aisle_icon,
    a.sort_order as aisle_sort,
    g.actor_kind, g.actor_id, g.source_ref,
    g.intent_at, g.updated_at, g.deleted_at
  from grocery_list_items g
  left join aisles a on g.aisle_id = a.id
  where g.status = 'pending' and g.deleted_at is null
  order by coalesce(a.sort_order, 9999), g.name;

-- Volet 8 — LE SECOND CHEMIN DE SUPPRESSION, qui rendait le volet 6 insuffisant
--
-- ⚠️ **AJOUTÉ EN REVUE LE 2026-08-05. Le volet 6 ne fermait que la moitié du critère.**
-- `generate_grocery_list_from_menu` est `security definer` détenue par `postgres`, donc elle
-- **traverse la RLS par construction** — et `20260729094500` lui a accordé `execute` à `anon` et
-- `authenticated` par ses privilèges par défaut. Elle fait un `delete … where status = 'pending'`.
--
-- **MESURÉ en revue**, en `set local role authenticated` avec le claim d'un profil réel :
--
--   avant  = 2 lignes (1 vivante + 1 tombstonée, toutes deux 'pending')
--   select public.generate_grocery_list_from_menu('2026-08-01','2026-08-07')  →  0
--   après  = 0 ligne,  tombstones_restants = 0
--
-- Autrement dit : un membre ordinaire effaçait sa liste EN DUR, tombstones compris, par un
-- simple `POST /rest/v1/rpc/`. L'écriture de la liste étant client-direct (AD-13), il possède sa
-- clé anon et son jeton — c'est exactement la forme d'appel que le volet 6 cite lui-même à propos
-- de `meal_plan_entries` le 2026-08-04.
--
-- ⚠️ **LA PRÉMISSE QUI COUVRAIT CE REPORT ÉTAIT MESURÉE SUR LE MAUVAIS OBJET.** « La fonction n'a
-- aucun point d'appel » a été établi par `grep` sur le **source TypeScript** ; ça ne dit rien de
-- la surface REST, qui était ouverte. Règle §5 : une prémisse qui sert à reporter un défaut se
-- rouvre avant d'être réinvoquée.
--
-- ⚠️ **CE VOLET NE RÉPARE PAS LA FONCTION, ET NE PRÉTEND PAS LE FAIRE.** Son corps n'est pas
-- touché : la décision D2 tient, et la réparation — UPSERT-incrémente non destructif, tombstone
-- au lieu du DELETE, compte des articles ajoutés — reste la story **4.7** en entier. Ce volet
-- ferme le second CHEMIN, exactement comme le volet 6 a fermé le premier.
--
-- ⚠️ **Ce que ça casse : rien.** Mesuré, la fonction n'a aucun point d'appel applicatif, et le
-- rôle `service_role` conserve son `execute` — la story 4.7 pourra donc la rétablir explicitement
-- pour les surfaces le jour où elle sera non destructive.
--
-- ⚠️ **`public` EST DANS LA LISTE, ET C'EST LE POINT QUI FAIT TOUT LE TRAVAIL.** Première
-- rédaction de ce volet, en revue : `revoke … from anon, authenticated` seul. Mesuré juste après,
-- `has_function_privilege('anon', …, 'execute')` rendait **encore `t`**. La raison est dans l'ACL :
--
--   {=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--     ↑ cette entrée SANS rôle nommé est `PUBLIC`
--
-- Postgres accorde `execute` à **PUBLIC** sur toute fonction créée, et `anon` comme
-- `authenticated` en héritent **indépendamment** de leurs entrées nommées. Retirer seulement les
-- entrées nommées ne retire donc rien du tout. C'est exactement le genre de correctif qui aurait
-- été consigné « appliqué » en ne fermant rien, sans le contrôle qui suit (règle §1).
revoke execute on function public.generate_grocery_list_from_menu(date, date)
  from public, anon, authenticated;
