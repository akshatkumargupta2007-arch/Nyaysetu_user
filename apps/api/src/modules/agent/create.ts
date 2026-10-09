// `npm run agent:create`: creates (or updates) Bolo in ElevenLabs and saves ELEVEN_AGENT_ID into the repo .env.
// Needs ELEVEN_API_KEY with the Conversational AI (agents) read and write permissions switched on.
// Prints the agent id only; never the key.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AGENT_GREETING, AGENT_PROMPT, AGENT_TOOLS, AGENT_VOICES } from "./config.js";

const key = process.env.ELEVEN_API_KEY ?? "";
if (!key) { console.error("ELEVEN_API_KEY is not set."); process.exit(1); }
const existing = process.env.ELEVEN_AGENT_ID ?? "";
const model = process.env.ELEVEN_AGENT_TTS_MODEL || "eleven_v4_turbo";
const llm = process.env.ELEVEN_AGENT_LLM || "gemini-2.5-flash";
const maxSeconds = Number(process.env.AGENT_SESSION_SECONDS || 180);

const body = {
  name: "Bolo (NyaySetu)",
  tags: ["nyaysetu", "bolo"],
  conversation_config: {
    agent: {
      first_message: AGENT_GREETING.hi,
      language: "hi",
      dynamic_variables: { dynamic_variable_placeholders: { lang_name: "Hindi" } },
      prompt: { prompt: AGENT_PROMPT, llm, temperature: 0.2, max_tokens: 400, tools: AGENT_TOOLS },
    },
    tts: { model_id: model, voice_id: AGENT_VOICES.hi },
    conversation: { max_duration_seconds: maxSeconds, client_events: ["audio", "agent_response", "user_transcript", "interruption", "client_tool_call"] },
  },
  platform_settings: {
    auth: { enable_auth: true }, // only a signed URL from our API can start a conversation
    overrides: {
      conversation_config_override: {
        agent: { first_message: true, language: true },
        tts: { voice_id: true },
        conversation: { text_only: true }, // lets the scripted tests talk in text mode
      },
    },
  },
};

const url = existing ? `https://api.elevenlabs.io/v1/convai/agents/${existing}` : "https://api.elevenlabs.io/v1/convai/agents/create";
const res = await fetch(url, { method: existing ? "PATCH" : "POST", headers: { "xi-api-key": key, "content-type": "application/json" }, body: JSON.stringify(body) });
const text = await res.text();
if (!res.ok) {
  console.error(`ElevenLabs refused (${res.status}): ${text.slice(0, 900)}`);
  process.exit(1);
}
const agentId = existing || (JSON.parse(text) as { agent_id: string }).agent_id;
console.log(existing ? `updated agent ${agentId}` : `created agent ${agentId}`);

const envPath = fileURLToPath(new URL("../../../../../.env", import.meta.url));
if (existsSync(envPath)) {
  let env = readFileSync(envPath, "utf8");
  env = /^ELEVEN_AGENT_ID=.*$/m.test(env) ? env.replace(/^ELEVEN_AGENT_ID=.*$/m, `ELEVEN_AGENT_ID=${agentId}`) : `${env.replace(/\n?$/, "\n")}ELEVEN_AGENT_ID=${agentId}\n`;
  writeFileSync(envPath, env);
  console.log("saved ELEVEN_AGENT_ID to .env");
}
