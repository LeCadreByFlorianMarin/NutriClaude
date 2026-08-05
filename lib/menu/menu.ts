import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { estUuid } from "../recettes/saisie.ts";
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
 *
 * ⚠️ **`slug` est ce qui paraît dans l'URL**, et il est français : la story 3.6
 * ouvre `/menu/2026-08-04/midi`, jamais `/menu/2026-08-04/lunch`. Le jeton anglais
 * est un détail de schéma ; l'adresse, elle, se lit, se copie et se partage.
 * Le poser ICI plutôt que dans une table de correspondance ailleurs est ce qui
 * garde à cette constante son statut de seul décideur.
 *
 * ⚠️ **Aucun slug n'a besoin d'être encodé dans une URL**, et c'est mesuré par
 * `menu.test.ts` plutôt que laissé à la vigilance : « petit-déj » accentué
 * paraîtrait `petit-d%C3%A9j` dans la barre d'adresse, et un lien copié
 * deviendrait illisible.
 */
export const REPAS = [
  { code: "breakfast", slug: "petit-dej", libelle: "Petit-déj" },
  { code: "lunch", slug: "midi", libelle: "Midi" },
  { code: "snack", slug: "collation", libelle: "Collation" },
  { code: "dinner", slug: "soir", libelle: "Soir" },
] as const;

export type CodeRepas = (typeof REPAS)[number]["code"];
export type Repas = (typeof REPAS)[number];

/**
 * Le repas désigné par un segment d'URL, ou `null`.
 *
 * ⚠️ **C'est une GARDE DE SAISIE, pas un utilitaire de confort.** Le segment
 * arrive de l'URL, donc de n'importe où : `/menu/2026-08-04/déjeuner`,
 * `/menu/2026-08-04/lunch`, un segment vide ou répété. Aucun ne doit lever ni
 * désigner un repas. Même rôle qu'`estJourISO` pour la date et qu'`estUuid` pour
 * un identifiant — éviter un aller-retour réseau et, surtout, une erreur que rien
 * ne traduirait.
 *
 * ⚠️ **Le CODE de la base est refusé à dessein.** `lunch` est parfaitement valide
 * en base, et pourtant `repasParSlug("lunch")` rend `null` : accepter les deux
 * formes donnerait deux adresses à la même case, donc deux entrées d'historique,
 * deux favoris, et un jour une divergence entre elles. L'URL parle français, et
 * elle ne parle que français.
 *
 * ⚠️ **Une comparaison stricte, sans `trim` ni minuscules.** Toute tolérance
 * fabriquerait une seconde adresse valide, ce que le paragraphe précédent écarte.
 *
 * C'est la garde que la story 3.6 prescrivait sous le nom `estCodeRepas` : la
 * route recevant un **slug** et non un code, un prédicat sur les codes n'aurait
 * eu aucun appelant — et un prédicat construit puis non branché est la dette que
 * la revue du 2026-08-03 a relevée sur `estUniteConnue`.
 */
export function repasParSlug(slug: string | null | undefined): Repas | null {
  if (typeof slug !== "string") return null;
  return REPAS.find((repas) => repas.slug === slug) ?? null;
}

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
 * ⚠️ **Le tri est à TROIS critères, et le troisième n'est pas décoratif.** Deux
 * recettes DIFFÉRENTES peuvent tenir dans la même case : la contrainte
 * `meal_plan_entries_assignation_unique` d'AD-6 (`20260804144217`, story 3.6)
 * interdit le doublon de la même recette, pas la pluralité. Sans `created_at`,
 * deux lignes ex æquo sortent dans l'ordre que Postgres choisit ce jour-là, et la
 * case « bouge toute seule » d'un rechargement à l'autre. C'est la leçon déjà
 * payée par `rayonsDuFoyer` (`sort_order` ex æquo) et `recettesDuFoyer` (titres
 * homonymes).
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
   * ⚠️ **La garde sur `recipes` (dans `versCaseDeMenu`) est un contrôle
   * d'EXÉCUTION sur un champ que le type dit non-nul, et elle reste due bien que
   * le trou qui la motivait soit refermé.**
   *
   * Le type d'abord : supabase-js infère la ressource embarquée en
   * `{ id: string; title: string }` — ni tableau, ni nullable (mesuré le
   * 2026-08-04 par une sonde de typage). Mais **le type décrit le schéma, pas la
   * RLS.**
   *
   * L'ÉTAT AU 2026-08-04, APRÈS `20260804144217` : le `with check` de
   * `meal_plan_all` exige désormais que `recipe_id` désigne une recette du foyer
   * courant, donc **aucune surface applicative ne peut plus créer une case
   * incohérente** — mesuré, la pose rend `42501`. Ce qui subsiste :
   *
   *   · une politique RLS ne lie ni le rôle de service ni un `security definer` ;
   *     le harnais d'isolation pose encore de telles lignes, délibérément, et
   *     c'est ce qui permet de MESURER que la RLS filtre la ressource embarquée ;
   *   · les lignes antérieures à la migration, s'il en existait — le `with check`
   *     ne s'applique qu'aux écritures, jamais rétroactivement.
   *
   * Sans cette garde, une telle case afficherait « une recette, sans nom », ce qui
   * est pire qu'une case vide. Les deux faits sont figés par
   * `supabase/tests/isolation.test.ts` (« LE TROU REFERMÉ »).
   */
  return (data ?? []).flatMap(versCaseDeMenu);
}

/**
 * Une ligne de `meal_plan_entries` telle que PostgREST la rend, vers une case.
 *
 * ⚠️ **Rend un TABLEAU de zéro ou une case**, pour être consommé par `flatMap` :
 * c'est ce qui écarte les lignes dont la jointure rend `null` sans que l'appelant
 * ait à s'en souvenir. Extrait quand la story 3.6 a ajouté un second appelant —
 * deux copies de ce mapping auraient divergé, et la garde ci-dessous est
 * précisément ce qu'une copie oublie.
 */
function versCaseDeMenu(ligne: {
  id: string;
  meal_date: string;
  meal_type: string;
  servings: number;
  recipes: { id: string; title: string } | null;
}): CaseDeMenu[] {
  return ligne.recipes
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
    : [];
}

/**
 * Ce qui est prévu à UNE case précise (un jour, un repas).
 *
 * **Pourquoi une lecture à part plutôt qu'un filtre sur `casesDeLaSemaine`.**
 * L'écran d'assignation n'a besoin que d'une case sur 28 ; lire la semaine
 * entière pour en jeter 27 ferait payer à chaque ouverture de formulaire le coût
 * de la grille. Les colonnes, l'ordre et le mapping restent partagés — c'est ce
 * qui garantit que les deux lectures rendent la même forme.
 *
 * ⚠️ **Le tri par `created_at` n'est pas décoratif**, même ici où la contrainte
 * d'unicité d'AD-6 existe désormais : elle interdit le doublon de la MÊME recette,
 * pas la pluralité. Deux recettes différentes au même repas restent permises, et
 * sans troisième critère leur ordre serait celui que Postgres choisit ce jour-là.
 */
export async function casesDuRepas(
  supabase: SupabaseClient<Database>,
  jour: JourISO,
  repas: string
): Promise<CaseDeMenu[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select(COLONNES)
    .eq("meal_date", jour)
    .eq("meal_type", repas)
    .order("created_at");

  if (error) {
    throw new Error(`Lecture de la case impossible : ${error.message}`);
  }

  return (data ?? []).flatMap(versCaseDeMenu);
}

/**
 * Les repas où une recette est prévue, du plus proche au plus lointain.
 *
 * **Pourquoi cette lecture existe.** Supprimer une recette vide ses cases de menu
 * **en silence** — `meal_plan_entries.recipe_id` est `on delete cascade`
 * (`initial_schema.sql:178`). La confirmation de suppression disait « Elle
 * disparaît de ton répertoire. », ce qui était vrai tant qu'aucun écran ne
 * permettait de mettre une recette au menu, et devient faux avec la story 3.6.
 * Cette fonction est ce qui permet à la confirmation de dire la vérité.
 *
 * ⚠️ **Elle ne filtre PAS sur la date.** Un repas passé compte autant qu'un repas
 * à venir : la ligne disparaîtra pareil, et l'annoncer à moitié serait pire que ne
 * rien annoncer. C'est un compte de ce qu'on détruit, pas un agenda.
 *
 * Client **en paramètre**, garde `estUuid`, `[]` sur zéro ligne et `throw` sur
 * `error` : le motif de tout `lib/`, et pour les mêmes raisons — une recette qui
 * n'est à aucun menu est l'état **nominal**, pas une panne.
 */
export async function casesDeRecette(
  supabase: SupabaseClient<Database>,
  recetteId: string
): Promise<Array<{ jour: JourISO; repas: string }>> {
  if (!estUuid(recetteId)) return [];

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("meal_date, meal_type")
    .eq("recipe_id", recetteId)
    .order("meal_date")
    .order("meal_type");

  if (error) {
    throw new Error(`Lecture du menu de la recette impossible : ${error.message}`);
  }

  return (data ?? []).map((ligne) => ({
    jour: ligne.meal_date,
    repas: ligne.meal_type,
  }));
}

/**
 * Les cases rangées par (jour, repas).
 *
 * ⚠️ **La valeur est une LISTE, pas une case.** Plusieurs recettes DIFFÉRENTES
 * peuvent partager un repas — la contrainte d'AD-6 n'interdit que le doublon de la
 * même recette — et une `Map<clé, CaseDeMenu>` en perdrait silencieusement : la
 * case en montrerait une, la base en aurait trois, et la génération de liste de
 * l'Epic 4 compterait les trois. « Soir : gratin + salade » est un menu normal.
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
