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

/**
 * Types de lien acceptés.
 *
 * `email` figure ici **sans être émis par nos modèles** : c'est la valeur des
 * modèles Supabase par défaut. Un modèle laissé, restauré ou réinitialisé au
 * défaut depuis le tableau de bord produisait sinon une panne totale de
 * connexion, indiscernable d'un lien expiré pour l'utilisateur comme pour nous.
 * L'accepter coûte une valeur dans une liste ; le refuser coûtait le produit.
 */
const ACCEPTED_TYPES = ["magiclink", "signup", "email"] as const;

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
  const confirme = searchParams.get("confirme") === "1";

  /**
   * Lien expiré, déjà consommé, tronqué ou forgé : un code, jamais le message
   * technique de Supabase (NFR-8). L'écran de connexion le traduit et offre
   * d'en redemander un.
   *
   * `raison` n'atteint jamais l'écran : elle part dans les journaux serveur.
   * Sans elle, une panne de configuration (un modèle d'email revenu au défaut)
   * se présentait exactement comme un lien périmé, et ne laissait aucune trace.
   */
  const redirigerLienExpire = (raison: string) => {
    console.error(`[auth/callback] lien refusé : ${raison}`);
    return NextResponse.redirect(new URL("/login?error=lien-expire", origin));
  };

  /*
   * Tout est enveloppé : `verifyOtp` ne lève pas en cas d'échec métier — il rend
   * `{ error }` — mais l'écriture des cookies, elle, peut lever (contexte en
   * lecture seule, cookie découpé trop volumineux). Sans ce filet, l'exception
   * s'échappait du handler et Next servait sa page 500 en anglais : exactement
   * ce que la mécanique de rejet existe pour éviter (NFR-8), sur le seul chemin
   * qui ouvre une session.
   */
  try {
    const { supabase, applyAuthHeaders } = await createRouteHandlerClient();

    if (!tokenHash) return applyAuthHeaders(redirigerLienExpire("token_hash absent"));
    if (!isAcceptedType(type)) {
      return applyAuthHeaders(redirigerLienExpire(`type non accepté : ${type}`));
    }

    /*
     * Appareil partagé : une session est déjà ouverte, et le lien appartient à
     * quelqu'un d'autre. C'est le scénario de la tablette de cuisine. Vérifier
     * l'OTP maintenant écraserait la session en place sans que personne ne le
     * voie — on demande d'abord confirmation.
     *
     * Le jeton n'est PAS consommé sur ce chemin : l'écran de confirmation
     * renvoie ici avec `confirme=1`, et c'est seulement là que `verifyOtp`
     * s'exécute. Un jeton brûlé par une simple demande de confirmation serait
     * pire que le défaut qu'on corrige.
     */
    if (!confirme) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const url = new URL("/auth/bascule", origin);
        url.searchParams.set("token_hash", tokenHash);
        url.searchParams.set("type", type);
        url.searchParams.set("next", next);
        return applyAuthHeaders(NextResponse.redirect(url));
      }
    }

    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return applyAuthHeaders(redirigerLienExpire(error.message));
    }

    return applyAuthHeaders(NextResponse.redirect(new URL(next, origin)));
  } catch (cause) {
    // Le client n'a pas pu être construit, ou l'écriture du cookie a échoué :
    // sans client, pas d'en-têtes anti-cache à appliquer — mais la réponse ne
    // porte alors aucun cookie de session, donc rien à protéger du cache.
    return redirigerLienExpire(
      `exception : ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}
