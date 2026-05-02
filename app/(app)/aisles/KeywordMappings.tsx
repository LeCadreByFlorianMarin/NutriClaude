"use client";

import { useRef, useState, useTransition } from "react";
import { createMapping, deleteMapping } from "./actions";
import type { Aisle, ProductAisleMap } from "@/lib/supabase/types";

export default function KeywordMappings({
  aisles,
  mappings,
}: {
  aisles: Aisle[];
  mappings: ProductAisleMap[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const aisleById = new Map(aisles.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={(fd) =>
          startTransition(async () => {
            const res = await createMapping(fd);
            if (res?.error) {
              setError(res.error);
              return;
            }
            formRef.current?.reset();
            setError(null);
          })
        }
        className="grid grid-cols-[1fr_1fr_auto] gap-3"
      >
        <input
          name="keyword"
          className="input !py-1.5"
          placeholder="poulet, oignon, pâtes…"
          required
        />
        <select name="aisle_id" className="input !py-1.5" required>
          <option value="">Choisir un rayon</option>
          {aisles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon ? `${a.icon} ` : ""}
              {a.name}
            </option>
          ))}
        </select>
        <button disabled={isPending} className="btn-primary !py-1.5">
          Associer
        </button>
        {error && <p className="col-span-3 text-red text-xs">{error}</p>}
      </form>

      <div className="flex flex-wrap gap-2">
        {mappings.length === 0 && (
          <p className="text-muted text-sm">
            Aucun mot-clé pour l'instant. Astuce : commence par les ingrédients
            que tu utilises le plus.
          </p>
        )}
        {mappings.map((m) => {
          const aisle = m.aisle_id ? aisleById.get(m.aisle_id) : null;
          return (
            <span key={m.id} className="chip group">
              <strong className="text-text">{m.keyword}</strong>
              <span className="text-muted">→</span>
              <span>
                {aisle?.icon ? `${aisle.icon} ` : ""}
                {aisle?.name ?? "?"}
              </span>
              <button
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", m.id);
                  startTransition(() => {
                    deleteMapping(fd);
                  });
                }}
                className="text-muted hover:text-red ml-1"
                title="Supprimer"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
