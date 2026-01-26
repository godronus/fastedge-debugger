import { useState } from "react";
import { HeadersEditor } from "./HeadersEditor";
import { PropertiesEditor } from "./PropertiesEditor";

interface RequestTabsProps {
  headers: Record<string, string>;
  body: string;
  properties: Record<string, string>;
  onHeadersChange: (headers: Record<string, string>) => void;
  onBodyChange: (body: string) => void;
  onPropertiesChange: (properties: Record<string, string>) => void;
}

type Tab = "headers" | "body" | "properties";

export function RequestTabs({
  headers,
  body,
  properties,
  onHeadersChange,
  onBodyChange,
  onPropertiesChange,
}: RequestTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("headers");

  return (
    <div>
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
        <button
          className={`tab ${activeTab === "properties" ? "active" : ""}`}
          onClick={() => setActiveTab("properties")}
        >
          Properties
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "headers" && (
          <HeadersEditor
            title="Request Headers"
            value={headers}
            onChange={onHeadersChange}
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

        {activeTab === "properties" && (
          <PropertiesEditor value={properties} onChange={onPropertiesChange} />
        )}
      </div>
    </div>
  );
}
