"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { estCourseGagneeAilleurs, refusInscription } from "@/lib/foyer/erreurs";
import {
  MAX_NOM_FOYER,
  MAX_PRENOM,
  normaliserNomFoyer,
  normaliserPrenom,
} from "@/lib/foyer/saisie";
import { useSoumission } from "@/app/_lib/useSoumission";

/**
 * Messages d'échec, en français et sans jargon (NFR-8/NFR-9). Le message
 * technique de la base n'est **jamais** rendu tel quel.
 */
const MESSAGES = {
  "nom-foyer-vide": "Il manque le nom de chez toi.",
  "prenom-vide": "Il manque ton prénom.",
  "deja-membre": "Tu as déjà un foyer. On t'y ramène.",
  "session-perdue": "Ta session a expiré. Reconnecte-toi, puis reviens ici.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

type Cle = keyof typeof MESSAGES;

export function CreateHouseholdForm({
  prenom,
  onPrenomChange,
  onOccupeChange,
}: {
  prenom: string;
  onPrenomChange: (v: string) => void;
  onOccupeChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("");
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  // Le parent verrouille la bascule de mode pendant la soumission : sans cela,
  // basculer pendant l'aller-retour démontait ce formulaire, et la promesse en
  // vol emmenait ensuite l'utilisateur ailleurs que là où il venait d'aller.
  useEffect(() => onOccupeChange(occupe), [occupe, onOccupeChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /*
     * ⚠️ Ici, le filet applicatif compte double.
     *
     * `households.name` n'a reçu sa contrainte `check` qu'après cet écran
     * (migration du 2026-07-28) : avant elle, cette normalisation était la
     * SEULE protection contre un nom de foyer vide — et un commentaire affirmait
     * le contraire. Même avec la contrainte, `btrim` ne voit pas les caractères
     * invisibles qu'un copier-coller depuis une messagerie transporte.
     */
    const foyer = normaliserNomFoyer(householdName);
    const prenomNet = normaliserPrenom(prenom);
    if (!foyer) return refuser("nom-foyer-vide");
    if (!prenomNet) return refuser("prenom-vide");

    await soumettre(async () => {
      const supabase = createNavigateurClient();
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
        p_display_name: prenomNet,
      });

      if (error) {
        // Une vraie course échoue sur la clé primaire : l'état visé est atteint.
        if (!estCourseGagneeAilleurs(error)) {
          /*
           * Créer un foyer ne peut pas produire de refus d'invitation : on
           * ramène donc la taxonomie partagée aux seules clés que cet écran sait
           * dire. Le compilateur l'exige, et c'est bien ainsi — une clé sans
           * message afficherait un repli à la place du bon texte.
           */
          const brut = refusInscription(error);
          const refus: Cle =
            brut === "deja-membre" || brut === "session-perdue" ? brut : "echec";
          /*
           * `deja-membre` signifie que le profil existait AVANT la requête, pas
           * qu'il y a eu concurrence. Le traiter en succès muet renvoyait vers
           * `/` en effaçant le nom de foyer saisi — qui n'avait jamais été créé —
           * et en affichant l'ancien foyer, sans un mot.
           */
          if (refus !== "deja-membre") return refus;
          setTimeout(() => {
            router.replace("/");
            router.refresh();
          }, 1500);
          return refus;
        }
      }

      // Inutile de rafraîchir la session : `current_household_id()` lit la table
      // `profiles` à chaque appel, il résout le foyer dès maintenant.
      router.replace("/");
      router.refresh();
      return undefined;
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <h1 className="titre-ecran">On installe ta cuisine</h1>
      <p className="mt-2 text-base">
        Deux infos et c&apos;est réglé. Tu pourras inviter du monde juste après.
      </p>

      <Notice reserve className="mt-4">{message}</Notice>

      <label htmlFor="household" className="label">
        Le nom de chez toi
      </label>
      {/* Pas d'`autoFocus` : il place le curseur virtuel après le `<h1>` et
          l'intro, qui ne sont donc jamais restitués, et sur mobile le clavier
          recouvre immédiatement cette même zone. */}
      <input
        id="household"
        name="household"
        type="text"
        required
        placeholder="Chez les Marin"
        maxLength={MAX_NOM_FOYER}
        value={householdName}
        onChange={(e) => {
          setHouseholdName(e.target.value);
          effacer();
        }}
        className="input mt-2"
      />

      <label htmlFor="prenom" className="label mt-4">
        Mon prénom
      </label>
      <input
        id="prenom"
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
        {occupe ? LIBELLE_OCCUPE : "C'est parti"}
      </button>
    </form>
  );
}
