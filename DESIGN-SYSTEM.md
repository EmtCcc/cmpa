# AgentOps Desktop — Design System

## Keyboard Shortcuts

All shortcuts use `Cmd` on macOS and `Ctrl` on Windows/Linux.

### Global Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` | Open command palette / search | Anywhere — focuses the global search input in the header |
| `Cmd+B` | Focus sidebar | Anywhere — moves focus to the sidebar navigation |
| `Cmd+N` | New goal | Anywhere — opens the goal creation dialog |
| `Cmd+T` | New task | Anywhere — opens the task creation dialog |
| `Cmd+L` | Focus logs | Anywhere — scrolls to and focuses the task log panel |
| `Cmd+.` | Cancel running task | When a task is in progress — cancels the selected/active task |
| `Escape` | Close modal / dismiss overlay | When a modal or overlay is open |
| `?` | Show keyboard shortcuts | When no input is focused — toggles the shortcut reference panel |

### Navigation Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Move focus to next interactive element |
| `Shift+Tab` | Move focus to previous interactive element |
| `Enter` / `Space` | Activate focused button or link |
| `Arrow Up/Down` | Navigate within lists (agent cards, task cards, sidebar items) |

### Task Board Shortcuts

| Shortcut | Action |
|----------|--------|
| `J` / `K` | Select next / previous task card (vim-style) |
| `Enter` | Open selected task details |
| `M` | Open "Move to" dropdown for selected task |
| `X` | Mark selected task as done |

### Modal Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Cycle through form fields |
| `Enter` | Submit form (when a form field is focused) |
| `Escape` | Cancel and close modal |

---

## Focus Management

### Tab Order

The tab order follows the visual layout:

1. **Skip link** — "Skip to main content" (visible on focus)
2. **Header** — global search input
3. **Sidebar** — navigation links (Dashboard → Agents → Goals → Tasks)
4. **Sidebar actions** — + Add Agent, + New Task
5. **Main content** — view-specific interactive elements
6. **Footer** — status text (non-interactive)

### Focus Trapping

- **Modals**: When a modal dialog opens, focus moves to the first input field. `Tab` cycles within the modal until `Escape` closes it.
- **Command palette**: When `Cmd+K` opens search, focus is trapped in the search input. Results (if added) are navigable with arrow keys.

### Focus Indicators

All interactive elements must have a visible focus indicator:

```css
/* Required focus style for all interactive elements */
:focus-visible {
  outline: 2px solid var(--focus-ring-color, #3b82f6);
  outline-offset: 2px;
}
```

### Skip Navigation

The skip link (`<a href="#main-content" class="skip-link">`) is hidden until focused, then appears at the top-left. It jumps focus past the header and sidebar directly to `<main id="main-content">`.

---

## Keyboard Shortcut Hints in UI

### Tooltips

Every button with an associated keyboard shortcut must display the shortcut in its tooltip:

```html
<button type="button" title="New Task (⌘T)" id="btn-new-task">+ New Task</button>
<button type="button" title="New Goal (⌘N)" id="btn-new-goal">+ New Goal</button>
<button type="button" title="Search (⌘K)" id="btn-search">Search</button>
```

**Format**: `{action label} ({shortcut symbol})` — use `⌘` on macOS, `Ctrl+` on other platforms. Detect at runtime via `navigator.platform` or `navigator.userAgentData`.

### Menu Accelerators (Electron)

Register global shortcuts in the main process using Electron's `globalShortcut` or `Menu` accelerators:

| Accelerator | Action |
|-------------|--------|
| `CmdOrCtrl+K` | Focus search |
| `CmdOrCtrl+B` | Focus sidebar |
| `CmdOrCtrl+N` | New goal dialog |
| `CmdOrCtrl+T` | New task dialog |
| `CmdOrCtrl+L` | Focus logs panel |
| `CmdOrCtrl+.` | Cancel active task |

### Shortcut Reference Panel

Press `?` to toggle a floating overlay listing all available shortcuts. Group by category (Global, Navigation, Task Board, Modal). Dismiss with `Escape` or `?` again.

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| primary-500 | _#..._ | Primary actions, links |
| secondary-500 | _#..._ | Secondary actions |
| neutral-100 | _#..._ | Backgrounds |
| neutral-900 | _#..._ | Body text |
| success | _#..._ | Success states |
| error | _#..._ | Error states |
| warning | _#..._ | Warning states |
| focus-ring | `#3b82f6` | Focus indicator outline |

## Typography

| Token | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| heading-1 | _..._ | _..._ | _..._ | Page titles |
| heading-2 | _..._ | _..._ | _..._ | Section titles |
| body | _..._ | _..._ | _..._ | Body text |
| caption | _..._ | _..._ | _..._ | Labels, captions |

## Spacing Scale

Base unit: _4px_

| Token | Value | Usage |
|-------|-------|-------|
| xs | _4px_ | _..._ |
| sm | _8px_ | _..._ |
| md | _16px_ | _..._ |
| lg | _24px_ | _..._ |
| xl | _32px_ | _..._ |
| 2xl | _48px_ | _..._ |

## Component Patterns

### Buttons
_Variants, sizes, states_

### Inputs
_Text, select, checkbox, radio — states and validation_

### Cards
_Layout, elevation, content structure_

## Brand Guidelines

_Logo usage, iconography, visual tone_

## Responsive Breakpoints

| Name | Min width | Notes |
|------|-----------|-------|
| mobile | _0px_ | _..._ |
| tablet | _768px_ | _..._ |
| desktop | _1024px_ | _..._ |

---
_Generated by Clipper. Keyboard shortcuts section added for CMPAAA-59._
