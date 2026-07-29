import { execFileSync } from "node:child_process";

/**
 * Adresse et clés du stack Supabase local, lues à l'exécution.
 *
 * **Rien n'est écrit en dur.** Les clés d'un `supabase start` sont les mêmes sur
 * toutes les installations locales — elles ne sont pas secrètes — mais les
 * recopier ici les figerait, alors que `supabase/config.toml` déplace les ports
 * de ce projet (55321 et suivants, pour ne pas heurter un autre stack local).
 * `supabase status` est la seule source de vérité.
 *
 * **Aucun repli silencieux.** Si le stack n'est pas debout, on lève. Un test
 * d'isolation qui se contente de « passer » quand la base est absente est le
 * pire mode de défaillance possible : la CI reste verte et NFR-5 n'est vérifié
 * par rien. C'est la raison pour laquelle ce fichier ne connaît pas `try`.
 */
export type StackLocal = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function stackLocal(): StackLocal {
  let brut: string;
  try {
    brut = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Stack Supabase local injoignable. Lance `npx supabase start` " +
        "avant `npm run test:isolation`.",
    );
  }

  const etat = JSON.parse(brut) as Record<string, string>;
  const apiUrl = etat.API_URL;
  const anonKey = etat.ANON_KEY;
  const serviceRoleKey = etat.SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "`supabase status` ne rend pas API_URL / ANON_KEY / SERVICE_ROLE_KEY.",
    );
  }

  return { apiUrl, anonKey, serviceRoleKey };
}
