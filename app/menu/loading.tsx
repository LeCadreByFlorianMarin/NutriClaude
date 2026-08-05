/**
 * Le squelette de la grille du menu.
 *
 * **Pourquoi ce fichier existe alors qu'aucun AC ne le demande.** `app/menu/` est
 * un segment neuf sans `layout.tsx`, et il n'y a pas d'`app/loading.tsx` : un
 * `loading.tsx` de segment enveloppe ses enfants, mais rien ne remonte à un
 * parent qui n'existe pas. Sans ce fichier, `/menu` affiche un **écran blanc**
 * pendant sa lecture. Le motif est déjà écrit deux fois dans le dépôt
 * (`app/recettes/loading.tsx`, `app/recettes/[id]/loading.tsx`) et la story 3.3 a
 * appris à ses dépens qu'un squelette manquant ou mal placé ne se voit qu'au
 * réseau bridé — jamais en local, où la page répond en quelques dizaines de
 * millisecondes.
 *
 * ⚠️ **Les hauteurs, les marges et la grille suivent `page.tsx`.** Si l'une
 * bouge, celui-ci doit bouger avec — contrainte que ne tient aucun test, NFR-10
 * interdisant le harnais de composants.
 *
 * ⚠️ **La couleur porte le contraste, jamais l'animation.** `animate-pulse` est
 * neutralisé par la règle globale de `prefers-reduced-motion` (`globals.css`),
 * qui ramène toute animation à `0.01ms`. Un squelette dont seule l'animation
 * portait le contraste deviendrait alors un aplat invisible.
 *
 * ⚠️ **`bg-gray-200` n'existe pas dans ce projet** — la palette Tailwind par
 * défaut est neutralisée (`--color-*: initial`) et les utilitaires de couleur
 * inconnus échouent **en silence**. `bg-card-border` est un token publié.
 *
 * **Ce qu'on ne cherche PAS à deviner :** ce qu'il y a dans les cases. Le
 * squelette montre la grille — sept jours, quatre repas — et s'arrête là.
 * Esquisser des titres de recette dans une semaine qui sera peut-être vide
 * recréerait le saut de mise en page qu'un squelette existe pour éviter.
 */
function Bloc({ className }: { className: string }) {
  return <span className={`block rounded-md bg-card-border ${className}`} />;
}

export default function ChargementMenu() {
  return (
    <main className="flex-1 p-6" aria-hidden="true">
      <div className="mx-auto w-full max-w-5xl animate-pulse py-6">
        {/* Le lien « ← Retour » */}
        <Bloc className="h-11 w-24" />

        {/* « Mon menu » et la plage de la semaine */}
        <Bloc className="mt-2 h-8 w-44" />
        <Bloc className="mt-1 h-5 w-52 max-w-full" />

        {/* Les deux boutons de navigation */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Bloc className="h-11 w-48" />
          <Bloc className="h-11 w-48" />
        </div>

        <div className="mt-8 grid gap-gutter lg:grid-cols-7 lg:grid-rows-[repeat(5,auto)]">
          {[0, 1, 2, 3, 4, 5, 6].map((jour) => (
            <div
              key={jour}
              className="grid gap-2 lg:row-span-5 lg:grid-rows-subgrid"
            >
              {/* L'en-tête du jour */}
              <Bloc className="h-4 w-28" />

              {/*
                Les quatre repas.

                ⚠️ **CE GABARIT A ÉTÉ RATTRAPÉ LE 2026-08-05, et il l'a été par une
                revue.** La story 3.6 a rendu chaque case actionnable — un lien en
                `min-h-touch` (44px) sous l'étiquette du repas — et n'a pas touché ce
                fichier, alors que son en-tête l'exige. Le squelette rendait ~40px de
                contenu contre ~64px minimum, sur 28 cases : c'est très exactement le
                saut de mise en page qu'un squelette existe pour éviter, réintroduit sur
                l'écran que la story disait refermer.

                La hauteur suit donc `page.tsx` : l'étiquette du repas, puis un bloc à
                `min-h-touch` pour l'affordance qui s'y trouve toujours — case vide
                (« Mettre une recette ») comme case pleine (« Modifier »).
              */}
              {[0, 1, 2, 3].map((repas) => (
                <div
                  key={repas}
                  className="min-h-touch rounded-md border border-card-border p-card"
                >
                  <Bloc className="h-3 w-16" />
                  <Bloc className="mt-1 h-touch w-28" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
