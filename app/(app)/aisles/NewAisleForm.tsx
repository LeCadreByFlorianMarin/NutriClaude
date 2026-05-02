"use client";

import { useRef, useState, useTransition } from "react";
import { createAisle } from "./actions";

export default function NewAisleForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          const res = await createAisle(fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          formRef.current?.reset();
          setError(null);
        })
      }
      className="grid grid-cols-[80px_80px_1fr_auto] gap-3"
    >
      <input
        name="sort_order"
        type="number"
        defaultValue={100}
        className="input !py-1.5"
        placeholder="Ordre"
      />
      <input
        name="icon"
        className="input !py-1.5 text-center"
        placeholder="🥖"
        maxLength={2}
      />
      <input
        name="name"
        className="input !py-1.5"
        placeholder="Nom du rayon"
        required
      />
      <button disabled={isPending} className="btn-primary !py-1.5">
        Ajouter
      </button>
      {error && <p className="col-span-4 text-red text-xs">{error}</p>}
    </form>
  );
}
