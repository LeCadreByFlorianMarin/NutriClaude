"use client";

import { useState } from "react";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { createNavigateurClient } from "@/lib/supabase/client";
import Link from "next/link";
import { compteRenduGeneration, genererLaListe } from "@/lib/liste/generation";

/**
 * Ce que l'écran DIT en cas de refus — motif d'`AjouterArticle`.
 *
 * ⚠️ **Le SUCCÈS n'est pas ici, et ce n'est pas un oubli** : il porte un COMPTE, donc
 * il se construit. Sa phrase vit dans `compteRenduGeneration` — jamais dans ce
 * composant, parce que NFR-10 interdit un harnais de composants et qu'une règle
 * laissée dans du JSX n'est exercée par rien. Le dépôt a payé cette leçon deux fois
 * (« 2 pièce » dans la carte-rayon, la mutation survivante de `comparerGroupes`).
 *
 * ⛔ **Aucun « Réessaie ».** Ce chemin attrape aussi `supabaseEnv()`, qui LÈVE quand
 * une variable de configuration manque — une condition qui ne se répare pas en
 * attendant, et un conseil qui ne peut pas fonctionner enferme le membre dans une
 * boucle.
 */
const MESSAGES = {
  echec: "On n'a pas réussi à générer ta liste.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Le geste « Générer ma liste » — une action, toute la semaine (FR-16, FR-17).
 *
 * ⛔ **IL EST SUR L'ÉCRAN DU MENU, ET C'EST `EXPERIENCE.md` QUI LE DIT**, pas une
 * intuition : « Menu de la semaine — assigner recettes à la grille jour × repas,
 * **générer la liste** » (`EXPERIENCE.md:69`). Le poser sur l'écran des courses
 * l'aurait mis sur le chemin du geste de magasin, qu'on fait à une main dans un
 * rayon.
 *
 * ⛔ **C'EST UN ÎLOT CLIENT, ET LA PAGE RESTE UN RENDU SERVEUR.** Le docblock de
 * `MenuPage` avertit : « si un `useSoumission`, un `Notice` ou une région de statut
 * apparaît ici, c'est que le formulaire a glissé dans la grille ». L'avertissement
 * vise la GRILLE — un `<select>` de recettes déborde une piste à 1/7 de largeur. Ce
 * bouton-ci vit **au-dessus** de la grille, pleine largeur, dans aucune piste : il ne
 * peut pas reproduire ce défaut. La distinction est écrite ici pour qu'un futur
 * lecteur n'y voie pas une contradiction.
 *
 * ⛔ **UN SEUL APPEL, ET TOUT SE DÉCIDE EN BASE.** Pas de lecture préalable, pas
 * d'agrégation côté client. ⚠️ **Ne jamais être tenté de boucler ici** : l'intention
 * de génération est prise **une fois**, en base, avant la boucle — c'est ce qui tient
 * l'AC3. Prise article par article côté client, deux suppressions faites à la même
 * seconde seraient arbitrées différemment.
 *
 * ⚠️ **RIEN À RELIRE APRÈS COUP, ET C'EST PROPRE À CET ÉCRAN.** L'écran des courses
 * relit sa liste après chaque écriture parce qu'il l'affiche ; celui-ci n'affiche pas
 * la liste, donc il n'a rien à rafraîchir. Le compte rendu EST le retour de la base —
 * pas une devinette.
 *
 * ⚠️ **UNE RÉGION DE STATUT PROPRE À CETTE ZONE**, avec `reserve` parce qu'elle
 * SURPLOMBE son bouton : sans lui, l'arrivée du message pousse la cible sous le doigt
 * au moment du clic. Défaut trouvé deux fois sur `/rayons`.
 */
export function GenererLaListe({
  debut,
  fin,
  libelleSemaine,
}: {
  debut: string;
  fin: string;
  libelleSemaine: string;
}) {
  const { occupe, cle, effacer, soumettre } = useSoumission<Cle>();
  const [compteRendu, setCompteRendu] = useState<string | null>(null);
  /*
   * ⚠️ **UN LIEN VERS LA LISTE, ET SEULEMENT APRÈS COUP.** La revue a mesuré qu'aucun
   * `<Link>` de cet écran ne menait à `/courses` : le membre s'entendait dire « 3 articles
   * posés sur ta liste » et n'avait aucun chemin vers elle. Il n'apparaît qu'après une
   * génération, parce qu'avant il n'y a rien de neuf à aller voir.
   */
  const [aGenere, setAGenere] = useState(false);

  async function generer() {
    /*
     * ⛔ **LE COMPTE RENDU PRÉCÉDENT S'EFFACE AVANT LE NOUVEAU GESTE.** Sans cela, la phrase
     * d'avant resterait affichée pendant la génération suivante et se lirait comme son
     * résultat. Un compte rendu parle du passé ; dès qu'un geste repart, il ment.
     */
    setCompteRendu(null);
    effacer();

    await soumettre(async () => {
      try {
        const supabase = createNavigateurClient();
        const resultat = await genererLaListe(supabase, debut, fin);
        setCompteRendu(compteRenduGeneration(resultat));
        setAGenere(true);
        return undefined;
      } catch {
        return "echec";
      }
    });
  }

  const message = cle ? MESSAGES[cle] : compteRendu;

  return (
    <div className="mt-6">
      <Notice reserve>{message}</Notice>

      <button
        type="button"
        onClick={generer}
        disabled={occupe}
        aria-label={`Générer ma liste de courses — ${libelleSemaine}`}
        className="btn-primaire min-h-touch"
      >
        {occupe ? "Un instant…" : "Générer ma liste"}
      </button>

      {/*
        ⚠️ **La phrase dit ce que le geste NE fait PAS**, parce que c'est précisément ce qui
        inquiète. ⛔ **Elle était FAUSSE sur sa seconde moitié avant la revue** : la génération
        décochait les articles déjà pris et gonflait leur quantité. Elle ne les touche plus.
      */}
      <p className="hint mt-2">
        Tes ajouts à la main et ce que tu as déjà pris restent en place.
      </p>

      {aGenere ? (
        <Link
          href="/courses"
          /*
            ⚠️ **`inline-flex`, PAS `flex` — défaut vu au parcours du 2026-08-22.** `btn-quiet`
            centre son contenu ; posé en `flex`, le lien occupait toute la largeur et se
            retrouvait CENTRÉ sous un bloc entièrement aligné à gauche. Une seule classe de
            différence, invisible à toutes les portes.
          */
          className="btn-quiet mt-2 inline-flex min-h-touch items-center px-0 underline underline-offset-4"
        >
          Voir ma liste →
        </Link>
      ) : null}
    </div>
  );
}
