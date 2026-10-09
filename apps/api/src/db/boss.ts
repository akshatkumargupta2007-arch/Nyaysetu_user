import { PgBoss } from "pg-boss";
import { env } from "../env.js";

export const boss = new (PgBoss as any)(env.DATABASE_URL);

export async function startBoss() {
  boss.on("error", (error: any) => console.error("pg-boss error:", error));
  await boss.start();
}
