// functions/api/upload.js
// POST /api/upload — requireSession, validate, and commit an image to
// public/images/ via the GitHub Contents API. The client sends { filename,
// data (base64 data URL or raw base64), contentType }; the server strips an
// optional data:image/...;base64, prefix, sanitizes the filename, prefixes
// it with a timestamp, and returns { url: "/images/<storedName>" }.
import { json, requireSession } from "../_lib/auth.js";
import { uploadImage } from "../_lib/content.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function onRequestPost({ request, env }) {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({ error: "Image upload is not configured on this deployment" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const contentType = typeof body.contentType === "string" ? body.contentType.trim() : "";
  if (!contentType.startsWith("image/")) {
    return json({ error: "Only image uploads are allowed" }, 400);
  }

  let data = typeof body.data === "string" ? body.data.trim() : "";
  if (!data) return json({ error: "No image data provided" }, 400);

  // Defensively strip an optional data:image/...;base64, prefix.
  data = data.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\s+/g, "");

  let byteLength;
  try {
    byteLength = atob(data).length;
  } catch {
    return json({ error: "Invalid base64 image data" }, 400);
  }
  if (byteLength === 0) return json({ error: "No image data provided" }, 400);
  if (byteLength > MAX_BYTES) {
    return json({ error: "Image must be 5MB or smaller" }, 400);
  }

  // Sanitize: strip any path, keep alphanumerics + . - _, lowercase.
  const original = typeof body.filename === "string" ? body.filename : "image.png";
  const sanitized =
    original
      .split(/[\\/]/)
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "") || "image";
  const storedName = `${Date.now()}-${sanitized}`;

  let res;
  try {
    res = await uploadImage(env, storedName, data);
  } catch {
    return json({ error: "Could not reach GitHub — try again shortly" }, 502);
  }

  if (res.status === 201 || res.status === 200) {
    return json({ url: `/images/${storedName}` }, 201);
  }
  return json({ error: "GitHub rejected the upload — try again shortly" }, 502);
}
