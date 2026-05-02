import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

const NAV = [
  { href: "/menu", label: "Menu", icon: "📅" },
  { href: "/recipes", label: "Recettes", icon: "🍽️" },
  { href: "/grocery", label: "Liste de courses", icon: "🛒" },
  { href: "/aisles", label: "Rayons", icon: "🗺️" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = createClient();
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", profile.household_id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/menu" className="font-bold text-lg">
              NutriCloud
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md text-sm text-muted hover:text-text hover:bg-surface transition"
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-muted">
              {household?.name ?? "Foyer"} · {profile.display_name}
            </span>
            <SignOutButton />
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden border-t border-border flex items-center justify-around px-2 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center text-xs text-muted hover:text-text transition px-2"
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
