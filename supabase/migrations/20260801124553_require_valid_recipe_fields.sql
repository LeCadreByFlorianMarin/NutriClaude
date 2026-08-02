-- Interdit un titre de recette vide et un nombre de portions non exploitable.
--
-- ⚠️ À CONTRÔLER EN REVUE, AVANT LA FUSION — cette migration ÉCHOUERA si une ligne
-- existante ne respecte pas l'une des deux contraintes, et depuis le 2026-07-29 elle
-- s'applique **pendant le déploiement de production** (`vercel.json` →
-- `scripts/migrer-au-deploiement.mjs`). Il n'y a plus de `db push` humain, donc plus de
-- moment pour sonder la base entre l'écriture et l'application : le contrôle se fait en
-- revue de PR, pas après. Exécuter dans le SQL Editor :
--
--   select id, household_id, title, servings from recipes
--   where servings <= 0
--      or regexp_replace(title, '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180E\u2800\u3164\uFE00-\uFE0F\uFFA0]', '', 'g') = '';
--
-- Attendu : **zéro ligne**, et c'est une DÉDUCTION, pas une mesure. Aucune surface n'a
-- jamais écrit dans `recipes` : le prototype qui le faisait a été supprimé à la story 1.1
-- et aucun écran depuis ne touche cette table. Le stack local en rend 0, ce qui ne prouve
-- rien sur le distant — il vient d'être remis à zéro. **Si la requête rend des lignes,
-- les corriger avant de fusionner, et n'assouplir aucune des deux contraintes pour les
-- accommoder.**
--
-- LES DEUX DÉFAUTS
--
-- 1. `title text not null` n'interdit pas la chaîne vide, ni une chaîne faite uniquement
--    d'invisibles. La story 3.1 ouvre le premier chemin de création de recette par saisie
--    libre ; sans contrainte, la seule protection vivrait côté navigateur — et le contrôle
--    navigateur ne voit pas les appels directs à l'API REST, que les tests d'isolation
--    font pour de vrai.
--
--    C'est la QUATRIÈME contrainte de cette forme, après `require_non_blank_display_name`,
--    `require_non_blank_household_name` et `require_non_blank_aisle_name`. Même motif,
--    même raison : un champ libre partagé par tout le foyer descend en base, là où le
--    projet a décidé que vivent les règles (AD-1/AD-2).
--
-- 2. `servings int not null default 2` accepte **0 et le négatif**, et la conséquence
--    n'apparaîtrait que deux epics plus loin. `generate_grocery_list_from_menu`
--    (`20260502000000:544-547`) calcule :
--
--      sum(coalesce(ri.quantity, 0) * (mpe.servings::numeric / nullif(r.servings, 0)))
--
--    Le `nullif` évite la division par zéro — il ne lève pas, il rend **NULL**. Une
--    recette à 0 portion planifiée au menu verserait donc ses ingrédients dans la liste
--    de courses **avec une quantité vide**, sans erreur ni signal. Un `servings` négatif
--    est pire : il rend des quantités **négatives**, qui s'additionneront à celles des
--    autres recettes par l'UPSERT-incrémente d'AD-6.
--
--    C'est ce que l'AC3 de la story 3.1 exige en toutes lettres — « une valeur numérique
--    **exploitable** plus tard pour la mise à l'échelle ». `min={1}` sur un
--    `<input type="number">` n'est pas une frontière : il se contourne dans les outils de
--    développement, et il n'existe pas du tout pour un appel REST direct.
--
-- LA REGEX EST RECOPIÉE DE `20260729095923_require_non_blank_aisle_name.sql`, À LA LETTRE
-- Elle n'est pas réécrite, et il ne faut pas la « simplifier » : elle a été **fausse deux
-- fois** avant d'être juste. `btrim(name) <> ''` ne retirait que l'espace ASCII ; une
-- énumération de seize points de code laissait passer U+115F et U+1160. Lire l'en-tête de
-- cette migration-là pour le raisonnement complet.
--
-- ⚠️ **`\u034F` N'EST PAS UN BACKSLASH SUIVI D'UN « u ».** Le fichier contient bien les
-- octets ASCII `\`, `u`, `0`, `3`, `4`, `F`, et `standard_conforming_strings` vaut `on`,
-- donc l'analyseur de chaînes les transmet tels quels. C'est l'**analyseur d'expressions
-- rationnelles** de Postgres qui les interprète : en ARE, `\uwxyz` désigne le caractère de
-- valeur hexadécimale 0xwxyz, y compris à l'intérieur d'une classe. **Mesuré le
-- 2026-08-01** sur le Postgres du conteneur, par insertions réelles dans `aisles` : les
-- sept noms normaux (« Boucherie », « BIO », « BOB », « CAVE », « BAZAR », « ABBA »,
-- « SURGELÉS ») sont acceptés, et les huit invisibles (U+034F, U+3164, U+115F, U+1160,
-- U+2800, U+FE0F, tabulation, chaîne vide) refusés. 15 cas sur 15.
--
-- Cette note existe parce que la lecture naïve — « ces backslashes ne sont pas
-- interprétés, la classe contient donc des caractères ASCII et un intervalle B-\ » — est
-- plausible, fausse, et conduirait à « corriger » une contrainte qui marche.
--
-- ⚠️ **La contrepartie applicative n'est PAS identique, et ne peut pas l'être.**
-- `lib/texte.ts` emploie `\p{Default_Ignorable_Code_Point}`, une propriété Unicode que les
-- expressions rationnelles de Postgres n'ont pas. L'accord est **mesuré** par
-- `supabase/tests/contraintes.test.ts`, pas affirmé ici.
--
-- Ne change pas la forme du schéma : aucune régénération de types n'est nécessaire, et le
-- compte de fonctions de `docs/migrations.md` est inchangé.

alter table recipes
  add constraint recipes_titre_non_vide
  check (
    regexp_replace(title, '[^[:graph:]]|[\u034F\u115F\u1160\u17B4\u17B5\u180B-\u180E\u2800\u3164\uFE00-\uFE0F\uFFA0]', '', 'g') <> ''
  );

alter table recipes
  add constraint recipes_servings_positif
  check (servings > 0);
