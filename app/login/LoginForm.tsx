"use client";

import { useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { versCleMessage } from "@/lib/auth/refus-envoi";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";

/**
 * Messages d'échec, en français et sans jargon (NFR-8/NFR-9). L'`error.message`
 * de Supabase n'est **jamais** rendu tel quel : on traduit un code connu, avec
 * un repli générique pour tout le reste.
 */
const MESSAGES = {
  "lien-expire": "Ce lien n'est plus bon. On t'en envoie un autre ?",
  "adresse-invalide": "Cette adresse n'a pas l'air valide.",
  "adresse-non-autorisee":
    "Cette adresse n'est pas encore autorisée pour NutriClaude.",
  /*
   * Deux plafonds distincts remontent sous le même code : une minute entre deux
   * demandes, et un petit nombre d'envois par heure. Impossible de savoir lequel
   * s'applique — le message ne promet donc pas de délai qu'il ne peut pas tenir.
   */
  "trop-de-demandes":
    "On en a déjà envoyé un à l'instant. Laisse passer un moment avant d'en redemander un.",
  "envoi-impossible": "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

/**
 * `errorKey` reste un `string` et non `keyof typeof MESSAGES` : la valeur
 * initiale vient de l'URL (`/login?error=lien-expire`), donc de l'extérieur.
 * `messageDe` sait déjà refuser une clé inconnue — y compris `__proto__`, qui
 * cassait cet écran — et la contraindre ici obligerait à valider deux fois.
 */
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

    try {
      const supabase = createNavigateurClient();
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
        setErrorKey(versCleMessage(sendError.code, sendError.status));
        setStatus("idle");
        return;
      }

      setStatus("sent");
    } catch (cause) {
      /*
       * `signInWithOtp` relève ce qui n'est pas une `AuthError`, et la fabrique
       * de client lève si une variable d'environnement manque. Sans ce filet,
       * `status` restait à "sending" : bouton désactivé sur « Un instant… »
       * définitivement, zone de message vide, et seul un rechargement en sortait.
       */
      console.error("[login] envoi impossible :", cause);
      setErrorKey("envoi-impossible");
      setStatus("idle");
    }
  }

  const message = messageDe(MESSAGES, errorKey, "envoi-impossible");

  if (status === "sent") {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="titre-ecran">C&apos;est parti.</h1>
        <p className="mt-3 text-base">
          Va voir ta boîte mail, le lien t&apos;attend.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="btn-quiet mt-6"
        >
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h1 className="titre-ecran">NutriClaude</h1>
      <p className="mt-2 text-base">
        {/* « tu y es » plutôt que « tu es connecté » : la phrase s'adresse au
            lecteur, dont le produit ne sait rien. */}
        Pas de mot de passe ici. On t&apos;envoie un lien, tu cliques, tu y es.
      </p>

      <Notice reserve className="mt-4">{message}</Notice>

      <label htmlFor="email" className="label">
        Ton adresse email
      </label>
      {/* Pas d'`autoFocus` : il place le curseur virtuel après le `<h1>` et
          l'intro, qui ne sont donc jamais restitués, et sur mobile le clavier
          recouvre immédiatement cette même zone. */}
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="input mt-2"
      />

      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primaire mt-4 w-full"
      >
        {status === "sending" ? LIBELLE_OCCUPE : "Envoie-moi un lien"}
      </button>
    </form>
  );
}
