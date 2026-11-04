import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const isSupabaseConfigured = () => {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://placeholder.supabase.co" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "placeholder-anon-key"
  );
};

const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|AuthRetryableFetchError/i;

/** True when an auth error came from a dropped/unstable connection rather than bad credentials. */
export const isNetworkAuthError = (err: any): boolean => {
  if (!err) return false;
  const text = `${err?.name || ""} ${err?.message || ""} ${err?.status === 0 ? "status0" : ""}`;
  return NETWORK_ERROR_PATTERN.test(text) || err?.status === 0;
};

/** Converts low-level auth/network errors into short, human-readable messages. */
export const friendlyAuthError = (err: any, fallback = "Something went wrong. Please try again."): string => {
  if (!err) return fallback;
  if (isNetworkAuthError(err)) {
    return "Can't reach the sign-in service. Check your internet connection and try again.";
  }
  return err?.message || fallback;
};

/**
 * Runs a Supabase auth call and retries up to `retries` times when the failure is a
 * transient network error (e.g. "Failed to fetch"). Credential errors are returned immediately.
 */
export async function withAuthRetry<T extends { error: any }>(
  call: () => Promise<T>,
  retries = 2
): Promise<T> {
  let last: T | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      last = await call();
      if (!last?.error || !isNetworkAuthError(last.error)) return last;
    } catch (err: any) {
      if (!isNetworkAuthError(err) || attempt === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  return last as T;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
