import fs from "fs";
import path from "path";
import { speak } from "../modules/voice/tts.js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixedLines = [
  { text: "यह जानकारी अभी सिस्टम में नहीं है", lang: "hi" },
  { text: "This information is not currently in the system.", lang: "en" },
  { text: "क्षमा करें, त्रुटि हुई।", lang: "hi" },
  { text: "Sorry, an error occurred.", lang: "en" },
  { text: "क्या आपकी समस्या पूरी तरह से हल हो गई थी?", lang: "hi" },
  { text: "Was your issue resolved completely?", lang: "en" }
];

async function main() {
  console.log("Starting TTS Prewarm...");

  const linesToProcess: { text: string; lang: string; demoFallback: boolean }[] = [];

  // 1. Add fixed lines
  for (const line of fixedLines) {
    linesToProcess.push({ ...line, demoFallback: false });
  }

  // 2. Parse docs/demo-script.md
  try {
    const demoScriptPath = path.resolve(__dirname, "../../../../docs/demo-script.md");
    if (fs.existsSync(demoScriptPath)) {
      const content = fs.readFileSync(demoScriptPath, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        const enMatch = line.match(/^-\s+\*\*EN:\*\*\s+(.+)$/);
        if (enMatch && enMatch[1]) {
          linesToProcess.push({ text: enMatch[1].trim(), lang: "en", demoFallback: true });
        }
        const hiMatch = line.match(/^-\s+\*\*HI:\*\*\s+(.+)$/);
        if (hiMatch && hiMatch[1]) {
          linesToProcess.push({ text: hiMatch[1].trim(), lang: "hi", demoFallback: true });
        }
      }
      console.log(`Found ${linesToProcess.length - fixedLines.length} lines in demo-script.md`);
    } else {
      console.warn("docs/demo-script.md not found. Skipping showcase flow.");
    }
  } catch (err) {
    console.error("Error reading demo-script.md:", err);
  }

  // 3. Generate Audio sequentially to avoid rate limits
  let successCount = 0;
  for (let i = 0; i < linesToProcess.length; i++) {
    const { text, lang, demoFallback } = linesToProcess[i]!;
    console.log(`[${i + 1}/${linesToProcess.length}] Generating (${lang}): "${text}"`);
    try {
      const url = await speak(text, lang, demoFallback);
      console.log(` -> OK: ${url}`);
      successCount++;
    } catch (err) {
      console.error(` -> ERROR:`, err);
    }
  }

  console.log(`\nPrewarm Complete. Successfully generated ${successCount} of ${linesToProcess.length} lines.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
