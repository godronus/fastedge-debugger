import { useState, ChangeEvent } from "react";
import { HookCall, HookResult } from "../types";
import { CollapsiblePanel } from "./CollapsiblePanel";

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

type SubView = "logs" | "inputs" | "outputs";

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

  const formatBody = (
    body: string,
    headers: Record<string, string>,
  ): string => {
    // Check if content-type indicates JSON
    const contentType =
      Object.entries(headers).find(
        ([key]) => key.toLowerCase() === "content-type",
      )?.[1] || "";

    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If parsing fails, return as-is
        return body;
      }
    }
    return body;
  };

  const getInputsForHook = (hook: string) => {
    const result = results[hook];

    // If we have server-returned INPUT data, use it. Otherwise fall back to hookCall (pre-execution state)
    if (result?.input) {
      switch (hook) {
        case "onRequestHeaders":
          return {
            headers: result.input.request.headers,
            metadata:
              "Request headers as received by this hook on the server (BEFORE modification)",
          };
        case "onRequestBody":
          return {
            body: result.input.request.body,
            headers: result.input.request.headers,
            metadata:
              "Request body and headers as received by this hook on the server (BEFORE modification)",
          };
        case "onResponseHeaders":
          return {
            headers: result.input.response.headers,
            requestHeaders: result.input.request.headers,
            metadata:
              "Response headers as received by this hook (with modified request headers from previous hooks)",
          };
        case "onResponseBody":
          return {
            body: result.input.response.body,
            headers: result.input.response.headers,
            requestHeaders: result.input.request.headers,
            metadata:
              "Response body and headers as received by this hook on the server",
          };
        default:
          return { metadata: "No input data" };
      }
    }

    // Fallback to hookCall data (before execution)
    switch (hook) {
      case "onRequestHeaders":
        return {
          headers: hookCall.request_headers || {},
          metadata: "(Not yet executed - showing initial state)",
        };
      case "onRequestBody":
        return {
          body: hookCall.request_body || "",
          headers: hookCall.request_headers || {},
          metadata: "(Not yet executed - showing initial state)",
        };
      case "onResponseHeaders":
        return {
          headers: hookCall.response_headers || {},
          metadata: "(Not yet executed - showing initial state)",
        };
      case "onResponseBody":
        return {
          body: hookCall.response_body || "",
          headers: hookCall.response_headers || {},
          metadata: "(Not yet executed - showing initial state)",
        };
      default:
        return { metadata: "No input data" };
    }
  };

  const renderInputs = (hook: string) => {
    const inputs = getInputsForHook(hook);
    const result = results[hook];

    return (
      <div className="hook-inputs">
        <p style={{ color: "#b0b0b0", fontSize: "13px", marginBottom: "16px" }}>
          {inputs.metadata}
        </p>

        {"requestHeaders" in inputs && (
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Request Headers (Modified by Previous Hooks)
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {JSON.stringify(inputs.requestHeaders, null, 2)}
            </pre>
          </div>
        )}

        {"headers" in inputs && (
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              {hook.includes("Response")
                ? "Response Headers"
                : "Request Headers"}
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
              {hook.includes("Response") ? "Response Body" : "Request Body"}
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {formatBody(inputs.body, inputs.headers || {})}
            </pre>
          </div>
        )}

        {result?.properties && Object.keys(result.properties).length > 0 && (
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
              {JSON.stringify(result.properties, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderOutputs = (hook: string) => {
    const result = results[hook];

    if (!result?.output) {
      return (
        <div style={{ color: "#666", fontStyle: "italic", padding: "20px" }}>
          No output yet. Click "Send" to execute this hook.
        </div>
      );
    }

    const outputs = result.output;

    return (
      <div className="hook-outputs">
        <p style={{ color: "#b0b0b0", fontSize: "13px", marginBottom: "16px" }}>
          Data produced by this hook AFTER execution (modifications made by
          WASM)
        </p>

        {hook.includes("Request") && (
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Request Headers (Modified)
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {JSON.stringify(outputs.request.headers, null, 2)}
            </pre>
          </div>
        )}

        {hook === "onRequestBody" && outputs.request.body && (
          <div style={{ marginBottom: "20px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                fontSize: "13px",
                marginBottom: "8px",
              }}
            >
              Request Body (Modified)
            </h4>
            <pre
              style={{
                background: "#1e1e1e",
                padding: "12px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {formatBody(outputs.request.body, outputs.request.headers)}
            </pre>
          </div>
        )}

        {hook.includes("Response") && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <h4
                style={{
                  color: "#e0e0e0",
                  fontSize: "13px",
                  marginBottom: "8px",
                }}
              >
                Response Headers (Modified)
              </h4>
              <pre
                style={{
                  background: "#1e1e1e",
                  padding: "12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                {JSON.stringify(outputs.response.headers, null, 2)}
              </pre>
            </div>

            {hook === "onResponseBody" && outputs.response.body && (
              <div style={{ marginBottom: "20px" }}>
                <h4
                  style={{
                    color: "#e0e0e0",
                    fontSize: "13px",
                    marginBottom: "8px",
                  }}
                >
                  Response Body (Modified)
                </h4>
                <pre
                  style={{
                    background: "#1e1e1e",
                    padding: "12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  {formatBody(outputs.response.body, outputs.response.headers)}
                </pre>
              </div>
            )}
          </>
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
      <CollapsiblePanel title="Logging" defaultExpanded={false}>
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
          <button
            className={`sub-tab ${activeSubView === "outputs" ? "active" : ""}`}
            onClick={() => setActiveSubView("outputs")}
          >
            Outputs
          </button>
        </div>

        <div className="stage-content">
          {activeSubView === "logs" && renderLogs(activeHook)}
          {activeSubView === "inputs" && renderInputs(activeHook)}
          {activeSubView === "outputs" && renderOutputs(activeHook)}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
