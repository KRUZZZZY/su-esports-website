// functions/api/auth/me.js
// GET /api/auth/me — 200 { email } when the session cookie is valid, else 401.
import { json, requireSession } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  return json({ email: env.ADMIN_EMAIL });
}
