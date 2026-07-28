-- Interdit un nom de foyer vide ou fait uniquement d'espaces.
--
-- ⚠️ À CONTRÔLER AVANT `db push` — échouera si une ligne existante ne respecte
-- pas la contrainte. Exécuter d'abord, dans le SQL Editor :
--
--   select id, name from households where btrim(name) = '';
--
-- Si la requête rend des lignes : les corriger avant de pousser. Le nom du
-- foyer n'étant modifiable nulle part dans l'application, la correction se fait
-- depuis le tableau de bord.
--
-- LE DÉFAUT
-- Symétrique de celui corrigé sur `profiles.display_name` le 2026-07-28, mais
-- il était passé inaperçu : `households.name` est `not null`, ce qui n'interdit
-- pas la chaîne vide, et `create_household_with_profile` insère
-- `p_household_name` tel quel, sans `btrim`.
--
-- La seule protection vivait donc côté navigateur — et un commentaire du code
-- affirmait exactement l'inverse, en citant une contrainte `check` qui n'existe
-- que sur `profiles`. C'est la revue de la couche UI qui a relevé la
-- contradiction. Une revue peut se tromper ; deux documents qui se contredisent
-- signalent toujours quelque chose.
--
-- La conséquence est plus lourde ici que pour un prénom : le nom du foyer
-- s'affiche en titre des deux écrans principaux, il est partagé par tout le
-- foyer, et **personne ne peut le corriger depuis l'application**.
--
-- LE CORRECTIF
-- La règle descend là où le projet a décidé que vivent les règles, et couvre
-- désormais aussi les appels directs à l'API REST.
--
-- `btrim` ne retire pas U+200B : la normalisation applicative
-- (`lib/foyer/saisie.ts`) reste nécessaire en amont. Les deux se complètent —
-- la base refuse le vide franc, le client refuse le vide déguisé.

alter table households
  add constraint households_name_non_vide
  check (btrim(name) <> '');
