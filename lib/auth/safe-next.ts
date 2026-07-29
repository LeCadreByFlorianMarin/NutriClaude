/**
 * Validation de la destination de retour après connexion.
 *
 * Le paramètre `next` est posé par le proxy (`/login?next=/menu`), puis il
 * traverse l'email et **revient de l'extérieur** dans l'URL de `/auth/callback`.
 * Il est donc hostile par construction : `/login?next=https://evil.com` doit
 * rester sans effet. C'est exactement le trou que le prototype laissait ouvert
 * (`LoginForm.tsx:11`, `router.replace(next)` sans le moindre contrôle).
 *
 * Seul un chemin relatif à une seule barre oblique est accepté. Sont rejetés :
 *  - les URL absolues (`https://evil.com`, `//evil.com` protocol-relative) ;
 *  - `/\evil.com`, que plusieurs navigateurs normalisent en `//evil.com`.
 */
const CHEMIN_LOCAL = /^\/(?![/\\])/;

/**
 * Tabulation, saut de ligne et retour chariot, que le parseur d'URL **retire
 * avant de parser**. Les tester tels quels ne sert à rien : `/⇥/evil.com` passe
 * un contrôle « une seule barre oblique », puis `new URL()` le voit comme
 * `//evil.com` et le résout en `https://evil.com/`. On normalise donc la chaîne
 * comme le parseur la verra, et c'est cette forme-là qu'on renvoie.
 */
const IGNORES_PAR_LE_PARSEUR = /[\t\n\r]/g;

export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  const normalise = value.replace(IGNORES_PAR_LE_PARSEUR, "");
  return CHEMIN_LOCAL.test(normalise) ? normalise : "/";
}
