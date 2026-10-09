import { defineConfig } from "vitest/config";
import { govKeyEnv } from "./src/test/govKeys.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    envDir: "../../",
    env: {
      NODE_ENV: "test",
      ...govKeyEnv(),
      // v2: tests run against their own database so the original dev data is never touched.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:dev@localhost:5432/nyaysetu_v2_test",
    },
  },
});
