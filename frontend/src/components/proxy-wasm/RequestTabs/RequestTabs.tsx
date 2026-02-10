import { useState } from "react";
import { HeadersEditor } from "../HeadersEditor";
import { CollapsiblePanel } from "../../common/CollapsiblePanel";
import styles from "./RequestTabs.module.css";

interface DefaultValue {
  value: string;
  enabled?: boolean;
  placeholder?: string;
}

interface RequestTabsProps {
  headers: Record<string, string>;
  body: string;
  onHeadersChange: (headers: Record<string, string>) => void;
  onBodyChange: (body: string) => void;
  defaultHeaders?: Record<string, string | DefaultValue>;
}

type Tab = "headers" | "body";

export function RequestTabs({
  headers,
  body,
  onHeadersChange,
  onBodyChange,
  defaultHeaders,
}: RequestTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("headers");

  return (
    <div>
      <CollapsiblePanel title="Request" defaultExpanded={true}>
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

        <div className={styles.tabContent}>
          {activeTab === "headers" && (
            <HeadersEditor
              title="Request Headers"
              value={headers}
              onChange={onHeadersChange}
              defaultValues={defaultHeaders}
            />
          )}

          {activeTab === "body" && (
            <div>
              <label>Request Body</label>
              <textarea
                rows={8}
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                placeholder='{"key": "value"}'
              />
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
