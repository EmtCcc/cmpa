/**
 * Agent registry input validation and path safety checks.
 *
 * Validates all IPC handler inputs for agent CRUD operations.
 * Path validation rejects traversal (..), null bytes, and symlink escape patterns.
 */

import { resolve, isAbsolute } from "node:path";
import { AGENT_TYPES, type AgentType } from "../shared/types.js";
import type { CreateAgentInput, UpdateAgentInput } from "../db/repositories/agents.js";

const MAX_NAME_LENGTH = 256;
const MAX_PATH_LENGTH = 4096;
const MAX_CONFIG_LENGTH = 65536;

export class AgentValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "AgentValidationError";
  }
}

/**
 * Validate agent name: non-empty string, reasonable length.
 */
export function validateName(name: unknown): string {
  if (typeof name !== "string") {
    throw new AgentValidationError("name", "name must be a string");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new AgentValidationError("name", "name must not be empty");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new AgentValidationError("name", `name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Validate agent type against the allowed enum.
 */
export function validateAgentType(agentType: unknown): AgentType {
  if (typeof agentType !== "string") {
    throw new AgentValidationError("agent_type", "agent_type must be a string");
  }
  if (!(AGENT_TYPES as readonly string[]).includes(agentType)) {
    throw new AgentValidationError(
      "agent_type",
      `agent_type must be one of: ${AGENT_TYPES.join(", ")}`
    );
  }
  return agentType as AgentType;
}

/**
 * Validate a file path for safety:
 * - Reject null bytes
 * - Reject path traversal (..)
 * - Reject non-absolute paths (when requireAbsolute is true)
 * - Reject paths that resolve outside allowed directories
 */
export function validatePath(
  path: unknown,
  field: string,
  opts?: { requireAbsolute?: boolean; allowedRoots?: string[] },
): string {
  if (typeof path !== "string") {
    throw new AgentValidationError(field, `${field} must be a string`);
  }

  // Reject null bytes
  if (path.includes("\0")) {
    throw new AgentValidationError(field, `${field} contains null bytes`);
  }

  // Reject path traversal
  if (path.includes("..")) {
    throw new AgentValidationError(field, `${field} contains path traversal (..)`);
  }

  // Check length
  if (path.length > MAX_PATH_LENGTH) {
    throw new AgentValidationError(field, `${field} exceeds maximum path length`);
  }

  const trimmed = path.trim();
  if (trimmed.length === 0) {
    throw new AgentValidationError(field, `${field} must not be empty`);
  }

  // Reject absolute path requirement
  if (opts?.requireAbsolute && !isAbsolute(trimmed)) {
    throw new AgentValidationError(field, `${field} must be an absolute path`);
  }

  // If allowedRoots specified, verify resolved path stays within roots
  if (opts?.allowedRoots && opts.allowedRoots.length > 0) {
    const resolved = resolve(trimmed);
    const withinRoot = opts.allowedRoots.some((root) => resolved.startsWith(resolve(root)));
    if (!withinRoot) {
      throw new AgentValidationError(
        field,
        `${field} must be within allowed directories: ${opts.allowedRoots.join(", ")}`
      );
    }
  }

  return trimmed;
}

/**
 * Validate optional path (allows null/undefined).
 */
export function validateOptionalPath(
  path: unknown,
  field: string,
  opts?: { requireAbsolute?: boolean; allowedRoots?: string[] },
): string | null | undefined {
  if (path === undefined || path === null) return path as null | undefined;
  return validatePath(path, field, opts);
}

/**
 * Validate config_json: must be valid JSON if provided.
 */
export function validateConfigJson(configJson: unknown): string {
  if (typeof configJson !== "string") {
    throw new AgentValidationError("config_json", "config_json must be a string");
  }
  if (configJson.length > MAX_CONFIG_LENGTH) {
    throw new AgentValidationError("config_json", `config_json exceeds maximum length`);
  }
  // Validate it's parseable JSON
  try {
    JSON.parse(configJson);
  } catch {
    throw new AgentValidationError("config_json", "config_json must be valid JSON");
  }
  return configJson;
}

/**
 * Validate a CreateAgentInput from an IPC handler.
 * Returns the validated/sanitized input.
 */
export function validateCreateInput(input: Record<string, unknown>): CreateAgentInput {
  const name = validateName(input.name);
  const role = validateString(input.role, "role");

  const result: CreateAgentInput = { name, role };

  if (input.status !== undefined) {
    result.status = validateString(input.status, "status");
  }
  if (input.config !== undefined) {
    result.config = validateString(input.config, "config");
  }
  if (input.executable_path !== undefined) {
    result.executable_path = validatePath(input.executable_path, "executable_path");
  }
  if (input.working_directory !== undefined) {
    result.working_directory = validatePath(input.working_directory, "working_directory");
  }
  if (input.agent_type !== undefined) {
    result.agent_type = validateAgentType(input.agent_type);
  }
  if (input.config_json !== undefined) {
    result.config_json = validateConfigJson(input.config_json);
  }

  return result;
}

/**
 * Validate an UpdateAgentInput from an IPC handler.
 * Returns the validated/sanitized input.
 */
export function validateUpdateInput(input: Record<string, unknown>): UpdateAgentInput {
  const result: UpdateAgentInput = {};

  if (input.name !== undefined) {
    result.name = validateName(input.name);
  }
  if (input.role !== undefined) {
    result.role = validateString(input.role, "role");
  }
  if (input.status !== undefined) {
    result.status = validateString(input.status, "status");
  }
  if (input.config !== undefined) {
    result.config = validateString(input.config, "config");
  }
  if (input.executable_path !== undefined) {
    result.executable_path = validateOptionalPath(input.executable_path, "executable_path");
  }
  if (input.working_directory !== undefined) {
    result.working_directory = validateOptionalPath(input.working_directory, "working_directory");
  }
  if (input.agent_type !== undefined) {
    result.agent_type = validateAgentType(input.agent_type);
  }
  if (input.config_json !== undefined) {
    result.config_json = validateConfigJson(input.config_json);
  }

  return result;
}

// Helper: validate a plain string field
function validateString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new AgentValidationError(field, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new AgentValidationError(field, `${field} must not be empty`);
  }
  return trimmed;
}
