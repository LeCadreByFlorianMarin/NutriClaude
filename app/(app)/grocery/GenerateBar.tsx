"use client";

import { useState, useTransition } from "react";
import { generateFromMenu, clearAll, clearBought } from "./actions";

export default function GenerateBar({
  startISO,
  endISO,
}: {
  startISO: string;
  endISO: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    const fd = new FormData();
    fd.set("start_date", startISO);
    fd.set("end_date", endISO);
    startTransition(async () => {
      const res = await generateFromMenu(fd);
      if (res?.error) {
        setError(res.error);
        setMsg(null);
        return;
      }
      setError(null);
      setMsg(`✓ ${res.count ?? 0} articles ajoutés à la liste.`);
    });
  }

  function clearBoughtItems() {
    if (!confirm("Supprimer définitivement les articles achetés ?")) return;
    startTransition(async () => {
      const res = await clearBought();
      if (res?.error) setError(res.error);
    });
  }

  function clearEverything() {
    if (!confirm("Vider toute la liste (à acheter + achetés) ?")) return;
    startTransition(async () => {
      const res = await clearAll();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={generate}
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? "…" : "🛒 Générer la liste"}
        </button>
        <button
          onClick={clearBoughtItems}
          disabled={isPending}
          className="btn-secondary"
        >
          Vider les achetés
        </button>
        <button
          onClick={clearEverything}
          disabled={isPending}
          className="btn-ghost text-red"
        >
          Vider tout
        </button>
      </div>
      {msg && <p className="text-green text-sm">{msg}</p>}
      {error && <p className="text-red text-sm">{error}</p>}
    </div>
  );
}
