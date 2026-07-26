import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Convention `proxy` de Next 16 (remplace `middleware`). Le nom de l'export doit
 * être `proxy` : un export encore nommé `middleware` fait échouer le build.
 * Tourne sur le runtime Node.js.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Toutes les requêtes sauf les internes du framework et trois fichiers
     * racine, en correspondance ancrée.
     *
     * Volontairement PAS d'exclusion par extension de fichier : une règle du
     * type `.*\.png$` laisserait passer sans aucun contrôle d'accès toute route
     * dont le chemin finit par une extension d'image — y compris un segment
     * dynamique valant « photo.png ». Les exclusions ci-dessous sont ancrées
     * (`/` de répertoire, `$` de fin) pour qu'un `/robots.txtsecret` ou un
     * `/favicon.icoX` ne s'y glisse pas.
     *
     * Conséquence assumée : les assets servis depuis `public/` traversent le
     * proxy. Quand l'Epic 6 ajoutera le manifeste et les icônes PWA, il devra
     * les exclure explicitement ici, un par un.
     */
    "/((?!_next/static/|_next/image/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)",
  ],
};
