"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Messages d'échec, en français et sans jargon (NFR-8/NFR-9). Le message de la
 * base n'est **jamais** rendu tel quel.
 *
 * « Inconnu » et « plus valable » sont distingués volontairement : les deux
 * appellent des gestes différents — re-saisir dans un cas, redemander un code
 * dans l'autre.
 */
const MESSAGES: Record<string, string> = {
  "code-vide": "Il manque le code.",
  "prenom-vide": "Il manque ton prénom.",
  "code-inconnu": "Ce code ne correspond à rien. Vérifie ce que tu as saisi.",
  "code-expire": "Ce code a expiré. Demande-lui d'en créer un nouveau.",
  "code-epuise": "Ce code a déjà servi trop de fois. Demande-lui d'en créer un nouveau.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
};

/**
 * Traduit une levée de `redeem_household_invite` en clé interne.
 * Les messages arrivent en anglais depuis Postgres.
 */
function versCle(message: string | undefined): string {
  if (!message) return "echec";
  if (message.includes("Invalid invite code")) return "code-inconnu";
  if (message.includes("Invite expired")) return "code-expire";
  if (message.includes("no uses remaining")) return "code-epuise";
  return "echec";
}

export function JoinHouseholdForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [prenom, setPrenom] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /*
     * La base compare le code EXACTEMENT — ni `upper()`, ni `trim()` côté SQL.
     * Or les codes émis sont en majuscules. Sans cette normalisation, un code
     * dicté au téléphone et recopié « 388b 626a » serait rejeté comme inconnu,
     * alors qu'il est bon.
     */
    const codeNormalise = code.replace(/\s+/g, "").toUpperCase();
    const prenomNet = prenom.trim();
    if (!codeNormalise) return setErrorKey("code-vide");
    if (!prenomNet) return setErrorKey("prenom-vide");

    setBusy(true);
    setErrorKey(undefined);

    const supabase = createClient();
    /*
     * Aucune pré-vérification du code n'est possible : sans foyer, la RLS
     * interdit de lire `household_invites`. On appelle, et on lit l'erreur.
     *
     * Client-direct, comme la création de foyer : rejoindre n'est pas émettre,
     * ce n'est donc pas l'irréductible serveur d'AD-13.
     */
    const { error } = await supabase.rpc("redeem_household_invite", {
      p_code: codeNormalise,
      p_display_name: prenomNet,
    });

    if (error) {
      // Deux soumissions concurrentes : l'état visé est atteint, c'est un succès.
      if (!error.message?.includes("Profile already exists")) {
        setErrorKey(versCle(error.message));
        setBusy(false);
        return;
      }
    }

    // `current_household_id()` lit `profiles` à chaque appel : le foyer est
    // résolu dès maintenant, aucune session à rafraîchir.
    router.replace("/");
    router.refresh();
  }

  const message = errorKey ? (MESSAGES[errorKey] ?? MESSAGES.echec) : undefined;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold">Tu rejoins quelqu&apos;un</h1>
      <p className="mt-2 text-base">
        Saisis le code qu&apos;on t&apos;a donné, et tu partages tout de suite sa
        liste, ses recettes et son menu.
      </p>

      {/* Le message ne se distingue que par son texte et sa graisse : le rouge
          d'erreur est banni du produit, la palette n'en contient aucun (UX-DR1). */}
      <p role="status" aria-live="polite" className="notice mt-4">
        {message}
      </p>

      <label htmlFor="code" className="label">
        Le code qu&apos;on t&apos;a donné
      </label>
      <input
        id="code"
        name="code"
        type="text"
        required
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="input mt-2 uppercase tracking-[0.2em] tabular-nums"
      />

      <label htmlFor="prenom-invite" className="label mt-4">
        Ton prénom
      </label>
      <input
        id="prenom-invite"
        name="prenom"
        type="text"
        required
        autoComplete="given-name"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        className="input mt-2"
      />

      <button
        type="submit"
        disabled={busy}
        className="btn mt-6 w-full"
      >
        {busy ? "Un instant…" : "Rejoindre"}
      </button>
    </form>
  );
}
