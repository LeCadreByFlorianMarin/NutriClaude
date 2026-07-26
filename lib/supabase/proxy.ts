import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Seules routes accessibles sans être authentifié, en correspondance **exacte**.
 * Pas de correspondance par préfixe : un `/login/<quoi-que-ce-soit>` reste protégé.
 */
const PUBLIC_ROUTES = ["/login", "/auth/callback"];

/** Délai au-delà duquel on renonce à vérifier la session auprès de Supabase. */
const AUTH_TIMEOUT_MS = 3000;

/** Vrai si la requête porte un cookie de session Supabase (`sb-<ref>-auth-token`). */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

/**
 * Rafraîchit la session Supabase et applique le contrôle d'accès du foyer.
 *
 * Trois points à ne pas « simplifier » :
 *  1. `supabaseResponse` est reconstruit APRÈS la mutation de `request.cookies`.
 *     Sans cela, le rafraîchissement de session casse et les membres se
 *     retrouvent déconnectés au hasard.
 *  2. Les cookies et en-têtes posés par `setAll` sont recopiés sur **toute**
 *     réponse, redirections comprises (voir `withSessionState`). Une redirection
 *     qui les perd fait consommer un refresh token sans le remplacer, ce qui
 *     déconnecte silencieusement le membre à la requête suivante.
 *  3. Les en-têtes fournis par `setAll` interdisent la mise en cache CDN d'une
 *     réponse porteuse de cookie d'auth — sans eux, la session d'un membre peut
 *     être servie à un autre (NFR-5).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  /**
   * Reporte sur `response` l'état de session accumulé par `setAll` : cookies
   * rotés ou effacés, et en-têtes anti-cache. À appliquer sur toute réponse
   * retournée, sinon cet état est perdu.
   */
  function withSessionState(response: NextResponse): NextResponse {
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    supabaseResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") response.headers.set(key, value);
    });
    return response;
  }

  // Ne rien intercaler entre createServerClient et getUser().
  //
  // `cannotVerify` distingue « pas de session » de « pas pu vérifier ». Une
  // panne Supabase se présente sous TROIS formes distinctes, et les trois
  // doivent mener au même traitement :
  //   1. l'appel pend            → tranché par le Promise.race ci-dessous ;
  //   2. l'appel échoue vite     → `getUser()` ne lève PAS, il retourne
  //      `{ user: null, error: AuthRetryableFetchError }`. Sans le test sur
  //      l'erreur, ce cas serait lu comme « pas de session » et déconnecterait
  //      tout le foyer à chaque panne ;
  //   3. l'appel lève            → capturé par le catch.
  let user = null;
  let cannotVerify = false;
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), AUTH_TIMEOUT_MS)
      ),
    ]);
    if (result === "timeout") {
      cannotVerify = true;
    } else {
      user = result.data.user;
      // `AuthRetryableFetchError` = échec de transport réessayable. Distinct d'un
      // `AuthSessionMissingError` (400), qui signifie réellement « pas de session ».
      if (!user && result.error?.name === "AuthRetryableFetchError") {
        cannotVerify = true;
      }
    }
  } catch {
    cannotVerify = true;
  }

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  /**
   * Session non vérifiable (Supabase injoignable ou trop lent). Le hors-ligne
   * est un mode nominal, pas une erreur (NFR-1) : on laisse passer si un cookie
   * de session existe. Ce n'est pas un contournement — la RLS reste l'unique
   * autorité (AD-2), donc aucune donnée n'est accessible avec un jeton invalide.
   * Sans cookie, en revanche, rien ne justifie de laisser entrer.
   */
  if (cannotVerify) {
    if (hasSessionCookie(request) || isPublic) return supabaseResponse;
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return withSessionState(NextResponse.redirect(url));
  }

  // Pas de session sur une route protégée → vers la connexion, destination
  // conservée. L'URL est construite à neuf : un `clone()` traînerait la query
  // string d'origine sur la page de connexion.
  if (!user && !isPublic) {
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return withSessionState(NextResponse.redirect(url));
  }

  // Session valide sur une page d'authentification → retour à l'accueil.
  // `/auth/callback` est exempté : il doit rester joignable pour l'échange de code.
  if (user && isPublic && pathname !== "/auth/callback") {
    const url = new URL("/", request.nextUrl.origin);
    return withSessionState(NextResponse.redirect(url));
  }

  return supabaseResponse;
}
