import { normaliserMultiligne, normaliserTexte } from "../texte.ts";

/**
 * Normalisation des saisies d'une recette, avant de les envoyer à la base.
 *
 * Même rôle que `lib/foyer/saisie.ts` et `lib/rayons/saisie.ts` : les bornes et
 * ce qui appartient au domaine vivent ici, la règle générique vit dans
 * `lib/texte.ts`.
 *
 * ⚠ **Le choix entre `normaliserTexte` et `normaliserMultiligne` est LE piège de
 * ce domaine.** Les instructions sont le premier champ multiligne du produit, et
 * `normaliserTexte` détruirait tous leurs retours à la ligne sans émettre le
 * moindre signal. Lire l'en-tête de `normaliserMultiligne` avant de toucher à
 * l'une de ces trois fonctions.
 */

/**
 * Longueurs maximales. Généreuses mais bornées : un champ libre partagé par tout
 * le foyer, qu'aucun autre membre ne peut corriger, ne doit pas pouvoir casser
 * les écrans de chacun.
 *
 * - **Titre, 80.** Deux fois `MAX_NOM_RAYON` : un titre de recette est une
 *   phrase courte (« Curry de pois chiches au lait de coco » en fait 38), pas
 *   une étiquette d'en-tête en capitales. Il s'affiche en ligne de répertoire et
 *   en `<h1>`.
 * - **Description, 300.** Deux à trois phrases. Assez pour dire ce que c'est et
 *   quand on la fait, trop court pour y écrire les instructions par méprise —
 *   ce qui est le vrai risque, les deux champs étant voisins.
 * - **Instructions, 5000.** Environ soixante lignes. La borne existe pour
 *   empêcher un collage accidentel de plusieurs pages, pas pour rationner.
 */
export const MAX_TITRE = 80;
export const MAX_DESCRIPTION = 300;
export const MAX_INSTRUCTIONS = 5000;

/**
 * Le titre, nettoyé et borné, ou `null` s'il ne reste rien d'affichable.
 *
 * Aplati volontairement : un titre tient sur une ligne, il s'affiche en `<h1>`
 * et en ligne de répertoire. Sa contrepartie en base est `recipes_titre_non_vide`
 * (`20260801124553`), et l'accord entre les deux est **mesuré** par
 * `supabase/tests/contraintes.test.ts`, jamais affirmé.
 */
export function normaliserTitre(saisie: string): string | null {
  return normaliserTexte(saisie, MAX_TITRE);
}

/**
 * La description : une phrase, donc **aplatie** comme le titre.
 *
 * Lui donner des sauts de ligne ferait un second champ multiligne sans besoin,
 * et brouillerait la frontière avec les instructions — qui est précisément ce
 * que le `hint` de l'écran cherche à poser.
 */
export function normaliserDescription(saisie: string): string | null {
  return normaliserTexte(saisie, MAX_DESCRIPTION);
}

/**
 * Les instructions, **mise en forme préservée**.
 *
 * C'est ce qui rend l'AC de la story 3.3 démontrable — « leur mise en forme est
 * préservée à la lecture (retours à la ligne / étapes) ». Si ce champ passait
 * par `normaliserTexte`, ce critère serait perdu à l'écriture, deux stories
 * avant celle qui l'énonce.
 */
export function normaliserInstructions(saisie: string): string | null {
  return normaliserMultiligne(saisie, MAX_INSTRUCTIONS);
}

/** Bornes d'un `integer` Postgres. Au-delà, la base rend `22003`. */
const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

/**
 * La valeur d'un `<input type="number">`, en entier ou `null`.
 *
 * ⚠ **`Number("")` vaut `0`, et c'est le piège de tout champ numérique
 * facultatif.** Vider le champ rend `""` : sans cette fonction, « cuisson »
 * effacée enregistrerait « 0 minute » au lieu de « pas renseigné ». Pour
 * `servings`, `0` est précisément la valeur que `recipes_servings_positif`
 * refuse — l'utilisateur recevrait un message d'erreur pour avoir **effacé** un
 * champ.
 *
 * ⚠ **`parseInt("")` rend `NaN`**, et `JSON.stringify({ servings: NaN })` rend
 * `{"servings":null}` **silencieusement**. Sur une colonne `not null`, c'est un
 * `23502` que rien ne traduit.
 *
 * ⚠ **`type="number"` accepte plus que des chiffres** : « e », « + », « - » et le
 * séparateur décimal local. « 2e3 » est une saisie valide pour le navigateur.
 * D'où le contrôle de forme explicite plutôt qu'un `Number()` nu.
 *
 * `\d` reste ASCII même sous le drapeau `u` — contrairement à `\p{Nd}`. C'est
 * voulu : `Number("٤")` vaut 4, et accepter en silence une forme qu'aucun
 * `<input type="number">` n'émet ouvrirait un chemin que rien n'éprouve.
 *
 * **`0` est RENDU, pas refusé.** Refuser ici mêlerait deux règles : « ce n'est
 * pas un entier » et « une recette pour zéro personne n'a pas de sens ». La
 * seconde appartient à la base et à l'écran — et `cook_time_min` à 0 est
 * parfaitement légitime.
 */
export function normaliserEntier(saisie: string): number | null {
  const net = saisie.trim();
  if (!/^-?\d+$/.test(net)) return null;

  const valeur = Number(net);
  if (!Number.isSafeInteger(valeur)) return null;
  if (valeur < INT_MIN || valeur > INT_MAX) return null;
  return valeur;
}

/**
 * Bornes de `recipe_ingredients.quantity`, qui est un `numeric(8,2)` : huit
 * chiffres significatifs dont deux décimales.
 */
export const QUANTITE_MAX = 999999.99;

/**
 * La plus petite quantité que la colonne sache retenir.
 *
 * ⚠️ **Sous ce seuil, Postgres arrondit à `0.00` — donc la quantité DISPARAÎT.**
 * Mesuré : `0,001` traversait `normaliserQuantite`, passait la garde du négatif,
 * passait `quantity >= 0`, et se relisait « 0 g ». Une réduction reste une
 * réduction ; une réduction **à zéro** est une perte, et l'Epic 4 lira ce zéro
 * comme délibéré (`coalesce(ri.quantity, 0)`). Revue adversariale du 2026-08-03.
 *
 * ⚠️ **Zéro reste une valeur légitime** — « 0 » veut dire « aucune », et la
 * contrainte en base l'autorise (`quantity >= 0`, malgré son nom
 * `..._quantite_positive`). Le refus ne porte que sur l'intervalle ouvert entre
 * les deux.
 */
export const QUANTITE_MIN_NON_NULLE = 0.01;

/**
 * La valeur d'un champ de quantité, en nombre décimal ou `null`.
 *
 * ⚠️ **Distincte de `normaliserEntier`, et pas par commodité.** « 0,5 cuillère »
 * et « 1.5 kg » sont des quantités légitimes ; le prédicat entier `/^-?\d+$/` les
 * refuserait toutes les deux.
 *
 * ⚠️ **La virgule française est acceptée.** Un clavier français produit une
 * virgule, et `Number("0,5")` vaut `NaN` — donc, sans cette conversion, une
 * saisie parfaitement normale serait refusée.
 *
 * ⚠️ **N'ARRONDIT PAS, et c'est une correction.** La première rédaction arrondissait
 * à deux décimales « pour que le client et la base s'accordent ». Mesuré le
 * 2026-08-02, elle les faisait **diverger** : sur un demi exact, Postgres arrondit
 * au plus loin de zéro (`1.005::numeric(8,2)` → **1.01**, `2.675` → **2.68**),
 * là où `Number("1.005").toFixed(2)` rend **1.00** — le flottant valant en réalité
 * 1.00499…. Répliquer l'arithmétique décimale de Postgres en virgule flottante,
 * c'est affirmer un invariant entre deux endroits au lieu de le mesurer ; le
 * projet a déjà payé ça trois fois.
 *
 * La parade est de **n'avoir qu'un seul arrondisseur** : la colonne. `0,333`
 * part tel quel, Postgres stocke `0.33`, et l'écran le relit — la réduction est
 * donc visible, ce qui est le seul point qui comptait vraiment.
 *
 * ⚠️ **Au-delà de `numeric(8,2)`, on refuse** plutôt que de laisser Postgres
 * rendre `22003` — un code que rien ne traduit, donc « Réessaie » en boucle sur
 * une saisie que retenter à l'identique ne corrigera jamais.
 *
 * **Le négatif est RENDU, pas refusé.** « Ce n'est pas un nombre » est une règle
 * de forme ; « une quantité négative n'a pas de sens » est une règle métier, et
 * elle vit dans `recipe_ingredients_quantite_positive`. Même partage que pour
 * `normaliserEntier` et le zéro.
 *
 * `\d` reste ASCII même sous le drapeau `u` : `Number("٤")` vaut 4, et accepter
 * en silence une forme qu'aucun clavier du produit n'émet ouvrirait un chemin que
 * rien n'éprouve.
 */
export function normaliserQuantite(saisie: string): number | null {
  const net = saisie.trim().replace(",", ".");
  // Une partie entière et/ou une partie décimale, l'une des deux au moins.
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(net)) return null;

  const valeur = Number(net);
  if (!Number.isFinite(valeur)) return null;
  if (valeur > QUANTITE_MAX || valeur < -QUANTITE_MAX) return null;

  return valeur;
}

/**
 * Ce que vaut une saisie de quantité NON VIDE, ou **pourquoi** elle est refusée.
 *
 * ⚠️ **Séparée de `normaliserQuantite`, et c'est tout le point.** Celle-ci rend
 * `null` aussi bien pour « deux » que pour « 1000000 » — deux situations que
 * l'écran confondait, en répondant « Une quantité s'écrit en chiffres. » à
 * quelqu'un qui venait précisément d'en écrire une. Un conseil qui ne peut pas
 * fonctionner enferme l'utilisateur dans une boucle, ce que `project-context.md`
 * interdit nommément. Revue adversariale du 2026-08-03, décision de Florian.
 *
 * `normaliserQuantite` est CONSERVÉE telle quelle : elle a d'autres appelants et
 * son contrat — « rends un nombre ou rien » — reste juste. Celle-ci dit *pourquoi*.
 *
 * ⚠️ **La frontière reste APPLICATIVE, et c'est un écart assumé à AD-1/AD-2.**
 * Aucune contrainte en base ne porte ces bornes : `quantity >= 0` est tout ce que
 * `recipe_ingredients_quantite_positive` dit. Un appel REST direct pose donc
 * toujours ce qu'il veut. Poser la contrainte demanderait une migration sur une
 * table de production ; ce n'est pas ce qui a été décidé le 2026-08-03 — c'est
 * consigné dans `deferred-work.md` avec les autres champs non bornés.
 */
export type QuantiteAnalysee =
  | { valeur: number }
  | { faute: "illisible" | "hors-bornes" | "trop-petite" | "negative" };

export function analyserQuantite(brut: string): QuantiteAnalysee {
  const net = brut.trim().replace(",", ".");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(net)) return { faute: "illisible" };

  const valeur = Number(net);
  if (!Number.isFinite(valeur)) return { faute: "illisible" };
  if (valeur < 0) return { faute: "negative" };
  if (valeur > QUANTITE_MAX) return { faute: "hors-bornes" };
  if (valeur !== 0 && valeur < QUANTITE_MIN_NON_NULLE) {
    return { faute: "trop-petite" };
  }
  return { valeur };
}

/** Les cinq groupes d'un uuid canonique. Insensible à la casse. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vrai si la chaîne a la forme d'un uuid.
 *
 * ⚠ **Ce n'est PAS un contrôle de sécurité** — la RLS l'est, et elle seule.
 * C'est un contrôle de *forme*, et il existe pour une raison précise :
 * `/recettes/pizza/modifier` envoie « pizza » à PostgREST, qui rend `22P02`
 * (`invalid_text_representation`). Aucune traduction n'existe pour ce code, donc
 * l'écran afficherait « Ça n'a pas marché. Réessaie dans un instant. » — un
 * conseil **qui ne peut pas fonctionner**, puisque l'URL sera toujours aussi
 * fausse au deuxième essai. Le produit interdit explicitement « Réessaie » sur
 * une condition non transitoire.
 *
 * Volontairement **strict sur la forme canonique** plutôt que permissif : une
 * URL est soit celle qu'on a produite, soit une saisie fautive. Aucun chemin du
 * produit n'émet d'uuid sans tirets ni entre accolades.
 */
export function estUuid(valeur: string): boolean {
  return UUID.test(valeur);
}
