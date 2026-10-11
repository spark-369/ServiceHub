import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { logger, generateRequestId, RequestLogger } from "@/lib/config/logger";

/**
 * A typed HTTP error that can be thrown from anywhere and translated into a
 * consistent JSON response by {@link errorResponse}.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code || httpStatusToCode(status);
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message, "FORBIDDEN");
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message, "NOT_FOUND");
  }
  static conflict(message = "Conflict") {
    return new ApiError(409, message, "CONFLICT");
  }
  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message, "TOO_MANY_REQUESTS");
  }
  static internal(message = "Internal server error") {
    return new ApiError(500, message, "INTERNAL_SERVER_ERROR");
  }
  static serviceUnavailable(message = "Service unavailable") {
    return new ApiError(503, message, "SERVICE_UNAVAILABLE");
  }
}

function httpStatusToCode(status: number): string {
  const map: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_SERVER_ERROR",
    503: "SERVICE_UNAVAILABLE",
  };
  return map[status] || "ERROR";
}

/** Shape of an error payload returned to clients. */
export interface ApiErrorBody {
  error: string;
  code: string;
  requestId?: string;
  details?: unknown;
}

export function errorResponse(
  error: unknown,
  requestId?: string
): { body: ApiErrorBody; status: number } {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      logger.error(error.message, { requestId, error, code: error.code });
    } else {
      logger.warn(error.message, { requestId, code: error.code });
    }
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        requestId,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    logger.warn("Request validation failed", { requestId, details });
    return {
      status: 422,
      body: {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        requestId,
        details,
      },
    };
  }

  // Prisma unique constraint violation
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      return {
        status: 409,
        body: {
          error: "Resource already exists",
          code: "CONFLICT",
          requestId,
        },
      };
    }
    if (code === "P2025") {
      return {
        status: 404,
        body: { error: "Resource not found", code: "NOT_FOUND", requestId },
      };
    }
  }

  logger.error("Unhandled API error", { requestId, error });
  return {
    status: 500,
    body: {
      error: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      requestId,
    },
  };
}

export interface ApiHandlerContext {
  request: NextRequest;
  requestId: string;
  log: RequestLogger;
}

type ApiHandler = (
  request: NextRequest,
  ctx: ApiHandlerContext
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js route handler with:
 *  - request id propagation (`x-request-id` header)
 *  - structured request logging with duration
 *  - centralised error translation
 */
export function withApiHandler(handler: ApiHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId =
      request.headers.get("x-request-id") || generateRequestId();
    const log = logger.withRequest(requestId);
    const start = Date.now();

    try {
      const response = await handler(request, { request, requestId, log });
      response.headers.set("x-request-id", requestId);
      log.info("request.completed", {
        method: request.method,
        path: request.nextUrl?.pathname,
        status: response.status,
        durationMs: Date.now() - start,
      });
      return response;
    } catch (error) {
      const { body, status } = errorResponse(error, requestId);
      log.warn("request.failed", {
        method: request.method,
        path: request.nextUrl?.pathname,
        status,
        durationMs: Date.now() - start,
      });
      const response = NextResponse.json(body, { status });
      response.headers.set("x-request-id", requestId);
      return response;
    }
  };
}

export default ApiError;
