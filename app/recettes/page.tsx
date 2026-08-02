import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { recettesDuFoyer } from "@/lib/recettes/recettes";
import { ListeRecettes } from "./ListeRecettes";

export const metadata = { title: "Mes recettes · NutriClaude" };

/**
 * Le répertoire des recettes du foyer.
 *
 * Premier écran du produit à écrire dans `recipes` : la table existe depuis le
 * squelette, mais aucune surface ne l'avait jamais touchée — le prototype qui le
 * faisait a été retiré à la story 1.1.
 *
 * ⚠️ **La création se fait ICI, au titre seul**, puis continue sur l'écran
 * d'édition qui reçoit les cinq autres champs. Ce n'est pas un raccourci : c'est
 * ce qui permet de réutiliser tel quel le formulaire d'ajout de `/rayons` — un
 * champ, une zone de statut, un bouton — au lieu d'un troisième écran portant un
 * formulaire de six champs dupliqué. Conséquence assumée et écrite dans la
 * story : l'AC1 se lit en deux temps.
 *
 * Ce que cet écran ne fait pas, et où ça vit : les ingrédients (story 3.2), la
 * lecture d'une recette (story 3.3), les étiquettes, le filtre et la recherche
 * (story 3.4), la grille du menu (stories 3.5 et 3.6).
 *
 * ⚠️ **Plus large que `/rayons` et `/foyer`, à dessein.** Ces deux-là sont en
 * `max-w-sm` parce qu'ils alignent des lignes courtes. Ici, DESIGN.md et
 * EXPERIENCE.md disent l'inverse : « le menu et les recettes (surface web)
 * peuvent respirer au grand écran » — seul l'écran liste porte la contrainte du
 * magasin (NFR-3). Un champ d'instructions à 384px serait inconfortable.
 *
 * Rendu serveur, écritures client-direct : voir `ListeRecettes`.
 */
export default async function RecettesPage() {
  const profile = await requireProfile();
  const supabase = await createServerComponentClient();
  const recettes = await recettesDuFoyer(supabase);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl py-6">
        {/* « Retour » sans destination nommée est acceptable ICI, et seulement
            ici : cet écran n'a qu'un parent possible. Les sous-écrans en ont
            deux — l'accueil et ce répertoire — et nomment donc le leur. */}
        <Link href="/" className="btn-quiet px-0">
          ← Retour
        </Link>

        <h1 className="titre-ecran mt-2">Mes recettes</h1>
        <p className="hint mt-1">Ce que vous savez faire à manger.</p>

        <div className="mt-12">
          <ListeRecettes
            recettes={recettes}
            foyerId={profile.household_id}
            profilId={profile.id}
          />
        </div>
      </div>
    </main>
  );
}
