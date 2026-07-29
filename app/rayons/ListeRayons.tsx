"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { refusRayon } from "@/lib/rayons/erreurs";
import type { Rayon } from "@/lib/rayons/rayons";
import {
  MAX_NOM_RAYON,
  normaliserIcone,
  normaliserNomRayon,
  prochainOrdre,
} from "@/lib/rayons/saisie";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  vide: "Il faut un nom.",
  "nom-vide": "Il faut un nom.",
  "nom-pris": "Ce rayon existe déjà.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
  cree: "C'est noté.",
  modifie: "C'est noté.",
  supprime: "Le rayon est parti.",
  restaure: "Les rayons de départ sont revenus.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * L'écran des rayons : créer, renommer, ré-iconifier, supprimer.
 *
 * ⚠️ **Écritures client-direct, pas de Server Action** — et le critère est la
 * cause, pas l'analogie de vocabulaire (AD-13, formulation du 2026-07-28) : une
 * écriture passe par une Server Action si elle exige un secret serveur, ou si sa
 * conséquence doit apparaître dans un rendu serveur. Ici, ni l'un ni l'autre :
 * la conséquence est locale à cet écran, et `router.refresh()` la rejoue. C'est
 * le motif exact de `DisplayNameForm`. À contre-exemple, `genererInvitation` est
 * une Server Action *malgré* l'absence de secret, parce que `/foyer` doit
 * montrer le code immédiatement.
 *
 * ⚠️ **Aucune copie locale de la liste.** L'état de ce composant ne porte que
 * l'interface — quelle ligne est ouverte, quelle suppression attend
 * confirmation. La liste vient des propriétés, et `router.refresh()` la
 * rafraîchit. Une copie locale divergerait dès que l'autre membre du foyer
 * écrit, et il n'y a pas encore de propagation temps réel (AD-8, Epic 4).
 *
 * Conséquence assumée : pas de mise à jour optimiste, donc un temps de latence
 * entre le geste et son reflet. C'est acceptable ici — l'outbox et l'optimisme
 * d'AD-5 concernent les surfaces liste, au supermarché, pas un écran de
 * configuration au calme.
 */
export function ListeRayons({
  rayons,
  foyerId,
}: {
  rayons: Rayon[];
  foyerId: string;
}) {
  const router = useRouter();
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  /** Le rayon ouvert en édition, et la saisie en cours pour lui. */
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [iconeEditee, setIconeEditee] = useState("");
  /** Le rayon dont la suppression attend une confirmation. */
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleIcone, setNouvelleIcone] = useState("");

  function ouvrir(rayon: Rayon) {
    effacer();
    setEnEdition(rayon.id);
    setNomEdite(rayon.nom);
    setIconeEditee(rayon.icone ?? "");
    setAConfirmer(null);
  }

  function fermer() {
    setEnEdition(null);
    setAConfirmer(null);
  }

  async function creer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nom = normaliserNomRayon(nouveauNom);
    if (!nom) return refuser("vide");

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * `household_id` est explicite : la colonne est `not null` et n'a pas de
       * défaut. Ce n'est pas une garde — `aisles_all` porte
       * `with check (household_id = current_household_id())`, donc une valeur
       * étrangère serait refusée par Postgres. La frontière est en base (AD-2).
       *
       * `sort_order` est calculé et jamais laissé au défaut de la colonne :
       * il vaut 100, et 100 est déjà pris par « Hygiène & Entretien ».
       * Voir `prochainOrdre`.
       */
      const { data, error } = await supabase
        .from("aisles")
        .insert({
          household_id: foyerId,
          name: nom,
          icon: normaliserIcone(nouvelleIcone),
          sort_order: prochainOrdre(rayons),
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[rayons] création refusée :", error.message);
        return refusRayon(error);
      }

      setNouveauNom("");
      setNouvelleIcone("");
      router.refresh();
      return "cree";
    });
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enEdition) return;

    const nom = normaliserNomRayon(nomEdite);
    if (!nom) return refuser("vide");

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { data, error } = await supabase
        .from("aisles")
        .update({ name: nom, icon: normaliserIcone(iconeEditee) })
        .eq("id", enEdition)
        .select("id")
        .maybeSingle();

      /*
       * `data` autant qu'`error` : un update qui ne touche aucune ligne est un
       * succès pour PostgREST. Sans cette lecture de retour, un refus de la RLS
       * afficherait « c'est noté » sans que rien ne soit écrit.
       */
      if (error || !data) {
        if (error) console.error("[rayons] écriture refusée :", error.message);
        return refusRayon(error);
      }

      fermer();
      router.refresh();
      return "modifie";
    });
  }

  async function supprimer(id: string) {
    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { data, error } = await supabase
        .from("aisles")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

      // Même raison que pour l'update : zéro ligne supprimée n'est pas une
      // erreur pour PostgREST, mais ce n'est pas une suppression non plus.
      if (error || !data) {
        if (error) console.error("[rayons] suppression refusée :", error.message);
        return refusRayon(error);
      }

      fermer();
      router.refresh();
      return "supprime";
    });
  }

  async function restaurer() {
    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * La fonction recontrôle le foyer elle-même depuis le 2026-07-29
       * (`20260729095922_guard_seed_default_aisles.sql`) : elle est
       * `security definer`, donc la RLS ne s'y applique pas, et son paramètre
       * était une porte ouverte sur les rayons des autres foyers. Passer
       * `foyerId` ici n'est donc pas une auto-autorisation — c'est la base qui
       * tranche.
       *
       * Idempotente : `on conflict (household_id, name) do nothing`.
       */
      const { error } = await supabase.rpc("seed_default_aisles", {
        p_household_id: foyerId,
      });

      if (error) {
        console.error("[rayons] restauration refusée :", error.message);
        return "echec";
      }

      router.refresh();
      return "restaure";
    });
  }

  /*
   * Une seule région de statut, hissée hors des conditionnels. Deux branches
   * rendant chacune la leur, à des positions différentes de l'arbre, laissaient
   * un message posé au moment du basculement ne pas être annoncé de façon
   * fiable — constat de `InviteCard`.
   */
  const statut = <Notice className="mt-2">{messageDe(MESSAGES, cle, "echec")}</Notice>;

  return (
    <div>
      <section>
        <h2 className="titre-section">Ton parcours</h2>
        {statut}

        {rayons.length === 0 ? (
          <div className="mt-2">
            <p className="text-base">Il n&apos;y a plus aucun rayon.</p>
            <p className="hint mt-1">
              Ajoutes-en un juste en dessous, ou remets ceux de départ.
            </p>
            <button
              type="button"
              onClick={restaurer}
              disabled={occupe}
              className="btn mt-4 w-full"
            >
              {occupe ? LIBELLE_OCCUPE : "Remettre les rayons de départ"}
            </button>
          </div>
        ) : (
          <ul className="mt-2">
            {rayons.map((rayon) => (
              <li key={rayon.id} className="border-b border-card-border last:border-0">
                {enEdition === rayon.id ? (
                  <form onSubmit={enregistrer} className="py-3">
                    {/*
                      Deux libellés visuellement masqués plutôt qu'aucun :
                      l'en-tête de la ligne ne nomme pas les champs à l'API
                      d'accessibilité, et un `<input>` sans nom accessible est
                      muet au lecteur d'écran.
                    */}
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0">
                        <label htmlFor={`icone-${rayon.id}`} className="sr-only">
                          Emoji du rayon
                        </label>
                        <input
                          id={`icone-${rayon.id}`}
                          type="text"
                          inputMode="text"
                          /*
                            Borne large, et jamais 1 : `maxLength` compte des
                            unités UTF-16, et un drapeau en occupe 4 — à 1, le
                            clavier ne laisserait même pas le saisir. La
                            réduction au premier grapheme se fait à la
                            soumission, dans `normaliserIcone`.
                          */
                          maxLength={16}
                          value={iconeEditee}
                          onChange={(e) => {
                            setIconeEditee(e.target.value);
                            effacer();
                          }}
                          className="input text-center"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <label htmlFor={`nom-${rayon.id}`} className="sr-only">
                          Nom du rayon
                        </label>
                        <input
                          id={`nom-${rayon.id}`}
                          type="text"
                          required
                          maxLength={MAX_NOM_RAYON}
                          value={nomEdite}
                          onChange={(e) => {
                            setNomEdite(e.target.value);
                            effacer();
                          }}
                          className="input"
                        />
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={occupe}
                        className="btn-primaire flex-1"
                      >
                        {occupe ? LIBELLE_OCCUPE : "Enregistrer"}
                      </button>
                      <button
                        type="button"
                        onClick={fermer}
                        disabled={occupe}
                        className="btn-quiet"
                      >
                        Annuler
                      </button>
                    </div>

                    {/*
                      Confirmation en deux temps plutôt qu'une boîte de dialogue
                      native : `window.confirm` est hors thème, hors ton, et
                      bloque toute vérification pilotée par navigateur. Motif
                      d'`InviteCard`.
                    */}
                    <div className="mt-6 flex items-center justify-between gap-2">
                      {aConfirmer === rayon.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => supprimer(rayon.id)}
                            disabled={occupe}
                            className="btn-quiet"
                          >
                            {occupe ? LIBELLE_OCCUPE : "Confirmer"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAConfirmer(null)}
                            disabled={occupe}
                            className="btn-quiet"
                          >
                            Non
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAConfirmer(rayon.id)}
                          disabled={occupe}
                          className="btn-quiet"
                        >
                          Supprimer ce rayon
                        </button>
                      )}
                    </div>

                    {aConfirmer === rayon.id ? (
                      <p className="hint mt-2">
                        Ce rayon disparaît de ton parcours.
                      </p>
                    ) : null}
                  </form>
                ) : (
                  /*
                    Toute la ligne est le bouton, et c'est le seul de la ligne :
                    une cible unique, généreuse, plutôt que deux petits liens
                    côte à côte sur une largeur de téléphone.
                  */
                  <button
                    type="button"
                    onClick={() => ouvrir(rayon)}
                    aria-label={`Modifier ${rayon.nom}`}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-3
                               py-2 text-left text-base"
                  >
                    {/* L'emoji est décoratif : le nom est déjà en texte juste à
                        côté, et le lire deux fois n'apporte rien (UX-DR4). */}
                    <span aria-hidden="true" className="w-6 shrink-0 text-center">
                      {rayon.icone ?? ""}
                    </span>
                    <span className="min-w-0 flex-1 break-all">{rayon.nom}</span>
                    <span aria-hidden="true" className="hint shrink-0">
                      Modifier
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Ajouter un rayon</h2>

        <form onSubmit={creer} className="mt-2">
          <div className="flex gap-2">
            <span className="w-16 shrink-0">
              <label htmlFor="nouvelle-icone" className="sr-only">
                Emoji du rayon
              </label>
              <input
                id="nouvelle-icone"
                type="text"
                maxLength={16}
                placeholder="🥬"
                value={nouvelleIcone}
                onChange={(e) => {
                  setNouvelleIcone(e.target.value);
                  effacer();
                }}
                className="input text-center"
              />
            </span>
            <span className="min-w-0 flex-1">
              <label htmlFor="nouveau-nom" className="sr-only">
                Nom du rayon
              </label>
              <input
                id="nouveau-nom"
                type="text"
                required
                maxLength={MAX_NOM_RAYON}
                placeholder="Fromages"
                value={nouveauNom}
                onChange={(e) => {
                  setNouveauNom(e.target.value);
                  effacer();
                }}
                className="input"
              />
            </span>
          </div>

          <p className="hint mt-2">
            Il arrive à la fin du parcours. Tu pourras le déplacer plus tard.
          </p>

          <button type="submit" disabled={occupe} className="btn-primaire mt-3 w-full">
            {occupe ? LIBELLE_OCCUPE : "Ajouter"}
          </button>
        </form>
      </section>
    </div>
  );
}
