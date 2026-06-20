import { getCurrentUser } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { methodNotAllowed, readJson, sendJson } from "./_lib/http.js";

export default async function handler(request, response) {
  if (!["GET", "PUT"].includes(request.method)) return methodNotAllowed(response, ["GET", "PUT"]);
  try {
    const user = await getCurrentUser(request);
    if (!user) return sendJson(response, 401, { error: "Authentification requise." });
    await ensureSchema();
    const sql = getSql();

    if (request.method === "GET") {
      const rows = await sql`
        SELECT data, revision, updated_at
        FROM cc_user_state
        WHERE user_id = ${user.id}
        LIMIT 1
      `;
      return sendJson(response, 200, rows[0] || { data: null, revision: 0, updated_at: null });
    }

    const body = readJson(request);
    if (!body.data || typeof body.data !== "object") {
      return sendJson(response, 400, { error: "Donnees invalides." });
    }
    const data = JSON.stringify(body.data);
    const expectedRevision = Number(body.expectedRevision || 0);
    const force = body.force === true;
    const currentRows = await sql`
      SELECT data, revision, updated_at
      FROM cc_user_state
      WHERE user_id = ${user.id}
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!force && current && Number(current.revision) !== expectedRevision) {
      return sendJson(response, 409, current);
    }
    if (!force && !current && expectedRevision !== 0) {
      return sendJson(response, 409, { data: null, revision: 0, updated_at: null });
    }
    const rows = current
      ? await sql`
          UPDATE cc_user_state
          SET data = ${data}::jsonb, revision = revision + 1, updated_at = NOW()
          WHERE user_id = ${user.id}
          RETURNING revision, updated_at
        `
      : await sql`
          INSERT INTO cc_user_state (user_id, data, revision, updated_at)
          VALUES (${user.id}, ${data}::jsonb, 1, NOW())
          RETURNING revision, updated_at
        `;
    return sendJson(response, 200, rows[0]);
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Synchronisation impossible pour le moment." });
  }
}
