/**
 * Unit tests for `/api/location` (PUT, GET).
 *
 * The real handlers run against the mocked Redis client installed by
 * `jest.setup.js` (`get` → null, `set` → "OK"), so reads fall through to the
 * in-process fallback store — exactly the "Redis unavailable" path the route is
 * designed to tolerate. Auth uses real JWTs.
 */
import {
  createRequest,
  createAuthedRequest,
  jsonOf,
  statusOf,
  signTestToken,
  seed,
} from "../utils/test-utils";

import { PUT as LocationPUT, GET as LocationGET } from "@/app/api/location/route";

const SHARER = { id: "user_share", name: "Sharer", email: "share@example.com" };
const VIEWER = { id: "user_view", name: "Viewer", email: "view@example.com" };

const SHARER_TOKEN = signTestToken({
  userId: SHARER.id,
  email: SHARER.email,
  role: "customer",
});
const VIEWER_TOKEN = signTestToken({
  userId: VIEWER.id,
  email: VIEWER.email,
  role: "customer",
});

/** The route pins its fallback store to `globalThis`; clear it per test. */
function clearMemoryStore() {
  const store = (globalThis as any).__locationMemoryStore as Map<string, unknown> | undefined;
  store?.clear();
}

describe("API /api/location", () => {
  beforeEach(() => {
    clearMemoryStore();
  });

  afterEach(() => {
    clearMemoryStore();
  });

  describe("PUT", () => {
    it("stores a shared position and echoes it back", async () => {
      const response = await LocationPUT(
        createAuthedRequest(SHARER_TOKEN, {
          method: "PUT",
          url: "/api/location",
          body: { latitude: 51.5074, longitude: -0.1278, accuracy: 12.5 },
        })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.message).toBe("Location updated successfully");
      expect(body.user).toMatchObject({
        id: SHARER.id,
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 12.5,
      });
    });

    it("treats a missing accuracy as null", async () => {
      const response = await LocationPUT(
        createAuthedRequest(SHARER_TOKEN, {
          method: "PUT",
          url: "/api/location",
          body: { latitude: 10, longitude: 20 },
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).user.accuracy).toBeNull();
    });

    it("normalises a negative accuracy to null", async () => {
      const response = await LocationPUT(
        createAuthedRequest(SHARER_TOKEN, {
          method: "PUT",
          url: "/api/location",
          body: { latitude: 10, longitude: 20, accuracy: -5 },
        })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).user.accuracy).toBeNull();
    });

    it.each([
      ["missing coordinates", {}],
      ["non-numeric latitude", { latitude: "51.5", longitude: 0 }],
      ["latitude out of range", { latitude: 91, longitude: 0 }],
      ["longitude out of range", { latitude: 0, longitude: 181 }],
      ["non-finite latitude", { latitude: Number.NaN, longitude: 0 }],
    ])("returns 400 for %s", async (_label: string, body: Record<string, unknown>) => {
      const response = await LocationPUT(
        createAuthedRequest(SHARER_TOKEN, {
          method: "PUT",
          url: "/api/location",
          body,
        })
      );

      expect(statusOf(response)).toBe(400);
      expect((await jsonOf(response)).error).toContain("latitude");
    });

    it("returns 401 without a token", async () => {
      const response = await LocationPUT(
        createRequest({
          method: "PUT",
          url: "/api/location",
          body: { latitude: 1, longitude: 2 },
        })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });

  describe("GET", () => {
    it("returns the target's shared position with their profile", async () => {
      seed("user", [
        {
          id: SHARER.id,
          name: SHARER.name,
          email: SHARER.email,
          password: "x",
          role: "customer",
          phone: "555-0100",
        },
      ]);

      await LocationPUT(
        createAuthedRequest(SHARER_TOKEN, {
          method: "PUT",
          url: "/api/location",
          body: { latitude: 40.7128, longitude: -74.006, accuracy: 8 },
        })
      );

      const response = await LocationGET(
        createAuthedRequest(VIEWER_TOKEN, {
          method: "GET",
          url: `/api/location?targetId=${SHARER.id}`,
        })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body).toMatchObject({
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 8,
        target: { id: SHARER.id, name: SHARER.name, phone: "555-0100" },
      });
      expect(body.location).toMatchObject({ latitude: 40.7128 });
      expect(typeof body.updatedAt).toBe("number");
    });

    it("returns location:null (200) when the target has not shared yet", async () => {
      seed("user", [
        {
          id: SHARER.id,
          name: SHARER.name,
          email: SHARER.email,
          password: "x",
          role: "customer",
        },
      ]);

      const response = await LocationGET(
        createAuthedRequest(VIEWER_TOKEN, {
          method: "GET",
          url: `/api/location?targetId=${SHARER.id}`,
        })
      );

      // "Not sharing" is a normal state, not an error.
      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.location).toBeNull();
      expect(body.target).toMatchObject({ id: SHARER.id });
    });

    it("returns 400 without a targetId", async () => {
      const response = await LocationGET(
        createAuthedRequest(VIEWER_TOKEN, { method: "GET", url: "/api/location" })
      );

      expect(statusOf(response)).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: "targetId required" });
    });

    it("returns 401 without a token", async () => {
      const response = await LocationGET(
        createRequest({ method: "GET", url: `/api/location?targetId=${SHARER.id}` })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });
});
