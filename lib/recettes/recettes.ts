import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { estUuid } from "./saisie.ts";

export type Recette = {
  id: string;
  titre: string;
  description: string | null;
  instructions: string | null;
  portions: number;
  preparationMin: number | null;
  cuissonMin: number | null;
};

/** Les colonnes lues, en un seul endroit : les deux fonctions doivent rendre la
 *  même forme, sinon `Recette` mentirait sur l'une des deux. */
const COLONNES =
  "id, title, description, instructions, servings, prep_time_min, cook_time_min";

/** Forme brute d'une ligne `recipes`, telle que PostgREST la rend. */
type LigneRecette = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
};

function versRecette(ligne: LigneRecette): Recette {
  return {
    id: ligne.id,
    titre: ligne.title,
    description: ligne.description,
    instructions: ligne.instructions,
    portions: ligne.servings,
    preparationMin: ligne.prep_time_min,
    cuissonMin: ligne.cook_time_min,
  };
}

/**
 * Les recettes du foyer courant, rangées par titre.
 *
 * Le client est **passé en paramètre**, jamais construit ici : cette fonction
 * n'a rien de spécifique à une route web, et l'y attacher la rendrait
 * inutilisable hors d'un rendu Next — donc inutilisable par le dashboard de
 * l'Epic 5 et le serveur MCP de l'Epic 7. Même raison pour son emplacement dans
 * `lib/` : le glob du lanceur de tests s'arrête à `lib/`.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge (`recipes_all`, `using`
 * **et** `with check`), et l'ajouter à la main laisserait croire que c'est lui
 * qui protège.
 *
 * ⚠️ **Le tri secondaire par date n'est pas décoratif** — c'est la leçon exacte
 * de `rayonsDuFoyer` et de ses `sort_order` ex æquo. Rien n'impose l'unicité du
 * titre dans un foyer, et rien ne devrait : deux « Curry » différents sont
 * légitimes. Sans second critère, l'ordre d'affichage de deux homonymes est
 * celui que Postgres choisit ce jour-là, et le répertoire « bouge tout seul »
 * d'un rechargement à l'autre.
 *
 * ⚠️ **Le tri par titre n'est servi par aucun index** — `idx_recipes_household`
 * porte sur `(household_id, created_at desc)`. C'est **assumé et sans portée** :
 * un foyer a des dizaines de recettes, pas des millions, et un répertoire qu'on
 * parcourt à l'œil se range par nom, pas par date d'ajout. Écrit pour qu'une
 * revue n'y voie pas un oubli.
 */
export async function recettesDuFoyer(
  supabase: SupabaseClient<Database>
): Promise<Recette[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(COLONNES)
    .order("title")
    .order("created_at");

  /*
   * Lève si la lecture échoue — mais rend `[]` sans lever quand il n'y a
   * simplement aucune ligne. Un répertoire vide est l'**état nominal de l'AC4**,
   * celui que tout foyer traverse avant sa première recette, et que l'écran doit
   * savoir montrer. Même distinction que dans `rayonsDuFoyer`.
   */
  if (error) {
    throw new Error(`Lecture des recettes impossible : ${error.message}`);
  }

  return (data ?? []).map(versRecette);
}

/**
 * Une recette du foyer courant, ou `null` si elle n'existe pas, appartient à un
 * autre foyer, ou si l'identifiant n'a même pas la forme d'un uuid.
 *
 * ⚠️ **Les trois cas rendent `null` À DESSEIN, et l'appelant les traite
 * pareil** — par un `notFound()`. Les distinguer serait au mieux inutile, au
 * pire une fuite : répondre « cette recette existe mais pas pour toi » dirait à
 * un foyer ce qu'un autre possède. Sous RLS, la base elle-même ne fait pas la
 * différence : elle rend **zéro ligne, sans erreur**.
 *
 * ⚠️ **`maybeSingle` et non `single`.** `single` transforme zéro ligne en erreur
 * `PGRST116`, qu'il faudrait ensuite démêler d'une vraie panne — alors que zéro
 * ligne est un **succès** PostgREST. C'est la leçon de `DisplayNameForm`.
 *
 * La garde d'uuid évite un aller-retour et, surtout, le `22P02` que rien ne
 * traduit. Voir `estUuid`.
 */
export async function recetteParId(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<Recette | null> {
  if (!estUuid(id)) return null;

  const { data, error } = await supabase
    .from("recipes")
    .select(COLONNES)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Lecture de la recette impossible : ${error.message}`);
  }

  return data ? versRecette(data) : null;
}
