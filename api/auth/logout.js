import { clearSession } from "../_lib/auth.js";
import { methodNotAllowed, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  try {
    await clearSession(request, response);
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Deconnexion impossible." });
  }
}
