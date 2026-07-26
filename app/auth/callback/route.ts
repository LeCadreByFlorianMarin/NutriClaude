import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Retour du lien de connexion reçu par email.
 *
 * On vérifie un `token_hash` (`verifyOtp`), et **non** un `?code=` PKCE
 * (`exchangeCodeForSession`) : le flux PKCE stocke son vérificateur dans le
 * navigateur qui a demandé le lien, donc un lien demandé sur l'ordinateur et
 * ouvert sur le téléphone échouerait. C'est un parcours normal du foyer, pas
 * un cas limite.
 *
 * Corollaire : les deux modèles d'email du tableau de bord Supabase doivent
 * pointer ici, avec `type` écrit en dur dans chacun —
 * `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink` pour « Magic
 * Link », `…&type=signup` pour « Confirm sign up ». Une première connexion
 * déclenche une inscription, donc le second modèle, pas le premier.
 */

/** Les deux seuls types de lien que nous émettons. */
const ACCEPTED_TYPES = ["magiclink", "signup"] as const;

/**
 * `EmailOtpType` se termine par `(string & {})` : TypeScript accepterait
 * n'importe quelle chaîne venue de l'URL. Le contrôle doit être explicite.
 */
function isAcceptedType(value: string | null): value is (typeof ACCEPTED_TYPES)[number] {
  return value !== null && (ACCEPTED_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // `next` revient de l'extérieur : revalidé ici, jamais pris pour argent comptant.
  const next = safeNext(searchParams.get("next"));

  const { supabase, applyAuthHeaders } = await createRouteHandlerClient();

  /**
   * Lien expiré, déjà consommé, tronqué ou forgé : un code, jamais le message
   * technique de Supabase (NFR-8). L'écran de connexion le traduit et offre
   * d'en redemander un.
   */
  const rejected = () =>
    applyAuthHeaders(
      NextResponse.redirect(new URL("/login?error=lien-expire", origin))
    );

  if (!tokenHash || !isAcceptedType(type)) return rejected();

  // `verifyOtp` ne lève pas en cas d'échec : il retourne `{ error }`. Un simple
  // `try/catch` ne verrait rien passer.
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return rejected();

  return applyAuthHeaders(NextResponse.redirect(new URL(next, origin)));
}
