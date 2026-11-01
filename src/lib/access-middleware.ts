import { createMiddleware } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Chain after requireSupabaseAuth. Rejects any signed-in user whose email is
 * not on the invite allowlist (public.is_allowed reads the JWT email).
 */
export const requireAllowed = createMiddleware({ type: "function" }).server(
  async ({ context, next }) => {
    const supabase = (context as { supabase?: SupabaseClient } | undefined)?.supabase;
    if (!supabase) throw new Error("Unauthorized: No session");
    const { data, error } = await supabase.rpc("is_allowed");
    if (error || !data) {
      throw new Error("Access Restricted: You are not authorized to access this system.");
    }
    return next();
  },
);
