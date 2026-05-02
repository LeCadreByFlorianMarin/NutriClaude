import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";
import type { Aisle, ProductAisleMap } from "@/lib/supabase/types";
import AisleRow from "./AisleRow";
import NewAisleForm from "./NewAisleForm";
import KeywordMappings from "./KeywordMappings";

export const dynamic = "force-dynamic";

export default async function AislesPage() {
  await requireProfile();
  const supabase = createClient();

  const [aislesRes, mappingsRes] = await Promise.all([
    supabase.from("aisles").select("*").order("sort_order"),
    supabase
      .from("product_aisle_map")
      .select("*")
      .not("keyword", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const aisles = (aislesRes.data ?? []) as Aisle[];
  const mappings = (mappingsRes.data ?? []) as ProductAisleMap[];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold mb-1">Rayons</h1>
        <p className="text-muted text-sm">
          Configure tes rayons dans l'ordre où tu les croises en magasin. Les
          mots-clés associent automatiquement les ingrédients à un rayon
          (ex. <em>poulet</em> → Boucherie).
        </p>
      </header>

      <section className="card">
        <h2 className="font-semibold mb-4">
          Tes rayons{" "}
          <span className="text-muted text-sm font-normal">
            ({aisles.length})
          </span>
        </h2>

        <div className="hidden sm:grid grid-cols-[60px_60px_1fr_120px] gap-3 text-xs text-muted px-2 mb-2">
          <span>Ordre</span>
          <span>Icône</span>
          <span>Nom</span>
          <span></span>
        </div>

        <ul className="space-y-2">
          {aisles.map((a) => (
            <AisleRow key={a.id} aisle={a} />
          ))}
        </ul>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="font-medium mb-3 text-sm">Ajouter un rayon</h3>
          <NewAisleForm />
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-1">Mots-clés → Rayon</h2>
        <p className="text-sm text-muted mb-4">
          Quand tu génères ta liste de courses, chaque ingrédient cherche un
          mot-clé qui correspond à son nom. Le plus long mot-clé gagne.
        </p>
        <KeywordMappings aisles={aisles} mappings={mappings} />
      </section>
    </div>
  );
}
