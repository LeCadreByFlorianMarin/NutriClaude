import { requireProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Accueil. Un membre sans foyer est envoyé s'en créer un ; les autres voient
 * leur foyer nommé.
 *
 * Volontairement minimal : la liste, le menu et les recettes appartiennent aux
 * epics suivants. Il n'y a encore rien à compter.
 */
export default async function HomePage() {
  const profile = await requireProfile();

  const supabase = await createClient();
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", profile.household_id)
    .maybeSingle();

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">
          {household?.name ?? "Chez toi"}
        </h1>
        <p className="mt-3 text-base">Salut {profile.display_name}.</p>
        <p className="mt-6 text-sm opacity-70">
          Ton foyer est prêt. Les courses, les recettes et le menu arrivent.
        </p>
      </div>
    </main>
  );
}
