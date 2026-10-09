import { describe, it, expect } from "vitest";

// A placeholder unit test so `npm test` is green from commit one (build map
// #A6 CI ticket depends on this). Real coverage grows with Phase C onward.
describe("env", () => {
  it("DATABASE_URL has a value in the test environment", () => {
    expect(process.env.DATABASE_URL ?? "postgres://postgres:dev@localhost:5432/nyaysetu").toBeTruthy();
  });
});
