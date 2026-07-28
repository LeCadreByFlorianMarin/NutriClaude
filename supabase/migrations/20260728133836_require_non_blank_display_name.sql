-- Interdit un prénom vide ou fait uniquement d'espaces.
--
-- ⚠️ À CONTRÔLER AVANT `db push` — cette migration ÉCHOUERA si une ligne
-- existante ne respecte pas la contrainte. Le dépôt trace trois comptes témoins
-- (`+nc1`, `+nc2`, `+nc3`) abandonnés en production, dont on ne connaît pas le
-- contenu exact. Exécuter d'abord, dans le SQL Editor :
--
--   select id, display_name from profiles where btrim(display_name) = '';
--
-- Si la requête rend des lignes : les corriger (ou les supprimer depuis le
-- tableau de bord) avant de pousser. Ne pas assouplir la contrainte pour
-- accommoder des données de test.
--
-- LE DÉFAUT
-- `display_name` est `not null`, ce qui n'interdit pas la chaîne vide. Les deux
-- fonctions d'inscription (`create_household_with_profile`,
-- `redeem_household_invite`) insèrent `p_display_name` tel quel, sans `btrim`.
-- La seule protection vivait côté navigateur, en trois copies de `.trim()` —
-- et `String.prototype.trim()` ne retire pas les caractères invisibles
-- (U+200B et voisins) qu'un copier-coller depuis une messagerie transporte.
--
-- Résultat visible : l'accueil affiche « Salut . » et la liste des membres
-- montre une ligne vide, que **personne d'autre que l'intéressé ne peut
-- corriger** — le prénom n'est modifiable que par son propriétaire.
--
-- LE CORRECTIF
-- La règle descend là où le projet a décidé que vivent les règles. Elle couvre
-- désormais aussi les appels directs à l'API REST, que le contrôle navigateur
-- ne voyait pas.
--
-- `btrim` seul ne retire pas U+200B : la normalisation applicative
-- (`lib/foyer/saisie.ts`) reste nécessaire en amont. Les deux se complètent —
-- la base refuse le vide franc, le client refuse le vide déguisé.

alter table profiles
  add constraint profiles_display_name_non_vide
  check (btrim(display_name) <> '');
