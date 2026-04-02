const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const openAiApiKey = defineSecret("OPENAI_API_KEY");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

function jsonResponse(res, status, body) {
  res.status(status).set("Content-Type", "application/json").send(JSON.stringify(body));
}

function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-Auth");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function verifyFirebaseUser(req) {
  const token = req.get("X-Firebase-Auth");
  if (!token) {
    throw new Error("Missing Firebase auth token");
  }

  return admin.auth().verifyIdToken(token);
}

function buildPrompt(type, goalDescription, context = {}) {
  const contextBlock = JSON.stringify(context, null, 2);

  if (type === "habit-stack") {
    return `
You are an expert planning coach.
Goal: ${goalDescription}
Context: ${contextBlock}

Return JSON only with this exact shape:
{
  "trigger": { "title": string, "description": string },
  "response": { "title": string, "description": string },
  "stacked": { "title": string, "description": string },
  "reward": { "title": string, "description": string }
}
Keep suggestions practical, specific, and realistic for a daily planner app.
`.trim();
  }

  if (type === "habit-list") {
    return `
You are an expert planning coach.
Goal: ${goalDescription}
Context: ${contextBlock}

Return JSON only with this exact shape:
{
  "suggestions": ["...", "...", "...", "...", "..."]
}
Provide 5 specific next-step suggestions that help the user progress toward the goal.
`.trim();
  }

  return `
You are an expert planning coach.
Goal: ${goalDescription}
Context: ${contextBlock}

Return JSON only with this exact shape:
{
  "title": string,
  "reason": string,
  "suggestedDuration": string,
  "confidence": number
}

Choose the single best next action for the user right now.
Keep the title short and actionable.
Keep confidence between 0 and 1.
`.trim();
}

async function callOpenAI(type, goalDescription, context) {
  const apiKey = openAiApiKey.value();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const prompt = buildPrompt(type, goalDescription, context);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a helpful AI coach inside a mobile planner app. Always respond with valid JSON only."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const outputText = data.output_text;

  if (!outputText) {
    throw new Error("OpenAI response did not include output_text");
  }

  return JSON.parse(outputText);
}

exports.aiCoach = onRequest({ cors: false, invoker: "public", secrets: [openAiApiKey] }, async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const decodedToken = await verifyFirebaseUser(req);
    const { type, goalDescription, context } = req.body || {};

    if (!type || !goalDescription) {
      jsonResponse(res, 400, { error: "type and goalDescription are required" });
      return;
    }

    const result = await callOpenAI(type, goalDescription, {
      ...(context || {}),
      userId: decodedToken.uid
    });

    jsonResponse(res, 200, result);
  } catch (error) {
    logger.error("AI coach request failed", error);
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});
