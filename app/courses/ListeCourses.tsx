"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { CarteRayon } from "@/app/_lib/CarteRayon";
import { Notice } from "@/app/_lib/Notice";
import { createNavigateurClient } from "@/lib/supabase/client";
import {
  articlesDuFoyer,
  type ArticleDeListe,
  type StatutArticle,
} from "@/lib/liste/liste";
import { grouperParRayon, type GroupeDeRayon } from "@/lib/liste/groupement";
import { basculerStatut, statutApresGeste } from "@/lib/liste/basculer";
import {
  supprimerArticle,
  archiverLesAchetes,
  viderLaListe,
  compteRenduArchivage,
  compteRenduVidage,
} from "@/lib/liste/suppression";
import { formaterQuantiteEtUnite } from "@/lib/quantite";
import { AjouterArticle } from "./AjouterArticle";
import { GestesDeListe } from "./GestesDeListe";

/**
 * La liste de courses, **lue depuis le navigateur** (AC1, AD-13).
 *
 * ⚠️ **PREMIÈRE LECTURE CLIENT-DIRECT DU PRODUIT, et il n'y avait aucun motif à
 * copier.** Mesuré le 2026-08-05, **chiffre corrigé le 2026-08-12** : les 20
 * appels de `createNavigateurClient()` du dépôt sont des écritures ou de l'auth,
 * et aucun des **10** `useEffect` ne faisait d'`await` de données *(la revue avait
 * écrit « 8 » ; `git grep` en rend 10 — la conclusion tenait, le compte non)*.
 * Les états chargement / erreur / vide d'une lecture sont
 * donc écrits ici pour la première fois — les surfaces suivantes (4.8, 4.11)
 * rafraîchiront ce même état.
 *
 * ⚠️ **Un chargement, PAS un abonnement.** AD-8 interdit le polling et le reload
 * manuel ; la propagation temps réel est la story 4.11. Il n'y a donc
 * délibérément ni `subscribe`, ni `setInterval`, ni bouton « rafraîchir » — un
 * bouton posé ici serait à retirer.
 */
export function ListeCourses() {
  /*
   * ⛔ **TROIS ÉTATS, ET LE TROISIÈME EST NÉ D'UN DÉFAUT TROUVÉ EN REVUE le
   * 2026-08-07.** La première rédaction n'en avait que deux : elle posait
   * `setGroupes([])` dans le `catch` pour sortir du squelette. L'écran sortait
   * bien du squelette — **par la porte de l'état VIDE**, et rendait « On n'a pas
   * réussi à ouvrir ta liste » avec, juste en dessous, « **Ta liste est vide.** »
   *
   * Un membre qui a trente articles, dans un magasin, sur réseau instable,
   * lisait que sa liste était vide. La seconde phrase est **affirmative** là où
   * la première dit qu'on ne sait pas, et c'est elle qui occupait le corps de
   * l'écran. Corriger « le squelette ne doit jamais être l'état d'échec » en
   * réutilisant un état qui AFFIRME UN FAIT déplaçait le mensonge, il ne le
   * retirait pas.
   *
   * `articles` reste donc `null` en cas d'échec, et c'est `echec` qui distingue
   * « je charge » de « je n'ai pas pu ». **Un état vide se mérite** : il faut
   * avoir lu pour avoir le droit de dire qu'il n'y a rien.
   *
   * ⛔ **L'ÉTAT GARDE LA LISTE À PLAT, DANS L'ORDRE DE LA BASE — ET C'EST UN
   * CORRECTIF DU PARCOURS À L'ÉCRAN DU 2026-08-13.** Il gardait `GroupeDeRayon[]`,
   * donc déjà trié pour l'affichage (les achetés en bas). Une bascule reconstruisait
   * la liste à plat depuis ces groupes, puis la regroupait : l'ordre alphabétique
   * **à l'intérieur du panier** était alors celui de l'affichage précédent, plus
   * celui de la base.
   *
   * **Mesuré à l'écran** : après avoir coché « Lait », la Crèmerie rendait
   * `Lait, Beurre` sous le séparateur ; après rechargement, `Beurre, Lait`. **Le
   * même état affiché de deux façons selon qu'on venait de cocher ou non** —
   * exactement l'« écran qui bouge tout seul » que le tri secondaire de
   * `comparerGroupes` existe pour empêcher, un niveau plus bas.
   *
   * ⚠️ **Re-trier par nom à l'affichage aurait été le mauvais correctif** : c'est
   * la collation Postgres qu'il aurait fallu réimplémenter côté client, ce que
   * l'AC3 interdit. Garder l'ordre reçu est la seule réponse qui n'arbitre rien.
   */
  const [articles, setArticles] = useState<ArticleDeListe[] | null>(null);
  const [echec, setEchec] = useState(false);

  /*
   * Le regroupement est DÉRIVÉ, jamais stocké : une seule source de vérité, et
   * la même règle appliquée au chargement comme après une bascule.
   *
   * ⚠️ **Il n'est JAMAIS nul, et c'est délibéré.** Une seule valeur porte
   * l'absence — `articles` — et c'est elle que les branches de rendu testent.
   * Rendre `groupes` nullable aussi obligerait à le re-tester au rendu alors
   * que TypeScript ne peut pas relier les deux, et le `!` que cela réclamerait
   * est refusé par le dépôt. Un tableau vide se regroupe en tableau vide.
   */
  const groupes: GroupeDeRayon[] = useMemo(
    () => grouperParRayon(articles ?? []),
    [articles]
  );

  /*
   * ⛔ **LA LECTURE EST EXTRAITE POUR ÊTRE REJOUABLE — story 4.4.** Elle ne servait
   * qu'au montage ; l'ajout d'un article a besoin de la rejouer, parce qu'on ne
   * peut PAS deviner son résultat : on ignore si l'ajout a créé une ligne ou
   * incrémenté une existante, quel rayon le serveur a résolu, et si un tombstone
   * vient d'être rouvert.
   *
   * ⚠️ **Ce n'est pas le « reload manuel » qu'AD-8 proscrit** : c'est la
   * conséquence d'une écriture, pas un bouton de rafraîchissement ni du polling.
   * La propagation entre surfaces reste la story 4.11.
   *
   * ⚠️ **Elle ne porte PAS le drapeau d'annulation.** Celui-ci appartient à
   * l'effet, dont il ferme le cycle de vie ; un rechargement déclenché par un
   * geste n'a pas de démontage à craindre entre l'appel et sa résolution.
   */
  async function relire() {
    try {
      const recus = await articlesDuFoyer(createNavigateurClient());
      setArticles(recus);
      setEchec(false);
    } catch (erreur) {
      console.error("[courses] Relecture de la liste :", erreur);
      setEchec(true);
    }
  }

  useEffect(() => {
    /*
     * ⚠️ **Le drapeau d'annulation n'est pas une précaution de style.** Il rend
     * deux choses : ne jamais poser d'état après démontage, et ne pas laisser
     * une lecture périmée écraser une lecture plus récente — le cas du double
     * montage de développement, où la requête du PREMIER effet peut résoudre
     * après celle du second. Le nettoyage ferme le `annule` de SON effet ; le
     * montage suivant en ouvre un neuf. C'est donc toujours la lecture la plus
     * récente qui écrit, jamais l'inverse.
     *
     * ⚠️ **Ce nettoyage n'est PAS une convention du dépôt — correction du
     * 2026-08-12.** Cette ligne affirmait « tous les `useEffect` du dépôt rendent
     * un nettoyage ». **Mesuré** (`git grep -n "useEffect(" 69a34fa -- app`) :
     * **3 sur 10** en rendent un — `app/foyer/InviteCard.tsx`,
     * `app/rayons/ListeRayons.tsx`, `FormulaireRecette.tsx`. Les sept autres
     * n'en rendent aucun, et ils ont raison : aucun n'attend de données. C'est
     * la LECTURE qui rend ce nettoyage dû ici, pas un usage maison.
     */
    let annule = false;

    async function lire() {
      try {
        /*
         * ⚠️ **`createNavigateurClient()` est appelée DANS le gestionnaire**,
         * jamais au niveau module ni dans un `useMemo` : `supabaseEnv()` LÈVE
         * quand la configuration manque, et l'appel doit donc être sous le
         * `try` pour que l'échec devienne un message plutôt qu'un écran mort.
         */
        const recus = await articlesDuFoyer(createNavigateurClient());
        if (annule) return;
        setArticles(recus);
      } catch (erreur) {
        if (annule) return;
        /*
         * ⛔ **SANS CE `catch`, L'ÉCRAN RESTERAIT SUR SON SQUELETTE, MUET.**
         * `articlesDuFoyer` lève, et `app/error.tsx` est une frontière d'erreur
         * de *rendu* : un rejet de promesse dans un callback `async` de
         * `useEffect` ne la traverse pas — il devient un `unhandledrejection`
         * que rien n'affiche. C'est le motif de `rayonsDuFoyer` qui NE se
         * transpose pas : lui est appelé depuis un composant serveur.
         *
         * ⛔ **LE `catch` ÉTAIT NU, ET C'EST UN DÉFAUT TROUVÉ EN REVUE le
         * 2026-08-07.** Sans liaison, l'erreur réelle disparaissait : sur la
         * PREMIÈRE lecture client-direct du produit, plus rien ne permettait de
         * distinguer un réseau coupé d'une configuration absente. Le membre voit
         * une phrase ; le développeur doit voir la cause.
         */
        console.error("[courses] Lecture de la liste :", erreur);
        setEchec(true);
      }
    }

    void lire();
    return () => {
      annule = true;
    };
  }, []);

  /*
   * ⛔ **LA BASCULE EST OPTIMISTE, ET SON ROLLBACK EST LA MOITIÉ QU'ON OUBLIE**
   * (story 4.3, décision D4). `EXPERIENCE.md:104` prescrit la mise à jour
   * optimiste : dans un magasin, une coche qui attend le réseau est une coche
   * qu'on tape deux fois. On pose donc l'état AVANT d'écrire.
   *
   * ⚠️ **Sans le rollback, l'écran affiche un état que la base n'a pas** — et il
   * l'afficherait jusqu'au prochain chargement, c'est-à-dire potentiellement
   * jusqu'à la fin des courses. C'est la même famille que le défaut « le squelette
   * ne doit jamais être l'état d'échec », corrigé en revue de la 4.2.
   *
   * ⚠️ **On ne relit PAS après écriture.** AD-8 proscrit le reload manuel, la
   * propagation est la story 4.11, et un aller-retour par coche contredirait
   * NFR-1. L'état local fait foi jusqu'au prochain montage.
   */
  async function basculer(article: ArticleDeListe, caseCochee: boolean) {
    const vise = statutApresGeste(caseCochee);
    const precedent = article.statut;

    /*
     * ⚠️ **On ne touche QUE le statut, et l'ordre de la base est préservé.** Le
     * regroupement est dérivé : l'article redescend sous le séparateur « Dans le
     * panier » dans le même rendu que la coche, par la seule règle de
     * `grouperParRayon` — la même qu'au chargement. Deux chemins qui
     * divergeraient seraient un défaut de plus, et c'en était un jusqu'au
     * 2026-08-13 (voir l'encadré de l'état).
     */
    const reposer = (statut: StatutArticle) =>
      setArticles((actuels) =>
        actuels === null
          ? actuels
          : actuels.map((a) => (a.id === article.id ? { ...a, statut } : a))
      );

    reposer(vise);
    setEchec(false);

    try {
      await basculerStatut(createNavigateurClient(), article.id, vise);
    } catch (erreur) {
      /*
       * ⛔ **Le rollback rétablit l'état PRÉCÉDENT, pas l'inverse du visé.** Les
       * deux coïncident aujourd'hui, mais ils divergeraient dès qu'un troisième
       * état existerait — ou si deux gestes rapides se croisaient. On rétablit ce
       * qu'on a mesuré avant d'écrire.
       */
      console.error("[courses] Bascule de l'article :", erreur);
      reposer(precedent);
      setEchec(true);
    }
  }

  /*
   * ⛔ **LES TROIS RETRAITS SONT OPTIMISTES, ET LEUR ROLLBACK RÉTABLIT LE TABLEAU
   * ENTIER.** C'est le motif de `basculer` (4.3), à une différence près qui compte :
   * une bascule ne touche qu'un champ d'un article, un retrait fait DISPARAÎTRE des
   * lignes. On garde donc la liste précédente en entier — reconstruire « ce qui a
   * été enlevé » depuis un prédicat rejouerait la règle deux fois, et les deux
   * pourraient diverger.
   *
   * ⛔ **ET SURTOUT : LE COMPTE AFFICHÉ VIENT DU SERVEUR, PAS DE L'OPTIMISME.** La
   * fonction SQL rend le nombre de lignes réellement touchées. Si l'autre membre du
   * foyer vient d'archiver, elle rend moins que ce que l'écran a retiré — et c'est
   * ce chiffre-là qui est vrai. Annoncer notre estimation ferait dire à l'écran
   * quelque chose que la base n'a pas fait.
   *
   * ⚠️ **`echec` n'est PAS réutilisé pour ces gestes.** Il porte « je n'ai pas pu
   * LIRE la liste » et commande le squelette : le poser sur une écriture ratée
   * ferait disparaître une liste parfaitement affichée. Chaque zone d'action porte
   * donc son propre message — c'est la règle du dépôt, payée deux fois sur
   * `/rayons` (« une région de statut par formulaire »).
   */
  const [messageGeste, setMessageGeste] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  /**
   * Applique un retrait : on enlève d'abord, on écrit ensuite, on rétablit si ça
   * casse. `ecrire` rend le compte réel, `garder` dit ce qui survit à l'écran.
   */
  async function retirer(
    garder: (a: ArticleDeListe) => boolean,
    ecrire: () => Promise<number>,
    phrase: (compte: number) => string | null,
    quoi: string
  ) {
    const precedent = articles;
    setOccupe(true);
    setMessageGeste(null);
    setArticles((actuels) => (actuels === null ? actuels : actuels.filter(garder)));

    try {
      setMessageGeste(phrase(await ecrire()));
    } catch (erreur) {
      /*
       * ⚠️ **Le membre voit une phrase, le développeur voit la cause** — la règle
       * posée par le `catch` de la lecture le 2026-08-07, et que `versArticle` a
       * reprise. Sans liaison, un refus de la base et un réseau coupé deviennent
       * indiscernables.
       */
      console.error(`[courses] ${quoi} :`, erreur);
      setArticles(precedent);
      /*
       * ⚠️ **Aucun « Réessaie »** : `project-context.md` l'interdit sur une
       * condition non transitoire, et ce `catch` attrape aussi la configuration
       * absente. La phrase constate, elle ne promet pas.
       */
      setMessageGeste("Ça n'a pas marché. Rien n'a été retiré.");
    } finally {
      setOccupe(false);
    }
  }

  const supprimer = (article: ArticleDeListe) =>
    retirer(
      (a) => a.id !== article.id,
      async () => supprimerArticle(createNavigateurClient(), article.id),
      /*
       * ⚠️ **Le retrait d'UN article ne s'annonce pas par un compte.** « 1 article
       * retiré. » sous une ligne qui vient de disparaître sous les yeux du membre
       * est du bruit : la disparition EST le retour visuel. On ne parle que du cas
       * où rien n'a bougé — l'autre membre l'avait déjà retiré.
       */
      (compte) => (compte === 0 ? "Cet article n'était déjà plus dans ta liste." : null),
      "Suppression d'un article"
    );

  const archiver = () =>
    retirer(
      (a) => a.statut !== "bought",
      async () => archiverLesAchetes(createNavigateurClient()),
      compteRenduArchivage,
      "Archivage des articles pris"
    );

  const vider = () =>
    retirer(
      () => false,
      async () => viderLaListe(createNavigateurClient()),
      compteRenduVidage,
      "Vidage de la liste"
    );

  /*
   * ⛔ **LE COMPTEUR COMPTE LES `pending`, PAS LA LONGUEUR DU TABLEAU.** Depuis
   * que la vue rend aussi les articles achetés (migration du 2026-08-13),
   * `articles.length` vaut « tout ce qu'il y a dans la liste » — le laisser ici
   * ferait annoncer « 12 à prendre » au-dessus de douze lignes dont dix sont
   * barrées, **et aucune porte automatique ne le verrait**.
   */
  const aPrendre = (articles ?? []).filter((a) => a.statut === "pending").length;

  return (
    <>
      {/*
       * ⚠️ **La zone de message est montée EN PERMANENCE, hors des
       * conditionnels.** C'est le récidiviste n°1 du dépôt — cinq occurrences :
       * un message rendu à l'intérieur de la liste partirait avec elle au
       * premier rendu vide, et un lecteur d'écran ne l'annoncerait jamais.
       *
       * ⛔ **PAS DE `reserve` ICI, et c'est une correction du 2026-08-12.** Le
       * contrat de `reserve` est de ne pas pousser une CIBLE sous le doigt quand
       * un message arrive. Cet écran n'a **ni formulaire ni cible tactile** sous
       * la zone, et le message et la liste **ne coexistent jamais** — sur
       * `echec`, la branche suivante rend `null`. `reserve` y immobilisait donc
       * 24 px (`.notice { min-h-6 }`) en permanence, sur le seul écran dont
       * `page.tsx` justifie `p-screen` (8 px) par « chaque pixel de largeur sert
       * le contenu » : 32 px gagnés en largeur, 24 px dépensés en hauteur, pour
       * un motif appliqué par analogie et non par sa cause.
       *
       * ⛔ **PAS DE « Reviens dans un instant », ET C'EST UNE CORRECTION DE
       * REVUE (2026-08-07).** Ce `catch` attrape tout, y compris
       * `supabaseEnv()` qui LÈVE quand une variable de configuration manque —
       * une condition qui ne se répare pas en attendant. « Reviens dans un
       * instant » y enfermerait le membre dans une boucle, ce que
       * `project-context.md` interdit nommément, et que le dépôt a déjà payé une
       * fois sur `/rayons`. La phrase constate donc, elle ne promet rien.
       * ⚠️ **Et pas de bouton « réessayer » non plus** : AD-8 proscrit le reload
       * manuel, et la propagation est la story 4.11.
       */}
      <Notice>{echec ? "On n'a pas réussi à ouvrir ta liste." : null}</Notice>

      {/*
       * ⚠️ **Les trois états se testent DANS CET ORDRE, et `articles === null`
       * s'écrit en clair plutôt que derrière un booléen nommé.** Une variable
       * `enChargement = articles === null && !echec` se lisait mieux, mais elle
       * privait TypeScript du rétrécissement : il ne voyait plus qu'`articles`
       * est non nul dans la dernière branche, et il a raison de le demander.
       *
       * ⚠️ **Le test porte sur `articles`, pas sur `groupes`** : les deux sont
       * nuls ensemble (le second est dérivé du premier), mais seul le premier
       * apprend quelque chose à TypeScript.
       */}
      {echec ? null : articles === null ? (
        <SqueletteDeRayons />
      ) : (
        <>
          {/*
           * ⛔ **L'ÉTAT VIDE N'EST PLUS UN CUL-DE-SAC, ET C'EST UN DÉFAUT TROUVÉ AU
           * PARCOURS À L'ÉCRAN DU 2026-08-17 (story 4.5).** Le formulaire d'ajout et
           * la zone de compte-rendu vivaient TOUS DEUX dans la branche « liste non
           * vide ». Conséquences mesurées à l'écran, l'une après l'autre :
           *
           * 1. **On ne pouvait plus rien ajouter** après avoir vidé sa liste — le
           *    seul chemin de sortie était de recharger une page qui n'offrait rien.
           * 2. **Le compte rendu du vidage disparaissait avec la liste** : « 11
           *    articles retirés. » s'affichait puis était démonté dans le même rendu.
           *
           * ⚠️ **Le défaut n°1 est ANTÉRIEUR à cette story** — il date de la 4.4, qui
           * a monté le formulaire dans la branche non vide. Il était DORMANT parce
           * qu'aucun geste ne menait à l'état vide : seul un foyer neuf y arrivait, et
           * il n'avait rien à retirer. ⛔ **« Tout enlever » le rend atteignable d'un
           * clic**, donc cette story doit le fermer : une story laisse le système
           * entier en état de marche, pas seulement ses propres critères.
           *
           * ✅ **Et ça referme l'écart que la 4.2 avait DATÉ**, en écrivant :
           * « ÉCART ASSUMÉ à EXPERIENCE.md, qui prescrit aussi *sur téléphone, lien
           * vers l'ajout*. Ce lien n'existera qu'à la story 4.4. » Il n'y existait
           * pas ; il existe ici.
           *
           * ⛔ **CETTE BRANCHE N'EST PLUS ATTEIGNABLE EN CAS D'ÉCHEC**, et c'est
           * tout l'objet du troisième état plus haut : « Ta liste est vide. » est
           * une AFFIRMATION, elle ne se dit qu'après avoir lu.
           */}
          {articles.length === 0 ? (
            <p className="hint mt-6">Ta liste est vide.</p>
          ) : null}

          {articles.length > 0 ? (
            <>
              {/*
           * ⛔ **TROIS ÉTATS DE CONTENU DEPUIS LA 4.3, PAS DEUX.** Avant elle, la
           * vue filtrait les achetés : « aucun article » et « rien à prendre »
           * étaient le même état, et `articles.length === 0` suffisait. Ce n'est
           * plus vrai — une liste dont TOUT est acheté a des articles et zéro à
           * prendre.
           *
           * ⛔ **Réutiliser « Ta liste est vide. » ici aurait été un MENSONGE**, et
           * la même famille que l'échec qui affirmait le vide, corrigé en revue de
           * la 4.2 : la liste n'est pas vide, elle est FAITE. Et c'est le moment
           * du parcours où le membre a le plus besoin d'être conforté — d'où une
           * phrase qui constate un succès plutôt qu'un manque.
           *
           * ⚠️ **Le compteur reste monté**, à zéro : le retirer ferait sauter la
           * mise en page au dernier article coché, et priverait le lecteur d'écran
           * de l'annonce du passage à zéro.
           */}
              <CompteurAPrendre nombre={aPrendre} />

              {aPrendre === 0 ? (
                <p className="hint mt-2">Tout est dans le panier.</p>
              ) : null}
            </>
          ) : null}

          {/*
           * ⚠️ **Le formulaire est SOUS le compteur et AU-DESSUS de la liste.**
           * `EXPERIENCE.md` place l'ajout sur l'écran liste ; le mettre en bas
           * l'enterrerait sous une liste qui peut faire trente lignes, sur un
           * écran tenu à une main dans un magasin.
           *
           * ⛔ **IL EST HORS DU CONDITIONNEL DEPUIS LE 2026-08-17**, et c'est le
           * correctif du cul-de-sac : sur une liste vide, il est la SEULE chose à
           * faire, donc c'est là qu'il compte le plus.
           */}
          <AjouterArticle onAjout={relire} />

          {articles.length > 0 ? (
          <ul className="mt-6 flex flex-col gap-gutter">
            {groupes.map((groupe) => (
              <li key={groupe.rayonId ?? "a-classer"}>
                <CarteRayon
                  id={groupe.rayonId}
                  nom={groupe.nom}
                  icone={groupe.icone}
                  /*
                   * ⛔ **`pris` EST RÉEL DEPUIS LA 4.3.** Il valait `0` en dur
                   * tant que la vue filtrait `status = 'pending'` : aucun article
                   * ne pouvait être « pris » puisqu'un article coché sortait de
                   * la lecture. La migration du 2026-08-13 l'a rendu mesurable.
                   *
                   * ⛔ **`pris`, `total` ET les enfants viennent du MÊME tableau,
                   * dans la MÊME expression.** La carte reçoit trois vérités sur
                   * le même fait et ne peut pas les rapprocher — l'AC3 de la 2.4
                   * lui interdit de connaître le type des articles qu'elle
                   * enveloppe. Compter sur un tableau et rendre l'autre ferait
                   * annoncer « 3 sur 5 pris » au-dessus de 4 lignes, et **aucune
                   * porte ne le verrait**.
                   *
                   * ⚠️ **Le dénominateur ne décroît PLUS** : il valait `0/4 →
                   * 0/3` quand cocher retirait l'article de la vue. Il vaut
                   * désormais `1/4 → 2/4`, ce que le ratio annonce depuis
                   * toujours. La note de la 4.2 pour la story 4.5 tombe d'elle-même.
                   */
                  pris={groupe.articles.filter((a) => a.statut === "bought").length}
                  total={groupe.articles.length}
                >
                  <ul>
                    {groupe.articles.map((article, rang) => (
                      <Fragment key={article.id}>
                        {/*
                         * ⛔ **LE SÉPARATEUR NAÎT DE LA TRANSITION, PAS D'UN
                         * DEUXIÈME PARCOURS.** `trierPanierEnBas` a déjà rangé
                         * les achetés en fin de tableau : le séparateur se pose
                         * donc au PREMIER article acheté, c'est-à-dire là où le
                         * statut change. Rendre deux listes séparées aurait
                         * dédoublé le `map`, et fait diverger deux ordres qui
                         * doivent rester le même.
                         *
                         * ⚠️ **Il ne se rend que s'il a quelque chose à séparer** :
                         * un rayon dont TOUT est acheté commence au rang 0, donc
                         * pas de séparateur — il n'y a rien au-dessus.
                         */}
                        {article.statut === "bought" && rang > 0 &&
                        groupe.articles[rang - 1]?.statut === "pending" ? (
                          <li aria-hidden className="separateur-panier">
                            Dans le panier
                          </li>
                        ) : null}
                        <LigneArticle
                          article={article}
                          onBasculer={basculer}
                          onSupprimer={supprimer}
                          occupe={occupe}
                        />
                      </Fragment>
                    ))}
                  </ul>
                </CarteRayon>
              </li>
            ))}
          </ul>
          ) : null}

          {/*
           * ⚠️ **`aDesArticlesPris` se calcule sur les articles, pas sur les
           * groupes** — même raison que le compteur juste au-dessus : la longueur
           * du tableau ne dit plus rien depuis que la vue rend aussi les achetés.
           *
           * ⚠️ **Il reste monté sur une liste vide**, sans quoi le compte rendu du
           * vidage (« 11 articles retirés. ») serait démonté dans le rendu même qui
           * l'écrit. C'est le composant qui décide de ne rendre que sa zone de
           * message quand il n'a plus de cible.
           */}
          <GestesDeListe
            aDesArticles={articles.length > 0}
            aDesArticlesPris={articles.some((a) => a.statut === "bought")}
            occupe={occupe}
            message={messageGeste}
            onArchiver={archiver}
            onVider={vider}
            onOublierMessage={() => setMessageGeste(null)}
          />
        </>
      )}
    </>
  );
}

/**
 * Le gros compteur — l'objet le plus visible de l'écran (48px).
 *
 * ⚠️ **UN SEUL nom accessible, jamais deux nœuds séparés.**
 * `review-accessibility.md` le fixe : « compteur en un seul label *12 articles à
 * prendre* ». Rendre « 12 » et « à prendre » comme deux textes voisins ferait
 * annoncer « douze » puis « à prendre » à un lecteur d'écran, et le chiffre seul
 * ne veut rien dire.
 *
 * ⛔ **L'annonce passe par un jumeau `.sr-only`, PAS par `aria-label`.** Un
 * `<p>` porte le rôle `paragraph`, *name-prohibited* en ARIA 1.2 : l'attribut
 * serait ignoré et le nom accessible retomberait sur le texte visible. Le dépôt
 * a payé cette leçon deux fois — sur le code d'invitation, puis sur le ratio de
 * la carte-rayon le 2026-08-07.
 *
 * ⚠️ **`text-accent-text` et rien d'autre.** C'est le premier écran du produit
 * où l'abricot est légitime (UX-DR2 le réserve à l'action courses), mais
 * `--accent` et `--accent-strong` ne sont pas publiés comme utilitaires,
 * délibérément : ils ne basculent pas avec le thème et rendaient 1,90:1 sur
 * carte blanche.
 *
 * ⚠️ **SON CONTRASTE N'EST PAS CELUI QUE LE TOKEN ANNONCE, et c'est mesuré en
 * revue le 2026-08-07.** `--accent-text-light` est annoté « 5,18:1 » dans
 * `globals.css` — exact, mais **sur CARTE** (`#ffffff`). Le compteur, lui, vit
 * dans un `<p>` posé directement sur `--surface-base-image` : c'est le PREMIER
 * emploi d'`accent-text` hors carte, et le fond y mesure **4,72 / 4,55 /
 * 4,42:1** sur ses trois arrêts (`#f7f4ee`, `#eef1ee`, `#f3ece3`).
 *
 * ✅ **Ça tient, mais de justesse et POUR UNE SEULE RAISON** — 48px/800 est du
 * grand texte, dont le seuil AA est **3:1**.
 *
 * ⛔ **CORRECTION DU 2026-08-12 : cette ligne disait « 4,42:1 passe AA même en
 * texte normal ». C'EST FAUX.** Le seuil AA du texte normal est **4,5:1** ; 4,42
 * échoue. L'erreur n'était pas cosmétique — la phrase suivante en faisait une
 * règle de décision, donc un futur compteur à 22px régulier aurait été validé
 * contre un chiffre présenté comme conforme alors qu'il ne l'est pas, et sur
 * l'arrêt le plus chaud du dégradé, c'est-à-dire en bas de page.
 *
 * ⛔ **Ce qui reste vrai, et qui est la vraie garde** : la marge est celle du fond
 * de page, pas celle de la carte. Réduire `.compteur` sous **24px** ou sa graisse
 * sous **700** le fait sortir du « grand texte » et le juge alors contre 4,5:1,
 * qu'il **ne tient pas** — ce n'est donc pas une prudence, c'est un interdit.
 */
function CompteurAPrendre({ nombre }: { nombre: number }) {
  return (
    <p className="mt-6">
      <span aria-hidden className="compteur block text-accent-text">
        {nombre}
      </span>
      <span aria-hidden className="text-meta text-muted">
        à prendre
      </span>
      <span className="sr-only">
        {nombre} article{nombre > 1 ? "s" : ""} à prendre
      </span>
    </p>
  );
}

/**
 * Une ligne d'article : sa coche, son libellé, sa quantité et son unité.
 *
 * **Ce que la 4.3 rend.** `DESIGN.md` décrit la ligne complète — coche / libellé
 * / pastille « arrive… » / quantité / provenance. La coche arrive ici (story
 * 4.3, décision D2 : cette story pose le VRAI contrôle, la 4.13 ne garde que le
 * plancher — contrastes mesurés, anneau de focus, `reduced-motion`, zoom 200 %).
 * La pastille reste la 4.14, la provenance la 4.6.
 *
 * ⛔ **LA LIGNE ENTIÈRE EST UN `<label>`, ET C'EST CE QUI FAIT LE HIT-TARGET.**
 * `EXPERIENCE.md:104` : « tap n'importe où sur la ligne = bascule », **un seul
 * hit-target par ligne**. Un `<label>` obtient ça du navigateur : le clic
 * n'importe où bascule la case native, au doigt comme à la souris, sans un seul
 * gestionnaire sur le conteneur. ⚠️ **L'alternative aurait coûté trois défauts** :
 * un `onClick` sur le `<li>` aurait rendu la ligne inatteignable au clavier,
 * exigé `role`/`tabIndex` à la main, et dédoublé l'événement quand le clic tombe
 * sur la case elle-même.
 *
 * ⛔ **SANS L'UNITÉ, L'ÉCRAN MENT.** AD-7 fait de l'unité un morceau de la clé
 * canonique : « lait / L » et « lait / pièce » sont deux lignes légitimes du même
 * rayon, jamais additionnées ni converties. Les afficher toutes deux « Lait »
 * rendrait un doublon apparent que rien n'expliquerait, et le membre en
 * conclurait que l'agrégation est cassée.
 *
 * ⚠️ **UN SEUL élément interactif par ligne.** Y ajouter un second (bouton de
 * suppression, menu) casserait le hit-target unique — la suppression est la
 * story 4.5, et elle devra trancher ce point plutôt que le contourner.
 *
 * ⚠️ **`text-muted`, jamais `muted-2`** : la quantité PORTE de l'information, et
 * `DESIGN.md` est explicite — « aucun texte porteur d'information n'est en
 * muted-2 ». ⛔ **La SEULE exception est l'article coché** : sa quantité y devient
 * redondante (`DESIGN.md:161`, `done-meta-color`), et c'est le seul emploi
 * autorisé de `muted-2` dans tout le produit.
 *
 * ⛔ **Le LIBELLÉ d'un article coché reste en `muted`, PAS en `muted-2`.**
 * `DESIGN.md:161` a corrigé ce point nommément (« était muted-2 ~2:1 sur clair ») :
 * le barré doit rester **lisible**, sinon on ne peut plus récupérer l'article —
 * ce que FR-3 exige. Le barré et la coche pleine sont les signaux primaires ; la
 * couleur ne porte jamais l'état seule (UX-DR3).
 */
function LigneArticle({
  article,
  onBasculer,
  onSupprimer,
  occupe,
}: {
  article: ArticleDeListe;
  onBasculer: (article: ArticleDeListe, versAchete: boolean) => void;
  onSupprimer: (article: ArticleDeListe) => void;
  occupe: boolean;
}) {
  const quantite = formaterQuantiteEtUnite(article.quantite, article.unite);
  const achete = article.statut === "bought";

  /*
   * ⚠️ **La confirmation est un état LOCAL à la ligne**, et c'est ce qui la rend
   * sûre : elle meurt avec la ligne. Une confirmation portée par l'écran devrait
   * désigner l'article par son `id`, et survivrait donc à sa disparition — le
   * défaut exact que `ListeRayons` a corrigé en remettant `aConfirmer` à `null`
   * dans quatre chemins différents.
   */
  const [confirme, setConfirme] = useState(false);

  return (
    <li className="ligne-article">
      {/*
       * ⛔ **LE BOUTON EST LE FRÈRE DU `<label>`, JAMAIS SON ENFANT.** Un
       * `<button>` placé dans le label verrait chacun de ses clics basculer AUSSI
       * la case — le label capture tout ce qu'il contient. C'est le piège n°4 de
       * la story, et il ne se voit sur aucune porte automatique.
       */}
      <label className="ligne-bascule">
        {/*
         * ⛔ **UN VRAI `<input type="checkbox">`.** `EXPERIENCE.md:151` :
         * « chaque élément interactif est un vrai contrôle, pas un `<span>`
         * décoratif ». Il annonce son état ET son changement d'état sans qu'on
         * écrive une ligne d'ARIA, gère la barre d'espace, et se rattache au
         * label par imbrication.
         *
         * ⚠️ **`aria-label` porte le libellé COMPLET**, parce que le contenu
         * visible du label inclut la quantité : sans lui, un lecteur d'écran
         * annoncerait « Lait 1,5 L, case à cocher » — le format que
         * `EXPERIENCE.md:104` remplace par « {article}, {à prendre | dans le
         * panier} ».
         */}
        <input
          type="checkbox"
          className="coche"
          checked={achete}
          aria-label={`${article.nom}, ${achete ? "dans le panier" : "à prendre"}`}
          onChange={(e) => onBasculer(article, e.currentTarget.checked)}
        />
      {/*
       * `min-w-0 flex-1 break-words` : un nom d'article va jusqu'à 200
       * caractères (mesuré), sans garantie d'espace où couper. Sans `min-w-0`,
       * il élargit le conteneur flex et fait défiler l'écran horizontalement —
       * ce que NFR-3 et UX-DR11 interdisent sur le seul écran dont l'ergonomie
       * mobile n'est pas négociable.
       */}
        <span
          className={`text-body min-w-0 flex-1 break-words${achete ? " article-achete" : ""}`}
        >
          {article.nom}
        </span>

      {/*
       * ⛔ **UNE UNITÉ SANS SA QUANTITÉ NE SE REND PAS, ET C'EST UNE CORRECTION
       * DE REVUE (2026-08-07).** La première rédaction testait
       * `quantite !== null || unite !== null` : le couple `(null, 'kg')`
       * passait, et `filter(Boolean).join(" ")` rendait « **kg** » tout seul, à
       * droite de la ligne — un mot d'unité sans rien à mesurer.
       *
       * ⚠️ **Ce couple est possible, mesuré** : `grocery_list_items_unite_fermee`
       * ne contraint que le VOCABULAIRE (`unit is null or unit in (…)`), et rien
       * ne couple les deux colonnes — le helper de test du dépôt insère
       * précisément `{ name, unit }` sans `quantity`.
       *
       * ⚠️ **C'est la quantité qui commande.** Une unité qualifie un nombre :
       * sans nombre elle ne veut rien dire, alors qu'un nombre nu (« 3 ») en dit
       * déjà quelque chose.
       *
       * ⛔ **L'APPARIEMENT A QUITTÉ CE JSX le 2026-08-12, et le motif compte.**
       * Il rendait « **2 pièce** » — l'unité ne s'accordait jamais en nombre,
       * alors que NFR-8 veut du français et que 2 des 8 jetons du vocabulaire
       * fermé sont des noms communs. Le défaut était **intestable là où il
       * vivait** : NFR-10 interdit un harnais de composants. `formaterQuantiteEtUnite`
       * le descend dans `lib/quantite.ts`, où il est mesuré — c'est la raison du
       * déplacement, pas un rangement.
       */}
        {quantite !== null ? (
          <span
            className={`text-qty shrink-0 tabular-nums ${achete ? "text-muted-2" : "text-muted"}`}
          >
            {quantite}
          </span>
        ) : null}
      </label>

      {/*
       * ⛔ **CONFIRMATION EN DEUX TEMPS, SUR PLACE — jamais `window.confirm`**
       * (hors thème, hors ton, et il bloque toute vérification pilotée par
       * navigateur). Motif d'`InviteCard` et de `ListeRayons`.
       *
       * ⚠️ **Elle REMPLACE le bouton, elle n'ouvre pas un panneau.** Un panneau
       * qui pousse ferait sauter les trente lignes en dessous, sur l'écran qu'on
       * lit à une main dans un magasin.
       *
       * ⚠️ **Pourquoi une confirmation alors que FR-6 n'en demande pas** : il n'y
       * a **aucune annulation** au périmètre, et le tombstone n'en est pas une —
       * réajouter l'article le fait revenir, mais rien à l'écran ne le propose. La
       * confirmation est donc le seul filet contre un doigt qui rate la bascule.
       */}
      {confirme ? (
        <>
          <button
            type="button"
            className="btn-ligne"
            disabled={occupe}
            aria-label={`Confirmer le retrait de ${article.nom}`}
            onClick={() => {
              setConfirme(false);
              onSupprimer(article);
            }}
          >
            Confirmer
          </button>
          <button
            type="button"
            className="btn-ligne"
            disabled={occupe}
            aria-label={`Garder ${article.nom} dans la liste`}
            onClick={() => setConfirme(false)}
          >
            Non
          </button>
        </>
      ) : (
        /*
         * ⚠️ **`aria-label` nomme L'ARTICLE**, sinon trente boutons « Retirer »
         * sont indiscernables au lecteur d'écran. ⚠️ Il CONTIENT le libellé
         * visible (« Retirer »), ce qu'exige WCAG 2.5.3 « Label in Name » : un
         * utilisateur de commande vocale dit « Retirer » et doit être compris.
         */
        <button
          type="button"
          className="btn-ligne"
          disabled={occupe}
          aria-label={`Retirer ${article.nom}`}
          onClick={() => setConfirme(true)}
        >
          Retirer
        </button>
      )}
    </li>
  );
}

/**
 * Le squelette de la lecture — **dans le composant, pas dans `loading.tsx`**.
 *
 * ⛔ **`loading.tsx` NE COUVRE PAS une lecture client.** Il enveloppe l'attente
 * du *rendu serveur* ; une lecture faite dans un `useEffect` se produit APRÈS
 * que la page est rendue, donc le `loading.tsx` a déjà disparu et l'écran serait
 * vide pendant l'`await`. Les deux sont dus, et ils ne couvrent pas la même
 * chose.
 *
 * ⚠️ **Ça ne se voit qu'au réseau bridé** — la leçon de la story 3.3, écrite
 * dans `app/menu/loading.tsx` : « un squelette manquant ou mal placé ne se voit
 * qu'au réseau bridé, jamais en local. »
 *
 * ⚠️ **La couleur porte le contraste, jamais l'animation.**
 * `prefers-reduced-motion` ramène toute animation à 0,01 ms ; un squelette dont
 * seule l'animation portait le contraste deviendrait un aplat invisible.
 * ⛔ `bg-gray-200` n'existe pas dans ce projet et échouerait EN SILENCE.
 *
 * ⚠️ **Les hauteurs suivent celles de l'écran** — `min-h-item` sur les lignes,
 * `p-card` et `rounded-md` sur les cartes, `gap-gutter` entre elles. La story
 * 3.6 a rendu ses cases à 44px sans toucher son squelette resté à ~40px : saut
 * de mise en page rattrapé en revue. Si l'une bouge, celui-ci bouge avec.
 *
 * ⛔ **`--card-shadow` EN FAIT PARTIE, et il manquait — correction du 2026-08-12.**
 * `CarteRayon` porte `style={{ boxShadow: "var(--card-shadow)" }}` ; le squelette
 * ne l'avait pas, alors que ce docblock promettait la parité. En clair, le token
 * vaut `0 6px 18px rgba(60,50,30,.06)` : les trois cartes **se décollaient du
 * fond d'un coup** au passage de relais. ⚠️ **En sombre le token vaut `none`,
 * donc le défaut ne se voyait que dans UN thème** — la moitié exacte qui a piégé
 * la story 2.2, et la famille que la règle §7 réserve à l'œil.
 */
function SqueletteDeRayons() {
  return (
    <div aria-hidden="true" className="mt-6 animate-pulse">
      {/* Le gros compteur et son libellé */}
      <span className="block h-11 w-20 rounded-md bg-card-border" />
      <span className="mt-2 block h-4 w-24 rounded-md bg-card-border" />

      <div className="mt-6 flex flex-col gap-gutter">
        {[0, 1, 2].map((carte) => (
          <div
            key={carte}
            className="rounded-md border border-card-border bg-surface-card p-card"
            style={{ boxShadow: "var(--card-shadow)" }}
          >
            {/* L'en-tête de carte : pastille, nom, ratio */}
            <div className="flex items-center gap-2">
              <span className="size-6 shrink-0 rounded-sm bg-card-border" />
              <span className="h-3 flex-1 rounded-md bg-card-border" />
              <span className="h-3 w-8 shrink-0 rounded-md bg-card-border" />
            </div>

            <div className="mt-2">
              {[0, 1].map((ligne) => (
                <div key={ligne} className="flex min-h-item items-center gap-2">
                  <span className="h-4 flex-1 rounded-md bg-card-border" />
                  <span className="h-3 w-12 shrink-0 rounded-md bg-card-border" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
