// Build map #A5 — one place every env var is read from, validated once at boot.
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z.string().default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PUBLIC_WEB_ORIGIN: z.string().default("http://localhost:5173"),

  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEYS: z.string().optional().default(""), // extra keys, comma separated; rotated automatically when one runs out
  GEMINI_MODEL_FAST: z.string().optional().default(""),
  GEMINI_MODEL_VISION: z.string().optional().default(""),
  GEMINI_EMBED_MODEL: z.string().optional().default(""),
  EMBED_DIM: z.coerce.number().default(768),

  ELEVEN_API_KEY: z.string().optional().default(""),
  ELEVEN_STT_MODEL: z.string().optional().default(""),
  ELEVEN_TTS_MODEL: z.string().optional().default(""),
  ELEVEN_TTS_MODEL_FALLBACK: z.string().optional().default(""),
  ELEVEN_VOICE_ID_HI: z.string().optional().default(""),
  ELEVEN_VOICE_ID_EN: z.string().optional().default(""),

  // local dev: gemini (saves Scribe credits) · deployed: eleven — see Bible §17.5b
  STT_PROVIDER: z.enum(["eleven", "gemini"]).default("gemini"),
  STT_DAILY_CAP: z.coerce.number().default(300),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  TURNSTILE_SECRET: z.string().optional().default(""),
  JWT_SECRET: z.string().default("dev-secret-change-me"),
  PHONE_ENC_KEY: z.string().optional().default(""),

  // NOT z.coerce.boolean(): that turns the string "false" into true.
  DEMO_MODE: z
    .string()
    .optional()
    .default("false")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),
  // Phone+OTP login (build map #D8). Real SMS needs TRAI DLT registration; until a
  // provider is wired in, OTPs are logged server-side and (outside production, or
  // in DEMO_MODE) also returned in the API response so the app is usable.
  OTP_FIXED_CODE: z.string().optional().default(""),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  CITIZEN_JWT_TTL: z.string().default("30d"),
  DEMO_KEY: z.string().optional().default(""),
  // Deliberate opt-in for a public DEMO deployment (fixed OTP / demo endpoints in production).
  ALLOW_DEMO_IN_PRODUCTION: z
    .string()
    .optional()
    .default("false")
    .transform((v) => ["1", "true", "yes", "on"].includes(v.trim().toLowerCase())),

  SENTRY_DSN: z.string().optional().default(""),

  // Bridge to the SEPARATE government portal (NyaySetu_Gov). All empty = the bridge is switched off.
  GOV_BRIDGE_PORT: z.coerce.number().default(8090), // internal listener, never published to the host
  GOV_WRITEBACK_PUBLIC_KEY: z.string().optional().default(""), // verifies close requests coming FROM gov
  SYNC_SIGNING_PRIVATE_KEY: z.string().optional().default(""), // signs the batches we push TO gov
  GOV_PHONE_SEAL_PUBLIC_KEY: z.string().optional().default(""), // phone numbers are re-sealed to this key
  GOV_SYNC_URL: z.string().optional().default(""), // e.g. http://gov-api:8091
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  assertSafeForProduction(parsed.data);
  return parsed.data;
}

/** Refuses to boot a production server that is unsafe to expose (checklist 1.3 / 1.6). */
function assertSafeForProduction(e: Env): void {
  if (e.NODE_ENV !== "production") return;
  const problems: string[] = [];
  if (e.JWT_SECRET === "dev-secret-change-me" || e.JWT_SECRET.length < 32) {
    problems.push("JWT_SECRET must be a random value of at least 32 characters");
  }
  if (!e.PHONE_ENC_KEY) problems.push("PHONE_ENC_KEY must be set (and never changed later)");
  if (!e.ALLOW_DEMO_IN_PRODUCTION) {
    if (e.DEMO_MODE) problems.push("DEMO_MODE must be off (or set ALLOW_DEMO_IN_PRODUCTION=true for a demo)");
    if (e.OTP_FIXED_CODE) problems.push("OTP_FIXED_CODE must be empty (or set ALLOW_DEMO_IN_PRODUCTION=true for a demo)");
  }
  if (problems.length) {
    console.error("❌ Unsafe production configuration:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  if (e.ALLOW_DEMO_IN_PRODUCTION && (e.DEMO_MODE || e.OTP_FIXED_CODE)) {
    console.warn("⚠️  DEMO deployment: fixed OTP / demo endpoints are enabled. Not for real citizens.");
  }
}

export const env = loadEnv();
