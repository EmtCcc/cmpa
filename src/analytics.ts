/**
 * PostHog analytics for AgentOps Desktop.
 *
 * Runs entirely in the main process — no browser SDK, no CSP changes needed.
 * Events from the renderer arrive via IPC and are batched to PostHog's /batch API.
 *
 * Environment variables:
 *   POSTHOG_API_KEY    — Project API key (required to enable)
 *   POSTHOG_HOST       — Self-hosted URL (default: https://us.i.posthog.com)
 *   ANALYTICS_OPT_OUT  — "true" to disable on startup
 *   ANALYTICS_DEBUG    — "true" for verbose logging
 *   ANALYTICS_INTERNAL — "true" to mark as internal/dev traffic (excluded from production views)
 */

import { app } from "electron";
import { hostname, networkInterfaces } from "node:os";

// ── Types ──

export interface AnalyticsConfig {
  apiKey: string;
  host: string;
  optOut: boolean;
  debug: boolean;
  distinctId: string;
  isInternal: boolean;
}

interface PostHogEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
  distinct_id: string;
}

// ── State ──

let _config: AnalyticsConfig | null = null;
let _eventQueue: PostHogEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
const FLUSH_INTERVAL_MS = 30_000; // 30s batch window
const MAX_QUEUE_SIZE = 100;

// ── Config ──

export function getAnalyticsConfig(): AnalyticsConfig | null {
  if (_config) return _config;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    if (process.env.ANALYTICS_DEBUG === "true") {
      console.warn("[analytics] POSTHOG_API_KEY not set — analytics disabled");
    }
    return null;
  }

  _config = {
    apiKey,
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    optOut: process.env.ANALYTICS_OPT_OUT === "true",
    debug: process.env.ANALYTICS_DEBUG === "true",
    distinctId: generateDistinctId(),
    // Auto-detect: explicit flag OR unpackaged dev build
    isInternal: process.env.ANALYTICS_INTERNAL === "true" || !app.isPackaged,
  };

  if (_config.debug) {
    console.log("[analytics] initialized:", {
      host: _config.host,
      distinctId: _config.distinctId,
      optOut: _config.optOut,
      isInternal: _config.isInternal,
    });
  }

  return _config;
}

/**
 * Boot the analytics flush loop. Call once after app.whenReady().
 */
export function startAnalytics(): void {
  const cfg = getAnalyticsConfig();
  if (!cfg || cfg.optOut) return;

  _flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  // Flush on quit
  app.on("will-quit", () => {
    flush();
    if (_flushTimer) clearInterval(_flushTimer);
  });
}

// ── Tracking API (called from IPC handlers) ──

/**
 * Track a named event with optional properties.
 */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  const cfg = getAnalyticsConfig();
  if (!cfg || cfg.optOut) return;

  const enriched: PostHogEvent = {
    event,
    distinct_id: cfg.distinctId,
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      // App metadata
      $app_version: app.getVersion(),
      $os: process.platform,
      // Internal flag — use PostHog "internal" filter or cohort to exclude
      $internal: cfg.isInternal,
      // Network context for IP-based filtering
      $network_private: detectPrivateIp() !== null,
      // Library identifier
      $lib: "agentops-desktop",
      $lib_version: app.getVersion(),
    },
  };

  _eventQueue.push(enriched);
  if (cfg.debug) console.log("[analytics] queued:", event, properties);

  // Flush immediately if queue is large
  if (_eventQueue.length >= MAX_QUEUE_SIZE) {
    flush();
  }
}

/**
 * Identify the current user (sets person properties).
 * For desktop apps, this is typically the hashed machine ID.
 */
export function identify(distinctId: string, properties: Record<string, unknown> = {}): void {
  const cfg = getAnalyticsConfig();
  if (!cfg || cfg.optOut) return;

  track("$identify", {
    $set: properties,
    distinct_id: distinctId,
  });
}

/**
 * Opt out of analytics. Clears the queue and stops the flush timer.
 */
export function optOut(): void {
  if (_config) _config.optOut = true;
  _eventQueue = [];
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  if (_config?.debug) console.log("[analytics] opted out");
}

/**
 * Opt back in. Restarts the flush loop.
 */
export function optIn(): void {
  if (_config) _config.optOut = false;
  startAnalytics();
  if (_config?.debug) console.log("[analytics] opted in");
}

// ── Flush ──

async function flush(): Promise<void> {
  if (_eventQueue.length === 0) return;

  const cfg = getAnalyticsConfig();
  if (!cfg || cfg.optOut) {
    _eventQueue = [];
    return;
  }

  const batch = _eventQueue.splice(0, MAX_QUEUE_SIZE);
  const url = `${cfg.host.replace(/\/$/, "")}/batch/`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.apiKey,
        batch: batch.map((e) => ({
          event: e.event,
          properties: e.properties,
          timestamp: e.timestamp,
          distinct_id: e.distinct_id,
        })),
      }),
    });

    if (!res.ok && cfg.debug) {
      console.warn("[analytics] flush failed:", res.status, await res.text());
    } else if (cfg.debug) {
      console.log("[analytics] flushed", batch.length, "events");
    }
  } catch (err) {
    // Network errors are non-fatal — re-queue for next flush
    if (cfg.debug) console.warn("[analytics] flush error:", err);
    _eventQueue.unshift(...batch);
  }
}

// ── Helpers ──

function generateDistinctId(): string {
  const raw = `${hostname()}-${app.getVersion()}`;
  return fnv1a(raw);
}

/**
 * Detect if the machine has a private/local IP.
 * Returns the first private IP found, or null if on a public network.
 */
function detectPrivateIp(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.internal || net.family !== "IPv4") continue;
      const parts = net.address.split(".").map(Number);
      // 10.x.x.x, 172.16-31.x.x, 192.168.x.x
      if (
        parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
      ) {
        return net.address;
      }
    }
  }
  return null;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `anon_${hash.toString(16).padStart(8, "0")}`;
}

/**
 * Reset state (for testing).
 */
export function _reset(): void {
  _config = null;
  _eventQueue = [];
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
}
