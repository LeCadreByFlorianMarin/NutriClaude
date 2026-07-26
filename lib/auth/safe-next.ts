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
const RELATIVE_PATH = /^\/(?![/\\])/;

export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  return RELATIVE_PATH.test(value) ? value : "/";
}
