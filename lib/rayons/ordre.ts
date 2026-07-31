/**
 * Le pur du réordonnancement du parcours : produire une permutation, jamais
 * l'écrire.
 *
 * **Un seul primitif, deux appelants.** Les flèches monter/descendre et le
 * glisser produisent le même objet — la liste complète des identifiants dans
 * leur nouvel ordre — et ne doivent pas avoir deux implémentations qui pourraient
 * diverger. `ordreApresDeplacement` délègue donc à `ordreDeplace`.
 *
 * ⚠️ **Ces fonctions rendent l'ordre COMPLET, jamais un couple à échanger.**
 * `reorder_aisles` renumérote tout le parcours et refuse tout tableau qui ne le
 * couvre pas exactement (sa garde de cardinal). Et l'échange de deux valeurs
 * serait cassé de toute façon : `sort_order` n'est pas unique en base, et
 * échanger deux valeurs égales est un no-op silencieux.
 *
 * ⚠️ **`null` veut dire « n'appelle pas la base »**, pas « erreur ». C'est le
 * cas du bouton en bout de course et du glisser relâché à son point de départ :
 * il ne s'est rien passé, donc il n'y a rien à écrire et rien à annoncer.
 */

export type Sens = "haut" | "bas";

/**
 * Déplace `id` à la position `versIndex`, et rend le nouvel ordre complet.
 *
 * Rend `null` quand rien ne change : identifiant absent, index hors bornes ou
 * non entier, ou rayon déjà à cette place.
 */
export function ordreDeplace(
  rayons: ReadonlyArray<{ id: string }>,
  id: string,
  versIndex: number
): string[] | null {
  const depuis = rayons.findIndex((r) => r.id === id);
  if (depuis === -1) return null;

  if (!Number.isInteger(versIndex)) return null;
  if (versIndex < 0 || versIndex >= rayons.length) return null;
  if (versIndex === depuis) return null;

  const ids = rayons.map((r) => r.id);
  // `splice` puis `splice` : le retrait décale les indices suivants, mais
  // `versIndex` est exprimé dans le référentiel du tableau APRÈS retrait dès
  // qu'on descend — ce qui est exactement ce que produit `indexCibleDuGlisser`,
  // qui compte les centres des AUTRES lignes.
  ids.splice(depuis, 1);
  ids.splice(versIndex, 0, id);
  return ids;
}

/**
 * Un cran vers le haut ou vers le bas. Délègue — ne réécris pas la permutation
 * ici, c'est le genre de duplication qui finit par diverger.
 */
export function ordreApresDeplacement(
  rayons: ReadonlyArray<{ id: string }>,
  id: string,
  sens: Sens
): string[] | null {
  const depuis = rayons.findIndex((r) => r.id === id);
  if (depuis === -1) return null;

  return ordreDeplace(rayons, id, sens === "haut" ? depuis - 1 : depuis + 1);
}

/**
 * La géométrie du glisser, extraite du composant pour être testable.
 *
 * `centresAutres` : les ordonnées des centres des lignes **autres que celle
 * qu'on tire**, dans l'ordre d'affichage. `centreTireY` : le centre courant de
 * la ligne tirée. Le résultat est le nombre de centres **strictement** au-dessus
 * — c'est-à-dire la place que la ligne occupe désormais dans le tableau privé
 * d'elle-même, donc l'index à passer à `ordreDeplace`.
 *
 * ⚠️ **On compare des centres MESURÉS, pas un pas constant.** Une ligne dont le
 * nom passe sur deux lignes est plus haute que ses voisines — la colonne fait
 * ~180px pour un nom qui peut aller à 40 caractères, donc le cas est courant, pas
 * théorique.
 *
 * ⚠️ **Strictement au-dessus, et l'égalité compte.** À centre égal, on ne
 * déplace pas : sinon un frémissement d'un pixel ferait basculer l'index d'avant
 * en arrière, et la liste tremblerait sous le doigt.
 */
export function indexCibleDuGlisser(
  centresAutres: readonly number[],
  centreTireY: number
): number {
  let cible = 0;
  for (const centre of centresAutres) {
    if (centre < centreTireY) cible++;
  }
  return cible;
}
