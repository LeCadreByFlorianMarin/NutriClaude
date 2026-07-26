import { redirect } from "next/navigation";
import { getMembership } from "@/lib/supabase/queries";
import { CreateHouseholdForm } from "./CreateHouseholdForm";

/**
 * Inscription au foyer. Route **protégée** — elle n'a de sens que connecté, et
 * n'a rien à faire dans les routes publiques du proxy.
 *
 * Un membre qui a déjà un foyer n'a rien à faire ici : il repart à l'accueil.
 * C'est la moitié « aucun nouvel appel de création » de l'AC3.
 */
export default async function OnboardingPage() {
  const { signedIn, profile } = await getMembership();
  if (!signedIn) redirect("/login");
  if (profile) redirect("/");

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <CreateHouseholdForm />
    </main>
  );
}
