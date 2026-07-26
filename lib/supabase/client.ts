"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase du navigateur. Toutes les lectures et écritures des surfaces
 * liste passent par ici (AD-13), sous le contrôle de la RLS (AD-2).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
