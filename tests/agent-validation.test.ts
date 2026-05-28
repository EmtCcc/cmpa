import { describe, it, expect } from "vitest";
import {
  validateName,
  validateAgentType,
  validatePath,
  validateOptionalPath,
  validateConfigJson,
  validateCreateInput,
  validateUpdateInput,
  AgentValidationError,
} from "../src/main/agent-validation.js";
import { AGENT_TYPES } from "../src/shared/types.js";

describe("validateName", () => {
  it("accepts valid name", () => {
    expect(validateName("my-agent")).toBe("my-agent");
  });

  it("trims whitespace", () => {
    expect(validateName("  agent  ")).toBe("agent");
  });

  it("rejects non-string", () => {
    expect(() => validateName(123)).toThrow(AgentValidationError);
  });

  it("rejects empty string", () => {
    expect(() => validateName("")).toThrow(AgentValidationError);
    expect(() => validateName("   ")).toThrow(AgentValidationError);
  });

  it("rejects overly long name", () => {
    expect(() => validateName("a".repeat(257))).toThrow(AgentValidationError);
  });
});

describe("validateAgentType", () => {
  it.each(AGENT_TYPES)("accepts valid type: %s", (type) => {
    expect(validateAgentType(type)).toBe(type);
  });

  it("rejects unknown type", () => {
    expect(() => validateAgentType("unknown")).toThrow(AgentValidationError);
  });

  it("rejects non-string", () => {
    expect(() => validateAgentType(42)).toThrow(AgentValidationError);
  });
});

describe("validatePath", () => {
  it("accepts valid path", () => {
    expect(validatePath("/usr/bin/agent", "path")).toBe("/usr/bin/agent");
  });

  it("trims whitespace", () => {
    expect(validatePath("  /usr/bin  ", "path")).toBe("/usr/bin");
  });

  it("rejects null bytes", () => {
    expect(() => validatePath("/usr/bin\0/evil", "path")).toThrow(AgentValidationError);
    expect(() => validatePath("/usr/bin\0/evil", "path")).toThrow("null bytes");
  });

  it("rejects path traversal", () => {
    expect(() => validatePath("/usr/../etc/passwd", "path")).toThrow(AgentValidationError);
    expect(() => validatePath("/usr/../etc/passwd", "path")).toThrow("path traversal");
    expect(() => validatePath("../etc/passwd", "path")).toThrow("path traversal");
  });

  it("rejects non-string", () => {
    expect(() => validatePath(123, "path")).toThrow(AgentValidationError);
  });

  it("rejects empty path", () => {
    expect(() => validatePath("", "path")).toThrow(AgentValidationError);
  });

  it("rejects overly long path", () => {
    expect(() => validatePath("/".repeat(4097), "path")).toThrow(AgentValidationError);
  });

  it("enforces requireAbsolute", () => {
    expect(() => validatePath("relative/path", "path", { requireAbsolute: true })).toThrow(
      AgentValidationError
    );
    expect(() => validatePath("relative/path", "path", { requireAbsolute: true })).toThrow(
      "absolute path"
    );
    expect(validatePath("/absolute/path", "path", { requireAbsolute: true })).toBe(
      "/absolute/path"
    );
  });
});

describe("validateOptionalPath", () => {
  it("accepts null", () => {
    expect(validateOptionalPath(null, "path")).toBeNull();
  });

  it("accepts undefined", () => {
    expect(validateOptionalPath(undefined, "path")).toBeUndefined();
  });

  it("validates non-null values", () => {
    expect(validateOptionalPath("/usr/bin", "path")).toBe("/usr/bin");
    expect(() => validateOptionalPath("../evil", "path")).toThrow(AgentValidationError);
  });
});

describe("validateConfigJson", () => {
  it("accepts valid JSON object", () => {
    expect(validateConfigJson('{"key":"value"}')).toBe('{"key":"value"}');
  });

  it("accepts empty object", () => {
    expect(validateConfigJson("{}")).toBe("{}");
  });

  it("accepts valid JSON array", () => {
    expect(validateConfigJson("[1,2,3]")).toBe("[1,2,3]");
  });

  it("rejects invalid JSON", () => {
    expect(() => validateConfigJson("{invalid}")).toThrow(AgentValidationError);
    expect(() => validateConfigJson("{invalid}")).toThrow("valid JSON");
  });

  it("rejects non-string", () => {
    expect(() => validateConfigJson(42)).toThrow(AgentValidationError);
  });

  it("rejects overly long config", () => {
    expect(() => validateConfigJson("a".repeat(65537))).toThrow(AgentValidationError);
  });
});

describe("validateCreateInput", () => {
  it("validates minimal input", () => {
    const result = validateCreateInput({ name: "agent", role: "coder" });
    expect(result).toEqual({ name: "agent", role: "coder" });
  });

  it("validates full input with all fields", () => {
    const result = validateCreateInput({
      name: "my-agent",
      role: "coder",
      status: "active",
      config: "{}",
      executable_path: "/usr/bin/claude",
      working_directory: "/home/user/project",
      agent_type: "claude-code",
      config_json: '{"model":"opus"}',
    });
    expect(result.name).toBe("my-agent");
    expect(result.role).toBe("coder");
    expect(result.agent_type).toBe("claude-code");
    expect(result.executable_path).toBe("/usr/bin/claude");
    expect(result.working_directory).toBe("/home/user/project");
    expect(result.config_json).toBe('{"model":"opus"}');
  });

  it("rejects missing name", () => {
    expect(() => validateCreateInput({ role: "coder" })).toThrow(AgentValidationError);
  });

  it("rejects missing role", () => {
    expect(() => validateCreateInput({ name: "agent" })).toThrow(AgentValidationError);
  });

  it("rejects invalid agent_type", () => {
    expect(() =>
      validateCreateInput({ name: "agent", role: "coder", agent_type: "invalid" })
    ).toThrow(AgentValidationError);
  });

  it("rejects path traversal in executable_path", () => {
    expect(() =>
      validateCreateInput({ name: "agent", role: "coder", executable_path: "../evil" })
    ).toThrow(AgentValidationError);
  });

  it("rejects null bytes in working_directory", () => {
    expect(() =>
      validateCreateInput({
        name: "agent",
        role: "coder",
        working_directory: "/path\0/evil",
      })
    ).toThrow(AgentValidationError);
  });

  it("rejects invalid config_json", () => {
    expect(() =>
      validateCreateInput({ name: "agent", role: "coder", config_json: "not-json" })
    ).toThrow(AgentValidationError);
  });
});

describe("validateUpdateInput", () => {
  it("allows partial input", () => {
    const result = validateUpdateInput({ name: "updated" });
    expect(result).toEqual({ name: "updated" });
  });

  it("validates all provided fields", () => {
    const result = validateUpdateInput({
      name: "updated",
      agent_type: "codex",
      executable_path: "/usr/bin/codex",
      config_json: '{"key":"val"}',
    });
    expect(result.name).toBe("updated");
    expect(result.agent_type).toBe("codex");
    expect(result.executable_path).toBe("/usr/bin/codex");
    expect(result.config_json).toBe('{"key":"val"}');
  });

  it("allows null for optional paths", () => {
    const result = validateUpdateInput({ executable_path: null, working_directory: null });
    expect(result.executable_path).toBeNull();
    expect(result.working_directory).toBeNull();
  });

  it("rejects invalid agent_type", () => {
    expect(() => validateUpdateInput({ agent_type: "bad" })).toThrow(AgentValidationError);
  });

  it("rejects path traversal", () => {
    expect(() => validateUpdateInput({ executable_path: "../evil" })).toThrow(AgentValidationError);
  });
});
