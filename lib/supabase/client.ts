"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabaseEnv } from "./env";

/**
 * Client Supabase du navigateur. Toutes les lectures et écritures des surfaces
 * liste passent par ici (AD-13), sous le contrôle de la RLS (AD-2).
 *
 * Le paramètre `<Database>` n'est pas décoratif : c'est lui qui fait échouer au
 * typage un nom de table, de colonne ou de fonction qui n'existe pas — les types
 * étant générés depuis le schéma déployé, pas écrits à la main.
 */
export function createNavigateurClient() {
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseEnv();
  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  );
}
