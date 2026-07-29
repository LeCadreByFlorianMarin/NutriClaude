import { safeNext } from "./safe-next.ts";

/**
 * Construit le lien qui confirme une bascule de compte sur un appareil partagé.
 *
 * **C'est une décision de sécurité, et elle vivait dans du JSX.** Trois choses
 * s'y jouent :
 *  - un lien incomplet ou forgé ne doit **pas** produire d'écran de
 *    confirmation crédible — d'où `null`, que l'appelant rend comme « ce lien
 *    n'est plus bon » ;
 *  - `next` revient de l'extérieur et repasse par `safeNext`. Il est le seul
 *    paramètre optionnel : absent, il vaut `/`, et exiger sa présence casserait
 *    le cas nominal ;
 *  - `confirme=1` doit toujours être posé. Sans lui, `/auth/callback` renvoie à
 *    nouveau vers `/auth/bascule` et l'utilisateur tourne en rond.
 *
 * Rend une query string (`?token_hash=…`), prête à concaténer.
 */
export function lienDeConfirmation(params: {
  token_hash?: string;
  type?: string;
  next?: string;
}): string | null {
  const { token_hash, type, next } = params;
  if (!token_hash || !type) return null;

  const q = new URLSearchParams({
    token_hash,
    type,
    next: safeNext(next),
    confirme: "1",
  });
  return `?${q}`;
}
