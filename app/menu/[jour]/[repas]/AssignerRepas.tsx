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
   * ⚠️ **Un troisième refus, et il vient de la revue du 2026-08-04.** Le hors-bornes
   * tombait sur « s'écrit en chiffres » — un conseil que quelqu'un qui vient de taper
   * `2147483648` a déjà suivi, donc une boucle dont il ne peut pas sortir sans deviner
   * qu'un plafond existe. C'était exactement le défaut que `lib/personnes.ts` se
   * vantait d'avoir évité.
   */
  "personnes-trop-grand": "C'est trop de monde pour un repas.",
  /*
   * ⚠️ **Le même texte pour le refus d'écran et le refus de la base.** L'écran refuse
   * 0 et le négatif ; `meal_plan_entries_servings_positif` refuse la même chose pour
   * les appels qui ne passent pas par l'écran. Deux formulations diraient à
   * l'utilisateur qu'il s'est passé deux choses différentes, alors qu'une seule règle
   * a parlé. L'accord est mesuré par `supabase/tests/contraintes.test.ts`.
   */
  "personnes-invalides": "Il faut au moins une personne.",
  /*
   * ⚠️ C'est l'AC2 vu de l'écran. « Empêché par la contrainte » n'autorise pas à
   * empêcher SANS UN MOT : un `23505` non traduit tomberait sur « echec », donc sur
   * « Réessaie dans un instant » — un conseil qui ne peut jamais fonctionner.
   */
  "deja-au-menu": "Cette recette est déjà à ce repas. La voilà.",
  /*
   * ⚠️ Jamais « Réessaie » : la recette a disparu (l'autre membre l'a supprimée), et
   * retenter donnera indéfiniment le même refus. Le `router.refresh()` fait partie du
   * TRAITEMENT de ce refus — sans lui, l'écran resterait en désaccord avec la base.
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
 * ⚠️ **TROIS régions, et le compte vient d'une revue.** La première rédaction en
 * comptait deux et en montait **une seule** pour toutes les lignes : un refus
 * déclenché depuis la quatrième case s'affichait en tête de section, hors écran sur
 * téléphone — le défaut que `project-context.md` compte comme récidiviste, cinq
 * occurrences, dont deux fois de suite sur `/rayons`.
 *
 * Le partage est celui d'`IngredientsRecette` : la région de **liste** porte ce qui
 * arrive à la liste (un retrait, une recette disparue), la région d'**édition** vit
 * DANS le formulaire de la ligne ouverte, et celle d'**ajout** dans le sien.
 */
type Zone = "liste" | "edition" | "ajout";

/**
 * Mettre une recette à ce repas, changer le nombre de personnes, la retirer.
 *
 * ⚠️ **Écritures client-direct** (AD-13) : ni secret serveur, ni conséquence à faire
 * apparaître dans un rendu serveur. Le critère est la **cause**, pas l'analogie de
 * vocabulaire. Motif de `ListeRecettes` et d'`IngredientsRecette`.
 *
 * ⚠️ **UNE SEULE LIGNE OUVERTE À LA FOIS**, et c'est une décision de Florian du
 * 2026-08-05 prise en revue. La première rédaction laissait les N formulaires montés
 * en permanence : `occupe` étant global au composant, enregistrer une ligne affichait
 * « Un instant… » sur toutes et les désactivait toutes, sans rien dire de celle qui
 * écrivait vraiment. Le motif du dépôt (`IngredientsRecette`, `ListeRayons`) n'ouvre
 * le formulaire que pour la ligne en édition ; il est repris ici tel quel.
 *
 * ⚠️ **Aucune copie locale des cases.** L'état ne porte que l'interface — quelle ligne
 * est ouverte, quelle saisie court. **Et cette phrase était fausse avant la revue** :
 * un `Record<id, string>` gardait la saisie de chaque ligne et n'était jamais purgé,
 * si bien que la valeur du serveur ne revenait plus jamais dans le champ — ni après un
 * enregistrement réussi, ni après l'écriture de l'autre membre. Une seule saisie, posée
 * à l'ouverture et jetée à la fermeture, supprime la divergence à la source.
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

  const [zone, setZone] = useState<Zone>("liste");
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [saisieEditee, setSaisieEditee] = useState("");
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  /** La saisie du formulaire d'ajout. */
  const [recetteChoisie, setRecetteChoisie] = useState("");
  /*
   * ⚠️ **La valeur d'ouverture vient du FOYER, et elle est figée à l'initialisation.**
   * Décision de Florian du 2026-08-04 : `households.default_servings` propose,
   * `meal_plan_entries.servings` décide. Relire le réglage du foyer au moment d'écrire
   * réintroduirait la valeur du foyer par-dessus l'ajustement qu'on vient de taper.
   */
  const [personnes, setPersonnes] = useState(String(personnesParDefaut));

  /**
   * L'élément à refocaliser une fois la ligne repliée ou disparue. Une **ref** et non
   * un état : la consommer ne doit pas déclencher de rendu.
   */
  const retourFocus = useRef<string | null>(null);

  /*
   * ⚠️ **Le focus, sinon il retombe sur `<body>`** — c'est-à-dire en haut du document.
   * Ouvrir une ligne remplace son bouton par un `<form>`, la refermer fait l'inverse,
   * la retirer fait disparaître la ligne : les trois démontent l'élément focalisé.
   *
   * ⚠️ **`enEdition` ET `aConfirmer` sont dans les dépendances, et la revue du
   * 2026-08-05 a montré pourquoi** : la première rédaction n'écoutait que `cases`, donc
   * ouvrir ou refermer la confirmation de retrait — qui ne change pas `cases` — laissait
   * le focus sur `<body>`. Deux cases de la story le déclaraient pourtant vérifié.
   */
  useEffect(() => {
    const cible = retourFocus.current;
    if (!cible) return;
    retourFocus.current = null;
    document.getElementById(cible)?.focus();
  }, [cases, enEdition, aConfirmer]);

  /**
   * La saisie d'un nombre de personnes, ou une clé de refus.
   *
   * La règle vit dans `lib/personnes.ts`, partagée avec le réglage du foyer : deux
   * copies auraient divergé, et c'est elle dont l'accord avec les contraintes en base
   * est **mesuré**. Ici on ne fait que traduire une faute en clé de message — et les
   * **trois** fautes sont distinctes, parce que trois conseils différents s'imposent.
   */
  function versPersonnes(saisie: string): number | Cle {
    const analyse = analyserPersonnes(saisie);
    if ("faute" in analyse) {
      switch (analyse.faute) {
        case "illisible":
          return "personnes-illisible";
        case "trop-peu":
          return "personnes-invalides";
        case "trop-grand":
          return "personnes-trop-grand";
      }
    }
    return analyse.valeur;
  }

  function ouvrir(c: CaseDeMenu) {
    effacer();
    setZone("edition");
    retourFocus.current = `personnes-${c.id}`;
    setEnEdition(c.id);
    setSaisieEditee(String(c.personnes));
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
    setAConfirmer(null);

    if (!recetteChoisie) return refuser("recette-vide");
    const combien = versPersonnes(personnes);
    if (typeof combien === "string") return refuser(combien);

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      /*
       * ⚠️ **`household_id` et `created_by` explicites, et ce ne sont pas des gardes.**
       * La première est `not null` sans défaut, et `meal_plan_all` porte le `with check`
       * qui refuserait un foyer étranger : la frontière est en base (AD-2). La seconde
       * n'a pas de défaut non plus, et la laisser nulle perdrait **définitivement**
       * l'information de qui a planifié quoi. Motif de `ListeRecettes.tsx:60-74`.
       *
       * ⚠️ **`servings` n'est jamais laissé au défaut de la colonne** (2) : l'AC1 exige
       * que le nombre soit *indiqué*.
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
         * ⚠️ **`deja-au-menu` rafraîchit AUSSI, et c'est la revue qui l'a établi.** Un
         * `23505` **prouve** que la base contient une ligne que la liste au-dessus
         * n'affiche pas : annoncer « elle est déjà à ce repas » sans remettre l'écran
         * d'accord laisserait le membre devant une liste qui le dément. Le message dit
         * donc « La voilà. », et cette phrase n'est vraie que grâce à cette ligne.
         *
         * ⚠️ **`setZone("liste")` avant de rafraîchir sur `menu-change`.** Ce refus peut
         * vider le répertoire (l'autre membre a supprimé la dernière recette) ; le
         * `<form>` d'ajout se démonterait alors avec sa région, et le message ne
         * s'afficherait NULLE PART. La région de liste, elle, est montée en permanence.
         * C'est le geste qu'`IngredientsRecette` fait déjà quand une ligne disparaît.
         */
        if (refus === "menu-change") {
          setZone("liste");
          router.refresh();
        } else if (refus === "deja-au-menu") {
          router.refresh();
        }
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
    setZone("edition");
    /*
     * Soumettre, c'est renoncer à retirer. Sans ce désarmement, un enregistrement
     * refusé laisserait « Confirmer » armé juste sous le champ, où il se lit comme
     * « confirmer l'enregistrement ». Leçon de `/rayons`.
     */
    setAConfirmer(null);

    const combien = versPersonnes(saisieEditee);
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
        const refus = refusAssignation(error);
        /*
         * ⚠️ **Rafraîchir ICI aussi.** La première rédaction ne le faisait que dans la
         * branche `!data` ci-dessous, si bien que « Voilà ce qui reste. » promettait sur
         * ce chemin un rafraîchissement qui n'avait pas lieu. Relevé par la revue.
         */
        if (refus === "menu-change") {
          setZone("liste");
          fermer("titre-prevu");
          router.refresh();
        }
        return refus;
      }
      /*
       * ⚠️ **Contrôler `data` autant qu'`error`.** Un `update` sur une ligne que la RLS
       * masque — la recette supprimée entre-temps, donc la case emportée par la cascade
       * — rend **zéro ligne et AUCUNE erreur**. Sans ce test, l'écran annoncerait
       * « C'est noté. » sur une écriture qui n'a rien touché. Motif de
       * `DisplayNameForm.tsx:70-78`.
       *
       * ⚠️ **Les TROIS gestes, pas seulement le rafraîchissement** : sans
       * `setZone("liste")` et `fermer()`, le rafraîchissement retire la ligne, le
       * `<form>` se démonte avec la région qui portait le message, et le seul message
       * écrit pour ce cas serait le seul à ne jamais être vu.
       */
      if (!data) {
        setZone("liste");
        fermer("titre-prevu");
        router.refresh();
        return "menu-change";
      }

      /*
       * ⚠️ **`setZone("liste")` AVANT `fermer()`, et la cible est la ligne REPLIÉE.**
       * Sans le changement de zone, « C'est noté. » se rendrait dans la région du
       * `<form>` que `fermer()` démonte au même rendu : le panneau se refermerait en
       * silence sur le chemin le plus courant de l'écran. Et `personnes-${c.id}` désigne
       * le champ de ce même `<form>` démonté — la cible juste est le bouton de la ligne
       * repliée. Les deux défauts sont ceux qu'`IngredientsRecette` a payés le
       * 2026-08-03.
       */
      setZone("liste");
      fermer(`case-${c.id}`);
      router.refresh();
      return "modifie";
    });
  }

  async function retirer(c: CaseDeMenu) {
    setZone("edition");

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
        const refus = refusAssignation(error);
        if (refus === "menu-change") {
          setZone("liste");
          fermer("titre-prevu");
          router.refresh();
        }
        return refus;
      }

      /*
       * Zéro ligne n'est pas un échec : la case avait déjà disparu, donc l'intention est
       * satisfaite. Même lecture que la suppression d'ingrédient.
       *
       * ⚠️ **Le focus part au titre de la section**, la ligne qui le portait n'existant
       * plus. Il est posé ICI et non avant l'`await` : armé trop tôt, il resterait armé
       * si `soumettre` attrapait une exception (elle en attrape — c'est sa raison
       * d'être), et tirerait le focus au prochain rendu serveur sans cause visible.
       * Relevé par la revue du 2026-08-05.
       */
      setZone("liste");
      fermer("titre-prevu");
      router.refresh();
      return "retire";
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");
  /*
   * ⚠️ **`reserve` sur la région de liste** : elle surplombe la liste ET le formulaire
   * d'ajout, donc un message qui apparaît pousse les cibles sous le doigt au moment du
   * clic — le contrat de `Notice`, et le défaut trouvé deux fois de suite sur `/rayons`.
   */
  const statutListe = (
    <Notice reserve className="mt-2">
      {zone === "liste" ? message : undefined}
    </Notice>
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

  return (
    <div>
      <section className="mt-8">
        <h2 id="titre-prevu" tabIndex={-1} className="titre-section">
          Ce qui est prévu
        </h2>

        {/* ⚠️ Montée EN PERMANENCE, hors de la branche non vide : retirer la dernière
            recette démonte la liste, et un message rendu à l'intérieur partirait avec
            elle. C'est la cinquième fois que ce dépôt rencontre cette famille. */}
        {statutListe}

        {cases.length === 0 ? (
          <p className="hint mt-1">Rien de prévu pour l&apos;instant.</p>
        ) : (
          <ul className="mt-2">
            {cases.map((c) => (
              <li key={c.id} className="border-b border-card-border py-3 last:border-0">
                {/* La destination existe depuis la story 3.3 et n'est pas à inventer.
                    Elle reste une cible à part entière : elle mène ailleurs, là où le
                    reste de la ligne modifie sur place. */}
                <Link
                  href={`/recettes/${c.recetteId}`}
                  className="flex min-h-touch items-center text-base break-words underline underline-offset-4"
                >
                  {c.recetteTitre}
                </Link>

                {enEdition === c.id ? (
                  <form onSubmit={(e) => changerPersonnes(e, c)} noValidate>
                    <div className="mt-1">
                      <label htmlFor={`personnes-${c.id}`} className="label">
                        Pour combien de personnes
                      </label>
                      <input
                        id={`personnes-${c.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={saisieEditee}
                        onChange={(e) => {
                          setSaisieEditee(e.target.value);
                          effacer();
                        }}
                        disabled={occupe}
                        className="input mt-1 tabular-nums"
                      />
                    </div>

                    {statutEdition}

                    <div className="mt-3 flex items-center gap-2">
                      <button type="submit" disabled={occupe} className="btn-primaire flex-1">
                        {occupe ? LIBELLE_OCCUPE : "Enregistrer"}
                      </button>
                      <button
                        type="button"
                        onClick={() => fermer(`case-${c.id}`)}
                        disabled={occupe}
                        className="btn-quiet"
                      >
                        Annuler
                      </button>
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      {aConfirmer === c.id ? (
                        <>
                          <button
                            type="button"
                            id={`confirmer-${c.id}`}
                            onClick={() => retirer(c)}
                            disabled={occupe}
                            className="btn-quiet px-0"
                          >
                            {occupe ? LIBELLE_OCCUPE : "Confirmer"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              retourFocus.current = `retirer-${c.id}`;
                              setAConfirmer(null);
                            }}
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
                          id={`retirer-${c.id}`}
                          onClick={() => {
                            setZone("edition");
                            effacer();
                            retourFocus.current = `confirmer-${c.id}`;
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
                  </form>
                ) : (
                  /* ⚠️ Le nombre de personnes est le LIBELLÉ du bouton qui l'ouvre : une
                     seule cible par ligne, et son nom accessible dit de quelle recette il
                     s'agit — sinon N boutons « Modifier » indiscernables au rotor. */
                  <button
                    type="button"
                    id={`case-${c.id}`}
                    onClick={() => ouvrir(c)}
                    disabled={occupe}
                    aria-label={`Modifier : ${c.recetteTitre}, ${c.personnes} personnes`}
                    className="flex min-h-touch cursor-pointer items-center gap-2 text-left"
                  >
                    <span className="hint tabular-nums">{c.personnes} pers.</span>
                    <span className="hint underline underline-offset-4">Modifier</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Mettre une recette</h2>

        {recettes.length === 0 ? (
          /* ⚠️ Une invitation à choisir dans un répertoire vide serait un conseil qui ne
             peut pas fonctionner. On dit ce qui manque, et on donne le chemin. */
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
            ⚠️ **`noValidate`, et ce n'est PAS une désactivation de contrôle.** Sans lui,
            `min={1}` et `required` font refuser la soumission par le NAVIGATEUR, qui
            affiche son propre message — « Value must be greater than or equal to 1. »,
            **en anglais**, hors de toute région `aria-live`, et hors du ton du produit
            (NFR-8/NFR-9). Pire : `ajouter` n'est alors jamais appelé, donc « Il faut au
            moins une personne. » et « Choisis une recette. » ne peuvent **jamais**
            s'afficher — deux clés de message sans appelant.

            **Trouvé par le parcours à l'écran du 2026-08-04**, pas par une porte : les six
            portes étaient vertes. Règle §7.

            `min={1}` et `required` restent sur les champs : ils portent l'affordance (les
            flèches du sélecteur ne descendent pas sous 1) et l'information
            d'accessibilité. Les frontières dures sont en base ; les refus lisibles ici.
          */
          <form onSubmit={ajouter} noValidate className="mt-2">
            <div>
              <label htmlFor="recette" className="label">
                Quelle recette
              </label>
              {/*
                ⚠️ **`w-full` ET `min-w-0`, et ce n'est pas de la ceinture.** Un `<select>`
                prend l'intrinsèque de sa plus longue option, et un titre de recette va
                jusqu'à 80 caractères (`MAX_TITRE`). Sans ces deux classes il impose sa
                largeur au conteneur — c'est-à-dire le défilement horizontal que
                NFR-3/UX-DR10 interdisent. C'est aussi pour ça que ce formulaire vit sur
                son propre écran et non dans une case de la grille.

                Le filtre et la recherche appartiennent à la story 3.4, sautée et toujours
                due : les recettes sont ici rangées par titre, et rien de plus.
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
                On part de ce que tu as réglé pour le foyer. Change-le si ce repas est
                différent.
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
