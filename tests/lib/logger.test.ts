import { logger, generateRequestId } from "@/lib/config/logger";

describe("lib/config/logger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  describe("generateRequestId", () => {
    it("returns a non-empty string", () => {
      expect(generateRequestId()).toBeTruthy();
    });

    it("returns unique ids", () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateRequestId()));
      expect(ids.size).toBe(50);
    });
  });

  describe("emit", () => {
    it("writes human-readable output in the test environment", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      logger.info("hello", { extra: 1 });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const [prefix, message, context] = logSpy.mock.calls[0];
      expect(prefix).toBe("[INFO]");
      expect(message).toBe("hello");
      expect(context).toEqual({ extra: 1 });
    });

    it("binds the request id via withRequest", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      const log = logger.withRequest("req-42");
      log.info("hello");

      expect(logSpy).toHaveBeenCalledTimes(1);
      const [prefix, message] = logSpy.mock.calls[0];
      expect(prefix).toBe("[INFO] (req-42)");
      expect(message).toBe("hello");
    });

    it("routes errors to console.error and passes the error object through", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("boom");

      logger.error("failed", { error });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toBe("[ERROR]");
      expect(errorSpy.mock.calls[0][1]).toBe("failed");
      expect(errorSpy.mock.calls[0][3]).toBe(error);
    });

    it("routes warnings to console.warn", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      logger.warn("careful");

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][1]).toBe("careful");
    });

    it("honours LOG_LEVEL filtering", () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      process.env.LOG_LEVEL = "error";

      logger.info("quiet");
      logger.error("loud");

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
