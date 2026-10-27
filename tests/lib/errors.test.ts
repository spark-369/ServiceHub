import { ApiError, errorResponse, withApiHandler } from "@/lib/api/errors";
import { ZodError, z } from "zod";
import { createRequest, jsonOf, statusOf } from "../utils/test-utils";

describe("lib/api/errors", () => {
  describe("ApiError factories", () => {
    it("creates typed errors with the right status/code", () => {
      expect(ApiError.badRequest("nope")).toMatchObject({
        status: 400,
        code: "BAD_REQUEST",
        message: "nope",
      });
      expect(ApiError.unauthorized().status).toBe(401);
      expect(ApiError.forbidden().status).toBe(403);
      expect(ApiError.notFound().status).toBe(404);
      expect(ApiError.conflict().status).toBe(409);
      expect(ApiError.tooManyRequests().status).toBe(429);
      expect(ApiError.internal().status).toBe(500);
      expect(ApiError.serviceUnavailable().status).toBe(503);
    });
  });

  describe("errorResponse", () => {
    it("translates ApiError into a body + status", () => {
      const { body, status } = errorResponse(ApiError.notFound("gone"));
      expect(status).toBe(404);
      expect(body).toEqual({
        error: "gone",
        code: "NOT_FOUND",
        requestId: undefined,
      });
    });

    it("includes details when present", () => {
      const { body } = errorResponse(ApiError.badRequest("bad", { field: "email" }));
      expect(body.details).toEqual({ field: "email" });
    });

    it("translates ZodError into a 422 validation payload", () => {
      const schema = z.object({ email: z.string().email() });
      const zodError = schema.safeParse({ email: "not-an-email" }).error as ZodError;
      const { body, status } = errorResponse(zodError);
      expect(status).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.details).toEqual([{ field: "email", message: expect.any(String) }]);
    });

    it("maps Prisma unique-constraint (P2002) to 409", () => {
      const { body, status } = errorResponse({ code: "P2002" });
      expect(status).toBe(409);
      expect(body.code).toBe("CONFLICT");
    });

    it("maps Prisma not-found (P2025) to 404", () => {
      const { status } = errorResponse({ code: "P2025" });
      expect(status).toBe(404);
    });

    it("falls back to 500 for unknown errors", () => {
      const { body, status } = errorResponse(new Error("boom"));
      expect(status).toBe(500);
      expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("withApiHandler", () => {
    it("runs the handler and attaches a request id", async () => {
      const handler = withApiHandler(async () => ({ status: 200, json: async () => ({ ok: true }), headers: new Headers() }) as any);
      const request = createRequest({ method: "GET", url: "/api/things" });
      const response = await handler(request);

      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(await jsonOf(response)).toEqual({ ok: true });
      expect(statusOf(response)).toBe(200);
    });

    it("reuses an incoming x-request-id header", async () => {
      const handler = withApiHandler(async () => ({ status: 200, json: async () => ({}), headers: new Headers() }) as any);
      const request = createRequest({
        method: "GET",
        url: "/api/things",
        headers: { "x-request-id": "req-abc-123" },
      });
      const response = await handler(request);
      expect(response.headers.get("x-request-id")).toBe("req-abc-123");
    });

    it("translates a thrown ApiError into the right status + body", async () => {
      const handler = withApiHandler(async () => {
        throw ApiError.notFound("thing not found");
      });
      const request = createRequest({ method: "GET", url: "/api/things/42" });
      const response = await handler(request);

      expect(statusOf(response)).toBe(404);
      const body = await jsonOf(response);
      expect(body).toEqual({
        error: "thing not found",
        code: "NOT_FOUND",
        requestId: expect.any(String),
      });
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });

    it("translates an unknown error into a 500", async () => {
      const handler = withApiHandler(async () => {
        throw new Error("unexpected");
      });
      const response = await handler(createRequest({ url: "/api/x" }));
      expect(statusOf(response)).toBe(500);
      expect((await jsonOf(response)).code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
