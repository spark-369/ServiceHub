import { GET as HealthGET } from "@/app/api/health/route";
import { GET as ReadyGET } from "@/app/api/health/ready/route";
import { prisma } from "@/lib/db/prisma";

jest.mock("@/lib/db/prisma");

describe("Health API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/health", () => {
    it("should report ok when database is reachable", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);

      const response = await HealthGET();
      const body = await (response as any).json();

      expect(body.status).toBe("ok");
      expect(body.checks.database).toBe("up");
    });

    it("should report degraded when database is down", async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error("down"));

      const response = await HealthGET();
      const body = await (response as any).json();

      expect(body.status).toBe("degraded");
      expect(body.checks.database).toBe("down");
    });
  });

  describe("GET /api/health/ready", () => {
    it("should return ready when database is reachable", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const response = await ReadyGET();
      const body = await (response as any).json();

      expect(body.ready).toBe(true);
    });

    it("should return not ready when database is down", async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error("down"));

      const response = await ReadyGET();
      const body = await (response as any).json();

      expect(body.ready).toBe(false);
    });
  });
});
