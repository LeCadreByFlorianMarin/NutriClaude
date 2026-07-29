/**
 * Distinguer « Supabase dit non » de « Supabase ne répond pas ».
 *
 * C'est la distinction dont dépend NFR-1 : le hors-ligne est un mode nominal,
 * pas une erreur. Confondre les deux déconnecte tout le foyer à chaque incident.
 *
 * Ces primitives sont ici, sans aucun import, parce que le proxy **et** la
 * couche données en ont besoin toutes les deux — et parce qu'elles se testent
 * alors sans Next, sans Supabase et sans attendre trois secondes.
 */

/** Délai au-delà duquel on renonce à vérifier la session auprès de Supabase. */
export const AUTH_TIMEOUT_MS = 3000;

/**
 * Résultat d'une course perdue par la promesse utile.
 *
 * `unique symbol` et non `symbol` : c'est ce qui permet à TypeScript de réduire
 * l'union après un `=== TIMEOUT`, donc de savoir que ce qui reste est bien une
 * réponse Supabase. Un sentinelle-chaîne n'offrirait pas cette garantie et
 * pourrait entrer en collision avec une valeur légitime.
 */
export const TIMEOUT: unique symbol = Symbol("timeout");

/**
 * Course entre une promesse et un délai, **qui nettoie derrière elle**.
 *
 * `Promise.race` abandonne le perdant mais ne l'annule pas : sans le
 * `clearTimeout`, chaque appel rapide laissait un timer armé pour toute sa
 * durée, ce qui maintient la boucle d'événements vivante et prolonge d'autant
 * la facturation d'une invocation serverless.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Vrai si l'erreur traduit un échec de transport réessayable, et non un refus.
 *
 * ⚠️ `AuthRetryableFetchError` est un nom de classe **interne à `@supabase/auth-js`**.
 * S'il change dans une version mineure, le mode hors-ligne retombe silencieusement
 * en « pas de session ». C'est le prix du seul signal que la librairie expose ;
 * le test associé épingle la chaîne pour qu'une montée de version le fasse voir.
 *
 * Distinct d'un `AuthSessionMissingError` (400), qui signifie réellement
 * « pas de session ».
 */
export function estPanneDeTransport(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AuthRetryableFetchError"
  );
}
