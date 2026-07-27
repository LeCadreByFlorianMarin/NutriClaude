import { requireProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { DisplayNameForm } from "./DisplayNameForm";
import { InviteCard } from "./InviteCard";
import { invitationEnCours } from "./invitation";
import { membresDuFoyer } from "./membres";

/**
 * Écran du foyer : ton prénom, qui est là, comment faire venir quelqu'un, et
 * les appareils quand ils arriveront.
 *
 * ⚠️ Cette page **ne génère jamais de code**. L'émission est une action
 * explicite du membre : une page qui émettrait au rendu créerait un code à
 * chaque rafraîchissement, et la table se remplirait en silence.
 */
export default async function FoyerPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", profile.household_id)
    .maybeSingle();

  const invitation = await invitationEnCours();
  const membres = await membresDuFoyer();

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-sm py-6">
        <h1 className="text-2xl font-semibold">{household?.name ?? "Ton foyer"}</h1>

        <section className="mt-8">
          <DisplayNameForm profilId={profile.id} prenom={profile.display_name} />
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Qui est là</h2>

          {membres.length <= 1 ? (
            <p className="mt-2 text-base">
              Tu es seul ici pour l&apos;instant. Donne un code à quelqu&apos;un,
              juste en dessous.
            </p>
          ) : (
            <ul className="mt-3">
              {membres.map((membre) => (
                <li
                  key={membre.id}
                  className="flex min-h-11 items-center justify-between border-b border-card-border text-base last:border-0"
                >
                  <span>{membre.prenom}</span>
                  {membre.id === profile.id && (
                    <span className="hint">Toi</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Faire venir quelqu&apos;un</h2>
          <p className="mt-2 text-base">
            Donne-lui un code. Il en aura besoin au moment de créer son accès.
          </p>

          <div className="mt-6">
            <InviteCard
              code={invitation?.code ?? null}
              joursRestants={invitation?.joursRestants ?? 0}
              usagesRestants={invitation?.usagesRestants ?? 0}
            />
          </div>
        </section>

        {/*
          Zone d'annonce, et rien de plus : la table des appareils n'existe pas
          encore dans le schéma, elle naîtra avec l'Epic 5. Pas de bouton, pas de
          compteur — une zone qui paraît interactive est une promesse non tenue.
        */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Les appareils</h2>
          <p className="mt-2 text-base text-muted">
            L&apos;écran de la cuisine et les téléphones se rattacheront ici.
            Bientôt.
          </p>
        </section>
      </div>
    </main>
  );
}
