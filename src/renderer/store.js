/**
 * Lightweight observable store for renderer state management.
 * Vanilla JS publish-subscribe pattern — no framework dependencies.
 *
 * Usage:
 *   const store = createStore({ agents: [], loading: false });
 *   store.subscribe((state) => renderAgents(state.agents));
 *   store.setState({ agents: newList });
 */

(function () {
  "use strict";

  /**
   * Create an observable store with initial state.
   * @param {Object} initialState
   * @returns {{ getState, setState, subscribe }}
   */
  function createStore(initialState) {
    var state = Object.assign({}, initialState);
    var listeners = [];

    function getState() {
      return state;
    }

    function setState(partial) {
      var prev = state;
      state = Object.assign({}, state, partial);
      for (var i = 0; i < listeners.length; i++) {
        try {
          listeners[i](state, prev);
        } catch (err) {
          console.error("Store listener error:", err);
        }
      }
    }

    function subscribe(listener) {
      listeners.push(listener);
      return function unsubscribe() {
        var idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }

    return { getState: getState, setState: setState, subscribe: subscribe };
  }

  // ── Agent Store ──

  var agentStore = createStore({
    agents: [],
    loading: false,
    error: null,
  });

  /**
   * Fetch all agents from the main process and update the store.
   */
  async function loadAgents() {
    agentStore.setState({ loading: true, error: null });
    try {
      var agents = await window.electronAPI.listAgents();
      agentStore.setState({ agents: agents, loading: false });
    } catch (err) {
      agentStore.setState({ loading: false, error: err.message || "Failed to load agents" });
    }
  }

  /**
   * Create a new agent and reload the list.
   * @param {Object} input - CreateAgentInput
   * @returns {{ ok: boolean, error?: string }}
   */
  async function createAgent(input) {
    try {
      var result = await window.electronAPI.createAgent(input);
      if (result.ok) {
        await loadAgents();
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message || "Failed to create agent" };
    }
  }

  /**
   * Update an existing agent and reload the list.
   * @param {string} id
   * @param {Object} input - UpdateAgentInput
   * @returns {{ ok: boolean, error?: string }}
   */
  async function updateAgent(id, input) {
    try {
      var result = await window.electronAPI.updateAgent(id, input);
      if (result.ok) {
        await loadAgents();
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message || "Failed to update agent" };
    }
  }

  /**
   * Delete an agent and reload the list.
   * @param {string} id
   * @returns {{ ok: boolean, error?: string }}
   */
  async function deleteAgent(id) {
    try {
      var result = await window.electronAPI.deleteAgent(id);
      if (result.ok) {
        await loadAgents();
      }
      return result;
    } catch (err) {
      return { ok: false, error: err.message || "Failed to delete agent" };
    }
  }

  // Export to global scope
  window.agentStore = agentStore;
  window.agentActions = {
    load: loadAgents,
    create: createAgent,
    update: updateAgent,
    delete: deleteAgent,
  };

  // ── Task Store (sub-state + elapsed time tracking) ──

  var taskStore = createStore({
    tasks: [],
    loading: false,
    error: null,
  });

  /**
   * Format elapsed time from a started_at ISO string.
   * Returns "mm:ss" or "hh:mm:ss" for long tasks.
   */
  function formatElapsed(startedAt) {
    if (!startedAt) return "";
    var ms = Date.now() - new Date(startedAt).getTime();
    if (ms < 0) ms = 0;
    var secs = Math.floor(ms / 1000);
    var mins = Math.floor(secs / 60);
    var hrs = Math.floor(mins / 60);
    secs = secs % 60;
    mins = mins % 60;
    if (hrs > 0) {
      return hrs + ":" + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
    }
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  async function loadTasks(token) {
    if (!window.app || !window.app.tasks) return;
    taskStore.setState({ loading: true, error: null });
    try {
      var tasks = await window.app.tasks.list(token);
      taskStore.setState({ tasks: tasks, loading: false });
    } catch (err) {
      taskStore.setState({ loading: false, error: err.message || "Failed to load tasks" });
    }
  }

  window.taskStore = taskStore;
  window.taskActions = {
    load: loadTasks,
    formatElapsed: formatElapsed,
  };
})();
