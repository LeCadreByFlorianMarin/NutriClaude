"use client";

import { useEffect } from "react";

/**
 * Filet de dernier recours. Il attrape ce qui casse dans les pages et leurs
 * enfants — pas le layout racine, qui relèverait de `global-error.tsx`.
 *
 * ⚠️ **`error.message` ne franchit jamais le JSX.** Next masque le message des
 * erreurs venues du serveur, mais **transmet celui des Client Components tel
 * quel** — or ce dépôt en a quatre qui parlent à la base. Un message anglais et
 * technique à l'écran, c'est exactement ce que NFR-8 interdit. La console n'est
 * pas l'écran : y journaliser est permis, l'afficher ne l'est pas. `digest`
 * non plus — c'est un identifiant technique.
 *
 * La prop de reprise s'appelle `unstable_retry` depuis Next 16.2, et ce n'est
 * pas un synonyme de `reset` : elle **refait la requête** avant de re-rendre,
 * là où `reset` se contente de vider l'état du périmètre. Sur une page qui lit
 * le foyer en base, c'est la différence entre réessayer et réafficher la même
 * erreur.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold">Ça a coincé.</h1>
        <p className="mt-3 text-base">
          On ne sait pas trop pourquoi. Tu peux réessayer.
        </p>
        <button type="button" onClick={() => unstable_retry()} className="btn mt-6 w-full">
          Réessayer
        </button>
      </div>
    </main>
  );
}
