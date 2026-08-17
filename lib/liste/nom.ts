import { normaliserTexte } from "../texte.ts";

/**
 * Longueur maximale d'un nom d'article.
 *
 * ⚠️ **200, et c'est la contrainte `grocery_list_items_nom_borne` qui fait foi.**
 * Volontairement PLUS LARGE que le nom de rayon (40) : un rayon s'affiche en
 * eyebrow capitales dans un en-tête de carte, un article s'affiche sur une ligne
 * qui sait s'enrouler (`min-w-0 flex-1 break-words`, mesuré à 390/360/320 px).
 *
 * ⚠️ **Elle compte des POINTS DE CODE, pas des unités UTF-16** — c'est
 * `normaliserTexte` qui s'en charge. Couper à l'unité rendrait une demi-paire de
 * substitution sur un nom contenant un emoji.
 */
export const MAX_NOM_ARTICLE = 200;

/**
 * Rend le nom d'article nettoyé et borné, ou `null` s'il ne reste rien d'affichable.
 *
 * ⛔ **ELLE NE RECALCULE PAS LA CLÉ CANONIQUE, ET C'EST LE POINT LE PLUS IMPORTANT
 * DE CE FICHIER.** La clé `(household_id, nom normalisé, unité)` vit dans
 * l'EXPRESSION de l'index `grocery_list_items_cle_canonique`, côté serveur. En
 * écrire un miroir applicatif serait une seconde source de vérité, ce qu'AD-1 et
 * AD-6 refusent — et `deferred-work.md` le dit nommément pour cette story.
 *
 * **Les deux ne font pas le même travail, et il ne faut pas les confondre :**
 *
 * | | Cette fonction | L'expression de l'index |
 * |---|---|---|
 * | Rôle | rendre une saisie **stockable et affichable** | décider si deux articles sont **le même** |
 * | Sort | le texte qu'on **écrit** dans `name` | rien — elle n'existe qu'à l'intérieur de l'index |
 * | Plie les accents | **non** — « Crème » reste « Crème » | oui |
 * | Plie la casse | **non** | oui |
 * | Retire les espaces | non, elle rogne les bords | oui, tous |
 *
 * ⚠️ **Le nom du membre n'est JAMAIS réécrit par la normalisation de la clé.**
 * « Crème fraîche » se stocke et se réaffiche « Crème fraîche » ; c'est seulement
 * pour DÉCIDER de l'égalité que le serveur le plie en `cremefraiche`.
 *
 * ⚠️ **`normaliserTexte` retire les invisibles, compose en NFC et rogne les bords.**
 * La forme NFC compte : sans elle, « crème » composé et décomposé feraient deux
 * lignes — le défaut exact que `lib/texte.ts` documente pour les rayons.
 */
export function normaliserNomArticle(saisie: string): string | null {
  return normaliserTexte(saisie, MAX_NOM_ARTICLE);
}
