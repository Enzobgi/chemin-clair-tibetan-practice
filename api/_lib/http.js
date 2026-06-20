export function sendJson(response, status, body) {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function methodNotAllowed(response, methods) {
  response.setHeader("Allow", methods.join(", "));
  sendJson(response, 405, { error: "Methode non autorisee." });
}

export function readJson(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") return JSON.parse(request.body);
  return request.body;
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name };
}
