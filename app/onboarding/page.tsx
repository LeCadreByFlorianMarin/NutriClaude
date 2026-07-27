import { redirect } from "next/navigation";
import { getMembership } from "@/lib/supabase/queries";
import { OnboardingChoice } from "./OnboardingChoice";

/**
 * Inscription au foyer. Route **protégée** — elle n'a de sens que connecté, et
 * n'a rien à faire dans les routes publiques du proxy.
 *
 * Un membre qui a déjà un foyer n'a rien à faire ici : il repart à l'accueil.
 * C'est la moitié « aucun nouvel appel de création » de l'AC3 de la Story 1.3,
 * et c'est aussi ce qui empêche un membre de racheter une invitation.
 */
export default async function OnboardingPage() {
  const { signedIn, profile } = await getMembership();
  if (!signedIn) redirect("/login");
  if (profile) redirect("/");

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <OnboardingChoice />
    </main>
  );
}
