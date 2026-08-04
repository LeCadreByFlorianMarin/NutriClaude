import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { rayonsDuFoyer } from "@/lib/rayons/rayons";
import { ListeRayons } from "./ListeRayons";

export const metadata = { title: "Mes rayons · NutriClaude" };

/**
 * Écran des rayons : l'ordre dans lequel Florian traverse son magasin.
 *
 * Les rayons existent en base depuis le squelette — `seed_default_aisles` en
 * amorce onze à la création du foyer — mais **aucune surface ne les avait
 * jamais affichés**. C'est le premier écran qui les rend visibles.
 *
 * Il porte aussi le réordonnancement du parcours depuis la story 2.2 : deux
 * flèches par ligne et un glisser à la poignée, jamais une saisie de numéro
 * d'ordre (FR-12).
 *
 * Ce que cet écran ne fait pas, et où ça vit : les règles mot-clé → rayon
 * (story 2.3), la carte-rayon avec son ratio `n/total` (story 2.4), et
 * l'affichage de la liste de courses groupée par rayon (Epic 4). Le ratio
 * suppose des articles, et il n'y en a pas encore.
 *
 * Rendu serveur, écritures client-direct : voir `ListeRayons`.
 */
export default async function RayonsPage() {
  const profile = await requireProfile();
  const supabase = await createServerComponentClient();
  const rayons = await rayonsDuFoyer(supabase);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-sm py-6">
        <Link href="/" className="btn-quiet px-0">
          ← Retour
        </Link>

        {/* Le titre nomme l'ÉCRAN, pas le foyer : `/` affiche déjà le nom du
            foyer en `<h1>`, et deux pages portant le même titre ne disaient
            plus où l'on était. Leçon de `/foyer`. */}
        <h1 className="titre-ecran mt-2">Mes rayons</h1>
        <p className="hint mt-1">L&apos;ordre où tu traverses ton magasin.</p>

        <div className="mt-12">
          <ListeRayons rayons={rayons} foyerId={profile.household_id} />
        </div>
      </div>
    </main>
  );
}
