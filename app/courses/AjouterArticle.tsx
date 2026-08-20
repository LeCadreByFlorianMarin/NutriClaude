"use client";

import { useId, useState } from "react";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { messageDe } from "@/lib/messages";
import { createNavigateurClient } from "@/lib/supabase/client";
import { ajouterArticle, uniteChoisie } from "@/lib/liste/ajout";
import { normaliserNomArticle } from "@/lib/liste/nom";
import { analyserQuantite } from "@/lib/quantite";
import { UNITES } from "@/lib/recettes/unites";

/**
 * Ce que l'écran DIT, par clé — motif de `DisplayNameForm`.
 *
 * ⚠️ **Une clé par CAUSE, et c'est une leçon déjà payée.** L'écran des recettes
 * répondait « Une quantité s'écrit en chiffres. » à quelqu'un qui venait d'en écrire
 * une mais trop grande : un conseil qui ne peut pas fonctionner enferme le membre
 * dans une boucle, ce que `project-context.md` interdit nommément. `analyserQuantite`
 * distingue les quatre fautes ; ce dictionnaire les traduit.
 *
 * ⛔ **Aucun « Réessaie » sur `echec`.** Ce chemin attrape aussi `supabaseEnv()`, qui
 * LÈVE quand une variable de configuration manque — une condition qui ne se répare
 * pas en attendant.
 */
const MESSAGES = {
  vide: "Il faut un nom pour l'ajouter.",
  illisible: "Une quantité s'écrit en chiffres.",
  negative: "Une quantité ne peut pas être négative.",
  "trop-petite": "Cette quantité est trop petite pour être retenue.",
  "hors-bornes": "Cette quantité est trop grande.",
  echec: "On n'a pas réussi à l'ajouter.",
  ok: "C'est ajouté.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Le formulaire d'ajout — « Ajouter un truc » (`EXPERIENCE.md:109`).
 *
 * ⛔ **UN SEUL APPEL, ET LE SERVEUR DÉCIDE TOUT.** Pas de lecture préalable, pas de
 * comparaison, pas de résolution de rayon côté client : `ajouter_article` fait
 * l'UPSERT-incrémente sur la clé canonique (AD-6). ⚠️ **Ne jamais être tenté de lire
 * d'abord** — la ligne qui occupe la clé peut être un tombstone ou un article acheté,
 * tous deux invisibles dans `grocery_list_by_aisle`, et un lire-puis-écrire perdrait
 * une addition dès que deux surfaces ajoutent en même temps (NFR-2).
 *
 * ⚠️ **LA LISTE SE RELIT APRÈS L'AJOUT, elle ne se devine pas.** La story 4.3 emploie
 * une mise à jour optimiste pour la coche, et c'était le bon choix là-bas : on
 * connaissait l'état visé. Ici, non — on ignore si l'ajout a créé une ligne ou
 * incrémenté une existante, quel rayon le serveur a résolu, et si un tombstone vient
 * d'être rouvert. Deviner produirait un écran qui diverge de la base au premier cas
 * limite. ⛔ **Ce n'est pas le « reload manuel » qu'AD-8 proscrit** : c'est la
 * conséquence d'une écriture, pas un bouton de rafraîchissement ni du polling.
 */
export function AjouterArticle({ onAjout }: { onAjout: () => Promise<void> }) {
  const [nom, setNom] = useState("");
  const [quantite, setQuantite] = useState("");
  const [unite, setUnite] = useState("");
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  const idNom = useId();
  const idQuantite = useId();
  const idUnite = useId();

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();

    /*
     * ⚠️ **Le nom est validé AVANT l'appel, et pas pour faire joli.** Un nom vide
     * ferait rendre `23514` par `grocery_list_items_nom_non_vide` — un code que rien
     * ne traduit, donc un message technique brut à l'écran. La garde en base reste
     * la vérité ; celle-ci existe pour que le membre lise une phrase.
     */
    const nomPropre = normaliserNomArticle(nom);
    if (nomPropre === null) return refuser("vide");

    let valeur: number | undefined;
    if (quantite.trim() !== "") {
      const analyse = analyserQuantite(quantite);
      if ("faute" in analyse) return refuser(analyse.faute);
      valeur = analyse.valeur;
    }

    await soumettre(async () => {
      await ajouterArticle(
        createNavigateurClient(),
        nomPropre,
        /*
         * ⚠️ **La surface est déclarée ICI, par l'écran qui la connaît.** C'est le seul
         * endroit du produit qui sache que cet ajout vient du web ; la porte ne peut pas
         * le deviner, et la base ne doit pas l'inventer.
         */
        "web",
        valeur,
        /*
         * ⚠️ Le `<select>` ne peut pas produire autre chose que les huit jetons,
         * mais `uniteChoisie` reste la porte : elle refuse ce qui n'est pas au
         * contrat plutôt que de le transmettre et de laisser la base rendre `23514`.
         */
        unite === "" ? undefined : uniteChoisie(unite)
      );
      setNom("");
      setQuantite("");
      setUnite("");
      await onAjout();
      return undefined;
    });
  }

  return (
    <form onSubmit={envoyer} className="mt-6">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={idNom} className="label">
            Quoi
          </label>
          {/*
           * ⚠️ **Pas de `maxLength`** : il compte des unités UTF-16, pas des points
           * de code, et couperait un emoji en deux. C'est `normaliserNomArticle` qui
           * borne, et la contrainte `grocery_list_items_nom_borne` qui fait foi.
           */}
          <input
            id={idNom}
            value={nom}
            onChange={(e) => {
              setNom(e.target.value);
              effacer();
            }}
            className="input mt-1"
            autoComplete="off"
          />
        </div>

        <div className="w-20 shrink-0">
          <label htmlFor={idQuantite} className="label">
            Combien
          </label>
          {/*
           * ⚠️ **`inputMode="decimal"`, jamais `type="number"`.** Le second refuse la
           * virgule selon la locale du navigateur et vide le champ sur une saisie
           * qu'il juge invalide — le membre ne voit alors plus ce qu'il a tapé.
           * `analyserQuantite` accepte la virgule, précisément parce qu'un clavier
           * français en produit une.
           */}
          <input
            id={idQuantite}
            value={quantite}
            onChange={(e) => {
              setQuantite(e.target.value);
              effacer();
            }}
            className="input mt-1 tabular-nums"
            inputMode="decimal"
            autoComplete="off"
          />
        </div>

        <div className="w-24 shrink-0">
          <label htmlFor={idUnite} className="label">
            Unité
          </label>
          {/*
           * ⛔ **UN `<select>`, JAMAIS UN CHAMP LIBRE.** C'est lui qui empêche une
           * forme Unicode décomposée d'atteindre la base : mesuré en revue de la 4.1,
           * `normalize('pièce', NFD)` rend `23514` alors que le jeton est au contrat.
           * `unit` ne traverse aucune normalisation, ni dans la contrainte ni dans la
           * clé canonique — le `<select>` est la seule garde.
           */}
          <select
            id={idUnite}
            value={unite}
            onChange={(e) => {
              setUnite(e.target.value);
              effacer();
            }}
            className="input mt-1"
          >
            <option value="">—</option>
            {UNITES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/*
       * ⚠️ **`reserve` EST DÛ ICI, et la story 4.2 l'avait retiré.** Sa revue du
       * 2026-08-12 l'avait ôté du `Notice` de la liste au motif qu'« il n'y a ni
       * formulaire ni cible tactile sous la zone ». Cet écran apporte les deux : sans
       * `reserve`, l'arrivée d'un message pousserait le bouton sous le doigt au
       * moment du clic. **La prémisse s'est rouverte** (règle §5).
       */}
      <Notice reserve className="mt-3">
        {messageDe(MESSAGES, cle, "echec")}
      </Notice>

      {/*
       * ⚠️ **L'abricot est LÉGITIME ici**, et c'est l'un des rares endroits : UX-DR2
       * réserve l'accent à l'action courses et énumère nommément le bouton d'ajout.
       * `DESIGN.md` le nomme `bouton-action` — cet écran est le premier à le monter.
       */}
      <button type="submit" disabled={occupe} className="btn-action mt-1 w-full">
        {occupe ? "On ajoute…" : "Ajouter un truc"}
      </button>
    </form>
  );
}
