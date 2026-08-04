"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { refusAssignation } from "@/lib/menu/erreurs";
import type { CaseDeMenu } from "@/lib/menu/menu";
import type { Recette } from "@/lib/recettes/recettes";
import { analyserPersonnes } from "@/lib/personnes";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  "recette-vide": "Choisis une recette.",
  "personnes-illisible": "Un nombre de personnes s'écrit en chiffres.",
  /*
   * ⚠️ **Le même texte pour le refus d'écran et le refus de la base.** L'écran
   * refuse 0 et le négatif ; `meal_plan_entries_servings_positif` refuse la même
   * chose pour les appels qui ne passent pas par l'écran. Deux formulations
   * diraient à l'utilisateur qu'il s'est passé deux choses différentes, alors
   * qu'une seule règle a parlé. L'accord entre les deux est mesuré par
   * `supabase/tests/contraintes.test.ts`, pas affirmé ici.
   */
  "personnes-invalides": "Il faut au moins une personne.",
  /*
   * ⚠️ C'est l'AC2 vu de l'écran. « Empêché par la contrainte » n'autorise pas à
   * empêcher SANS UN MOT : un `23505` non traduit tomberait sur « echec », donc
   * sur « Réessaie dans un instant » — un conseil qui ne peut jamais fonctionner,
   * puisque retenter à l'identique reproduira le même refus.
   */
  "deja-au-menu": "Cette recette est déjà à ce repas.",
  /*
   * ⚠️ Jamais « Réessaie » : la recette a disparu (l'autre membre l'a supprimée),
   * et retenter donnera indéfiniment le même refus. Le `router.refresh()` fait
   * partie du TRAITEMENT de ce refus — sans lui, l'écran resterait en désaccord
   * avec la base.
   */
  "menu-change": "Cette recette n'existe plus. Voilà ce qui reste.",
  ajoute: "C'est noté.",
  modifie: "C'est noté.",
  retire: "C'est retiré.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Où le message de la soumission en cours s'affiche.
 *
 * ⚠️ **Un message qu'on ne voit pas n'existe pas**, et c'est le récidiviste de ce
 * dépôt — cinq occurrences, dont deux fois de suite sur `/rayons`, la première
 * correction ayant créé deux régions pour trois surfaces. Ici il y en a **deux** :
 * ce qui est déjà prévu (modifier, retirer) et le formulaire d'ajout. Donc deux
 * régions, et toutes deux **montées en permanence**, hors des branches qui se
 * démontent.
 */
type Zone = "prevu" | "ajout";

/**
 * Mettre une recette à ce repas, changer le nombre de personnes, la retirer.
 *
 * ⚠️ **Écritures client-direct** (AD-13) : ni secret serveur, ni conséquence à
 * faire apparaître dans un rendu serveur. Le critère est la **cause**, pas
 * l'analogie de vocabulaire. Motif de `ListeRecettes` et d'`IngredientsRecette`.
 *
 * ⚠️ **Aucune copie locale des cases.** L'état ne porte que l'interface — quelle
 * ligne est en cours d'édition, quelle saisie court. Les données viennent des
 * propriétés et `router.refresh()` les rafraîchit ; une copie divergerait dès que
 * l'autre membre du foyer écrit, et il n'y a pas encore de propagation temps réel
 * (AD-8, Epic 4).
 */
export function AssignerRepas({
  jour,
  repas,
  foyerId,
  profilId,
  personnesParDefaut,
  recettes,
  cases,
}: {
  jour: string;
  repas: string;
  foyerId: string;
  profilId: string;
  personnesParDefaut: number;
  recettes: Recette[];
  cases: CaseDeMenu[];
}) {
  const router = useRouter();
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  const [zone, setZone] = useState<Zone>("prevu");
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  /** La saisie du formulaire d'ajout. */
  const [recetteChoisie, setRecetteChoisie] = useState("");
  /*
   * ⚠️ **La valeur d'ouverture vient du FOYER, et elle est figée à l'initialisation.**
   * Décision de Florian du 2026-08-04 : `households.default_servings` propose,
   * `meal_plan_entries.servings` décide. Relire le réglage du foyer au moment
   * d'écrire réintroduirait la valeur du foyer par-dessus l'ajustement que
   * l'utilisateur vient de taper.
   */
  const [personnes, setPersonnes] = useState(String(personnesParDefaut));

  /** Le nombre de personnes en cours d'édition, par identifiant de case. */
  const [personnesEditees, setPersonnesEditees] = useState<Record<string, string>>({});

  /**
   * L'élément à refocaliser une fois la ligne disparue. Une **ref** et non un
   * état : la consommer ne doit pas déclencher de rendu.
   */
  const retourFocus = useRef<string | null>(null);

  /*
   * ⚠️ **Le focus, sinon il retombe sur `<body>`** — c'est-à-dire en haut du
   * document. Retirer une recette démonte sa ligne, avec le bouton qui portait le
   * focus. `cases` est dans les dépendances pour couvrir les démontages provoqués
   * par l'arrivée des nouvelles propriétés, pas seulement par un clic : c'est la
   * leçon de la seconde passe de revue sur `/rayons`.
   */
  useEffect(() => {
    const cible = retourFocus.current;
    if (!cible) return;
    retourFocus.current = null;
    document.getElementById(cible)?.focus();
  }, [cases]);

  /**
   * La saisie d'un nombre de personnes, ou une clé de refus.
   *
   * La règle vit dans `lib/personnes.ts`, partagée avec le réglage du foyer : deux
   * copies auraient divergé, et c'est elle dont l'accord avec les contraintes en
   * base est **mesuré** (`supabase/tests/contraintes.test.ts`). Ici on ne fait que
   * traduire une faute en clé de message.
   */
  function versPersonnes(saisie: string): number | Cle {
    const analyse = analyserPersonnes(saisie);
    if ("faute" in analyse) {
      return analyse.faute === "illisible" ? "personnes-illisible" : "personnes-invalides";
    }
    return analyse.valeur;
  }

  async function ajouter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setZone("ajout");
    setAConfirmer(null);

    if (!recetteChoisie) return refuser("recette-vide");
    const combien = versPersonnes(personnes);
    if (typeof combien === "string") return refuser(combien);

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      /*
       * ⚠️ **`household_id` et `created_by` explicites, et ce ne sont pas des
       * gardes.** La première est `not null` sans défaut, et `meal_plan_all` porte
       * le `with check` qui refuserait un foyer étranger : la frontière est en
       * base (AD-2). La seconde n'a pas de défaut non plus, et la laisser nulle
       * perdrait **définitivement** l'information de qui a planifié quoi. Motif et
       * raison de `ListeRecettes.tsx:60-74`.
       *
       * ⚠️ **`servings` n'est jamais laissé au défaut de la colonne** (2) : l'AC1
       * exige que le nombre soit *indiqué*. Même famille de piège que `sort_order`
       * à 0 sur les ingrédients.
       */
      const { data, error } = await supabase
        .from("meal_plan_entries")
        .insert({
          household_id: foyerId,
          created_by: profilId,
          recipe_id: recetteChoisie,
          meal_date: jour,
          meal_type: repas,
          servings: combien,
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[menu] assignation refusée :", error.message);
        const refus = refusAssignation(error);
        /*
         * Le rafraîchissement fait partie du TRAITEMENT du refus : annoncer que la
         * recette n'existe plus sans remettre l'écran d'accord avec la base
         * laisserait l'utilisateur devant une liste qui ment.
         */
        if (refus === "menu-change") router.refresh();
        return refus;
      }

      setRecetteChoisie("");
      setPersonnes(String(personnesParDefaut));
      router.refresh();
      return "ajoute";
    });
  }

  async function changerPersonnes(event: FormEvent<HTMLFormElement>, c: CaseDeMenu) {
    event.preventDefault();
    setZone("prevu");
    /*
     * Soumettre, c'est renoncer à retirer. Sans ce désarmement, un enregistrement
     * refusé laisserait « Confirmer » armé juste sous le champ, où il se lit comme
     * « confirmer l'enregistrement ». Leçon de `/rayons`.
     */
    setAConfirmer(null);

    const combien = versPersonnes(personnesEditees[c.id] ?? String(c.personnes));
    if (typeof combien === "string") return refuser(combien);

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { data, error } = await supabase
        .from("meal_plan_entries")
        .update({ servings: combien })
        .eq("id", c.id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[menu] changement refusé :", error.message);
        return refusAssignation(error);
      }
      /*
       * ⚠️ **Contrôler `data` autant qu'`error`.** Un `update` sur une ligne que la
       * RLS masque — la recette supprimée entre-temps par l'autre membre, donc la
       * case emportée par la cascade — rend **zéro ligne et AUCUNE erreur**. Sans
       * ce test, l'écran annoncerait « C'est noté. » sur une écriture qui n'a rien
       * touché. Motif de `DisplayNameForm.tsx:70-78`.
       */
      if (!data) {
        router.refresh();
        return "menu-change";
      }

      router.refresh();
      return "modifie";
    });
  }

  async function retirer(c: CaseDeMenu) {
    setZone("prevu");
    /*
     * Le focus part au titre de la section : la ligne qui le portait n'existera
     * plus, et le laisser retomber sur `<body>` renverrait en haut du document.
     */
    retourFocus.current = "titre-prevu";

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { error } = await supabase
        .from("meal_plan_entries")
        .delete()
        .eq("id", c.id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("[menu] retrait refusé :", error.message);
        retourFocus.current = null;
        return refusAssignation(error);
      }

      /*
       * Zéro ligne n'est pas un échec : la case avait déjà disparu, donc
       * l'intention est satisfaite. Même lecture que la suppression d'ingrédient.
       */
      setAConfirmer(null);
      router.refresh();
      return "retire";
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");
  const statutPrevu = <Notice className="mt-2">{zone === "prevu" ? message : undefined}</Notice>;
  const statutAjout = (
    <Notice reserve className="mt-3">
      {zone === "ajout" ? message : undefined}
    </Notice>
  );

  return (
    <div>
      <section className="mt-8">
        <h2 id="titre-prevu" tabIndex={-1} className="titre-section">
          Ce qui est prévu
        </h2>

        {/* ⚠️ Montée EN PERMANENCE, hors de la branche non vide : retirer la
            dernière recette démonte la liste, et un message rendu à l'intérieur
            partirait avec elle. C'est la cinquième fois que ce dépôt rencontre
            cette famille de défaut. */}
        {statutPrevu}

        {cases.length === 0 ? (
          <p className="hint mt-1">Rien de prévu pour l&apos;instant.</p>
        ) : (
          <ul className="mt-2">
            {cases.map((c) => (
              <li key={c.id} className="border-b border-card-border py-3 last:border-0">
                {/* La destination existe depuis la story 3.3 et n'est pas à
                    inventer. Elle reste une cible à part entière : elle mène
                    ailleurs, là où le reste de la ligne modifie sur place. */}
                <Link
                  href={`/recettes/${c.recetteId}`}
                  className="flex min-h-touch items-center text-base break-words underline underline-offset-4"
                >
                  {c.recetteTitre}
                </Link>

                {/* `noValidate` : voir le formulaire d'ajout plus bas — sans lui, le
                    navigateur refuse la soumission avec un message ANGLAIS et
                    `changerPersonnes` n'est jamais appelé. */}
                <form
                  onSubmit={(e) => changerPersonnes(e, c)}
                  noValidate
                  className="mt-1 flex flex-wrap items-end gap-2"
                >
                  <span className="min-w-24 flex-1">
                    <label htmlFor={`personnes-${c.id}`} className="label">
                      Pour combien de personnes
                    </label>
                    <input
                      id={`personnes-${c.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={personnesEditees[c.id] ?? String(c.personnes)}
                      onChange={(e) => {
                        setPersonnesEditees((p) => ({ ...p, [c.id]: e.target.value }));
                        effacer();
                      }}
                      disabled={occupe}
                      className="input mt-1 tabular-nums"
                    />
                  </span>
                  <button type="submit" disabled={occupe} className="btn">
                    {occupe ? LIBELLE_OCCUPE : "Enregistrer"}
                  </button>
                </form>

                <div className="mt-3 flex items-center gap-2">
                  {aConfirmer === c.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => retirer(c)}
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
                    /* Confirmation en deux temps, jamais `window.confirm` : hors
                       thème, hors ton, et il bloque toute vérification pilotée par
                       navigateur. Motif d'`InviteCard`. */
                    <button
                      type="button"
                      onClick={() => {
                        setZone("prevu");
                        effacer();
                        setAConfirmer(c.id);
                      }}
                      disabled={occupe}
                      className="btn-quiet px-0"
                    >
                      Retirer du menu
                    </button>
                  )}
                </div>
                {aConfirmer === c.id ? (
                  <p className="hint mt-2">Ce repas disparaît du menu.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Mettre une recette</h2>

        {recettes.length === 0 ? (
          /* ⚠️ Une invitation à choisir dans un répertoire vide serait un conseil
             qui ne peut pas fonctionner. On dit ce qui manque, et on donne le
             chemin qui existe. */
          <div className="mt-2">
            <p className="text-base">Tu n&apos;as encore aucune recette.</p>
            <p className="hint mt-1">
              <Link href="/recettes" className="underline underline-offset-4">
                Crées-en une d&apos;abord
              </Link>{" "}
              — elle servira à remplir le menu.
            </p>
          </div>
        ) : (
          /*
            ⚠️ **`noValidate`, et ce n'est PAS une désactivation de contrôle.** Sans
            lui, `min={1}` et `required` font refuser la soumission par le
            NAVIGATEUR, qui affiche son propre message — « Value must be greater
            than or equal to 1. », **en anglais**, hors de toute région `aria-live`,
            et hors du ton du produit (NFR-8/NFR-9). Pire : `ajouter` n'est alors
            jamais appelé, donc « Il faut au moins une personne. » et « Choisis une
            recette. » ne peuvent **jamais** s'afficher — deux clés de message sans
            appelant.

            **Trouvé par le parcours à l'écran du 2026-08-04**, pas par une porte :
            les six portes étaient vertes. Règle §7.

            `min={1}` et `required` restent sur les champs : ils portent l'affordance
            (les flèches du sélecteur ne descendent pas sous 1) et l'information
            d'accessibilité. Les frontières dures sont en base ; les refus lisibles
            sont ici.
          */
          <form onSubmit={ajouter} noValidate className="mt-2">
            <div>
              <label htmlFor="recette" className="label">
                Quelle recette
              </label>
              {/*
                ⚠️ **`w-full` ET `min-w-0`, et ce n'est pas de la ceinture.** Un
                `<select>` prend l'intrinsèque de sa plus longue option, et un titre
                de recette va jusqu'à 80 caractères (`MAX_TITRE`). Sans ces deux
                classes il impose sa largeur au conteneur — c'est-à-dire le
                défilement horizontal que NFR-3/UX-DR10 interdisent. C'est aussi
                pour ça que ce formulaire vit sur son propre écran et non dans une
                case de la grille.

                Le filtre et la recherche appartiennent à la story 3.4, qui est
                sautée et toujours due : les recettes sont ici rangées par titre,
                et rien de plus.
              */}
              <select
                id="recette"
                required
                value={recetteChoisie}
                onChange={(e) => {
                  setRecetteChoisie(e.target.value);
                  effacer();
                }}
                disabled={occupe}
                className="input mt-1 w-full min-w-0"
              >
                <option value="">Choisis une recette</option>
                {recettes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.titre}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3">
              <label htmlFor="personnes-nouveau" className="label">
                Pour combien de personnes
              </label>
              <input
                id="personnes-nouveau"
                type="number"
                inputMode="numeric"
                min={1}
                value={personnes}
                onChange={(e) => {
                  setPersonnes(e.target.value);
                  effacer();
                }}
                disabled={occupe}
                className="input mt-1 tabular-nums"
              />
              <p className="hint mt-1">
                On part de ce que tu as réglé pour le foyer. Change-le si ce repas
                est différent.
              </p>
            </div>

            {statutAjout}

            <button type="submit" disabled={occupe} className="btn-primaire mt-3 w-full">
              {occupe ? LIBELLE_OCCUPE : "Mettre au menu"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
