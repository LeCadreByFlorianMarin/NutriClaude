/**
 * Le squelette de la FICHE recette.
 *
 * **Pourquoi ce fichier existe** — issu de la revue du 2026-08-02, et il corrige une
 * prémisse fausse, pas une omission. La story 3.3 a décidé « aucun `loading.tsx` sur
 * cette route » en s'appuyant sur l'affirmation que `app/recettes/loading.tsx` ne
 * couvrait pas `/recettes/[id]`. **C'est l'inverse, et c'est mesuré** : il n'y a aucun
 * `layout.tsx` sous `app/recettes/`, donc le `loading.tsx` du segment enveloppe tous
 * ses enfants — `.next/server/app/recettes/[id]/page.js` charge bien le module de
 * `app/recettes/loading.tsx`. Sans ce fichier, ouvrir une recette affiche le squelette
 * du RÉPERTOIRE : trois lignes de liste et un champ « Ajouter une recette » qui
 * n'arriveront jamais, puis un saut de mise en page complet — exactement ce qu'un
 * squelette existe pour éviter.
 *
 * ⚠️ **Les hauteurs et les marges suivent `page.tsx`.** Si l'une bouge, celui-ci doit
 * bouger avec — c'est la même contrainte que porte déjà `app/recettes/loading.tsx`, et
 * elle n'est tenue par aucun test (NFR-10 interdit le harnais de composants).
 *
 * ⚠️ **La couleur porte le contraste, jamais l'animation.** `animate-pulse` est
 * neutralisé par la règle globale de `prefers-reduced-motion` (`globals.css`), qui
 * ramène toute animation à `0.01ms`. Un squelette dont seule l'animation portait le
 * contraste deviendrait alors un aplat invisible.
 *
 * ⚠️ **`bg-gray-200` n'existe pas dans ce projet** — la palette Tailwind par défaut est
 * neutralisée (`--color-*: initial`) et les utilitaires de couleur inconnus échouent
 * **en silence**. `bg-card-border` est un token publié.
 *
 * **Ce qu'on ne cherche PAS à deviner :** la description et les instructions sont
 * nullables, les ingrédients peuvent être zéro. Le squelette montre la forme la plus
 * COURANTE — titre, repères, ingrédients — et s'arrête là. Esquisser une section qui
 * n'existera pas recréerait le défaut qu'on répare.
 */
function Bloc({ className }: { className: string }) {
  return <span className={`block rounded-md bg-card-border ${className}`} />;
}

export default function ChargementRecette() {
  return (
    <main className="flex-1 p-6" aria-hidden="true">
      <div className="mx-auto w-full max-w-2xl animate-pulse py-6">
        {/* Le lien « ← Mes recettes » */}
        <Bloc className="h-11 w-32" />

        {/* Le titre de la recette */}
        <Bloc className="mt-2 h-8 w-64 max-w-full" />

        {/* Portions · temps */}
        <Bloc className="mt-1 h-5 w-56 max-w-full" />

        {/* La description, quand il y en a une */}
        <Bloc className="mt-6 h-5 w-full" />

        {/* « Ce qu'il faut » et ses lignes */}
        <div className="mt-12">
          <Bloc className="h-6 w-36" />

          <div className="mt-2">
            {[0, 1, 2, 3].map((rang) => (
              <div
                key={rang}
                className="flex min-h-touch items-center gap-3 border-b border-card-border py-2 last:border-0"
              >
                <Bloc className="h-5 flex-1" />
                <Bloc className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* « Comment on la fait » et son paragraphe */}
        <div className="mt-12">
          <Bloc className="h-6 w-44" />
          <Bloc className="mt-2 h-5 w-full" />
          <Bloc className="mt-2 h-5 w-full" />
          <Bloc className="mt-2 h-5 w-2/3" />
        </div>

        {/* Le bouton « Modifier » */}
        <Bloc className="mt-12 h-11 w-full" />
      </div>
    </main>
  );
}
