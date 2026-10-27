import {
  formatMoney,
  formatDate,
  formatDateTime,
  formatDuration,
  formatRating,
  formatMatchScore,
} from "@/lib/format";

describe("lib/format", () => {
  describe("formatMoney", () => {
    it("formats amounts as USD with two decimals", () => {
      expect(formatMoney(12)).toBe("$12.00");
      expect(formatMoney(12.5)).toBe("$12.50");
      expect(formatMoney(0)).toBe("$0.00");
      expect(formatMoney(1234.56)).toBe("$1234.56");
    });
  });

  describe("formatDate", () => {
    it("returns an em dash for empty input", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate(undefined)).toBe("—");
      expect(formatDate("")).toBe("—");
    });

    it("returns a non-empty date string for a valid date", () => {
      const result = formatDate(new Date("2024-03-15T12:00:00Z"));
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain("Invalid");
    });

    it("falls back to the raw string for an unparseable date string", () => {
      expect(formatDate("not-a-date")).toBe("not-a-date");
    });
  });

  describe("formatDateTime", () => {
    it("returns an em dash for empty input", () => {
      expect(formatDateTime(null)).toBe("—");
      expect(formatDateTime(undefined)).toBe("—");
    });

    it("returns a non-empty date-time string for a valid date", () => {
      const result = formatDateTime(new Date("2024-03-15T15:30:00Z"));
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain("Invalid");
    });

    it("falls back to the raw string for garbage input", () => {
      expect(formatDateTime("garbage")).toBe("garbage");
    });
  });

  describe("formatDuration", () => {
    it("renders minutes below an hour", () => {
      expect(formatDuration(45)).toBe("45m");
    });

    it("renders whole hours", () => {
      expect(formatDuration(60)).toBe("1h");
      expect(formatDuration(120)).toBe("2h");
    });

    it("renders mixed hours and minutes", () => {
      expect(formatDuration(90)).toBe("1h 30m");
    });

    it("returns an em dash for non-positive or invalid values", () => {
      expect(formatDuration(0)).toBe("—");
      expect(formatDuration(-5)).toBe("—");
      expect(formatDuration(Number.NaN)).toBe("—");
      expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("—");
    });
  });

  describe("formatRating", () => {
    it("formats a rating to one decimal", () => {
      expect(formatRating(4.2)).toBe("4.2");
      expect(formatRating(5)).toBe("5.0");
      expect(formatRating(0)).toBe("0.0");
      expect(formatRating(3.99)).toBe("4.0");
    });

    it("guards against null/NaN ratings", () => {
      expect(formatRating(null)).toBe("0.0");
      expect(formatRating(undefined)).toBe("0.0");
      expect(formatRating(Number.NaN)).toBe("0.0");
    });
  });

  describe("formatMatchScore", () => {
    it("clamps and rounds a 0-1 score to whole percents", () => {
      expect(formatMatchScore(0.834)).toBe("83%");
      expect(formatMatchScore(0)).toBe("0%");
      expect(formatMatchScore(1)).toBe("100%");
    });

    it("clamps out-of-range scores", () => {
      expect(formatMatchScore(-0.5)).toBe("0%");
      expect(formatMatchScore(2)).toBe("100%");
    });
  });
});
