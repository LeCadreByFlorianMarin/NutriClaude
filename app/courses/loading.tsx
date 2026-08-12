/**
 * Le squelette de l'attente du **rendu serveur** de `/courses`.
 *
 * ⛔ **IL NE FAIT PAS DOUBLE EMPLOI AVEC CELUI DE `ListeCourses`, ET LES DEUX
 * SONT DUS.** Ils couvrent deux attentes différentes :
 *
 * - **ce fichier** couvre l'attente du rendu serveur de `page.tsx` — la garde
 *   `requireProfile()`, qui fait un aller-retour d'authentification ;
 * - **le squelette de `ListeCourses`** couvre l'attente de la LECTURE, qui se
 *   produit dans un `useEffect`, donc **après** que la page est rendue et que
 *   celui-ci a déjà disparu.
 *
 * Sans ce fichier, `/courses` afficherait un écran blanc pendant la garde : il
 * n'y a ni `app/loading.tsx` ni `layout.tsx` de segment pour couvrir ce trou.
 * Sans l'autre, l'écran serait vide pendant l'`await` de la liste.
 *
 * ⚠️ **Ça ne se voit qu'au réseau bridé** — en local les deux passent
 * invisibles. C'est la leçon de la story 3.3, écrite dans `app/menu/loading.tsx`.
 *
 * ⚠️ **Il rend le CHROME, pas la liste.** Retour, titre, sous-titre : ce que la
 * page rend elle-même côté serveur. La liste est l'affaire de l'autre squelette,
 * et la dessiner deux fois ferait sauter la mise en page au passage de relais.
 *
 * ⚠️ **`p-screen` (8px) et `max-w-md`, comme `page.tsx`** — recopier `p-6`
 * décalerait tout au moment où le vrai contenu s'installe.
 * ⛔ `bg-gray-200` n'existe pas dans ce projet : la palette par défaut est
 * neutralisée et les utilitaires de couleur inconnus échouent **en silence**.
 */
function Bloc({ className }: { className: string }) {
  return <span className={`block rounded-md bg-card-border ${className}`} />;
}

export default function ChargementCourses() {
  return (
    <main className="flex-1 p-screen" aria-hidden="true">
      <div className="mx-auto w-full max-w-md animate-pulse py-6">
        {/* Le lien « ← Retour » */}
        <Bloc className="h-11 w-24" />

        {/* Le titre d'écran et son sous-titre */}
        <Bloc className="mt-2 h-8 w-40" />
        <Bloc className="mt-1 h-4 w-64 max-w-full" />
      </div>
    </main>
  );
}
