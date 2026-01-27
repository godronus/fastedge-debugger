import { useState, ChangeEvent } from "react";
import { HookCall, HookResult } from "../types";

interface HookStagesPanelProps {
  results: Record<string, HookResult>;
  hookCall: HookCall;
  logLevel: number;
  onLogLevelChange: (level: number) => void;
}

const HOOKS = [
  "onRequestHeaders",
  "onRequestBody",
  "onResponseHeaders",
  "onResponseBody",
];

type SubView = "logs" | "inputs";

export function HookStagesPanel({
  results,
  hookCall,
  logLevel,
  onLogLevelChange,
}: HookStagesPanelProps) {
  const [activeHook, setActiveHook] = useState<string>("onRequestHeaders");
  const [activeSubView, setActiveSubView] = useState<SubView>("logs");

  const handleLogLevelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onLogLevelChange(parseInt(e.target.value, 10));
  };

  const getInputsForHook = (hook: string) => {
    switch (hook) {
      case "onRequestHeaders":
        return {
          headers: hookCall.request_headers || {},
          metadata: "Request headers that will be processed by this hook",
        };
      case "onRequestBody":
        return {
          body: hookCall.request_body || "",
          headers: hookCall.request_headers || {},
          metadata: "Request body and headers available during this hook",
        };
      case "onResponseHeaders":
        return {
          headers: hookCall.response_headers || {},
          metadata: "Response headers that will be processed by this hook",
        };
      case "onResponseBody":
        return {
          body: hookCall.response_body || "",
          headers: hookCall.response_headers || {},
          metadata: "Response body and headers available during this hook",
        };
      default:
        return { metadata: "No input data" };
    }
  };

  const renderInputs = (hook: string) => {
    const inputs = getInputsForHook(hook);

    return (
      <div className="hook-inputs">
        <p style={{ color: "#b0b0b0", fontSize: "13px", marginBottom: "16px" }}>
          {inputs.metadata}
        </p>

        {"headers" in inputs && (
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Headers
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {JSON.stringify(inputs.headers, null, 2)}
            </pre>
          </div>
        )}

        {"body" in inputs && inputs.body && (
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Body
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {inputs.body}
            </pre>
          </div>
        )}

        {hookCall.properties && Object.keys(hookCall.properties).length > 0 && (
          <div>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Properties
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {JSON.stringify(hookCall.properties, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderLogs = (hook: string) => {
    const result = results[hook];

    if (!result) {
      return (
        <div style={{ color: "#666", fontStyle: "italic", padding: "20px" }}>
          No logs yet. Click "Send" to execute this hook.
        </div>
      );
    }

    return (
      <div className="hook-logs">
        {result.error && (
          <div className="error" style={{ marginBottom: "12px" }}>
            Error: {result.error}
          </div>
        )}

        {result.returnValue !== undefined && (
          <div
            style={{ marginBottom: "12px", color: "#b0b0b0", fontSize: "13px" }}
          >
            <strong>Return Code:</strong> {result.returnValue}
          </div>
        )}

        {result.logs ? (
          <div>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Output
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
                maxHeight: "400px",
                overflow: "auto",
              }}
            >
              {result.logs}
            </pre>
          </div>
        ) : (
          <div style={{ color: "#666", fontStyle: "italic" }}>
            No logs produced by this hook.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="hook-stages-panel">
      <div className="stages-header">
        <div className="tabs">
          {HOOKS.map((hook) => (
            <button
              key={hook}
              className={`tab ${activeHook === hook ? "active" : ""}`}
              onClick={() => setActiveHook(hook)}
            >
              {hook}
            </button>
          ))}
        </div>

        <div className="log-level-selector">
          <label>Log Level:</label>
          <select value={logLevel} onChange={handleLogLevelChange}>
            <option value="0">Trace (0)</option>
            <option value="1">Debug (1)</option>
            <option value="2">Info (2)</option>
            <option value="3">Warn (3)</option>
            <option value="4">Error (4)</option>
            <option value="5">Critical (5)</option>
          </select>
        </div>
      </div>

      <div className="sub-view-tabs">
        <button
          className={`sub-tab ${activeSubView === "logs" ? "active" : ""}`}
          onClick={() => setActiveSubView("logs")}
        >
          Logs
        </button>
        <button
          className={`sub-tab ${activeSubView === "inputs" ? "active" : ""}`}
          onClick={() => setActiveSubView("inputs")}
        >
          Inputs
        </button>
      </div>

      <div className="stage-content">
        {activeSubView === "logs" && renderLogs(activeHook)}
        {activeSubView === "inputs" && renderInputs(activeHook)}
      </div>
    </div>
  );
}
