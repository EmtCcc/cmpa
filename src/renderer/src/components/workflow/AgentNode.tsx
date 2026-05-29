import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

/** Custom React Flow node representing an agent step in a workflow. */
function AgentNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as {
    label: string;
    description?: string;
    agentId: string | null;
    agentRole?: string;
  };

  return (
    <div className={`wf-agent-node${selected ? " wf-agent-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="wf-handle wf-handle--target" />
      <div className="wf-agent-node-header">
        <span className="wf-agent-node-icon">⚡</span>
        <span className="wf-agent-node-label">{nodeData.label}</span>
      </div>
      {nodeData.agentRole && (
        <span className="wf-agent-node-role">{nodeData.agentRole}</span>
      )}
      {nodeData.description && (
        <p className="wf-agent-node-desc">{nodeData.description}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="wf-handle wf-handle--source" />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
