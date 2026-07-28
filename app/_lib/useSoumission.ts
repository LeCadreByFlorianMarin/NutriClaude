"use client";

import { useState } from "react";

/**
 * État de soumission d'un formulaire : « occupé » et « message à afficher ».
 *
 * Ce squelette existait en trois copies, et les copies avaient déjà divergé :
 * seul `DisplayNameForm` effaçait le message quand l'utilisateur retouchait le
 * champ, si bien qu'ailleurs on corrigeait son prénom et « Il manque ton
 * prénom » restait affiché.
 *
 * ⚠️ Le `finally` est la raison d'être du hook. Aucun des formulaires n'en avait,
 * et tous les `await` pouvaient lever plutôt que rendre une erreur —
 * `signInWithOtp` relève ce qui n'est pas une `AuthError`, la fabrique de client
 * lève si une variable d'environnement manque, un appel de Server Action peut
 * rejeter en transport. Le bouton restait alors désactivé sur « Un instant… »
 * définitivement, avec une zone de message vide : seul un rechargement de page
 * en sortait.
 */
export function useSoumission<C extends string>(initiale?: C) {
  const [occupe, setOccupe] = useState(false);
  const [cle, setCle] = useState<C | undefined>(initiale);

  /** Signale un refus sans rien exécuter — pour les contrôles de saisie. */
  const refuser = (raison: C) => {
    setCle(raison);
    setOccupe(false);
  };

  /** Efface le message : à câbler sur la modification des champs. */
  const effacer = () => setCle(undefined);

  /**
   * Exécute `action`. Si elle rend une clé, c'est un refus ; `undefined` vaut
   * succès. Le drapeau « occupé » retombe quoi qu'il arrive.
   */
  async function soumettre(action: () => Promise<C | undefined>) {
    setOccupe(true);
    setCle(undefined);
    try {
      const refus = await action();
      if (refus !== undefined) setCle(refus);
    } catch (cause) {
      console.error("[soumission] exception :", cause);
      setCle("echec" as C);
    } finally {
      setOccupe(false);
    }
  }

  return { occupe, cle, refuser, effacer, soumettre };
}
