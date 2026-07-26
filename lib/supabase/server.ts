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

/**
 * Client Supabase pour un **Route Handler**, qui lui peut écrire des en-têtes de
 * réponse — contrairement au Server Component servi par `createClient()`.
 *
 * C'est toute la raison d'être de cette seconde fabrique : `/auth/callback` est
 * la réponse qui **pose le cookie de session**, et une telle réponse ne doit
 * jamais être mise en cache par un CDN, sinon la session d'un membre peut être
 * servie à un autre (NFR-5). Les en-têtes qui l'interdisent sont fournis par le
 * 2ᵉ paramètre de `setAll` — on les capture ici pour les reporter sur la
 * réponse via `applyAuthHeaders`, au lieu de les écrire en dur.
 *
 * ⚠️ Toute réponse retournée par le Route Handler doit passer par
 * `applyAuthHeaders`, **redirections comprises** : un `NextResponse.redirect`
 * neuf n'hérite de rien.
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  const authHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Pas de `try/catch` ici, volontairement : dans un Route Handler
        // l'écriture de cookie est légitime, et l'avaler masquerait une vraie
        // défaillance du seul chemin qui ouvre une session.
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
          Object.assign(authHeaders, headers);
        },
      },
    }
  );

  function applyAuthHeaders<T extends { headers: Headers }>(response: T): T {
    Object.entries(authHeaders).forEach(([key, value]) =>
      response.headers.set(key, value)
    );
    return response;
  }

  return { supabase, applyAuthHeaders };
}
