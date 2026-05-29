import React, { useState, useCallback } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { SummaryBar, type SummaryData } from "./SummaryBar";
import { AgentCardGrid, type AgentInfo } from "./AgentStatusCard";
import { KanbanBoard, type TaskInfo } from "./KanbanBoard";
import { LogStreamCard, type LogEntry } from "./LogStreamCard";
import { SkeletonSummaryBar, SkeletonKanbanColumn } from "./Skeleton";

// ─── Demo data (replace with IPC calls) ─────────────────────────────

const DEMO_AGENTS: AgentInfo[] = [
  { id: "a1", name: "CEO Agent", role: "ceo", status: "active", lastSeen: "2m ago", taskCount: 3 },
  { id: "a2", name: "CTO Agent", role: "cto", status: "running", lastSeen: "now", taskCount: 5 },
  { id: "a3", name: "Engineer Agent", role: "engineer", status: "idle", lastSeen: "12m ago", taskCount: 2 },
  { id: "a4", name: "QA Agent", role: "qa", status: "idle", lastSeen: "8m ago", taskCount: 1 },
];

const DEMO_TASKS: TaskInfo[] = [
  { id: "t1", title: "API auth middleware", status: "in_progress", priority: "high", assigneeName: "CTO Agent", elapsed: "14m" },
  { id: "t2", title: "Dashboard layout", status: "in_progress", priority: "medium", assigneeName: "Engineer Agent", elapsed: "6m" },
  { id: "t3", title: "Write unit tests", status: "pending", priority: "medium" },
  { id: "t4", title: "Security review", status: "review", priority: "high", assigneeName: "QA Agent" },
  { id: "t5", title: "Deploy staging", status: "done", priority: "low", assigneeName: "CTO Agent" },
];

const DEMO_LOGS: LogEntry[] = [
  { id: "l1", timestamp: "10:42:01", level: "info", source: "CEO", message: "Sprint goal approved" },
  { id: "l2", timestamp: "10:42:15", level: "info", source: "CTO", message: "Assigned CMPAAA-389 to Engineer" },
  { id: "l3", timestamp: "10:42:30", level: "warn", source: "QA", message: "Test flake detected in auth.spec.ts" },
  { id: "l4", timestamp: "10:43:01", level: "info", source: "Engineer", message: "Started dashboard migration" },
  { id: "l5", timestamp: "10:43:22", level: "error", source: "CTO", message: "Build failed: missing dependency @types/react" },
  { id: "l6", timestamp: "10:44:00", level: "info", source: "CTO", message: "Resolved: installed missing types" },
];

// ─── DashboardPage ───────────────────────────────────────────────────

export function DashboardPage() {
  const [loading] = useState(false);

  const summary: SummaryData = {
    totalAgents: DEMO_AGENTS.length,
    activeAgents: DEMO_AGENTS.filter((a) => a.status === "active" || a.status === "running").length,
    totalTasks: DEMO_TASKS.length,
    pendingTasks: DEMO_TASKS.filter((t) => t.status === "pending").length,
  };

  const handleRetry = useCallback(() => {
    // TODO: re-fetch via IPC
    window.location.reload();
  }, []);

  const handleAgentClick = useCallback((agent: AgentInfo) => {
    // TODO: navigate to agent detail
    console.log("Agent clicked:", agent.id);
  }, []);

  const handleTaskStatusChange = useCallback(
    (taskId: string, newStatus: TaskInfo["status"]) => {
      // TODO: IPC call to update task status
      console.log("Move task", taskId, "to", newStatus);
    },
    []
  );

  const handleTaskCancel = useCallback(
    (taskId: string) => {
      // TODO: IPC call to cancel task + kill agent subprocess
      console.log("Cancel task", taskId);
    },
    []
  );

  const handleTaskTitleEdit = useCallback(
    (taskId: string, newTitle: string) => {
      // TODO: IPC call to update task title
      console.log("Edit task", taskId, "title to", newTitle);
    },
    []
  );

  return (
    <section className="dashboard" aria-label="Agent status dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="dashboard-header-actions">
          <span className="dashboard-last-refresh">Updated just now</span>
        </div>
      </div>

      <ErrorBoundary fallbackTitle="Summary unavailable" onRetry={handleRetry}>
        {loading ? <SkeletonSummaryBar /> : <SummaryBar data={summary} />}
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Agents unavailable" onRetry={handleRetry}>
        <AgentCardGrid
          agents={DEMO_AGENTS}
          loading={loading}
          onAgentClick={handleAgentClick}
        />
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Task board unavailable" onRetry={handleRetry}>
        {loading ? (
          <div className="task-columns">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonKanbanColumn key={i} />
            ))}
          </div>
        ) : (
          <KanbanBoard
            tasks={DEMO_TASKS}
            onTaskStatusChange={handleTaskStatusChange}
            onTaskCancel={handleTaskCancel}
            onTaskTitleEdit={handleTaskTitleEdit}
          />
        )}
      </ErrorBoundary>

      <ErrorBoundary fallbackTitle="Logs unavailable" onRetry={handleRetry}>
        <LogStreamCard entries={DEMO_LOGS} loading={loading} />
      </ErrorBoundary>
    </section>
  );
}
