/**
 * Unit tests for `/api/services/[id]` (GET, PUT, DELETE).
 *
 * Real-harness style: real handlers + real JWT auth + the in-memory Prisma fake,
 * so the public read path, the provider ownership rules and the partial-update
 * validation all run for real.
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
  GET as ServiceGET,
  PUT as ServicePUT,
  DELETE as ServiceDELETE,
} from "@/app/api/services/[id]/route";

const OWNER = { id: "prov_1", name: "Owner", email: "owner@example.com" };
const OTHER = { id: "prov_2", name: "Other", email: "other@example.com" };
const CUSTOMER = { id: "cust_1", name: "Cust", email: "cust@example.com" };

const OWNER_TOKEN = signTestToken({ userId: OWNER.id, email: OWNER.email, role: "provider" });
const OTHER_TOKEN = signTestToken({ userId: OTHER.id, email: OTHER.email, role: "provider" });
const CUSTOMER_TOKEN = signTestToken({ userId: CUSTOMER.id, email: CUSTOMER.email, role: "customer" });

function seedData() {
  seed("user", [
    { id: OWNER.id, name: OWNER.name, email: OWNER.email, password: "x", role: "provider" },
    { id: OTHER.id, name: OTHER.name, email: OTHER.email, password: "x", role: "provider" },
    { id: CUSTOMER.id, name: CUSTOMER.name, email: CUSTOMER.email, password: "x", role: "customer" },
  ]);
  seed("service", [
    {
      id: "svc_1",
      name: "Deep Clean",
      description: "A thorough clean",
      category: "Cleaning",
      price: 100,
      duration: 60,
      location: "Testville",
      availability: { days: ["mon"] },
      tags: ["clean"],
      rating: 0,
      reviewCount: 0,
      isActive: true,
      providerId: OWNER.id,
    },
  ]);
}

describe("API /api/services/[id]", () => {
  describe("GET", () => {
    it("returns the service with its provider and recent reviews", async () => {
      seedData();
      seed("review", [
        {
          id: "rev_1",
          bookingId: "book_1",
          userId: CUSTOMER.id,
          serviceId: "svc_1",
          providerId: OWNER.id,
          rating: 5,
          comment: "Excellent",
          createdAt: new Date("2029-12-05T00:00:00.000Z"),
        },
      ]);

      const response = await ServiceGET(
        createRequest({ method: "GET", url: "/api/services/svc_1" })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.service).toMatchObject({
        id: "svc_1",
        name: "Deep Clean",
        category: "Cleaning",
        price: 100,
        duration: 60,
        provider: { id: OWNER.id, name: OWNER.name },
      });
      expect(body.reviews).toHaveLength(1);
      expect(body.reviews[0]).toMatchObject({
        id: "rev_1",
        rating: 5,
        comment: "Excellent",
        user: { name: CUSTOMER.name },
      });
    });

    it("returns an empty review list when the service has none", async () => {
      seedData();

      const response = await ServiceGET(
        createRequest({ method: "GET", url: "/api/services/svc_1" })
      );

      expect(statusOf(response)).toBe(200);
      expect((await jsonOf(response)).reviews).toEqual([]);
    });

    it("returns 404 for an unknown service", async () => {
      seedData();

      const response = await ServiceGET(
        createRequest({ method: "GET", url: "/api/services/nope" })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({ error: "Service not found" });
    });
  });

  describe("PUT", () => {
    it("lets the owning provider partially update a service", async () => {
      seedData();

      const response = await ServicePUT(
        createAuthedRequest(OWNER_TOKEN, {
          method: "PUT",
          url: "/api/services/svc_1",
          body: { price: 150, isActive: false },
        })
      );

      expect(statusOf(response)).toBe(200);

      const body = await jsonOf(response);
      expect(body.message).toBe("Service updated successfully");
      expect(body.service).toMatchObject({ id: "svc_1", price: 150, isActive: false });
      // Omitted fields are preserved (partial update, not a full overwrite).
      expect(body.service.name).toBe("Deep Clean");
      expect(body.service.description).toBe("A thorough clean");
      expect(body.service.duration).toBe(60);
    });

    it("returns 404 when the caller does not own the service", async () => {
      seedData();

      const response = await ServicePUT(
        createAuthedRequest(OTHER_TOKEN, {
          method: "PUT",
          url: "/api/services/svc_1",
          body: { price: 1 },
        })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({
        error: "Service not found or unauthorized",
      });
      // Nothing was written.
      expect(store("service")[0].price).toBe(100);
    });

    it("returns 403 for a non-provider role", async () => {
      seedData();

      const response = await ServicePUT(
        createAuthedRequest(CUSTOMER_TOKEN, {
          method: "PUT",
          url: "/api/services/svc_1",
          body: { price: 1 },
        })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Forbidden" });
    });

    it("returns 400 when no updatable field is supplied", async () => {
      seedData();

      const response = await ServicePUT(
        createAuthedRequest(OWNER_TOKEN, {
          method: "PUT",
          url: "/api/services/svc_1",
          body: { unrelated: true },
        })
      );

      expect(statusOf(response)).toBe(400);
      expect(await jsonOf(response)).toEqual({ error: "No valid fields to update" });
    });

    it("returns 401 without a token", async () => {
      seedData();

      const response = await ServicePUT(
        createRequest({
          method: "PUT",
          url: "/api/services/svc_1",
          body: { price: 150 },
        })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });

  describe("DELETE", () => {
    it("deletes a service owned by the caller", async () => {
      seedData();

      const response = await ServiceDELETE(
        createAuthedRequest(OWNER_TOKEN, {
          method: "DELETE",
          url: "/api/services/svc_1",
        })
      );

      expect(statusOf(response)).toBe(200);
      expect(await jsonOf(response)).toEqual({
        message: "Service deleted successfully",
      });
      expect(store("service")).toHaveLength(0);
    });

    it("returns 404 when the caller does not own the service", async () => {
      seedData();

      const response = await ServiceDELETE(
        createAuthedRequest(OTHER_TOKEN, {
          method: "DELETE",
          url: "/api/services/svc_1",
        })
      );

      expect(statusOf(response)).toBe(404);
      expect(await jsonOf(response)).toEqual({
        error: "Service not found or unauthorized",
      });
      expect(store("service")).toHaveLength(1);
    });

    it("returns 403 for a non-provider role", async () => {
      seedData();

      const response = await ServiceDELETE(
        createAuthedRequest(CUSTOMER_TOKEN, {
          method: "DELETE",
          url: "/api/services/svc_1",
        })
      );

      expect(statusOf(response)).toBe(403);
      expect(await jsonOf(response)).toEqual({ error: "Forbidden" });
    });

    it("returns 401 without a token", async () => {
      seedData();

      const response = await ServiceDELETE(
        createRequest({ method: "DELETE", url: "/api/services/svc_1" })
      );

      expect(statusOf(response)).toBe(401);
      expect(await jsonOf(response)).toEqual({ error: "Unauthorized" });
    });
  });
});
