import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/queries";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect("/menu");
  }
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Bienvenue 👋</h1>
        <p className="text-muted mb-8">
          Configure ton foyer pour commencer. Tu peux en créer un nouveau ou
          rejoindre celui d'un proche avec un code d'invitation.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
