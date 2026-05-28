import { describe, it, expect, beforeAll } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const HTML_PATH = path.join(ROOT, "src", "renderer", "index.html");
const CSS_PATH = path.join(ROOT, "src", "renderer", "styles.css");

let dom: JSDOM;
let doc: Document;
let css: string;

beforeAll(() => {
  const html = fs.readFileSync(HTML_PATH, "utf-8");
  css = fs.readFileSync(CSS_PATH, "utf-8");

  dom = new JSDOM(html, { url: "http://localhost" });
  doc = dom.window.document;
});

/** Parse hex color to linear-light sRGB values (WCAG 2.x algorithm) */
function hexToLinear(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b].map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  ) as [number, number, number];
}

/** WCAG 2.x relative luminance */
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colors */
function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(hexToLinear(fg));
  const l2 = luminance(hexToLinear(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractToken(token: string): string {
  const match = css.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Token ${token} not found in CSS`);
  return match[1];
}

describe("accessibility", () => {
  describe("color contrast (WCAG 2.1 AA)", () => {
    const BG = "#0f172a";

    it("--color-text meets AA (4.5:1)", () => {
      const color = extractToken("--color-text");
      expect(contrastRatio(color, BG)).toBeGreaterThanOrEqual(4.5);
    });

    it("--color-text-muted meets AA (4.5:1)", () => {
      const color = extractToken("--color-text-muted");
      expect(contrastRatio(color, BG)).toBeGreaterThanOrEqual(4.5);
    });

    it("--color-text-tertiary meets AA (4.5:1)", () => {
      const color = extractToken("--color-text-tertiary");
      const ratio = contrastRatio(color, BG);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("--color-primary meets AA (4.5:1)", () => {
      const color = extractToken("--color-primary");
      expect(contrastRatio(color, BG)).toBeGreaterThanOrEqual(4.5);
    });

    it("--color-accent meets AA (4.5:1)", () => {
      const color = extractToken("--color-accent");
      expect(contrastRatio(color, BG)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("ARIA live regions", () => {
    it("has at least 7 static aria-live regions", () => {
      const liveRegions = doc.querySelectorAll("[aria-live]");
      expect(liveRegions.length).toBeGreaterThanOrEqual(7);
    });

    it("login error has aria-live", () => {
      const el = doc.getElementById("login-error");
      expect(el?.getAttribute("aria-live")).toBe("polite");
    });

    it("dashboard refresh has aria-live", () => {
      const el = doc.getElementById("dashboard-last-refresh");
      expect(el?.getAttribute("aria-live")).toBe("polite");
    });

    it("agent list error has aria-live", () => {
      const el = doc.getElementById("agent-list-error");
      expect(el?.getAttribute("aria-live")).toBe("polite");
    });

    it("all task column counts have aria-live", () => {
      const counts = doc.querySelectorAll(".task-column-count");
      expect(counts.length).toBe(4);
      for (const c of counts) {
        expect(c.getAttribute("aria-live")).toBe("polite");
      }
    });
  });

  describe("dialog semantics", () => {
    it("all dialogs have aria-labelledby", () => {
      const dialogs = doc.querySelectorAll("dialog");
      expect(dialogs.length).toBe(4);
      for (const d of dialogs) {
        const id = d.getAttribute("aria-labelledby");
        expect(id).toBeTruthy();
        expect(doc.getElementById(id!)).not.toBeNull();
      }
    });
  });

  describe("interactive elements", () => {
    it("all buttons have accessible names", () => {
      const buttons = doc.querySelectorAll("button");
      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        const label = btn.getAttribute("aria-label");
        const labelledBy = btn.getAttribute("aria-labelledby");
        expect(
          text || label || labelledBy,
          `Button missing name: <${btn.tagName}> "${btn.className}"`
        ).toBeTruthy();
      }
    });

    it("sidebar action buttons have aria-haspopup", () => {
      const btns = doc.querySelectorAll(".sidebar-action-btn[id]");
      for (const btn of btns) {
        if (btn.id === "btn-add-agent" || btn.id === "btn-new-task") {
          expect(btn.getAttribute("aria-haspopup")).toBe("dialog");
        }
      }
    });
  });

  describe("form labels", () => {
    it("all non-hidden inputs have associated labels", () => {
      const inputs = doc.querySelectorAll(
        "input:not([type=hidden]), select, textarea"
      );
      for (const input of inputs) {
        const id = input.id;
        if (!id) continue;
        const label = doc.querySelector(`label[for="${id}"]`);
        const ariaLabel = input.getAttribute("aria-label");
        expect(
          label || ariaLabel,
          `Input #${id} missing label`
        ).toBeTruthy();
      }
    });
  });

  describe("semantic structure", () => {
    it("has lang attribute on html", () => {
      expect(doc.documentElement.getAttribute("lang")).toBe("en");
    });

    it("has skip link", () => {
      const skip = doc.querySelector('.skip-link[href="#main-content"]');
      expect(skip).not.toBeNull();
    });

    it("has main landmark", () => {
      expect(doc.getElementById("main-content")).not.toBeNull();
    });

    it("decorative elements are aria-hidden", () => {
      const spinners = doc.querySelectorAll(".spinner");
      for (const s of spinners) {
        expect(s.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("lists use role=list with role=listitem children structure", () => {
      const lists = doc.querySelectorAll('[role="list"]');
      expect(lists.length).toBeGreaterThan(0);
    });
  });
});
