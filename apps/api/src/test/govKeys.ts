// Throwaway key pairs for one citizen-side test run, handed to the app through the same env names as production.
// The halves the GOV portal would hold are exposed as TEST_* so tests can act as the gov side.
import { generateKeyPairSync } from "node:crypto";

const pair = (type: "ed25519" | "x25519") => {
  const { privateKey, publicKey } = generateKeyPairSync(type as "ed25519");
  return {
    priv: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    pub: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
};

export function govKeyEnv(): Record<string, string> {
  const writeback = pair("ed25519");
  const sync = pair("ed25519");
  const seal = pair("x25519");
  return {
    GOV_WRITEBACK_PUBLIC_KEY: writeback.pub,
    TEST_GOV_WRITEBACK_PRIVATE_KEY: writeback.priv,
    SYNC_SIGNING_PRIVATE_KEY: sync.priv,
    TEST_SYNC_SIGNING_PUBLIC_KEY: sync.pub,
    GOV_PHONE_SEAL_PUBLIC_KEY: seal.pub,
    GOV_SYNC_URL: "http://gov.test:8091", // never contacted: tests stub fetch
    TEST_GOV_PHONE_SEAL_PRIVATE_KEY: seal.priv,
  };
}
