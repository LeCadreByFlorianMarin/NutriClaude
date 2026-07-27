"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES: Record<string, string> = {
  vide: "Il faut un prénom.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
  ok: "C'est noté.",
};

export function DisplayNameForm({
  profilId,
  prenom,
}: {
  profilId: string;
  prenom: string;
}) {
  const router = useRouter();
  const [valeur, setValeur] = useState(prenom);
  const [busy, setBusy] = useState(false);
  const [cle, setCle] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // La colonne est `not null`, mais elle accepte la chaîne vide : la base ne
    // rattrapera pas un prénom fait de trois espaces.
    const prenomNet = valeur.trim();
    if (!prenomNet) return setCle("vide");

    setBusy(true);
    setCle(undefined);

    const supabase = createClient();

    /*
     * ⚠️ Un seul champ dans le payload, jamais l'objet profil.
     * `profiles_update_own` n'a pas de `with check` : Postgres réutilise alors
     * son `using (id = auth.uid())` comme contrôle d'écriture, qui ne porte donc
     * que sur `id`. Toutes les autres colonnes de sa propre ligne — dont
     * `household_id` — sont librement modifiables. La discipline est ici.
     *
     * Client-direct, comme la création de foyer et le rachat d'invitation :
     * renommer sa propre ligne n'est pas de l'émission, donc pas l'irréductible
     * serveur d'AD-13.
     */
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: prenomNet })
      .eq("id", profilId)
      .select("display_name")
      .maybeSingle();

    /*
     * `data` autant qu'`error` : un update qui ne touche aucune ligne est un
     * succès pour PostgREST. Sans cette lecture de retour, un refus de la RLS
     * afficherait « c'est noté » sans que rien ne soit écrit.
     */
    if (error || !data) {
      setCle("echec");
      setBusy(false);
      return;
    }

    setValeur(data.display_name);
    setCle("ok");
    setBusy(false);

    // Rejoue le rendu serveur : la liste des membres juste en dessous, et le
    // « Salut … » de l'accueil, portent encore l'ancien prénom.
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="prenom" className="label">
        Ton prénom
      </label>
      <p className="hint mt-1">C&apos;est ce que les autres voient.</p>

      <input
        id="prenom"
        name="prenom"
        type="text"
        required
        autoComplete="given-name"
        value={valeur}
        onChange={(e) => {
          setValeur(e.target.value);
          setCle(undefined);
        }}
        className="input mt-2"
      />

      {/* Le message ne se distingue que par son texte et sa graisse : le rouge
          d'erreur est banni du produit, la palette n'en contient aucun (UX-DR1). */}
      <p role="status" aria-live="polite" className="notice mt-3">
        {cle ? (MESSAGES[cle] ?? MESSAGES.echec) : ""}
      </p>

      <button
        type="submit"
        disabled={busy}
        className="btn w-full"
      >
        {busy ? "Un instant…" : "Enregistrer"}
      </button>
    </form>
  );
}
