import React from "react";

interface WorkflowToolbarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (id: string) => void;
  onExecute: () => void;
  onDelete: () => void;
  onAddNode: () => void;
  onTemplateSelect: (templateId: string) => void;
  workflows: Array<{ id: string; name: string; is_template: number }>;
  isSaving: boolean;
  isExecuting: boolean;
  hasNodes: boolean;
}

export function WorkflowToolbar({
  workflowName,
  onNameChange,
  onSave,
  onExecute,
  onDelete,
  onAddNode,
  onTemplateSelect,
  workflows,
  isSaving,
  isExecuting,
  hasNodes,
}: WorkflowToolbarProps) {
  const templates = workflows.filter((w) => w.is_template === 1);
  const saved = workflows.filter((w) => w.is_template === 0);

  return (
    <div className="wf-toolbar">
      <div className="wf-toolbar-left">
        <input
          type="text"
          className="wf-toolbar-name"
          value={workflowName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Untitled Workflow"
          aria-label="Workflow name"
        />
      </div>
      <div className="wf-toolbar-center">
        <button
          type="button"
          className="wf-toolbar-btn"
          onClick={onAddNode}
          title="Add agent node"
        >
          + Node
        </button>
        {templates.length > 0 && (
          <select
            className="wf-toolbar-select"
            value=""
            onChange={(e) => {
              if (e.target.value) onTemplateSelect(e.target.value);
            }}
            aria-label="Load template"
          >
            <option value="">Load template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {saved.length > 0 && (
          <select
            className="wf-toolbar-select"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                const event = new CustomEvent("wf:load", { detail: e.target.value });
                window.dispatchEvent(event);
              }
            }}
            aria-label="Load saved workflow"
          >
            <option value="">Load saved…</option>
            {saved.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="wf-toolbar-right">
        <button
          type="button"
          className="wf-toolbar-btn wf-toolbar-btn--secondary"
          onClick={onSave}
          disabled={isSaving}
          title="Save workflow (⌘S)"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="wf-toolbar-btn wf-toolbar-btn--danger"
          onClick={onDelete}
          title="Delete workflow"
        >
          Delete
        </button>
        <button
          type="button"
          className="wf-toolbar-btn wf-toolbar-btn--primary"
          onClick={onExecute}
          disabled={!hasNodes || isExecuting}
          title="Execute workflow"
        >
          {isExecuting ? "Executing…" : "▶ Execute"}
        </button>
      </div>
    </div>
  );
}
