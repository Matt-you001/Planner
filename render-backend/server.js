const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

function getFirebaseCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  return admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: getFirebaseCredential(),
  });
}

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "planapp-ai-backend",
    endpoints: ["/health", "/ai-coach"]
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function verifyFirebaseUser(req) {
  const token = req.get("X-Firebase-Auth");
  if (!token) {
    return null;
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
Keep suggestions specific, realistic, and useful in a mobile planner app.
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
Provide exactly 5 practical suggestions.
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
Confidence must be between 0 and 1.
`.trim();
}

async function callOpenAI(type, goalDescription, context) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const prompt = buildPrompt(type, goalDescription, context);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a helpful AI coach inside a planner app. Return valid JSON only."
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

  if (!data.output_text) {
    throw new Error("OpenAI response did not include output_text.");
  }

  return JSON.parse(data.output_text);
}

async function handleAiCoach(req, res) {
  try {
    const decodedUser = await verifyFirebaseUser(req);
    const { type, goalDescription, context } = req.body || {};

    if (!type || !goalDescription) {
      return res.status(400).json({ error: "type and goalDescription are required." });
    }

    const result = await callOpenAI(type, goalDescription, {
      ...(context || {}),
      userId: decodedUser?.uid || "anonymous"
    });

    res.json(result);
  } catch (error) {
    console.error("AI coach request failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
}

app.post("/", handleAiCoach);
app.post("/ai-coach", handleAiCoach);

app.listen(port, () => {
  console.log(`Planner Render backend listening on port ${port}`);
});
