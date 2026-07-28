"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { MAX_PRENOM, normaliserPrenom } from "@/lib/foyer/saisie";
import { useSoumission } from "@/app/_lib/useSoumission";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  vide: "Il faut un prénom.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
  ok: "C'est noté.",
} as const;

type Cle = keyof typeof MESSAGES;

export function DisplayNameForm({
  profilId,
  prenom,
}: {
  profilId: string;
  prenom: string;
}) {
  const router = useRouter();
  const [valeur, setValeur] = useState(prenom);
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /*
     * La base refuse désormais un prénom vide (`profiles_display_name_non_vide`),
     * mais `btrim` ne voit pas les caractères invisibles qu'un copier-coller
     * depuis une messagerie transporte : la normalisation reste nécessaire ici.
     */
    const prenomNet = normaliserPrenom(valeur);
    if (!prenomNet) return refuser("vide");

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * ⚠️ Un seul champ dans le payload, jamais l'objet profil.
       *
       * Ce n'est plus la seule garde — `profiles_update_own` porte depuis le
       * 2026-07-28 un `with check (id = auth.uid() and household_id =
       * current_household_id())`, qui gèle `household_id` en base. Un payload
       * qui tenterait de le changer serait donc **refusé par Postgres**, pas
       * seulement évité par convention.
       *
       * La discipline reste bonne à tenir : elle rend l'intention lisible, et
       * elle évite d'écrire des colonnes qu'on ne voulait pas toucher. Mais la
       * frontière de sécurité est en base, comme partout ailleurs (AD-2).
       *
       * Client-direct : renommer sa propre ligne n'exige aucun secret serveur,
       * et `router.refresh()` suffit à rejouer le rendu — pas besoin d'une
       * Server Action (AD-13, critère de cause).
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
        if (error) console.error("[foyer/prenom] écriture refusée :", error.message);
        return "echec";
      }

      setValeur(data.display_name);

      // Rejoue le rendu serveur : la liste des membres juste en dessous, et le
      // « Salut … » de l'accueil, portent encore l'ancien prénom.
      router.refresh();
      return "ok";
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/*
       * Le libellé est visuellement masqué, pas supprimé.
       *
       * La passe 3 a donné un `<h2>Ton prénom</h2>` à la section (`page.tsx:69`)
       * pour que la seule chose modifiable de l'écran figure dans le plan de
       * navigation par titres. Elle n'a pas vu que ce `<label>` portait déjà ces
       * mots : relu dans les deux thèmes le 2026-07-29, l'écran affichait
       * « Ton prénom » deux fois de suite. Le `<label>` reste pour nommer le
       * champ à l'API d'accessibilité — le retirer laisserait l'`<input>` sans
       * nom, le `<h2>` ne lui étant pas associé.
       */}
      <label htmlFor="prenom" className="sr-only">
        Ton prénom
      </label>
      <p className="hint">C&apos;est ce que les autres voient.</p>

      <input
        id="prenom"
        name="prenom"
        type="text"
        required
        autoComplete="given-name"
        maxLength={MAX_PRENOM}
        value={valeur}
        onChange={(e) => {
          setValeur(e.target.value);
          effacer();
        }}
        className="input mt-2"
      />

      <Notice className="mt-3">{messageDe(MESSAGES, cle, "echec")}</Notice>

      <button type="submit" disabled={occupe} className="btn-primaire mt-4 w-full">
        {occupe ? LIBELLE_OCCUPE : "Enregistrer"}
      </button>
    </form>
  );
}
