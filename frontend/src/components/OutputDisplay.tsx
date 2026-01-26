import { HookResult } from "../types";

interface OutputDisplayProps {
  results: Record<string, HookResult>;
}

export function OutputDisplay({ results }: OutputDisplayProps) {
  return (
    <section>
      <h2>6. Output</h2>
      {Object.entries(results).map(([hook, result]) => (
        <div key={hook} className="output-entry">
          <h3>{hook}</h3>
          {result.error && (
            <div style={{ color: "red" }}>Error: {result.error}</div>
          )}
          {result.returnValue !== undefined && (
            <div>Return Value: {result.returnValue}</div>
          )}
          {result.logs && (
            <pre
              style={{
                background: "#f5f5f5",
                padding: "8px",
                overflow: "auto",
              }}
            >
              {result.logs}
            </pre>
          )}
        </div>
      ))}
    </section>
  );
}
