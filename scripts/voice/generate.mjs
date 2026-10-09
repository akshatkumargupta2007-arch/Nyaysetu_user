// Pre-generate the fixed voice clips with ElevenLabs.
//   node scripts/voice/generate.mjs hi              -> DRY RUN (counts characters, writes nothing, spends nothing)
//   node scripts/voice/generate.mjs hi --go         -> generates only the clips that do not exist yet
//   node scripts/voice/generate.mjs hi --go --only home,send   -> just those
//   add --force to regenerate an existing clip; --max-chars N to change the safety cap (default 5000)
// The key is read from XI_KEY (never stored in a file). Output: apps/web/public/audio/<lang>/<id>.mp3
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const lang = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes('--' + n);
const val = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
if (!lang) { console.error('usage: generate.mjs <lang> [--go] [--only a,b] [--force] [--max-chars N]'); process.exit(1); }

const here = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(here, 'voices.json'), 'utf8'));
const voice = cfg.languages[lang];
if (!voice) { console.error(`No voice configured for "${lang}" in voices.json`); process.exit(1); }

const lines = fs.readFileSync(path.join(here, 'lines', `${lang}.txt`), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('|'); return { id: l.slice(0, i).trim(), text: l.slice(i + 1).trim() }; });

const only = val('only') ? new Set(val('only').split(',')) : null;
const outDir = path.resolve(here, '../../apps/web/public/audio', lang);
const todo = lines.filter((l) => (!only || only.has(l.id)) && (flag('force') || !fs.existsSync(path.join(outDir, l.id + '.mp3'))));
const chars = todo.reduce((n, l) => n + [...l.text].length, 0);
const cap = Number(val('max-chars') || 5000);

console.log(`${lang}: ${lines.length} lines in file, ${todo.length} to generate, ${chars} characters (cap ${cap}). voice=${voice.voiceId} model=${cfg.model}`);
if (!flag('go')) { console.log('DRY RUN: nothing generated, no credits used. Add --go to generate.'); process.exit(0); }
if (chars > cap) { console.error(`Refusing: ${chars} characters is over the cap ${cap}. Raise --max-chars if intended.`); process.exit(1); }
const key = process.env.XI_KEY;
if (!key) { console.error('Set XI_KEY in the environment.'); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });
let ok = 0;
for (const l of todo) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=${cfg.format}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: l.text, model_id: cfg.model, language_code: lang, ...(voice.settings ? { voice_settings: voice.settings } : {}) }),
  });
  if (!res.ok) { console.error(`FAILED ${l.id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`); break; }
  fs.writeFileSync(path.join(outDir, l.id + '.mp3'), Buffer.from(await res.arrayBuffer()));
  ok++; console.log(`  ok ${l.id}  (${[...l.text].length} chars)`);
}
console.log(`done: ${ok}/${todo.length} generated`);
