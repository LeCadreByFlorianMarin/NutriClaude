/**
 * Résolution d'une clé de message vers son texte français.
 *
 * ⚠️ **`table[cle]` sur un objet littéral n'est pas sûr.** Les clés viennent
 * d'un paramètre d'URL (`/login?error=…`) ou d'une réponse serveur : indexer
 * directement rend `Object.prototype` pour `"__proto__"` et une fonction pour
 * `"constructor"` ou `"toString"`. Ces valeurs étant *truthy*, un repli écrit
 * `table[cle] ?? table.echec` ne se déclenche pas — et React lève sur le rendu
 * (« Objects are not valid as a React child ». L'écran de connexion tombait
 * ainsi sur une simple URL forgée.
 *
 * `Object.hasOwn` ferme la porte : seules les clés réellement déclarées passent.
 */
export function messageDe<T extends Record<string, string>>(
  table: T,
  cle: string | undefined,
  repli: keyof T
): string | undefined {
  if (cle === undefined) return undefined;
  return Object.hasOwn(table, cle) ? table[cle] : table[repli];
}
