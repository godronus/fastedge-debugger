import { useState, ReactNode } from "react";

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  headerExtra?: ReactNode;
}

export function CollapsiblePanel({
  title,
  children,
  defaultExpanded = true,
  headerExtra,
}: CollapsiblePanelProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  return (
    <div>
      <div
        className="collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          cursor: "pointer",
          padding: "12px 20px",
          background: "#2d2d2d",
          borderBottom: "1px solid #3d3d3d",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 600,
              color: "#e0e0e0",
            }}
          >
            {title}
          </h3>
          {headerExtra}
        </div>
        <span
          style={{
            fontSize: "12px",
            color: "#b0b0b0",
            transition: "transform 0.2s",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </div>

      {isExpanded && children}
    </div>
  );
}
