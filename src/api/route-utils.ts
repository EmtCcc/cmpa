/**
 * Shared utilities for HTTP API route handlers.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { ValidationError } from "./validation.js";
import { AuthenticationError } from "./middleware/auth.js";

export interface JsonResponse {
  status: number;
  body: unknown;
}

export function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new ValidationError("body", "Invalid JSON in request body"));
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof ValidationError) {
    sendJson(res, 400, { error: "Validation error", field: error.field, message: error.message });
    return;
  }
  if (error instanceof AuthenticationError) {
    sendJson(res, 401, { error: "Authentication error", message: error.message });
    return;
  }
  const err = error as { statusCode?: number; message?: string };
  if (err.statusCode === 403) {
    sendJson(res, 403, { error: "Forbidden", message: err.message });
    return;
  }
  console.error("Unhandled API error:", error);
  sendJson(res, 500, { error: "Internal server error" });
}

export function getPathParam(path: string, prefix: string): string | undefined {
  const suffix = path.slice(prefix.length);
  if (suffix.startsWith("/")) {
    const id = suffix.slice(1).split("/")[0];
    return id || undefined;
  }
  return undefined;
}
