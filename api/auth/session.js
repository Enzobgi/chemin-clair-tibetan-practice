import { getCurrentUser } from "../_lib/auth.js";
import { methodNotAllowed, publicUser, sendJson } from "../_lib/http.js";

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  try {
    const user = await getCurrentUser(request);
    return sendJson(response, 200, { user: user ? publicUser(user) : null });
  } catch (error) {
    console.error(error);
    return sendJson(response, 200, { user: null, unavailable: true });
  }
}
