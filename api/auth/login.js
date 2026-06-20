import { createSession, verifyPassword } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { methodNotAllowed, normalizeEmail, publicUser, readJson, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  try {
    const body = readJson(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, name, password_salt, password_hash
      FROM cc_users
      WHERE email = ${email}
      LIMIT 1
    `;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
      return sendJson(response, 401, { error: "Adresse e-mail ou mot de passe incorrect." });
    }
    await createSession(response, user.id);
    return sendJson(response, 200, { user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Connexion impossible pour le moment." });
  }
}
