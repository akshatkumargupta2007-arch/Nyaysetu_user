// Build map #A4 — runs: extensions → drizzle-generated migrations → raw-SQL
// extras that Drizzle can't express (generated tsv column, HNSW ops already
// declared in schema, the append-only lock on `events`).
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function ensureExtensions() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  `);
  console.log("✅ extensions ensured (postgis, vector, pg_trgm)");
}

async function runDrizzleMigrations() {
  await migrate(db, { migrationsFolder: join(__dirname, "../../drizzle") });
  console.log("✅ drizzle migrations applied");
}

async function runRawSqlExtras() {
  const sqlDir = join(__dirname, "../../sql");
  let files: string[] = [];
  try {
    files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.log("⚪ no sql/ extras folder, skipping");
    return;
  }
  for (const file of files) {
    const sql = readFileSync(join(sqlDir, file), "utf8");
    await pool.query(sql);
    console.log(`✅ applied sql/${file}`);
  }
}

async function main() {
  await ensureExtensions();
  await runDrizzleMigrations();
  await runRawSqlExtras();
  await pool.end();
  console.log("✅ migration complete");
}

main().catch((err) => {
  console.error("❌ migration failed:", err);
  process.exit(1);
});
