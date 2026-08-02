/**
 * Le squelette du répertoire — **le premier `loading.tsx` du dépôt**.
 *
 * AC4 l'exige en toutes lettres : « pendant le chargement un squelette plutôt
 * qu'un écran blanc ou un message d'erreur ». Trois choses le rendent facile à
 * croire livré sans l'être, et elles sont écrites ici pour la prochaine revue :
 *
 * 1. **Il ne s'affiche que si quelque chose l'attend.** En local, la page répond
 *    en quelques dizaines de millisecondes et ce fichier passe invisible. Il a
 *    donc été regardé réseau bridé, pas seulement écrit.
 *
 * 2. **Ni spinner, ni message.** Des blocs à la forme et à la place de ce qui
 *    arrive, pour que le contenu ne fasse pas sauter la page en s'installant.
 *    Les hauteurs et les marges suivent celles de `page.tsx` et
 *    `ListeRecettes` — si l'une bouge, celui-ci doit bouger avec.
 *
 * 3. **La couleur porte le contraste, jamais l'animation.** `animate-pulse` est
 *    neutralisé par la règle globale de `prefers-reduced-motion`
 *    (`globals.css`), qui ramène toute animation à `0.01ms`. Un squelette dont
 *    seule l'animation portait le contraste deviendrait alors un aplat
 *    invisible : ici les blocs restent parfaitement visibles à l'arrêt.
 *
 * ⚠️ **`bg-gray-200` n'existe pas dans ce projet** — la palette Tailwind par
 * défaut est neutralisée (`--color-*: initial`) et les utilitaires de couleur
 * inconnus échouent **en silence**. `bg-card-border` est un token publié :
 * 7 % de noir en thème clair, 10 % de blanc en sombre.
 *
 * `aria-hidden` sur l'ensemble : un lecteur d'écran n'a rien à faire d'une
 * maquette de contenu. L'arrivée du vrai contenu est annoncée par le changement
 * de page lui-même.
 */
function Bloc({ className }: { className: string }) {
  return <span className={`block rounded-md bg-card-border ${className}`} />;
}

export default function ChargementRecettes() {
  return (
    <main className="flex-1 p-6" aria-hidden="true">
      <div className="mx-auto w-full max-w-2xl animate-pulse py-6">
        {/* Le lien « ← Retour » */}
        <Bloc className="h-11 w-24" />

        {/* Le titre d'écran et son sous-titre */}
        <Bloc className="mt-2 h-8 w-52" />
        <Bloc className="mt-2 h-5 w-72 max-w-full" />

        <div className="mt-12">
          {/* « Ton répertoire » */}
          <Bloc className="h-6 w-40" />

          <div className="mt-2">
            {[0, 1, 2].map((rang) => (
              <div
                key={rang}
                className="flex min-h-touch items-center gap-3 border-b border-card-border py-2 last:border-0"
              >
                <Bloc className="h-5 flex-1" />
                <Bloc className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>

          {/* « Ajouter une recette » et son champ */}
          <div className="mt-12">
            <Bloc className="h-6 w-48" />
            <Bloc className="mt-2 h-11 w-full" />
            <Bloc className="mt-2 h-5 w-64 max-w-full" />
            <Bloc className="mt-6 h-11 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
