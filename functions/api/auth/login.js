// functions/api/auth/login.js
// POST /api/auth/login — { email, password } → sets session cookie on success.
// Two roles:
//   admin  — ADMIN_EMAIL / ADMIN_PASSWORD  (full permissions)
//   editor — EDITOR_EMAIL / EDITOR_PASSWORD (create/edit/save; cannot ready,
//            publish, or view site-wide analytics)
import { json, safeEqual, sessionCookie, sign } from "../../_lib/auth.js";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid credentials" }, 401);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const adminEmail = typeof env.ADMIN_EMAIL === "string" ? env.ADMIN_EMAIL.trim().toLowerCase() : "";
  const editorEmail = typeof env.EDITOR_EMAIL === "string" ? env.EDITOR_EMAIL.trim().toLowerCase() : "";

  let role = null;
  if (adminEmail && (await safeEqual(email, adminEmail, env.AUTH_SECRET))) {
    role = await safeEqual(password, env.ADMIN_PASSWORD, env.AUTH_SECRET) ? "admin" : null;
  } else if (editorEmail && (await safeEqual(email, editorEmail, env.AUTH_SECRET))) {
    role = await safeEqual(password, env.EDITOR_PASSWORD, env.AUTH_SECRET) ? "editor" : null;
  }

  if (!role) {
    // Uniform ~500ms delay on failure to blunt credential brute-forcing.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return json({ error: "Invalid credentials" }, 401);
  }

  const token = await sign(
    { sub: email, role, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS },
    env.AUTH_SECRET
  );

  return new Response(JSON.stringify({ email: env[role === "admin" ? "ADMIN_EMAIL" : "EDITOR_EMAIL"], role }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookie(token),
    },
  });
}
