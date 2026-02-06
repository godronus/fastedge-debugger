import { useState } from "react";
import { HookResult } from "../../types";
import styles from "./ResponseTabs.module.css";

interface ResponseTabsProps {
  results: Record<string, HookResult>;
}

type Tab = "body" | "headers";

export function ResponseTabs({ results }: ResponseTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("body");

  const hasResults = Object.keys(results).length > 0;

  return (
    <div className={styles.responsePanel}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "body" ? styles.active : ""}`}
          onClick={() => setActiveTab("body")}
        >
          Response Body
        </button>
        <button
          className={`${styles.tab} ${activeTab === "headers" ? styles.active : ""}`}
          onClick={() => setActiveTab("headers")}
        >
          Headers & Logs
        </button>
      </div>

      <div className={styles.tabContent}>
        {!hasResults ? (
          <div className={styles.empty}>
            No response yet. Run a hook to see results.
          </div>
        ) : (
          <>
            {activeTab === "body" && (
              <div>
                {Object.entries(results).map(([hook, result]) => (
                  <div key={hook} className={styles.outputEntry}>
                    <h3>{hook}</h3>
                    {result.error && (
                      <div className={styles.error}>Error: {result.error}</div>
                    )}
                    {result.returnValue !== undefined && (
                      <div className={styles.returnValue}>
                        Return Code: {result.returnValue}
                      </div>
                    )}
                    {result.logs && (
                      <pre className={styles.logs}>
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
                  <div key={hook} className={styles.outputEntry}>
                    <h3>{hook}</h3>
                    {result.error && (
                      <div className={styles.error}>Error: {result.error}</div>
                    )}
                    {result.logs && (
                      <div>
                        <label>Logs</label>
                        <pre className={styles.logs}>
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
