"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Messages d'échec, en français et sans jargon (NFR-8/NFR-9). Le message
 * technique de la base n'est **jamais** rendu tel quel.
 */
const MESSAGES: Record<string, string> = {
  "nom-foyer-vide": "Il manque le nom de chez toi.",
  "prenom-vide": "Il manque ton prénom.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
};

export function CreateHouseholdForm() {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // La base accepterait une chaîne vide (`not null` ne dit rien du contenu) ;
    // nous non.
    const foyer = householdName.trim();
    const prenom = displayName.trim();
    if (!foyer) return setErrorKey("nom-foyer-vide");
    if (!prenom) return setErrorKey("prenom-vide");

    setBusy(true);
    setErrorKey(undefined);

    const supabase = createClient();
    /*
     * Une seule opération : la fonction crée le foyer ET rattache le profil dans
     * la même transaction. Écrire soi-même dans `households` puis `profiles`
     * laisserait un foyer orphelin si la seconde écriture échouait.
     *
     * Elle amorce aussi les rayons par défaut du foyer — comportement de la base,
     * pas du client : il n'y a rien à ajouter ici.
     */
    const { error } = await supabase.rpc("create_household_with_profile", {
      p_household_name: foyer,
      p_display_name: prenom,
    });

    if (error) {
      /*
       * `Profile already exists` = deux soumissions concurrentes. L'état visé est
       * atteint : c'est un succès, pas un échec.
       */
      if (!error.message?.includes("Profile already exists")) {
        setErrorKey("echec");
        setBusy(false);
        return;
      }
    }

    // Inutile de rafraîchir la session : `current_household_id()` lit la table
    // `profiles` à chaque appel, il résout le foyer dès maintenant.
    router.replace("/");
    router.refresh();
  }

  const message = errorKey ? (MESSAGES[errorKey] ?? MESSAGES.echec) : undefined;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold">On installe ta cuisine</h1>
      <p className="mt-2 text-base">
        Deux infos et c&apos;est réglé. Tu pourras inviter du monde juste après.
      </p>

      {/* Le message ne se distingue que par le texte : la palette n'existe pas
          encore, et le rouge d'erreur est banni du produit (UX-DR1). */}
      <p role="status" aria-live="polite" className="mt-4 min-h-6 text-base font-medium">
        {message}
      </p>

      <label htmlFor="household" className="block text-sm font-medium">
        Le nom de chez toi
      </label>
      <input
        id="household"
        name="household"
        type="text"
        required
        autoFocus
        placeholder="Chez les Marin"
        value={householdName}
        onChange={(e) => setHouseholdName(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      />

      <label htmlFor="prenom" className="mt-4 block text-sm font-medium">
        Ton prénom
      </label>
      <input
        id="prenom"
        name="prenom"
        type="text"
        required
        autoComplete="given-name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="mt-2 min-h-11 w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      />

      <button
        type="submit"
        disabled={busy}
        className="mt-6 min-h-11 w-full rounded-lg border border-current/30 px-4 py-2 font-medium disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {busy ? "Un instant…" : "C'est parti"}
      </button>
    </form>
  );
}
