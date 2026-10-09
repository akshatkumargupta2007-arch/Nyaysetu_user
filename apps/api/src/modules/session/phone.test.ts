import { describe, it, expect } from "vitest";
import { normalizePhone, hashPhone, encryptPhone } from "./phone.js";

describe("Phone number security & privacy (#D8 & Bible §19)", () => {
  describe("normalizePhone", () => {
    it("normalizes a 10-digit Indian number", () => {
      expect(normalizePhone("9876543210")).toBe("+919876543210");
      expect(normalizePhone("7123456789")).toBe("+917123456789");
    });

    it("handles +91, 91, and leading 0 with spaces/dashes", () => {
      expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
      expect(normalizePhone("919876543210")).toBe("+919876543210");
      expect(normalizePhone("09876543210")).toBe("+919876543210");
    });

    it("rejects invalid numbers", () => {
      expect(normalizePhone("1234567890")).toBeNull(); // starts with 1
      expect(normalizePhone("98765")).toBeNull(); // too short
      expect(normalizePhone("abcdefghij")).toBeNull(); // non-digits
      expect(normalizePhone("")).toBeNull();
    });
  });

  describe("hashPhone & encryptPhone", () => {
    it("produces deterministic 64-character SHA-256 hash", () => {
      const h1 = hashPhone("+919876543210");
      const h2 = hashPhone("+919876543210");
      expect(h1).toHaveLength(64);
      expect(h1).toBe(h2);
    });

    it("encrypts with AES-256-GCM producing iv:tag:ciphertext format", () => {
      const enc1 = encryptPhone("+919876543210");
      const enc2 = encryptPhone("+919876543210");
      expect(enc1).not.toBe(enc2); // Different random IV each time
      const parts = enc1.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(24); // 12-byte IV in hex = 24 chars
      expect(parts[1]).toHaveLength(32); // 16-byte tag in hex = 32 chars
      expect(parts[2]!.length).toBeGreaterThan(0); // ciphertext
    });
  });
});
