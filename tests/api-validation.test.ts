import { describe, it, expect } from "vitest";
import {
  validateString,
  validateNumber,
  validateUUID,
  validateBody,
  ValidationError,
  validateOptionalString,
  validateOptionalNumber,
} from "../src/api/validation.js";

describe("validateString", () => {
  it("accepts valid string", () => {
    expect(validateString("hello", "name")).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(validateString("  hello  ", "name")).toBe("hello");
  });

  it("rejects non-string", () => {
    expect(() => validateString(123, "name")).toThrow(ValidationError);
  });

  it("rejects empty string after trim", () => {
    expect(() => validateString("   ", "name")).toThrow(ValidationError);
  });

  it("enforces minLength", () => {
    expect(() => validateString("ab", "name", { minLength: 3 })).toThrow(ValidationError);
    expect(validateString("abc", "name", { minLength: 3 })).toBe("abc");
  });

  it("enforces maxLength", () => {
    expect(() => validateString("abcd", "name", { maxLength: 3 })).toThrow(ValidationError);
    expect(validateString("abc", "name", { maxLength: 3 })).toBe("abc");
  });

  it("enforces enum", () => {
    expect(() => validateString("invalid", "status", { enum: ["active", "inactive"] as const })).toThrow(ValidationError);
    expect(validateString("active", "status", { enum: ["active", "inactive"] as const })).toBe("active");
  });

  it("enforces pattern", () => {
    expect(() => validateString("abc", "code", { pattern: /^\d+$/ })).toThrow(ValidationError);
    expect(validateString("123", "code", { pattern: /^\d+$/ })).toBe("123");
  });
});

describe("validateNumber", () => {
  it("accepts valid number", () => {
    expect(validateNumber(42, "priority")).toBe(42);
  });

  it("accepts numeric string", () => {
    expect(validateNumber("42", "priority")).toBe(42);
  });

  it("rejects non-numeric", () => {
    expect(() => validateNumber("abc", "priority")).toThrow(ValidationError);
  });

  it("enforces integer", () => {
    expect(() => validateNumber(1.5, "priority", { integer: true })).toThrow(ValidationError);
    expect(validateNumber(1, "priority", { integer: true })).toBe(1);
  });

  it("enforces min/max", () => {
    expect(() => validateNumber(-1, "priority", { min: 0 })).toThrow(ValidationError);
    expect(() => validateNumber(101, "priority", { max: 100 })).toThrow(ValidationError);
  });
});

describe("validateUUID", () => {
  it("accepts valid UUID", () => {
    expect(validateUUID("550e8400-e29b-41d4-a716-446655440000", "id")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid UUID", () => {
    expect(() => validateUUID("not-a-uuid", "id")).toThrow(ValidationError);
  });
});

describe("validateBody", () => {
  it("accepts valid object", () => {
    expect(validateBody({ key: "value" })).toEqual({ key: "value" });
  });

  it("rejects null", () => {
    expect(() => validateBody(null)).toThrow(ValidationError);
  });

  it("rejects array", () => {
    expect(() => validateBody([])).toThrow(ValidationError);
  });
});

describe("validateOptionalString", () => {
  it("returns undefined for undefined", () => {
    expect(validateOptionalString(undefined, "name")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(validateOptionalString(null, "name")).toBeUndefined();
  });

  it("validates when present", () => {
    expect(validateOptionalString("hello", "name")).toBe("hello");
    expect(() => validateOptionalString(123, "name")).toThrow(ValidationError);
  });
});

describe("validateOptionalNumber", () => {
  it("returns undefined for undefined", () => {
    expect(validateOptionalNumber(undefined, "priority")).toBeUndefined();
  });

  it("validates when present", () => {
    expect(validateOptionalNumber(42, "priority")).toBe(42);
    expect(() => validateOptionalNumber("abc", "priority")).toThrow(ValidationError);
  });
});
