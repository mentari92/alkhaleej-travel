import type { APIRoute } from "astro";
import { revokeSession } from "../../../lib/auth/session";
import { getDB } from "../../../lib/db/connection";

export const POST: APIRoute = async ({ cookies }) => {
  const db = getDB();

  const sessionId = cookies.get("session_id")?.value;

  // Revoke session if it exists
  if (sessionId) {
    await revokeSession(db, sessionId);
  }

  // Clear the session cookie regardless
  cookies.delete("session_id", {
    path: "/",
  });

  return new Response(
    JSON.stringify({
      success: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
