import { useState, ChangeEvent } from "react";
import { HookCall, HookResult, LogEntry } from "../types";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { JsonDisplay } from "./JsonDisplay";

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

  /**
   * Check if the content-type indicates JSON
   */
  const isJsonContent = (headers: Record<string, string>): boolean => {
    const contentType =
      Object.entries(headers).find(
        ([key]) => key.toLowerCase() === "content-type",
      )?.[1] || "";
    return contentType.includes("application/json");
  };

  /**
   * Parse body if it's JSON, otherwise return as-is
   */
  const parseBodyIfJson = (
    body: string,
    headers: Record<string, string>,
  ): unknown => {
    if (isJsonContent(headers)) {
      try {
        return JSON.parse(body);
      } catch {
        // If parsing fails, return as string
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
            <JsonDisplay
              data={inputs.requestHeaders}
              title="Request Headers (Modified by Previous Hooks)"
            />
          </div>
        )}

        {"headers" in inputs && (
          <div style={{ marginBottom: "20px" }}>
            <JsonDisplay
              data={inputs.headers}
              title={
                hook.includes("Response")
                  ? "Response Headers"
                  : "Request Headers"
              }
            />
          </div>
        )}

        {"body" in inputs && inputs.body && (
          <div style={{ marginBottom: "20px" }}>
            <JsonDisplay
              data={parseBodyIfJson(inputs.body, inputs.headers || {})}
              title={
                hook.includes("Response") ? "Response Body" : "Request Body"
              }
            />
          </div>
        )}

        {result?.input?.properties &&
          Object.keys(result.input.properties).length > 0 && (
            <div>
              <JsonDisplay
                data={result.input.properties}
                title="Properties (Before Hook Execution)"
              />
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
    const inputs = result.input;

    return (
      <div className="hook-outputs">
        <p style={{ color: "#b0b0b0", fontSize: "13px", marginBottom: "16px" }}>
          Data produced by this hook AFTER execution (modifications made by
          WASM)
        </p>

        {hook.includes("Request") && (
          <div style={{ marginBottom: "20px" }}>
            <JsonDisplay
              data={outputs.request.headers}
              compareWith={inputs?.request.headers}
              title="Request Headers (Modified)"
            />
          </div>
        )}

        {hook === "onRequestBody" && outputs.request.body && (
          <div style={{ marginBottom: "20px" }}>
            <JsonDisplay
              data={parseBodyIfJson(
                outputs.request.body,
                outputs.request.headers,
              )}
              compareWith={
                inputs?.request.body
                  ? parseBodyIfJson(inputs.request.body, inputs.request.headers)
                  : undefined
              }
              title="Request Body (Modified)"
            />
          </div>
        )}

        {hook.includes("Response") && (
          <>
            <div style={{ marginBottom: "20px" }}>
              <JsonDisplay
                data={outputs.response.headers}
                compareWith={inputs?.response.headers}
                title="Response Headers (Modified)"
              />
            </div>

            {hook === "onResponseBody" && outputs.response.body && (
              <div style={{ marginBottom: "20px" }}>
                <JsonDisplay
                  data={parseBodyIfJson(
                    outputs.response.body,
                    outputs.response.headers,
                  )}
                  compareWith={
                    inputs?.response.body
                      ? parseBodyIfJson(
                          inputs.response.body,
                          inputs.response.headers,
                        )
                      : undefined
                  }
                  title="Response Body (Modified)"
                />
              </div>
            )}
          </>
        )}

        {result?.output?.properties &&
          Object.keys(result.output.properties).length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <JsonDisplay
                data={result.output.properties}
                compareWith={result.input?.properties}
                title="Properties (After Hook Execution)"
              />
            </div>
          )}
      </div>
    );
  };

  /**
   * Filter logs by selected log level
   * Only show logs with level >= selected level
   */
  const filterLogs = (logs: LogEntry[], minLevel: number): LogEntry[] => {
    return logs.filter((log) => log.level >= minLevel);
  };

  /**
   * Get log level name for display
   */
  const getLogLevelName = (level: number): string => {
    const levels = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"];
    return levels[level] || "UNKNOWN";
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

    // Filter logs based on selected log level
    const filteredLogs =
      result.logs && result.logs.length > 0
        ? filterLogs(result.logs, logLevel)
        : [];

    const totalLogs = result.logs?.length || 0;
    const displayedLogs = filteredLogs.length;

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

        {totalLogs > 0 ? (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h4
                style={{
                  color: "#e0e0e0",
                  fontSize: "13px",
                  margin: 0,
                }}
              >
                Output
              </h4>
              {displayedLogs < totalLogs && (
                <span style={{ color: "#888", fontSize: "11px" }}>
                  Showing {displayedLogs} of {totalLogs} logs (filtered by
                  level)
                </span>
              )}
            </div>
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
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#666", marginRight: "8px" }}>
                      [{getLogLevelName(log.level)}]
                    </span>
                    {log.message}
                  </div>
                ))
              ) : (
                <div style={{ color: "#888", fontStyle: "italic" }}>
                  No logs at this level. Lower the log level to see more output.
                </div>
              )}
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
