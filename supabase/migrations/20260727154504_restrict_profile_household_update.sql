-- Gèle `profiles.household_id` en écriture : un membre ne peut plus se déplacer
-- d'un foyer à l'autre en réécrivant sa propre ligne.
--
-- LE DÉFAUT
-- `profiles_update_own` était déclarée avec un `using` et **sans `with check`**.
-- Quand `with check` est absent, Postgres réutilise l'expression `using` comme
-- contrôle d'écriture : seule `id = auth.uid()` était donc contrainte, et
-- `household_id` ne l'était pas du tout.
--
-- Or `current_household_id()` se résout par
--   select household_id from profiles where id = auth.uid()
-- et c'est la clé de voûte de toutes les autres politiques. Réécrire sa propre
-- ligne basculait donc l'intégralité de la RLS vers le foyer visé, en une seule
-- requête PATCH avec la clé anon publique et une session légitime.
--
-- L'UUID cible n'est pas devinable, mais `redeem_household_invite` le
-- **retourne** à qui rejoint un foyer : l'accès était donc conservé à vie, et
-- comme aucun mécanisme de retrait de membre n'existe, aucune révocation n'était
-- possible. C'est NFR-5 — l'isolation entre foyers — la seule chose que ce
-- produit ne peut pas se permettre de casser.
--
-- LE CORRECTIF
-- `current_household_id()` est `stable` et lit la ligne **avant** modification :
-- au moment où le `with check` s'évalue, elle rend donc l'ancienne valeur. Exiger
-- l'égalité revient à interdire tout changement de la colonne, sans avoir à
-- nommer un foyer particulier.
--
-- Ce qui n'est PAS affecté :
--  - l'inscription au foyer (`create_household_with_profile`,
--    `redeem_household_invite`) passe par un INSERT, pas un UPDATE, et par des
--    fonctions `security definer` qui contournent la RLS ;
--  - la modification du prénom (`app/foyer/DisplayNameForm.tsx`), qui n'envoie
--    que `display_name` et laisse `household_id` inchangé.
--
-- Le jour où changer de foyer deviendra une fonctionnalité, elle passera par une
-- fonction `security definer` qui pourra appliquer ses propres règles — et non
-- par un UPDATE direct sur la table.

drop policy if exists profiles_update_own on profiles;

create policy profiles_update_own on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and household_id = current_household_id());
