import React, { useState, useRef, useEffect, useCallback } from "react";

export interface TaskInfo {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "review" | "done" | "cancelled";
  priority?: "critical" | "high" | "medium" | "low";
  assigneeName?: string;
  elapsed?: string;
}

interface TaskKanbanCardProps {
  task: TaskInfo;
  onStatusChange?: (taskId: string, newStatus: TaskInfo["status"]) => void;
  onCancel?: (taskId: string) => void;
  onTitleEdit?: (taskId: string, newTitle: string) => void;
}

export function TaskKanbanCard({
  task,
  onStatusChange,
  onCancel,
  onTitleEdit,
}: TaskKanbanCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCancelled = task.status === "cancelled";

  const statusOptions: TaskInfo["status"][] = [
    "pending",
    "in_progress",
    "review",
    "done",
    "cancelled",
  ];

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.title && onTitleEdit) {
      onTitleEdit(task.id, trimmed);
    } else {
      setEditValue(task.title);
    }
    setEditing(false);
  }, [editValue, task.id, task.title, onTitleEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        setEditValue(task.title);
        setEditing(false);
      }
    },
    [commitEdit, task.title]
  );

  return (
    <div
      className={`task-card${isCancelled ? " task-card--cancelled" : ""}`}
      role="listitem"
      aria-label={task.title}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="task-card__title-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          aria-label="Edit task title"
        />
      ) : (
        <span
          className="task-card-title"
          onDoubleClick={() => {
            if (!isCancelled) {
              setEditValue(task.title);
              setEditing(true);
            }
          }}
          title={isCancelled ? undefined : "Double-click to edit"}
          style={isCancelled ? undefined : { cursor: "text" }}
        >
          {task.title}
        </span>
      )}

      {isCancelled && (
        <span className="status-badge--cancelled">Cancelled</span>
      )}

      <div className="task-card-meta">
        {task.priority && (
          <span
            className={`task-card-priority task-card-priority--${task.priority}`}
          >
            {task.priority}
          </span>
        )}
        {task.assigneeName && (
          <span className="task-card-assignee">{task.assigneeName}</span>
        )}
        {task.elapsed && (
          <span className="task-card-elapsed">{task.elapsed}</span>
        )}
      </div>

      <div className="task-card-actions">
        {onStatusChange && (
          <>
            <label htmlFor={`move-${task.id}`} className="visually-hidden">
              Move task
            </label>
            <select
              id={`move-${task.id}`}
              className="task-move-select"
              value={task.status}
              onChange={(e) =>
                onStatusChange(task.id, e.target.value as TaskInfo["status"])
              }
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "in_progress"
                    ? "In Progress"
                    : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </>
        )}
        {onCancel && !isCancelled && task.status !== "done" && (
          <button
            type="button"
            className="task-cancel-btn"
            onClick={() => onCancel(task.id)}
            aria-label={`Cancel task: ${task.title}`}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  taskTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  taskTitle,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      if (open) onCancel();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [open, onCancel]);

  return (
    <dialog ref={dialogRef} className="confirm-dialog">
      <div className="confirm-dialog-body">
        <h2>Cancel Task</h2>
        <p>
          Are you sure you want to cancel <strong>{taskTitle}</strong>? If this
          task is currently running, the agent process will be terminated.
        </p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-cancel"
            onClick={onCancel}
          >
            Keep Task
          </button>
          <button
            type="button"
            className="confirm-dialog-confirm"
            onClick={onConfirm}
          >
            Cancel Task
          </button>
        </div>
      </div>
    </dialog>
  );
}

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="undo-toast" role="alert">
      <span className="undo-toast-message">{message}</span>
      <button type="button" className="undo-toast-btn" onClick={onUndo}>
        Undo
      </button>
      <button
        type="button"
        className="undo-toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}

interface KanbanBoardProps {
  tasks: TaskInfo[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onTaskStatusChange?: (taskId: string, newStatus: TaskInfo["status"]) => void;
  onTaskCancel?: (taskId: string) => void;
  onTaskTitleEdit?: (taskId: string, newTitle: string) => void;
}

const COLUMNS: { key: TaskInfo["status"]; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

export function KanbanBoard({
  tasks,
  loading = false,
  error = null,
  onRetry,
  onTaskStatusChange,
  onTaskCancel,
  onTaskTitleEdit,
}: KanbanBoardProps) {
  const [confirmTask, setConfirmTask] = useState<TaskInfo | null>(null);
  const [undoInfo, setUndoInfo] = useState<{
    taskId: string;
    prevStatus: TaskInfo["status"];
    title: string;
  } | null>(null);

  const handleCancelClick = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) setConfirmTask(task);
    },
    [tasks]
  );

  const handleConfirmCancel = useCallback(() => {
    if (!confirmTask || !onTaskCancel) return;
    const prevStatus = confirmTask.status;
    setUndoInfo({ taskId: confirmTask.id, prevStatus, title: confirmTask.title });
    onTaskCancel(confirmTask.id);
    setConfirmTask(null);
  }, [confirmTask, onTaskCancel]);

  const handleUndo = useCallback(() => {
    if (!undoInfo || !onTaskStatusChange) return;
    onTaskStatusChange(undoInfo.taskId, undoInfo.prevStatus);
    setUndoInfo(null);
  }, [undoInfo, onTaskStatusChange]);

  if (loading) {
    return (
      <div className="task-columns" role="list" aria-label="Task board loading">
        {COLUMNS.map((col) => (
          <div key={col.key} className="task-column" aria-busy="true">
            <h2 className="task-column-title">
              <span className={`task-column-dot task-column-dot--${col.key}`} />
              {col.label}
              <span className="task-column-count">-</span>
            </h2>
            <div className="task-column-cards">
              {Array.from({ length: 2 }).map((_, i) => (
                <SkeletonTaskCard key={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error" role="alert">
        <p className="dashboard-error-message">{error}</p>
        {onRetry && (
          <button
            type="button"
            className="sidebar-action-btn"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const grouped = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.key),
  }));

  return (
    <>
      <div className="task-columns" role="list" aria-label="Task board">
        {grouped.map((col) => (
          <div key={col.key} className="task-column" data-status={col.key}>
            <h2 className="task-column-title">
              <span className={`task-column-dot task-column-dot--${col.key}`} />
              {col.label}
              <span className="task-column-count">{col.tasks.length}</span>
            </h2>
            <div
              className="task-column-cards"
              role="list"
              aria-label={`${col.label} tasks`}
            >
              {col.tasks.length === 0 ? (
                <div
                  className="task-column-empty"
                  style={{
                    padding: "20px 0",
                    textAlign: "center",
                    color: "var(--color-text-tertiary)",
                    fontSize: 12,
                  }}
                >
                  No tasks
                </div>
              ) : (
                col.tasks.map((task) => (
                  <TaskKanbanCard
                    key={task.id}
                    task={task}
                    onStatusChange={onTaskStatusChange}
                    onCancel={handleCancelClick}
                    onTitleEdit={onTaskTitleEdit}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmTask && (
        <ConfirmDialog
          open
          taskTitle={confirmTask.title}
          onConfirm={handleConfirmCancel}
          onCancel={() => setConfirmTask(null)}
        />
      )}

      {undoInfo && (
        <UndoToast
          message={`"${undoInfo.title}" cancelled`}
          onUndo={handleUndo}
          onDismiss={() => setUndoInfo(null)}
        />
      )}
    </>
  );
}

function SkeletonTaskCard() {
  return (
    <div className="task-card" aria-busy="true">
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: "80%",
          height: 13,
          borderRadius: "var(--radius-sm)",
          background:
            "linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%)",
          backgroundSize: "200% 100%",
          animation: "skeleton-shimmer 1.5s ease-in-out infinite",
        }}
      />
      <div className="task-card-meta">
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 40,
            height: 10,
            borderRadius: "var(--radius-sm)",
            background:
              "linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-shimmer 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
