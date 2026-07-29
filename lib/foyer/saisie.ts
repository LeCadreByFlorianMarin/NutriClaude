/**
 * Normalisation des saisies libres, avant de les envoyer à la base.
 *
 * Ces fonctions existaient en trois copies inline dans autant de composants.
 * Rassemblées ici, elles sont testables — et il n'y a plus qu'un endroit où
 * corriger le jour où un caractère inattendu passe.
 */

/**
 * Caractères invisibles que `String.prototype.trim()` **ne retire pas** :
 * espace de largeur nulle, liant/antiliant, séparateur de mots, et les marques
 * directionnelles. Ils arrivent en collant depuis une application de messagerie
 * et produisent un prénom qui passe tous les contrôles tout en s'affichant vide.
 */
const INVISIBLES = /[\u200B-\u200F\u2060\uFEFF]/g;

/** Longueurs maximales. Génereuses, mais bornées : un champ libre partagé par
 * tout le foyer et qu'aucun autre membre ne peut corriger ne doit pas pouvoir
 * casser les écrans de chacun. */
export const MAX_PRENOM = 40;
export const MAX_NOM_FOYER = 60;

/**
 * Rend le prénom nettoyé, ou `null` s'il ne reste rien d'affichable.
 * `null` est délibérément distinct de `""` : l'appelant doit décider quoi en
 * faire plutôt que d'envoyer une chaîne vide à la base.
 */
export function normaliserPrenom(saisie: string): string | null {
  const net = saisie.replace(INVISIBLES, "").trim();
  return net === "" ? null : net.slice(0, MAX_PRENOM);
}

/** Même règle pour le nom du foyer, avec sa propre borne. */
export function normaliserNomFoyer(saisie: string): string | null {
  const net = saisie.replace(INVISIBLES, "").trim();
  return net === "" ? null : net.slice(0, MAX_NOM_FOYER);
}

/**
 * Rend le code d'invitation sous la forme exacte que la base compare — elle ne
 * fait ni `upper()` ni `trim()`.
 *
 * `generate_household_invite` n'émet que de l'hexadécimal (`0-9A-F`), ce qui
 * autorise deux corrections sans perte possible : `O` ne peut être qu'un zéro
 * mal lu, `I` et `L` que des uns. On retire par ailleurs tout ce qui n'est pas
 * alphanumérique — un code noté `388B-626A` sur le tableau de la cuisine, ou
 * copié depuis un message avec un point final, est la même chose que `388B626A`.
 * Sans cela, l'écran répondait « Ce code ne correspond à rien. Vérifie ce que tu
 * as saisi. » à quelqu'un qui l'avait correctement recopié.
 */
export function normaliserCode(saisie: string): string {
  return saisie
    .replace(INVISIBLES, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}
