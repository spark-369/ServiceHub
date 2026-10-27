import {
  parsePagination,
  paginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "@/lib/api/pagination";

describe("lib/api/pagination", () => {
  describe("parsePagination", () => {
    it("returns defaults when no params are supplied", () => {
      expect(parsePagination(new URLSearchParams())).toEqual({
        page: DEFAULT_PAGE,
        limit: DEFAULT_LIMIT,
        skip: 0,
      });
    });

    it("parses page and limit", () => {
      expect(parsePagination(new URLSearchParams("page=3&limit=20"))).toEqual({
        page: 3,
        limit: 20,
        skip: 40,
      });
    });

    it("clamps limit to the maximum", () => {
      const { limit } = parsePagination(new URLSearchParams("limit=9999"));
      expect(limit).toBe(MAX_LIMIT);
    });

    it("coerces non-numeric page back to the default", () => {
      const { page, skip } = parsePagination(new URLSearchParams("page=abc"));
      expect(page).toBe(DEFAULT_PAGE);
      expect(skip).toBe(0);
    });

    it("coerces zero/negative page to the default", () => {
      expect(parsePagination(new URLSearchParams("page=0")).page).toBe(DEFAULT_PAGE);
      expect(parsePagination(new URLSearchParams("page=-5")).page).toBe(DEFAULT_PAGE);
    });

    it("coerces non-numeric limit to the default", () => {
      expect(parsePagination(new URLSearchParams("limit=xyz")).limit).toBe(DEFAULT_LIMIT);
    });

    it("honours custom default/max limits", () => {
      const result = parsePagination(new URLSearchParams("limit=500"), {
        defaultLimit: 5,
        maxLimit: 25,
      });
      expect(result.limit).toBe(25);
    });
  });

  describe("paginationMeta", () => {
    it("computes page counts", () => {
      expect(paginationMeta(1, 10, 25)).toEqual({ page: 1, limit: 10, total: 25, pages: 3 });
    });

    it("returns 0 pages when limit is 0", () => {
      expect(paginationMeta(1, 0, 25)).toEqual({ page: 1, limit: 0, total: 25, pages: 0 });
    });

    it("returns 0 pages for an empty result set", () => {
      expect(paginationMeta(2, 10, 0)).toEqual({ page: 2, limit: 10, total: 0, pages: 0 });
    });
  });
});
