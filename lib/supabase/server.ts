import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur, pour les Server Components, Route Handlers et
 * Server Actions. En Next 16, `cookies()` est asynchrone : cette fabrique l'est
 * donc aussi, et tout appelant doit faire `await createClient()`.
 *
 * Les Server Actions restent réduites à l'irréductible serveur (AD-13) :
 * callback magic-link, émission de jetons d'appareil et d'invitations.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Le second paramètre porte les en-têtes anti-cache. Un Server Component
        // ne peut pas écrire d'en-têtes de réponse : on l'ignore ici, c'est le
        // proxy qui les applique (voir lib/supabase/proxy.ts).
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component : sans effet, le rafraîchissement
            // de session est assuré par le proxy.
          }
        },
      },
    }
  );
}
