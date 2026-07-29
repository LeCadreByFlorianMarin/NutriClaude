import type { ReactNode } from "react";

/**
 * Écran plein qui ne dit qu'une chose : un titre, une explication, une sortie.
 *
 * Quatre copies de cette structure existaient (`error`, `not-found`,
 * `auth/bascule` × 2), avec deux largeurs différentes et trois habillages de
 * bouton — divergences nées de la recopie, pas d'une intention.
 *
 * `action` est un nœud plutôt qu'un couple libellé/href : ces écrans ont besoin
 * tantôt d'un `<Link>`, tantôt d'un `<button>`, tantôt d'une ancre nue qu'il ne
 * faut surtout pas précharger.
 */
export function EcranMessage({
  titre,
  titreRef,
  role,
  children,
  action,
  secondaire,
}: {
  titre: string;
  /** Pour déplacer le focus sur le titre quand l'écran remplace le précédent. */
  titreRef?: React.Ref<HTMLHeadingElement>;
  role?: "alert";
  children?: ReactNode;
  action?: ReactNode;
  secondaire?: ReactNode;
}) {
  return (
    <main className="ecran-centre" role={role}>
      <div className="max-w-sm text-center">
        <h1 ref={titreRef} tabIndex={titreRef ? -1 : undefined} className="titre-ecran">
          {titre}
        </h1>
        {children ? <div className="mt-3 text-base">{children}</div> : null}
        {action ? <div className="mt-6">{action}</div> : null}
        {secondaire ? <div className="mt-3">{secondaire}</div> : null}
      </div>
    </main>
  );
}
