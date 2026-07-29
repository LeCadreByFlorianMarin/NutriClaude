"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { EcranMessage } from "@/app/_lib/EcranMessage";

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
 *
 * Nommée `FrontiereErreur` et non `Error` : l'export par défaut portait le nom
 * du constructeur global et le masquait dans tout le module.
 */
export default function FrontiereErreur({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const titre = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  /*
   * Remplacer la page sans déplacer le focus laissait un utilisateur au clavier
   * ou au lecteur d'écran avec le curseur retombé sur `<body>`, sans savoir que
   * quoi que ce soit avait changé.
   */
  useEffect(() => {
    titre.current?.focus();
  }, []);

  return (
    <EcranMessage
      titre="Ça a coincé."
      titreRef={titre}
      role="alert"
      action={
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="btn-primaire w-full"
        >
          Réessayer
        </button>
      }
      secondaire={
        /* Une seconde sortie : cet écran est aussi celui qu'on atteint quand le
           service d'authentification est injoignable, cas où réessayer échouera
           tout autant. Sans elle, l'utilisateur était enfermé. */
        <Link href="/" className="btn-quiet">
          Revenir à l&apos;accueil
        </Link>
      }
    >
      On ne sait pas trop pourquoi. Tu peux réessayer.
    </EcranMessage>
  );
}
