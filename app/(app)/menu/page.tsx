import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/supabase/queries";
import type { MealPlanEntry, Recipe } from "@/lib/supabase/types";
import {
  toISO,
  fromISO,
  startOfWeekMonday,
  weekDates,
  addDays,
  dayShortLabel,
  dateShortLabel,
  dateLongLabel,
} from "@/lib/dates";
import MealCell from "./MealCell";

export const dynamic = "force-dynamic";

const MEAL_TYPES = [
  { type: "breakfast" as const, label: "Petit-déj", icon: "🥐" },
  { type: "lunch" as const, label: "Déjeuner", icon: "🍽️" },
  { type: "dinner" as const, label: "Dîner", icon: "🌙" },
];

export default async function MenuPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  await requireProfile();
  const supabase = createClient();

  const today = new Date();
  const start = searchParams.week
    ? startOfWeekMonday(fromISO(searchParams.week))
    : startOfWeekMonday(today);
  const end = addDays(start, 6);

  const days = weekDates(start);
  const startISO = toISO(start);
  const endISO = toISO(end);

  const [entriesRes, recipesRes] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select("*, recipes(id, title, servings)")
      .gte("meal_date", startISO)
      .lte("meal_date", endISO),
    supabase
      .from("recipes")
      .select("id, title, servings")
      .order("title"),
  ]);

  type EntryWithRecipe = MealPlanEntry & {
    recipes: Pick<Recipe, "id" | "title" | "servings"> | null;
  };
  const entries = (entriesRes.data ?? []) as EntryWithRecipe[];
  const recipes = (recipesRes.data ?? []) as Pick<
    Recipe,
    "id" | "title" | "servings"
  >[];

  const byKey = new Map<string, EntryWithRecipe[]>();
  for (const e of entries) {
    const k = `${e.meal_date}|${e.meal_type}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  }

  const prevWeek = toISO(addDays(start, -7));
  const nextWeek = toISO(addDays(start, 7));
  const thisWeek = toISO(startOfWeekMonday(today));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Menu de la semaine</h1>
          <p className="text-muted text-sm">
            {dateLongLabel(start)} → {dateLongLabel(end)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/menu?week=${prevWeek}`} className="btn-secondary">
            ← Sem. préc.
          </Link>
          <Link href={`/menu?week=${thisWeek}`} className="btn-ghost">
            Aujourd'hui
          </Link>
          <Link href={`/menu?week=${nextWeek}`} className="btn-secondary">
            Sem. suiv. →
          </Link>
          <Link
            href={`/grocery?week=${startISO}`}
            className="btn-primary ml-3"
          >
            🛒 Liste de courses
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto -mx-4 px-4">
        <div className="grid grid-cols-[100px_repeat(7,minmax(140px,1fr))] gap-2 min-w-[900px]">
          {/* Header row */}
          <div />
          {days.map((d) => {
            const isToday = toISO(d) === toISO(today);
            return (
              <div
                key={toISO(d)}
                className={`text-center py-2 rounded-md ${
                  isToday ? "bg-accent/10 text-accent-light" : "text-muted"
                }`}
              >
                <div className="text-xs uppercase tracking-wide">
                  {dayShortLabel(d)}
                </div>
                <div className="font-semibold text-text">
                  {dateShortLabel(d)}
                </div>
              </div>
            );
          })}

          {/* Meal rows */}
          {MEAL_TYPES.map(({ type, label, icon }) => (
            <>
              <div
                key={`label-${type}`}
                className="flex items-center gap-2 px-3 py-3 text-sm text-muted"
              >
                <span>{icon}</span>
                {label}
              </div>
              {days.map((d) => {
                const k = `${toISO(d)}|${type}`;
                const cellEntries = byKey.get(k) ?? [];
                return (
                  <MealCell
                    key={k}
                    date={toISO(d)}
                    mealType={type}
                    entries={cellEntries}
                    recipes={recipes}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
