#!/usr/bin/env node
// Build map #0.2 — confirm every API key works with one harmless call each.
// Never crashes on a missing key; prints a clear ✅/❌/⚪ (not configured) per service.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Minimal .env loader (no dependency needed for a one-off script).
function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    console.log("⚪ No .env file found. Copy .env.example to .env first.\n");
    return;
  }
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
}

async function checkGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return record("Gemini", "⚪", "GEMINI_API_KEY not set");
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`,
    );
    if (res.ok) {
      record("Gemini", "✅", "key accepted, models endpoint reachable");
    } else {
      record("Gemini", "❌", `HTTP ${res.status}`);
    }
  } catch (err) {
    record("Gemini", "❌", err.message);
  }
}

async function checkElevenLabs() {
  const key = process.env.ELEVEN_API_KEY;
  if (!key) return record("ElevenLabs", "⚪", "ELEVEN_API_KEY not set");
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": key },
    });
    if (res.ok) {
      const data = await res.json();
      const credits = data?.subscription?.character_count ?? "unknown";
      record("ElevenLabs", "✅", `key accepted, characters used: ${credits}`);
    } else {
      record("ElevenLabs", "❌", `HTTP ${res.status}`);
    }
  } catch (err) {
    record("ElevenLabs", "❌", err.message);
  }
}

async function checkCloudinary() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    return record(
      "Cloudinary",
      "⚪",
      "CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET not fully set",
    );
  }
  try {
    // ping endpoint needs basic auth; a 401 still proves the cloud name resolves
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/ping`,
      {
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"),
        },
      },
    );
    if (res.ok) {
      record("Cloudinary", "✅", "credentials accepted");
    } else {
      record("Cloudinary", "❌", `HTTP ${res.status}`);
    }
  } catch (err) {
    record("Cloudinary", "❌", err.message);
  }
}

async function main() {
  console.log("Checking API keys (never crashes on a missing one)…\n");
  await Promise.all([checkGemini(), checkElevenLabs(), checkCloudinary()]);

  for (const r of results) {
    console.log(`${r.status} ${r.name.padEnd(12)} ${r.detail}`);
  }

  const failed = results.filter((r) => r.status === "❌").length;
  console.log(
    `\n${results.length - failed}/${results.length} configured keys are working.`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main();
