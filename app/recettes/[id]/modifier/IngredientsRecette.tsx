"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { ordreApresDeplacement, type Sens } from "@/lib/ordre";
import {
  refusIngredient,
  refusOrdreIngredients,
} from "@/lib/recettes/erreurs";
import {
  prochainOrdreIngredient,
  type Ingredient,
} from "@/lib/recettes/ingredients";
import { UNITES, estUniteConnue } from "@/lib/recettes/unites";
import {
  MAX_TITRE,
  QUANTITE_MAX,
  QUANTITE_MIN_NON_NULLE,
  analyserQuantite,
  normaliserTitre,
} from "@/lib/recettes/saisie";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  "nom-vide": "Il faut un nom.",
  "quantite-illisible": "Une quantité s'écrit en chiffres.",
  "quantite-negative": "Une quantité ne peut pas être négative.",
  /*
   * ⚠️ Ces deux messages NOMMENT la borne. « Une quantité s'écrit en chiffres. »
   * était rendu pour un nombre parfaitement écrit mais hors bornes : l'utilisateur
   * lisait un conseil qu'il avait déjà suivi. Revue du 2026-08-03.
   */
  "quantite-hors-bornes": `Une quantité s'arrête à ${QUANTITE_MAX.toLocaleString("fr-FR", { useGrouping: false })}.`,
  "quantite-trop-petite": `La plus petite quantité qu'on sache garder est ${QUANTITE_MIN_NON_NULLE.toLocaleString("fr-FR")}. En dessous, mets 0.`,
  "unite-inconnue": "Cette unité n'est pas dans la liste.",
  ajoute: "C'est noté.",
  modifie: "C'est noté.",
  supprime: "C'est retiré.",
  /*
   * ⚠️ Jamais « Réessaie » : retenter sans rafraîchir reproduirait le même refus
   * indéfiniment — le tableau envoyé ne correspond plus à la base, et seul un
   * rafraîchissement peut les remettre d'accord. C'est pour ça que le
   * `router.refresh()` fait partie du TRAITEMENT du refus.
   */
  "liste-changee": "La liste des ingrédients vient de changer. La voilà à jour.",
  /* Repli statique : la région de l'ordre rend mieux que ça — elle nomme le rang. */
  deplace: "C'est noté.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Où le message de la soumission en cours s'affiche.
 *
 * ⚠️ **Un message qu'on ne voit pas n'existe pas**, et c'est le récidiviste de ce
 * dépôt : deux défauts trouvés *deux fois de suite* sur `/rayons`, la première
 * correction en ayant créé deux régions pour trois surfaces de soumission. Ici il
 * y en a quatre — la liste, le panneau d'édition ouvert, le formulaire d'ajout, et
 * le réordonnancement — donc quatre régions.
 */
type Zone = "liste" | "edition" | "ajout" | "ordre";

/** L'état d'un formulaire d'ingrédient, sous sa forme de saisie. */
type Saisie = {
  nom: string;
  quantite: string;
  unite: string;
  motCleRayon: string;
  optionnel: boolean;
};

const SAISIE_VIDE: Saisie = {
  nom: "",
  quantite: "",
  unite: "",
  motCleRayon: "",
  optionnel: false,
};

function depuisIngredient(i: Ingredient): Saisie {
  return {
    nom: i.nom,
    quantite: i.quantite === null ? "" : String(i.quantite),
    unite: i.unite ?? "",
    motCleRayon: i.motCleRayon ?? "",
    optionnel: i.optionnel,
  };
}

/** Ce qui part en base, ou une clé de refus. */
type Colonnes = {
  name: string;
  quantity: number | null;
  unit: string | null;
  aisle_keyword: string | null;
  optional: boolean;
};

function versColonnes(saisie: Saisie): Colonnes | Cle {
  const nom = normaliserTitre(saisie.nom);
  if (!nom) return "nom-vide";

  /*
   * Un champ vide vaut « pas renseigné » ; un champ REMPLI qu'on ne sait pas lire
   * est un refus, jamais un `null` silencieux. Enregistrer `null` pour « deux »
   * perdrait la saisie sans un mot — c'est le défaut du champ icône de `/rayons`,
   * où « Fromages » tapé au mauvais endroit enregistrait « F ».
   */
  const brut = saisie.quantite.trim();
  let quantite: number | null = null;
  if (brut !== "") {
    /*
     * ⚠️ **Quatre refus distincts, pas un seul.** La première rédaction rendait
     * « quantite-illisible » pour tout ce que `normaliserQuantite` refusait — donc
     * « Une quantité s'écrit en chiffres. » à quelqu'un qui venait d'écrire
     * « 1000000 ». Un conseil qui ne peut pas fonctionner enferme l'utilisateur
     * dans une boucle. Revue adversariale du 2026-08-03, décision de Florian.
     */
    const analyse = analyserQuantite(brut);
    if ("faute" in analyse) {
      switch (analyse.faute) {
        case "illisible":
          return "quantite-illisible";
        case "negative":
          return "quantite-negative";
        case "hors-bornes":
          return "quantite-hors-bornes";
        case "trop-petite":
          return "quantite-trop-petite";
      }
    }
    quantite = analyse.valeur;
  }

  /*
   * ⚠️ **L'unité est validée, elle n'est plus seulement présumée.** La rédaction
   * précédente écrivait « le `<select>` n'émet que les huit jetons ou la chaîne
   * vide » — vrai, mais c'était une AFFIRMATION sur une autre partie du fichier, et
   * `estUniteConnue` existait sans aucun appelant en production : un prédicat
   * construit puis non branché, que les trois couches de la revue du 2026-08-03 ont
   * relevé. La frontière dure reste `recipe_ingredients_unite_fermee` en base
   * (AD-2) ; celle-ci rend un message au lieu d'un `23514`.
   */
  const unite = saisie.unite === "" ? null : saisie.unite;
  if (unite !== null && !estUniteConnue(unite)) return "unite-inconnue";

  return {
    name: nom,
    quantity: quantite,
    unit: unite,
    aisle_keyword: normaliserTitre(saisie.motCleRayon),
    optional: saisie.optionnel,
  };
}

/**
 * Les ingrédients d'une recette : ajouter, éditer, réordonner, retirer.
 *
 * ⚠️ **Composant à part, et pas par confort de découpage.** Le formulaire de la
 * recette (`FormulaireRecette`) **accumule** puis enregistre en un geste, avec une
 * garde sur les saisies non enregistrées. Les ingrédients s'écrivent **un par un**,
 * immédiatement, comme les rayons. Les mêler ferait entrer les ingrédients dans le
 * périmètre de la garde — et un ajout d'ingrédient enregistré déclencherait
 * « tu as des modifications non enregistrées » sur la recette, un message faux.
 *
 * ⚠️ **Écritures client-direct** (AD-13), y compris l'appel RPC : ni secret
 * serveur, ni conséquence à faire apparaître dans un rendu serveur.
 *
 * ⚠️ **Aucune copie locale de la liste.** L'état ne porte que l'interface — quelle
 * ligne est ouverte, quelle saisie est en cours. La liste vient des propriétés et
 * `router.refresh()` la rafraîchit ; une copie divergerait dès que l'autre membre
 * du foyer écrit, et il n'y a pas encore de propagation temps réel (AD-8, Epic 4).
 */
export function IngredientsRecette({
  recetteId,
  ingredients,
}: {
  recetteId: string;
  ingredients: Ingredient[];
}) {
  const router = useRouter();
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [saisieEditee, setSaisieEditee] = useState<Saisie>(SAISIE_VIDE);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState<Saisie>(SAISIE_VIDE);
  const [zone, setZone] = useState<Zone>("liste");
  /**
   * L'ingrédient qui vient d'être déplacé et son nouveau rang.
   *
   * Ce n'est **pas** une copie de la liste — c'est le contenu d'un message. Le
   * rang est la seule information qu'un lecteur d'écran ne peut PAS obtenir
   * autrement : une liste qui se réordonne le fait en silence.
   */
  const [deplacement, setDeplacement] = useState<{ nom: string; rang: number } | null>(
    null
  );

  /**
   * L'élément à refocaliser une fois le panneau refermé. Une **ref** et non un
   * état : la consommer ne doit pas déclencher de rendu.
   */
  const retourFocus = useRef<string | null>(null);

  /**
   * Vrai entre l'appel de réordonnancement et l'ARRIVÉE des nouvelles propriétés.
   *
   * ⚠️ **`occupe` ne suffit pas, et c'est tout le défaut.** `useSoumission` le
   * libère dès la réponse du RPC ; `router.refresh()` court encore. Pendant cette
   * fenêtre — la plus longue des deux, celle du rendu serveur — `ingredients` porte
   * l'ancien ordre, et une seconde pression recalcule la même permutation depuis les
   * mêmes propriétés. Trouvé par la revue adversariale du 2026-08-03, contre un
   * commentaire qui affirmait le contraire.
   */
  const [ordreEnvoye, setOrdreEnvoye] = useState<string[] | null>(null);

  /*
   * ⚠️ **Dérivé du CONTENU, ni d'une ref ni d'un effet.** Les deux raccourcis
   * évidents sont interdits, et à juste titre : `setState` dans un effet
   * (`react-hooks/set-state-in-effect`) coûterait un rendu de plus pour une
   * information que les propriétés portent déjà, et lire une `ref` pendant le rendu
   * (`react-hooks/refs`) donnerait un résultat que React ne s'engage pas à
   * rafraîchir.
   *
   * Comparer les identifiants dit exactement ce qu'on veut savoir : « les
   * propriétés reflètent-elles encore l'ordre d'AVANT mon appel ? ». C'est aussi
   * plus robuste qu'une comparaison de références — ça reste juste même si le rendu
   * serveur réutilisait un tableau.
   */
  const attenteOrdre =
    ordreEnvoye !== null &&
    ingredients.map((i) => i.id).join(" ") !== ordreEnvoye.join(" ");

  /*
   * ⚠️ **Le focus, sinon il retombe sur `<body>`.** Ouvrir un panneau remplace le
   * bouton de la ligne par un `<form>`, le refermer fait l'inverse, supprimer fait
   * disparaître la ligne. Sans ça, il faut repartir de `Tab` depuis le haut de la
   * page. `ingredients` est dans les dépendances pour couvrir les démontages qui
   * ne passent pas par `enEdition` — la leçon de la seconde passe de revue sur
   * `/rayons`, où le bouton de restauration avait été oublié.
   */
  useEffect(() => {
    const cible = retourFocus.current;
    if (!cible) return;
    retourFocus.current = null;
    document.getElementById(cible)?.focus();
  }, [enEdition, ingredients]);

  function ouvrir(i: Ingredient) {
    effacer();
    setZone("edition");
    retourFocus.current = `nom-${i.id}`;
    setEnEdition(i.id);
    setSaisieEditee(depuisIngredient(i));
    setAConfirmer(null);
  }

  function fermer(retour: string) {
    retourFocus.current = retour;
    setEnEdition(null);
    setAConfirmer(null);
  }

  async function ajouter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setZone("ajout");

    const colonnes = versColonnes(nouveau);
    if (typeof colonnes === "string") return refuser(colonnes);

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      /*
       * `recipe_id` est explicite : la colonne est `not null` sans défaut. Ce
       * n'est pas une garde — `recipe_ingredients_all` porte un `with check` qui
       * refuse une recette hors du foyer. La frontière est en base (AD-2).
       *
       * `sort_order` est calculé et jamais laissé au défaut, qui vaut 0 : sans
       * ça, chaque ajout rejoindrait le peloton des ex æquo.
       */
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .insert({
          ...colonnes,
          recipe_id: recetteId,
          sort_order: prochainOrdreIngredient(ingredients),
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[ingrédients] ajout refusé :", error.message);
        const refus = refusIngredient(error);
        /*
         * ⚠️ **Le rafraîchissement fait partie du TRAITEMENT du refus**, il n'est
         * pas décoratif : « la liste vient de changer » sans remettre l'écran
         * d'accord avec la base laisserait l'utilisateur devant une recette qui
         * n'existe plus. C'est écrit en tête de `MESSAGES` et le chemin d'ajout ne
         * le faisait pas — revue adversariale du 2026-08-03.
         */
        if (refus === "liste-changee") router.refresh();
        return refus;
      }

      setNouveau(SAISIE_VIDE);
      router.refresh();
      return "ajoute";
    });
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enEdition) return;
    setZone("edition");
    /*
     * Soumettre, c'est renoncer à supprimer. Sans ce désarmement, un
     * enregistrement refusé laisserait « Confirmer » armé juste sous le champ, où
     * il se lit comme « confirmer l'enregistrement ». Leçon de `/rayons`.
     */
    setAConfirmer(null);

    const colonnes = versColonnes(saisieEditee);
    if (typeof colonnes === "string") return refuser(colonnes);

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .update(colonnes)
        .eq("id", enEdition)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[ingrédients] enregistrement refusé :", error.message);
        return refusIngredient(error);
      }
      /*
       * ⚠️ Contrôler `data` autant qu'`error`. Un `update` sur une ligne que la
       * RLS masque — recette supprimée entre-temps par l'autre membre — rend zéro
       * ligne et AUCUNE erreur. Sans ce test, l'écran annoncerait « C'est noté. »
       * sur une écriture qui n'a rien touché.
       */
      if (!data) {
        /*
         * ⚠️ **L'ingrédient a disparu : les TROIS gestes, pas seulement le
         * rafraîchissement.** Sans `setZone("liste")` et `fermer()`, le
         * rafraîchissement retire la ligne, le `<form>` se démonte avec la région
         * qui portait le message — et « La liste des ingrédients vient de
         * changer. » ne s'affiche NULLE PART. Le seul message écrit pour ce cas
         * était le seul à ne jamais être vu. `enEdition` restait en prime sur un
         * identifiant fantôme. `ListeRayons` a une fonction dédiée pour ça,
         * `disparu()` ; ici les trois gestes tiennent en trois lignes.
         * Trouvé par la revue adversariale du 2026-08-03.
         */
        setZone("liste");
        fermer("titre-ingredients");
        router.refresh();
        return "liste-changee";
      }

      /*
       * ⚠️ **`setZone("liste")` AVANT `fermer()`, et la cible est la ligne
       * REPLIÉE.** Deux défauts en une ligne, trouvés par la revue du 2026-08-03,
       * et `supprimer()` les évitait déjà vingt lignes plus bas :
       *
       *   · sans le changement de zone, « C'est noté. » se rendait dans
       *     `statutEdition`, à l'intérieur du `<form>` que `fermer()` démonte au
       *     même rendu : le panneau se refermait EN SILENCE sur chaque édition
       *     réussie — le chemin le plus courant de l'écran ;
       *   · `nom-${enEdition}` désigne l'`<input>` de ce même `<form>` démonté,
       *     donc `getElementById` rendait `null` et le focus retombait sur
       *     `<body>`. La cible juste est le bouton de la ligne repliée, celui
       *     qu'« Annuler » vise déjà.
       */
      setZone("liste");
      fermer(`ingredient-${enEdition}`);
      router.refresh();
      return "modifie";
    });
  }

  async function supprimer(id: string) {
    /*
     * Le panneau est ouvert : un REFUS doit s'afficher dedans, donc zone
     * « edition ». Le SUCCÈS, lui, referme ce panneau — et bascule donc vers la
     * liste juste avant, sinon le message n'aurait plus de région où vivre.
     *
     * ⚠️ Trouvé par le parcours à l'écran du 2026-08-02, pas par une porte : la
     * première rédaction laissait la zone sur « edition », et « C'est retiré. »
     * ne s'affichait nulle part — le `<Notice>` de l'édition étant rendu à
     * l'intérieur du `<form>` que `fermer()` démonte. C'est la cinquième fois que
     * ce dépôt rencontre un message rendu dans une région qui n'existe plus.
     */
    setZone("edition");

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { error } = await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[ingrédients] suppression refusée :", error.message);
        return refusIngredient(error);
      }

      /*
       * Zéro ligne n'est pas un échec : l'ingrédient avait déjà disparu, donc
       * l'intention est satisfaite. Le focus va au titre de la section — la ligne
       * qui le portait n'existe plus, et le laisser retomber sur `<body>`
       * renverrait en haut du document.
       */
      setZone("liste");
      fermer("titre-ingredients");
      router.refresh();
      return "supprime";
    });
  }

  async function deplacer(i: Ingredient, sens: Sens) {
    setZone("ordre");
    effacer();

    const ordre = ordreApresDeplacement(ingredients, i.id, sens);
    // `null` veut dire « n'appelle pas la base » : bouton en bout de course.
    if (!ordre) return;

    /*
     * ⚠️ **Le focus, et la flèche OPPOSÉE en bout de course.** `disabled={occupe}`
     * désactive le bouton pressé pendant l'attente, et un navigateur qui désactive
     * l'élément focalisé renvoie le focus sur `<body>` : au clavier, monter un
     * ingrédient trois fois renvoyait trois fois en haut du document. Les flèches
     * sont le SEUL chemin clavier (UX-DR11), donc c'est ce chemin-là qui cassait.
     *
     * En bout de course la flèche pressée disparaît — viser l'opposée est la seule
     * cible qui existera encore. `ListeRayons.tsx:480` porte exactement ce code,
     * sous un commentaire qui le nomme « le piège de cette story » ; il n'avait pas
     * été repris ici. Trouvé par la revue adversariale du 2026-08-03.
     */
    const rangArrivee = ordre.indexOf(i.id);
    const finDeCourse =
      rangArrivee === 0 || rangArrivee === ordre.length - 1;
    const opposee = sens === "haut" ? "bas" : "haut";
    retourFocus.current = `${finDeCourse ? opposee : sens}-${i.id}`;

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { error } = await supabase.rpc("reorder_recipe_ingredients", {
        p_recipe_id: recetteId,
        p_ids: ordre,
      });

      if (error) {
        console.error("[ingrédients] réordonnancement refusé :", error.message);
        retourFocus.current = null;
        setOrdreEnvoye(null);
        router.refresh();
        return refusOrdreIngredients(error);
      }

      setDeplacement({ nom: i.nom, rang: rangArrivee + 1 });
      setOrdreEnvoye(ordre);
      router.refresh();
      return "deplace";
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");
  const statutListe = (
    <Notice className="mt-2">{zone === "liste" ? message : undefined}</Notice>
  );
  const statutEdition = (
    <Notice reserve className="mt-3">
      {zone === "edition" ? message : undefined}
    </Notice>
  );
  const statutAjout = (
    <Notice reserve className="mt-3">
      {zone === "ajout" ? message : undefined}
    </Notice>
  );
  /*
   * Sous la liste, sans `reserve` : elle n'est au-dessus d'aucune cible. Le rang
   * est en `tabular-nums` (UX-DR12 l'impose sur tout chiffre, et `.notice` ne le
   * porte pas), et le premier s'écrit « 1re » — une synthèse vocale lit de travers
   * un ordinal mal formé.
   */
  const statutOrdre = (
    <Notice className="mt-3">
      {zone !== "ordre" ? undefined : cle === "deplace" && deplacement ? (
        <>
          {deplacement.nom} est en{" "}
          <span className="tabular-nums">{deplacement.rang}</span>
          {deplacement.rang === 1 ? "re" : "e"} position.
        </>
      ) : (
        message
      )}
    </Notice>
  );

  return (
    <section className="mt-12 border-t border-card-border pt-6">
      <h2 id="titre-ingredients" tabIndex={-1} className="titre-section">
        Les ingrédients
      </h2>
      {statutListe}

      {ingredients.length === 0 ? (
        <div className="mt-2">
          <p className="text-base">Pas encore d&apos;ingrédient.</p>
          <p className="hint mt-1">
            Ajoute-les dans l&apos;ordre où tu t&apos;en sers.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-2">
            {ingredients.map((i, index) => (
              <li key={i.id} className="border-b border-card-border last:border-0">
                {enEdition === i.id ? (
                  <form onSubmit={enregistrer} className="py-3">
                    <ChampsIngredient
                      idPrefixe={i.id}
                      occupe={occupe}
                      saisie={saisieEditee}
                      onChange={(s) => {
                        setSaisieEditee(s);
                        effacer();
                      }}
                    />

                    {statutEdition}

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
                        onClick={() => fermer(`ingredient-${i.id}`)}
                        disabled={occupe}
                        className="btn-quiet"
                      >
                        Annuler
                      </button>
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      {aConfirmer === i.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => supprimer(i.id)}
                            disabled={occupe}
                            className="btn-quiet px-0"
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
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAConfirmer(i.id)}
                          disabled={occupe}
                          className="btn-quiet px-0"
                        >
                          Retirer cet ingrédient
                        </button>
                      )}
                    </div>
                    {aConfirmer === i.id ? (
                      <p className="hint mt-2">Il disparaît de la recette.</p>
                    ) : null}
                  </form>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      id={`ingredient-${i.id}`}
                      onClick={() => ouvrir(i)}
                      aria-label={`Modifier ${i.nom}`}
                      className="flex min-h-touch min-w-0 flex-1 cursor-pointer items-center
                                 gap-3 py-2 text-left text-base"
                    >
                      <span className="min-w-0 flex-1 break-all">
                        {i.nom}
                        {i.optionnel ? (
                          <span className="hint"> — on peut s&apos;en passer</span>
                        ) : null}
                      </span>
                      {/*
                        ⚠️ **L'unité ne s'affiche jamais seule.** Une unité qualifie
                        un nombre ; sans lui elle n'a rien à dire, et « Farine … g »
                        se lit comme une donnée perdue. Le couple (quantité nulle,
                        unité posée) est atteignable depuis cet écran même — les deux
                        champs sont indépendants — et aucune contrainte ne l'interdit.
                        Revue adversariale du 2026-08-03 ; le même défaut a été
                        corrigé sur l'écran de LECTURE, qui affiche cette donnée.
                      */}
                      {i.quantite !== null ? (
                        <span className="hint shrink-0 tabular-nums">
                          {i.quantite}
                          {i.unite ? ` ${i.unite}` : ""}
                        </span>
                      ) : null}
                    </button>

                    {/*
                      Les deux flèches. Désactivé = un ton plus clair, jamais une
                      opacité réductrice, qui ferait tomber le glyphe sous le seuil.

                      ⚠️ **`disabled={occupe}` ne ferme PAS la course de deux
                      pressions rapides**, contrairement à ce que disait la première
                      rédaction de ce commentaire. `useSoumission` libère `occupe`
                      dans son `finally`, donc dès la réponse du RPC — mais le
                      rafraîchissement, lui, n'est pas fini. Entre les deux, les
                      flèches étaient réactivées alors que `ingredients` portait
                      encore l'ancien ordre : la seconde pression recalculait la MÊME
                      permutation depuis les MÊMES propriétés, et deux pressions ne
                      faisaient avancer que d'un cran.

                      ⚠️ **`router.refresh()` rend `void` : on ne peut pas
                      l'attendre.** D'où `attenteOrdre`, qui compare l'ordre ENVOYÉ à
                      celui que portent les propriétés — c'est le seul signal que ce
                      composant reçoive de l'arrivée du rendu serveur. Sa définition
                      dit pourquoi il est dérivé et non stocké. Revue du 2026-08-03.

                      ⚠️ **Les `id` ne sont pas décoratifs non plus** : ce sont les
                      cibles de `retourFocus`. Sans eux, le focus retombait sur
                      `<body>` à chaque pression.
                    */}
                    <button
                      type="button"
                      id={`haut-${i.id}`}
                      onClick={() => deplacer(i, "haut")}
                      disabled={occupe || attenteOrdre || index === 0}
                      aria-label={`Monter ${i.nom}`}
                      className="flex min-h-touch w-11 shrink-0 cursor-pointer items-center
                                 justify-center text-base text-text
                                 disabled:cursor-default disabled:text-muted"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      id={`bas-${i.id}`}
                      onClick={() => deplacer(i, "bas")}
                      disabled={occupe || attenteOrdre || index === ingredients.length - 1}
                      aria-label={`Descendre ${i.nom}`}
                      className="flex min-h-touch w-11 shrink-0 cursor-pointer items-center
                                 justify-center text-base text-text
                                 disabled:cursor-default disabled:text-muted"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/*
        ⚠️ **Montée EN PERMANENCE, hors de la branche non vide.** Le piège n°8 de
        cette story l'exige — « une région par surface, montée en permanence » — et
        cette région-ci était la seule à ne pas l'être. Chemin réel : l'autre membre
        vide la recette, je presse une flèche, le RPC refuse `P0001`, le message
        « La liste des ingrédients vient de changer » est posé — et le
        `router.refresh()` ramène une liste vide qui démonte la branche, donc la
        région, donc le message. Trouvé par la revue adversariale du 2026-08-03,
        même famille que les trois autres défauts de ce fichier.
      */}
      {statutOrdre}

      <div className="mt-8">
        <h3 className="titre-section">Ajouter un ingrédient</h3>
        <form onSubmit={ajouter} className="mt-2">
          <ChampsIngredient
            idPrefixe="nouveau"
            occupe={occupe}
            saisie={nouveau}
            onChange={(s) => {
              setNouveau(s);
              effacer();
            }}
          />

          {statutAjout}

          <button type="submit" disabled={occupe} className="btn-primaire mt-3 w-full">
            {occupe ? LIBELLE_OCCUPE : "Ajouter"}
          </button>
        </form>
      </div>
    </section>
  );
}

/**
 * Les cinq champs d'un ingrédient, partagés par l'ajout et l'édition.
 *
 * Un seul composant pour les deux : deux copies de cinq champs divergeraient, et
 * c'est exactement ce que l'extraction de `useSoumission` a eu à réparer.
 */
function ChampsIngredient({
  idPrefixe,
  saisie,
  onChange,
  occupe,
}: {
  idPrefixe: string;
  saisie: Saisie;
  onChange: (s: Saisie) => void;
  occupe: boolean;
}) {
  /*
   * ⚠️ **Les CHAMPS se désactivent pendant l'écriture, pas seulement les boutons.**
   * `versColonnes` fige la saisie avant `soumettre` ; tout ce qui est tapé pendant
   * l'aller-retour est donc déjà perdu — et au succès, `setNouveau(SAISIE_VIDE)`
   * l'efface pendant que l'écran annonce « C'est noté. ». L'utilisateur voyait ses
   * frappes disparaître sans un mot. Tous les boutons portaient `disabled={occupe}`,
   * aucun champ ne le portait. Revue adversariale du 2026-08-03.
   */
  const maj = <C extends keyof Saisie>(champ: C, valeur: Saisie[C]) =>
    onChange({ ...saisie, [champ]: valeur });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <span className="min-w-40 flex-2">
          <label htmlFor={`nom-${idPrefixe}`} className="label">
            Quoi
          </label>
          <input
            id={`nom-${idPrefixe}`}
            type="text"
            required
            maxLength={MAX_TITRE}
            placeholder="Pois chiches"
            value={saisie.nom}
            onChange={(e) => maj("nom", e.target.value)}
            disabled={occupe}
            className="input mt-1"
          />
        </span>
        <span className="min-w-20 flex-1">
          <label htmlFor={`quantite-${idPrefixe}`} className="label">
            Combien
          </label>
          <input
            id={`quantite-${idPrefixe}`}
            type="text"
            inputMode="decimal"
            placeholder="400"
            value={saisie.quantite}
            onChange={(e) => maj("quantite", e.target.value)}
            className="input mt-1 tabular-nums"
          />
        </span>
        <span className="min-w-24 flex-1">
          <label htmlFor={`unite-${idPrefixe}`} className="label">
            Unité
          </label>
          {/*
            ⚠️ Un `<select>`, JAMAIS un champ libre. Le vocabulaire d'unités est
            un morceau de la clé canonique de l'Epic 4 : « pièce » décomposé est
            une chaîne différente de « pièce » composé, et Postgres les juge
            inégales — deux lignes de courses qui ne fusionneraient jamais. Un
            `<select>` supprime le risque à la source, l'utilisateur ne tapant
            rien. `UNITES` en est la source unique.
          */}
          <select
            id={`unite-${idPrefixe}`}
            value={saisie.unite}
            onChange={(e) => maj("unite", e.target.value)}
            disabled={occupe}
            className="input mt-1"
          >
            <option value="">—</option>
            {UNITES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="mt-3">
        <label htmlFor={`rayon-${idPrefixe}`} className="label">
          Dans quel rayon le chercher (facultatif)
        </label>
        <input
          id={`rayon-${idPrefixe}`}
          type="text"
          maxLength={MAX_TITRE}
          placeholder="conserves"
          value={saisie.motCleRayon}
          onChange={(e) => maj("motCleRayon", e.target.value)}
          disabled={occupe}
          className="input mt-1"
        />
        <p className="hint mt-1">
          Sert à le ranger tout seul dans ta liste de courses, plus tard.
        </p>
      </div>

      <label
        htmlFor={`optionnel-${idPrefixe}`}
        className="mt-3 flex min-h-touch cursor-pointer items-center gap-2 text-base"
      >
        <input
          id={`optionnel-${idPrefixe}`}
          type="checkbox"
          checked={saisie.optionnel}
          onChange={(e) => maj("optionnel", e.target.checked)}
          disabled={occupe}
          className="size-5 cursor-pointer"
        />
        On peut s&apos;en passer
      </label>
    </div>
  );
}
