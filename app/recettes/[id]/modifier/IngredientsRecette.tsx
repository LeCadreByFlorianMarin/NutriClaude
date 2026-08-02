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
import { UNITES } from "@/lib/recettes/unites";
import { MAX_TITRE, normaliserQuantite, normaliserTitre } from "@/lib/recettes/saisie";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  "nom-vide": "Il faut un nom.",
  "quantite-illisible": "Une quantité s'écrit en chiffres.",
  "quantite-negative": "Une quantité ne peut pas être négative.",
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
  const quantite = brut === "" ? null : normaliserQuantite(brut);
  if (brut !== "" && quantite === null) return "quantite-illisible";
  if (quantite !== null && quantite < 0) return "quantite-negative";

  return {
    name: nom,
    quantity: quantite,
    // Le `<select>` n'émet que les huit jetons ou la chaîne vide.
    unit: saisie.unite === "" ? null : saisie.unite,
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
        return refusIngredient(error);
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
        router.refresh();
        return "liste-changee";
      }

      fermer(`nom-${enEdition}`);
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

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { error } = await supabase.rpc("reorder_recipe_ingredients", {
        p_recipe_id: recetteId,
        p_ids: ordre,
      });

      if (error) {
        console.error("[ingrédients] réordonnancement refusé :", error.message);
        router.refresh();
        return refusOrdreIngredients(error);
      }

      setDeplacement({ nom: i.nom, rang: ordre.indexOf(i.id) + 1 });
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
                      <span className="hint shrink-0 tabular-nums">
                        {i.quantite === null ? "" : i.quantite}
                        {i.unite ? ` ${i.unite}` : ""}
                      </span>
                    </button>

                    {/*
                      Les deux flèches. `disabled={occupe}` n'est pas décoratif :
                      il ferme la course de deux pressions rapides, qui
                      calculeraient le même ordre depuis les mêmes propriétés.
                      Désactivé = un ton plus clair, jamais une opacité
                      réductrice, qui ferait tomber le glyphe sous le seuil.
                    */}
                    <button
                      type="button"
                      onClick={() => deplacer(i, "haut")}
                      disabled={occupe || index === 0}
                      aria-label={`Monter ${i.nom}`}
                      className="flex min-h-touch w-11 shrink-0 cursor-pointer items-center
                                 justify-center text-base text-text
                                 disabled:cursor-default disabled:text-muted"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(i, "bas")}
                      disabled={occupe || index === ingredients.length - 1}
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
          {statutOrdre}
        </>
      )}

      <div className="mt-8">
        <h3 className="titre-section">Ajouter un ingrédient</h3>
        <form onSubmit={ajouter} className="mt-2">
          <ChampsIngredient
            idPrefixe="nouveau"
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
}: {
  idPrefixe: string;
  saisie: Saisie;
  onChange: (s: Saisie) => void;
}) {
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
          className="size-5 cursor-pointer"
        />
        On peut s&apos;en passer
      </label>
    </div>
  );
}
