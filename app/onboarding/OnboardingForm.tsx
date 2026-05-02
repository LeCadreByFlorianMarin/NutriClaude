"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "create" | "join";

export default function OnboardingForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === "create") {
      const { error } = await supabase.rpc("create_household_with_profile", {
        p_household_name: householdName,
        p_display_name: displayName,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.rpc("redeem_household_invite", {
        p_code: inviteCode.trim().toUpperCase(),
        p_display_name: displayName,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.replace("/menu");
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-surface border border-border rounded-lg">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`py-2 px-3 rounded-md text-sm font-medium transition ${
            mode === "create"
              ? "bg-accent text-white"
              : "text-muted hover:text-text"
          }`}
        >
          Créer un foyer
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`py-2 px-3 rounded-md text-sm font-medium transition ${
            mode === "join"
              ? "bg-accent text-white"
              : "text-muted hover:text-text"
          }`}
        >
          Rejoindre un foyer
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="display">
            Ton prénom (visible par le foyer)
          </label>
          <input
            id="display"
            required
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Florian"
          />
        </div>

        {mode === "create" ? (
          <div>
            <label className="label" htmlFor="hh">
              Nom du foyer
            </label>
            <input
              id="hh"
              required
              className="input"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Famille Marin"
            />
            <p className="text-xs text-muted mt-2">
              On te crée 11 rayons par défaut (Fruits & Légumes, Boucherie…) que
              tu pourras réorganiser ensuite selon ton parcours en magasin.
            </p>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="code">
              Code d'invitation
            </label>
            <input
              id="code"
              required
              className="input font-mono uppercase tracking-widest"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="A1B2C3D4"
              maxLength={8}
            />
          </div>
        )}

        {error && <p className="text-red text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? "…"
            : mode === "create"
              ? "Créer mon foyer"
              : "Rejoindre"}
        </button>
      </form>
    </div>
  );
}
