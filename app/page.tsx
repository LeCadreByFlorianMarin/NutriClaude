import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { nomDuFoyer } from "@/lib/foyer/foyer";

/**
 * Accueil. Un membre sans foyer est envoyé s'en créer un ; les autres voient
 * leur foyer nommé.
 *
 * Volontairement minimal : la liste, le menu et les recettes appartiennent aux
 * epics suivants. Il n'y a encore rien à compter.
 */
export default async function HomePage() {
  const profile = await requireProfile();

  const supabase = await createServerComponentClient();
  const nom = await nomDuFoyer(supabase, profile.household_id);

  return (
    <main className="ecran-centre">
      <div className="max-w-sm text-center">
        {/* `break-all` : champ libre, borné à 60 caractères mais sans garantie
            d'espace où couper. Voir `lib/foyer/saisie.ts`. */}
        <h1 className="titre-ecran break-all">{nom ?? "Chez toi"}</h1>
        <p className="mt-3 text-base break-all">Salut {profile.display_name}.</p>
        <p className="hint mt-6">
          Ton foyer est prêt, tes rayons aussi. Les courses, les recettes et le
          menu arrivent.
        </p>
        <p className="mt-6">
          <Link href="/foyer" className="btn-primaire w-full">
            Ton foyer
          </Link>
        </p>
        <p className="mt-3">
          <Link href="/rayons" className="btn w-full">
            Tes rayons
          </Link>
        </p>
      </div>
    </main>
  );
}
