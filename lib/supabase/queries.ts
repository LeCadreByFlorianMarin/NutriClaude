import { createClient } from "./server";
import type { Profile } from "./types";

/**
 * Returns the current user's profile (with household_id), or null if either
 * not signed in or onboarding not finished. Use this in server components
 * to gate UI on a complete profile.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getCurrentProfile error:", error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

/** Throws redirect-style if profile is missing — caller handles the redirect. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new Error("PROFILE_REQUIRED");
  }
  return profile;
}
