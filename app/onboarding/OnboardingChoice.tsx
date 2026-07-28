"use client";

import { useCallback, useState } from "react";
import { CreateHouseholdForm } from "./CreateHouseholdForm";
import { JoinHouseholdForm } from "./JoinHouseholdForm";

/**
 * Deux portes d'entrée dans un foyer : le créer, ou en rejoindre un avec un
 * code (AD-16).
 *
 * **Créer est le défaut**, et ce n'est pas arbitraire : la personne invitée sait
 * qu'elle a un code et le cherchera ; celle qui découvre le produit, non.
 *
 * Ce composant ne fait que choisir — mais il porte deux états que les
 * formulaires ne peuvent pas garder eux-mêmes :
 *
 *  - **le prénom**, parce qu'il est demandé par les deux. Le laisser dans chaque
 *    enfant le faisait disparaître au basculement : on remplissait « Ton
 *    prénom », on se rappelait qu'on avait un code, et on retrouvait le champ
 *    vide ;
 *  - **l'occupation**, pour verrouiller la bascule pendant une soumission. Sans
 *    cela, basculer en plein aller-retour démontait le formulaire actif, et sa
 *    promesse en vol emmenait ensuite l'utilisateur ailleurs que là où il venait
 *    d'aller — ou écrivait son erreur dans un composant démonté, où elle
 *    disparaissait sans un mot.
 */
export function OnboardingChoice() {
  const [mode, setMode] = useState<"creer" | "rejoindre">("creer");
  const [prenom, setPrenom] = useState("");
  const [occupe, setOccupe] = useState(false);

  // Stable : les enfants la placent en dépendance d'un `useEffect`.
  const signalerOccupation = useCallback((v: boolean) => setOccupe(v), []);

  const bascule = "btn-quiet mt-6 w-full";

  if (mode === "rejoindre") {
    return (
      <div className="w-full max-w-sm">
        <JoinHouseholdForm
          prenom={prenom}
          onPrenomChange={setPrenom}
          onOccupeChange={signalerOccupation}
        />
        <button
          type="button"
          onClick={() => setMode("creer")}
          disabled={occupe}
          className={bascule}
        >
          Finalement, je crée le mien
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <CreateHouseholdForm
        prenom={prenom}
        onPrenomChange={setPrenom}
        onOccupeChange={signalerOccupation}
      />
      <button
        type="button"
        onClick={() => setMode("rejoindre")}
        disabled={occupe}
        className={bascule}
      >
        J&apos;ai un code
      </button>
    </div>
  );
}
