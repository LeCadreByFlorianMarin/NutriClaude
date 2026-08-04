"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { refusOrdre, refusRayon } from "@/lib/rayons/erreurs";
import type { Rayon } from "@/lib/rayons/rayons";
import {
  indexCibleDuGlisser,
  ordreApresDeplacement,
  ordreDeplace,
  type Sens,
} from "@/lib/ordre";
import {
  MAX_NOM_RAYON,
  iconeTropLongue,
  normaliserIcone,
  normaliserNomRayon,
  prochainOrdre,
} from "@/lib/rayons/saisie";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  vide: "Il faut un nom.",
  "nom-vide": "Il faut un nom.",
  "nom-pris": "Ce rayon existe déjà.",
  "icone-multiple": "Un seul emoji pour l'icône.",
  disparu: "Ce rayon n'existe plus. La liste vient d'être remise à jour.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
  cree: "C'est noté.",
  modifie: "C'est noté.",
  supprime: "Le rayon est parti.",
  restaure: "Les rayons de départ sont revenus.",
  /*
   * ⚠️ Jamais « Réessaie » ici. Réessayer sans rafraîchir reproduirait le même
   * refus indéfiniment : le tableau envoyé ne correspond plus à la base, et
   * seul un rafraîchissement peut le remettre d'accord. C'est pour ça que le
   * `router.refresh()` fait partie du TRAITEMENT du refus, pas d'une éventuelle
   * nouvelle tentative de l'utilisateur.
   */
  "liste-changee": "La liste des rayons vient de changer. La voilà à jour.",
  /*
   * Repli statique : la région du parcours rend mieux que ça — elle nomme le
   * rayon et son nouveau rang, la seule information qu'un lecteur d'écran ne
   * peut PAS tirer d'une liste qui se réordonne en silence.
   */
  deplace: "C'est noté.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Où le message de la soumission en cours doit s'afficher.
 *
 * ⚠ **Un message qu'on ne voit pas n'existe pas, et cet écran a trois surfaces
 * de soumission à trois endroits de la page.** Sur un foyer amorcé, onze lignes
 * de 44px séparent le haut de la page du formulaire d'ajout — et du panneau
 * d'édition de la dernière ligne. Une région unique en tête affichait donc
 * « Ce rayon existe déjà. » hors écran : le champ restait rempli, le bouton
 * redevenait actif, et rien ne se passait.
 *
 * ⚠ **La première correction n'en a créé que DEUX, et le défaut est resté sur
 * le panneau d'édition** — la seconde passe de revue du 2026-07-29 l'a retrouvé
 * mot pour mot au même endroit. `enregistrer` n'appelle pas `fermer()` en cas
 * d'échec : le panneau reste ouvert en bas de liste pendant que son message
 * s'écrit tout en haut. Trois surfaces, trois régions.
 *
 * ⚠ **`parcours` est la QUATRIÈME**, ajoutée avec le réordonnancement (story
 * 2.2, décision de Florian du 2026-07-30). Elle est rendue SOUS la liste : sur
 * un foyer amorcé, déplacer le onzième rayon écrirait sinon son message tout en
 * haut, hors écran — le défaut que les deux passes de revue ont déjà trouvé sur
 * deux surfaces différentes.
 *
 * Limite connue et acceptée : déplacer un rayon du HAUT d'une longue liste écrit
 * le message SOUS la liste, donc possiblement hors écran lui aussi. Aucune
 * position fixe ne satisfait les deux bouts. C'est supportable parce que le
 * déplacement est sa propre confirmation visuelle — la ligne bouge sous les yeux
 * — et que l'annonce au lecteur d'écran fonctionne quelle que soit la position
 * de défilement. Le cas qui compterait vraiment, le refus, s'accompagne d'un
 * `router.refresh()` dont l'effet est visible partout.
 *
 * Les quatre sont **montées en permanence** tant que leur surface existe, et une
 * seule porte du texte à la fois. C'est ce qui préserve l'acquis d'`InviteCard` :
 * une région annoncée de façon fiable est une région qui existait déjà avant que
 * le message n'y arrive.
 */
type Zone = "liste" | "edition" | "creation" | "parcours";

/**
 * Le geste de glisser en cours.
 *
 * ⚠ **C'est un ordre local, donc une entorse à « aucune copie locale de la
 * liste » — et elle est bornée.** La règle de la story 2.1 interdit un état qui
 * DIVERGE DANS LA DURÉE quand l'autre membre du foyer écrit. Un geste ne dure
 * pas : cet objet est remis à `null` sur `pointerup`, sur `pointercancel` ET sur
 * `Escape`, sans exception, et il ne porte que des positions — jamais un nom,
 * une icône ou un `sort_order`. La soumission recalcule depuis les propriétés,
 * jamais depuis lui. Même famille que `useOptimistic` : un aperçu qui expire.
 *
 * ⚠ **Les centres sont mesurés UNE fois, au `pointerdown`, et c'est pour ça que
 * l'ordre du DOM ne bouge pas pendant le geste.** Un aperçu qui réordonnerait la
 * liste sous le doigt invaliderait ces mesures à l'instant même où on s'en sert :
 * la ligne visée se déroberait, l'index oscillerait entre deux valeurs et la
 * liste tremblerait. Ici rien ne se réarrange — seule la ligne tirée se
 * translate, et un trait montre où elle atterrira. Les mesures restent donc
 * vraies pendant tout le geste, par construction.
 */
type Glisse = {
  id: string;
  /** Index de la ligne tirée dans `rayons` (donc dans la liste complète). */
  depuisIndex: number;
  /** `clientY` au `pointerdown`, origine du `delta`. */
  departY: number;
  /** Centre de la ligne tirée à la mesure initiale. */
  centreDepart: number;
  /** Centres des AUTRES lignes, dans l'ordre d'affichage. */
  centresAutres: number[];
  /** Déplacement courant du pointeur, en pixels. */
  delta: number;
  /** Index visé, exprimé dans la liste privée de la ligne tirée. */
  cible: number;
};

/**
 * L'écran des rayons : créer, renommer, ré-iconifier, supprimer.
 *
 * ⚠ **Écritures client-direct, pas de Server Action** — et le critère est la
 * cause, pas l'analogie de vocabulaire (AD-13, formulation du 2026-07-28) : une
 * écriture passe par une Server Action si elle exige un secret serveur, ou si sa
 * conséquence doit apparaître dans un rendu serveur. Ici, ni l'un ni l'autre :
 * la conséquence est locale à cet écran, et `router.refresh()` la rejoue. C'est
 * le motif exact de `DisplayNameForm`. À contre-exemple, `genererInvitation` est
 * une Server Action *malgré* l'absence de secret, parce que `/foyer` doit
 * montrer le code immédiatement.
 *
 * ⚠ **Aucune copie locale de la liste.** L'état de ce composant ne porte que
 * l'interface — quelle ligne est ouverte, quelle suppression attend
 * confirmation. La liste vient des propriétés, et `router.refresh()` la
 * rafraîchit. Une copie locale divergerait dès que l'autre membre du foyer
 * écrit, et il n'y a pas encore de propagation temps réel (AD-8, Epic 4).
 *
 * Conséquence assumée : pas de mise à jour optimiste, donc un temps de latence
 * entre le geste et son reflet. C'est acceptable ici — l'outbox et l'optimisme
 * d'AD-5 concernent les surfaces liste, au supermarché, pas un écran de
 * configuration au calme.
 */
export function ListeRayons({
  rayons,
  foyerId,
}: {
  rayons: Rayon[];
  foyerId: string;
}) {
  const router = useRouter();
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();

  /** Le rayon ouvert en édition, et la saisie en cours pour lui. */
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [iconeEditee, setIconeEditee] = useState("");
  /** Le rayon dont la suppression attend une confirmation. */
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  const [nouveauNom, setNouveauNom] = useState("");
  const [nouvelleIcone, setNouvelleIcone] = useState("");

  /** La région de statut qui portera le message de la soumission en cours. */
  const [zone, setZone] = useState<Zone>("liste");
  /**
   * Le rayon qui vient d'être déplacé, et son nouveau rang.
   *
   * ⚠ **Ce n'est pas une copie de la liste** — c'est le contenu d'un message.
   * Le rang est la seule information qu'un lecteur d'écran ne peut PAS obtenir
   * autrement : une liste qui se réordonne le fait en silence, sans qu'aucune
   * annonce ne soit émise.
   */
  const [deplacement, setDeplacement] = useState<{
    nom: string;
    rang: number;
  } | null>(null);

  /**
   * Le geste de glisser en cours — voir `Glisse`. `null` en dehors d'un geste.
   *
   * ⚠ **Deux exemplaires, et ce n'est pas une redondance.** La `ref` est la
   * source de vérité des gestionnaires ; l'état ne sert qu'à rendre.
   *
   * La raison est une fermeture : lu depuis l'état, `glisse` vaut dans
   * `finirGlisse` ce qu'il valait au rendu où le gestionnaire a été posé. React
   * groupe les mises à jour ; rien ne garantit qu'un rendu s'intercale entre le
   * `pointerdown` et le `pointerup` d'un geste très bref. Le relâchement lirait
   * alors `null` et le geste serait perdu **en silence** — pas d'erreur, pas de
   * message, rien.
   *
   * ⚠️ Ce scénario est **raisonné, pas mesuré** : le seul échec observé le
   * 2026-07-31 avait une tout autre cause (un point de départ périmé après un
   * défilement de la page). La `ref` est retenue parce qu'elle supprime la
   * classe de défaut par construction, pas parce qu'on a vu celui-ci se
   * produire.
   */
  const glisseRef = useRef<Glisse | null>(null);
  const [glisse, setGlisse] = useState<Glisse | null>(null);
  /** La liste, pour mesurer la géométrie des lignes au début d'un glisser. */
  const listeRef = useRef<HTMLUListElement>(null);

  /** Pose le geste aux deux endroits — jamais l'un sans l'autre. */
  function poserGlisse(g: Glisse | null) {
    glisseRef.current = g;
    setGlisse(g);
  }
  /**
   * L'élément à refocaliser une fois le panneau refermé.
   *
   * Une **ref** et non un état : la consommer ne doit pas déclencher de rendu,
   * et `setState` dans un effet est une cascade que le lint refuse à juste
   * titre. Elle est posée par `fermer` et lue par l'effet ci-dessous, qui est
   * réveillé par le changement d'`enEdition` — pas par elle.
   */
  const retourFocus = useRef<string | null>(null);

  /*
   * ⚠ **Le focus, sinon il retombe sur `<body>`.** Tout geste de cet écran
   * démonte l'élément qui portait le focus : ouvrir un panneau remplace le
   * `<button>` de la ligne par un `<form>`, le refermer fait l'inverse,
   * supprimer fait disparaître la ligne, et restaurer fait disparaître le bouton
   * de l'état vide. Sans rien, il faut repartir de `Tab` depuis le haut de la
   * page. Rien à voir avec l'interdiction d'`autoFocus` : déplacer le focus en
   * réponse à un geste explicite n'est pas le voler au chargement.
   *
   * ⚠ **`rayons` est dans les dépendances, et ce n'est pas décoratif.** La
   * première correction ne réveillait cet effet que sur `enEdition` — ce qui
   * laissait dehors le seul bouton qui se démonte sans passer par le panneau :
   * « Remettre les rayons de départ », dont la branche disparaît dès que la
   * liste cesse d'être vide. Trouvé par la seconde passe de revue. Un seul
   * chemin pour tout le monde : on pose la cible, le rendu suivant la consomme.
   */
  useEffect(() => {
    const cible = retourFocus.current;
    if (!cible) return;
    retourFocus.current = null;
    document.getElementById(cible)?.focus();
  }, [enEdition, rayons]);

  function ouvrir(rayon: Rayon) {
    effacer();
    setZone("edition");
    retourFocus.current = `nom-${rayon.id}`;
    setEnEdition(rayon.id);
    setNomEdite(rayon.nom);
    setIconeEditee(rayon.icone ?? "");
    setAConfirmer(null);
  }

  /**
   * Referme le panneau, et rend le focus à `retour` — l'identifiant de la ligne
   * qu'on vient de quitter, ou le titre de la section quand cette ligne n'existe
   * plus (suppression).
   */
  function fermer(retour: string) {
    retourFocus.current = retour;
    setEnEdition(null);
    setAConfirmer(null);
  }

  async function creer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setZone("creation");

    const nom = normaliserNomRayon(nouveauNom);
    if (!nom) return refuser("vide");
    // Refuser plutôt que réduire en silence : le champ icône est le premier des
    // deux, et y taper le nom du rayon enregistrait son initiale sans un mot.
    if (iconeTropLongue(nouvelleIcone)) return refuser("icone-multiple");

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * `household_id` est explicite : la colonne est `not null` et n'a pas de
       * défaut. Ce n'est pas une garde — `aisles_all` porte
       * `with check (household_id = current_household_id())`, donc une valeur
       * étrangère serait refusée par Postgres. La frontière est en base (AD-2).
       *
       * `sort_order` est calculé et jamais laissé au défaut de la colonne :
       * il vaut 100, et 100 est déjà pris par « Hygiène & Entretien ».
       * Voir `prochainOrdre`.
       */
      const { data, error } = await supabase
        .from("aisles")
        .insert({
          household_id: foyerId,
          name: nom,
          icon: normaliserIcone(nouvelleIcone),
          sort_order: prochainOrdre(rayons),
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[rayons] création refusée :", error.message);
        return refusRayon(error);
      }

      setNouveauNom("");
      setNouvelleIcone("");
      router.refresh();
      return "cree";
    });
  }

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enEdition) return;
    setZone("edition");
    /*
     * Soumettre, c'est renoncer à supprimer. Sans ce désarmement, un
     * enregistrement refusé (23505) laissait le panneau ouvert avec « Confirmer »
     * toujours armé juste sous le champ — où il se lit comme « confirmer
     * l'enregistrement », et où un tap supprime le rayon. La première passe de
     * revue avait vu l'état et l'avait jugé voulu ; la seconde a montré que le
     * chemin d'échec est atteignable sans faute de l'utilisateur.
     */
    setAConfirmer(null);

    const nom = normaliserNomRayon(nomEdite);
    if (!nom) return refuser("vide");
    if (iconeTropLongue(iconeEditee)) return refuser("icone-multiple");

    const ligne = enEdition;

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { data, error } = await supabase
        .from("aisles")
        .update({ name: nom, icon: normaliserIcone(iconeEditee) })
        .eq("id", ligne)
        .select("id")
        .maybeSingle();

      /*
       * `data` autant qu'`error` : un update qui ne touche aucune ligne est un
       * succès pour PostgREST. Sans cette lecture de retour, un refus de la RLS
       * afficherait « c'est noté » sans que rien ne soit écrit.
       */
      if (error) {
        console.error("[rayons] écriture refusée :", error.message);
        return refusRayon(error);
      }
      if (!data) return disparu();

      // Le panneau se referme : le message appartient désormais à la liste, pas
      // à une surface qui n'existe plus.
      setZone("liste");
      fermer(`rayon-${ligne}`);
      router.refresh();
      return "modifie";
    });
  }

  async function supprimer(id: string) {
    // Le panneau est ouvert : un refus s'affiche DANS le panneau. Le succès, lui,
    // le referme et bascule vers la liste, plus bas.
    setZone("edition");

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { data, error } = await supabase
        .from("aisles")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

      // Même raison que pour l'update : zéro ligne supprimée n'est pas une
      // erreur pour PostgREST, mais ce n'est pas une suppression non plus.
      if (error) {
        console.error("[rayons] suppression refusée :", error.message);
        return refusRayon(error);
      }
      if (!data) return disparu();

      setZone("liste");
      fermer("titre-parcours");
      router.refresh();
      return "supprime";
    });
  }

  /**
   * Zéro ligne touchée, sans erreur : la ligne n'existe plus.
   *
   * ⚠ **Ce cas était rangé avec les vraies erreurs, et c'était un piège à deux
   * membres.** Si la conjointe supprime « Boucherie » depuis son téléphone,
   * l'écran de Florian — sans propagation temps réel avant l'Epic 4 (AD-8) —
   * rendait « Ça n'a pas marché. Réessaie dans un instant. » et **ne
   * rafraîchissait pas** : la ligne fantôme restait affichée, le panneau restait
   * ouvert, et chaque nouvel essai reproduisait le même échec indéfiniment. Le
   * conseil de réessayer était faux, puisque rien ne pouvait plus réussir.
   *
   * Refermer, rafraîchir, et le dire : c'est la seule issue qui remette l'écran
   * d'accord avec la base.
   */
  function disparu(): Cle {
    // Le titre de section, jamais la ligne : elle ne sera plus là au rendu suivant.
    setZone("liste");
    fermer("titre-parcours");
    router.refresh();
    return "disparu";
  }

  /**
   * Réordonne le parcours et persiste la permutation entière.
   *
   * ⚠ **Un seul appel, pas deux `update`.** `reorder_aisles` renumérote tout le
   * parcours en une transaction, et refuse tout tableau qui ne le couvre pas
   * exactement. C'est ce qui tient l'AC2 — « positions uniques, aucun rayon
   * perdu ou dupliqué » est un invariant sur plusieurs lignes à la fois, donc il
   * vit en Postgres (AD-1/AD-2) et pas dans la vigilance de cet écran.
   *
   * ⚠ **Le calcul part des PROPRIÉTÉS, donc du dernier rendu serveur.** Deux
   * pressions avant l'arrivée du `router.refresh()` calculeraient le même
   * tableau depuis le même état, et la seconde serait silencieusement perdue :
   * la base ne broncherait pas, le rayon aurait bougé d'un cran au lieu de deux.
   * C'est `disabled={occupe}` sur les flèches qui ferme cette course — et pas
   * `useSoumission`, dont `occupe` n'est jamais relu dans `soumettre`.
   */
  async function persisterOrdre(ordre: string[], nom: string, versIndex: number) {
    setZone("parcours");

    await soumettre(async () => {
      const supabase = createNavigateurClient();
      const { error } = await supabase.rpc("reorder_aisles", { p_ids: ordre });

      if (error) {
        console.error("[rayons] réordonnancement refusé :", error.message);
        const refus = refusOrdre(error);
        /*
         * Rafraîchir fait partie du traitement du refus. Sans lui, l'écran
         * resterait en désaccord avec la base — l'autre membre a ajouté ou
         * supprimé un rayon — et chaque nouvelle tentative reproduirait le même
         * refus, indéfiniment. Même impasse que celle refermée par `disparu()`.
         */
        if (refus === "liste-changee") router.refresh();
        return refus;
      }

      setDeplacement({ nom, rang: versIndex + 1 });
      router.refresh();
      return "deplace";
    });
  }

  async function deplacer(rayon: Rayon, sens: Sens, index: number) {
    const ordre = ordreApresDeplacement(rayons, rayon.id, sens);
    // Bout de course : le bouton était désactivé, on ne devrait pas arriver là.
    // Rien à écrire, donc rien à dire.
    if (!ordre) return;

    const versIndex = sens === "haut" ? index - 1 : index + 1;

    /*
     * ⚠ **Le focus, et c'est le piège de cette story.** Le déplacement peut
     * désactiver le bouton qu'on vient de presser — monter jusqu'à la première
     * place désactive « monter » — et **un élément désactivé perd le focus**,
     * qui retombe sur `<body>`. Au clavier, il faudrait repartir de `Tab` en
     * haut du document. On vise donc, quand c'est le cas, la flèche opposée,
     * qui elle restera active.
     *
     * Posé AVANT la soumission : l'effet de focus est réveillé par le changement
     * de `rayons` et consomme la cible qu'il trouve.
     */
    const finDeCourse =
      sens === "haut" ? versIndex === 0 : versIndex === rayons.length - 1;
    const opposee = sens === "haut" ? "descendre" : "monter";
    const meme = sens === "haut" ? "monter" : "descendre";
    retourFocus.current = `${finDeCourse ? opposee : meme}-${rayon.id}`;

    await persisterOrdre(ordre, rayon.nom, versIndex);
  }

  /* ── Le glisser ──────────────────────────────────────────────────────────
   *
   * ⚠ **`draggable` HTML5 est hors jeu** : il n'émet AUCUN événement au toucher
   * sur iOS Safari, et NFR-1 nomme l'iPhone 15 Pro comme appareil de référence.
   * D'où les événements de pointeur, qui unifient souris, stylet et doigt.
   *
   * ⚠ **Les flèches ci-dessus ne sont pas un doublon de ce geste : elles sont ce
   * qui le rend CONFORME.** WCAG 2.5.7 (« Dragging Movements », AA) exige que
   * toute fonction reposant sur un glissement dispose d'une alternative à
   * pointeur simple qui n'en soit pas un. Livrer le glisser seul serait une
   * régression d'accessibilité.
   */

  function debutGlisse(event: React.PointerEvent<HTMLSpanElement>, rayon: Rayon, index: number) {
    // Une poignée n'est pas un `<button>` : `disabled` n'existe pas dessus, donc
    // la garde contre la ré-entrance s'écrit ici. Même raison que le
    // `disabled={occupe}` des flèches.
    if (occupe || !listeRef.current) return;

    /*
     * Sans capture de pointeur, sortir du rectangle de la poignée — ce qui
     * arrive dès les premiers pixels — ferait perdre les événements suivants.
     */
    event.currentTarget.setPointerCapture(event.pointerId);

    const lignes = [...listeRef.current.querySelectorAll(":scope > li")];
    const centres = lignes.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });

    poserGlisse({
      id: rayon.id,
      depuisIndex: index,
      departY: event.clientY,
      centreDepart: centres[index],
      centresAutres: centres.filter((_, i) => i !== index),
      delta: 0,
      cible: index,
    });
  }

  function suivreGlisse(event: React.PointerEvent<HTMLSpanElement>) {
    const g = glisseRef.current;
    if (!g) return;
    const delta = event.clientY - g.departY;
    poserGlisse({
      ...g,
      delta,
      cible: indexCibleDuGlisser(g.centresAutres, g.centreDepart + delta),
    });
  }

  async function finirGlisse() {
    const g = glisseRef.current;
    // Jeter l'aperçu AVANT d'écrire : aucun chemin de sortie ne doit pouvoir le
    // laisser derrière lui.
    poserGlisse(null);
    if (!g) return;

    const rayon = rayons.find((r) => r.id === g.id);
    if (!rayon) return;

    const ordre = ordreDeplace(rayons, g.id, g.cible);
    // Relâché à sa place de départ : il ne s'est rien passé, donc rien à écrire
    // et rien à annoncer.
    if (!ordre) return;

    /*
     * Le focus n'est PAS déplacé ici, et la dissymétrie avec les flèches est
     * voulue : un utilisateur au pointeur ne navigue pas au focus, et le lui
     * bouger serait une surprise. La poignée est `aria-hidden` et non
     * focalisable — il n'y a rien à lui rendre.
     */
    await persisterOrdre(ordre, rayon.nom, g.cible);
  }

  /* `Escape` annule le geste — au même titre que `pointercancel`, qui arrive
     pour de vrai : appel entrant, changement d'application, geste système. */
  useEffect(() => {
    if (!glisse) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") poserGlisse(null);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [glisse]);

  async function restaurer() {
    setZone("liste");
    /*
     * Le bouton qui vient d'être pressé n'est rendu que dans la branche
     * `rayons.length === 0` : au succès, il disparaît avec elle. C'est le seul
     * geste de l'écran qui démonte son propre déclencheur sans passer par
     * `fermer`, et la première passe de revue l'avait laissé dehors — le focus
     * retombait sur `<body>`, sur le geste où c'était le plus certain.
     */
    retourFocus.current = "titre-parcours";

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * La fonction recontrôle le foyer elle-même depuis le 2026-07-29
       * (`20260729095922_guard_seed_default_aisles.sql`) : elle est
       * `security definer`, donc la RLS ne s'y applique pas, et son paramètre
       * était une porte ouverte sur les rayons des autres foyers. Passer
       * `foyerId` ici n'est donc pas une auto-autorisation — c'est la base qui
       * tranche.
       *
       * Idempotente : `on conflict (household_id, name) do nothing`.
       */
      const { error } = await supabase.rpc("seed_default_aisles", {
        p_household_id: foyerId,
      });

      if (error) {
        console.error("[rayons] restauration refusée :", error.message);
        return "echec";
      }

      router.refresh();
      return "restaure";
    });
  }

  /*
   * Deux régions de statut, l'une près de la liste, l'autre près du bouton
   * « Ajouter » — voir `Zone`. Les deux sont hissées hors des conditionnels et
   * montées en permanence : c'est ce qui rend l'annonce fiable (constat
   * d'`InviteCard`). Une seule porte du texte à la fois.
   */
  const message = messageDe(MESSAGES, cle, "echec");
  const statutListe = (
    <Notice className="mt-2">{zone === "liste" ? message : undefined}</Notice>
  );
  const statutEdition = (
    <Notice reserve className="mt-3">
      {zone === "edition" ? message : undefined}
    </Notice>
  );
  const statutCreation = (
    <Notice reserve className="mt-3">
      {zone === "creation" ? message : undefined}
    </Notice>
  );
  /*
   * Sous la liste, et sans `reserve` : elle n'est au-dessus d'aucune cible, donc
   * réserver sa hauteur ne protégerait rien (contrat de `Notice`).
   *
   * ⚠ Le rang est rendu en `tabular-nums` — UX-DR12 l'impose sur tout chiffre, et
   * `.notice` ne le porte pas. Et le premier rang s'écrit « 1re », jamais
   * « 1ᵉ » ni « 1ère » : une synthèse vocale lit de travers un ordinal mal formé.
   */
  const statutParcours = (
    <Notice className="mt-3">
      {zone !== "parcours" ? undefined : cle === "deplace" && deplacement ? (
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

  /*
   * Où le trait d'insertion doit s'afficher. `cible` est un index dans la liste
   * PRIVÉE de la ligne tirée : le rayon atterrira juste avant `idsAutres[cible]`,
   * ou tout à la fin quand `cible` vaut la longueur.
   *
   * Le trait est en position absolue — sans quoi ses 2px décaleraient tout ce
   * qui suit et fausseraient les centres mesurés au `pointerdown`.
   */
  const idsAutres = glisse ? rayons.filter((r) => r.id !== glisse.id).map((r) => r.id) : [];
  const glisseUtile = glisse !== null && glisse.cible !== glisse.depuisIndex;
  const idAvantLequelInserer =
    glisseUtile && glisse.cible < idsAutres.length ? idsAutres[glisse.cible] : null;
  const traitEnFinDeListe = glisseUtile && glisse.cible === idsAutres.length;

  return (
    <div>
      <section>
        {/*
          `tabIndex={-1}` pour recevoir le focus au clavier après une
          suppression : la ligne qui le portait n'existe plus, et le laisser
          retomber sur `<body>` renverrait en haut du document.
        */}
        <h2 id="titre-parcours" tabIndex={-1} className="titre-section">
          Mon parcours
        </h2>
        {statutListe}

        {rayons.length === 0 ? (
          <div className="mt-2">
            <p className="text-base">Il n&apos;y a plus aucun rayon.</p>
            <p className="hint mt-1">
              Ajoutes-en un juste en dessous, ou remets ceux de départ.
            </p>
            <button
              type="button"
              onClick={restaurer}
              disabled={occupe}
              className="btn mt-4 w-full"
            >
              {occupe ? LIBELLE_OCCUPE : "Remettre les rayons de départ"}
            </button>
          </div>
        ) : (
          <>
          <ul className="mt-2" ref={listeRef}>
            {rayons.map((rayon, index) => (
              <li
                key={rayon.id}
                className={`relative border-b border-card-border last:border-0 ${
                  glisse?.id === rayon.id ? "z-10" : ""
                }`}
                style={
                  glisse?.id === rayon.id
                    ? {
                        /* Suit le pointeur en 1:1. AUCUNE transition : le retour
                           d'état direct au geste doit rester immédiat, et
                           l'absence d'animation satisfait
                           `prefers-reduced-motion` sans code conditionnel
                           (UX-DR11). */
                        transform: `translateY(${glisse.delta}px)`,
                        /*
                          ⚠ **La ligne tirée doit être OPAQUE, et
                          `--surface-card` ne l'est pas.** En thème sombre elle
                          vaut `#ffffff0e` — 5 % de blanc — et `--card-shadow`
                          vaut `none` : la ligne recouverte se lisait à travers,
                          deux noms superposés et illisibles. Vu à l'écran le
                          2026-07-31 ; aucune des quatre portes ne pouvait
                          l'attraper.

                          D'où le fond de base OPAQUE, avec la teinte de carte
                          posée par-dessus en dégradé plat — deux tokens
                          existants, aucune couleur inventée. C'est exactement
                          le rendu d'une carte qui flotte au-dessus de la page.
                        */
                        backgroundColor: "var(--surface-base)",
                        backgroundImage:
                          "linear-gradient(var(--surface-card), var(--surface-card))",
                        boxShadow: "var(--card-shadow)",
                      }
                    : undefined
                }
              >
                {/* Le trait d'insertion : où le rayon tiré atterrira. En
                    position absolue pour ne décaler AUCUNE ligne — un décalage
                    invaliderait les centres mesurés au début du geste. */}
                {idAvantLequelInserer === rayon.id ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-px right-0 left-0 h-0.5 bg-text"
                  />
                ) : null}
                {traitEnFinDeListe && idsAutres[idsAutres.length - 1] === rayon.id ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 -bottom-px left-0 h-0.5 bg-text"
                  />
                ) : null}
                {enEdition === rayon.id ? (
                  <form onSubmit={enregistrer} className="py-3">
                    {/*
                      Deux libellés visuellement masqués plutôt qu'aucun :
                      l'en-tête de la ligne ne nomme pas les champs à l'API
                      d'accessibilité, et un `<input>` sans nom accessible est
                      muet au lecteur d'écran.
                    */}
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0">
                        <label htmlFor={`icone-${rayon.id}`} className="sr-only">
                          Emoji du rayon
                        </label>
                        <input
                          id={`icone-${rayon.id}`}
                          type="text"
                          inputMode="text"
                          /*
                            Borne large, et jamais 1 : `maxLength` compte des
                            unités UTF-16, et un drapeau en occupe 4 — à 1, le
                            clavier ne laisserait même pas le saisir. La
                            réduction au premier grapheme se fait à la
                            soumission, dans `normaliserIcone`.
                          */
                          maxLength={16}
                          value={iconeEditee}
                          onChange={(e) => {
                            setIconeEditee(e.target.value);
                            effacer();
                          }}
                          className="input text-center"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <label htmlFor={`nom-${rayon.id}`} className="sr-only">
                          Nom du rayon
                        </label>
                        <input
                          id={`nom-${rayon.id}`}
                          type="text"
                          required
                          maxLength={MAX_NOM_RAYON}
                          value={nomEdite}
                          onChange={(e) => {
                            setNomEdite(e.target.value);
                            effacer();
                          }}
                          className="input"
                        />
                      </span>
                    </div>

                    {/*
                      La région de statut de CE panneau, au-dessus de ses
                      boutons. `enregistrer` ne referme pas en cas d'échec : le
                      panneau reste ouvert là où il est, et son message doit
                      rester avec lui. `reserve` parce qu'elle surplombe les
                      boutons — sans elle, le message les pousserait sous le
                      doigt au moment du clic (contrat de `Notice`).
                    */}
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
                        onClick={() => fermer(`rayon-${rayon.id}`)}
                        disabled={occupe}
                        className="btn-quiet"
                      >
                        Annuler
                      </button>
                    </div>

                    {/*
                      Confirmation en deux temps plutôt qu'une boîte de dialogue
                      native : `window.confirm` est hors thème, hors ton, et
                      bloque toute vérification pilotée par navigateur. Motif
                      d'`InviteCard`.
                    */}
                    <div className="mt-6 flex items-center justify-between gap-2">
                      {aConfirmer === rayon.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => supprimer(rayon.id)}
                            disabled={occupe}
                            className="btn-quiet"
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
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAConfirmer(rayon.id)}
                          disabled={occupe}
                          className="btn-quiet"
                        >
                          Supprimer ce rayon
                        </button>
                      )}
                    </div>

                    {aConfirmer === rayon.id ? (
                      <p className="hint mt-2">
                        Ce rayon disparaît de ton parcours.
                      </p>
                    ) : null}
                  </form>
                ) : (
                  /*
                    ⚠ **La ligne n'est plus UN bouton, et c'est structurel.**
                    Elle l'était jusqu'à la story 2.2 — `<button>` unique portant
                    toute la largeur. Un `<button>` ne peut pas en contenir un
                    autre : les flèches ne pouvaient pas y entrer. D'où trois
                    frères, et non un bouton qui en contiendrait deux.

                    L'esprit du choix d'origine est préservé : ouvrir l'édition
                    reste UNE cible, généreuse, qui prend toute la place que les
                    flèches lui laissent. On n'a pas fractionné l'ouverture.

                    La largeur, comptée : `max-w-sm` (384px) dans un `p-6` fait
                    ~336px. Deux flèches à 44px = 88px ; il reste ~248px pour
                    l'emoji et le nom. L'eyebrow « Modifier » a donc disparu — le
                    nom accessible vit dans l'`aria-label`, rien n'est perdu pour
                    un lecteur d'écran.
                  */
                  <div className="flex items-center gap-1">
                    {/*
                      La poignée de glisser.

                      ⚠ **`aria-hidden` sur un élément qui réagit au pointeur
                      n'est PAS une erreur ici, et il ne faut pas le
                      « corriger ».** Elle n'a AUCUN comportement clavier : sa
                      fonction est intégralement dupliquée par les deux flèches,
                      qui sont de vrais boutons nommés. L'annoncer au lecteur
                      d'écran reviendrait à lui présenter un contrôle inopérant.
                      C'est cette dualité qui satisfait WCAG 2.5.7.

                      ⚠ **`touch-none` est vital, et sur elle seule.** Sans lui,
                      le navigateur traite le geste comme un défilement et AUCUN
                      `pointermove` n'arrive : le glisser ne marche pas au doigt.
                      L'étendre à la liste casserait le défilement de la page.
                    */}
                    <span
                      aria-hidden="true"
                      tabIndex={-1}
                      onPointerDown={(e) => debutGlisse(e, rayon, index)}
                      onPointerMove={suivreGlisse}
                      onPointerUp={finirGlisse}
                      onPointerCancel={() => poserGlisse(null)}
                      className={`flex min-h-11 w-11 shrink-0 touch-none items-center
                                  justify-center text-base text-muted select-none
                                  ${glisse?.id === rayon.id ? "cursor-grabbing" : "cursor-grab"}`}
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      id={`rayon-${rayon.id}`}
                      onClick={() => ouvrir(rayon)}
                      aria-label={`Modifier ${rayon.nom}`}
                      className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center
                                 gap-3 py-2 text-left text-base"
                    >
                      {/* L'emoji est décoratif : le nom est déjà en texte juste à
                          côté, et le lire deux fois n'apporte rien (UX-DR4). */}
                      <span aria-hidden="true" className="w-6 shrink-0 text-center">
                        {rayon.icone ?? ""}
                      </span>
                      <span className="min-w-0 flex-1 break-all">{rayon.nom}</span>
                    </button>

                    {/*
                      Les deux flèches. `disabled={occupe}` n'est pas décoratif :
                      il ferme la course de deux pressions rapides, qui
                      calculeraient le même ordre depuis les mêmes propriétés.

                      Désactivé = un ton plus clair (`text-muted`), jamais une
                      opacité réductrice : c'est la règle de la couche de
                      composants, et une opacité ferait tomber le glyphe sous le
                      seuil de contraste.

                      Le glyphe est `aria-hidden` — le nom accessible est dans
                      l'`aria-label` du bouton, et « ↑ » ne se lit pas.
                    */}
                    <button
                      type="button"
                      id={`monter-${rayon.id}`}
                      onClick={() => deplacer(rayon, "haut", index)}
                      disabled={occupe || index === 0}
                      aria-label={`Monter ${rayon.nom}`}
                      className="flex min-h-11 w-11 shrink-0 cursor-pointer items-center
                                 justify-center text-base text-text
                                 disabled:cursor-default disabled:text-muted"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      id={`descendre-${rayon.id}`}
                      onClick={() => deplacer(rayon, "bas", index)}
                      disabled={occupe || index === rayons.length - 1}
                      aria-label={`Descendre ${rayon.nom}`}
                      className="flex min-h-11 w-11 shrink-0 cursor-pointer items-center
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
          {statutParcours}
          </>
        )}
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Ajouter un rayon</h2>

        <form onSubmit={creer} className="mt-2">
          <div className="flex gap-2">
            <span className="w-16 shrink-0">
              <label htmlFor="nouvelle-icone" className="sr-only">
                Emoji du rayon
              </label>
              <input
                id="nouvelle-icone"
                type="text"
                maxLength={16}
                placeholder="🥬"
                value={nouvelleIcone}
                onChange={(e) => {
                  setNouvelleIcone(e.target.value);
                  effacer();
                }}
                className="input text-center"
              />
            </span>
            <span className="min-w-0 flex-1">
              <label htmlFor="nouveau-nom" className="sr-only">
                Nom du rayon
              </label>
              <input
                id="nouveau-nom"
                type="text"
                required
                maxLength={MAX_NOM_RAYON}
                placeholder="Fromages"
                value={nouveauNom}
                onChange={(e) => {
                  setNouveauNom(e.target.value);
                  effacer();
                }}
                className="input"
              />
            </span>
          </div>

          <p className="hint mt-2">
            À gauche un emoji, à droite le nom. Il arrive à la fin du parcours, et
            tu pourras le déplacer plus tard.
          </p>

          {/*
            La région de statut de CE formulaire, au-dessus de son bouton et non
            en tête de page : sur un foyer amorcé, la tête de page est hors
            écran quand le doigt est sur « Ajouter ». `reserve` parce qu'elle
            est au-dessus du bouton — sans elle, le message pousserait la cible
            sous le doigt au moment du clic (contrat de `Notice`).
          */}
          {statutCreation}

          <button type="submit" disabled={occupe} className="btn-primaire mt-3 w-full">
            {occupe ? LIBELLE_OCCUPE : "Ajouter"}
          </button>
        </form>
      </section>
    </div>
  );
}
