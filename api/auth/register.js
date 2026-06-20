import { createSession, hashPassword, newUserId } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { methodNotAllowed, normalizeEmail, publicUser, readJson, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  try {
    const body = readJson(request);
    const email = normalizeEmail(body.email);
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!email || !email.includes("@") || !name || password.length < 8) {
      return sendJson(response, 400, { error: "Nom, e-mail valide et mot de passe de 8 caracteres minimum requis." });
    }

    await ensureSchema();
    const sql = getSql();
    const existing = await sql`SELECT id FROM cc_users WHERE email = ${email} LIMIT 1`;
    if (existing.length) return sendJson(response, 409, { error: "Un compte existe deja avec cette adresse." });

    const id = newUserId();
    const passwordData = await hashPassword(password);
    const rows = await sql`
      INSERT INTO cc_users (id, email, name, password_salt, password_hash)
      VALUES (${id}, ${email}, ${name}, ${passwordData.salt}, ${passwordData.hash})
      RETURNING id, email, name
    `;
    await createSession(response, id);
    return sendJson(response, 201, { user: publicUser(rows[0]) });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Impossible de creer le compte pour le moment." });
  }
}
