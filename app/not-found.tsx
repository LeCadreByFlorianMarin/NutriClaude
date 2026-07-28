import Link from "next/link";
import { EcranMessage } from "@/app/_lib/EcranMessage";

export const metadata = { title: "Page introuvable · NutriClaude" };

/**
 * Page introuvable.
 *
 * ⚠️ **Invisible aux visiteurs anonymes, et c'est normal.** Le proxy passe
 * avant le routage : une adresse inconnue sans session part sur
 * `/login?next=…`, comme n'importe quelle route protégée. Il faut être
 * connecté pour arriver ici. Ne pas « réparer » ça en ouvrant les routes
 * inconnues dans le proxy — ce serait affaiblir le contrôle d'accès pour
 * embellir un écran d'erreur.
 *
 * Le lien est en `.btn-primaire` : c'est la seule action de l'écran — le
 * « chemin de sortie » qu'exige l'AC3 — et `.btn-quiet` s'annonce lui-même
 * « jamais l'action principale ».
 */
export default function NotFound() {
  return (
    <EcranMessage
      titre="Il n'y a rien ici."
      action={
        <Link href="/" className="btn-primaire w-full">
          Revenir chez toi
        </Link>
      }
    >
      Cette adresse ne mène nulle part.
    </EcranMessage>
  );
}
