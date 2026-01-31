import { useState } from "react";
import { HeadersEditor } from "./HeadersEditor";
import { CollapsiblePanel } from "./CollapsiblePanel";

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
        <div className="tabs">
          <button
            className={`tab ${activeTab === "headers" ? "active" : ""}`}
            onClick={() => setActiveTab("headers")}
          >
            Headers
          </button>
          <button
            className={`tab ${activeTab === "body" ? "active" : ""}`}
            onClick={() => setActiveTab("body")}
          >
            Body
          </button>
        </div>

        <div className="tab-content">
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
