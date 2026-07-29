import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import type { Database } from "./types";
import { NextResponse, type NextRequest } from "next/server";
import { estCookieDeSession } from "../auth/session-cookie";
import { safeNext } from "../auth/safe-next";
import {
  AUTH_TIMEOUT_MS,
  TIMEOUT,
  estPanneDeTransport,
  withTimeout,
} from "../auth/panne";

/**
 * Seules routes accessibles sans être authentifié, en correspondance **exacte**.
 * Pas de correspondance par préfixe : un `/login/<quoi-que-ce-soit>` reste protégé.
 */
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/bascule"];

/**
 * Écrans d'entrée : un membre déjà connecté n'y a rien à faire.
 *
 * Distinct de `PUBLIC_ROUTES`, qui répond à une autre question — « joignable
 * sans session ? ». Les confondre imposait une exception codée en dur pour
 * `/auth/callback`, qui est publique mais doit rester joignable connecté.
 */
const AUTH_ENTRY_ROUTES = ["/login"];

/** Vrai si la requête porte un cookie de session Supabase. */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => estCookieDeSession(c.name));
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
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
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
  //   1. l'appel pend            → tranché par `withTimeout` ci-dessous ;
  //   2. l'appel échoue vite     → `getUser()` ne lève PAS, il retourne
  //      `{ user: null, error: AuthRetryableFetchError }`. Sans le test sur
  //      l'erreur, ce cas serait lu comme « pas de session » et déconnecterait
  //      tout le foyer à chaque panne ;
  //   3. l'appel lève            → capturé par le catch.
  let user = null;
  let cannotVerify = false;
  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS);
    if (result === TIMEOUT) {
      cannotVerify = true;
    } else {
      user = result.data.user;
      if (!user && estPanneDeTransport(result.error)) {
        cannotVerify = true;
      }
    }
  } catch {
    cannotVerify = true;
  }

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  /**
   * Vers la connexion, destination conservée. L'URL est construite à neuf : un
   * `clone()` traînerait la query string d'origine sur la page de connexion.
   */
  const versConnexion = () => {
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  };

  /**
   * Session non vérifiable (Supabase injoignable ou trop lent). Le hors-ligne
   * est un mode nominal, pas une erreur (NFR-1) : on laisse passer si un cookie
   * de session existe. Ce n'est pas un contournement — la RLS reste l'unique
   * autorité (AD-2), donc aucune donnée n'est accessible avec un jeton invalide.
   * Sans cookie, en revanche, rien ne justifie de laisser entrer.
   */
  if (cannotVerify) {
    if (hasSessionCookie(request) || isPublic) return withSessionState(supabaseResponse);
    return withSessionState(versConnexion());
  }

  // Pas de session sur une route protégée.
  if (!user && !isPublic) return withSessionState(versConnexion());

  /*
   * Session valide sur un écran d'entrée → retour à la destination demandée, ou
   * à l'accueil. Honorer `next` ici évite qu'un membre déjà connecté ouvrant un
   * `/login?next=/foyer` (lien partagé, second onglet) perde sa destination.
   */
  if (user && AUTH_ENTRY_ROUTES.includes(pathname)) {
    const destination = safeNext(request.nextUrl.searchParams.get("next"));
    return withSessionState(
      NextResponse.redirect(new URL(destination, request.nextUrl.origin))
    );
  }

  return withSessionState(supabaseResponse);
}
