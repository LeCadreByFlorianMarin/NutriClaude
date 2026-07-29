import Link from "next/link";
import { lienDeConfirmation } from "@/lib/auth/bascule";
import { createServerComponentClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { EcranMessage } from "@/app/_lib/EcranMessage";

export const metadata = { title: "Changer de compte · NutriClaude" };

/**
 * Confirmation avant de changer de compte sur un appareil déjà connecté.
 *
 * Le produit vit sur des appareils partagés : la tablette de la cuisine est
 * ouverte au nom d'un membre, et l'autre y ouvre son propre lien de connexion.
 * Sans cet écran, `verifyOtp` écrasait la session en place sans confirmation ni
 * trace — on ne s'en apercevait qu'en voyant le mauvais prénom à l'écran.
 *
 * Route **publique mais pas écran d'entrée** : elle doit rester joignable
 * précisément parce qu'une session est ouverte, alors que `/login` renvoie un
 * membre connecté vers l'accueil. C'est la distinction que `PUBLIC_ROUTES` et
 * `AUTH_ENTRY_ROUTES` portent séparément dans le proxy.
 *
 * ⚠️ **Le jeton n'est pas encore consommé en arrivant ici.** `/auth/callback`
 * nous a renvoyés avant d'appeler `verifyOtp` : c'est le lien de confirmation
 * qui le brûlera. Un jeton dépensé par une simple demande de confirmation serait
 * pire que le défaut corrigé.
 */
export default async function BasculePage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const confirmation = lienDeConfirmation(params);

  if (!confirmation) {
    return (
      <EcranMessage
        titre="Ce lien n'est plus bon."
        action={
          <Link href="/login" className="btn-primaire w-full">
            Retour à la connexion
          </Link>
        }
      >
        Demande-t&apos;en un nouveau.
      </EcranMessage>
    );
  }

  /*
   * Le PRÉNOM, pas l'adresse email.
   *
   * L'écran affichait `user.email` : du jargon là où l'application connaît le
   * `display_name` (NFR-9), et une divulgation — l'adresse du membre connecté
   * s'affichait à quiconque tenait un lien magique. En cas d'échec de lecture on
   * retombe sur la phrase générique, jamais sur l'email.
   */
  let prenomEnPlace: string | null = null;
  try {
    const etat = await getMembership(await createServerComponentClient());
    if (etat.etat === "membre") prenomEnPlace = etat.profile.display_name;
  } catch {
    // Sans importance : la formulation générique dit la même chose.
  }

  return (
    <EcranMessage
      titre="Quelqu'un est déjà connecté ici"
      action={
        /*
         * La SORTIE SÛRE est l'action principale.
         *
         * L'écran existe pour empêcher un écrasement silencieux ; en faire de
         * l'écrasement le bouton plein poussait précisément vers ce qu'il est
         * censé prévenir.
         */
        <Link href="/" className="btn-primaire w-full">
          {/*
           * « laisser X ici », et non « laisser X connecté » : le libellé
           * s'accorde avec une personne dont le produit ne connaît que le
           * prénom. « Laisser Marie connecté » se lit sur un foyer de deux.
           */}
          {prenomEnPlace
            ? `Non, laisser ${prenomEnPlace} ici`
            : "Non, ne pas changer de compte"}
        </Link>
      }
      secondaire={
        /* Une ancre nue, et surtout pas un `<Link>` : Next préchargerait la
           cible au survol, et ce préchargement consommerait le jeton à usage
           unique avant même le clic. */
        <a href={`/auth/callback${confirmation}`} className="btn-quiet">
          Oui, c&apos;est moi — me connecter
        </a>
      }
    >
      {prenomEnPlace ? (
        <>
          Cet appareil est ouvert au nom de <strong>{prenomEnPlace}</strong>. Te
          connecter prendra sa place.
        </>
      ) : (
        <>
          Cet appareil est déjà ouvert sur un autre compte. Te connecter prendra
          sa place.
        </>
      )}
      {/* Sans cette ligne, choisir de ne pas basculer donnait l'impression
          d'abandonner sa connexion : le lien disparaît de l'écran, et rien ne
          disait qu'il reste valable. */}
      <span className="hint mt-3 block">
        Ton lien reste valable : tu pourras le rouvrir depuis ton email.
      </span>
    </EcranMessage>
  );
}
