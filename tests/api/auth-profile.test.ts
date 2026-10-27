/**
 * Unit tests for `/api/auth/profile` (GET, PUT).
 *
 * Real-harness style: the route handlers run unmocked against the in-memory
 * Prisma fake installed by `jest.setup.js`, and the caller is authenticated with
 * a REAL JWT (`signTestToken`) so `withAuth` → `getUserFromRequest` exercises the
 * actual verification path rather than a stubbed guard.
 */
import {
  createRequest,
  createAuthedRequest,
  jsonOf,
  statusOf,
  signTestToken,
  seed,
  store,
} from "../utils/test-utils";

import {
  GET as ProfileGET,
  PUT as ProfilePUT,
} from "@/app/api/auth/profile/route";

describe("API /api/auth/profile", () => {
  const user = {
    id: "user_1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "customer",
  };

  const token = signTestToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  function seedProfile() {
    seed("user", [
      {
        ...user,
        password: "hashed-password",
        phone: "555-0100",
        address: "1 Main St",
        isVerified: true,
      },
    ]);
  }

  describe("GET", () => {
    it("returns the authenticated user's profile", async () => {
      seedProfile();

      const response = await ProfileGET(
        createAuthedRequest(token, { method: "GET", url: "/api/auth/profile" })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.user).toMatchObject({
        id: user.id,
        name: user.name,
        email: user.email,
        role: "customer",
        phone: "555-0100",
        address: "1 Main St",
        isVerified: true,
      });
      // The endpoint must never leak the password hash.
      expect(body.user.password).toBeUndefined();
    });

    it("returns 401 without a token", async () => {
      const response = await ProfileGET(
        createRequest({ method: "GET", url: "/api/auth/profile" })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 for a malformed bearer token", async () => {
      const response = await ProfileGET(
        createRequest({
          method: "GET",
          url: "/api/auth/profile",
          headers: { authorization: "Bearer not-a-real-jwt" },
        })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });

    it("returns 404 when the token references a user that no longer exists", async () => {
      const ghostToken = signTestToken({
        userId: "ghost_1",
        email: "ghost@example.com",
        role: "customer",
      });

      const response = await ProfileGET(
        createAuthedRequest(ghostToken, {
          method: "GET",
          url: "/api/auth/profile",
        })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({ error: "User not found" });
    });
  });

  describe("PUT", () => {
    it("updates the editable profile fields", async () => {
      seedProfile();

      const response = await ProfilePUT(
        createAuthedRequest(token, {
          method: "PUT",
          url: "/api/auth/profile",
          body: {
            name: "Ada Byron",
            phone: "555-0199",
            address: "2 New St",
          },
        })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.message).toBe("Profile updated successfully");
      expect(body.user).toMatchObject({
        id: user.id,
        name: "Ada Byron",
        phone: "555-0199",
        address: "2 New St",
      });

      // The write is persisted, not just echoed back.
      expect(store("user")[0]).toMatchObject({
        name: "Ada Byron",
        phone: "555-0199",
        address: "2 New St",
      });
      // Email/role are not part of the payload and must stay untouched.
      expect(store("user")[0].email).toBe(user.email);
      expect(store("user")[0].role).toBe("customer");
    });

    it("returns 401 without a token", async () => {
      const response = await ProfilePUT(
        createRequest({
          method: "PUT",
          url: "/api/auth/profile",
          body: { name: "Nope" },
        })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
      expect(store("user")).toHaveLength(0);
    });
  });
});
