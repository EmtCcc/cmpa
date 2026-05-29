/**
 * Lightweight input validation for HTTP API routes.
 * No external dependencies — pure TypeScript validation functions.
 */

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateString(
  value: unknown,
  field: string,
  opts?: { minLength?: number; maxLength?: number; pattern?: RegExp; enum?: readonly string[] },
): string {
  if (typeof value !== "string") {
    throw new ValidationError(field, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(field, `${field} must not be empty`);
  }
  if (opts?.minLength !== undefined && trimmed.length < opts.minLength) {
    throw new ValidationError(field, `${field} must be at least ${opts.minLength} characters`);
  }
  if (opts?.maxLength !== undefined && trimmed.length > opts.maxLength) {
    throw new ValidationError(field, `${field} must be at most ${opts.maxLength} characters`);
  }
  if (opts?.pattern && !opts.pattern.test(trimmed)) {
    throw new ValidationError(field, `${field} has invalid format`);
  }
  if (opts?.enum && !opts.enum.includes(trimmed)) {
    throw new ValidationError(field, `${field} must be one of: ${opts.enum.join(", ")}`);
  }
  return trimmed;
}

export function validateNumber(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number; integer?: boolean },
): number {
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || Number.isNaN(num)) {
    throw new ValidationError(field, `${field} must be a number`);
  }
  if (opts?.integer && !Number.isInteger(num)) {
    throw new ValidationError(field, `${field} must be an integer`);
  }
  if (opts?.min !== undefined && num < opts.min) {
    throw new ValidationError(field, `${field} must be at least ${opts.min}`);
  }
  if (opts?.max !== undefined && num > opts.max) {
    throw new ValidationError(field, `${field} must be at most ${opts.max}`);
  }
  return num;
}

export function validateOptionalString(
  value: unknown,
  field: string,
  opts?: { minLength?: number; maxLength?: number; pattern?: RegExp; enum?: readonly string[] },
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return validateString(value, field, opts);
}

export function validateOptionalNumber(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number; integer?: boolean },
): number | undefined {
  if (value === undefined || value === null) return undefined;
  return validateNumber(value, field, opts);
}

export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(field, `${field} must be a boolean`);
  }
  return value;
}

export function validateOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return validateBoolean(value, field);
}

export function validateUUID(value: unknown, field: string): string {
  const str = validateString(value, field);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(str)) {
    throw new ValidationError(field, `${field} must be a valid UUID`);
  }
  return str;
}

export function validateBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("body", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}
