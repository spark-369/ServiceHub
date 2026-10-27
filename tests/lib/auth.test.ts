import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  getTokenFromRequest,
  getUserFromRequest,
} from "@/lib/auth";
import { createRequest } from "../utils/test-utils";

describe("lib/auth", () => {
  describe("password hashing", () => {
    it("hashes a password and verifies it", () => {
      const hashed = hashPassword("s3cret-password");
      expect(hashed).not.toBe("s3cret-password");
      expect(hashed.startsWith("$2")).toBe(true); // bcrypt prefix
      expect(comparePassword("s3cret-password", hashed)).toBe(true);
    });

    it("rejects the wrong password", () => {
      const hashed = hashPassword("s3cret-password");
      expect(comparePassword("wrong-password", hashed)).toBe(false);
    });

    it("produces a different hash each time (salted)", () => {
      expect(hashPassword("same")).not.toBe(hashPassword("same"));
    });
  });

  describe("JWT sign/verify", () => {
    const payload = { userId: "u1", email: "u1@example.com", role: "customer" };

    it("round-trips a payload", () => {
      const token = generateToken(payload);
      expect(typeof token).toBe("string");
      const decoded = verifyToken(token);
      expect(decoded).toMatchObject(payload);
    });

    it("returns null for a tampered token", () => {
      const token = generateToken(payload);
      const tampered = `${token.slice(0, -3)}abc`;
      expect(verifyToken(tampered)).toBeNull();
    });

    it("returns null for garbage", () => {
      expect(verifyToken("not-a-jwt")).toBeNull();
      expect(verifyToken("")).toBeNull();
    });
  });

  describe("request token extraction", () => {
    it("extracts a Bearer token", () => {
      const request = createRequest({
        headers: { authorization: "Bearer abc.def.ghi" },
      });
      expect(getTokenFromRequest(request)).toBe("abc.def.ghi");
    });

    it("returns null without an Authorization header", () => {
      expect(getTokenFromRequest(createRequest())).toBeNull();
    });

    it("returns null for a non-Bearer scheme", () => {
      const request = createRequest({ headers: { authorization: "Basic abc" } });
      expect(getTokenFromRequest(request)).toBeNull();
    });

    it("resolves the user from a valid Bearer token", () => {
      const token = generateToken({ userId: "u9", email: "u9@example.com", role: "provider" });
      const request = createRequest({ headers: { authorization: `Bearer ${token}` } });
      expect(getUserFromRequest(request)).toMatchObject({
        userId: "u9",
        email: "u9@example.com",
        role: "provider",
      });
    });

    it("returns null when the token is invalid", () => {
      const request = createRequest({ headers: { authorization: "Bearer invalid" } });
      expect(getUserFromRequest(request)).toBeNull();
    });
  });
});
