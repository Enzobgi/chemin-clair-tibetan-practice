import { clearSession, getCurrentUser, verifyPassword } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { methodNotAllowed, readJson, sendJson } from "./_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "DELETE") return methodNotAllowed(response, ["DELETE"]);
  try {
    const user = await getCurrentUser(request);
    if (!user) return sendJson(response, 401, { error: "Authentification requise." });

    const password = String(readJson(request).password || "");
    if (!password) return sendJson(response, 400, { error: "Le mot de passe actuel est requis." });

    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT password_salt, password_hash
      FROM cc_users
      WHERE id = ${user.id}
      LIMIT 1
    `;
    const credentials = rows[0];
    if (!credentials || !(await verifyPassword(password, credentials.password_salt, credentials.password_hash))) {
      return sendJson(response, 401, { error: "Mot de passe incorrect." });
    }

    await sql`DELETE FROM cc_users WHERE id = ${user.id}`;
    await clearSession(request, response);
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Suppression du compte impossible pour le moment." });
  }
}
