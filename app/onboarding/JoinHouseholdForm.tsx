"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { estCourseGagneeAilleurs, refusInscription } from "@/lib/foyer/erreurs";
import { MAX_PRENOM, normaliserCode, normaliserPrenom } from "@/lib/foyer/saisie";
import { useSoumission } from "@/app/_lib/useSoumission";

/**
 * Messages d'échec, en français et sans jargon (NFR-8/NFR-9). Le message de la
 * base n'est **jamais** rendu tel quel.
 *
 * « Inconnu » et « plus valable » sont distingués volontairement : les deux
 * appellent des gestes différents — re-saisir dans un cas, redemander un code
 * dans l'autre.
 */
const MESSAGES = {
  "code-vide": "Il manque le code.",
  "prenom-vide": "Il manque ton prénom.",
  "code-inconnu": "Ce code ne correspond à rien. Vérifie ce que tu as saisi.",
  "code-expire": "Ce code a expiré. Demande-lui d'en créer un nouveau.",
  "code-epuise": "Ce code a déjà servi trop de fois. Demande-lui d'en créer un nouveau.",
  "deja-membre": "Tu as déjà un foyer. On t'y ramène.",
  "session-perdue": "Ta session a expiré. Reconnecte-toi, puis reviens ici.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

type Cle = keyof typeof MESSAGES;

export function JoinHouseholdForm({
  prenom,
  onPrenomChange,
  onOccupeChange,
}: {
  prenom: string;
  onPrenomChange: (v: string) => void;
  onOccupeChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  useEffect(() => onOccupeChange(occupe), [occupe, onOccupeChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // La base compare le code EXACTEMENT — ni `upper()`, ni `trim()` côté SQL.
    const codeNormalise = normaliserCode(code);
    const prenomNet = normaliserPrenom(prenom);
    if (!codeNormalise) return refuser("code-vide");
    if (!prenomNet) return refuser("prenom-vide");

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      /*
       * Aucune pré-vérification du code n'est possible : sans foyer, la RLS
       * interdit de lire `household_invites`. On appelle, et on lit l'erreur.
       *
       * Client-direct : rejoindre n'a besoin d'aucun secret serveur, et rien de
       * rendu côté serveur n'a à être invalidé — la navigation qui suit
       * re-rendra tout (AD-13, critère de cause).
       */
      const { error } = await supabase.rpc("redeem_household_invite", {
        p_code: codeNormalise,
        p_display_name: prenomNet,
      });

      if (error) {
        /*
         * Une vraie course entre deux soumissions échoue sur la clé primaire,
         * pas sur `Profile already exists` : le contrôle d'entrée de la
         * fonction s'exécute avant, et les deux transactions le passent. L'état
         * visé est donc atteint — c'est un succès.
         */
        if (!estCourseGagneeAilleurs(error)) {
          const refus = refusInscription(error);
          /*
           * `deja-membre` ne veut PAS dire « course concurrente » : il veut dire
           * que le profil existait déjà avant la requête. Le traiter comme un
           * succès muet renvoyait vers `/` en effaçant ce que la personne
           * venait de saisir, et en affichant son ancien foyer sans un mot.
           * On le dit, puis on l'y ramène.
           */
          if (refus !== "deja-membre") return refus;
          setTimeout(() => {
            router.replace("/");
            router.refresh();
          }, 1500);
          return refus;
        }
      }

      // `current_household_id()` lit `profiles` à chaque appel : le foyer est
      // résolu dès maintenant, aucune session à rafraîchir.
      router.replace("/");
      router.refresh();
      return undefined;
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h1 className="titre-ecran">Tu rejoins quelqu&apos;un</h1>
      <p className="mt-2 text-base">
        Saisis le code qu&apos;on t&apos;a donné, et tu partages tout de suite sa
        liste, ses recettes et son menu.
      </p>

      <Notice reserve className="mt-4">{message}</Notice>

      <label htmlFor="code" className="label">
        Le code qu&apos;on t&apos;a donné
      </label>
      {/* Pas d'`autoFocus` : il place le curseur virtuel après le `<h1>` et
          l'intro, qui ne sont donc jamais restitués, et sur mobile le clavier
          recouvre immédiatement cette même zone. */}
      <input
        id="code"
        name="code"
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={32}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          effacer();
        }}
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
        maxLength={MAX_PRENOM}
        value={prenom}
        onChange={(e) => {
          onPrenomChange(e.target.value);
          effacer();
        }}
        className="input mt-2"
      />

      <button type="submit" disabled={occupe} className="btn-primaire mt-6 w-full">
        {occupe ? LIBELLE_OCCUPE : "Rejoindre"}
      </button>
    </form>
  );
}
