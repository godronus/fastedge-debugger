import { useState } from "react";
import { CollapsiblePanel } from "../../common/CollapsiblePanel";
import { ResponseViewer } from "../../common/ResponseViewer";
import { LogsViewer } from "../../common/LogsViewer";
import { useAppStore } from "../../../stores";
import styles from "./HttpResponsePanel.module.css";

type Tab = "body" | "headers" | "logs";

export function HttpResponsePanel() {
  const [activeTab, setActiveTab] = useState<Tab>("body");

  // Get state from store
  const { httpResponse, httpLogs } = useAppStore();

  // Status badge component
  const StatusBadge = () => {
    if (!httpResponse) return null;

    const status = httpResponse.status;
    let statusClass = styles.statusDefault;

    if (status >= 200 && status < 300) {
      statusClass = styles.statusSuccess;
    } else if (status >= 300 && status < 400) {
      statusClass = styles.statusRedirect;
    } else if (status >= 400 && status < 500) {
      statusClass = styles.statusClientError;
    } else if (status >= 500) {
      statusClass = styles.statusServerError;
    } else if (status === 0) {
      statusClass = styles.statusError;
    }

    return (
      <div className={`${styles.statusBadge} ${statusClass}`}>
        {status === 0 ? "Error" : `${status} ${httpResponse.statusText}`}
      </div>
    );
  };

  // Empty state
  if (!httpResponse) {
    return (
      <CollapsiblePanel title="Response" defaultExpanded={true}>
        <div className={styles.emptyState}>
          <p>Send a request to see the response</p>
        </div>
      </CollapsiblePanel>
    );
  }

  return (
    <CollapsiblePanel
      title="Response"
      headerExtra={<StatusBadge />}
      defaultExpanded={true}
    >
      <div className={styles.responsePanel}>
        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "body" ? styles.active : ""}`}
            onClick={() => setActiveTab("body")}
          >
            Body
          </button>
          <button
            className={`${styles.tab} ${activeTab === "headers" ? styles.active : ""}`}
            onClick={() => setActiveTab("headers")}
          >
            Headers
          </button>
          <button
            className={`${styles.tab} ${activeTab === "logs" ? styles.active : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Logs
            {httpLogs.length > 0 && (
              <span className={styles.badge}>{httpLogs.length}</span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === "body" && (
            <div className={styles.bodyTab}>
              <ResponseViewer response={httpResponse} />
            </div>
          )}

          {activeTab === "headers" && (
            <div className={styles.headersTab}>
              <div className={styles.headersTable}>
                {Object.entries(httpResponse.headers).length > 0 ? (
                  Object.entries(httpResponse.headers).map(([key, value]) => (
                    <div key={key} className={styles.headerRow}>
                      <div className={styles.headerKey}>{key}:</div>
                      <div className={styles.headerValue}>{value}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.noHeaders}>No headers</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "logs" && (
            <div className={styles.logsTab}>
              <LogsViewer logs={httpLogs} defaultLogLevel={0} />
            </div>
          )}
        </div>
      </div>
    </CollapsiblePanel>
  );
}
