import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { joursDeLaSemaine, type JourISO } from "./semaine.ts";

/**
 * Les repas d'une journée, dans l'ordre où on les mange.
 *
 * ⚠️ **Les QUATRE que la base admet**, et c'est la seule liste qui décide — le
 * `check` de `meal_plan_entries.meal_type` accepte `breakfast`, `lunch`,
 * `dinner`, `snack`. N'en rendre que trois créerait un état **stockable et non
 * affichable** : l'Epic 7 ouvre une seconde surface (MCP) sur la même base, et un
 * repas posé depuis Claude disparaîtrait du web sans que rien ne le dise.
 *
 * ⚠️ **L'ordre est chronologique, la collation entre midi et le soir** — c'est un
 * goûter d'après-midi, et une journée se lit dans l'ordre où on mange. Décision
 * de Florian du 2026-08-04 ; la grille de la story 3.6 en hérite.
 *
 * ⚠️ **C'est le seul endroit qui nomme les repas.** Une chaîne « Midi » recopiée
 * dans le JSX serait une seconde source de vérité, et les deux divergeraient.
 */
export const REPAS = [
  { code: "breakfast", libelle: "Petit-déj" },
  { code: "lunch", libelle: "Midi" },
  { code: "snack", libelle: "Collation" },
  { code: "dinner", libelle: "Soir" },
] as const;

export type CodeRepas = (typeof REPAS)[number]["code"];

/** Une recette assignée à une case (jour × repas) de la grille. */
export type CaseDeMenu = {
  id: string;
  jour: JourISO;
  repas: string;
  personnes: number;
  recetteId: string;
  recetteTitre: string;
};

/** Les colonnes lues, en un seul endroit. */
const COLONNES = "id, meal_date, meal_type, servings, recipes(id, title)";

/**
 * La clé d'une case. Employée par `grouperParCase` et par l'écran ; l'écrire ici
 * évite que les deux la composent différemment.
 */
export function cleDeCase(jour: JourISO, repas: string): string {
  return `${jour}·${repas}`;
}

/**
 * Les cases de menu d'une semaine, du lundi au dimanche inclus.
 *
 * Le client est **passé en paramètre**, jamais construit ici : cette fonction n'a
 * rien de spécifique à une route web, et l'y attacher la rendrait inutilisable
 * hors d'un rendu Next — donc inutilisable par le dashboard de l'Epic 5 (FR-44,
 * « le menu du jour ») et le serveur MCP de l'Epic 7. Même raison pour son
 * emplacement dans `lib/` : le glob du lanceur de tests s'arrête à `lib/`.
 *
 * Pas de filtre sur `household_id` : la RLS s'en charge (`meal_plan_all`, `using`
 * **et** `with check`), et l'ajouter à la main laisserait croire que c'est lui
 * qui protège. L'index `idx_meal_plan_household_date` porte exactement sur
 * `(household_id, meal_date)`, donc le `between` est servi.
 *
 * ⚠️ **Le tri est à TROIS critères, et le troisième n'est pas décoratif.** Rien
 * n'interdit aujourd'hui deux recettes dans la même case — la contrainte
 * `unique(household_id, meal_date, meal_type, recipe_id)` d'AD-6 appartient à la
 * story 3.6 et n'existe pas encore en base. Sans `created_at`, deux lignes ex
 * æquo sortent dans l'ordre que Postgres choisit ce jour-là, et la case « bouge
 * toute seule » d'un rechargement à l'autre. C'est la leçon déjà payée par
 * `rayonsDuFoyer` (`sort_order` ex æquo) et `recettesDuFoyer` (titres homonymes).
 *
 * ⚠️ **`meal_type` se trie ALPHABÉTIQUEMENT en base**, ce qui ne veut rien dire
 * comme ordre de repas. Ce n'est pas lui qui ordonne l'affichage : c'est `REPAS`,
 * côté écran. Le tri SQL n'est là que pour rendre le résultat déterministe.
 */
export async function casesDeLaSemaine(
  supabase: SupabaseClient<Database>,
  lundi: JourISO
): Promise<CaseDeMenu[]> {
  const jours = joursDeLaSemaine(lundi);

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select(COLONNES)
    .gte("meal_date", jours[0])
    .lte("meal_date", jours[6])
    .order("meal_date")
    .order("meal_type")
    .order("created_at");

  /*
   * Lève si la lecture échoue — mais rend `[]` sans lever quand il n'y a
   * simplement aucune ligne. Une semaine vide est l'**état nominal de l'AC4**,
   * celui que tout foyer traverse avant sa première assignation, et que l'écran
   * doit savoir montrer. Même distinction que dans `recettesDuFoyer`.
   */
  if (error) {
    throw new Error(`Lecture du menu impossible : ${error.message}`);
  }

  /*
   * ⚠️ **La garde sur `recipes` est un contrôle d'EXÉCUTION sur un champ que le
   * type dit non-nul, et ce n'est PAS de la prudence : le cas est atteignable, et
   * il a été mesuré.**
   *
   * Le type d'abord : supabase-js infère la ressource embarquée en
   * `{ id: string; title: string }` — ni tableau, ni nullable (mesuré le
   * 2026-08-04 par une sonde de typage). Mais **le type décrit le schéma, pas la
   * RLS.**
   *
   * Et le schéma laisse un trou : `meal_plan_all` ne contrôle que
   * `household_id`, jamais que `recipe_id` appartienne au même foyer, et une clé
   * étrangère s'applique sans égard pour la RLS. Un membre peut donc poser dans
   * SON menu une case pointant la recette d'un AUTRE foyer — **mesuré le
   * 2026-08-04 sur le stack local : la pose est acceptée.** PostgREST rend alors
   * `recipes: null`, la RLS filtrant bien la ressource jointe.
   *
   * Cette ligne est donc du **code vivant**, pas une ceinture de sécurité
   * théorique : sans elle, la case afficherait « une recette, sans nom », ce qui
   * est pire qu'une case vide. Les deux faits sont figés par
   * `supabase/tests/isolation.test.ts` (« LE TROU POSSIBLE »), et le trou
   * d'intégrité lui-même est consigné dans `deferred-work.md` — il appartient à
   * la story 3.6, qui ouvre l'écriture.
   */
  return (data ?? []).flatMap((ligne) =>
    ligne.recipes
      ? [
          {
            id: ligne.id,
            jour: ligne.meal_date,
            repas: ligne.meal_type,
            personnes: ligne.servings,
            recetteId: ligne.recipes.id,
            recetteTitre: ligne.recipes.title,
          },
        ]
      : []
  );
}

/**
 * Les cases rangées par (jour, repas).
 *
 * ⚠️ **La valeur est une LISTE, pas une case.** Rien n'interdit aujourd'hui
 * plusieurs recettes au même repas du même jour (voir `casesDeLaSemaine`), et une
 * `Map<clé, CaseDeMenu>` en perdrait silencieusement — la case en montrerait une,
 * la base en aurait trois, et la génération de liste de l'Epic 4 compterait les
 * trois. « Soir : gratin + salade » est un menu normal.
 */
export function grouperParCase(cases: CaseDeMenu[]): Map<string, CaseDeMenu[]> {
  const par = new Map<string, CaseDeMenu[]>();
  for (const c of cases) {
    const cle = cleDeCase(c.jour, c.repas);
    const deja = par.get(cle);
    if (deja) deja.push(c);
    else par.set(cle, [c]);
  }
  return par;
}
