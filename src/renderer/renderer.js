// Modal management + Task Board rendering
// Native <dialog>.showModal() provides: role="dialog" (implicit), aria-modal="true" (implicit),
// focus trapping, and Escape-to-close. We add focus-return-to-trigger.

(function () {
  "use strict";

  // ── Analytics helper ──
  function trackEvent(event, props) {
    if (window.app && window.app.analytics) {
      window.app.analytics.track(event, props).catch(function () {});
    }
  }

  /** @type {HTMLElement | null} — remembers which element opened the active modal */
  let lastTrigger = null;

  /**
   * Open a <dialog> as a modal, remembering the trigger for focus return.
   * @param {HTMLDialogElement} dialog
   * @param {HTMLElement} trigger
   */
  function openModal(dialog, trigger) {
    lastTrigger = trigger;
    dialog.showModal();
  }

  /**
   * Close the modal and return focus to the element that opened it.
   * @param {HTMLDialogElement} dialog
   */
  function closeModal(dialog) {
    dialog.close();
    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  // ── Wire up trigger buttons ──
  var btnAddAgent = document.getElementById("btn-add-agent");
  var btnNewTask = document.getElementById("btn-new-task");
  var modalAgent = document.getElementById("modal-create-agent");
  var modalTask = document.getElementById("modal-create-task");

  if (btnAddAgent && modalAgent) {
    btnAddAgent.addEventListener("click", function () {
      openModal(modalAgent, btnAddAgent);
      trackEvent("modal_opened", { modal: "create_agent" });
    });
  }

  if (btnNewTask && modalTask) {
    btnNewTask.addEventListener("click", function () {
      openModal(modalTask, btnNewTask);
      trackEvent("modal_opened", { modal: "create_task" });
    });
  }

  // ── Cancel buttons inside modals ──
  document.querySelectorAll(".modal-cancel").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dialog = btn.closest("dialog");
      if (dialog) closeModal(dialog);
    });
  });

  // ── Close on backdrop click ──
  [modalAgent, modalTask].forEach(function (dialog) {
    if (!dialog) return;
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) {
        closeModal(dialog);
      }
    });
  });

  // ── Focus trap safety net ──
  document.addEventListener("keydown", function (e) {
    var openDialog = document.querySelector("dialog[open]");
    if (!openDialog) return;

    if (e.key === "Tab") {
      var focusable = openDialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // ════════════════════════════════════════════════════
  // Keyboard Shortcuts
  // ════════════════════════════════════════════════════

  var shortcutPanel = document.getElementById("shortcut-reference");

  function isTypingContext(target) {
    var tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    );
  }

  document.addEventListener("keydown", function (e) {
    var isMod = e.metaKey || e.ctrlKey;

    // Cmd+K — Focus global search
    if (isMod && e.key === "k") {
      e.preventDefault();
      var search = document.getElementById("global-search");
      if (search) search.focus();
      trackEvent("shortcut", { shortcut: "cmd+k" });
      return;
    }

    // Cmd+B — Focus sidebar
    if (isMod && e.key === "b") {
      e.preventDefault();
      var firstLink = document.querySelector(".sidebar-link");
      if (firstLink) firstLink.focus();
      trackEvent("shortcut", { shortcut: "cmd+b" });
      return;
    }

    // Cmd+N — Open new goal dialog (uses create-agent modal as goal dialog)
    if (isMod && e.key === "n") {
      e.preventDefault();
      if (modalAgent) openModal(modalAgent, document.activeElement);
      trackEvent("shortcut", { shortcut: "cmd+n" });
      return;
    }

    // Cmd+T — Open new task dialog
    if (isMod && e.key === "t") {
      e.preventDefault();
      if (modalTask) openModal(modalTask, document.activeElement);
      trackEvent("shortcut", { shortcut: "cmd+t" });
      return;
    }

    // Cmd+L — Focus logs panel
    if (isMod && e.key === "l") {
      e.preventDefault();
      var footer = document.querySelector(".app-footer .footer-status");
      if (footer) footer.focus();
      trackEvent("shortcut", { shortcut: "cmd+l" });
      return;
    }

    // Cmd+. — Cancel active task
    if (isMod && e.key === ".") {
      e.preventDefault();
      // Cancel the first in-progress task found
      var moveSelect = document.querySelector(
        '.task-column[data-status="in_progress"] .task-move-select'
      );
      if (moveSelect) {
        moveSelect.value = "done";
        moveSelect.dispatchEvent(new Event("change"));
        var moveBtn = moveSelect.parentElement.querySelector(".task-move-btn");
        if (moveBtn && !moveBtn.disabled) moveBtn.click();
      }
      trackEvent("shortcut", { shortcut: "cmd+." });
      return;
    }

    // ? — Toggle shortcut reference panel (only when not typing)
    if (e.key === "?" && !isMod && !isTypingContext(e.target)) {
      e.preventDefault();
      if (shortcutPanel) {
        shortcutPanel.hidden = !shortcutPanel.hidden;
      }
      trackEvent("shortcut", { shortcut: "?" });
      return;
    }

    // Escape — Close active modal or shortcut panel
    if (e.key === "Escape") {
      if (shortcutPanel && !shortcutPanel.hidden) {
        shortcutPanel.hidden = true;
        return;
      }
      var openDialog = document.querySelector("dialog[open]");
      if (openDialog) {
        closeModal(openDialog);
        return;
      }
    }
  });

  // Close button for shortcut reference panel
  if (shortcutPanel) {
    var shortcutCloseBtn = shortcutPanel.querySelector(".shortcut-reference-close");
    if (shortcutCloseBtn) {
      shortcutCloseBtn.addEventListener("click", function () {
        shortcutPanel.hidden = true;
      });
    }
  }

  // ── Version display ──
  if (window.app && window.app.getVersion) {
    window.app.getVersion().then(function (v) {
      var el = document.querySelector(".footer-version");
      if (el) el.textContent = "v" + v;
      trackEvent("app_started", { app_version: v, platform: window.app.getPlatform() });
    });
  }

  // ════════════════════════════════════════════════════
  // Authentication
  // ════════════════════════════════════════════════════

  /** @type {string | null} current session token */
  var sessionToken = null;

  var loginView = document.getElementById("view-login");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var loginSecretInput = document.getElementById("login-secret");
  var logoutBtn = document.getElementById("btn-logout");

  function showLogin() {
    if (loginView) loginView.hidden = false;
    // Hide all other views
    Object.keys(views).forEach(function (key) {
      if (views[key]) views[key].hidden = true;
    });
    // Disable sidebar
    sidebarLinks.forEach(function (link) {
      link.style.pointerEvents = "none";
      link.style.opacity = "0.4";
    });
  }

  function hideLogin() {
    if (loginView) loginView.hidden = true;
    sidebarLinks.forEach(function (link) {
      link.style.pointerEvents = "";
      link.style.opacity = "";
    });
    // Navigate to dashboard
    navigateTo("dashboard");
  }

  async function checkAuth() {
    if (!window.app || !window.app.auth) return;
    try {
      var status = await window.app.auth.status();
      if (status.configured) {
        showLogin();
      }
      // If not configured, app runs without auth (dev mode)
    } catch (err) {
      console.error("Auth status check failed:", err);
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!window.app || !window.app.auth) return;

      var secret = loginSecretInput ? loginSecretInput.value : "";

      if (loginError) loginError.textContent = "";

      try {
        var result = await window.app.auth.login(secret);
        if (result.ok) {
          sessionToken = result.token;
          hideLogin();
          if (loginSecretInput) loginSecretInput.value = "";
          trackEvent("user_login", { role: result.role });
        } else {
          if (loginError) loginError.textContent = result.error || "Login failed";
        }
      } catch (err) {
        if (loginError) loginError.textContent = "Connection error";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (sessionToken && window.app && window.app.auth) {
        await window.app.auth.logout(sessionToken);
      }
      sessionToken = null;
      showLogin();
      trackEvent("user_logout");
    });
  }

  // Check auth on startup
  checkAuth();

  // ════════════════════════════════════════════════════
  // Routing
  // ════════════════════════════════════════════════════

  var views = {
    dashboard: document.getElementById("view-dashboard"),
    agents: document.getElementById("view-agents"),
    tasks: document.getElementById("view-tasks"),
    notFound: document.getElementById("view-not-found"),
  };

  // ── Social Meta (OG / Twitter Card) per-view ──
  var META_BY_ROUTE = {
    dashboard: {
      title: "Dashboard — AgentOps Desktop",
      description: "Overview of your AI agents, goals, and task progress.",
    },
    tasks: {
      title: "Task Board — AgentOps Desktop",
      description: "Kanban board for managing agent tasks across Pending, In Progress, Review, and Done.",
    },
    agents: {
      title: "Agents — AgentOps Desktop",
      description: "Configure and monitor your AI agents.",
    },
    goals: {
      title: "Goals — AgentOps Desktop",
      description: "Track and manage strategic goals.",
    },
  };

  function updateSocialMeta(route) {
    var meta = META_BY_ROUTE[route] || META_BY_ROUTE.dashboard;
    document.title = meta.title;

    var ogTitle = document.querySelector('meta[property="og:title"]');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    var twDesc = document.querySelector('meta[name="twitter:description"]');

    if (ogTitle) ogTitle.setAttribute("content", meta.title);
    if (ogDesc) ogDesc.setAttribute("content", meta.description);
    if (twTitle) twTitle.setAttribute("content", meta.title);
    if (twDesc) twDesc.setAttribute("content", meta.description);
  }

  var sidebarLinks = document.querySelectorAll(".sidebar-link[data-route]");

  function navigateTo(route) {
    var isKnownRoute = route in views && route !== "notFound";

    // Update sidebar active state — deselect all for unknown routes
    sidebarLinks.forEach(function (link) {
      link.classList.toggle("active", isKnownRoute && link.dataset.route === route);
    });

    // Show the matching view, or fall back to 404
    var target = isKnownRoute ? route : "notFound";
    Object.keys(views).forEach(function (key) {
      if (views[key]) {
        views[key].hidden = key !== target;
      }
    });

    // Load task board data when navigating to tasks
    if (route === "tasks") {
      loadTaskBoard();
    }

    // Load agent list when navigating to agents
    if (route === "agents" && window.agentActions) {
      window.agentActions.load();
    }

    // Load dashboard when navigating to dashboard
    if (route === "dashboard") {
      loadDashboard();
    }

    updateSocialMeta(isKnownRoute ? route : "dashboard");
    trackEvent("page_view", { route: route, not_found: !isKnownRoute });
  }

  sidebarLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      navigateTo(link.dataset.route);
    });
  });

  // ── 404 page navigation buttons ──
  var btnGoDashboard = document.getElementById("btn-go-dashboard");
  var btnGoTasks = document.getElementById("btn-go-tasks");

  if (btnGoDashboard) {
    btnGoDashboard.addEventListener("click", function () {
      navigateTo("dashboard");
    });
  }

  if (btnGoTasks) {
    btnGoTasks.addEventListener("click", function () {
      navigateTo("tasks");
    });
  }

  // ════════════════════════════════════════════════════
  // Dashboard — Real-time Agent Status
  // ════════════════════════════════════════════════════

  var dashboardGrid = document.getElementById("dashboard-grid");
  var dashboardLoading = document.getElementById("dashboard-loading");
  var dashboardEmpty = document.getElementById("dashboard-empty");
  var dashboardLastRefresh = document.getElementById("dashboard-last-refresh");
  var btnDashboardAddAgent = document.getElementById("btn-dashboard-add-agent");

  /** @type {Agent[]} cached agent list for dashboard */
  var dashboardAgents = [];

  /** Map health-check statuses to display statuses */
  function mapHealthToDisplay(healthStatus) {
    switch (healthStatus) {
      case "idle": return "idle";
      case "offline": return "offline";
      case "error": return "error";
      default: return healthStatus || "idle";
    }
  }

  /** Format a relative "last seen" string */
  function formatLastSeen(isoString) {
    if (!isoString) return "never";
    var now = Date.now();
    var then = new Date(isoString).getTime();
    var diffMs = now - then;
    if (diffMs < 0) diffMs = 0;
    var seconds = Math.floor(diffMs / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return seconds + "s ago";
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    return days + "d ago";
  }

  /** Update the "last refreshed" indicator */
  function updateLastRefreshTime() {
    if (!dashboardLastRefresh) return;
    var now = new Date();
    var h = String(now.getHours()).padStart(2, "0");
    var m = String(now.getMinutes()).padStart(2, "0");
    var s = String(now.getSeconds()).padStart(2, "0");
    dashboardLastRefresh.textContent = "Updated " + h + ":" + m + ":" + s;
  }

  /** Load agents and render dashboard grid */
  async function loadDashboard() {
    if (!window.electronAPI) return;

    if (dashboardLoading) dashboardLoading.hidden = false;
    if (dashboardEmpty) dashboardEmpty.hidden = true;
    if (dashboardGrid) dashboardGrid.innerHTML = "";

    try {
      var agents = await window.electronAPI.listAgents();
      dashboardAgents = agents;
      renderDashboard(agents);
      updateLastRefreshTime();
    } catch (err) {
      console.error("Failed to load dashboard agents:", err);
      if (dashboardLoading) dashboardLoading.hidden = true;
      if (dashboardEmpty) dashboardEmpty.hidden = false;
    }
  }

  /** Render the dashboard agent grid */
  function renderDashboard(agents) {
    if (dashboardLoading) dashboardLoading.hidden = true;

    if (!agents || agents.length === 0) {
      if (dashboardEmpty) dashboardEmpty.hidden = false;
      if (dashboardGrid) dashboardGrid.innerHTML = "";
      return;
    }

    if (dashboardEmpty) dashboardEmpty.hidden = true;
    if (!dashboardGrid) return;

    dashboardGrid.innerHTML = "";
    agents.forEach(function (agent) {
      dashboardGrid.appendChild(createDashboardCard(agent));
    });
  }

  /** Create a single dashboard agent status card */
  function createDashboardCard(agent) {
    var card = document.createElement("article");
    card.className = "agent-status-card";
    card.setAttribute("role", "listitem");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", agent.name + " — " + (AGENT_TYPE_LABELS[agent.agent_type] || agent.agent_type) + " — " + (agent.status || "idle"));

    card.addEventListener("click", function () {
      navigateTo("agents");
      trackEvent("dashboard_agent_click", { agent_id: agent.id });
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigateTo("agents");
        trackEvent("dashboard_agent_click", { agent_id: agent.id });
      }
    });

    // Header: name + type badge + status badge
    var header = document.createElement("div");
    header.className = "agent-status-card-header";

    var name = document.createElement("h3");
    name.className = "agent-status-card-name";
    name.textContent = agent.name;
    header.appendChild(name);

    var typeBadge = document.createElement("span");
    typeBadge.className = "agent-status-card-type";
    typeBadge.textContent = AGENT_TYPE_LABELS[agent.agent_type] || agent.agent_type || "Custom";
    header.appendChild(typeBadge);

    var statusBadge = document.createElement("span");
    var displayStatus = agent.status || "idle";
    statusBadge.className = "agent-status-badge agent-status-badge--" + displayStatus;
    statusBadge.textContent = displayStatus;
    header.appendChild(statusBadge);

    card.appendChild(header);

    // Meta info
    var meta = document.createElement("div");
    meta.className = "agent-status-card-meta";

    if (agent.role) {
      var roleEl = document.createElement("div");
      roleEl.className = "agent-status-card-role";
      roleEl.textContent = "role: " + agent.role;
      meta.appendChild(roleEl);
    }

    var lastSeen = document.createElement("div");
    lastSeen.className = "agent-status-card-last-seen";
    lastSeen.textContent = "last seen: " + formatLastSeen(agent.updatedAt);
    lastSeen.dataset.agentId = agent.id;
    meta.appendChild(lastSeen);

    card.appendChild(meta);
    return card;
  }

  /** Subscribe to real-time agent:status IPC push events */
  function subscribeToAgentStatus() {
    if (!window.electronAPI || !window.electronAPI.onAgentStatus) return;

    window.electronAPI.onAgentStatus(function (result) {
      // Update the matching agent in our cached list
      var idx = dashboardAgents.findIndex(function (a) { return a.id === result.agentId; });
      if (idx >= 0) {
        dashboardAgents[idx].status = mapHealthToDisplay(result.status);
        dashboardAgents[idx].updatedAt = result.checkedAt;
        // Re-render only the dashboard if it's currently visible
        if (views.dashboard && !views.dashboard.hidden) {
          renderDashboard(dashboardAgents);
          updateLastRefreshTime();
        }
      }
    });
  }

  /** Auto-refresh dashboard when app regains focus */
  function setupVisibilityRefresh() {
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && views.dashboard && !views.dashboard.hidden) {
        loadDashboard();
      }
    });
  }

  /** Periodically update relative "last seen" timestamps */
  function startLastSeenRefresh() {
    setInterval(function () {
      if (views.dashboard && views.dashboard.hidden) return;
      dashboardAgents.forEach(function (agent) {
        var el = document.querySelector('[data-agent-id="' + agent.id + '"]');
        if (el) el.textContent = "last seen: " + formatLastSeen(agent.updatedAt);
      });
    }, 30000);
  }

  // Wire up "Add Agent" button on empty state
  if (btnDashboardAddAgent && modalAgent) {
    btnDashboardAddAgent.addEventListener("click", function () {
      openModal(modalAgent, btnDashboardAddAgent);
      trackEvent("modal_opened", { modal: "create_agent" });
    });
  }

  // Initialize dashboard subscriptions
  subscribeToAgentStatus();
  setupVisibilityRefresh();
  startLastSeenRefresh();

  // ════════════════════════════════════════════════════
  // Agent Registry
  // ════════════════════════════════════════════════════

  var AGENT_TYPE_LABELS = {
    "claude-code": "Claude Code",
    "codex": "Codex",
    "gemini-cli": "Gemini CLI",
    "opencode": "OpenCode",
    "custom": "Custom",
  };

  var agentCardsContainer = document.getElementById("agent-list-cards");
  var agentLoadingEl = document.getElementById("agent-list-loading");
  var agentEmptyEl = document.getElementById("agent-list-empty");
  var agentErrorEl = document.getElementById("agent-list-error");

  // Modal references
  var modalEditAgent = document.getElementById("modal-edit-agent");
  var modalDeleteAgent = document.getElementById("modal-delete-agent");
  var btnAddAgentInline = document.getElementById("btn-add-agent-inline");

  // Subscribe to agent store changes
  if (window.agentStore) {
    window.agentStore.subscribe(function (state) {
      renderAgentList(state.agents, state.loading, state.error);
    });
  }

  function renderAgentList(agents, loading, error) {
    if (agentLoadingEl) agentLoadingEl.hidden = !loading;
    if (agentErrorEl) {
      if (error) {
        agentErrorEl.textContent = error;
        agentErrorEl.hidden = false;
      } else {
        agentErrorEl.hidden = true;
      }
    }
    if (agentEmptyEl) agentEmptyEl.hidden = loading || agents.length > 0;
    if (agentCardsContainer) {
      agentCardsContainer.innerHTML = "";
      agents.forEach(function (agent) {
        agentCardsContainer.appendChild(createAgentCard(agent));
      });
    }
  }

  function createAgentCard(agent) {
    var card = document.createElement("article");
    card.className = "agent-card";
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", agent.name + " — " + (AGENT_TYPE_LABELS[agent.agent_type] || agent.agent_type));

    var header = document.createElement("div");
    header.className = "agent-card-header";

    var name = document.createElement("h3");
    name.className = "agent-card-name";
    name.textContent = agent.name;
    header.appendChild(name);

    var typeBadge = document.createElement("span");
    typeBadge.className = "agent-card-type agent-card-type--" + agent.agent_type;
    typeBadge.textContent = AGENT_TYPE_LABELS[agent.agent_type] || agent.agent_type;
    header.appendChild(typeBadge);

    var statusBadge = document.createElement("span");
    statusBadge.className = "agent-card-status agent-card-status--" + agent.status;
    statusBadge.textContent = agent.status;
    header.appendChild(statusBadge);

    card.appendChild(header);

    // Meta info
    var meta = document.createElement("div");
    meta.className = "agent-card-meta";

    if (agent.executable_path) {
      var exe = document.createElement("div");
      exe.className = "agent-card-path";
      exe.textContent = "exe: " + agent.executable_path;
      meta.appendChild(exe);
    }

    if (agent.working_directory) {
      var cwd = document.createElement("div");
      cwd.className = "agent-card-path";
      cwd.textContent = "cwd: " + agent.working_directory;
      meta.appendChild(cwd);
    }

    var roleEl = document.createElement("div");
    roleEl.className = "agent-card-role";
    roleEl.textContent = "role: " + agent.role;
    meta.appendChild(roleEl);

    card.appendChild(meta);

    // Actions
    var actions = document.createElement("div");
    actions.className = "agent-card-actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "agent-action-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openEditAgentModal(agent);
    });
    actions.appendChild(editBtn);

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "agent-action-btn agent-action-btn--danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      openDeleteAgentModal(agent);
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);

    return card;
  }

  // ── Inline Add Agent button ──
  if (btnAddAgentInline && modalAgent) {
    btnAddAgentInline.addEventListener("click", function () {
      openModal(modalAgent, btnAddAgentInline);
      trackEvent("modal_opened", { modal: "create_agent" });
    });
  }

  // ── Create Agent form submission ──
  if (modalAgent) {
    var createAgentForm = modalAgent.querySelector("form");
    if (createAgentForm) {
      createAgentForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var formData = new FormData(createAgentForm);
        var input = {
          name: formData.get("name"),
          role: formData.get("role") || "coder",
          agent_type: formData.get("agent_type") || "custom",
        };
        if (formData.get("executable_path")) input.executable_path = formData.get("executable_path");
        if (formData.get("working_directory")) input.working_directory = formData.get("working_directory");
        if (formData.get("config_json")) input.config_json = formData.get("config_json");

        if (window.agentActions) {
          var result = await window.agentActions.create(input);
          if (result.ok) {
            closeModal(modalAgent);
            createAgentForm.reset();
            announce("Agent \"" + input.name + "\" created");
            trackEvent("agent_created", { agent_type: input.agent_type });
          } else {
            announce("Failed to create agent: " + (result.error || "unknown error"));
          }
        }
      });
    }
  }

  function openEditAgentModal(agent) {
    if (!modalEditAgent) return;
    document.getElementById("edit-agent-id").value = agent.id;
    document.getElementById("edit-agent-name").value = agent.name;
    document.getElementById("edit-agent-type").value = agent.agent_type || "custom";
    document.getElementById("edit-agent-executable").value = agent.executable_path || "";
    document.getElementById("edit-agent-cwd").value = agent.working_directory || "";
    document.getElementById("edit-agent-role").value = agent.role;
    document.getElementById("edit-agent-config").value = agent.config_json || "{}";
    openModal(modalEditAgent, null);
  }

  // ── Edit Agent form submission ──
  if (modalEditAgent) {
    var editAgentForm = modalEditAgent.querySelector("form");
    if (editAgentForm) {
      editAgentForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var id = document.getElementById("edit-agent-id").value;
        var formData = new FormData(editAgentForm);
        var input = {
          name: formData.get("name"),
          role: formData.get("role"),
          agent_type: formData.get("agent_type"),
          executable_path: formData.get("executable_path") || null,
          working_directory: formData.get("working_directory") || null,
          config_json: formData.get("config_json") || "{}",
        };

        if (window.agentActions) {
          var result = await window.agentActions.update(id, input);
          if (result.ok) {
            closeModal(modalEditAgent);
            announce("Agent \"" + input.name + "\" updated");
            trackEvent("agent_updated", { agent_id: id });
          } else {
            announce("Failed to update agent: " + (result.error || "unknown error"));
          }
        }
      });
    }
  }

  function openDeleteAgentModal(agent) {
    if (!modalDeleteAgent) return;
    document.getElementById("delete-agent-id").value = agent.id;
    document.getElementById("delete-agent-name").textContent = agent.name;
    openModal(modalDeleteAgent, null);
  }

  // ── Delete Agent confirmation ──
  if (modalDeleteAgent) {
    var deleteAgentForm = modalDeleteAgent.querySelector("form");
    if (deleteAgentForm) {
      deleteAgentForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        var id = document.getElementById("delete-agent-id").value;
        var name = document.getElementById("delete-agent-name").textContent;

        if (window.agentActions) {
          var result = await window.agentActions.delete(id);
          if (result.ok) {
            closeModal(modalDeleteAgent);
            announce("Agent \"" + name + "\" deleted");
            trackEvent("agent_deleted", { agent_id: id });
          } else {
            announce("Failed to delete agent: " + (result.error || "unknown error"));
          }
        }
      });
    }
  }

  // ── Backdrop click for new modals ──
  [modalEditAgent, modalDeleteAgent].forEach(function (dialog) {
    if (!dialog) return;
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) {
        closeModal(dialog);
      }
    });
  });

  // ════════════════════════════════════════════════════
  // Task Board
  // ════════════════════════════════════════════════════

  var STATUSES = ["pending", "in_progress", "review", "done"];
  var STATUS_LABELS = {
    pending: "Pending",
    in_progress: "In Progress",
    review: "Review",
    done: "Done",
  };

  // Sub-states for in_progress tasks — ordered progression
  var SUB_STATES = ["queued", "initializing", "executing", "summarizing"];
  var SUB_STATE_LABELS = {
    queued: "Queued",
    initializing: "Initializing",
    executing: "Executing",
    summarizing: "Summarizing",
  };

  // Live region for screen reader announcements
  var announcer = document.createElement("div");
  announcer.className = "sr-announcer";
  announcer.setAttribute("role", "status");
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  document.body.appendChild(announcer);

  function announce(message) {
    announcer.textContent = "";
    // Force re-announcement by clearing then setting
    requestAnimationFrame(function () {
      announcer.textContent = message;
    });
  }

  /**
   * Build a sub-state stepper element for in_progress tasks.
   * Shows 4 dots with labels: queued → initializing → executing → summarizing
   */
  function createSubStateStepper(currentSubState) {
    var stepper = document.createElement("div");
    stepper.className = "task-substate-stepper";
    stepper.setAttribute("role", "group");
    stepper.setAttribute("aria-label", "Task progress: " + (SUB_STATE_LABELS[currentSubState] || "Unknown"));

    var currentIdx = SUB_STATES.indexOf(currentSubState);

    SUB_STATES.forEach(function (ss, idx) {
      var step = document.createElement("span");
      step.className = "task-substate-step";
      if (idx < currentIdx) {
        step.classList.add("task-substate-step--completed");
      } else if (idx === currentIdx) {
        step.classList.add("task-substate-step--active");
      }
      step.setAttribute("aria-label", SUB_STATE_LABELS[ss] + (idx < currentIdx ? " (completed)" : idx === currentIdx ? " (current)" : ""));

      var dot = document.createElement("span");
      dot.className = "task-substate-dot";
      step.appendChild(dot);

      if (idx < SUB_STATES.length - 1) {
        var line = document.createElement("span");
        line.className = "task-substate-line";
        if (idx < currentIdx) {
          line.classList.add("task-substate-line--completed");
        }
        step.appendChild(line);
      }

      stepper.appendChild(step);
    });

    // Current sub-state label
    var labelEl = document.createElement("span");
    labelEl.className = "task-substate-label";
    labelEl.textContent = SUB_STATE_LABELS[currentSubState] || "";
    stepper.appendChild(labelEl);

    return stepper;
  }

  /**
   * Build a single task card element with accessible move controls.
   * WCAG 2.5.7: The "Move to" select + button provide a non-dragging
   * alternative for changing task column/status.
   */
  function createTaskCard(task) {
    var card = document.createElement("article");
    card.className = "task-card";
    card.setAttribute("role", "listitem");
    var ariaDesc = task.title + " — " + STATUS_LABELS[task.status];
    if (task.status === "in_progress" && task.sub_state) {
      ariaDesc += " — " + SUB_STATE_LABELS[task.sub_state];
    }
    card.setAttribute("aria-label", ariaDesc);

    // Title
    var title = document.createElement("div");
    title.className = "task-card-title";
    title.textContent = task.title;
    card.appendChild(title);

    // Sub-state stepper + elapsed time (only for in_progress tasks)
    if (task.status === "in_progress") {
      var progressRow = document.createElement("div");
      progressRow.className = "task-card-progress";

      var currentSub = task.sub_state || "queued";
      progressRow.appendChild(createSubStateStepper(currentSub));

      // Elapsed time
      if (task.started_at) {
        var elapsed = document.createElement("span");
        elapsed.className = "task-card-elapsed";
        elapsed.setAttribute("aria-label", "Elapsed time");
        elapsed.setAttribute("data-started-at", task.started_at);
        elapsed.textContent = window.taskActions
          ? window.taskActions.formatElapsed(task.started_at)
          : "";
        progressRow.appendChild(elapsed);
      }

      card.appendChild(progressRow);
    }

    // Meta row: priority + assignee
    var meta = document.createElement("div");
    meta.className = "task-card-meta";

    var badge = document.createElement("span");
    badge.className = "task-card-priority task-card-priority--" + task.priority;
    badge.textContent = task.priority;
    meta.appendChild(badge);

    if (task.assignee) {
      var assignee = document.createElement("span");
      assignee.className = "task-card-assignee";
      assignee.textContent = task.assignee;
      meta.appendChild(assignee);
    }

    card.appendChild(meta);

    // Move-to controls (WCAG 2.5.7 non-dragging alternative)
    var actions = document.createElement("div");
    actions.className = "task-card-actions";

    var selectId = "move-select-" + task.id;
    var label = document.createElement("label");
    label.className = "visually-hidden";
    label.setAttribute("for", selectId);
    label.textContent = "Move \"" + task.title + "\" to status";
    actions.appendChild(label);

    var select = document.createElement("select");
    select.className = "task-move-select";
    select.id = selectId;

    STATUSES.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = STATUS_LABELS[s];
      if (s === task.status) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    actions.appendChild(select);

    var moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.className = "task-move-btn";
    moveBtn.textContent = "Move";
    moveBtn.setAttribute("aria-label", "Move \"" + task.title + "\" to selected status");
    moveBtn.disabled = true; // enabled only when selection changes

    select.addEventListener("change", function () {
      moveBtn.disabled = select.value === task.status;
    });

    moveBtn.addEventListener("click", function () {
      var newStatus = select.value;
      if (newStatus === task.status) return;
      moveTaskToStatus(task.id, newStatus, task.title);
    });

    // Also allow Enter on the select to trigger move
    select.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !moveBtn.disabled) {
        e.preventDefault();
        moveBtn.click();
      }
    });

    actions.appendChild(moveBtn);
    card.appendChild(actions);

    return card;
  }

  async function loadTaskBoard() {
    if (!window.app || !window.app.tasks) return;

    try {
      var tasks = await window.app.tasks.list(sessionToken);
      renderBoard(tasks);
      startElapsedTicker();
      // Sync to taskStore for elapsed time tracking
      if (window.taskStore) {
        window.taskStore.setState({ tasks: tasks });
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }

  // Elapsed time ticker — updates only the elapsed time text every second.
  var _elapsedTickTimer = null;
  function startElapsedTicker() {
    if (_elapsedTickTimer) return;
    _elapsedTickTimer = setInterval(function () {
      var els = document.querySelectorAll(".task-card-elapsed[data-started-at]");
      for (var i = 0; i < els.length; i++) {
        var startedAt = els[i].getAttribute("data-started-at");
        if (startedAt && window.taskActions) {
          els[i].textContent = window.taskActions.formatElapsed(startedAt);
        }
      }
    }, 1000);
  }

  function renderBoard(tasks) {
    var grouped = {};
    STATUSES.forEach(function (s) {
      grouped[s] = [];
    });

    tasks.forEach(function (t) {
      if (grouped[t.status]) {
        grouped[t.status].push(t);
      }
    });

    STATUSES.forEach(function (status) {
      var container = document.querySelector('[data-cards="' + status + '"]');
      var countEl = document.querySelector('[data-count="' + status + '"]');
      if (!container) return;

      container.innerHTML = "";
      grouped[status].forEach(function (task) {
        container.appendChild(createTaskCard(task));
      });

      if (countEl) {
        countEl.textContent = grouped[status].length;
      }
    });
  }

  async function moveTaskToStatus(taskId, newStatus, taskTitle) {
    if (!window.app || !window.app.tasks) return;

    try {
      var result = await window.app.tasks.move(sessionToken, taskId, newStatus);
      if (result.ok) {
        announce("Moved \"" + taskTitle + "\" to " + STATUS_LABELS[newStatus]);
        trackEvent("task_moved", { task_id: taskId, new_status: newStatus });
        // Reload the board to reflect the change
        await loadTaskBoard();
      } else {
        announce("Failed to move task: " + (result.error || "unknown error"));
      }
    } catch (err) {
      console.error("Failed to move task:", err);
      announce("Error moving task. Please try again.");
    }
  }
})();
