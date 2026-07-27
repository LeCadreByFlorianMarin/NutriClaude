"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Messages d'échec, en français et sans jargon (NFR-8/NFR-9). L'`error.message`
 * de Supabase n'est **jamais** rendu tel quel : on traduit un code connu, avec
 * un repli générique pour tout le reste.
 */
const MESSAGES: Record<string, string> = {
  "lien-expire": "Ce lien n'est plus bon. On t'en envoie un autre ?",
  "adresse-invalide": "Cette adresse n'a pas l'air valide.",
  "adresse-non-autorisee": "Cette adresse n'est pas encore autorisée pour NutriClaude.",
  /*
   * Deux plafonds distincts remontent sous le même code : une minute entre deux
   * demandes, et un petit nombre d'envois par heure. Impossible de savoir lequel
   * s'applique — le message ne promet donc pas de délai qu'il ne peut pas tenir.
   */
  "trop-de-demandes": "On en a déjà envoyé un à l'instant. Laisse passer un moment avant d'en redemander un.",
  "envoi-impossible": "Ça n'a pas marché. Réessaie dans un instant.",
};

/**
 * Traduit une erreur Supabase en clé interne. `email_address_not_authorized`
 * mérite son propre message : sans service d'envoi dédié, seules les adresses
 * rattachées au projet reçoivent quelque chose — c'est le premier écueil d'une
 * nouvelle personne du foyer.
 */
function toErrorKey(code: string | undefined, status: number | undefined): string {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "trop-de-demandes";
    case "email_address_invalid":
    case "validation_failed":
      return "adresse-invalide";
    case "email_address_not_authorized":
      return "adresse-non-autorisee";
    default:
      return status === 429 ? "trop-de-demandes" : "envoi-impossible";
  }
}

type Status = "idle" | "sending" | "sent";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  /**
   * L'erreur venue de l'URL (retour d'un lien expiré) s'affiche au premier
   * rendu, puis cède la place à toute erreur locale plus récente.
   */
  const [errorKey, setErrorKey] = useState<string | undefined>(error);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorKey(undefined);

    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        /*
         * `next` est TOUJOURS présent, même à `/` : les modèles d'email
         * concatènent `&token_hash=…` à cette URL, il leur faut une query
         * string déjà ouverte.
         *
         * `shouldCreateUser` est volontairement laissé à son défaut (`true`) :
         * la première connexion EST le parcours d'inscription (FR-40). La
         * création du foyer arrive en Story 1.3.
         */
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (sendError) {
      setErrorKey(toErrorKey(sendError.code, sendError.status));
      setStatus("idle");
      return;
    }

    setStatus("sent");
  }

  const message = errorKey ? (MESSAGES[errorKey] ?? MESSAGES["envoi-impossible"]) : undefined;

  if (status === "sent") {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold">C&apos;est parti.</h1>
        <p className="mt-3 text-base" aria-live="polite">
          Va voir ta boîte mail, le lien t&apos;attend.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="btn mt-6"
        >
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold">NutriClaude</h1>
      <p className="mt-2 text-base">
        Pas de mot de passe ici. On t&apos;envoie un lien, tu cliques, tu es connecté.
      </p>

      {/* Le message ne se distingue que par son texte et sa graisse : le rouge
          d'erreur est banni du produit, la palette n'en contient aucun (UX-DR1). */}
      <p role="status" aria-live="polite" className="notice mt-4">
        {message}
      </p>

      <label htmlFor="email" className="label">
        Ton adresse email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        autoFocus
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input mt-2"
      />

      <button
        type="submit"
        disabled={status === "sending"}
        className="btn mt-4 w-full"
      >
        {status === "sending" ? "Un instant…" : "Envoie-moi un lien"}
      </button>
    </form>
  );
}
