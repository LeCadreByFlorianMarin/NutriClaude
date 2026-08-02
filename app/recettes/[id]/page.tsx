import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { recetteParId } from "@/lib/recettes/recettes";
import { ingredientsDeRecette } from "@/lib/recettes/ingredients";
import {
  formaterPortions,
  formaterQuantite,
  formaterTemps,
} from "@/lib/recettes/lecture";

/**
 * Le titre de l'onglet porte le nom de la recette (décision de Florian du
 * 2026-08-02).
 *
 * ⚠️ **Elle ne lève JAMAIS.** Une recette introuvable doit rendre un titre neutre
 * et se taire : c'est le composant qui décide du `notFound()`, pas la métadonnée.
 * Lever ici produirait une erreur serveur là où l'utilisateur doit voir « Il n'y a
 * rien ici. ».
 *
 * ⚠️ **Elle refait une lecture.** Next met en cache les requêtes d'un même rendu,
 * mais notre client Supabase n'est pas instrumenté pour ça : cette fonction et le
 * composant liront deux fois. Sans portée sur un écran de configuration — et n'en
 * déduis pas qu'il faut un cache.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const supabase = await createServerComponentClient();
    const recette = await recetteParId(supabase, id);
    if (recette) return { title: `${recette.titre} · NutriClaude` };
  } catch {
    // Une lecture qui échoue ne doit pas empêcher la page de rendre son
    // `notFound()` ou son erreur : on retombe sur le titre neutre.
  }
  return { title: "Une recette · NutriClaude" };
}

/**
 * L'écran de LECTURE d'une recette : titre, description, portions, temps,
 * ingrédients et instructions.
 *
 * ⚠️ **Aucun `"use client"`, aucune écriture, aucune région de statut.** Cet
 * écran ne fait qu'afficher — et c'est ce qui rend l'AC1 (« pas dans une zone
 * d'édition ») littéralement vrai plutôt que ressemblant. Si un `useState` ou un
 * `createNavigateurClient` apparaît ici, c'est qu'on a glissé hors du périmètre.
 *
 * ⚠️ **Les trois chemins d'introuvable sont déjà gardés** par `recetteParId` —
 * identifiant qui n'est pas un uuid, recette inexistante, recette d'un autre
 * foyer. Les distinguer serait au mieux inutile, au pire une fuite : sous RLS, la
 * base ne fait elle-même aucune différence.
 *
 * ⚠️ **Deux lectures en séquence, et c'est délibéré.** Un `Promise.all`
 * économiserait un aller-retour mais lancerait la lecture des ingrédients avant
 * de savoir si la recette existe. Le séquentiel permet de sortir en `notFound()`
 * d'abord ; à cette échelle, c'est le bon compromis.
 */
export default async function RecettePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await requireProfile();
  const supabase = await createServerComponentClient();
  const recette = await recetteParId(supabase, id);

  if (!recette) notFound();

  const ingredients = await ingredientsDeRecette(supabase, recette.id);
  const temps = formaterTemps(recette.preparationMin, recette.cuissonMin);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-2xl py-6">
        <Link href="/recettes" className="btn-quiet px-0">
          ← Mes recettes
        </Link>

        <h1 className="titre-ecran mt-2 break-all">{recette.titre}</h1>

        {/*
          Portions et temps sur la même ligne : ce sont les deux repères qu'on
          cherche avant de se lancer. `tabular-nums` parce qu'UX-DR12 l'impose sur
          tout chiffre, et que `.hint` ne le porte pas.

          ⚠️ Le temps peut être absent SANS que les portions le soient : `servings`
          est `not null` avec sa contrainte `> 0`, les deux temps sont nullables.
        */}
        <p className="hint mt-1 tabular-nums">
          {formaterPortions(recette.portions)}
          {temps ? ` · ${temps}` : ""}
        </p>

        {/*
          ⚠️ AC3 : une section sans contenu ne se rend PAS DU TOUT — pas de titre
          orphelin, pas de tiret, pas de « Non renseigné ». L'absence se dit par
          l'absence. C'est du JSX conditionnel, pas du CSS.
        */}
        {recette.description ? (
          <p className="mt-6 text-base break-words">{recette.description}</p>
        ) : null}

        <section className="mt-12">
          <h2 className="titre-section">Ce qu&apos;il faut</h2>

          {ingredients.length === 0 ? (
            /*
              L'exception à la règle ci-dessus, et la seule. Une recette sans
              ingrédient n'est pas un champ vide : c'est une recette inachevée, et
              le membre a quelque chose à y faire. C'est aussi l'état NOMINAL de
              toute recette au sortir de la story 3.1, qui crée au titre seul.
            */
            <div className="mt-2">
              <p className="text-base">
                Tu n&apos;as pas encore mis d&apos;ingrédients.
              </p>
              <p className="mt-1">
                <Link href={`/recettes/${recette.id}/modifier`} className="btn-quiet px-0">
                  Les ajouter
                </Link>
              </p>
            </div>
          ) : (
            <ul className="mt-2">
              {ingredients.map((i) => {
                const quantite = formaterQuantite(i.quantite);
                return (
                  <li
                    key={i.id}
                    className="flex items-baseline gap-3 border-b border-card-border py-2 text-base last:border-0"
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {i.nom}
                      {i.optionnel ? (
                        <span className="hint"> — on peut s&apos;en passer</span>
                      ) : null}
                    </span>
                    {/*
                      ⚠️ `quantite` est `null` — pas `""` — quand il n'y en a pas :
                      « du sel » n'a ni quantité ni unité, et ce `<span>` ne doit
                      alors pas exister du tout.
                    */}
                    {quantite || i.unite ? (
                      <span className="hint shrink-0 tabular-nums">
                        {quantite ?? ""}
                        {quantite && i.unite ? " " : ""}
                        {i.unite ?? ""}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {recette.instructions ? (
          <section className="mt-12">
            <h2 className="titre-section">Comment on la fait</h2>
            {/*
              ⚠️ **AC2 tient dans cette seule déclaration, et tout le reste est un
              piège.** `normaliserMultiligne` (story 3.1) stocke déjà les retours à
              la ligne ; `pre-wrap` les rend, lignes vides intérieures comprises,
              tout en laissant le texte se replier — donc aucun défilement
              horizontal.

              **Jamais `dangerouslySetInnerHTML`, jamais un parseur Markdown,
              jamais `split("\n").map(<br/>)`.** Le premier ouvrirait une vraie
              surface XSS sur un champ écrit par un membre, sur un produit sans
              CSP dont le cookie de session est lisible en JavaScript et dure 400
              jours. Le deuxième est interdit par NFR-10, et l'AC dit « sans
              exposer de balisage brut » — il n'y a donc pas de balisage à parser.
              Le troisième réinvente `pre-wrap` en perdant les espaces
              significatifs.

              `leading-relaxed` : ce texte se lit debout, en cuisinant, à distance
              du plan de travail. C'est le seul écran de l'Epic 3 dans ce cas.
            */}
            <p className="mt-2 text-base leading-relaxed whitespace-pre-wrap break-words">
              {recette.instructions}
            </p>
          </section>
        ) : null}

        <p className="mt-12">
          <Link href={`/recettes/${recette.id}/modifier`} className="btn w-full">
            Modifier
          </Link>
        </p>
      </div>
    </main>
  );
}
