"use client";

import { useRef, useState, useTransition } from "react";
import { addIngredient, deleteIngredient } from "../actions";
import type { RecipeIngredient } from "@/lib/supabase/types";

const UNITS = ["g", "kg", "ml", "L", "pièce", "cs", "cc", "pincée"];

export default function IngredientsList({
  recipeId,
  ingredients,
}: {
  recipeId: string;
  ingredients: RecipeIngredient[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextSort =
    (ingredients.reduce((m, i) => Math.max(m, i.sort_order), 0) || 0) + 10;

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {ingredients.length === 0 && (
          <li className="text-muted text-sm">Aucun ingrédient pour l'instant.</li>
        )}
        {ingredients.map((ing) => (
          <li
            key={ing.id}
            className="grid grid-cols-[80px_80px_1fr_140px_auto] gap-3 items-center px-2 py-2 hover:bg-surface2 rounded-lg group text-sm"
          >
            <span className="tabular-nums text-muted">
              {ing.quantity ?? "—"}
            </span>
            <span className="text-muted">{ing.unit ?? ""}</span>
            <span className="font-medium">
              {ing.name}
              {ing.optional && (
                <span className="ml-2 chip text-xs">optionnel</span>
              )}
            </span>
            <span className="text-xs text-muted">
              {ing.aisle_keyword && (
                <>
                  rayon : <code className="text-text">{ing.aisle_keyword}</code>
                </>
              )}
            </span>
            <button
              onClick={() => {
                const fd = new FormData();
                fd.set("id", ing.id);
                fd.set("recipe_id", recipeId);
                startTransition(() => {
                  deleteIngredient(fd);
                });
              }}
              className="opacity-0 group-hover:opacity-100 btn-ghost !py-1 !px-2 text-xs hover:text-red transition"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        action={(fd) => {
          fd.set("recipe_id", recipeId);
          fd.set("sort_order", String(nextSort));
          startTransition(async () => {
            const res = await addIngredient(fd);
            if (res?.error) {
              setError(res.error);
              return;
            }
            formRef.current?.reset();
            setError(null);
          });
        }}
        className="grid grid-cols-[80px_100px_1fr_140px_auto] gap-3 pt-4 border-t border-border"
      >
        <input
          name="quantity"
          type="number"
          step="0.01"
          className="input !py-1.5"
          placeholder="Qté"
        />
        <select name="unit" className="input !py-1.5">
          <option value="">unité</option>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          name="name"
          required
          className="input !py-1.5"
          placeholder="Filet de poulet"
        />
        <input
          name="aisle_keyword"
          className="input !py-1.5"
          placeholder="rayon (ex. poulet)"
        />
        <button disabled={isPending} className="btn-primary !py-1.5 !px-3">
          + Ajouter
        </button>
        <label className="col-span-5 text-xs text-muted flex items-center gap-2">
          <input type="checkbox" name="optional" /> Ingrédient optionnel
        </label>
        {error && <p className="col-span-5 text-red text-xs">{error}</p>}
      </form>
    </div>
  );
}
