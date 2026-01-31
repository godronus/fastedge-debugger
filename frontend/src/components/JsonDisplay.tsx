import { useMemo } from "react";
import { computeJsonDiff, type DiffLine } from "../utils/diff";

interface JsonDisplayProps {
  data: unknown;
  compareWith?: unknown;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * JsonDisplay component renders prettified JSON with optional diff view.
 * When compareWith is provided, shows a git-style diff with added (green) and removed (red) lines.
 */
export function JsonDisplay({
  data,
  compareWith,
  title,
  style = {},
}: JsonDisplayProps) {
  const diffLines = useMemo(() => {
    if (!compareWith) {
      return null;
    }

    return computeJsonDiff(compareWith, data);
  }, [data, compareWith]);

  const formattedData = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const defaultStyle: React.CSSProperties = {
    background: "#1e1e1e",
    padding: "12px",
    borderRadius: "4px",
    fontSize: "12px",
    margin: 0,
    overflow: "auto",
    ...style,
  };

  // If we have diff lines, render diff view
  if (diffLines) {
    return (
      <div>
        {title && (
          <h4
            style={{
              color: "#e0e0e0",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          >
            {title}
          </h4>
        )}
        <pre style={defaultStyle}>
          {diffLines.map((line, idx) => {
            let color = "#d4d4d4"; // Default text color
            let backgroundColor = "transparent";
            let prefix = " ";

            if (line.type === "added") {
              color = "#b5cea8"; // Green
              backgroundColor = "rgba(57, 185, 89, 0.15)";
              prefix = "+";
            } else if (line.type === "removed") {
              color = "#f48771"; // Red
              backgroundColor = "rgba(248, 135, 113, 0.15)";
              prefix = "-";
            }

            return (
              <div
                key={idx}
                style={{
                  color,
                  backgroundColor,
                  display: "block",
                  paddingLeft: "8px",
                  paddingRight: "8px",
                  margin: 0,
                }}
              >
                <span
                  style={{
                    opacity: 0.5,
                    marginRight: "8px",
                    userSelect: "none",
                  }}
                >
                  {prefix}
                </span>
                <span>{line.content}</span>
              </div>
            );
          })}
        </pre>
      </div>
    );
  }

  // No diff, render regular JSON
  return (
    <div>
      {title && (
        <h4
          style={{
            color: "#e0e0e0",
            fontSize: "13px",
            marginBottom: "8px",
          }}
        >
          {title}
        </h4>
      )}
      <pre style={defaultStyle}>{formattedData}</pre>
    </div>
  );
}
