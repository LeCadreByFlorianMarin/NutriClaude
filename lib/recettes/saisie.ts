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

/* ═══ Quantité : ré-export ══════════════════════════════════════════════════
 *
 * ⚠️ **Ces quatre-là ont DÉMÉNAGÉ vers `lib/quantite.ts` le 2026-08-16** (story 4.4),
 * parce qu'un écran de courses en a besoin et qu'une règle de quantité n'est pas une
 * règle de recette. Le ré-export existe pour ne casser aucun appelant existant.
 *
 * ⛔ **Les NOUVEAUX appelants importent depuis `@/lib/quantite`.** Rien d'automatique
 * ne défend cette consigne — c'est la même dette que le ré-export de `formaterQuantite`,
 * et elle se referme le jour où le dernier appelant historique migre.
 */
export {
  QUANTITE_MAX,
  QUANTITE_MIN_NON_NULLE,
  normaliserQuantite,
  analyserQuantite,
  type QuantiteAnalysee,
} from "../quantite.ts";
