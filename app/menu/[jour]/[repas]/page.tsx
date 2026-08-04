import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { foyerCourant } from "@/lib/foyer/foyer";
import { casesDuRepas, repasParSlug } from "@/lib/menu/menu";
import { estJourISO, formaterJourLong, lundiDeLaSemaine } from "@/lib/menu/semaine";
import { recettesDuFoyer } from "@/lib/recettes/recettes";
import { AssignerRepas } from "./AssignerRepas";

export const metadata = { title: "Mettre une recette au menu · NutriClaude" };

/**
 * L'écran d'un repas : ce qui y est prévu, et comment y mettre une recette.
 *
 * ⚠️ **UN ÉCRAN À PART, ET C'EST L'AC2 DE LA STORY 3.5 QUI L'A DÉCIDÉ.** La grille
 * du menu range sept jours sur sept colonnes ; un `<select>` de recettes y prend
 * l'intrinsèque de sa plus longue option — jusqu'à 80 caractères (`MAX_TITRE`) —
 * et ferait déborder la page en largeur, ce que NFR-3/UX-DR10 interdisent. Poser
 * le formulaire **hors** des pistes de la grille supprime le risque à la source
 * plutôt que de le contenir par des classes. Décision de Florian du 2026-08-04.
 *
 * C'est aussi ce qui **referme la moitié d'AC4 laissée ouverte par la story 3.5** :
 * ses cases vides étaient « lisibles » mais pas « directement actionnables », faute
 * de destination. L'objection d'alors — « une case cliquable produirait un 404 en
 * attendant » — tombe, puisque cette story construit la destination.
 *
 * ⚠️ **`params` est une `Promise`** (`strictRouteTypes`, `next.config.ts:5-13`).
 * Le typer en objet compile **et** passe `next build`, et `params.jour` vaudrait
 * `undefined` à l'exécution.
 *
 * ⚠️ **Les deux segments sont des SAISIES.** Ils arrivent de l'URL, donc de
 * n'importe où : `/menu/lol/midi`, `/menu/2026-13-45/midi`, `/menu/2026-08-04/lunch`.
 * Aucun ne doit lever ni afficher `Invalid Date`. Ils mènent tous à `notFound()` —
 * un chemin fautif n'est pas une panne, et « Réessaie » n'y pourrait rien.
 *
 * ⚠️ **L'URL parle FRANÇAIS** : `/menu/2026-08-04/midi`, jamais `lunch`. Le jeton
 * anglais est un détail de schéma ; l'adresse se lit, se copie et se partage.
 * `repasParSlug` refuse le code de la base à dessein — voir son en-tête.
 */
export default async function RepasPage({
  params,
}: {
  params: Promise<{ jour: string; repas: string }>;
}) {
  const { jour, repas: slug } = await params;

  /*
   * ⚠️ **La garde de FORME avant tout aller-retour réseau.** `estJourISO` valide
   * par aller-retour et non par `isNaN` : `Date.UTC(2026, 12, 45)` ne lève pas, il
   * **déborde** au 14 février 2027 (mesuré à la story 3.5). Sans elle, la page
   * afficherait tranquillement un autre jour que celui demandé.
   *
   * ⚠️ **Et le jour n'est PAS normalisé ici**, contrairement à `?semaine=` sur la
   * grille : `/menu/2026-08-04/midi` désigne un jour précis, pas une semaine. Le
   * normaliser changerait la case qu'on édite.
   */
  const repas = repasParSlug(slug);
  if (!estJourISO(jour) || !repas) notFound();

  const profile = await requireProfile();
  const supabase = await createServerComponentClient();

  /*
   * Trois lectures indépendantes : les enchaîner les ferait attendre l'une après
   * l'autre. Motif de `app/foyer/page.tsx`.
   */
  const [foyer, recettes, cases] = await Promise.all([
    foyerCourant(supabase, profile.household_id),
    recettesDuFoyer(supabase),
    casesDuRepas(supabase, jour, repas.code),
  ]);

  /*
   * Le foyer illisible n'est pas censé arriver — `household_id` est `not null` et
   * `households_select` rend la ligne visible à tout membre. S'il arrive quand
   * même, il n'y a rien à planifier : même traitement qu'une recette introuvable.
   */
  if (!foyer) notFound();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl py-6">
        {/* Le retour NOMME sa destination : cet écran a deux parents possibles —
            l'accueil et la grille — et c'est la grille qu'on quitte. C'est la
            règle que `app/recettes/page.tsx:43-45` pose pour les sous-écrans. */}
        <Link
          href={`/menu?semaine=${lundiDeLaSemaine(jour)}`}
          className="btn-quiet px-0"
        >
          ← Mon menu
        </Link>

        {/* Le jour et le repas, tels qu'on les dit — pas « 2026-08-04 / lunch ». */}
        <h1 className="titre-ecran mt-2">
          {formaterJourLong(jour)} · {repas.libelle}
        </h1>

        <AssignerRepas
          jour={jour}
          repas={repas.code}
          foyerId={profile.household_id}
          profilId={profile.id}
          personnesParDefaut={foyer.personnesParDefaut}
          recettes={recettes}
          cases={cases}
        />
      </div>
    </main>
  );
}
