"use client";

import { useEffect, useState, useTransition } from "react";
import { messageDe } from "@/lib/messages";
import { usages, validite } from "@/lib/foyer/libelles-invitation";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { annulerInvitation, genererInvitation } from "./actions";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  "session-perdue": "Ta session a expiré. Reconnecte-toi pour inviter quelqu'un.",
  indisponible: "On n'arrive pas à joindre le service. Réessaie dans un instant.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
  "copie-impossible": "Impossible de copier. Sélectionne le code à la main.",
  copie: "Copié !",
  cree: "Nouveau code créé. Le précédent ne marche plus.",
  annule: "Code annulé. Il ne marche plus.",
} as const;

type Cle = keyof typeof MESSAGES;
/** Quelle action est en vol — un seul `useTransition` ne suffit pas à le dire. */
type Action = "creer" | "annuler" | null;

export function InviteCard({
  code,
  expiresAt,
  usagesRestants,
}: {
  code: string | null;
  expiresAt: string | null;
  usagesRestants: number;
}) {
  const [enCours, demarrer] = useTransition();
  const [action, setAction] = useState<Action>(null);
  const [cle, setCle] = useState<Cle | undefined>();
  const [confirmeAnnulation, setConfirmeAnnulation] = useState(false);

  /*
   * Le message de copie s'efface tout seul. Les autres restent : ils rendent
   * compte d'une action qui a modifié la base, et disparaître au bout de
   * 2,5 s les rendrait invisibles à qui lit lentement.
   */
  useEffect(() => {
    if (cle !== "copie") return;
    const minuteur = setTimeout(() => setCle(undefined), 2500);
    return () => clearTimeout(minuteur);
  }, [cle]);

  function inviter() {
    setCle(undefined);
    setAction("creer");
    setConfirmeAnnulation(false);
    demarrer(async () => {
      const r = await genererInvitation();
      // Le succès s'annonce aussi : une suite de caractères qui en remplace une
      // autre au même endroit est un signal quasi nul à l'œil, et nul au lecteur
      // d'écran. C'est ce silence qui faisait appuyer deux fois.
      setCle(r.ok ? "cree" : r.erreur);
      setAction(null);
    });
  }

  function annuler() {
    if (!code) return;
    setCle(undefined);
    setAction("annuler");
    demarrer(async () => {
      const r = await annulerInvitation(code);
      setCle(r.ok ? "annule" : r.erreur);
      setAction(null);
      setConfirmeAnnulation(false);
    });
  }

  async function copier() {
    if (!code) return;
    try {
      // `navigator.clipboard` est absent hors origine sécurisée — une tablette
      // de cuisine servie en http:// sur le réseau local, par exemple.
      if (!navigator.clipboard) throw new Error("presse-papiers indisponible");
      await navigator.clipboard.writeText(code);
      setCle("copie");
    } catch {
      // On le dit, plutôt que de ne rien faire : appuyer sur un bouton qui ne
      // produit aucun retour laisse croire que l'application est figée.
      setCle("copie-impossible");
    }
  }

  /*
   * Une seule région de statut, hissée hors du conditionnel : les deux branches
   * rendaient chacune la leur, à des positions différentes de l'arbre, si bien
   * qu'un message posé au moment où l'on passe de l'une à l'autre n'était pas
   * annoncé de façon fiable.
   */
  const statut = <Notice className="mt-3">{messageDe(MESSAGES, cle, "echec")}</Notice>;

  if (!code) {
    return (
      <div>
        <p className="text-base">Personne n&apos;est encore invité.</p>
        {statut}
        <button
          type="button"
          onClick={inviter}
          disabled={enCours}
          className="btn-primaire mt-2 w-full"
        >
          {enCours ? LIBELLE_OCCUPE : "Inviter quelqu'un"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Le code sera lu à voix haute ou recopié : taille et espacement font
          tout le travail. L'abricot serait disponible, mais il est réservé à
          l'action courses (UX-DR2) — un code d'invitation n'en est pas une.

          `aria-hidden` + doublon `sr-only` : `aria-label` est ignoré sur un
          `<p>` (rôle `paragraph`, *name-prohibited* en ARIA 1.2), donc la
          version épelée n'atteignait aucun lecteur d'écran. `break-all` :
          8 caractères hexadécimaux n'ont aucune opportunité de coupure et
          sortaient de la carte à 200 % de zoom. */}
      <p
        aria-hidden="true"
        className="card px-4 py-6 text-center font-rounded text-3xl font-bold break-all tabular-nums tracking-[0.25em] select-all"
      >
        {code}
      </p>
      <span className="sr-only">
        Code d&apos;invitation : {code.split("").join(" ")}
      </span>

      <p className="mt-2 text-sm tabular-nums text-muted">
        {expiresAt ? `${validite(expiresAt, new Date())} ` : ""}
        {usages(usagesRestants)}
      </p>

      {statut}

      {/* La seule action pleine : 95 % des visites ne veulent que ça. */}
      <button
        type="button"
        onClick={copier}
        disabled={enCours}
        className="btn-primaire mt-2 w-full"
      >
        Copier
      </button>

      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={inviter}
          disabled={enCours}
          className="btn-quiet"
        >
          {action === "creer" ? LIBELLE_OCCUPE : "Créer un autre code"}
        </button>

        {/*
          Confirmation en deux temps plutôt qu'une modale : le geste est
          irréversible — personne ne pourra plus s'en servir — et les deux
          boutons étaient auparavant strictement identiques, à 44px l'un de
          l'autre.
        */}
        {confirmeAnnulation ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={annuler}
              disabled={enCours}
              className="btn-quiet"
            >
              {action === "annuler" ? LIBELLE_OCCUPE : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmeAnnulation(false)}
              disabled={enCours}
              className="btn-quiet"
            >
              Non
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmeAnnulation(true)}
            disabled={enCours}
            className="btn-quiet"
          >
            Annuler ce code
          </button>
        )}
      </div>

      {confirmeAnnulation ? (
        <p className="hint mt-2">
          Personne ne pourra plus s&apos;en servir.
        </p>
      ) : null}
    </div>
  );
}
