import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AgentNode } from "./AgentNode";
import { WorkflowToolbar } from "./WorkflowToolbar";

/** Pre-built template: "Code Review Pipeline" */
const DEFAULT_TEMPLATE: WorkflowDefinition = {
  nodes: [
    {
      id: "node-1",
      type: "agent",
      position: { x: 250, y: 50 },
      data: { agentId: null, label: "Analyze Code", description: "Scan codebase for issues and patterns" },
    },
    {
      id: "node-2",
      type: "agent",
      position: { x: 250, y: 250 },
      data: { agentId: null, label: "Review Findings", description: "Evaluate severity and suggest fixes" },
    },
    {
      id: "node-3",
      type: "agent",
      position: { x: 250, y: 450 },
      data: { agentId: null, label: "Apply Fixes", description: "Implement approved fixes and run tests" },
    },
  ],
  edges: [
    { id: "edge-1-2", source: "node-1", target: "node-2", label: "findings" },
    { id: "edge-2-3", source: "node-2", target: "node-3", label: "fix plan" },
  ],
};

let nodeIdCounter = 100;

function toReactFlowNodes(wfNodes: WorkflowNode[]): Node[] {
  return wfNodes.map((n) => ({
    id: n.id,
    type: "agent",
    position: n.position,
    data: { ...n.data },
  }));
}

function toReactFlowEdges(wfEdges: WorkflowEdge[]): Edge[] {
  return wfEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    animated: true,
  }));
}

function toWorkflowDefinition(nodes: Node[], edges: Edge[]): WorkflowDefinition {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: "agent" as const,
      position: n.position,
      data: {
        agentId: (n.data as Record<string, unknown>).agentId as string | null,
        label: (n.data as Record<string, unknown>).label as string,
        description: (n.data as Record<string, unknown>).description as string | undefined,
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
    })),
  };
}

export function WorkflowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const rfRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

  // Load workflows and agents on mount
  useEffect(() => {
    window.electronAPI.listWorkflows().then(setWorkflows).catch(() => {});
    window.electronAPI.listAgents().then(setAgents).catch(() => {});
  }, []);

  // Listen for "wf:load" custom events from toolbar select
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      loadWorkflow(id);
    };
    window.addEventListener("wf:load", handler);
    return () => window.removeEventListener("wf:load", handler);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: "smoothstep", animated: true }, eds)
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const agentId = event.dataTransfer.getData("application/agentId");
      const agentName = event.dataTransfer.getData("application/agentName");
      const agentRole = event.dataTransfer.getData("application/agentRole");

      if (!agentId || !rfRef.current) return;

      const position = rfRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node-${++nodeIdCounter}`,
        type: "agent",
        position,
        data: {
          agentId,
          label: agentName || "Agent Step",
          description: agentRole ? `Role: ${agentRole}` : undefined,
          agentRole,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const addNode = useCallback(() => {
    const id = `node-${++nodeIdCounter}`;
    const newNode: Node = {
      id,
      type: "agent",
      position: { x: 250 + Math.random() * 200, y: 100 + nodes.length * 150 },
      data: { agentId: null, label: `Step ${nodes.length + 1}`, description: "" },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length, setNodes]);

  const saveWorkflow = useCallback(async () => {
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const def = toWorkflowDefinition(nodes, edges);
      if (workflowId) {
        const result = await window.electronAPI.updateWorkflow(workflowId, {
          name: workflowName,
          definition: def,
        });
        if (result.ok) {
          setStatusMsg("Workflow updated");
        } else {
          setStatusMsg(`Error: ${result.error}`);
        }
      } else {
        const result = await window.electronAPI.createWorkflow({
          name: workflowName,
          definition: def,
        });
        if (result.ok) {
          setWorkflowId(result.data.id);
          setStatusMsg("Workflow saved");
        } else {
          setStatusMsg(`Error: ${result.error}`);
        }
      }
      // Refresh list
      window.electronAPI.listWorkflows().then(setWorkflows).catch(() => {});
    } catch (e) {
      setStatusMsg(`Error: ${(e as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, workflowId, workflowName]);

  const loadWorkflow = useCallback(
    async (id: string) => {
      try {
        const wf = await window.electronAPI.getWorkflow(id);
        if (!wf) {
          setStatusMsg("Workflow not found");
          return;
        }
        const def: WorkflowDefinition = JSON.parse(wf.definition);
        setNodes(toReactFlowNodes(def.nodes));
        setEdges(toReactFlowEdges(def.edges));
        setWorkflowId(wf.id);
        setWorkflowName(wf.name);
        setStatusMsg(`Loaded: ${wf.name}`);
      } catch (e) {
        setStatusMsg(`Error: ${(e as Error).message}`);
      }
    },
    [setNodes, setEdges]
  );

  const deleteWorkflow = useCallback(async () => {
    if (!workflowId) {
      // Just clear canvas
      setNodes([]);
      setEdges([]);
      setWorkflowId(null);
      setWorkflowName("Untitled Workflow");
      return;
    }
    try {
      const result = await window.electronAPI.deleteWorkflow(workflowId);
      if (result.ok) {
        setNodes([]);
        setEdges([]);
        setWorkflowId(null);
        setWorkflowName("Untitled Workflow");
        setStatusMsg("Workflow deleted");
        window.electronAPI.listWorkflows().then(setWorkflows).catch(() => {});
      } else {
        setStatusMsg(`Error: ${result.error}`);
      }
    } catch (e) {
      setStatusMsg(`Error: ${(e as Error).message}`);
    }
  }, [workflowId, setNodes, setEdges]);

  const executeWorkflow = useCallback(async () => {
    if (!workflowId) {
      setStatusMsg("Save the workflow before executing");
      return;
    }
    setIsExecuting(true);
    setStatusMsg(null);
    try {
      const result = await window.electronAPI.executeWorkflow(workflowId);
      if (result.ok) {
        setStatusMsg(
          `Executed: ${result.data.taskIds.length} tasks created`
        );
      } else {
        setStatusMsg(`Error: ${result.error}`);
      }
    } catch (e) {
      setStatusMsg(`Error: ${(e as Error).message}`);
    } finally {
      setIsExecuting(false);
    }
  }, [workflowId]);

  const loadTemplate = useCallback(
    (templateId: string) => {
      loadWorkflow(templateId);
    },
    [loadWorkflow]
  );

  // Keyboard shortcut: Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveWorkflow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveWorkflow]);

  // Seed default template on first run (if no workflows exist)
  useEffect(() => {
    if (workflows.length === 0) {
      window.electronAPI
        .createWorkflow({
          name: "Code Review Pipeline",
          description: "Pre-built template: Analyze → Review → Fix",
          definition: DEFAULT_TEMPLATE,
          is_template: true,
        })
        .then(() => window.electronAPI.listWorkflows())
        .then(setWorkflows)
        .catch(() => {});
    }
  }, [workflows.length]);

  return (
    <div className="wf-page">
      <WorkflowToolbar
        workflowName={workflowName}
        onNameChange={setWorkflowName}
        onSave={saveWorkflow}
        onLoad={loadWorkflow}
        onExecute={executeWorkflow}
        onDelete={deleteWorkflow}
        onAddNode={addNode}
        onTemplateSelect={loadTemplate}
        workflows={workflows}
        isSaving={isSaving}
        isExecuting={isExecuting}
        hasNodes={nodes.length > 0}
      />
      {statusMsg && (
        <div className="wf-status" role="status">
          {statusMsg}
        </div>
      )}
      <div className="wf-canvas-container">
        <div className="wf-agent-palette">
          <h3 className="wf-palette-title">Agents</h3>
          <p className="wf-palette-hint">Drag onto canvas</p>
          {agents.length === 0 ? (
            <p className="wf-palette-empty">No agents configured</p>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="wf-palette-agent"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/agentId", agent.id);
                  e.dataTransfer.setData("application/agentName", agent.name);
                  e.dataTransfer.setData("application/agentRole", agent.role);
                  e.dataTransfer.effectAllowed = "move";
                }}
              >
                <span className="wf-palette-agent-name">{agent.name}</span>
                <span className="wf-palette-agent-role">{agent.role}</span>
              </div>
            ))
          )}
        </div>
        <div className="wf-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(instance) => {
              rfRef.current = instance;
            }}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            snapToGrid
            snapGrid={[16, 16]}
            proOptions={{ hideAttribution: true }}
          >
            <Controls className="wf-controls" />
            <MiniMap
              className="wf-minimap"
              nodeColor="#3b82f6"
              maskColor="rgba(15, 23, 42, 0.7)"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#334155"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
