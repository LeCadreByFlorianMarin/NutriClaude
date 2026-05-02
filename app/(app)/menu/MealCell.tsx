"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { assignRecipe, unassignRecipe } from "./actions";
import type { MealPlanEntry, MealType, Recipe } from "@/lib/supabase/types";

type EntryWithRecipe = MealPlanEntry & {
  recipes: Pick<Recipe, "id" | "title" | "servings"> | null;
};

export default function MealCell({
  date,
  mealType,
  entries,
  recipes,
}: {
  date: string;
  mealType: MealType;
  entries: EntryWithRecipe[];
  recipes: Pick<Recipe, "id" | "title" | "servings">[];
}) {
  const [open, setOpen] = useState(false);
  const [recipeId, setRecipeId] = useState("");
  const [servings, setServings] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    if (!recipeId) {
      setError("Choisis une recette");
      return;
    }
    const fd = new FormData();
    fd.set("recipe_id", recipeId);
    fd.set("meal_date", date);
    fd.set("meal_type", mealType);
    fd.set("servings", String(servings));
    startTransition(async () => {
      const res = await assignRecipe(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setRecipeId("");
      setError(null);
      setOpen(false);
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      unassignRecipe(fd);
    });
  }

  return (
    <div className="bg-surface border border-border rounded-md p-2 min-h-[80px] flex flex-col gap-1">
      {entries.map((e) => (
        <div
          key={e.id}
          className="group flex items-center gap-1 bg-surface2 rounded px-2 py-1 text-xs"
        >
          {e.recipes ? (
            <Link
              href={`/recipes/${e.recipes.id}`}
              className="flex-1 truncate hover:text-accent-light"
              title={e.recipes.title}
            >
              {e.recipes.title}
              <span className="text-muted ml-1">· {e.servings}p</span>
            </Link>
          ) : (
            <span className="flex-1 text-muted italic">supprimée</span>
          )}
          <button
            onClick={() => remove(e.id)}
            disabled={isPending}
            className="opacity-0 group-hover:opacity-100 text-muted hover:text-red transition"
            title="Retirer"
          >
            ×
          </button>
        </div>
      ))}

      {open ? (
        <div className="space-y-1 mt-auto">
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="input !py-1 !px-2 !text-xs"
          >
            <option value="">— Choisir —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <input
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="input !py-1 !px-2 !text-xs w-14"
              title="Personnes"
            />
            <button
              onClick={add}
              disabled={isPending}
              className="btn-primary !py-1 !px-2 !text-xs flex-1"
            >
              OK
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="btn-ghost !py-1 !px-2 !text-xs"
            >
              ✕
            </button>
          </div>
          {error && <p className="text-red text-[10px]">{error}</p>}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-auto text-xs text-muted hover:text-accent-light hover:bg-surface2 rounded py-1 transition"
        >
          + Ajouter
        </button>
      )}
    </div>
  );
}
