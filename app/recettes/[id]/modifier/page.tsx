import { notFound } from "next/navigation";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { recetteParId } from "@/lib/recettes/recettes";
import { FormulaireRecette } from "./FormulaireRecette";

export const metadata = { title: "Modifier une recette · NutriClaude" };

/**
 * L'écran d'édition d'une recette : les cinq champs que la création ne demande
 * pas, et la suppression.
 *
 * ⚠️ **`params` est une `Promise`**, et ce n'est pas une coquetterie de Next 16 :
 * `strictRouteTypes` est activé dans `next.config.ts` précisément pour que le
 * typage l'attrape. Sans lui, un `params` typé en objet passerait `tsc` **et**
 * `next build`, et `params.id` vaudrait `undefined` à l'exécution.
 *
 * ⚠️ **Trois chemins mènent à `notFound()`, et c'est délibéré** : l'identifiant
 * n'existe plus, il appartient à un autre foyer, ou il n'a même pas la forme
 * d'un uuid. Les distinguer serait au mieux inutile, au pire une fuite —
 * répondre « elle existe mais pas pour toi » dirait à un foyer ce qu'un autre
 * possède. Sous RLS, la base ne fait elle-même aucune différence : elle rend
 * zéro ligne, sans erreur. Voir `recetteParId`.
 *
 * La story 3.3 ajoutera `/recettes/[id]` en LECTURE ; cet écran-ci restera
 * l'édition.
 */
export default async function ModifierRecettePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /*
   * `requireProfile` n'est pas un contrôle de sécurité — la RLS l'est, et sans
   * profil `current_household_id()` vaut NULL, donc il n'y a rien à lire. Il est
   * là pour l'aiguillage : envoyer vers `/login` ou `/onboarding` plutôt que
   * d'afficher un « cette recette n'existe pas » à qui n'a simplement pas encore
   * de foyer.
   */
  await requireProfile();
  const supabase = await createServerComponentClient();
  const recette = await recetteParId(supabase, id);

  if (!recette) notFound();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl py-6">
        <FormulaireRecette recette={recette} />
      </div>
    </main>
  );
}
