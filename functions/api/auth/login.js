// functions/api/auth/login.js
// POST /api/auth/login — { email, password } → sets session cookie on success.
import { json, safeEqual, sessionCookie, sign } from "../../_lib/auth.js";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid credentials" }, 401);
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Constant-time comparison of BOTH email and password (never plain ===).
  const emailOk = await safeEqual(email, env.ADMIN_EMAIL, env.AUTH_SECRET);
  const passwordOk = await safeEqual(password, env.ADMIN_PASSWORD, env.AUTH_SECRET);

  if (!emailOk || !passwordOk) {
    // Uniform ~500ms delay on failure to blunt credential brute-forcing.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return json({ error: "Invalid credentials" }, 401);
  }

  const token = await sign(
    { sub: "admin", exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS },
    env.AUTH_SECRET
  );

  return new Response(JSON.stringify({ email: env.ADMIN_EMAIL }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookie(token),
    },
  });
}
