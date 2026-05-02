"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // If email confirmation is OFF, session is set immediately → onboarding.
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }
    // Otherwise wait for the magic link.
    setInfo(
      "Vérifie ta boîte mail : un lien de confirmation t'attend pour activer ton compte."
    );
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-2">Créer un compte</h1>
        <p className="text-muted mb-8">
          Une fois inscrit, tu pourras créer ou rejoindre un foyer.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Mot de passe (min. 6 caractères)
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-red text-sm">{error}</p>}
          {info && <p className="text-green text-sm">{info}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className="text-sm text-muted mt-6 text-center">
          Déjà inscrit ?{" "}
          <Link href="/login" className="text-accent-light hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
