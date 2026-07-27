"use client";

import { useState } from "react";
import { CreateHouseholdForm } from "./CreateHouseholdForm";
import { JoinHouseholdForm } from "./JoinHouseholdForm";

/**
 * Deux portes d'entrée dans un foyer : le créer, ou en rejoindre un avec un
 * code (AD-16).
 *
 * **Créer est le défaut**, et ce n'est pas arbitraire : la personne invitée sait
 * qu'elle a un code et le cherchera ; celle qui découvre le produit, non.
 *
 * Ce composant ne fait que choisir. Les deux formulaires restent autonomes —
 * `CreateHouseholdForm` n'a rien eu à changer pour accueillir le second.
 */
export function OnboardingChoice() {
  const [mode, setMode] = useState<"creer" | "rejoindre">("creer");

  const bascule =
    "mt-6 min-h-11 w-full rounded-lg px-4 py-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

  if (mode === "rejoindre") {
    return (
      <div className="w-full max-w-sm">
        <JoinHouseholdForm />
        <button type="button" onClick={() => setMode("creer")} className={bascule}>
          Finalement, je crée le mien
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <CreateHouseholdForm />
      <button type="button" onClick={() => setMode("rejoindre")} className={bascule}>
        J&apos;ai un code
      </button>
    </div>
  );
}
