import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { foyerCourant } from "@/lib/foyer/foyer";

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
  const foyer = await foyerCourant(supabase, profile.household_id);

  return (
    <main className="ecran-centre">
      <div className="max-w-sm text-center">
        {/* `break-all` : champ libre, borné à 60 caractères mais sans garantie
            d'espace où couper. Voir `lib/foyer/saisie.ts`. */}
        <h1 className="titre-ecran break-all">{foyer?.nom ?? "Chez toi"}</h1>
        <p className="mt-3 text-base break-all">Salut {profile.display_name}.</p>
        {/* ⚠️ Cette phrase énumère ce qui EXISTE, et elle se périme à chaque
            écran livré : elle rangeait les recettes parmi ce qui « arrive »
            jusqu'à la story 3.1, puis le menu jusqu'à la story 3.5. C'est le
            défaut de texte d'annonce périmé que les stories 1.6, 1.7, 2.1 et 2.2
            ont chacune eu à réparer — il se répare en même temps que l'écran,
            jamais après. La prochaine à la toucher est celle qui livrera la
            liste de courses (Epic 4). */}
        {/* ⚠️ Cette phrase surplombe les quatre boutons, qui nomment les mêmes
            choses à la PREMIÈRE personne depuis le 2026-08-02. Écrire « Ton foyer
            est prêt » juste au-dessus d'un bouton « Mon foyer » ferait se
            contredire deux lignes voisines. Elle est donc neutre : le produit ne
            possède rien à la place du membre, et il ne lui parle pas de ses
            affaires comme si elles étaient les siennes. */}
        <p className="hint mt-6">
          Tout est prêt : le foyer, les rayons, les recettes, le menu. Les
          courses arrivent.
        </p>
        <p className="mt-6">
          <Link href="/foyer" className="btn-primaire w-full">
            Mon foyer
          </Link>
        </p>
        <p className="mt-3">
          <Link href="/rayons" className="btn w-full">
            Mes rayons
          </Link>
        </p>
        <p className="mt-3">
          <Link href="/recettes" className="btn w-full">
            Mes recettes
          </Link>
        </p>
        {/* Après les recettes, et pas avant : le menu se remplit AVEC elles.
            « Mon menu » à la première personne — c'est un libellé qui NOMME une
            chose du membre, pas une phrase que l'application lui adresse. */}
        <p className="mt-3">
          <Link href="/menu" className="btn w-full">
            Mon menu
          </Link>
        </p>
      </div>
    </main>
  );
}
