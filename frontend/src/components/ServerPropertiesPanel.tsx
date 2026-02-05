import { CollapsiblePanel } from "./CollapsiblePanel";
import { PropertiesEditor } from "./PropertiesEditor";
import { Toggle } from "./Toggle";

interface ServerPropertiesPanelProps {
  properties: Record<string, string>;
  onPropertiesChange: (properties: Record<string, string>) => void;
  dotenvEnabled: boolean;
  onDotenvToggle: (enabled: boolean) => void;
}

export function ServerPropertiesPanel({
  properties,
  onPropertiesChange,
  dotenvEnabled,
  onDotenvToggle,
}: ServerPropertiesPanelProps) {
  return (
    <CollapsiblePanel
      title="Server Properties"
      defaultExpanded={false}
      headerExtra={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px",
          }}
          onClick={(e) => e.stopPropagation()} // Prevent collapse when clicking toggle
        >
          <Toggle
            checked={dotenvEnabled}
            onChange={onDotenvToggle}
            label="Load .env files"
            style={{
              fontWeight: dotenvEnabled ? "600" : "normal",
            }}
          />
          {dotenvEnabled && (
            <span style={{ color: "#4ade80", fontSize: "12px" }}>●</span>
          )}
        </div>
      }
    >
      <PropertiesEditor value={properties} onChange={onPropertiesChange} />
      {dotenvEnabled && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px 12px",
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "4px",
            fontSize: "13px",
            color: "#166534",
          }}
        >
          <strong>Dotenv enabled:</strong> Secrets from .env.secrets and
          dictionary values from .env.variables will be loaded when WASM is
          loaded.
        </div>
      )}
    </CollapsiblePanel>
  );
}
