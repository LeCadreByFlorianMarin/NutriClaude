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
        <p role="status" aria-live="polite" className="mt-3 min-h-6 text-base font-medium">
          {message}
        </p>
        <button
          type="button"
          onClick={inviter}
          disabled={enCours}
          className="mt-2 min-h-11 w-full rounded-lg border border-current/30 px-4 py-2 font-medium disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {enCours ? "Un instant…" : "Inviter quelqu'un"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Le code sera lu à voix haute ou recopié : taille et espacement font
          tout le travail, aucune couleur n'est disponible avant la Story 1.7. */}
      <p
        className="rounded-lg border border-current/30 px-4 py-6 text-center text-3xl font-semibold tabular-nums tracking-[0.25em] select-all"
        aria-label={`Code d'invitation : ${code.split("").join(" ")}`}
      >
        {code}
      </p>

      <p className="mt-3 text-sm">
        {validite(joursRestants)} {usages(usagesRestants)}
      </p>

      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-base font-medium">
        {message ?? (copie ? "Copié !" : "")}
      </p>

      <button
        type="button"
        onClick={copier}
        className="min-h-11 w-full rounded-lg border border-current/30 px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        Copier
      </button>

      <button
        type="button"
        onClick={inviter}
        disabled={enCours}
        className="mt-3 min-h-11 w-full rounded-lg px-4 py-2 text-sm underline underline-offset-4 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {enCours ? "Un instant…" : "Créer un autre code"}
      </button>
    </div>
  );
}
