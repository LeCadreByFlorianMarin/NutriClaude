"use client";

import { useState, useTransition } from "react";
import { createRecipe } from "./actions";

export default function NewRecipeForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const res = await createRecipe(fd);
          if (res?.error) setError(res.error);
        })
      }
      className="grid gap-3 sm:grid-cols-[1fr_120px_120px_140px_auto]"
    >
      <input
        name="title"
        className="input"
        placeholder="Ex. Poulet basquaise"
        required
      />
      <input
        name="servings"
        type="number"
        defaultValue={2}
        min={1}
        className="input"
        placeholder="Pers."
      />
      <input
        name="prep_time_min"
        type="number"
        min={0}
        className="input"
        placeholder="Prep (min)"
      />
      <input
        name="cook_time_min"
        type="number"
        min={0}
        className="input"
        placeholder="Cuisson (min)"
      />
      <button disabled={isPending} className="btn-primary">
        Créer
      </button>
      {error && <p className="sm:col-span-5 text-red text-sm">{error}</p>}
    </form>
  );
}
