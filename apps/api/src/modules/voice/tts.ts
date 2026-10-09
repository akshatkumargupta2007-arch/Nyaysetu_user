import crypto from "crypto";
import { env } from "../../env.js";
import { db } from "../../db/client.js";
import { ttsCache, aiCalls } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function speak(text: string, lang: string, demoFallback: boolean = false): Promise<string> {
  const model = env.ELEVEN_TTS_MODEL || "eleven_multilingual_v2";
  const voice = lang === "hi" 
    ? (env.ELEVEN_VOICE_ID_HI || "EXAVITQu4vr4xnSDxMaL") 
    : (env.ELEVEN_VOICE_ID_EN || "pNInz6obbfDQGcgMyIGC");

  const keyString = `${model}|${voice}|${text}`;
  const key = crypto.createHash("sha256").update(keyString).digest("hex");

  // 1. Check Cache
  const cached = await db.query.ttsCache.findFirst({
    where: eq(ttsCache.key, key)
  });

  if (cached && cached.url) {
    if (demoFallback && !cached.demoFallback) {
      await db.update(ttsCache).set({ demoFallback: true }).where(eq(ttsCache.key, key));
    }
    return cached.url;
  }

  // 2. Mock mode if keys are missing
  if (!env.ELEVEN_API_KEY || !env.CLOUDINARY_API_KEY) {
    const mockUrl = `https://mock-tts.local/${key}.mp3`;
    await db.insert(ttsCache).values({
      key,
      model,
      voice,
      text,
      url: mockUrl,
      demoFallback
    }).onConflictDoNothing();
    return mockUrl;
  }

  // 3. Generate with ElevenLabs
  const start = performance.now();
  let audioBuffer: Buffer;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": env.ELEVEN_API_KEY,
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: model
      })
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
    }
    
    audioBuffer = Buffer.from(await res.arrayBuffer());
    
    await db.insert(aiCalls).values({
      provider: "eleven-tts",
      model,
      purpose: "tts",
      latencyMs: Math.round(performance.now() - start),
      ok: true
    }).catch(() => {});

  } catch (err: any) {
    await db.insert(aiCalls).values({
      provider: "eleven-tts",
      model,
      purpose: "tts",
      latencyMs: Math.round(performance.now() - start),
      ok: false
    }).catch(() => {});
    throw err;
  }

  // 4. Upload to Cloudinary
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `tts_${key}`;
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const toHash = `${paramsToSign}${env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash("sha1").update(toHash).digest("hex");

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }));
  formData.append("api_key", env.CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);
  formData.append("public_id", publicId);

  const cldRes = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: "POST",
    body: formData
  });

  if (!cldRes.ok) {
    throw new Error(`Cloudinary upload failed: ${await cldRes.text()}`);
  }

  const cldData = await cldRes.json() as { secure_url: string };
  const url = cldData.secure_url;

  // 5. Save to Cache
  await db.insert(ttsCache).values({
    key,
    model,
    voice,
    text,
    url,
    demoFallback
  }).onConflictDoUpdate({
    target: ttsCache.key,
    set: { demoFallback }
  });

  return url;
}
