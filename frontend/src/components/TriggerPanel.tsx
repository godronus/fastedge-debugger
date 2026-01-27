import { ChangeEvent } from "react";
import { HookCall } from "../types";
import { callHook } from "../api";

interface TriggerPanelProps {
  wasmLoaded: boolean;
  hookCall: HookCall;
  logLevel: number;
  onLogLevelChange: (level: number) => void;
  onResult: (hook: string, result: any) => void;
}

const HOOKS = [
  "onRequestHeaders",
  "onRequestBody",
  "onResponseHeaders",
  "onResponseBody",
];

export function TriggerPanel({
  wasmLoaded,
  hookCall,
  logLevel,
  onLogLevelChange,
  onResult,
}: TriggerPanelProps) {
  const handleRunHook = async (hook: string) => {
    try {
      const result = await callHook(hook, { ...hookCall, logLevel });
      onResult(hook, result);
    } catch (err) {
      onResult(hook, {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleRunAll = async () => {
    for (const hook of HOOKS) {
      await handleRunHook(hook);
    }
  };

  const handleLogLevelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onLogLevelChange(parseInt(e.target.value, 10));
  };

  return (
    <div className="trigger-panel">
      <div className="hooks-grid">
        {HOOKS.map((hook) => (
          <button
            key={hook}
            onClick={() => handleRunHook(hook)}
            disabled={!wasmLoaded}
            className="secondary"
          >
            {hook}
          </button>
        ))}
      </div>

      <div style={{ marginLeft: "auto" }} className="log-level-selector">
        <label style={{ margin: 0 }}>Log Level:</label>
        <select value={logLevel} onChange={handleLogLevelChange}>
          <option value="0">Trace (0)</option>
          <option value="1">Debug (1)</option>
          <option value="2">Info (2)</option>
          <option value="3">Warn (3)</option>
          <option value="4">Error (4)</option>
          <option value="5">Critical (5)</option>
        </select>
      </div>
    </div>
  );
}
