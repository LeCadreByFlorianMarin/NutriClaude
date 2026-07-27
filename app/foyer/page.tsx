import { requireProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { InviteCard } from "./InviteCard";
import { invitationEnCours } from "./invitation";

/**
 * Écran du foyer. Pour l'instant, il ne porte que l'invitation ; la Story 1.6
 * y ajoutera le prénom modifiable et la liste des membres, sur cette même route.
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

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">{household?.name ?? "Ton foyer"}</h1>
        <p className="mt-2 text-base">
          Pour que quelqu&apos;un te rejoigne, donne-lui un code. Il en aura besoin
          au moment de créer son accès.
        </p>

        <div className="mt-8">
          <InviteCard
            code={invitation?.code ?? null}
            joursRestants={invitation?.joursRestants ?? 0}
            usagesRestants={invitation?.usagesRestants ?? 0}
          />
        </div>
      </div>
    </main>
  );
}
