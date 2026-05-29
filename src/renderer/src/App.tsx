import React, { useState } from "react";
import { DashboardPage } from "./components/dashboard";
import { WorkflowPage } from "./components/workflow";

export function App() {
  const [currentRoute, setCurrentRoute] = useState("dashboard");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-brand">AgentOps</div>
        <nav className="header-nav">
          <label htmlFor="global-search" className="visually-hidden">
            Search agents, goals, and tasks
          </label>
          <input
            type="search"
            id="global-search"
            className="header-search"
            placeholder="Search…"
            autoComplete="off"
            title="Search (⌘K)"
          />
        </nav>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <nav className="sidebar-nav">
            {(["dashboard", "agents", "goals", "tasks", "workflows"] as const).map(
              (route) => (
                <a
                  key={route}
                  className={`sidebar-link${currentRoute === route ? " active" : ""}`}
                  data-route={route}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentRoute(route);
                  }}
                >
                  {route.charAt(0).toUpperCase() + route.slice(1)}
                </a>
              )
            )}
          </nav>
          <div className="sidebar-actions">
            <button
              type="button"
              className="sidebar-action-btn"
              id="btn-add-agent"
              title="Add Agent"
            >
              + Add Agent
            </button>
            <button
              type="button"
              className="sidebar-action-btn"
              id="btn-new-task"
              title="New Task (⌘T)"
            >
              + New Task
            </button>
          </div>
        </aside>
        <main id="main-content" className="app-content">
          {currentRoute === "dashboard" && <DashboardPage />}
          {currentRoute === "agents" && <AgentsView />}
          {currentRoute === "tasks" && <TasksView />}
          {currentRoute === "goals" && <GoalsView />}
          {currentRoute === "workflows" && <WorkflowPage />}
        </main>
      </div>
      <footer className="app-footer">
        <span className="footer-status" tabIndex={-1}>
          Ready
        </span>
        <span className="footer-version" />
      </footer>
    </div>
  );
}

function AgentsView() {
  return (
    <section className="agent-list" aria-label="Agent registry">
      <div className="agent-list-header">
        <h1>Agents</h1>
        <button type="button" className="sidebar-action-btn">
          + Add Agent
        </button>
      </div>
      <div className="agent-list-empty">
        <p>No agents configured yet. Click "+ Add Agent" to create one.</p>
      </div>
    </section>
  );
}

function TasksView() {
  return (
    <section className="task-board" aria-label="Task board">
      <div className="task-board-header">
        <h1>Task Board</h1>
        <p className="task-board-hint">
          Use the "Move to" dropdown on each card to change its status.
        </p>
      </div>
      <div className="task-columns" role="list" aria-label="Task status columns">
        {(["pending", "in_progress", "review", "done", "cancelled"] as const).map(
          (status) => (
            <div key={status} className="task-column" data-status={status}>
              <h2 className="task-column-title">
                <span className={`task-column-dot task-column-dot--${status}`} />
                {status === "in_progress"
                  ? "In Progress"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="task-column-count">0</span>
              </h2>
              <div className="task-column-cards" />
            </div>
          )
        )}
      </div>
    </section>
  );
}

function GoalsView() {
  return (
    <section aria-label="Goals">
      <h1>Goals</h1>
      <p className="task-board-hint">Track and manage strategic goals.</p>
    </section>
  );
}
