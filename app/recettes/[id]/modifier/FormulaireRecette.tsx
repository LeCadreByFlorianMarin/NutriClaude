"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { refusRecette } from "@/lib/recettes/erreurs";
import type { Recette } from "@/lib/recettes/recettes";
import {
  MAX_DESCRIPTION,
  MAX_INSTRUCTIONS,
  MAX_TITRE,
  normaliserDescription,
  normaliserEntier,
  normaliserInstructions,
  normaliserTitre,
} from "@/lib/recettes/saisie";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  "titre-vide": "Il faut un titre.",
  "portions-invalides": "Il faut au moins une personne.",
  "temps-invalide": "Les temps s'écrivent en minutes, en chiffres.",
  enregistre: "C'est noté.",
  /*
   * ⚠️ **Pas de message « La recette est partie. », et c'est mesuré.** Il en
   * existait un ; le parcours à l'écran du 2026-08-01 a montré qu'il ne pouvait
   * jamais s'afficher : la suppression réussie navigue vers `/recettes`, et le
   * composant est démonté avant tout rendu. Une clé de message sans appelant est
   * une dette, au même titre qu'une classe CSS sans appelant.
   *
   * L'accusé de réception existe, il est simplement meilleur que du texte : la
   * recette a disparu du répertoire qu'on a sous les yeux.
   */
  /*
   * ⚠️ Jamais « Réessaie » ici : la recette n'existe plus, et retenter la même
   * chose donnera indéfiniment le même refus. Le produit interdit un conseil qui
   * ne peut pas fonctionner.
   */
  disparue: "Cette recette n'existe plus.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Où le message de la soumission en cours doit s'afficher.
 *
 * ⚠️ **Un message qu'on ne voit pas n'existe pas.** C'est le défaut trouvé DEUX
 * fois de suite sur `/rayons` — la première correction en avait créé deux pour
 * trois surfaces de soumission, et la seconde passe de revue a retrouvé le
 * troisième mot pour mot. Ici : trois surfaces, trois régions.
 *
 * `sortie` n'est pas une soumission, mais elle porte une question à laquelle il
 * faut répondre ; sans région annoncée, un lecteur d'écran ne saurait pas
 * pourquoi le lien de retour n'a rien fait.
 */
type Zone = "edition" | "suppression" | "sortie";

/** L'état des six champs, sous leur forme de saisie (donc en chaînes). */
type Saisie = {
  titre: string;
  description: string;
  portions: string;
  preparation: string;
  cuisson: string;
  instructions: string;
};

function depuisRecette(recette: Recette): Saisie {
  return {
    titre: recette.titre,
    description: recette.description ?? "",
    portions: String(recette.portions),
    preparation: recette.preparationMin === null ? "" : String(recette.preparationMin),
    cuisson: recette.cuissonMin === null ? "" : String(recette.cuissonMin),
    instructions: recette.instructions ?? "",
  };
}

function identiques(a: Saisie, b: Saisie): boolean {
  return (Object.keys(a) as Array<keyof Saisie>).every((c) => a[c] === b[c]);
}

/**
 * L'édition d'une recette, et sa suppression.
 *
 * ⚠️ **Écriture client-direct** (AD-13) : ni secret serveur, ni conséquence à
 * faire apparaître dans un rendu serveur. Motif de `DisplayNameForm`.
 *
 * ⚠️ **Le lien de retour vit ICI et non dans la page**, parce que c'est lui
 * qu'il faut pouvoir intercepter quand des saisies ne sont pas enregistrées.
 */
export function FormulaireRecette({ recette }: { recette: Recette }) {
  const router = useRouter();
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  const [saisie, setSaisie] = useState<Saisie>(() => depuisRecette(recette));
  /** L'état enregistré, qui sert de point de comparaison pour la garde. */
  const [reference, setReference] = useState<Saisie>(() => depuisRecette(recette));
  const [zone, setZone] = useState<Zone>("edition");
  const [aConfirmer, setAConfirmer] = useState(false);
  const [sortieDemandee, setSortieDemandee] = useState(false);

  const modifie = !identiques(saisie, reference);

  /**
   * Désarme la garde pour une navigation que le code déclenche lui-même.
   *
   * Une **ref** et non un état : elle est lue par un gestionnaire posé au rendu
   * précédent, et rien ne garantit qu'un rendu s'intercale entre sa pose et la
   * navigation.
   *
   * ⚠️ **Raisonné, pas mesuré.** Aujourd'hui la sortie après suppression passe
   * par `router.replace`, qui est une navigation cliente : `beforeunload` ne s'y
   * déclenche pas, et ce drapeau ne sert donc à rien. Il est là pour qu'un
   * futur passage à un rechargement complet ne fasse pas surgir « tu as des
   * modifications non enregistrées » **après une suppression réussie** — le pire
   * message possible, puisqu'il est faux et fait douter d'une écriture qui a
   * marché.
   */
  const partVolontairement = useRef(false);

  /*
   * La garde, chemin « rechargement / fermeture d'onglet / URL externe ».
   *
   * ⚠️ **Armée SEULEMENT si un champ a changé.** Une garde qui se déclenche à
   * chaque sortie interrompt sans cause — et les navigateurs ignorent de toute
   * façon un `beforeunload` posé sans interaction préalable.
   *
   * ⚠️ **Le texte du message n'est pas le nôtre** : depuis 2019 tous les
   * navigateurs affichent leur propre formulation, non traduisible et non
   * remplaçable. `preventDefault()` est le seul contrat qui compte. C'est
   * précisément pourquoi l'autre chemin — le lien de retour — est intercepté à
   * la main juste en dessous : là, on peut parler français.
   */
  useEffect(() => {
    if (!modifie) return;

    const avertir = (evenement: BeforeUnloadEvent) => {
      if (partVolontairement.current) return;
      evenement.preventDefault();
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, [modifie]);

  function changer<C extends keyof Saisie>(champ: C, valeur: string) {
    setSaisie((actuel) => ({ ...actuel, [champ]: valeur }));
    effacer();
    setSortieDemandee(false);
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setZone("edition");
    /*
     * Soumettre, c'est renoncer à supprimer. Sans ce désarmement, un
     * enregistrement refusé laisserait « Confirmer » armé plus bas, où il se lit
     * comme « confirmer l'enregistrement ». Leçon de `ListeRayons`.
     */
    setAConfirmer(false);
    setSortieDemandee(false);

    const titre = normaliserTitre(saisie.titre);
    if (!titre) return refuser("titre-vide");

    const portions = normaliserEntier(saisie.portions);
    if (portions === null || portions < 1) return refuser("portions-invalides");

    /*
     * Un champ de temps vide vaut « pas renseigné » ; un champ REMPLI qu'on ne
     * sait pas lire est un refus, jamais un `null` silencieux. Enregistrer
     * `null` pour « 2e3 » perdrait la saisie sans un mot — c'est le défaut du
     * champ icône de `/rayons`, où « Fromages » tapé au mauvais endroit
     * enregistrait « F ».
     */
    const preparation = saisie.preparation.trim() === "" ? null : normaliserEntier(saisie.preparation);
    const cuisson = saisie.cuisson.trim() === "" ? null : normaliserEntier(saisie.cuisson);
    if (
      (saisie.preparation.trim() !== "" && preparation === null) ||
      (saisie.cuisson.trim() !== "" && cuisson === null)
    ) {
      return refuser("temps-invalide");
    }

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * `updated_at` n'est PAS posé : le trigger `recipes_updated_at` s'en
       * charge, et le poser ici laisserait croire au lecteur suivant que la
       * valeur cliente fait autorité — l'inverse de la convention du projet.
       * C'est la seule divergence avec `aisles`, qui n'a pas ce trigger.
       *
       * Pas de filtre `household_id` : `recipes_all` porte `using` ET
       * `with check`. La frontière est en base (AD-2).
       */
      const { data, error } = await supabase
        .from("recipes")
        .update({
          title: titre,
          description: normaliserDescription(saisie.description),
          instructions: normaliserInstructions(saisie.instructions),
          servings: portions,
          prep_time_min: preparation,
          cook_time_min: cuisson,
        })
        .eq("id", recette.id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[recettes] enregistrement refusé :", error.message);
        return refusRecette(error);
      }
      /*
       * ⚠️ Contrôler `data` AUTANT qu'`error`. Un `update` sur une ligne que la
       * RLS masque — recette supprimée entre-temps par l'autre membre du foyer —
       * rend **zéro ligne et AUCUNE erreur**. Sans ce test, l'écran annoncerait
       * « C'est noté. » sur une écriture qui n'a rien touché.
       */
      if (!data) {
        partVolontairement.current = true;
        return "disparue";
      }

      /*
       * La référence suit la valeur enregistrée : c'est ce qui désarme la garde
       * après un succès. Sans ça, enregistrer puis partir redemanderait
       * confirmation pour des modifications qui sont en base.
       */
      setReference(saisie);
      router.refresh();
      return "enregistre";
    });
  }

  async function supprimer() {
    setZone("suppression");
    setSortieDemandee(false);

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recette.id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[recettes] suppression refusée :", error.message);
        return refusRecette(error);
      }

      /*
       * Zéro ligne n'est PAS traité comme un échec : la recette avait déjà
       * disparu, donc l'intention de l'utilisateur est satisfaite. Lui répondre
       * « Ça n'a pas marché » sur un but atteint serait faux, et l'enfermerait
       * sur un écran dont la recette n'existe plus.
       */
      partVolontairement.current = true;
      router.refresh();
      router.replace("/recettes");
      return undefined;
    });
  }

  /** Le retour, intercepté tant que des saisies ne sont pas enregistrées. */
  function quitter() {
    partVolontairement.current = true;
    router.push("/recettes");
  }

  const message = messageDe(MESSAGES, cle, "echec");
  const statutEdition = (
    <Notice reserve className="mt-3">
      {zone === "edition" ? message : undefined}
    </Notice>
  );
  const statutSuppression = (
    <Notice reserve className="mt-3">
      {zone === "suppression" ? message : undefined}
    </Notice>
  );

  return (
    <div>
      <Link
        href="/recettes"
        onNavigate={(evenement) => {
          if (!modifie) return;
          evenement.preventDefault();
          setZone("sortie");
          setSortieDemandee(true);
        }}
        className="btn-quiet px-0"
      >
        ← Mes recettes
      </Link>

      {/*
        La région de la sortie. Montée en permanence : une région annoncée de
        façon fiable est une région qui existait déjà avant que le message n'y
        arrive (constat d'`InviteCard`).
      */}
      <Notice className="mt-1">
        {sortieDemandee ? "Tu as des modifications pas encore enregistrées." : undefined}
      </Notice>
      {sortieDemandee ? (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={quitter} className="btn-quiet px-0">
            Partir sans enregistrer
          </button>
          <button
            type="button"
            onClick={() => setSortieDemandee(false)}
            className="btn-quiet"
          >
            Rester
          </button>
        </div>
      ) : null}

      <h1 className="titre-ecran mt-2 break-all">{recette.titre}</h1>
      <p className="hint mt-1">Complète ce que tu veux, tout est facultatif sauf le titre.</p>

      <form onSubmit={enregistrer} className="mt-12">
        <div>
          <label htmlFor="titre" className="label">
            Titre
          </label>
          <input
            id="titre"
            type="text"
            required
            maxLength={MAX_TITRE}
            value={saisie.titre}
            onChange={(e) => changer("titre", e.target.value)}
            className="input mt-1"
          />
        </div>

        <div className="mt-6">
          <label htmlFor="description" className="label">
            Description (facultatif)
          </label>
          <input
            id="description"
            type="text"
            maxLength={MAX_DESCRIPTION}
            placeholder="Rapide, végé, et ça passe avec du riz"
            value={saisie.description}
            onChange={(e) => changer("description", e.target.value)}
            className="input mt-1"
          />
          {/*
            Poser l'attente AVANT la borne plutôt que de tronquer en silence :
            `maxLength` arrête la frappe sans rien dire. Même raison que le
            refus de l'icône multiple sur `/rayons`.
          */}
          <p className="hint mt-1">Deux ou trois phrases.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <div className="min-w-32 flex-1">
            <label htmlFor="portions" className="label">
              Pour combien de personnes
            </label>
            <input
              id="portions"
              type="number"
              inputMode="numeric"
              required
              min={1}
              value={saisie.portions}
              onChange={(e) => changer("portions", e.target.value)}
              className="input mt-1 tabular-nums"
            />
          </div>
          <div className="min-w-32 flex-1">
            <label htmlFor="preparation" className="label">
              Préparation (min, facultatif)
            </label>
            <input
              id="preparation"
              type="number"
              inputMode="numeric"
              min={0}
              value={saisie.preparation}
              onChange={(e) => changer("preparation", e.target.value)}
              className="input mt-1 tabular-nums"
            />
          </div>
          <div className="min-w-32 flex-1">
            <label htmlFor="cuisson" className="label">
              Cuisson (min, facultatif)
            </label>
            <input
              id="cuisson"
              type="number"
              inputMode="numeric"
              min={0}
              value={saisie.cuisson}
              onChange={(e) => changer("cuisson", e.target.value)}
              className="input mt-1 tabular-nums"
            />
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor="instructions" className="label">
            Comment on la fait (facultatif)
          </label>
          {/*
            ⚠️ `min-h-40` l'emporte sur le `min-h-11` de `.input` parce que
            `.input` vit dans `@layer components` et l'utilitaire dans
            `utilities`, qui vient après — une question d'ORDRE DE COUCHE, pas de
            spécificité. Ne pas « corriger » avec un `!important`.

            `resize-y` : un redimensionnement horizontal casserait la colonne.
          */}
          <textarea
            id="instructions"
            rows={12}
            maxLength={MAX_INSTRUCTIONS}
            placeholder={"Faire revenir l'oignon.\n\nAjouter les épices, puis mouiller."}
            value={saisie.instructions}
            onChange={(e) => changer("instructions", e.target.value)}
            className="input mt-1 min-h-40 resize-y leading-relaxed"
          />
          <p className="hint mt-1">
            Tes retours à la ligne sont gardés tels quels.
          </p>
        </div>

        {statutEdition}

        <button type="submit" disabled={occupe} className="btn-primaire mt-3 w-full">
          {occupe ? LIBELLE_OCCUPE : "Enregistrer"}
        </button>
      </form>

      {/*
        La suppression, à distance du formulaire et avec sa propre région de
        statut. Confirmation en deux temps plutôt qu'une boîte de dialogue
        native : `window.confirm` est hors thème, hors ton, et bloque toute
        vérification pilotée par navigateur. Motif d'`InviteCard`.
      */}
      <section className="mt-12 border-t border-card-border pt-6">
        <div className="flex items-center gap-2">
          {aConfirmer ? (
            <>
              <button
                type="button"
                onClick={supprimer}
                disabled={occupe}
                className="btn-quiet px-0"
              >
                {occupe ? LIBELLE_OCCUPE : "Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => setAConfirmer(false)}
                disabled={occupe}
                className="btn-quiet"
              >
                Non
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setZone("suppression");
                effacer();
                setAConfirmer(true);
              }}
              disabled={occupe}
              className="btn-quiet px-0"
            >
              Supprimer cette recette
            </button>
          )}
        </div>

        {aConfirmer ? (
          <p className="hint mt-2">Elle disparaît de ton répertoire.</p>
        ) : null}

        {statutSuppression}
      </section>
    </div>
  );
}
