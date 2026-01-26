import { useState } from "react";
import { HookResult } from "../types";

interface ResponseTabsProps {
  results: Record<string, HookResult>;
}

type Tab = "body" | "headers";

export function ResponseTabs({ results }: ResponseTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("body");

  const hasResults = Object.keys(results).length > 0;

  return (
    <div className="response-panel">
      <div className="tabs">
        <button
          className={`tab ${activeTab === "body" ? "active" : ""}`}
          onClick={() => setActiveTab("body")}
        >
          Response Body
        </button>
        <button
          className={`tab ${activeTab === "headers" ? "active" : ""}`}
          onClick={() => setActiveTab("headers")}
        >
          Headers & Logs
        </button>
      </div>

      <div className="tab-content" style={{ flex: 1, overflow: "auto" }}>
        {!hasResults ? (
          <div style={{ color: "#666", fontStyle: "italic" }}>
            No response yet. Run a hook to see results.
          </div>
        ) : (
          <>
            {activeTab === "body" && (
              <div>
                {Object.entries(results).map(([hook, result]) => (
                  <div key={hook} className="output-entry">
                    <h3>{hook}</h3>
                    {result.error && (
                      <div className="error">Error: {result.error}</div>
                    )}
                    {result.returnValue !== undefined && (
                      <div style={{ marginBottom: "8px", color: "#b0b0b0" }}>
                        Return Code: {result.returnValue}
                      </div>
                    )}
                    {result.logs && (
                      <pre style={{ maxHeight: "300px", overflow: "auto" }}>
                        {result.logs}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "headers" && (
              <div>
                {Object.entries(results).map(([hook, result]) => (
                  <div key={hook} className="output-entry">
                    <h3>{hook}</h3>
                    {result.error && (
                      <div className="error">Error: {result.error}</div>
                    )}
                    {result.logs && (
                      <div>
                        <label>Logs</label>
                        <pre style={{ maxHeight: "200px", overflow: "auto" }}>
                          {result.logs}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
