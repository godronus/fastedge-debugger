import { useState, useEffect } from "react";
import { CollapsiblePanel } from "../CollapsiblePanel";
import { JsonDisplay } from "../JsonDisplay";
import styles from "./ResponsePanel.module.css";

interface ResponsePanelProps {
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    contentType: string;
    isBase64?: boolean;
  } | null;
}

type Tab = "body" | "preview" | "headers";

export function ResponsePanel({ response }: ResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("body");

  // Auto-switch to appropriate tab based on content type
  useEffect(() => {
    if (response) {
      const isImage = response.contentType.startsWith("image/");
      const isHtml = response.contentType.includes("text/html");
      const isBinary =
        response.isBase64 ||
        isImage ||
        response.contentType.startsWith("video/") ||
        response.contentType.startsWith("audio/") ||
        response.contentType.includes("application/octet-stream") ||
        response.contentType.includes("application/pdf") ||
        response.contentType.includes("application/zip");

      // If it has a preview (HTML or image), show preview
      if (isHtml || isImage) {
        setActiveTab("preview");
      }
      // If it's binary but not previewable, show headers
      else if (isBinary) {
        setActiveTab("headers");
      }
      // Otherwise show body (JSON, XML, text, etc.)
      else {
        setActiveTab("body");
      }
    }
  }, [response]);

  if (!response) {
    return (
      <div className={styles.responsePanel}>
        <CollapsiblePanel title="Response" defaultExpanded={true}>
          <div className={styles.responseEmpty}>
            Click "Send" to execute the request and view the response.
          </div>
        </CollapsiblePanel>
      </div>
    );
  }

  const getStatusColor = (status: number) => {
    if (status === 0) return "#ff6b6b"; // Error
    if (status >= 200 && status < 300) return "#51cf66"; // Success
    if (status >= 300 && status < 400) return "#ffd43b"; // Redirect
    if (status >= 400 && status < 500) return "#ff8787"; // Client error
    return "#ff6b6b"; // Server error
  };

  const isImage = response.contentType.startsWith("image/");
  const isHtml = response.contentType.includes("text/html");
  const isXml = response.contentType.includes("xml");
  const isJson =
    response.contentType.includes("application/json") ||
    response.contentType.includes("text/json");
  const isBinary =
    response.isBase64 ||
    isImage ||
    response.contentType.startsWith("video/") ||
    response.contentType.startsWith("audio/") ||
    response.contentType.includes("application/octet-stream") ||
    response.contentType.includes("application/pdf") ||
    response.contentType.includes("application/zip");

  // Only show preview tab for content types that have a meaningful preview
  const hasPreview = isHtml || isImage;

  const formatHtml = (html: string): string => {
    try {
      // Simple HTML formatter
      let formatted = html;
      let indent = 0;
      const tab = "  ";

      // Add newlines after closing tags and before opening tags
      formatted = formatted.replace(/>\s*</g, ">\n<");

      const lines = formatted.split("\n");
      const formattedLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Decrease indent for closing tags
        if (trimmed.startsWith("</")) {
          indent = Math.max(0, indent - 1);
        }

        formattedLines.push(tab.repeat(indent) + trimmed);

        // Increase indent for opening tags (but not self-closing or inline)
        if (
          trimmed.startsWith("<") &&
          !trimmed.startsWith("</") &&
          !trimmed.endsWith("/>") &&
          !trimmed.match(/<(br|img|input|hr|meta|link)[>\s]/i)
        ) {
          // Check if it's not immediately closed on the same line
          if (!trimmed.includes("</")) {
            indent++;
          }
        }
      }

      return formattedLines.join("\n");
    } catch {
      return html;
    }
  };

  const formatXml = (xml: string): string => {
    try {
      // Simple XML formatter (similar to HTML)
      let formatted = xml;
      let indent = 0;
      const tab = "  ";

      formatted = formatted.replace(/>\s*</g, ">\n<");

      const lines = formatted.split("\n");
      const formattedLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("</")) {
          indent = Math.max(0, indent - 1);
        }

        formattedLines.push(tab.repeat(indent) + trimmed);

        if (
          trimmed.startsWith("<") &&
          !trimmed.startsWith("</") &&
          !trimmed.endsWith("/>") &&
          !trimmed.startsWith("<?") &&
          !trimmed.startsWith("<!")
        ) {
          if (!trimmed.includes("</")) {
            indent++;
          }
        }
      }

      return formattedLines.join("\n");
    } catch {
      return xml;
    }
  };

  const renderBody = () => {
    if (isJson) {
      try {
        const parsed = JSON.parse(response.body);
        return <JsonDisplay data={parsed} style={{ margin: 0 }} />;
      } catch {
        return <pre style={{ margin: 0 }}>{response.body}</pre>;
      }
    }

    if (isHtml) {
      const formatted = formatHtml(response.body);
      return <pre style={{ margin: 0 }}>{formatted}</pre>;
    }

    if (isXml) {
      const formatted = formatXml(response.body);
      return <pre style={{ margin: 0 }}>{formatted}</pre>;
    }

    return <pre style={{ margin: 0 }}>{response.body}</pre>;
  };

  const renderPreview = () => {
    if (isImage) {
      return (
        <div className={styles.imagePreview}>
          <img
            src={`data:${response.contentType};base64,${response.body}`}
            alt="Response preview"
            className={styles.previewImage}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const container = target.parentElement;
              if (container) {
                container.innerHTML = `<p style="color: #666;">Unable to display image. Content-Type: ${response.contentType}</p><p style="color: #999; font-size: 12px;">The image data may be corrupted or in an unsupported format.</p>`;
              }
            }}
          />
        </div>
      );
    }

    if (isHtml) {
      return (
        <iframe
          srcDoc={response.body}
          title="Response preview"
          className={styles.htmlPreview}
          sandbox="allow-same-origin"
        />
      );
    }

    if (isBinary && !isImage) {
      return (
        <div className={styles.binaryNotice}>
          <p>Binary content: {response.contentType}</p>
          <p style={{ fontSize: "12px", marginTop: "8px" }}>
            Preview not available for binary content. Check the "Headers" tab
            for response metadata.
          </p>
        </div>
      );
    }

    // For other types, show the raw content
    return (
      <div className={styles.binaryNotice}>
        <p>Preview not available for content type: {response.contentType}</p>
        <p style={{ fontSize: "12px", marginTop: "8px" }}>
          Switch to "Body" tab to view raw content.
        </p>
      </div>
    );
  };

  const renderHeaders = () => {
    const entries = Object.entries(response.headers);
    if (entries.length === 0) {
      return (
        <div className={styles.noHeaders}>
          No headers received
        </div>
      );
    }

    return (
      <div className={styles.headersList}>
        {entries.map(([key, value]) => (
          <div key={key} className={styles.headerItem}>
            <span className={styles.headerKey}>{key}:</span>
            <span className={styles.headerValue}>{value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.responsePanel}>
      <CollapsiblePanel
        title="Response"
        defaultExpanded={true}
        headerExtra={
          <div className={styles.responseStatus}>
            <span
              style={{
                color: getStatusColor(response.status),
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              {response.status === 0
                ? "ERROR"
                : `${response.status} ${response.statusText}`}
            </span>
            <span
              style={{ color: "#666", marginLeft: "12px", fontSize: "12px" }}
            >
              {response.contentType}
            </span>
          </div>
        }
      >
        <div className={styles.tabs}>
          {!isBinary && (
            <button
              className={`${styles.tab} ${activeTab === "body" ? styles.active : ""}`}
              onClick={() => setActiveTab("body")}
            >
              Body
            </button>
          )}
          {hasPreview && (
            <button
              className={`${styles.tab} ${activeTab === "preview" ? styles.active : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              Preview
            </button>
          )}
          <button
            className={`${styles.tab} ${activeTab === "headers" ? styles.active : ""}`}
            onClick={() => setActiveTab("headers")}
          >
            Headers
          </button>
        </div>

        <div className={styles.responseContent}>
          {activeTab === "body" && !isBinary && (
            <div className={styles.responseBody}>{renderBody()}</div>
          )}
          {activeTab === "preview" && hasPreview && (
            <div className={styles.responsePreview}>{renderPreview()}</div>
          )}
          {activeTab === "headers" && (
            <div className={styles.responseHeaders}>{renderHeaders()}</div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
