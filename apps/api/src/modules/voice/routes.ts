import { z } from "zod";
import crypto from "crypto";
import type { AppInstance } from "../../types.js";
import { transcribe } from "../capture/transcribe.js";
import { speak } from "./tts.js";
import { generateJson } from "../../lib/gemini.js";
import { env } from "../../env.js";
import { db } from "../../db/client.js";
import { citizens, voiceTurns } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";
import { getStatus, getTeam, getCluster, listMyOpen, getEta, canEscalate, escalateTicket } from "./tools.js";
import { requireCitizenAuth } from "../auth/middleware.js";

const IntentSchema = z.object({
  intent: z.enum(["STATUS", "HOW_LONG", "WHEN_FIXED", "WHO_COMING", "NEARBY", "WHICH_COMPLAINT", "ESCALATE", "CONFIRM_ESCALATE", "ADD_INFO", "OUT_OF_SCOPE", "UNCLEAR"]),
  publicCode: z.string().optional().describe("If the user specified a complaint ID, extract it"),
  index: z.number().optional().describe("If the user referred to the 1st, 2nd complaint etc., 0-indexed")
});

const TemplateSchema = z.object({
  answer: z.string().describe("The generated answer to the citizen in the same language as their query")
});

const ValidatorSchema = z.object({
  has_hallucinations: z.boolean(),
  extracted_numbers_and_times: z.array(z.string()),
  unsupported_claims: z.array(z.string())
});

function parseMultipartAudio(
  body: Buffer,
  contentType: string,
): { data: Buffer; mimeType: string } | null {
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/i);
  if (!boundaryMatch) return null;
  const boundary = "--" + (boundaryMatch[1] ?? "").replace(/^"(.*)"$/, "$1");

  const bodyStr = body.toString("binary");
  const parts = bodyStr.split(boundary);

  for (const part of parts) {
    if (!part || part === "--\r\n" || part.trim() === "--") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd);
    const dataStr = part.slice(headerEnd + 4).replace(/\r\n$/, "");

    const mimeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    if (!mimeMatch) continue;

    const mimeType = (mimeMatch[1] ?? "").trim();
    if (!mimeType.startsWith("audio/")) continue;

    const data = Buffer.from(dataStr, "binary");
    return { data, mimeType };
  }
  return null;
}

export function registerVoiceRoutes(app: AppInstance) {
  app.post(
    "/voice/ask",
    {
      preValidation: [requireCitizenAuth],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
    },
    async (req, reply) => {
      const citizenId = req.citizen!.id;
      
      const contentType = req.headers["content-type"] ?? "";
      let audioBuffer: Buffer;
      let mime: string;

      if (contentType.includes("multipart/form-data")) {
        const rawBody = await req.body as Buffer | undefined;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          return reply.status(400).send({ error: "Expected multipart/form-data with audio" });
        }
        const parsed = parseMultipartAudio(rawBody, contentType);
        if (!parsed) {
          return reply.status(400).send({ error: "Could not parse audio" });
        }
        audioBuffer = parsed.data;
        mime = parsed.mimeType;
      } else if (contentType.includes("audio/")) {
        const rawBody = req.body as Buffer | undefined;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          return reply.status(400).send({ error: "Expected raw audio buffer" });
        }
        audioBuffer = rawBody;
        mime = contentType;
      } else {
        return reply.status(400).send({ error: "Unsupported Content-Type" });
      }

      const start = performance.now();
      
      // 1. Transcribe
      const transcriptRes = await transcribe(audioBuffer, mime, citizenId);
      const { text, lang } = transcriptRes;

      // 2. Fetch context (open tickets)
      const openTickets = await listMyOpen(citizenId);
      
      const lastTurnRes = await db.select().from(voiceTurns)
        .where(eq(voiceTurns.citizenId, citizenId))
        .orderBy(desc(voiceTurns.at))
        .limit(1);
      const lastTurn = lastTurnRes[0] && (Date.now() - new Date(lastTurnRes[0].at!).getTime() < 120000) ? lastTurnRes[0] : null;

      // 3. Router Intent
      const intentRes = await generateJson<z.infer<typeof IntentSchema>>({
        model: env.GEMINI_MODEL_FAST || "gemini-2.0-flash-lite",
        purpose: "voice_intent",
        systemPrompt: "Determine the intent of the citizen's query. If they are confirming escalation, return CONFIRM_ESCALATE.",
        userContent: `Query: "${text}"\nOpen complaints: ${JSON.stringify(openTickets)}\nPrevious Turn: ${lastTurn ? JSON.stringify({ intent: lastTurn.intent }) : "None"}`,
        responseSchema: {
          type: "OBJECT",
          properties: {
            intent: { type: "STRING", enum: ["STATUS", "HOW_LONG", "WHEN_FIXED", "WHO_COMING", "NEARBY", "WHICH_COMPLAINT", "ESCALATE", "CONFIRM_ESCALATE", "ADD_INFO", "OUT_OF_SCOPE", "UNCLEAR"] },
            publicCode: { type: "STRING" },
            index: { type: "NUMBER" }
          },
          required: ["intent"]
        },
        mockResult: () => ({ intent: "STATUS", index: 0 })
      });

      // 4. Execute tool
      let facts: Record<string, any> = {};
      let targetCode = intentRes.publicCode;
      
      if (!targetCode && intentRes.index !== undefined && openTickets[intentRes.index]) {
        targetCode = openTickets[intentRes.index]!.publicCode;
      } else if (!targetCode && openTickets.length === 1) {
        targetCode = openTickets[0]!.publicCode;
      }

      if (targetCode) {
        switch (intentRes.intent) {
          case "STATUS":
            facts = (await getStatus(citizenId, targetCode)) || {};
            break;
          case "HOW_LONG":
          case "WHEN_FIXED":
            facts = (await getEta(citizenId, targetCode)) || {};
            break;
          case "WHO_COMING":
            facts = (await getTeam(citizenId, targetCode)) || {};
            break;
          case "NEARBY":
            facts = (await getCluster(citizenId, targetCode)) || {};
            break;
          case "ESCALATE":
            facts = (await canEscalate(citizenId, targetCode)) || {};
            break;
          case "CONFIRM_ESCALATE":
            facts = (await escalateTicket(citizenId, targetCode)) || {};
            break;
        }
      }

      // 5. Fill Template or Generate + Validate
      let answer = "";
      let isGrounded = true;

      if (intentRes.intent === "ESCALATE" && facts.canEscalate) {
        answer = lang === "en" ? "The deadline has passed. Shall I escalate this complaint now?" : "समय सीमा पार हो गई है। क्या मैं इस शिकायत को आगे बढ़ा दूँ?";
      } else if (intentRes.intent === "ESCALATE" && !facts.canEscalate) {
        answer = lang === "en" ? "The time limit for this complaint hasn't passed yet, so it cannot be escalated." : "इस शिकायत की समय सीमा अभी खत्म नहीं हुई है, इसलिए इसे अभी आगे नहीं बढ़ाया जा सकता।";
      } else if (intentRes.intent === "CONFIRM_ESCALATE" && facts.success) {
        answer = lang === "en" ? "Done. The complaint has been escalated to the higher authority." : "ठीक है, आपकी शिकायत उच्च अधिकारी को भेज दी गई है।";
      } else if (intentRes.intent === "CONFIRM_ESCALATE" && !facts.success) {
        answer = lang === "en" ? "Sorry, this complaint cannot be escalated." : "क्षमा करें, यह शिकायत आगे नहीं बढ़ाई जा सकती।";
      } else if (intentRes.intent === "OUT_OF_SCOPE") {
        answer = lang === "en" ? "I can only help with civic complaints like water, roads, or electricity." : "मैं केवल पानी, सड़क, बिजली जैसी नागरिक समस्याओं में मदद कर सकता हूँ।";
      } else if (intentRes.intent === "UNCLEAR") {
        answer = lang === "en" ? "Sorry, I didn't catch that. Could you please repeat?" : "माफ़ कीजिए, मुझे समझ नहीं आया। क्या आप फिर से बोल सकते हैं?";
      }

      if (!answer) {
        // b) Free-form LLM with Grounding Validator
        const templateRes = await generateJson<z.infer<typeof TemplateSchema>>({
          model: env.GEMINI_MODEL_FAST || "gemini-2.0-flash-lite",
          purpose: "voice_answer",
          systemPrompt: `You are NyaySetu's voice assistant. Reply concisely in ${lang} using these facts. At most 2 sentences. Only state facts from the JSON.`,
          userContent: `Query: "${text}"\nIntent: ${intentRes.intent}\nFacts: ${JSON.stringify(facts)}`,
          responseSchema: {
            type: "OBJECT",
            properties: {
              answer: { type: "STRING" }
            },
            required: ["answer"]
          },
          mockResult: () => ({ answer: "आपकी शिकायत पर काम चल रहा है।" })
        });
        
        answer = templateRes.answer;

        // Grounding Validator
        const validatorRes = await generateJson<z.infer<typeof ValidatorSchema>>({
          model: env.GEMINI_MODEL_FAST || "gemini-2.0-flash-lite",
          purpose: "voice_validator",
          systemPrompt: `You are a strict grounding validator. Extract all numbers, times, ETA, and quantities from the ANSWER. Check if they exist explicitly in the FACTS. If the ANSWER contains ANY number or time not backed by FACTS, return has_hallucinations: true.`,
          userContent: `FACTS: ${JSON.stringify(facts)}\nANSWER: "${answer}"`,
          responseSchema: {
            type: "OBJECT",
            properties: {
              has_hallucinations: { type: "BOOLEAN" },
              extracted_numbers_and_times: { type: "ARRAY", items: { type: "STRING" } },
              unsupported_claims: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["has_hallucinations", "extracted_numbers_and_times", "unsupported_claims"]
          },
          mockResult: () => ({ has_hallucinations: false, extracted_numbers_and_times: [], unsupported_claims: [] })
        });

        if (validatorRes.has_hallucinations) {
          isGrounded = false;
          console.warn("[GROUNDING FAILED]", { answer, validatorRes });
          answer = lang === "en" ? "This information is not currently in the system." : "यह जानकारी अभी सिस्टम में नहीं है।";
        }
      }

      // 6. Speak
      const ttsUrl = await speak(answer, lang);
      const ttfaMs = performance.now() - start;

      // 7. Log to voiceTurns
      await db.insert(voiceTurns).values({
        citizenId,
        transcript: text,
        intent: intentRes.intent,
        facts,
        answer: answer,
        path: "llm",
        groundingOk: isGrounded,
        ttfaMs: Math.round(ttfaMs)
      });

      return reply.send({
        answer: answer,
        ttsUrl,
        intent: intentRes.intent,
        timings: { totalMs: ttfaMs, sttMs: transcriptRes.ms }
      });
    }
  );
}
