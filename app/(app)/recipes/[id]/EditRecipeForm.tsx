"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRecipe, deleteRecipe } from "../actions";
import type { Recipe } from "@/lib/supabase/types";

export default function EditRecipeForm({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(fd) => {
        fd.set("id", recipe.id);
        startTransition(async () => {
          const res = await updateRecipe(fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          setError(null);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="label">Titre</label>
        <input
          name="title"
          required
          defaultValue={recipe.title}
          className="input"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Personnes</label>
          <input
            name="servings"
            type="number"
            min={1}
            defaultValue={recipe.servings}
            className="input"
          />
        </div>
        <div>
          <label className="label">Prep (min)</label>
          <input
            name="prep_time_min"
            type="number"
            min={0}
            defaultValue={recipe.prep_time_min ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label">Cuisson (min)</label>
          <input
            name="cook_time_min"
            type="number"
            min={0}
            defaultValue={recipe.cook_time_min ?? ""}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          name="description"
          defaultValue={recipe.description ?? ""}
          className="input min-h-[60px]"
          placeholder="Quelques mots sur la recette…"
        />
      </div>

      <div>
        <label className="label">Instructions (markdown)</label>
        <textarea
          name="instructions"
          defaultValue={recipe.instructions ?? ""}
          className="input min-h-[180px] font-mono text-sm"
          placeholder="1. Émincer les oignons&#10;2. Faire revenir le poulet…"
        />
      </div>

      {error && <p className="text-red text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button disabled={isPending} className="btn-primary">
          Enregistrer
        </button>
        {saved && <span className="text-green text-sm">✓ Enregistré</span>}

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => {
            if (!confirm(`Supprimer "${recipe.title}" ?`)) return;
            const fd = new FormData();
            fd.set("id", recipe.id);
            startTransition(() => {
              deleteRecipe(fd);
            });
          }}
          className="btn-danger"
        >
          Supprimer la recette
        </button>
      </div>
    </form>
  );
}
