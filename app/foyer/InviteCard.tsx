"use client";

import { useState, useTransition } from "react";
import { genererInvitation } from "./actions";

/** Messages d'échec en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES: Record<string, string> = {
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
};

function validite(jours: number): string {
  if (jours <= 0) return "Il expire aujourd'hui.";
  if (jours === 1) return "Encore 1 jour.";
  return `Encore ${jours} jours.`;
}

function usages(n: number): string {
  return n === 1
    ? "1 personne peut encore s'en servir."
    : `${n} personnes peuvent encore s'en servir.`;
}

export function InviteCard({
  code,
  joursRestants,
  usagesRestants,
}: {
  code: string | null;
  joursRestants: number;
  usagesRestants: number;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | undefined>();
  const [copie, setCopie] = useState(false);

  function inviter() {
    setErreur(undefined);
    demarrer(async () => {
      const r = await genererInvitation();
      if (!r.ok) setErreur(r.erreur);
    });
  }

  async function copier() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      // Presse-papiers indisponible : le code reste sélectionnable à la main,
      // c'est le repli. On ne montre pas d'erreur pour ça.
    }
  }

  const message = erreur ? (MESSAGES[erreur] ?? MESSAGES.echec) : undefined;

  if (!code) {
    return (
      <div>
        <p className="text-base">Personne n&apos;est encore invité.</p>
        <p role="status" aria-live="polite" className="notice mt-3">
          {message}
        </p>
        <button
          type="button"
          onClick={inviter}
          disabled={enCours}
          className="btn mt-2 w-full"
        >
          {enCours ? "Un instant…" : "Inviter quelqu'un"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Le code sera lu à voix haute ou recopié : taille et espacement font
          tout le travail. L'abricot serait disponible, mais il est réservé à
          l'action courses (UX-DR2) — un code d'invitation n'en est pas une. */}
      <p
        className="card px-4 py-6 text-center text-3xl font-semibold tabular-nums tracking-[0.25em] select-all"
        aria-label={`Code d'invitation : ${code.split("").join(" ")}`}
      >
        {code}
      </p>

      <p className="mt-3 text-sm">
        {validite(joursRestants)} {usages(usagesRestants)}
      </p>

      <p role="status" aria-live="polite" className="notice mt-3">
        {message ?? (copie ? "Copié !" : "")}
      </p>

      <button
        type="button"
        onClick={copier}
        className="btn w-full"
      >
        Copier
      </button>

      <button
        type="button"
        onClick={inviter}
        disabled={enCours}
        className="btn-quiet mt-3 w-full"
      >
        {enCours ? "Un instant…" : "Créer un autre code"}
      </button>
    </div>
  );
}
