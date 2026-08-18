"use client";

import { useState } from "react";
import { Notice } from "@/app/_lib/Notice";

/**
 * Les deux gestes qui portent sur la liste ENTIÈRE — « Vider le panier » et
 * « Tout enlever ».
 *
 * ⛔ **ILS SONT EN BAS DE LA LISTE, ET C'EST LEUR PLACE.** Ce sont des gestes de
 * FIN de courses : on range le panier quand on a fini, pas avant. Les poser en
 * tête les mettrait sur le chemin du geste principal — la bascule — sur l'écran
 * qu'on lit à une main dans un magasin. `AjouterArticle` occupe le haut pour la
 * raison inverse : on ajoute avant de partir.
 *
 * ⛔ **CHACUN NE SE MONTE QUE S'IL A UNE CIBLE.** Un bouton qui ne peut rien faire
 * est un bouton qui ment, et le membre qui l'actionne sans effet en conclut que
 * l'écran est cassé. ⚠️ **L'arête de `/rayons` ne se reproduit pas ici** — là-bas,
 * cacher « Remettre les rayons de départ » hors de l'état vide créait un état dont
 * le seul moyen de sortir était de tout supprimer. Ici, « Vider le panier »
 * réapparaît dès qu'un article est coché : la porte se rouvre toute seule.
 *
 * ⚠️ **UNE RÉGION DE STATUT PROPRE À CETTE ZONE**, pas celle de la page. Un message
 * rendu en tête d'un écran de trente articles est **hors champ** au moment où il
 * s'écrit — défaut trouvé deux fois de suite sur `/rayons`, dont une fois par la
 * correction elle-même. ⚠️ **`reserve` parce que la zone SURPLOMBE ses boutons** :
 * sans lui, l'arrivée du message pousse la cible sous le doigt au moment du clic.
 */
export function GestesDeListe({
  aDesArticlesPris,
  aDesArticles,
  occupe,
  message,
  onArchiver,
  onVider,
  onOublierMessage,
}: {
  aDesArticlesPris: boolean;
  aDesArticles: boolean;
  occupe: boolean;
  message: string | null;
  onArchiver: () => void;
  onVider: () => void;
  onOublierMessage: () => void;
}) {
  /*
   * ⚠️ **UN SEUL état pour les deux confirmations**, et non deux booléens : armer
   * l'un doit désarmer l'autre. Deux booléens indépendants laisseraient « Vider le
   * panier » et « Tout enlever » armés en même temps, avec deux « Confirmer »
   * voisins que rien ne distingue — exactement le défaut que `ListeRayons` a corrigé
   * en fermant son panneau dans quatre chemins.
   */
  const [aConfirmer, setAConfirmer] = useState<"panier" | "tout" | null>(null);

  /*
   * ⛔ **ARMER UNE CONFIRMATION EFFACE LE COMPTE RENDU PRÉCÉDENT — défaut trouvé au
   * parcours à l'écran du 2026-08-17.** « 5 articles rangés. » restait affiché juste
   * au-dessus d'un « Confirmer » qui, lui, portait sur le geste SUIVANT. Les deux se
   * lisaient comme un seul bloc, et le chiffre semblait annoncer ce qu'on s'apprêtait
   * à faire. Un compte rendu parle du passé ; dès qu'un geste est armé, il ment.
   */
  function armer(quoi: "panier" | "tout") {
    setAConfirmer(quoi);
    onOublierMessage();
  }

  /*
   * ⛔ **ON RESTE MONTÉ SANS CIBLE, POUR LE SEUL MESSAGE.** Rendre `null` dès que la
   * liste est vide démontait le compte rendu du vidage dans le rendu même qui
   * l'écrivait : le membre voyait sa liste disparaître sans jamais lire combien
   * d'articles étaient partis. ⚠️ **Mais on ne rend rien du tout s'il n'y a NI cible
   * NI message** — une bordure et une zone réservée sous une liste vide seraient du
   * mobilier sans fonction.
   */
  if (!aDesArticles && message === null) return null;

  return (
    <div className="mt-8 border-t border-card-border pt-4">
      <Notice reserve>{message}</Notice>

      {/*
       * ⚠️ **Les boutons disparaissent quand la liste est vide, la zone de message
       * reste.** C'est la même règle que « chacun ne se monte que s'il a une cible »,
       * appliquée aux deux d'un coup : après un vidage il n'y a plus rien à vider.
       */}
      {aDesArticles ? (
        <div className="flex flex-wrap items-center gap-2">
          {aDesArticlesPris ? (
            <Geste
            arme={aConfirmer === "panier"}
            occupe={occupe}
            libelle="Vider le panier"
            /*
             * ⚠️ **Le libellé est VERBATIM d'`EXPERIENCE.md:134`** — « Vider le
             * panier : archiver les achetés d'un geste, avec confirmation (FR-8) ».
             * Ce n'est pas une reformulation : c'est la source.
             */
            explication="Les articles pris sortent de ta liste. Tu peux les rajouter."
              onArmer={() => armer("panier")}
              onDesarmer={() => setAConfirmer(null)}
              onConfirmer={() => {
                setAConfirmer(null);
                onArchiver();
              }}
            />
          ) : null}

          <Geste
            arme={aConfirmer === "tout"}
            occupe={occupe}
            /*
           * ⚠️ **« Tout enlever » est une chaîne INVENTÉE, et c'est signalé.**
           * FR-8 nomme le geste « la liste entièrement vidée », mais « Vider la
           * liste » et « Vider le panier » se ressemblent trop pour deux portées
           * différentes — l'un retire ce qui est pris, l'autre retire tout, y
           * compris ce qui ne l'est pas. ⚠️ Ni « effacer » ni « supprimer » : le
           * tombstone ne détruit rien, et réajouter l'article le fait revenir.
           * À valider en revue, comme « Tout est dans le panier. » de la 4.3.
           */
            libelle="Tout enlever"
            explication="Tout part, même ce qui n'est pas encore pris."
            onArmer={() => armer("tout")}
            onDesarmer={() => setAConfirmer(null)}
            onConfirmer={() => {
              setAConfirmer(null);
              onVider();
            }}
          />
        </div>
      ) : null}

      {/*
       * ⚠️ **L'explication ne se rend qu'une fois armé**, sous les boutons. La
       * montrer en permanence remplirait le bas de l'écran de deux phrases que
       * personne ne lit, et diluerait celle qui compte au moment où elle compte.
       */}
      {aConfirmer !== null ? (
        <p className="hint mt-2">
          {aConfirmer === "panier"
            ? "Les articles pris sortent de ta liste. Tu peux les rajouter."
            : "Tout part, même ce qui n'est pas encore pris."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Un geste global et ses deux temps.
 *
 * ⛔ **Confirmation en deux temps, jamais `window.confirm`** : hors thème, hors ton,
 * et il bloque toute vérification pilotée par navigateur. Motif d'`InviteCard` et de
 * `ListeRayons`, repris tel quel.
 *
 * ⚠️ **`btn-quiet` et non `btn-action`** : UX-DR2 réserve l'abricot à l'action
 * courses — compteur, coche, tuile, bouton d'AJOUT — et un geste destructif n'en est
 * pas. Ici l'underline de `btn-quiet` ne coûte rien : ces boutons sont deux, en bas
 * de page, pas trente au fil de la liste.
 */
function Geste({
  arme,
  occupe,
  libelle,
  explication,
  onArmer,
  onDesarmer,
  onConfirmer,
}: {
  arme: boolean;
  occupe: boolean;
  libelle: string;
  explication: string;
  onArmer: () => void;
  onDesarmer: () => void;
  onConfirmer: () => void;
}) {
  if (!arme) {
    return (
      <button type="button" className="btn-quiet" disabled={occupe} onClick={onArmer}>
        {libelle}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="btn-quiet"
        disabled={occupe}
        /*
         * ⚠️ **L'`aria-label` rappelle DE QUOI on confirme.** Deux « Confirmer »
         * peuvent se succéder au même endroit ; hors contexte visuel, le mot seul
         * ne dit pas lequel des deux gestes on déclenche.
         */
        aria-label={`Confirmer : ${libelle.toLowerCase()}`}
        onClick={onConfirmer}
      >
        {occupe ? "Un instant…" : "Confirmer"}
      </button>
      <button
        type="button"
        className="btn-quiet"
        disabled={occupe}
        aria-label={`Annuler : ${libelle.toLowerCase()}`}
        onClick={onDesarmer}
      >
        Non
      </button>
      <span className="sr-only">{explication}</span>
    </span>
  );
}
