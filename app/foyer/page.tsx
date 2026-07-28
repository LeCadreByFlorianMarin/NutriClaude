import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import { nomDuFoyer } from "@/lib/foyer/foyer";
import { invitationEnCours } from "@/lib/foyer/invitation";
import { membresDuFoyer } from "@/lib/foyer/membres";
import { Notice } from "@/app/_lib/Notice";
import { seDeconnecter } from "./actions";
import { DisplayNameForm } from "./DisplayNameForm";
import { InviteCard } from "./InviteCard";

export const metadata = { title: "Ton foyer · NutriClaude" };

/**
 * Écran du foyer : ton prénom, qui est là, comment faire venir quelqu'un, et
 * les appareils quand ils arriveront.
 *
 * ⚠️ Cette page **ne génère jamais de code**. L'émission est une action
 * explicite du membre : une page qui émettrait au rendu créerait un code à
 * chaque rafraîchissement, et la table se remplirait en silence.
 *
 * Trois groupes, pas cinq sections d'égal poids : *toi et ton foyer* →
 * *faire venir quelqu'un* (la seule action, et la seule surface élevée) →
 * le pied de page (appareils, déconnexion), volontairement dégradé.
 */
export default async function FoyerPage({
  searchParams,
}: {
  searchParams: Promise<{ deconnexion?: string }>;
}) {
  const profile = await requireProfile();
  const supabase = await createServerComponentClient();
  const { deconnexion } = await searchParams;

  // Les trois lectures sont indépendantes : les enchaîner les faisait attendre
  // l'une après l'autre. En parallèle, l'écran coûte le temps de la plus lente
  // au lieu de leur somme — ce sont toujours trois allers-retours.
  const [nom, invitation, membres] = await Promise.all([
    nomDuFoyer(supabase, profile.household_id),
    invitationEnCours(supabase),
    membresDuFoyer(supabase),
  ]);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-sm py-6">
        {/* Un message porté par le chargement de la page va en tête : au bas
            d'un écran long, il était hors de vue et jamais annoncé. */}
        {deconnexion === "echec" ? (
          <Notice className="mb-6">
            On n&apos;a pas réussi à te déconnecter. Réessaie dans un instant.
          </Notice>
        ) : null}

        <Link href="/" className="btn-quiet px-0">
          ← Retour
        </Link>

        {/*
          Le titre nomme l'ÉCRAN, pas le foyer : `/` affichait déjà le nom du
          foyer en `<h1>`, si bien que les deux pages portaient le même titre et
          que rien à l'écran ne disait où l'on était.
        */}
        <h1 className="titre-ecran mt-2">Ton foyer</h1>
        <p className="hint mt-1 break-words">{nom ?? "Sans nom"}</p>

        {/* ── Groupe 1 : toi et ton foyer ── */}
        <section className="mt-12">
          <h2 className="titre-section">Ton prénom</h2>
          <div className="mt-2">
            <DisplayNameForm profilId={profile.id} prenom={profile.display_name} />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="titre-section">Qui est là</h2>

          {membres.length <= 1 ? (
            <p className="mt-2 text-base">
              Tu es la seule personne ici pour l&apos;instant. Donne un code à
              quelqu&apos;un, juste en dessous.
            </p>
          ) : (
            <ul className="mt-2">
              {membres.map((membre) => (
                <li
                  key={membre.id}
                  className="flex min-h-11 items-center justify-between gap-3 border-b border-card-border text-base last:border-0"
                >
                  {/* `min-w-0` + `break-all` : `break-words` seul ne réduit pas
                      la contribution min-content d'un flex item, donc un prénom
                      de 40 caractères sans espace poussait « Toi » hors de
                      l'écran et faisait défiler la page horizontalement. */}
                  <span className="min-w-0 break-all">{membre.prenom}</span>
                  {membre.id === profile.id && (
                    <span className="hint shrink-0">Toi</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Groupe 2 : l'action de l'écran ── */}
        <section className="mt-12">
          <h2 className="titre-section">Faire venir quelqu&apos;un</h2>
          <p className="mt-2 text-base">
            Donne-lui un code. Il en aura besoin au moment de créer son accès.
          </p>

          <div className="mt-6">
            <InviteCard
              code={invitation?.code ?? null}
              expiresAt={invitation?.expiresAt ?? null}
              usagesRestants={invitation?.usagesRestants ?? 0}
            />
          </div>
        </section>

        {/* ── Groupe 3 : pied de page, dégradé ── */}
        <div className="mt-12 border-t border-card-border pt-6">
          {/*
            Zone d'annonce, et rien de plus : la table des appareils n'existe pas
            encore dans le schéma, elle naîtra avec l'Epic 5. Pas de bouton, pas
            de compteur — une zone qui paraît interactive est une promesse non
            tenue. Pas de `<h2>` non plus : un titre dans le plan de navigation
            pour du contenu inexistant encombre la lecture d'écran.
          */}
          <p className="hint">
            L&apos;écran de la cuisine et les téléphones se rattacheront ici.
            Bientôt.
          </p>

          <section className="mt-6">
            <h2 className="titre-section">Cet appareil</h2>
            {/* L'avertissement AVANT le bouton : « est-ce que je pourrai
                revenir ? » est exactement l'information qui décide du geste, et
                dans une application sans mot de passe elle coûte un aller-retour
                par email. */}
            <p className="hint mt-2">
              Se déconnecter ne ferme que cet appareil. Tu recevras un nouveau
              lien par email pour revenir.
            </p>
            <form action={seDeconnecter} className="mt-3">
              <button type="submit" className="btn">
                Se déconnecter
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
