import { useState } from "react";
import { CollapsiblePanel } from "../../common/CollapsiblePanel";
import { RequestBar } from "../../common/RequestBar";
import { DictionaryInput } from "../../common/DictionaryInput";
import { useAppStore } from "../../../stores";
import styles from "./HttpRequestPanel.module.css";

type Tab = "headers" | "body";

export function HttpRequestPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("headers");

  // Get state from store
  const {
    httpMethod,
    httpUrl,
    httpRequestHeaders,
    httpRequestBody,
    httpIsExecuting,
    wasmPath,
    setHttpMethod,
    setHttpUrl,
    setHttpRequestHeaders,
    setHttpRequestBody,
    executeHttpRequest,
  } = useAppStore();

  const handleSend = () => {
    executeHttpRequest();
  };

  const canSend = wasmPath && !httpIsExecuting;

  return (
    <CollapsiblePanel title="Request" defaultExpanded={true}>
      <div className={styles.requestPanel}>
        {/* Method and URL */}
        <RequestBar
          method={httpMethod}
          url={httpUrl}
          onMethodChange={setHttpMethod}
          onUrlChange={setHttpUrl}
        />

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "headers" ? styles.active : ""}`}
            onClick={() => setActiveTab("headers")}
          >
            Headers
          </button>
          <button
            className={`${styles.tab} ${activeTab === "body" ? styles.active : ""}`}
            onClick={() => setActiveTab("body")}
          >
            Body
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === "headers" && (
            <div className={styles.headersTab}>
              <label>Request Headers:</label>
              <DictionaryInput
                value={httpRequestHeaders}
                onChange={setHttpRequestHeaders}
                keyPlaceholder="Header name (e.g., Content-Type)"
                valuePlaceholder="Header value (e.g., application/json)"
              />
            </div>
          )}

          {activeTab === "body" && (
            <div className={styles.bodyTab}>
              <label>Request Body:</label>
              <textarea
                className={styles.bodyTextarea}
                rows={10}
                value={httpRequestBody}
                onChange={(e) => setHttpRequestBody(e.target.value)}
                placeholder='{"key": "value"}'
              />
            </div>
          )}
        </div>

        {/* Send Button */}
        <div className={styles.actionBar}>
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!canSend}
          >
            {httpIsExecuting ? (
              <>
                <span className={styles.spinner}></span>
                Executing...
              </>
            ) : (
              "Send"
            )}
          </button>
          {!wasmPath && (
            <span className={styles.hint}>
              Load a WASM file first
            </span>
          )}
        </div>
      </div>
    </CollapsiblePanel>
  );
}
