import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";
import type {
  Aisle,
  GroceryListItem,
  GroceryListByAisleRow,
} from "@/lib/supabase/types";
import {
  toISO,
  fromISO,
  startOfWeekMonday,
  addDays,
  dateLongLabel,
} from "@/lib/dates";
import GenerateBar from "./GenerateBar";
import GroceryGroup from "./GroceryGroup";
import AdHocForm from "./AdHocForm";

export const dynamic = "force-dynamic";

export default async function GroceryPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  await requireProfile();
  const supabase = createClient();

  const start = searchParams.week
    ? startOfWeekMonday(fromISO(searchParams.week))
    : startOfWeekMonday(new Date());
  const end = addDays(start, 6);

  const [pendingRes, boughtRes, aislesRes] = await Promise.all([
    supabase
      .from("grocery_list_by_aisle")
      .select("*")
      .order("aisle_sort", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase
      .from("grocery_list_items")
      .select("*")
      .eq("status", "bought")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("aisles").select("*").order("sort_order"),
  ]);

  const pendingItems = (pendingRes.data ?? []) as GroceryListByAisleRow[];
  const boughtItems = (boughtRes.data ?? []) as GroceryListItem[];
  const aisles = (aislesRes.data ?? []) as Aisle[];

  // Group pending by aisle
  type Group = {
    key: string;
    name: string;
    icon: string | null;
    sort: number;
    items: GroceryListByAisleRow[];
  };
  const groups = new Map<string, Group>();
  for (const it of pendingItems) {
    const key = it.aisle_id ?? "__unsorted__";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: it.aisle_name ?? "À classer",
        icon: it.aisle_icon ?? "❓",
        sort: it.aisle_sort ?? 9999,
        items: [],
      });
    }
    groups.get(key)!.items.push(it);
  }
  const orderedGroups = Array.from(groups.values()).sort(
    (a, b) => a.sort - b.sort
  );

  const totalPending = pendingItems.length;
  const totalBought = boughtItems.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Liste de courses</h1>
          <p className="text-muted text-sm">
            {totalPending} article{totalPending > 1 ? "s" : ""} à acheter ·{" "}
            {totalBought} acheté{totalBought > 1 ? "s" : ""}
          </p>
        </div>
      </header>

      <section className="card">
        <h2 className="font-semibold mb-1">Générer depuis le menu</h2>
        <p className="text-sm text-muted mb-3">
          Semaine du <strong>{dateLongLabel(start)}</strong> au{" "}
          <strong>{dateLongLabel(end)}</strong>. La génération remplace les
          articles "à acheter" actuels.
        </p>
        <GenerateBar startISO={toISO(start)} endISO={toISO(end)} />
      </section>

      {orderedGroups.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-muted">
            Ta liste est vide. Génère-la depuis ton menu de la semaine, ou
            ajoute manuellement un article ci-dessous.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orderedGroups.map((g) => (
            <GroceryGroup key={g.key} group={g} />
          ))}
        </ul>
      )}

      <section className="card">
        <h2 className="font-semibold mb-3">Ajouter un article</h2>
        <AdHocForm aisles={aisles} />
      </section>

      {boughtItems.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Achetés ({boughtItems.length})
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            {boughtItems.map((it) => (
              <li key={it.id} className="line-through">
                {it.quantity ? `${it.quantity} ${it.unit ?? ""} ` : ""}
                {it.name}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
