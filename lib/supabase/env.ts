/**
 * Lecture des variables Supabase, avec un échec lisible.
 *
 * Les trois fabriques les lisaient en `process.env.X!`. L'assertion `!` fait
 * taire TypeScript sans rien vérifier : une variable absente ou nommée pour le
 * mauvais environnement Vercel se manifestait par un `supabaseUrl is required`
 * levé **à l'intérieur du proxy**, hors du `try` qui n'entoure que `getUser()`.
 * Conséquence : toutes les routes en 500, `/login` compris, et `app/error.tsx`
 * incapable d'attraper quoi que ce soit — le site entier était inaccessible, pas
 * dégradé.
 *
 * La CI ne l'aurait jamais vu : elle injecte des valeurs factices pour le build.
 * Le seul filet utile est donc un message qui nomme la variable manquante.
 */
function requis(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(
      `Variable d'environnement manquante : ${nom}. ` +
        `Voir docs/configuration.md — sans elle, aucune route ne peut répondre.`
    );
  }
  return valeur;
}

export function supabaseEnv(): { url: string; anonKey: string } {
  return {
    url: requis(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    anonKey: requis(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}
