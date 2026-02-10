import { useState, useRef } from "react";
import { CollapsiblePanel } from "../../common/CollapsiblePanel";
import { DictionaryInput } from "../../common/DictionaryInput";
import { useAppStore } from "../../../stores";
import { HTTP_WASM_HOST } from "../../../stores/slices/httpWasmSlice";
import styles from "./HttpRequestPanel.module.css";

type Tab = "headers" | "body";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

export function HttpRequestPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("headers");
  const urlInputRef = useRef<HTMLInputElement>(null);

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

  // Get the path part (everything after the host)
  const path = httpUrl.startsWith(HTTP_WASM_HOST)
    ? httpUrl.slice(HTTP_WASM_HOST.length)
    : httpUrl;

  const handlePathChange = (newPath: string) => {
    // Construct full URL with fixed host + new path
    setHttpUrl(HTTP_WASM_HOST + newPath);
  };

  const handleSend = () => {
    executeHttpRequest();
  };

  const canSend = wasmPath && !httpIsExecuting;

  return (
    <CollapsiblePanel title="Request" defaultExpanded={true}>
      <div className={styles.requestPanel}>
        {/* Method and URL */}
        <div className={styles.requestBar}>
          <select
            value={httpMethod}
            onChange={(e) => setHttpMethod(e.target.value)}
            className={styles.methodSelect}
            disabled={httpIsExecuting}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>

          <div className={styles.urlInputContainer}>
            <span
              className={styles.urlPrefix}
              onClick={() => urlInputRef.current?.focus()}
            >
              {HTTP_WASM_HOST}
            </span>
            <input
              ref={urlInputRef}
              type="text"
              value={path}
              onChange={(e) => handlePathChange(e.target.value)}
              placeholder=""
              className={styles.urlInput}
              disabled={httpIsExecuting}
            />
          </div>
        </div>

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
            <span className={styles.hint}>Load a WASM file first</span>
          )}
        </div>
      </div>
    </CollapsiblePanel>
  );
}
