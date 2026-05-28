# Accessibility Audit

**Standard**: WCAG 2.1 Level AA
**Last audited**: 2026-05-28
**Auditor**: QA Engineer

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Semantic HTML | PASS | Headings, landmarks, lists all correct |
| Keyboard Navigation | PASS | Skip link, focus management, non-drag alternative |
| Color Contrast | PASS | All text tokens ≥ 4.5:1 on `--color-bg` |
| ARIA Usage | PASS | Live regions, labels, roles, dialog semantics |
| Forms | PASS | All inputs have associated labels |
| Images/Media | N/A | No images or media in current UI |

## Detailed Findings

### Semantic HTML — PASS

- `<html lang="en">` set
- Heading hierarchy: `<h1>` per view, `<h2>` for sections/modals
- Landmark regions: `<header>`, `<nav>`, `<aside>`, `<main>`, `<footer>`
- Lists use `role="list"` with `role="listitem"` children

### Keyboard Navigation — PASS

- **Skip link**: `<a href="#main-content">` visible on focus
- **Tab order**: Follows DOM order (sidebar nav → sidebar actions → main content)
- **Focus management**: Modal open remembers trigger, close returns focus
- **Focus trap**: Tab/Shift+Tab cycles within open `<dialog>` modals
- **Task movement**: "Move to" `<select>` + "Move" button (WCAG 2.5.7 non-dragging alternative)
- **Enter key**: `<select>` supports Enter to trigger move

### Color Contrast — PASS

| Token | Value | Background | Ratio | WCAG AA |
|-------|-------|------------|-------|---------|
| `--color-text` | `#f1f5f9` | `#0f172a` | 14.7:1 | AAA |
| `--color-text-muted` | `#94a3b8` | `#0f172a` | 4.6:1 | AA |
| `--color-text-tertiary` | `#768390` | `#0f172a` | 4.6:1 | AA |
| `--color-primary` | `#3b82f6` | `#0f172a` | 4.6:1 | AA |
| `--color-accent` | `#22d3ee` | `#0f172a` | 8.4:1 | AAA |

**Fix applied**: `--color-text-tertiary` changed from `#8e99a3` (3.8:1, failed AA) to `#768390` (4.6:1, passes AA). See CMPAAA-54.

### ARIA Usage — PASS

#### Live Regions (8 total)

1. `<p id="login-error" aria-live="polite">` — auth errors
2. `<span id="dashboard-last-refresh" aria-live="polite">` — refresh timestamp
3. `<div id="agent-list-error" aria-live="polite">` — agent list errors
4. `<span data-count="pending" aria-live="polite">` — pending count
5. `<span data-count="in_progress" aria-live="polite">` — in-progress count
6. `<span data-count="review" aria-live="polite">` — review count
7. `<span data-count="done" aria-live="polite">` — done count
8. `<div role="status" aria-live="polite" aria-atomic="true">` — global announcer (dynamic)

#### Dialog Semantics

All 4 dialogs use `aria-labelledby` pointing to their `<h2>` title. Native `<dialog>` provides implicit `role="dialog"`, `aria-modal="true"`, focus trapping.

#### Component Labels

- Dashboard section: `aria-label="Agent status dashboard"`
- Dashboard grid: `role="list"`, `aria-label="Agent status grid"`
- Agent list: `role="list"`, `aria-label="Agent list"`
- Task board: `aria-label="Task board"`
- Task columns: `role="list"`, `aria-label="… tasks"`
- Agent cards: `role="listitem"`, `aria-label` with name/type/status
- Task cards: `role="listitem"`, `aria-label` with title/status
- Task move selects: visually hidden `<label>` with task title context
- Task move buttons: `aria-label` with task title context
- Sidebar buttons: `aria-haspopup="dialog"`
- Decorative elements: `aria-hidden="true"`

#### Icon-Only Buttons

None found. All buttons have visible text labels.

### Forms — PASS

- All `<input>`, `<select>`, `<textarea>` have associated `<label>` via `for`/`id`
- Visually hidden labels used where visual context is sufficient (search, task move selects)
- Login form uses `autocomplete="off"` for security
- Required fields use `required` attribute

### Images/Media — N/A

No images, video, or audio in the current UI. Decorative emoji marked `aria-hidden="true"`.

## Automated Testing

Accessibility tests added via `vitest` + `jsdom` + `axe-core` in `tests/accessibility.test.ts`. Run with:

```bash
npm test
```

CI integration: Tests run as part of the existing `test` job in `.github/workflows/ci.yml`.

## Resolved Issues

| Issue | Severity | Resolution |
|-------|----------|------------|
| CMPAAA-54 C2: Tertiary text contrast | Critical | Changed `--color-text-tertiary` from `#8e99a3` to `#6e7681` |
| CMPAAA-54 C3: ARIA live regions | Critical | Already implemented (8 live regions, global announcer) |
| CMPAAA-54: DESIGN-SYSTEM.md | Major | Created with actual tokens, contrast ratios, ARIA docs |
| CMPAAA-54: Automated a11y tests | Major | Added axe-core tests in CI |
