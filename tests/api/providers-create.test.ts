/**
 * Unit tests for `POST /api/providers` (admin-only provider creation).
 *
 * The `GET` list path is covered by `tests/api/providers.test.ts`; this file
 * exercises the `withRole(["admin"])` write path with real JWTs so the guard
 * itself (not a stub) decides 401/403/201.
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

import { POST as ProvidersPOST } from "@/app/api/providers/route";

const ADMIN_TOKEN = signTestToken({
  userId: "adm_1",
  email: "root@example.com",
  role: "admin",
});
const PROVIDER_TOKEN = signTestToken({
  userId: "prov_1",
  email: "prov@example.com",
  role: "provider",
});

const VALID_BODY = {
  name: "New Provider",
  email: "new@example.com",
  password: "password123",
  phone: "555-0100",
  address: "3 Side St",
};

describe("API POST /api/providers", () => {
  it("creates a provider for an admin and hashes the password", async () => {
    const response = await ProvidersPOST(
      createAuthedRequest(ADMIN_TOKEN, {
        method: "POST",
        url: "/api/providers",
        body: VALID_BODY,
      })
    );

    expect(statusOf(response)).toBe(201);

    const body = await jsonOf(response);
    expect(body.message).toBe("Provider created successfully");
    expect(body.provider).toMatchObject({
      name: "New Provider",
      email: "new@example.com",
      role: "provider",
    });

    const created = store("user")[0];
    expect(created.role).toBe("provider");
    // The password must never be stored (or returned) in plain text.
    expect(created.password).not.toBe("password123");
    expect(created.password).toMatch(/^\$2[aby]\$/);
    expect(body.provider.password).toBeUndefined();
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await ProvidersPOST(
      createAuthedRequest(ADMIN_TOKEN, {
        method: "POST",
        url: "/api/providers",
        body: { name: "No Email" },
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({
      error: "Name, email, and password are required",
    });
    expect(store("user")).toHaveLength(0);
  });

  it("returns 400 when the email is already registered", async () => {
    seed("user", [
      {
        id: "existing",
        name: "Existing",
        email: VALID_BODY.email,
        password: "hashed",
        role: "customer",
      },
    ]);

    const response = await ProvidersPOST(
      createAuthedRequest(ADMIN_TOKEN, {
        method: "POST",
        url: "/api/providers",
        body: VALID_BODY,
      })
    );

    expect(statusOf(response)).toBe(400);
    expect(await jsonOf(response)).toEqual({ error: "User already exists" });
    expect(store("user")).toHaveLength(1);
  });

  it("returns 403 for a non-admin role", async () => {
    const response = await ProvidersPOST(
      createAuthedRequest(PROVIDER_TOKEN, {
        method: "POST",
        url: "/api/providers",
        body: VALID_BODY,
      })
    );

    expect(statusOf(response)).toBe(403);
    expect(await jsonOf(response)).toEqual({ error: "Forbidden" });
    expect(store("user")).toHaveLength(0);
  });

  it("returns 401 without a token", async () => {
    const response = await ProvidersPOST(
      createRequest({ method: "POST", url: "/api/providers", body: VALID_BODY })
    );

    expect(statusOf(response)).toBe(401);
    expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
  });
});
