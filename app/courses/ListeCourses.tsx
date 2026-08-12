"use client";

import { useEffect, useState } from "react";
import { CarteRayon } from "@/app/_lib/CarteRayon";
import { Notice } from "@/app/_lib/Notice";
import { createNavigateurClient } from "@/lib/supabase/client";
import { articlesDuFoyer, type ArticleDeListe } from "@/lib/liste/liste";
import { grouperParRayon, type GroupeDeRayon } from "@/lib/liste/groupement";
import { formaterQuantite } from "@/lib/quantite";

/**
 * La liste de courses, **lue depuis le navigateur** (AC1, AD-13).
 *
 * ⚠️ **PREMIÈRE LECTURE CLIENT-DIRECT DU PRODUIT, et il n'y avait aucun motif à
 * copier.** Mesuré le 2026-08-05 : les 20 appels de `createNavigateurClient()`
 * du dépôt sont des écritures ou de l'auth, et aucun des 8 `useEffect` ne faisait
 * d'`await` de données. Les états chargement / erreur / vide d'une lecture sont
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
   * `groupes` reste donc `null` en cas d'échec, et c'est `echec` qui distingue
   * « je charge » de « je n'ai pas pu ». **Un état vide se mérite** : il faut
   * avoir lu pour avoir le droit de dire qu'il n'y a rien.
   */
  const [groupes, setGroupes] = useState<GroupeDeRayon[] | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    /*
     * ⚠️ **Le drapeau d'annulation n'est pas une précaution de style.** Il rend
     * deux choses : ne jamais poser d'état après démontage, et ne pas laisser
     * une lecture périmée écraser une lecture plus récente — le cas du double
     * montage de développement, où la requête du PREMIER effet peut résoudre
     * après celle du second. Le nettoyage ferme le `annule` de SON effet ; le
     * montage suivant en ouvre un neuf. C'est donc toujours la lecture la plus
     * récente qui écrit, jamais l'inverse. Tous les `useEffect` du dépôt rendent
     * un nettoyage ; le premier qui lit des données ne fait pas exception.
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
        const articles = await articlesDuFoyer(createNavigateurClient());
        if (annule) return;
        setGroupes(grouperParRayon(articles));
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
        console.error("Lecture de la liste de courses :", erreur);
        setEchec(true);
      }
    }

    void lire();
    return () => {
      annule = true;
    };
  }, []);

  const articles = groupes?.flatMap((g) => g.articles) ?? [];

  return (
    <>
      {/*
       * ⚠️ **La zone de message est montée EN PERMANENCE, hors des
       * conditionnels.** C'est le récidiviste n°1 du dépôt — cinq occurrences :
       * un message rendu à l'intérieur de la liste partirait avec elle au
       * premier rendu vide, et un lecteur d'écran ne l'annoncerait jamais.
       *
       * `reserve` : elle surplombe la liste, donc elle garde sa hauteur pour ne
       * pas pousser le contenu sous le doigt au moment où un message arrive.
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
      <Notice reserve>
        {echec ? "On n'a pas réussi à ouvrir ta liste." : null}
      </Notice>

      {/*
       * ⚠️ **Les trois états se testent DANS CET ORDRE, et `groupes === null`
       * s'écrit en clair plutôt que derrière un booléen nommé.** Une variable
       * `enChargement = groupes === null && !echec` se lisait mieux, mais elle
       * privait TypeScript du rétrécissement : il ne voyait plus que `groupes`
       * est non nul dans la dernière branche, et il a raison de le demander.
       */}
      {echec ? null : groupes === null ? (
        <SqueletteDeRayons />
      ) : articles.length === 0 ? (
        /*
         * ⚠️ **ÉCART ASSUMÉ à `EXPERIENCE.md`**, qui prescrit aussi « sur
         * téléphone, lien vers l'ajout ». Ce lien n'existera qu'à la story 4.4 :
         * le poser maintenant mènerait nulle part, et un conseil qui ne peut pas
         * fonctionner enferme l'utilisateur dans une boucle. Écrit ici plutôt
         * qu'esquivé.
         *
         * ⛔ **CETTE BRANCHE N'EST PLUS ATTEIGNABLE EN CAS D'ÉCHEC**, et c'est
         * tout l'objet du troisième état plus haut : « Ta liste est vide. » est
         * une AFFIRMATION, elle ne se dit qu'après avoir lu.
         */
        <p className="hint mt-6">Ta liste est vide.</p>
      ) : (
        <>
          <CompteurAPrendre nombre={articles.length} />

          {/*
           * `gap-gutter` (14px) : l'espace inter-cartes du système, pas une
           * valeur inventée ici.
           */}
          <ul className="mt-6 flex list-none flex-col gap-gutter p-0">
            {groupes.map((groupe) => (
              <li key={groupe.rayonId ?? "a-classer"}>
                <CarteRayon
                  id={groupe.rayonId}
                  nom={groupe.nom}
                  icone={groupe.icone}
                  /*
                   * ⚠️ **`pris` vaut structurellement 0 jusqu'à la story 4.3, et
                   * ce n'est pas un défaut** : la vue filtre `status =
                   * 'pending'`, donc aucun article n'est « pris » tant que rien
                   * ne coche. Un relecteur qui voit « 0/4 » pensera à une
                   * panne ; c'est le comportement voulu, et il se corrige à la
                   * 4.3. ⛔ **Le dénominateur bougera aussi** : un article coché
                   * SORT de la vue, donc `total` décroîtra (0/4 → 0/3 → …).
                   * Consigné pour la 4.5.
                   */
                  pris={0}
                  /*
                   * ⛔ **`total` et les enfants viennent du MÊME tableau, dans
                   * la même expression.** La carte reçoit deux sources de vérité
                   * pour le même fait et ne peut pas les rapprocher — l'AC3 de
                   * la 2.4 lui interdit de connaître le type des articles
                   * qu'elle enveloppe. Filtrer les enfants en comptant sur la
                   * liste non filtrée ferait annoncer « 3 sur 5 pris » au-dessus
                   * de 4 lignes, et **aucune porte ne le verrait**.
                   */
                  total={groupe.articles.length}
                >
                  <ul className="list-none p-0">
                    {groupe.articles.map((article) => (
                      <LigneArticle key={article.id} article={article} />
                    ))}
                  </ul>
                </CarteRayon>
              </li>
            ))}
          </ul>
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
 * ✅ **Ça tient largement** — 4,42:1 passe AA même en texte normal, et 48px/800
 * est du grand texte (seuil 3:1). ⛔ **Mais la marge est celle du fond de page,
 * pas celle de la carte** : réduire la taille de `.compteur` sous 24px, ou sa
 * graisse sous 700, se juge contre 4,42:1 et non contre 5,18:1.
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
 * Une ligne d'article : son libellé, sa quantité et son unité.
 *
 * **Ce que la 4.2 rend, et rien d'autre.** `DESIGN.md` décrit la ligne complète
 * — coche / libellé / pastille « arrive… » / quantité / provenance — mais la
 * coche est la 4.3/4.13, la pastille la 4.14, la provenance la 4.6.
 *
 * ⛔ **SANS L'UNITÉ, L'ÉCRAN MENT.** AD-7 fait de l'unité un morceau de la clé
 * canonique : « lait / L » et « lait / pièce » sont deux lignes légitimes du même
 * rayon, jamais additionnées ni converties. Les afficher toutes deux « Lait »
 * rendrait un doublon apparent que rien n'expliquerait, et le membre en
 * conclurait que l'agrégation est cassée.
 *
 * ⚠️ **UN SEUL conteneur, pas plusieurs éléments interactifs frères.** La story
 * 4.13 posera ici une coche et un hit-target unique couvrant toute la ligne : la
 * rendre en plusieurs morceaux interactifs l'obligerait à tout refaire.
 *
 * ⚠️ **`text-muted`, jamais `muted-2`** : la quantité PORTE de l'information, et
 * `DESIGN.md` est explicite — « aucun texte porteur d'information n'est en
 * muted-2 ». `muted-2` est réservé à l'article déjà coché, donc à la story 4.3.
 */
function LigneArticle({ article }: { article: ArticleDeListe }) {
  const quantite = formaterQuantite(article.quantite);

  return (
    <li className="flex min-h-item items-center gap-2">
      {/*
       * `min-w-0 flex-1 break-words` : un nom d'article va jusqu'à 200
       * caractères (mesuré), sans garantie d'espace où couper. Sans `min-w-0`,
       * il élargit le conteneur flex et fait défiler l'écran horizontalement —
       * ce que NFR-3 et UX-DR11 interdisent sur le seul écran dont l'ergonomie
       * mobile n'est pas négociable.
       */}
      <span className="text-body min-w-0 flex-1 break-words">{article.nom}</span>

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
       * déjà quelque chose. Le `??` couvre donc le cas inverse, sans le
       * `filter(Boolean)` — qui aurait avalé le « 0 » que `formaterQuantite`
       * rend en CHAÎNE.
       */}
      {quantite !== null ? (
        <span className="text-qty shrink-0 text-muted tabular-nums">
          {article.unite === null ? quantite : `${quantite} ${article.unite}`}
        </span>
      ) : null}
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
