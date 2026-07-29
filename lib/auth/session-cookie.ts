/**
 * Reconnaissance d'un cookie de session Supabase, par son nom.
 *
 * Isolé du proxy pour une raison précise : c'est le prédicat qui décide, pendant
 * une panne Supabase, qui franchit le contrôle d'accès. Ici, il n'importe rien —
 * ni Next, ni `@supabase/ssr` — donc il se teste sans le moindre faux.
 *
 * Le nom du cookie est `sb-<ref>-auth-token`, éventuellement découpé en `.0`,
 * `.1` quand le jeton dépasse la taille maximale d'un cookie.
 *
 * L'ancrage aux deux bouts est le point : un `includes("auth-token")` capture
 * aussi `sb-<ref>-auth-token-code-verifier`, que `signInWithOtp` écrit dès la
 * *demande* de lien. Un navigateur qui n'a jamais terminé de connexion serait
 * alors traité comme porteur de session.
 *
 * ⚠️ Ce prédicat ne lit que le **nom**, jamais la valeur : il ne prouve donc
 * aucune authentification et n'est pas un contrôle de sécurité. Il ne sert qu'à
 * distinguer « probablement un membre, Supabase est injoignable » de « visiteur
 * anonyme ». L'autorité reste la RLS (AD-2).
 */
const COOKIE_DE_SESSION = /^sb-.+-auth-token(\.\d+)?$/;

export function estCookieDeSession(nom: string): boolean {
  return COOKIE_DE_SESSION.test(nom);
}
