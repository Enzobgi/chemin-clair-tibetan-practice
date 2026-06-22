import { methodNotAllowed, readJson, sendJson } from "./_lib/http.js";

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;
const attempts = new Map();

const SYSTEM_PROMPT = `Tu es l'assistant de soutien de Chemin Clair.
Reponds en francais, avec chaleur, sobriete et phrases courtes.
Tu aides pour une envie forte, une emotion difficile, l'organisation d'une pratique ou un besoin d'ecoute.
Tu ne poses aucun diagnostic, ne remplaces pas un professionnel, un enseignant bouddhiste qualifie ou les urgences.
Pour une envie forte, commence par verifier si la personne est en securite, puis propose une seule action concrete et facile.
Si la personne mentionne surdose, perte de connaissance, difficulte respiratoire, douleur thoracique, convulsions, violence imminente ou idees suicidaires avec danger immediat, interromps le conseil ordinaire et recommande d'appeler immediatement les urgences locales (112 en Belgique et dans l'Union europeenne) ou de demander a une personne presente de le faire.
Ne culpabilise jamais. Un ecart n'efface pas les efforts precedents.
Respecte les traditions tibetaines: ne valide aucune realisation spirituelle et ne donne pas d'instruction reservee ou necessitant une transmission.
Ne produis pas plus de 180 mots. Termine, lorsque cela aide, par une question simple.`;

function clientKey(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function rateLimited(request) {
  const key = clientKey(request);
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((timestamp) => now - timestamp < 60000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > 12;
}

function extractText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

export default async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
  if (rateLimited(request)) return sendJson(response, 429, { error: "Trop de messages rapproches. Prenez une respiration puis reessayez." });
  if (!process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: "Le soutien IA n'est pas encore configure." });

  try {
    const body = readJson(request);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    const safeMessages = messages
      .filter((message) => ["user", "assistant"].includes(message?.role))
      .map((message) => ({
        role: message.role,
        content: String(message.content || "").trim().slice(0, MAX_MESSAGE_LENGTH)
      }))
      .filter((message) => message.content);
    if (!safeMessages.length) return sendJson(response, 400, { error: "Message manquant." });

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: safeMessages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        })),
        generationConfig: {
          maxOutputTokens: 500,
          thinkingConfig: {
            thinkingLevel: "low"
          }
        }
      })
    });
    const payload = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error("Gemini chat error", apiResponse.status, payload?.error?.status || "unknown");
      return sendJson(response, 502, { error: "Le soutien IA est momentanement indisponible." });
    }
    const text = extractText(payload);
    if (!text) return sendJson(response, 502, { error: "Aucune reponse recue." });
    return sendJson(response, 200, { message: text });
  } catch (error) {
    console.error("Chat error", error);
    return sendJson(response, 500, { error: "Le chat est momentanement indisponible." });
  }
}
