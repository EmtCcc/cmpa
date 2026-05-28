import { safeStorage } from "electron";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Token manager with proper encryption.
 *
 * When Electron safeStorage is unavailable (headless Linux, CI, etc.),
 * tokens are held in-memory only — never persisted to disk as base64
 * or any other encoding that provides zero confidentiality.
 */

interface EncryptedPayload {
  method: "safeStorage";
  data: string;
}

export class TokenManager {
  private storePath: string;
  private cache = new Map<string, string>();

  constructor(storeDir: string) {
    this.storePath = join(storeDir, "tokens.enc.json");
    this.loadFromDisk();
  }

  private isEncryptionAvailable(): boolean {
    try {
      return !!safeStorage?.isEncryptionAvailable?.();
    } catch {
      return false;
    }
  }

  private loadFromDisk(): void {
    if (!existsSync(this.storePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.storePath, "utf-8")) as Record<string, EncryptedPayload>;
      for (const [key, payload] of Object.entries(raw)) {
        this.cache.set(key, JSON.stringify(payload));
      }
    } catch {
      // Corrupted store — start fresh rather than crash
    }
  }

  private persistToDisk(): void {
    const out: Record<string, EncryptedPayload> = {};
    for (const [key, serialized] of this.cache) {
      out[key] = JSON.parse(serialized);
    }
    writeFileSync(this.storePath, JSON.stringify(out, null, 2), "utf-8");
  }

  encrypt(plaintext: string): EncryptedPayload {
    if (!this.isEncryptionAvailable()) {
      throw new Error("safeStorage is unavailable — cannot encrypt for persistence");
    }
    const encrypted = safeStorage.encryptString(plaintext);
    return {
      method: "safeStorage",
      data: encrypted.toString("base64"),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    if (payload.method !== "safeStorage") {
      throw new Error(`Unknown encryption method: ${payload.method}`);
    }
    if (!this.isEncryptionAvailable()) {
      throw new Error("Cannot decrypt safeStorage payload: Electron safeStorage unavailable in this environment");
    }
    return safeStorage.decryptString(Buffer.from(payload.data, "base64"));
  }

  set(key: string, value: string): void {
    if (this.isEncryptionAvailable()) {
      const payload = this.encrypt(value);
      this.cache.set(key, JSON.stringify(payload));
      this.persistToDisk();
    } else {
      // In-memory only when safeStorage is unavailable
      this.cache.set(key, value);
    }
  }

  get(key: string): string | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;

    // Try to parse as encrypted payload
    try {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === "object" && "method" in parsed) {
        return this.decrypt(parsed);
      }
    } catch {
      // Not a valid JSON payload — treat as plaintext
    }

    // Plaintext (in-memory only token)
    return cached;
  }

  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed && this.isEncryptionAvailable()) {
      this.persistToDisk();
    }
    return existed;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    if (this.isEncryptionAvailable()) {
      this.persistToDisk();
    }
  }
}
