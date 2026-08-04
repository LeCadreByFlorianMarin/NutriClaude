"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { analyserPersonnes } from "@/lib/personnes";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  illisible: "Un nombre de personnes s'écrit en chiffres.",
  /*
   * ⚠️ **Le même texte que le refus de la base.** L'écran refuse 0 et le négatif ;
   * `households_default_servings_positif` refuse la même chose pour les appels qui
   * ne passent pas par l'écran. Deux formulations diraient qu'il s'est passé deux
   * choses différentes, alors qu'une seule règle a parlé. L'accord entre les deux
   * est mesuré par `supabase/tests/contraintes.test.ts`, pas affirmé ici.
   */
  invalide: "Il faut au moins une personne.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
  ok: "C'est noté.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Combien on est à la maison — la valeur proposée quand on met une recette au
 * menu.
 *
 * ⚠️ **LA PREMIÈRE ÉCRITURE DU PRODUIT DANS `households`.** L'onboarding crée la
 * ligne ; aucun écran ne l'avait jamais modifiée depuis. `households_update`
 * existe pourtant depuis le squelette (`initial_schema.sql:250-251`) et est
 * éprouvée par `supabase/tests/isolation.test.ts:214-223` — une politique RLS
 * s'appliquant par LIGNE et non par colonne, il n'y avait rien à ajouter côté
 * base pour cette colonne, et un test de plus aurait été de la redondance.
 *
 * ⚠️ **Écriture client-direct** (AD-13) : ni secret serveur, ni conséquence à
 * faire apparaître dans un rendu serveur. Motif de `DisplayNameForm`.
 *
 * ⚠️ **Ce réglage ne réécrit AUCUNE assignation existante.** Il est lu à
 * l'ouverture d'un formulaire d'assignation, et nulle part ailleurs. Une case déjà
 * posée garde son propre nombre — un `update` en masse effacerait en silence des
 * ajustements délibérés.
 */
export function PersonnesForm({
  foyerId,
  personnes,
}: {
  foyerId: string;
  personnes: number;
}) {
  const router = useRouter();
  const [valeur, setValeur] = useState(String(personnes));
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /*
     * La règle vit dans `lib/personnes.ts`, partagée avec l'écran d'assignation :
     * deux copies auraient divergé, et c'est elle dont l'accord avec
     * `households_default_servings_positif` est **mesuré**
     * (`supabase/tests/contraintes.test.ts`).
     *
     * ⚠️ **Deux refus distincts**, et l'en-tête du module dit pourquoi : « 0 » est
     * parfaitement lisible, et répondre « ça s'écrit en chiffres » à quelqu'un qui
     * vient d'écrire un chiffre est un conseil qu'il a déjà suivi.
     */
    const analyse = analyserPersonnes(valeur);
    if ("faute" in analyse) {
      return refuser(analyse.faute === "illisible" ? "illisible" : "invalide");
    }
    const combien = analyse.valeur;

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      // Un seul champ dans le payload, jamais l'objet foyer : la discipline rend
      // l'intention lisible et évite d'écrire des colonnes qu'on ne voulait pas
      // toucher. La frontière, elle, est en base (AD-2).
      const { data, error } = await supabase
        .from("households")
        .update({ default_servings: combien })
        .eq("id", foyerId)
        .select("default_servings")
        .maybeSingle();

      /*
       * ⚠️ **`data` autant qu'`error`.** Un `update` que la RLS masque rend zéro
       * ligne et **aucune erreur** : sans cette lecture de retour, l'écran
       * annoncerait « C'est noté. » sur une écriture qui n'a rien touché. Motif de
       * `DisplayNameForm.tsx:70-78`.
       */
      if (error || !data) {
        if (error) console.error("[foyer/personnes] écriture refusée :", error.message);
        return "echec";
      }

      setValeur(String(data.default_servings));

      /*
       * Rejoue le rendu serveur : l'écran d'assignation lit cette valeur, et rien
       * d'autre sur CETTE page ne l'affiche — mais le cache de route la porterait
       * encore au retour par le bouton du navigateur.
       */
      router.refresh();
      return "ok";
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");

  return (
    /*
     * ⚠️ **`noValidate`, et ce n'est PAS une désactivation de contrôle.** Sans lui,
     * `min={1}` fait refuser la soumission par le NAVIGATEUR, qui affiche son
     * propre message — « Value must be greater than or equal to 1. », **en
     * anglais**, hors de toute région `aria-live`, et hors du ton du produit
     * (NFR-8/NFR-9). Pire : `handleSubmit` n'est alors jamais appelé, donc « Il
     * faut au moins une personne. » ne peut **jamais** s'afficher — une clé de
     * message sans appelant, la dette que ce dépôt a déjà eue à retirer.
     *
     * **Trouvé par le parcours à l'écran du 2026-08-04**, pas par une porte : les
     * six portes étaient vertes. C'est la règle §7 de `project-context.md`.
     *
     * `min={1}` reste sur le champ : il contraint les flèches du sélecteur
     * numérique, qui ne descendent pas sous 1. C'est une affordance, et elle
     * survit à `noValidate`. La frontière, elle, est en base
     * (`households_default_servings_positif`), et le refus lisible est ici.
     */
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="personnes-foyer" className="label">
        On est
      </label>
      <input
        id="personnes-foyer"
        type="number"
        inputMode="numeric"
        min={1}
        value={valeur}
        onChange={(e) => {
          setValeur(e.target.value);
          effacer();
        }}
        disabled={occupe}
        className="input mt-1 tabular-nums"
      />

      <p className="hint mt-2">
        C&apos;est ce qu&apos;on te proposera quand tu mettras une recette au menu.
        Tu peux toujours changer, repas par repas. Ça vaut pour tout le foyer.
      </p>

      {/*
        La région de statut de CE formulaire, au-dessus de son bouton. `reserve`
        parce qu'elle le surplombe : sans elle, un message pousserait la cible sous
        le doigt au moment du clic (contrat de `Notice`).

        ⚠️ C'est la TROISIÈME région de cet écran, et c'est le point. `/foyer` en
        portait deux — `DisplayNameForm` et `InviteCard` — et le défaut « un
        message rendu dans une région qui n'existe pas » a été trouvé DEUX fois de
        suite sur `/rayons`, la première correction ayant créé deux régions pour
        trois surfaces de soumission.
      */}
      <Notice reserve className="mt-3">
        {message}
      </Notice>

      <button type="submit" disabled={occupe} className="btn mt-3">
        {occupe ? LIBELLE_OCCUPE : "Enregistrer"}
      </button>
    </form>
  );
}
