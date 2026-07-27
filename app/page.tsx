import Link from "next/link";
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
        <p className="mt-6">
          <Link
            href="/foyer"
            className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Ton foyer
          </Link>
        </p>
      </div>
    </main>
  );
}
