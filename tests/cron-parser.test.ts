import { describe, it, expect } from "vitest";
import { parseCron, matchesCron, nextTriggerTimes, CronParseError } from "../src/main/cron-parser.js";

describe("CronParser", () => {
  describe("parseCron", () => {
    it("parses a simple every-minute expression", () => {
      const cron = parseCron("* * * * *");
      expect(cron.minute.values.size).toBe(60);
      expect(cron.hour.values.size).toBe(24);
      expect(cron.dayOfMonth.values.size).toBe(31);
      expect(cron.month.values.size).toBe(12);
      expect(cron.dayOfWeek.values.size).toBe(7);
    });

    it("parses step values (*/5)", () => {
      const cron = parseCron("*/5 * * * *");
      expect(cron.minute.values).toEqual(new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]));
    });

    it("parses range values (1-5)", () => {
      const cron = parseCron("0 9-17 * * *");
      expect(cron.hour.values).toEqual(new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]));
    });

    it("parses range with step (1-10/2)", () => {
      const cron = parseCron("0 0 1-10/2 * *");
      expect(cron.dayOfMonth.values).toEqual(new Set([1, 3, 5, 7, 9]));
    });

    it("parses comma-separated values (1,3,5)", () => {
      const cron = parseCron("0 0 * * 1,3,5");
      expect(cron.dayOfWeek.values).toEqual(new Set([1, 3, 5]));
    });

    it("parses month names", () => {
      const cron = parseCron("0 0 1 JAN,JUL *");
      expect(cron.month.values).toEqual(new Set([1, 7]));
    });

    it("parses day-of-week names", () => {
      const cron = parseCron("0 0 * * MON-FRI");
      expect(cron.dayOfWeek.values).toEqual(new Set([1, 2, 3, 4, 5]));
    });

    it("stores the raw expression", () => {
      const expr = "*/15 9-17 * * 1-5";
      const cron = parseCron(expr);
      expect(cron.raw).toBe(expr);
    });

    it("rejects expressions with wrong field count", () => {
      expect(() => parseCron("* * *")).toThrow(CronParseError);
      expect(() => parseCron("* * * * * *")).toThrow(CronParseError);
    });

    it("rejects out-of-range values", () => {
      expect(() => parseCron("60 * * * *")).toThrow(CronParseError);
      expect(() => parseCron("* 24 * * *")).toThrow(CronParseError);
      expect(() => parseCron("* * 0 * *")).toThrow(CronParseError);
      expect(() => parseCron("* * 32 * *")).toThrow(CronParseError);
    });

    it("rejects invalid range (start > end)", () => {
      expect(() => parseCron("0 17-9 * * *")).toThrow(CronParseError);
    });
  });

  describe("matchesCron", () => {
    it("matches every minute for * * * * *", () => {
      const cron = parseCron("* * * * *");
      expect(matchesCron(cron, new Date(2025, 0, 1, 12, 30))).toBe(true);
    });

    it("matches specific minute", () => {
      const cron = parseCron("30 * * * *");
      expect(matchesCron(cron, new Date(2025, 0, 1, 12, 30))).toBe(true);
      expect(matchesCron(cron, new Date(2025, 0, 1, 12, 15))).toBe(false);
    });

    it("matches specific hour and minute", () => {
      const cron = parseCron("0 9 * * *");
      expect(matchesCron(cron, new Date(2025, 0, 1, 9, 0))).toBe(true);
      expect(matchesCron(cron, new Date(2025, 0, 1, 10, 0))).toBe(false);
    });

    it("matches day of week (0=Sun)", () => {
      // 2025-01-06 is Monday
      const cron = parseCron("0 0 * * 1");
      expect(matchesCron(cron, new Date(2025, 0, 6, 0, 0))).toBe(true);
      // 2025-01-05 is Sunday
      expect(matchesCron(cron, new Date(2025, 0, 5, 0, 0))).toBe(false);
    });

    it("matches combined fields (weekdays at 9am)", () => {
      const cron = parseCron("0 9 * * 1-5");
      // Monday 9:00
      expect(matchesCron(cron, new Date(2025, 0, 6, 9, 0))).toBe(true);
      // Sunday 9:00
      expect(matchesCron(cron, new Date(2025, 0, 5, 9, 0))).toBe(false);
      // Monday 10:00
      expect(matchesCron(cron, new Date(2025, 0, 6, 10, 0))).toBe(false);
    });

    it("matches step values", () => {
      const cron = parseCron("*/15 * * * *");
      expect(matchesCron(cron, new Date(2025, 0, 1, 12, 0))).toBe(true);
      expect(matchesCron(cron, new Date(2025, 0, 1, 12, 15))).toBe(true);
      expect(matchesCron(cron, new Date(2025, 0, 1, 12, 7))).toBe(false);
    });
  });

  describe("nextTriggerTimes", () => {
    it("returns next N trigger times", () => {
      const cron = parseCron("0 * * * *"); // every hour at :00
      const after = new Date(2025, 0, 1, 12, 30);
      const nexts = nextTriggerTimes(cron, after, 3);
      expect(nexts).toHaveLength(3);
      expect(nexts[0].getHours()).toBe(13);
      expect(nexts[0].getMinutes()).toBe(0);
      expect(nexts[1].getHours()).toBe(14);
      expect(nexts[2].getHours()).toBe(15);
    });

    it("skips to next day when needed", () => {
      const cron = parseCron("0 9 * * *"); // daily at 9am
      const after = new Date(2025, 0, 1, 10, 0); // 10am
      const nexts = nextTriggerTimes(cron, after, 1);
      expect(nexts).toHaveLength(1);
      expect(nexts[0].getDate()).toBe(2); // next day
      expect(nexts[0].getHours()).toBe(9);
    });

    it("handles every-minute cron", () => {
      const cron = parseCron("* * * * *");
      const after = new Date(2025, 0, 1, 12, 58);
      const nexts = nextTriggerTimes(cron, after, 3);
      expect(nexts).toHaveLength(3);
      expect(nexts[0].getMinutes()).toBe(59);
      expect(nexts[1].getMinutes()).toBe(0);
      expect(nexts[2].getMinutes()).toBe(1);
    });
  });
});
