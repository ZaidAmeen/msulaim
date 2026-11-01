import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAllowed } from "./access-middleware";

/**
 * Called right after sign-in/sign-up from the auth page. Throws
 * "Access Restricted…" when the signed-in email is not on the allowlist,
 * so the caller can sign the user back out.
 */
export const checkAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireAllowed])
  .handler(async ({ context }) => {
    const ctx = context as { userId: string; claims?: { email?: string } };
    return { userId: ctx.userId, email: ctx.claims?.email ?? "" };
  });
