import { notFound } from "next/navigation";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { recetteParId } from "@/lib/recettes/recettes";
import { ingredientsDeRecette } from "@/lib/recettes/ingredients";
import { FormulaireRecette } from "./FormulaireRecette";
import { IngredientsRecette } from "./IngredientsRecette";

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
 * `/recettes/[id]` est l'écran de **lecture** depuis la story 3.3 ; celui-ci est
 * l'édition, et on y arrive par le bouton « Modifier » de la recette.
 *
 * ⚠️ **Le lien de retour reste « ← Tes recettes »** et pas « ← La recette »
 * (décision de Florian du 2026-08-02). Le répertoire est une destination juste et
 * toujours atteignable, là où « la recette » serait faux dès qu'on ouvre cette URL
 * directement — favori, lien partagé. Pour qui arrive depuis la lecture, le bouton
 * Retour du navigateur ramène à la recette : ce chemin est déjà couvert par le
 * contrat du navigateur, il n'a pas besoin d'un lien qui ment dans l'autre cas.
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

  const ingredients = await ingredientsDeRecette(supabase, recette.id);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl py-6">
        <FormulaireRecette recette={recette} />
        {/*
          ⚠️ **Composant à part, monté SOUS le formulaire — pas dedans.** Les deux
          n'ont pas le même modèle d'écriture : le formulaire de la recette
          accumule puis enregistre en un geste, avec une garde sur les saisies non
          enregistrées ; les ingrédients s'écrivent un par un, immédiatement. Les
          mêler ferait entrer les ingrédients dans le périmètre de la garde, et un
          ajout d'ingrédient réussi annoncerait « tu as des modifications non
          enregistrées » — un message faux.
        */}
        <IngredientsRecette recetteId={recette.id} ingredients={ingredients} />
      </div>
    </main>
  );
}
