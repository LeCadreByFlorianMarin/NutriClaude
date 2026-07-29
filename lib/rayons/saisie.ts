import { INVISIBLES_HORS_JOINTURE, normaliserTexte } from "../texte.ts";

/**
 * Longueur maximale d'un nom de rayon. Plus courte que celle d'un nom de foyer
 * (60) : un nom de rayon s'affiche en eyebrow capitales dans l'en-tête d'une
 * carte, sur un téléphone tenu à une main.
 */
export const MAX_NOM_RAYON = 40;

/** Rend le nom nettoyé et borné, ou `null` s'il ne reste rien d'affichable. */
export function normaliserNomRayon(saisie: string): string | null {
  return normaliserTexte(saisie, MAX_NOM_RAYON);
}

/**
 * Rend le **premier grapheme** de la saisie, ou `null` s'il n'y en a pas.
 *
 * ⚠️ **Ne borne pas avec `slice(0, 1)` ni `maxLength={1}`.** Les deux comptent
 * des unités UTF-16, pas des caractères perçus : 🥬 en occupe 2, un drapeau 4,
 * un emoji à modificateur de teinte jusqu'à 7. Couper à une unité rend une
 * demi-paire de substitution, stockée telle quelle et affichée en carré blanc.
 *
 * ⚠️ **N'emploie pas `normaliserTexte` non plus.** Sa plage d'invisibles couvre
 * U+200D (ZWJ), qui est porteur de sens ici : 🧑‍🍳 s'écrit 🧑 + ZWJ + 🍳, et le
 * retirer laisserait deux graphemes dont on ne garderait que le premier — 🧑.
 * D'où `INVISIBLES_HORS_JOINTURE`, qui retire l'espace de largeur nulle collé
 * par un copier-coller sans démembrer la séquence.
 *
 * `Intl.Segmenter` est natif (Node 24, tous navigateurs cibles) : aucune
 * dépendance à ajouter, ce que NFR-10 exige.
 */
export function normaliserIcone(saisie: string): string | null {
  const net = saisie.replace(INVISIBLES_HORS_JOINTURE, "").trim();
  if (net === "") return null;

  const segments = new Intl.Segmenter("fr", { granularity: "grapheme" });
  const premier = segments.segment(net)[Symbol.iterator]().next();
  return premier.done ? null : premier.value.segment;
}

/**
 * La position d'un rayon nouvellement créé : après tous les autres.
 *
 * ⚠️ **Ne laisse jamais le défaut de la colonne faire ce travail.**
 * `aisles.sort_order` vaut `100` par défaut, et 100 est **déjà pris** par
 * « Hygiène & Entretien » dans le jeu amorcé — un rayon créé sans calcul
 * atterrirait au milieu du parcours, ex æquo avec un rayon existant.
 *
 * Le pas de 10 laisse de la place pour insérer à la main entre deux rayons ;
 * c'est déjà l'écart du jeu par défaut. Sur un foyer amorcé, le premier rayon
 * créé vaut donc 1009, c'est-à-dire **après « Autre » (999)** : c'est la lecture
 * littérale de « en fin de parcours », et la story 2.2 rendra le déplacement
 * trivial.
 *
 * `sort_order` n'est pas unique en base : deux rayons peuvent légalement
 * partager une position, d'où le tri secondaire par nom dans `rayonsDuFoyer`.
 */
export function prochainOrdre(rayons: ReadonlyArray<{ ordre: number }>): number {
  // `Math.max()` sur une liste vide rend -Infinity, pas 0.
  if (rayons.length === 0) return 10;
  return Math.max(...rayons.map((r) => r.ordre)) + 10;
}
