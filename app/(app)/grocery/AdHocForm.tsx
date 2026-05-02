"use client";

import { useRef, useState, useTransition } from "react";
import { addAdHocItem } from "./actions";
import type { Aisle } from "@/lib/supabase/types";

const UNITS = ["g", "kg", "ml", "L", "pièce", "cs", "cc"];

export default function AdHocForm({ aisles }: { aisles: Aisle[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          const res = await addAdHocItem(fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          formRef.current?.reset();
          setError(null);
        })
      }
      className="grid gap-3 sm:grid-cols-[80px_100px_1fr_180px_auto]"
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
        placeholder="Article (ex. liquide vaisselle)"
      />
      <select name="aisle_id" className="input !py-1.5">
        <option value="">— Rayon (optionnel) —</option>
        {aisles.map((a) => (
          <option key={a.id} value={a.id}>
            {a.icon ? `${a.icon} ` : ""}
            {a.name}
          </option>
        ))}
      </select>
      <button disabled={isPending} className="btn-primary !py-1.5">
        + Ajouter
      </button>
      {error && <p className="sm:col-span-5 text-red text-xs">{error}</p>}
    </form>
  );
}
