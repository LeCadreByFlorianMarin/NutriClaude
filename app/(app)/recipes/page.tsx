import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";
import type { Recipe } from "@/lib/supabase/types";
import NewRecipeForm from "./NewRecipeForm";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  await requireProfile();
  const supabase = createClient();
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });
  const recipes = (data ?? []) as Recipe[];

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">Recettes</h1>
          <p className="text-muted text-sm">
            Le répertoire familial. Une recette = ses ingrédients = sa
            contribution à la liste de courses.
          </p>
        </div>
      </header>

      <section className="card">
        <h2 className="font-semibold mb-3">Nouvelle recette</h2>
        <NewRecipeForm />
      </section>

      <section>
        <h2 className="font-semibold mb-3">
          Tes recettes{" "}
          <span className="text-muted text-sm font-normal">
            ({recipes.length})
          </span>
        </h2>
        {recipes.length === 0 ? (
          <p className="text-muted text-sm">
            Aucune recette pour l'instant. Crée ta première au-dessus.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="card block hover:border-accent transition"
                >
                  <h3 className="font-semibold mb-1">{r.title}</h3>
                  {r.description && (
                    <p className="text-sm text-muted line-clamp-2 mb-3">
                      {r.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <span className="chip">{r.servings} pers.</span>
                    {r.prep_time_min != null && (
                      <span className="chip">⏱ {r.prep_time_min} min</span>
                    )}
                    {r.tags?.map((t) => (
                      <span key={t} className="chip">
                        #{t}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
