/**
 * Minimal structured logger.
 *
 * Emits single-line JSON in production (friendly for log aggregation such as
 * Datadog / CloudWatch / Loki) and human-readable output in development.
 * Also supports correlating logs with a per-request id.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL || "").toLowerCase();
  if (configured === "debug" || configured === "info" || configured === "warn" || configured === "error") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel()];
}

function serialiseError(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }
  return { value: String(error) };
}

function emit(level: LogLevel, message: string, context: LogContext = {}) {
  if (!shouldLog(level)) return;

  const { error, requestId, ...rest } = context as LogContext & { error?: unknown };
  const timestamp = new Date().toISOString();

  if (process.env.NODE_ENV === "production") {
    const payload = {
      timestamp,
      level,
      message,
      requestId,
      ...rest,
      ...(error ? { error: serialiseError(error) } : {}),
    };
    const line = JSON.stringify(payload);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const prefix = `[${level.toUpperCase()}]${requestId ? ` (${requestId})` : ""}`;
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (error) {
    method(prefix, message, rest, error);
  } else {
    method(prefix, message, rest);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
  /** Create a logger bound to a request id. */
  withRequest(requestId: string) {
    return {
      debug: (message: string, context: LogContext = {}) =>
        emit("debug", message, { ...context, requestId }),
      info: (message: string, context: LogContext = {}) =>
        emit("info", message, { ...context, requestId }),
      warn: (message: string, context: LogContext = {}) =>
        emit("warn", message, { ...context, requestId }),
      error: (message: string, context: LogContext = {}) =>
        emit("error", message, { ...context, requestId }),
    };
  },
};

export function generateRequestId(): string {
  try {
    // Available in Node 19+ / Edge runtime
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // ignore and fall through
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type RequestLogger = ReturnType<typeof logger.withRequest>;
export default logger;
