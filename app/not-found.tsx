import Link from "next/link";

/**
 * Page introuvable.
 *
 * ⚠️ **Invisible aux visiteurs anonymes, et c'est normal.** Le proxy passe
 * avant le routage : une adresse inconnue sans session part sur
 * `/login?next=…`, comme n'importe quelle route protégée. Il faut être
 * connecté pour arriver ici. Ne pas « réparer » ça en ouvrant les routes
 * inconnues dans le proxy — ce serait affaiblir le contrôle d'accès pour
 * embellir un écran d'erreur.
 */
export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold">Il n&apos;y a rien ici.</h1>
        <p className="mt-3 text-base">Cette adresse ne mène nulle part.</p>
        <p className="mt-6">
          <Link href="/" className="btn-quiet">
            Revenir chez toi
          </Link>
        </p>
      </div>
    </main>
  );
}
