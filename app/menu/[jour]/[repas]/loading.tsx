/**
 * Le squelette de l'écran d'un repas.
 *
 * ⚠️ **SANS CE FICHIER, C'EST LE SQUELETTE DE LA GRILLE QUI S'AFFICHE ICI.** Un
 * `loading.tsx` de segment enveloppe **tous ses enfants**, et `app/menu/` n'a pas
 * de `layout.tsx` : `app/menu/loading.tsx` couvrirait donc cette route, en
 * dessinant sept colonnes de cases devant un écran qui est un formulaire.
 *
 * C'est **exactement** le défaut de la story 3.3, et il avait été affirmé faux en
 * trois endroits avant d'être mesuré : `app/recettes/loading.tsx` couvrait bien
 * `/recettes/[id]`, et le membre voyait le squelette du RÉPERTOIRE avant sa
 * recette. Le motif est désormais écrit quatre fois dans le dépôt.
 *
 * ⚠️ **Les hauteurs et les marges suivent `page.tsx`.** Si l'une bouge, celui-ci
 * doit bouger avec — contrainte que ne tient aucun test, NFR-10 interdisant le
 * harnais de composants.
 *
 * ⚠️ **La couleur porte le contraste, jamais l'animation.** `animate-pulse` est
 * neutralisé par la règle globale de `prefers-reduced-motion` (`globals.css`), qui
 * ramène toute animation à `0.01ms` ; un squelette dont seule l'animation portait
 * le contraste deviendrait alors un aplat invisible.
 *
 * ⚠️ **`bg-gray-200` n'existe pas dans ce projet** — la palette Tailwind par défaut
 * est neutralisée (`--color-*: initial`) et les utilitaires de couleur inconnus
 * échouent **en silence**. `bg-card-border` est un token publié.
 *
 * **Ce qu'on ne cherche PAS à deviner :** combien de recettes sont déjà prévues.
 * Esquisser des lignes dans une case qui sera peut-être vide recréerait le saut de
 * mise en page qu'un squelette existe pour éviter.
 */
function Bloc({ className }: { className: string }) {
  return <span className={`block rounded-md bg-card-border ${className}`} />;
}

export default function ChargementRepas() {
  return (
    <main className="flex-1 p-6" aria-hidden="true">
      <div className="mx-auto w-full max-w-2xl animate-pulse py-6">
        {/* Le lien « ← Mon menu » */}
        <Bloc className="h-11 w-32" />

        {/* « Lundi 3 août · Midi » */}
        <Bloc className="mt-2 h-8 w-64 max-w-full" />

        {/* « Ce qui est prévu » */}
        <Bloc className="mt-8 h-5 w-40" />

        {/* « Mettre une recette » et son formulaire */}
        <Bloc className="mt-12 h-5 w-44" />
        <Bloc className="mt-3 h-4 w-28" />
        <Bloc className="mt-1 h-11 w-full" />
        <Bloc className="mt-4 h-4 w-48" />
        <Bloc className="mt-1 h-11 w-full" />
        <Bloc className="mt-6 h-11 w-full" />
      </div>
    </main>
  );
}
