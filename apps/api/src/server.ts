import { buildApp } from "./app.js";
import { env } from "./env.js";
import { startBoss } from "./db/boss.js";
import { registerCronJobs } from "./modules/lifecycle/worker.js";
import { buildBridgeApp } from "./modules/gov/bridge.js";
import { registerGovSync } from "./modules/gov/syncTrigger.js";
import { checkGeminiModels } from "./lib/gemini.js";

async function main() {
  const app = await buildApp();
  await startBoss();
  await registerCronJobs();
  await registerGovSync(); // pushes tickets to the gov portal when its keys are configured
  void checkGeminiModels((m) => app.log.warn(m)); // warns if a configured model is gone; never blocks start-up
  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  // Bridge to the separate government portal: its own listener on an internal port that is NOT published
  // to the host. Off unless the gov keys have been generated (npm run gov:keys in NyaySetu_Gov).
  if (env.GOV_WRITEBACK_PUBLIC_KEY) {
    const bridge = await buildBridgeApp();
    await bridge.listen({ port: env.GOV_BRIDGE_PORT, host: "0.0.0.0" });
    bridge.log.info(`gov bridge listening on :${env.GOV_BRIDGE_PORT} (internal)`);
  }
  app.log.info(`NyaySetu API listening on :${env.PORT} (${env.NODE_ENV})`);
}

main().catch((err) => {
  console.error("❌ failed to start:", err);
  process.exit(1);
});
