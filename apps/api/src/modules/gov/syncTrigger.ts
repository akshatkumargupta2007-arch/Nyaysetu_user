// CA3/CA4: "this ticket changed, push it to gov soon", plus the 30-second sweep that catches everything else.
import { boss } from "../../db/boss.js";
import { env } from "../../env.js";
import { govSyncConfigured, runGovSync } from "./sync.js";

const QUEUE = "gov_sync";
let started = false;

/** Called after a ticket's ledger changes. Cheap and safe to call from anywhere; failures never matter. */
export async function enqueueGovSync(_ticketId?: string): Promise<void> {
  if (!started) return; // bridge off, or the job system is not running (tests)
  try {
    // singletonSeconds collapses a burst of changes into one push.
    await boss.send(QUEUE, {}, { singletonKey: "gov-sync", singletonSeconds: 2 });
  } catch {
    // the 30 s sweep will pick it up
  }
}

/** Starts the on-event worker and the 30 s sweep. Single API instance only (the app already requires that). */
export async function registerGovSync(): Promise<void> {
  if (!govSyncConfigured()) {
    console.log("gov sync: off (GOV_SYNC_URL / SYNC_SIGNING_PRIVATE_KEY / GOV_PHONE_SEAL_PUBLIC_KEY not all set)");
    return;
  }
  await boss.createQueue(QUEUE);
  await boss.work(QUEUE, async () => {
    const results = await runGovSync();
    const bad = results.find((r) => !r.ok);
    // Throw so pg-boss retries with its backoff when gov is down.
    if (bad) throw new Error(bad.error);
  });
  started = true;

  const sweep = async () => {
    const results = await runGovSync();
    const bad = results.find((r) => !r.ok);
    if (bad && env.NODE_ENV !== "test") console.warn(`gov sync: ${bad.error}`);
  };
  void sweep(); // first run = full backfill (reference data + every ticket)
  setInterval(() => void sweep(), 30_000).unref();
  console.log("gov sync: on, pushing to", env.GOV_SYNC_URL);
}
