# Monitoring

## Observability Strategy

_Describe the overall approach to observability for this project. What are the critical paths? What does "healthy" look like? What are the known failure modes?_

## Health Checks

| Endpoint | Interval | Expected Response |
|----------|----------|-------------------|
| _/healthz_ | _30s_ | _200 OK_ |
| _/readyz_ | _30s_ | _200 OK_ |
| _..._ | _..._ | _..._ |

## Error Tracking

_Describe how errors are captured, where they are reported, and how they are triaged. Include the tool/service used (e.g., Sentry, Datadog, custom) and any filtering or grouping rules._

## Logging

_Describe the structured logging format and conventions._

All logs must be structured JSON with at minimum:
- `timestamp` — ISO 8601
- `level` — debug, info, warn, error
- `service` — the emitting service name
- `correlationId` — request or trace ID for linking related log entries
- _...additional fields as needed..._

## Alerting Rules

| Metric | Threshold | Action |
|--------|-----------|--------|
| _Error rate_ | _> 1% over 5 min_ | _Page on-call engineer_ |
| _P95 latency_ | _> 2s over 5 min_ | _Page on-call engineer_ |
| _Health check failure_ | _3 consecutive failures_ | _Page on-call engineer_ |
| _..._ | _..._ | _..._ |

## Dashboards

_List the dashboards and what each one covers. One dashboard per concern._

- _API Performance_ — _request rate, latency percentiles, error rate_
- _Infrastructure_ — _CPU, memory, disk, network_
- _Business Metrics_ — _sign-ups, active users, key conversion events_
- _..._

---

## Product Analytics (PostHog)

### Overview

AgentOps Desktop uses **PostHog** for product analytics. The analytics module runs entirely in the main Electron process — no browser SDK, no CSP modifications required. Events from the renderer arrive via IPC and are batched to PostHog's `/batch/` API every 30 seconds.

### Architecture

```
Renderer (renderer.js)
  → window.app.analytics.track(event, props)
  → IPC invoke → Main process (analytics.ts)
  → Event queue → POST /batch/ → PostHog
```

### Configuration

Set these environment variables before launching:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTHOG_API_KEY` | Yes | — | PostHog project API key |
| `POSTHOG_HOST` | No | `https://us.i.posthog.com` | PostHog instance URL (EU: `https://eu.i.posthog.com`) |
| `ANALYTICS_OPT_OUT` | No | `false` | Set `true` to disable analytics on startup |
| `ANALYTICS_DEBUG` | No | `false` | Set `true` for verbose logging |
| `ANALYTICS_INTERNAL` | No | auto | Set `true` to mark as internal traffic. Auto-detected in unpackaged dev builds |

### Tracked Events

| Event | Trigger | Properties |
|-------|---------|------------|
| `app_started` | App window loads | `app_version`, `platform` |
| `page_view` | Navigation between views | `route` |
| `task_moved` | Task status changed | `task_id`, `new_status` |
| `modal_opened` | Modal dialog opened | `modal` |
| `user_login` | Successful login | `role` |
| `user_logout` | User signs out | — |

### Internal Traffic Filtering

Two mechanisms exclude internal/dev traffic from production analytics:

1. **`$internal` property** — Set to `true` when `ANALYTICS_INTERNAL=true` or when running unpackaged (`!app.isPackaged`). Create a PostHog cohort filtering `$internal = false` for production views.

2. **`$network_private` property** — Set to `true` when the machine has a private IP (10.x, 172.16-31.x, 192.168.x). Useful for excluding office/VPN traffic.

### PostHog Dashboard Setup

Create these filters/cohorts in PostHog:

- **Production users**: Filter `$internal = false`
- **Internal/testers**: Filter `$internal = true`
- **Key funnels**: `app_started` → `page_view` → `task_moved`

### Privacy

- No PII is collected. The `distinct_id` is a FNV-1a hash of `hostname + appVersion`.
- Users can opt out via `window.app.analytics.optOut()` or by setting `ANALYTICS_OPT_OUT=true`.
- All analytics traffic goes to PostHog (self-hostable). No third-party trackers.
